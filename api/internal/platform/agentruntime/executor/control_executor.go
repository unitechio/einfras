package executor

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	agent "einfra/api/internal/modules/agent/domain"
	"einfra/api/internal/platform/agentruntime/config"
)

var (
	packageNamePattern = regexp.MustCompile(`^[a-zA-Z0-9.+:_-]+$`)
	userNamePattern    = regexp.MustCompile(`^[a-z_][a-z0-9_-]{0,31}$`)
)

type ControlExecutor struct {
	allowedReadRoots  []string
	allowedWriteRoots []string
	pluginRoot        string
	maxReadBytes      int64
	maxTailLines      int
}

func NewControlExecutor(cfg *config.Config) *ControlExecutor {
	return &ControlExecutor{
		allowedReadRoots:  normalizeRoots(cfg.AllowedReadRoots),
		allowedWriteRoots: normalizeRoots(cfg.AllowedWriteRoots),
		pluginRoot:        filepath.Clean(cfg.PluginRoot),
		maxReadBytes:      cfg.MaxReadBytes,
		maxTailLines:      cfg.MaxTailLines,
	}
}

func (e *ControlExecutor) Execute(ctx context.Context, operation string, params map[string]any) (string, int, error) {
	if !agent.IsKnownControlOperation(operation) {
		return "", 1, fmt.Errorf("unsupported control operation %q", operation)
	}
	switch operation {
	case "file.read":
		return e.fileRead(params)
	case "file.list":
		return e.fileList(params)
	case "file.write":
		return e.fileWrite(params)
	case "file.chmod":
		return e.fileChmod(params)
	case "process.signal":
		return e.processSignal(params)
	case "package.install", "package.remove", "package.update":
		return e.packageAction(ctx, operation, params)
	case "access.list-users":
		return e.listUsers()
	case "access.list-ssh-keys":
		return e.listSSHKeys(params)
	case "access.add-ssh-key":
		return e.addSSHKey(params)
	case "config.read":
		return e.configRead(params)
	case "config.write":
		return e.configWrite(params)
	case "config.list-env":
		return e.listEnv()
	case "plugin.list":
		return e.pluginList()
	case "plugin.enable":
		return e.pluginEnableDisable(params, true)
	case "plugin.disable":
		return e.pluginEnableDisable(params, false)
	case "plugin.capabilities":
		return e.capabilities()
	case "log.tail":
		return e.logTail(params)
	default:
		return "", 1, fmt.Errorf("registered control operation %q has no executor implementation", operation)
	}
}

func marshalResult(result agent.TypedControlResult) (string, int, error) {
	raw, err := agent.MarshalTypedControlResult(result)
	if err != nil {
		return "", 1, err
	}
	return raw, 0, nil
}

func (e *ControlExecutor) fileRead(params map[string]any) (string, int, error) {
	path := firstNonEmpty(stringParam(params, "path"), stringParam(params, "target"))
	if path == "" {
		return "", 1, errors.New("path is required")
	}
	resolved, err := e.validatePath(path, false, e.allowedReadRoots)
	if err != nil {
		return "", 1, err
	}
	lines := intParam(params, "lines", 200)
	content, err := os.ReadFile(resolved)
	if err != nil {
		return "", 1, err
	}
	truncated := false
	if e.maxReadBytes > 0 && int64(len(content)) > e.maxReadBytes {
		content = content[:e.maxReadBytes]
		truncated = true
	}
	if lines > 0 {
		scanner := bufio.NewScanner(strings.NewReader(string(content)))
		out := make([]string, 0, lines)
		for scanner.Scan() {
			out = append(out, scanner.Text())
			if len(out) >= lines {
				break
			}
		}
		preview := strings.Join(out, "\n")
		preview, redactions := redactStructuredContent(resolved, preview)
		return marshalResult(agent.TypedControlResult{
			Operation:  "file.read",
			Summary:    "file content loaded",
			Data:       map[string]any{"path": resolved},
			Preview:    preview,
			Redactions: redactions,
			Truncated:  truncated,
		})
	}
	preview := string(content)
	preview, redactions := redactStructuredContent(resolved, preview)
	return marshalResult(agent.TypedControlResult{
		Operation:  "file.read",
		Summary:    "file content loaded",
		Data:       map[string]any{"path": resolved},
		Preview:    preview,
		Redactions: redactions,
		Truncated:  truncated,
	})
}

func (e *ControlExecutor) fileList(params map[string]any) (string, int, error) {
	root := firstNonEmpty(stringParam(params, "path"), ".")
	resolvedRoot, err := e.validatePath(root, false, e.allowedReadRoots)
	if err != nil {
		return "", 1, err
	}
	depth := intParam(params, "depth", 2)
	type entry struct {
		Path    string    `json:"path"`
		Name    string    `json:"name"`
		Type    string    `json:"type"`
		Mode    string    `json:"mode"`
		Size    int64     `json:"size"`
		ModTime time.Time `json:"mod_time"`
	}
	items := make([]entry, 0, 64)
	rootDepth := strings.Count(filepath.Clean(resolvedRoot), string(os.PathSeparator))
	err = filepath.WalkDir(resolvedRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		currentDepth := strings.Count(filepath.Clean(path), string(os.PathSeparator)) - rootDepth
		if currentDepth > depth {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		info, statErr := d.Info()
		if statErr != nil {
			return nil
		}
		itemType := "file"
		if d.IsDir() {
			itemType = "directory"
		}
		items = append(items, entry{
			Path:    path,
			Name:    d.Name(),
			Type:    itemType,
			Mode:    info.Mode().String(),
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
		return nil
	})
	if err != nil {
		return "", 1, err
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Path < items[j].Path })
	return marshalResult(agent.TypedControlResult{
		Operation: "file.list",
		Summary:   "directory listing loaded",
		Data:      items,
		Meta: map[string]any{
			"root":  resolvedRoot,
			"depth": depth,
		},
	})
}

func (e *ControlExecutor) fileWrite(params map[string]any) (string, int, error) {
	path := firstNonEmpty(stringParam(params, "path"), stringParam(params, "target"))
	if path == "" {
		return "", 1, errors.New("path is required")
	}
	resolved, err := e.validatePath(path, true, e.allowedWriteRoots)
	if err != nil {
		return "", 1, err
	}
	content := firstNonEmpty(stringParam(params, "content"), stringParam(params, "payload"))
	if e.maxReadBytes > 0 && int64(len(content)) > e.maxReadBytes {
		return "", 1, fmt.Errorf("content exceeds max size of %d bytes", e.maxReadBytes)
	}
	if err := os.MkdirAll(filepath.Dir(resolved), 0o755); err != nil {
		return "", 1, err
	}
	if err := os.WriteFile(resolved, []byte(content), 0o644); err != nil {
		return "", 1, err
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "file.write",
		Summary:   "file written successfully",
		Data: map[string]any{
			"path": resolved,
			"size": len(content),
		},
	})
}

func (e *ControlExecutor) fileChmod(params map[string]any) (string, int, error) {
	path := firstNonEmpty(stringParam(params, "path"), stringParam(params, "target"))
	modeStr := stringParam(params, "mode")
	if path == "" || modeStr == "" {
		return "", 1, errors.New("path and mode are required")
	}
	resolved, err := e.validatePath(path, true, e.allowedWriteRoots)
	if err != nil {
		return "", 1, err
	}
	modeValue, err := strconv.ParseUint(modeStr, 8, 32)
	if err != nil {
		return "", 1, fmt.Errorf("invalid chmod mode %q", modeStr)
	}
	if err := os.Chmod(resolved, os.FileMode(modeValue)); err != nil {
		return "", 1, err
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "file.chmod",
		Summary:   "permissions updated",
		Data: map[string]any{
			"path": resolved,
			"mode": modeStr,
		},
	})
}

func (e *ControlExecutor) processSignal(params map[string]any) (string, int, error) {
	pid := intParam(params, "pid", 0)
	if pid <= 0 {
		return "", 1, errors.New("pid is required")
	}
	if pid <= 1 {
		return "", 1, errors.New("refusing to signal privileged/system pid")
	}
	signalName := strings.ToUpper(firstNonEmpty(stringParam(params, "signal"), "TERM"))
	sig := syscall.SIGTERM
	switch signalName {
	case "KILL":
		sig = syscall.SIGKILL
	case "HUP":
		sig = syscall.SIGHUP
	case "INT":
		sig = syscall.SIGINT
	case "QUIT":
		sig = syscall.SIGQUIT
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		return "", 1, err
	}
	if err := proc.Signal(sig); err != nil {
		return "", 1, err
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "process.signal",
		Summary:   fmt.Sprintf("signal %s sent", signalName),
		Data: map[string]any{
			"pid":    pid,
			"signal": signalName,
		},
	})
}

func (e *ControlExecutor) packageAction(ctx context.Context, operation string, params map[string]any) (string, int, error) {
	packageName := stringParam(params, "package_name")
	action := strings.TrimPrefix(operation, "package.")
	if action == "" {
		action = stringParam(params, "action")
	}
	if action == "update" && packageName == "" {
		packageName = ""
	}
	if action != "update" && packageName == "" {
		return "", 1, errors.New("package_name is required")
	}
	if packageName != "" && !packageNamePattern.MatchString(packageName) {
		return "", 1, errors.New("package_name contains unsupported characters")
	}

	manager := detectPackageManager()
	if manager == nil {
		return "", 1, errors.New("no supported package manager found")
	}
	cmd, err := manager.BuildCommand(ctx, action, packageName)
	if err != nil {
		return "", 1, err
	}
	out, err := cmd.CombinedOutput()
	resultText := strings.TrimSpace(string(out))
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result, _, marshalErr := marshalResult(agent.TypedControlResult{
				Operation: operation,
				Status:    "failed",
				Summary:   "package operation returned non-zero exit",
				Preview:   resultText,
				Data: map[string]any{
					"package_name": packageName,
					"manager":      fmt.Sprintf("%T", manager),
					"action":       action,
				},
			})
			return result, exitErr.ExitCode(), marshalErr
		}
		return "", 1, err
	}
	return marshalResult(agent.TypedControlResult{
		Operation: operation,
		Summary:   "package operation completed",
		Preview:   resultText,
		Data: map[string]any{
			"package_name": packageName,
			"action":       action,
		},
	})
}

func (e *ControlExecutor) listUsers() (string, int, error) {
	if runtime.GOOS != "linux" {
		return "", 1, errors.New("list-users is only supported on linux")
	}
	content, err := os.ReadFile("/etc/passwd")
	if err != nil {
		return "", 1, err
	}
	type userEntry struct {
		Username string `json:"username"`
		UID      string `json:"uid"`
		GID      string `json:"gid"`
		Home     string `json:"home"`
		Shell    string `json:"shell"`
	}
	items := make([]userEntry, 0, 16)
	scanner := bufio.NewScanner(strings.NewReader(string(content)))
	for scanner.Scan() {
		parts := strings.Split(scanner.Text(), ":")
		if len(parts) < 7 {
			continue
		}
		items = append(items, userEntry{
			Username: parts[0],
			UID:      parts[2],
			GID:      parts[3],
			Home:     parts[5],
			Shell:    parts[6],
		})
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.list-users",
		Summary:   "user list loaded",
		Data:      items,
	})
}

func (e *ControlExecutor) listSSHKeys(params map[string]any) (string, int, error) {
	target := stringParam(params, "target")
	if err := validateUserTarget(target); err != nil {
		return "", 1, err
	}
	path := filepath.Join(homeDirForUser(target), ".ssh", "authorized_keys")
	resolved, err := e.validatePath(path, false, e.allowedReadRoots)
	if err != nil {
		return "", 1, err
	}
	content, err := os.ReadFile(resolved)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", 0, nil
		}
		return "", 1, err
	}
	preview, redactions := redactSSHKeys(string(content))
	return marshalResult(agent.TypedControlResult{
		Operation:  "access.list-ssh-keys",
		Summary:    "ssh keys loaded",
		Data:       map[string]any{"target": target},
		Preview:    preview,
		Redactions: redactions,
	})
}

func (e *ControlExecutor) addSSHKey(params map[string]any) (string, int, error) {
	target := stringParam(params, "target")
	if err := validateUserTarget(target); err != nil {
		return "", 1, err
	}
	payload := strings.TrimSpace(stringParam(params, "payload"))
	if payload == "" {
		return "", 1, errors.New("payload is required")
	}
	sshDir := filepath.Join(homeDirForUser(target), ".ssh")
	resolvedDir, err := e.validatePath(sshDir, true, e.allowedWriteRoots)
	if err != nil {
		return "", 1, err
	}
	if err := os.MkdirAll(resolvedDir, 0o700); err != nil {
		return "", 1, err
	}
	authPath := filepath.Join(resolvedDir, "authorized_keys")
	f, err := os.OpenFile(authPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return "", 1, err
	}
	defer f.Close()
	if _, err := f.WriteString(payload + "\n"); err != nil {
		return "", 1, err
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.add-ssh-key",
		Summary:   "ssh key added",
		Data: map[string]any{
			"target": target,
		},
	})
}

func (e *ControlExecutor) listEnv() (string, int, error) {
	env := os.Environ()
	sort.Strings(env)
	preview, redactions := redactEnv(strings.Join(env, "\n"))
	return marshalResult(agent.TypedControlResult{
		Operation:  "config.list-env",
		Summary:    "environment loaded",
		Preview:    preview,
		Redactions: redactions,
	})
}

func (e *ControlExecutor) pluginList() (string, int, error) {
	root := e.pluginRoot
	items := make([]string, 0, 16)
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		items = append(items, path)
		return nil
	})
	return marshalResult(agent.TypedControlResult{
		Operation: "plugin.list",
		Summary:   "plugin list loaded",
		Data:      items,
	})
}

func (e *ControlExecutor) configRead(params map[string]any) (string, int, error) {
	path := stringParam(params, "target")
	resolved, err := e.validatePath(path, false, e.allowedReadRoots)
	if err != nil {
		return "", 1, err
	}
	content, err := os.ReadFile(resolved)
	if err != nil {
		return "", 1, err
	}
	truncated := false
	if e.maxReadBytes > 0 && int64(len(content)) > e.maxReadBytes {
		content = content[:e.maxReadBytes]
		truncated = true
	}
	preview, redactions := redactEnv(string(content))
	return marshalResult(agent.TypedControlResult{
		Operation:  "config.read",
		Summary:    "config content loaded",
		Preview:    preview,
		Redactions: redactions,
		Truncated:  truncated,
		Data:       map[string]any{"path": resolved},
	})
}

func (e *ControlExecutor) configWrite(params map[string]any) (string, int, error) {
	path := stringParam(params, "target")
	content := stringParam(params, "payload")
	resolved, err := e.validatePath(path, true, e.allowedWriteRoots)
	if err != nil {
		return "", 1, err
	}
	if e.maxReadBytes > 0 && int64(len(content)) > e.maxReadBytes {
		return "", 1, fmt.Errorf("content exceeds max size of %d bytes", e.maxReadBytes)
	}
	if err := os.MkdirAll(filepath.Dir(resolved), 0o755); err != nil {
		return "", 1, err
	}
	if err := os.WriteFile(resolved, []byte(content), 0o644); err != nil {
		return "", 1, err
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "config.write",
		Summary:   "config written successfully",
		Data:      map[string]any{"path": resolved, "size": len(content)},
	})
}

func (e *ControlExecutor) pluginEnableDisable(params map[string]any, enable bool) (string, int, error) {
	target := strings.TrimSpace(stringParam(params, "target"))
	if target == "" {
		return "", 1, errors.New("target is required")
	}
	if filepath.IsAbs(target) || strings.Contains(target, "..") {
		return "", 1, errors.New("target must be a relative plugin path")
	}
	path := filepath.Join(e.pluginRoot, filepath.Clean(target))
	info, err := os.Stat(path)
	if err != nil {
		return "", 1, err
	}
	mode := info.Mode()
	if enable {
		mode |= 0o111
	} else {
		mode &^= 0o111
	}
	if err := os.Chmod(path, mode); err != nil {
		return "", 1, err
	}
	if enable {
		return marshalResult(agent.TypedControlResult{
			Operation: "plugin.enable",
			Summary:   "plugin enabled",
			Data:      map[string]any{"target": target},
		})
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "plugin.disable",
		Summary:   "plugin disabled",
		Data:      map[string]any{"target": target},
	})
}

func (e *ControlExecutor) capabilities() (string, int, error) {
	caps := []string{
		"service-proxy",
		"control-operation",
		"file.read",
		"file.list",
		"file.write",
		"file.chmod",
		"process.signal",
		"package.install",
		"package.remove",
		"package.update",
		"access.list-users",
		"access.list-ssh-keys",
		"access.add-ssh-key",
		"config.read",
		"config.write",
		"config.list-env",
		"plugin.list",
		"plugin.enable",
		"plugin.disable",
		"log.tail",
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "plugin.capabilities",
		Summary:   "capabilities listed",
		Data:      caps,
	})
}

func (e *ControlExecutor) logTail(params map[string]any) (string, int, error) {
	path := firstNonEmpty(stringParam(params, "path"), stringParam(params, "target"))
	if path == "" {
		return "", 1, errors.New("path is required")
	}
	resolved, err := e.validatePath(path, false, e.allowedReadRoots)
	if err != nil {
		return "", 1, err
	}
	lines := intParam(params, "lines", 200)
	if e.maxTailLines > 0 && lines > e.maxTailLines {
		lines = e.maxTailLines
	}
	content, err := os.ReadFile(resolved)
	if err != nil {
		return "", 1, err
	}
	parts := strings.Split(string(content), "\n")
	if len(parts) > lines {
		parts = parts[len(parts)-lines:]
	}
	preview := strings.Join(parts, "\n")
	preview, redactions := redactStructuredContent(resolved, preview)
	return marshalResult(agent.TypedControlResult{
		Operation:  "log.tail",
		Summary:    "log lines loaded",
		Preview:    preview,
		Redactions: redactions,
		Data:       map[string]any{"path": resolved, "lines": lines},
	})
}

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func stringParam(params map[string]any, key string) string {
	value, ok := params[key]
	if !ok {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	default:
		return fmt.Sprintf("%v", v)
	}
}

func intParam(params map[string]any, key string, fallback int) int {
	value, ok := params[key]
	if !ok {
		return fallback
	}
	switch v := value.(type) {
	case int:
		return v
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		i, _ := v.Int64()
		return int(i)
	case string:
		i, err := strconv.Atoi(v)
		if err == nil {
			return i
		}
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func homeDirForUser(user string) string {
	switch strings.TrimSpace(user) {
	case "", "root":
		return "/root"
	default:
		return filepath.Join("/home", strings.TrimSpace(user))
	}
}

func redactStructuredContent(path, content string) (string, []string) {
	redactions := make([]string, 0)
	lowerPath := strings.ToLower(path)
	if strings.Contains(lowerPath, ".env") || strings.Contains(lowerPath, "secret") || strings.Contains(lowerPath, "config") {
		return redactEnv(content)
	}
	return content, redactions
}

func redactEnv(content string) (string, []string) {
	lines := strings.Split(content, "\n")
	redactions := make([]string, 0)
	for i, line := range lines {
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(parts[0]))
		if strings.Contains(key, "secret") || strings.Contains(key, "token") || strings.Contains(key, "password") || strings.Contains(key, "key") {
			lines[i] = parts[0] + "=<redacted>"
			redactions = append(redactions, parts[0])
		}
	}
	return strings.Join(lines, "\n"), redactions
}

func redactSSHKeys(content string) (string, []string) {
	lines := strings.Split(content, "\n")
	redactions := make([]string, 0)
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		comment := ""
		if len(fields) > 2 {
			comment = fields[2]
		}
		lines[i] = fmt.Sprintf("%s <redacted> %s", fields[0], comment)
		redactions = append(redactions, "ssh_key_material")
	}
	return strings.Join(lines, "\n"), redactions
}

func (e *ControlExecutor) validatePath(path string, write bool, roots []string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", errors.New("path is required")
	}
	resolved, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("resolve path: %w", err)
	}
	for _, root := range roots {
		allowedRoot, rootErr := filepath.Abs(filepath.Clean(root))
		if rootErr != nil {
			continue
		}
		if resolved == allowedRoot || strings.HasPrefix(resolved, allowedRoot+string(os.PathSeparator)) {
			return resolved, nil
		}
	}
	if write {
		return "", fmt.Errorf("path %q is outside allowed write roots", resolved)
	}
	return "", fmt.Errorf("path %q is outside allowed read roots", resolved)
}

func normalizeRoots(items []string) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		result = append(result, filepath.Clean(item))
	}
	return result
}

func validateUserTarget(user string) error {
	user = strings.TrimSpace(user)
	if user == "" {
		return errors.New("target user is required")
	}
	if user == "root" {
		return errors.New("root access mutation is not allowed via typed control operation")
	}
	if !userNamePattern.MatchString(user) {
		return fmt.Errorf("unsupported user target %q", user)
	}
	return nil
}

type packageManager interface {
	BuildCommand(ctx context.Context, action, packageName string) (*exec.Cmd, error)
}

type aptManager struct{}
type dnfManager struct{}
type yumManager struct{}

func detectPackageManager() packageManager {
	switch {
	case commandExists("apt-get"):
		return aptManager{}
	case commandExists("dnf"):
		return dnfManager{}
	case commandExists("yum"):
		return yumManager{}
	default:
		return nil
	}
}

func (aptManager) BuildCommand(ctx context.Context, action, packageName string) (*exec.Cmd, error) {
	args := []string{"apt-get", "-y"}
	switch action {
	case "install":
		args = append(args, "install")
	case "remove":
		args = append(args, "remove")
	case "update":
		args = append(args, "update")
	default:
		return nil, fmt.Errorf("unsupported apt action %q", action)
	}
	if packageName != "" {
		args = append(args, packageName)
	}
	return exec.CommandContext(ctx, "sudo", args...), nil
}

func (dnfManager) BuildCommand(ctx context.Context, action, packageName string) (*exec.Cmd, error) {
	if action != "install" && action != "remove" && action != "update" {
		return nil, fmt.Errorf("unsupported dnf action %q", action)
	}
	args := []string{"dnf", "-y", action}
	if packageName != "" {
		args = append(args, packageName)
	}
	return exec.CommandContext(ctx, "sudo", args...), nil
}

func (yumManager) BuildCommand(ctx context.Context, action, packageName string) (*exec.Cmd, error) {
	if action != "install" && action != "remove" && action != "update" {
		return nil, fmt.Errorf("unsupported yum action %q", action)
	}
	args := []string{"yum", "-y", action}
	if packageName != "" {
		args = append(args, packageName)
	}
	return exec.CommandContext(ctx, "sudo", args...), nil
}

func init() {
	signal.Ignore(syscall.SIGPIPE)
}
