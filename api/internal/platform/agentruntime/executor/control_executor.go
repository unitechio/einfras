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
	groupNamePattern   = regexp.MustCompile(`^[a-z_][a-z0-9_-]{0,31}$`)
)

type ControlExecutor struct {
	allowedReadRoots  []string
	allowedWriteRoots []string
	pluginRoot        string
	maxReadBytes      int64
	maxTailLines      int
	tenantID          string
	tenantAllowlist   map[string]struct{}
	tenantDenylist    map[string]struct{}
	groupAllowlist    map[string]struct{}
	groupDenylist     map[string]struct{}
	groupRoleMatrix   map[string]map[string]map[string]struct{}
}

func NewControlExecutor(cfg *config.Config) *ControlExecutor {
	return &ControlExecutor{
		allowedReadRoots:  normalizeRoots(cfg.AllowedReadRoots),
		allowedWriteRoots: normalizeRoots(cfg.AllowedWriteRoots),
		pluginRoot:        filepath.Clean(cfg.PluginRoot),
		maxReadBytes:      cfg.MaxReadBytes,
		maxTailLines:      cfg.MaxTailLines,
		tenantID:          strings.ToLower(strings.TrimSpace(cfg.TenantID)),
		tenantAllowlist:   cfg.TenantAllowlist,
		tenantDenylist:    cfg.TenantDenylist,
		groupAllowlist:    cfg.GroupAllowlist,
		groupDenylist:     cfg.GroupDenylist,
		groupRoleMatrix:   cfg.GroupOperationRoles,
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
	case "package.list", "package.install", "package.remove", "package.update":
		return e.packageAction(ctx, operation, params)
	case "access.list-users":
		return e.listUsers()
	case "access.list-groups":
		return e.listGroups()
	case "access.add-user":
		return e.addUser(ctx, params)
	case "access.update-user":
		return e.updateUser(ctx, params)
	case "access.delete-user":
		return e.deleteUser(ctx, params)
	case "access.add-group":
		return e.addGroup(ctx, params)
	case "access.update-group":
		return e.updateGroup(ctx, params)
	case "access.delete-group":
		return e.deleteGroup(ctx, params)
	case "access.list-ssh-keys":
		return e.listSSHKeys(params)
	case "access.add-ssh-key":
		return e.addSSHKey(params)
	case "access.delete-ssh-key":
		return e.deleteSSHKey(ctx, params)
	case "access.generate-ssh-key":
		return e.generateSSHKey(ctx, params)
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

func (e *ControlExecutor) ExecutePayload(ctx context.Context, payload agent.ControlOperationPayload) (string, int, error) {
	if err := e.authorize(payload); err != nil {
		return "", 1, err
	}
	return e.Execute(ctx, payload.Operation, payload.Params)
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
	if action == "list" {
		return e.packageList(ctx)
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

func (e *ControlExecutor) packageList(ctx context.Context) (string, int, error) {
	manager := detectPackageManager()
	if manager == nil {
		return "", 1, errors.New("no supported package manager found")
	}
	cmd, err := manager.BuildListCommand(ctx)
	if err != nil {
		return "", 1, err
	}
	out, err := cmd.CombinedOutput()
	resultText := strings.TrimSpace(string(out))
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result, _, marshalErr := marshalResult(agent.TypedControlResult{
				Operation: "package.list",
				Status:    "failed",
				Summary:   "package inventory returned non-zero exit",
				Preview:   resultText,
			})
			return result, exitErr.ExitCode(), marshalErr
		}
		return "", 1, err
	}
	type packageEntry struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Arch    string `json:"arch"`
	}
	items := make([]packageEntry, 0, 200)
	for _, line := range strings.Split(resultText, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		items = append(items, packageEntry{
			Name:    safeSlice(parts, 0),
			Version: safeSlice(parts, 1),
			Arch:    firstNonEmpty(safeSlice(parts, 2), "-"),
		})
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "package.list",
		Summary:   "package inventory loaded",
		Data:      items,
		Preview:   resultText,
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

func (e *ControlExecutor) listGroups() (string, int, error) {
	if runtime.GOOS != "linux" {
		return "", 1, errors.New("list-groups is only supported on linux")
	}
	content, err := os.ReadFile("/etc/group")
	if err != nil {
		return "", 1, err
	}
	type groupEntry struct {
		Name    string   `json:"name"`
		GID     string   `json:"gid"`
		Members []string `json:"members"`
	}
	items := make([]groupEntry, 0, 32)
	scanner := bufio.NewScanner(strings.NewReader(string(content)))
	for scanner.Scan() {
		parts := strings.Split(scanner.Text(), ":")
		if len(parts) < 4 {
			continue
		}
		members := make([]string, 0)
		if strings.TrimSpace(parts[3]) != "" {
			for _, member := range strings.Split(parts[3], ",") {
				member = strings.TrimSpace(member)
				if member != "" {
					members = append(members, member)
				}
			}
		}
		items = append(items, groupEntry{
			Name:    parts[0],
			GID:     parts[2],
			Members: members,
		})
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.list-groups",
		Summary:   "group list loaded",
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
	if err := validateSSHPublicKeyFormat(payload); err != nil {
		return "", 1, err
	}
	if err := appendAuthorizedKey(e, target, payload); err != nil {
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

func (e *ControlExecutor) deleteSSHKey(ctx context.Context, params map[string]any) (string, int, error) {
	target := stringParam(params, "target")
	if err := validateUserTarget(target); err != nil {
		return "", 1, err
	}
	payloadRaw := strings.TrimSpace(stringParam(params, "payload"))
	if payloadRaw == "" {
		return "", 1, errors.New("payload with key_value or line_index is required")
	}
	var spec struct {
		KeyValue  string `json:"key_value"`
		LineIndex *int   `json:"line_index"`
	}
	if err := json.Unmarshal([]byte(payloadRaw), &spec); err != nil {
		return "", 1, fmt.Errorf("invalid payload json: %w", err)
	}
	authPath := filepath.Join(homeDirForUser(target), ".ssh", "authorized_keys")
	resolvedPath, err := e.validatePath(authPath, true, e.allowedWriteRoots)
	if err != nil {
		return "", 1, err
	}
	content, err := os.ReadFile(resolvedPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", 1, errors.New("authorized_keys file does not exist")
		}
		return "", 1, err
	}
	lines := strings.Split(strings.TrimRight(string(content), "\n"), "\n")
	newLines := make([]string, 0, len(lines))
	deleted := 0
	for idx, line := range lines {
		remove := false
		if spec.KeyValue != "" && strings.TrimSpace(line) == strings.TrimSpace(spec.KeyValue) {
			remove = true
		}
		if spec.LineIndex != nil && idx == *spec.LineIndex {
			remove = true
		}
		if remove {
			deleted++
		} else {
			newLines = append(newLines, line)
		}
	}
	if deleted == 0 {
		return "", 1, errors.New("key not found in authorized_keys")
	}
	newContent := strings.Join(newLines, "\n")
	if len(newLines) > 0 {
		newContent += "\n"
	}
	if err := os.WriteFile(resolvedPath, []byte(newContent), 0o600); err != nil {
		return "", 1, err
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.delete-ssh-key",
		Summary:   fmt.Sprintf("%d key(s) removed from authorized_keys", deleted),
		Data:      map[string]any{"target": target, "deleted": deleted},
	})
}

func (e *ControlExecutor) generateSSHKey(ctx context.Context, params map[string]any) (string, int, error) {
	target := stringParam(params, "target")
	if err := validateUserTarget(target); err != nil {
		return "", 1, err
	}
	payloadRaw := strings.TrimSpace(stringParam(params, "payload"))
	var spec struct {
		Type    string `json:"type"`
		Comment string `json:"comment"`
	}
	spec.Type = "ed25519"
	if payloadRaw != "" {
		_ = json.Unmarshal([]byte(payloadRaw), &spec)
	}
	spec.Type = strings.ToLower(strings.TrimSpace(spec.Type))
	if spec.Type != "ed25519" && spec.Type != "rsa" {
		spec.Type = "ed25519"
	}
	if spec.Comment == "" {
		spec.Comment = fmt.Sprintf("%s@einfra", target)
	}
	sshDir := filepath.Join(homeDirForUser(target), ".ssh")
	resolvedDir, err := e.validatePath(sshDir, true, e.allowedWriteRoots)
	if err != nil {
		return "", 1, err
	}
	if err := os.MkdirAll(resolvedDir, 0o700); err != nil {
		return "", 1, err
	}
	keyPath := filepath.Join(resolvedDir, "id_"+spec.Type)
	genArgs := []string{"ssh-keygen", "-t", spec.Type, "-f", keyPath, "-N", "", "-C", spec.Comment}
	if spec.Type == "rsa" {
		genArgs = append(genArgs, "-b", "4096")
	}
	if output, exitCode, err := runPrivilegedCommand(ctx, genArgs...); err != nil {
		return commandFailure("access.generate-ssh-key", "ssh-keygen failed", output, exitCode, err)
	}
	// Append the generated public key to authorized_keys
	pubKeyBytes, err := os.ReadFile(keyPath + ".pub")
	if err != nil {
		return "", 1, fmt.Errorf("generated public key not found: %w", err)
	}
	pubKey := strings.TrimSpace(string(pubKeyBytes))
	if appendErr := appendAuthorizedKey(e, target, pubKey); appendErr != nil {
		return "", 1, appendErr
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.generate-ssh-key",
		Summary:   fmt.Sprintf("%s key pair generated and public key authorized for %s", spec.Type, target),
		Data: map[string]any{
			"target":   target,
			"key_type": spec.Type,
			"key_path": keyPath,
			"comment":  spec.Comment,
		},
	})
}

// appendAuthorizedKey writes a validated public key to ~/.ssh/authorized_keys.
// It creates the .ssh directory with correct permissions (0700) if missing.
func appendAuthorizedKey(e *ControlExecutor, target, pubKey string) error {
	if err := validateSSHPublicKeyFormat(pubKey); err != nil {
		return err
	}
	sshDir := filepath.Join(homeDirForUser(target), ".ssh")
	resolvedDir, err := e.validatePath(sshDir, true, e.allowedWriteRoots)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(resolvedDir, 0o700); err != nil {
		return err
	}
	authPath := filepath.Join(resolvedDir, "authorized_keys")
	f, err := os.OpenFile(authPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(strings.TrimSpace(pubKey) + "\n")
	return err
}

// setPasswordViaPipe sets a Linux user's password by piping "user:pass" to
// chpasswd via stdin. This avoids the password ever appearing in process args,
// shell history, or any structured log (it is never part of params map).
func setPasswordViaPipe(ctx context.Context, username, password string) error {
	if username == "" || password == "" {
		return errors.New("username and password are required for chpasswd")
	}
	command := "chpasswd"
	var args []string
	if runtime.GOOS != "windows" && !runningAsRoot() {
		if !commandExists("sudo") {
			return errors.New("agent must run as root or have passwordless sudo to set passwords")
		}
		args = []string{"sudo", command}
	} else {
		args = []string{command}
	}
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Stdin = strings.NewReader(username + ":" + password + "\n")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("chpasswd failed: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// validateSSHPublicKeyFormat does a lightweight sanity-check on public key strings.
func validateSSHPublicKeyFormat(key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return errors.New("ssh public key is empty")
	}
	validPrefixes := []string{
		"ssh-rsa ", "ssh-ed25519 ", "ssh-dss ",
		"ecdsa-sha2-nistp256 ", "ecdsa-sha2-nistp384 ", "ecdsa-sha2-nistp521 ",
		"sk-ssh-ed25519@openssh.com ", "sk-ecdsa-sha2-nistp256@openssh.com ",
	}
	for _, prefix := range validPrefixes {
		if strings.HasPrefix(key, prefix) {
			return nil
		}
	}
	return errors.New("invalid SSH public key format: must start with ssh-rsa, ssh-ed25519, ecdsa-sha2-*, etc.")
}

func (e *ControlExecutor) addUser(ctx context.Context, params map[string]any) (string, int, error) {
	spec, err := parseAccessMutation(params)
	if err != nil {
		return "", 1, err
	}
	if err := validateUserTarget(spec.Target); err != nil {
		return "", 1, err
	}
	args := []string{"useradd", "-m"}
	if spec.Home != "" {
		args = append(args, "-d", spec.Home)
	}
	if spec.Shell != "" {
		args = append(args, "-s", spec.Shell)
	}
	if len(spec.Groups) > 0 {
		args = append(args, "-G", strings.Join(spec.Groups, ","))
	}
	if spec.UID != nil {
		args = append(args, "-u", strconv.Itoa(*spec.UID))
	}
	if spec.System {
		args = append(args, "--system")
	}
	args = append(args, spec.Target)
	if output, exitCode, err := runPrivilegedCommand(ctx, args...); err != nil {
		return commandFailure("access.add-user", "user creation failed", output, exitCode, err)
	}

	// ── Set password securely via chpasswd stdin pipe ────────────────────────
	// NEVER pass the password as a CLI argument; process args are visible to
	// other processes via /proc/<pid>/cmdline and shell history.
	// chpasswd reads "username:password" from stdin, which is not logged.
	if spec.Password != "" {
		if err := setPasswordViaPipe(ctx, spec.Target, spec.Password); err != nil {
			// Best-effort cleanup: delete the user we just created
			_, _, _ = runPrivilegedCommand(ctx, "userdel", "-r", spec.Target)
			return commandFailure("access.add-user", "password setup failed — user rolled back", err.Error(), 1, err)
		}
	}

	// ── Append SSH public key if provided ────────────────────────────────────
	if spec.SSHKey != "" {
		if appendErr := appendAuthorizedKey(e, spec.Target, spec.SSHKey); appendErr != nil {
			// Non-fatal: user exists, password set — just report the warning
			return marshalResult(agent.TypedControlResult{
				Operation: "access.add-user",
				Summary:   "user created (password set) but SSH key append failed: " + appendErr.Error(),
				Data: map[string]any{
					"target":   spec.Target,
					"home":     spec.Home,
					"shell":    spec.Shell,
					"groups":   spec.Groups,
					"ssh_key":  false,
				},
			})
		}
	}

	return marshalResult(agent.TypedControlResult{
		Operation: "access.add-user",
		Summary:   "user created",
		Data: map[string]any{
			"target":  spec.Target,
			"home":    spec.Home,
			"shell":   spec.Shell,
			"groups":  spec.Groups,
			"ssh_key": spec.SSHKey != "",
		},
	})
}

func (e *ControlExecutor) updateUser(ctx context.Context, params map[string]any) (string, int, error) {
	spec, err := parseAccessMutation(params)
	if err != nil {
		return "", 1, err
	}
	if err := validateUserTarget(spec.Target); err != nil {
		return "", 1, err
	}
	if spec.RenameTo != "" {
		if err := validateUserTarget(spec.RenameTo); err != nil {
			return "", 1, err
		}
		if output, exitCode, err := runPrivilegedCommand(ctx, "usermod", "-l", spec.RenameTo, spec.Target); err != nil {
			return commandFailure("access.update-user", "username update failed", output, exitCode, err)
		}
		spec.Target = spec.RenameTo
	}
	if spec.Home != "" {
		if output, exitCode, err := runPrivilegedCommand(ctx, "usermod", "-d", spec.Home, "-m", spec.Target); err != nil {
			return commandFailure("access.update-user", "home update failed", output, exitCode, err)
		}
	}
	if spec.Shell != "" {
		if output, exitCode, err := runPrivilegedCommand(ctx, "usermod", "-s", spec.Shell, spec.Target); err != nil {
			return commandFailure("access.update-user", "shell update failed", output, exitCode, err)
		}
	}
	if len(spec.Groups) > 0 {
		if output, exitCode, err := runPrivilegedCommand(ctx, "usermod", "-G", strings.Join(spec.Groups, ","), spec.Target); err != nil {
			return commandFailure("access.update-user", "group membership update failed", output, exitCode, err)
		}
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.update-user",
		Summary:   "user updated",
		Data: map[string]any{
			"target": spec.Target,
			"home":   spec.Home,
			"shell":  spec.Shell,
			"groups": spec.Groups,
		},
	})
}

func (e *ControlExecutor) deleteUser(ctx context.Context, params map[string]any) (string, int, error) {
	spec, err := parseAccessMutation(params)
	if err != nil {
		return "", 1, err
	}
	if err := validateUserTarget(spec.Target); err != nil {
		return "", 1, err
	}
	args := []string{"userdel"}
	if spec.RemoveHome {
		args = append(args, "-r")
	}
	args = append(args, spec.Target)
	if output, exitCode, err := runPrivilegedCommand(ctx, args...); err != nil {
		return commandFailure("access.delete-user", "user deletion failed", output, exitCode, err)
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.delete-user",
		Summary:   "user deleted",
		Data:      map[string]any{"target": spec.Target},
	})
}

func (e *ControlExecutor) addGroup(ctx context.Context, params map[string]any) (string, int, error) {
	spec, err := parseAccessMutation(params)
	if err != nil {
		return "", 1, err
	}
	if err := validateGroupTarget(spec.Target); err != nil {
		return "", 1, err
	}
	groupArgs := []string{"groupadd"}
	if spec.GID != nil {
		groupArgs = append(groupArgs, "-g", strconv.Itoa(*spec.GID))
	}
	groupArgs = append(groupArgs, spec.Target)
	if output, exitCode, err := runPrivilegedCommand(ctx, groupArgs...); err != nil {
		return commandFailure("access.add-group", "group creation failed", output, exitCode, err)
	}
	if len(spec.Members) > 0 {
		if output, exitCode, err := runPrivilegedCommand(ctx, "gpasswd", "-M", strings.Join(spec.Members, ","), spec.Target); err != nil {
			return commandFailure("access.add-group", "group member assignment failed", output, exitCode, err)
		}
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.add-group",
		Summary:   "group created",
		Data: map[string]any{
			"target":  spec.Target,
			"members": spec.Members,
		},
	})
}

func (e *ControlExecutor) updateGroup(ctx context.Context, params map[string]any) (string, int, error) {
	spec, err := parseAccessMutation(params)
	if err != nil {
		return "", 1, err
	}
	if err := validateGroupTarget(spec.Target); err != nil {
		return "", 1, err
	}
	if spec.RenameTo != "" {
		if err := validateGroupTarget(spec.RenameTo); err != nil {
			return "", 1, err
		}
		if output, exitCode, err := runPrivilegedCommand(ctx, "groupmod", "-n", spec.RenameTo, spec.Target); err != nil {
			return commandFailure("access.update-group", "group rename failed", output, exitCode, err)
		}
		spec.Target = spec.RenameTo
	}
	if len(spec.Members) > 0 {
		if output, exitCode, err := runPrivilegedCommand(ctx, "gpasswd", "-M", strings.Join(spec.Members, ","), spec.Target); err != nil {
			return commandFailure("access.update-group", "group membership update failed", output, exitCode, err)
		}
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.update-group",
		Summary:   "group updated",
		Data: map[string]any{
			"target":  spec.Target,
			"members": spec.Members,
		},
	})
}

func (e *ControlExecutor) deleteGroup(ctx context.Context, params map[string]any) (string, int, error) {
	spec, err := parseAccessMutation(params)
	if err != nil {
		return "", 1, err
	}
	if err := validateGroupTarget(spec.Target); err != nil {
		return "", 1, err
	}
	if output, exitCode, err := runPrivilegedCommand(ctx, "groupdel", spec.Target); err != nil {
		return commandFailure("access.delete-group", "group deletion failed", output, exitCode, err)
	}
	return marshalResult(agent.TypedControlResult{
		Operation: "access.delete-group",
		Summary:   "group deleted",
		Data:      map[string]any{"target": spec.Target},
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

func safeSlice(items []string, index int) string {
	if index < 0 || index >= len(items) {
		return ""
	}
	return strings.TrimSpace(items[index])
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

func validateGroupTarget(group string) error {
	group = strings.TrimSpace(group)
	if group == "" {
		return errors.New("target group is required")
	}
	if group == "root" {
		return errors.New("root group mutation is not allowed via typed control operation")
	}
	if !groupNamePattern.MatchString(group) {
		return fmt.Errorf("unsupported group target %q", group)
	}
	return nil
}

type accessMutationSpec struct {
	Target     string   `json:"target"`
	RenameTo   string   `json:"rename_to"`
	Home       string   `json:"home"`
	Shell      string   `json:"shell"`
	Groups     []string `json:"groups"`
	Members    []string `json:"members"`
	RemoveHome bool     `json:"remove_home"`
	// User-specific advanced fields
	Password string `json:"password"` // never logged; applied via chpasswd stdin
	SSHKey   string `json:"ssh_key"`  // appended to authorized_keys if set
	UID      *int   `json:"uid"`      // optional forced UID
	System   bool   `json:"system"`   // create as system account (--system)
	// Group-specific
	GID *int `json:"gid"` // optional forced GID
}

func parseAccessMutation(params map[string]any) (accessMutationSpec, error) {
	spec := accessMutationSpec{
		Target: strings.TrimSpace(stringParam(params, "target")),
	}
	payload := strings.TrimSpace(stringParam(params, "payload"))
	if payload == "" {
		return spec, nil
	}
	if err := json.Unmarshal([]byte(payload), &spec); err != nil {
		return accessMutationSpec{}, fmt.Errorf("invalid payload json: %w", err)
	}
	spec.Target = firstNonEmpty(strings.TrimSpace(stringParam(params, "target")), strings.TrimSpace(spec.Target))
	spec.RenameTo = strings.TrimSpace(spec.RenameTo)
	spec.Home = strings.TrimSpace(spec.Home)
	spec.Shell = strings.TrimSpace(spec.Shell)
	spec.Password = strings.TrimSpace(spec.Password)
	spec.SSHKey = strings.TrimSpace(spec.SSHKey)
	spec.Groups = normalizePrincipals(spec.Groups)
	spec.Members = normalizePrincipals(spec.Members)
	return spec, nil
}

func normalizePrincipals(items []string) []string {
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func runPrivilegedCommand(ctx context.Context, args ...string) (string, int, error) {
	command := args
	if runtime.GOOS != "windows" && !runningAsRoot() {
		if commandExists("sudo") {
			command = append([]string{"sudo", "-n"}, args...)
		} else {
			return "", 1, errors.New("agent must run as root or have passwordless sudo for access mutations")
		}
	}
	cmd := exec.CommandContext(ctx, command[0], command[1:]...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return strings.TrimSpace(string(out)), exitErr.ExitCode(), err
		}
		return strings.TrimSpace(string(out)), 1, err
	}
	return strings.TrimSpace(string(out)), 0, nil
}

func runningAsRoot() bool {
	if runtime.GOOS == "windows" {
		return false
	}
	out, err := exec.Command("id", "-u").Output()
	if err != nil {
		return strings.EqualFold(strings.TrimSpace(os.Getenv("USER")), "root")
	}
	return strings.TrimSpace(string(out)) == "0"
}

func commandFailure(operation, summary, preview string, exitCode int, err error) (string, int, error) {
	detailedSummary := strings.TrimSpace(summary)
	if err != nil {
		reason := strings.TrimSpace(err.Error())
		if reason != "" && !strings.Contains(strings.ToLower(detailedSummary), strings.ToLower(reason)) {
			detailedSummary = fmt.Sprintf("%s: %s", detailedSummary, reason)
		}
	}
	preview = strings.TrimSpace(preview)
	if preview == "" {
		preview = detailedSummary
	}
	result, _, marshalErr := marshalResult(agent.TypedControlResult{
		Operation: operation,
		Status:    "failed",
		Summary:   detailedSummary,
		Preview:   preview,
	})
	if marshalErr != nil {
		return "", exitCode, marshalErr
	}
	return result, exitCode, err
}

func (e *ControlExecutor) authorize(payload agent.ControlOperationPayload) error {
	if payload.RequiredCapability != "" && payload.RequiredCapability != "control-operation" {
		definition, ok := agent.LookupControlOperation(payload.Operation)
		if !ok {
			return fmt.Errorf("unsupported control operation %q", payload.Operation)
		}
		if definition.RequiredCapability() != payload.RequiredCapability {
			return fmt.Errorf("required capability mismatch for %s", payload.Operation)
		}
	}

	payloadTenant := strings.ToLower(strings.TrimSpace(payload.TenantID))
	if e.tenantID != "" && payloadTenant != "" && payloadTenant != e.tenantID {
		return fmt.Errorf("tenant mismatch: payload=%q agent=%q", payload.TenantID, e.tenantID)
	}
	if payloadTenant != "" {
		if _, denied := e.tenantDenylist[payloadTenant]; denied {
			return fmt.Errorf("tenant %q denied by agent policy", payload.TenantID)
		}
		if len(e.tenantAllowlist) > 0 {
			if _, allowed := e.tenantAllowlist[payloadTenant]; !allowed {
				return fmt.Errorf("tenant %q not in agent allowlist", payload.TenantID)
			}
		}
	}

	groupMatched := len(e.groupAllowlist) == 0
	for _, group := range payload.ServerGroups {
		groupKey := strings.ToLower(strings.TrimSpace(group))
		if groupKey == "" {
			continue
		}
		if _, denied := e.groupDenylist[groupKey]; denied {
			return fmt.Errorf("server group %q denied by agent policy", group)
		}
		if _, allowed := e.groupAllowlist[groupKey]; allowed {
			groupMatched = true
		}
		if roles, ok := e.groupRoleMatrix[groupKey]; ok {
			if allowedRoles, ok := roles[strings.ToLower(strings.TrimSpace(payload.Operation))]; ok && len(allowedRoles) > 0 {
				roleKey := strings.ToLower(strings.TrimSpace(payload.ActorRole))
				if _, allowed := allowedRoles[roleKey]; !allowed {
					return fmt.Errorf("role %q denied for %s in group %q by agent policy", payload.ActorRole, payload.Operation, group)
				}
			}
		}
	}
	if !groupMatched {
		return fmt.Errorf("server groups %v not in agent allowlist", payload.ServerGroups)
	}
	return nil
}

type packageManager interface {
	BuildCommand(ctx context.Context, action, packageName string) (*exec.Cmd, error)
	BuildListCommand(ctx context.Context) (*exec.Cmd, error)
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

func (aptManager) BuildListCommand(ctx context.Context) (*exec.Cmd, error) {
	return exec.CommandContext(ctx, "sh", "-c", "dpkg-query -W -f='${Package}\\t${Version}\\t${Architecture}\\n'"), nil
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

func (dnfManager) BuildListCommand(ctx context.Context) (*exec.Cmd, error) {
	return exec.CommandContext(ctx, "sh", "-c", "rpm -qa --queryformat '%{NAME}\\t%{VERSION}-%{RELEASE}\\t%{ARCH}\\n'"), nil
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

func (yumManager) BuildListCommand(ctx context.Context) (*exec.Cmd, error) {
	return exec.CommandContext(ctx, "sh", "-c", "rpm -qa --queryformat '%{NAME}\\t%{VERSION}-%{RELEASE}\\t%{ARCH}\\n'"), nil
}

func init() {
	signal.Ignore(syscall.SIGPIPE)
}
