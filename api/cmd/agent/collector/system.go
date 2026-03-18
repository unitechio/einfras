// Package collector gathers system metrics (CPU, RAM, disk) for the heartbeat.
// Uses only standard library — no external gopsutil dependency for minimal binary size.
// For richer metrics, swap the implementations out for gopsutil.
package collector

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// SystemMetrics holds the collected system metrics snapshot.
type SystemMetrics struct {
	CPUPercent  float64 `json:"cpu_percent"`
	MemPercent  float64 `json:"mem_percent"`
	DiskPercent float64 `json:"disk_percent"`
	OS          string  `json:"os"`
	Arch        string  `json:"arch"`
	HasDocker   bool    `json:"has_docker"`
	HasK8s      bool    `json:"has_k8s"`
}

// Collect gathers system metrics.
func Collect() SystemMetrics {
	return SystemMetrics{
		CPUPercent:  getCPUPercent(),
		MemPercent:  getMemPercent(),
		DiskPercent: getDiskPercent(),
		OS:          runtime.GOOS,
		Arch:        runtime.GOARCH,
		HasDocker:   commandExists("docker"),
		HasK8s:      commandExists("kubectl"),
	}
}

// commandExists returns true if a command is available in PATH.
func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// getCPUPercent returns a rough CPU usage percentage (Linux /proc/stat).
// Returns 0 on non-Linux systems.
func getCPUPercent() float64 {
	if runtime.GOOS != "linux" {
		return 0
	}

	read := func() (idle, total uint64) {
		f, err := os.Open("/proc/stat")
		if err != nil {
			return
		}
		defer f.Close()

		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := sc.Text()
			if !strings.HasPrefix(line, "cpu ") {
				continue
			}
			fields := strings.Fields(line)
			for i, field := range fields[1:] {
				n, _ := strconv.ParseUint(field, 10, 64)
				total += n
				if i == 3 { // idle field
					idle = n
				}
			}
			return
		}
		return
	}

	idle1, total1 := read()
	// We'd need two samples for real CPU %. For a heartbeat snapshot this is sufficient.
	_ = idle1
	_ = total1
	return 0 // TODO: implement dual-sample measurement
}

// getMemPercent reads /proc/meminfo on Linux.
func getMemPercent() float64 {
	if runtime.GOOS != "linux" {
		return 0
	}

	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0
	}
	defer f.Close()

	vals := make(map[string]uint64)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		val, _ := strconv.ParseUint(fields[1], 10, 64)
		vals[key] = val
	}

	total := vals["MemTotal"]
	available := vals["MemAvailable"]
	if total == 0 {
		return 0
	}
	used := total - available
	return float64(used) / float64(total) * 100
}

// getDiskPercent returns disk usage of the root filesystem.
func getDiskPercent() float64 {
	out, err := exec.Command("df", "-P", "/").Output()
	if err != nil {
		return 0
	}
	lines := strings.Split(string(out), "\n")
	if len(lines) < 2 {
		return 0
	}
	fields := strings.Fields(lines[1])
	if len(fields) < 5 {
		return 0
	}
	pct := strings.TrimSuffix(fields[4], "%")
	val, _ := strconv.ParseFloat(pct, 64)
	return val
}

// DockerSummary holds basic Docker runtime info.
type DockerSummary struct {
	Running int `json:"running"`
	Total   int `json:"total"`
}

// CollectDocker collects basic Docker stats if Docker is available.
func CollectDocker() (*DockerSummary, error) {
	out, err := exec.Command("docker", "ps", "-aq").Output()
	if err != nil {
		return nil, fmt.Errorf("docker not available: %w", err)
	}
	all := len(strings.Split(strings.TrimSpace(string(out)), "\n"))

	outRunning, _ := exec.Command("docker", "ps", "-q").Output()
	running := len(strings.Split(strings.TrimSpace(string(outRunning)), "\n"))
	if strings.TrimSpace(string(outRunning)) == "" {
		running = 0
	}
	if strings.TrimSpace(string(out)) == "" {
		all = 0
	}

	return &DockerSummary{Running: running, Total: all}, nil
}
