package executor

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	agent "einfra/api/internal/modules/agent/domain"
	"einfra/api/internal/platform/agentruntime/config"
)

func TestControlExecutorFileWriteReadAndChmod(t *testing.T) {
	dir := t.TempDir()
	exec := NewControlExecutor(testConfig(dir))
	path := filepath.Join(dir, "nested", "demo.txt")

	if _, code, err := exec.Execute(context.Background(), "file.write", map[string]any{
		"path":    path,
		"content": "hello\nworld\n",
	}); err != nil || code != 0 {
		t.Fatalf("file.write failed: code=%d err=%v", code, err)
	}

	out, code, err := exec.Execute(context.Background(), "file.read", map[string]any{
		"path":  path,
		"lines": 1,
	})
	if err != nil || code != 0 {
		t.Fatalf("file.read failed: code=%d err=%v", code, err)
	}
	var result agent.TypedControlResult
	if err := json.Unmarshal([]byte(out), &result); err != nil {
		t.Fatalf("unmarshal file.read result: %v", err)
	}
	if strings.TrimSpace(result.Preview) != "hello" {
		t.Fatalf("unexpected read preview: %#v", result)
	}

	if _, code, err := exec.Execute(context.Background(), "file.chmod", map[string]any{
		"path": path,
		"mode": "600",
	}); err != nil || code != 0 {
		t.Fatalf("file.chmod failed: code=%d err=%v", code, err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat failed: %v", err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("unexpected mode: %v", info.Mode().Perm())
	}
}

func TestControlExecutorFileList(t *testing.T) {
	dir := t.TempDir()
	exec := NewControlExecutor(testConfig(dir))
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("a"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}

	out, code, err := exec.Execute(context.Background(), "file.list", map[string]any{
		"path":  dir,
		"depth": 2,
	})
	if err != nil || code != 0 {
		t.Fatalf("file.list failed: code=%d err=%v", code, err)
	}
	var result agent.TypedControlResult
	if err := json.Unmarshal([]byte(out), &result); err != nil {
		t.Fatalf("unmarshal file.list result: %v", err)
	}
	raw, _ := json.Marshal(result.Data)
	if !strings.Contains(string(raw), "a.txt") || !strings.Contains(string(raw), `"directory"`) {
		t.Fatalf("unexpected list output: %s", string(raw))
	}
}

func TestControlExecutorCapabilities(t *testing.T) {
	exec := NewControlExecutor(testConfig(t.TempDir()))
	out, code, err := exec.Execute(context.Background(), "plugin.capabilities", nil)
	if err != nil || code != 0 {
		t.Fatalf("plugin.capabilities failed: code=%d err=%v", code, err)
	}
	var result agent.TypedControlResult
	if err := json.Unmarshal([]byte(out), &result); err != nil {
		t.Fatalf("unmarshal capabilities result: %v", err)
	}
	raw, _ := json.Marshal(result.Data)
	if !strings.Contains(string(raw), "control-operation") || !strings.Contains(string(raw), "file.read") {
		t.Fatalf("unexpected capabilities output: %q", string(raw))
	}
}

func TestControlExecutorRejectsPathOutsideAllowedRoots(t *testing.T) {
	dir := t.TempDir()
	exec := NewControlExecutor(testConfig(dir))
	_, code, err := exec.Execute(context.Background(), "file.read", map[string]any{
		"path": filepath.Join(string(os.PathSeparator), "windows", "system32", "drivers", "etc", "hosts"),
	})
	if err == nil || code == 0 {
		t.Fatalf("expected path boundary rejection")
	}
}

func testConfig(root string) *config.Config {
	return &config.Config{
		AllowedReadRoots:  []string{root},
		AllowedWriteRoots: []string{root},
		PluginRoot:        filepath.Join(root, "plugins"),
		MaxReadBytes:      1024 * 1024,
		StreamChunkBytes:  1024,
		MaxTailLines:      500,
	}
}
