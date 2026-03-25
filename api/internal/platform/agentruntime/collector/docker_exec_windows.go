//go:build windows

package collector

import "os/exec"

func startDockerExecPTYSession(containerID string, shellCommand []string) (*DockerExecSession, error) {
	return startDockerExecPipeSession(containerID, shellCommand)
}

func startDockerExecPipeSession(containerID string, shellCommand []string) (*DockerExecSession, error) {
	args := []string{"exec", "-i", containerID}
	args = append(args, shellCommand...)
	cmd := exec.Command("docker", args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &DockerExecSession{
		Stdin:  stdin,
		Stdout: stdout,
		Stderr: stderr,
		Wait:   cmd.Wait,
		Close: func() error {
			_ = stdin.Close()
			return nil
		},
		Resize:  func(cols, rows uint16) error { return nil },
		IsPTY:   false,
		Command: cmd,
	}, nil
}
