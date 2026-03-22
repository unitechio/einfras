package distribution

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"einfra/api/internal/platform/agentruntime/artifacts"
)

type Artifact struct {
	Target  artifacts.Target
	Path    string
	SHA256  string
	Size    int64
	ModTime time.Time
}

type Distributor struct {
	rootDir  string
	cacheDir string
	mu       sync.Mutex
}

func New(rootDir string) *Distributor {
	rootDir = strings.TrimSpace(rootDir)
	if rootDir == "" {
		rootDir = mustResolveProjectRoot()
	}
	return &Distributor{
		rootDir:  rootDir,
		cacheDir: filepath.Join(rootDir, "bin", "artifacts"),
	}
}

func (d *Distributor) Warmup(targets []artifacts.Target) error {
	if len(targets) == 0 {
		targets = []artifacts.Target{
			artifacts.NormalizeTarget("linux", "amd64"),
			artifacts.NormalizeTarget("linux", "arm64"),
		}
	}
	for _, target := range targets {
		if _, err := d.ResolveBinary(target.OS, target.Arch); err != nil {
			return err
		}
	}
	return nil
}

func (d *Distributor) ResolveBinary(goos, goarch string) (string, error) {
	artifact, err := d.ResolveArtifact(goos, goarch)
	if err != nil {
		return "", err
	}
	return artifact.Path, nil
}

func (d *Distributor) ResolveArtifact(goos, goarch string) (*Artifact, error) {
	target := artifacts.NormalizeTarget(goos, goarch)
	if err := artifacts.ValidateTarget(target); err != nil {
		return nil, err
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	if err := os.MkdirAll(d.cacheDir, 0o755); err != nil {
		return nil, fmt.Errorf("create artifact cache dir: %w", err)
	}
	path := d.artifactPath(target)
	if info, err := os.Stat(path); err == nil && info.Size() > 0 {
		stale, staleErr := d.isArtifactStale(info.ModTime())
		if staleErr != nil {
			return nil, staleErr
		}
		if !stale {
			return d.artifactInfo(target, path, info)
		}
	}

	cmd := exec.Command("go", "build", "-o", path, "./api/cmd/agent")
	cmd.Dir = d.rootDir
	cmd.Env = append(os.Environ(),
		"GOOS="+target.OS,
		"GOARCH="+target.Arch,
		"CGO_ENABLED=0",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("build agent binary for %s/%s: %w (%s)", target.OS, target.Arch, err, strings.TrimSpace(string(output)))
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("stat built artifact %s: %w", path, err)
	}
	return d.artifactInfo(target, path, info)
}

func (d *Distributor) artifactInfo(target artifacts.Target, path string, info os.FileInfo) (*Artifact, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read artifact %s: %w", path, err)
	}
	return &Artifact{
		Target:  target,
		Path:    path,
		SHA256:  artifacts.SHA256Hex(raw),
		Size:    info.Size(),
		ModTime: info.ModTime().UTC(),
	}, nil
}

func (d *Distributor) artifactPath(target artifacts.Target) string {
	path := filepath.Join(d.cacheDir, fmt.Sprintf("einfra-agent-%s-%s", target.OS, target.Arch))
	if target.OS == "windows" {
		path += ".exe"
	}
	return path
}

func (d *Distributor) isArtifactStale(artifactModTime time.Time) (bool, error) {
	paths := []string{
		filepath.Join(d.rootDir, "go.mod"),
		filepath.Join(d.rootDir, "go.sum"),
		filepath.Join(d.rootDir, "api", "cmd", "agent"),
		filepath.Join(d.rootDir, "api", "internal", "platform", "agentruntime"),
		filepath.Join(d.rootDir, "api", "internal", "modules", "agent"),
	}
	for _, path := range paths {
		newer, err := hasNewerFile(path, artifactModTime)
		if err != nil {
			return false, err
		}
		if newer {
			return true, nil
		}
	}
	return false, nil
}

func hasNewerFile(path string, artifactModTime time.Time) (bool, error) {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("stat source path %s: %w", path, err)
	}
	if !info.IsDir() {
		return info.ModTime().After(artifactModTime), nil
	}
	newer := false
	err = filepath.Walk(path, func(current string, currentInfo os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if currentInfo == nil || currentInfo.IsDir() {
			return nil
		}
		if strings.HasSuffix(current, ".go") || filepath.Base(current) == "go.mod" || filepath.Base(current) == "go.sum" {
			if currentInfo.ModTime().After(artifactModTime) {
				newer = true
				return filepath.SkipAll
			}
		}
		return nil
	})
	if err != nil && err != filepath.SkipAll {
		return false, fmt.Errorf("walk source path %s: %w", path, err)
	}
	return newer, nil
}

func mustResolveProjectRoot() string {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		if wd, err := os.Getwd(); err == nil {
			return wd
		}
		return "."
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", "..", "..", ".."))
	return root
}
