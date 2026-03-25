//go:build !windows

package collector

import (
	"fmt"
	"io"
	"os/exec"
	"strings"

	"github.com/creack/pty"
)

type nopKubernetesWriteCloser struct {
	io.Writer
}

func (n nopKubernetesWriteCloser) Close() error { return nil }

func startKubernetesExecPTYSession(environmentID, namespace, podName, containerName string, shellCommand []string) (*KubernetesExecSession, error) {
	contextName, kubeconfigPath, err := kubernetesExecConfig(environmentID)
	if err != nil {
		return nil, err
	}
	cmdArgs := make([]string, 0, len(shellCommand)+12)
	if strings.TrimSpace(kubeconfigPath) != "" {
		cmdArgs = append(cmdArgs, "--kubeconfig", kubeconfigPath)
	}
	if strings.TrimSpace(contextName) != "" {
		cmdArgs = append(cmdArgs, "--context", contextName)
	}
	cmdArgs = append(cmdArgs, "exec", "-it", "-n", namespace, podName)
	if strings.TrimSpace(containerName) != "" {
		cmdArgs = append(cmdArgs, "-c", strings.TrimSpace(containerName))
	}
	cmdArgs = append(cmdArgs, "--")
	cmdArgs = append(cmdArgs, shellCommand...)
	cmd := exec.Command("kubectl", cmdArgs...)
	ttyFile, err := pty.Start(cmd)
	if err != nil {
		return nil, fmt.Errorf("kubectl %s failed: %w", strings.Join(cmdArgs, " "), err)
	}
	return &KubernetesExecSession{
		Stdin:  nopKubernetesWriteCloser{Writer: ttyFile},
		Stdout: ttyFile,
		Stderr: nil,
		Wait:   cmd.Wait,
		Close: func() error {
			return ttyFile.Close()
		},
		Resize: func(cols, rows uint16) error {
			return pty.Setsize(ttyFile, &pty.Winsize{Cols: cols, Rows: rows})
		},
		Command: cmd,
	}, nil
}

func startKubernetesExecPipeSession(environmentID, namespace, podName, containerName string, shellCommand []string) (*KubernetesExecSession, error) {
	contextName, kubeconfigPath, err := kubernetesExecConfig(environmentID)
	if err != nil {
		return nil, err
	}
	cmdArgs := make([]string, 0, len(shellCommand)+12)
	if strings.TrimSpace(kubeconfigPath) != "" {
		cmdArgs = append(cmdArgs, "--kubeconfig", kubeconfigPath)
	}
	if strings.TrimSpace(contextName) != "" {
		cmdArgs = append(cmdArgs, "--context", contextName)
	}
	cmdArgs = append(cmdArgs, "exec", "-i", "-n", namespace, podName)
	if strings.TrimSpace(containerName) != "" {
		cmdArgs = append(cmdArgs, "-c", strings.TrimSpace(containerName))
	}
	cmdArgs = append(cmdArgs, "--")
	cmdArgs = append(cmdArgs, shellCommand...)
	cmd := exec.Command("kubectl", cmdArgs...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		_ = stdin.Close()
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		_ = stdin.Close()
		_ = stdout.Close()
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		_ = stdin.Close()
		_ = stdout.Close()
		_ = stderr.Close()
		return nil, fmt.Errorf("kubectl %s failed: %w", strings.Join(cmdArgs, " "), err)
	}
	return &KubernetesExecSession{
		Stdin:  stdin,
		Stdout: stdout,
		Stderr: stderr,
		Wait:   cmd.Wait,
		Close: func() error {
			_ = stdin.Close()
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
			return nil
		},
		Resize:  func(cols, rows uint16) error { return nil },
		Command: cmd,
	}, nil
}
