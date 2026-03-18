package usecase

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	_notify "einfra/api/internal/modules/notification/application"
	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/pkg/docker"
)

type alertUsecase struct {
	dockerClient        *docker.Client
	notificationUsecase _notify.NotificationUsecase
	rules               []domain.AlertRule
	mu                  sync.RWMutex
}

// NewAlertUsecase creates a new alert usecase
func NewAlertUsecase(dockerClient *docker.Client, notificationUsecase _notify.NotificationUsecase) AlertUsecase {
	return &alertUsecase{
		dockerClient:        dockerClient,
		notificationUsecase: notificationUsecase,
		rules:               domain.DefaultAlertRules(),
	}
}

// StartMonitoring starts the background monitoring job
func (u *alertUsecase) StartMonitoring(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		for {
			select {
			case <-ticker.C:
				u.CheckResources(ctx)
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

// CheckResources checks container resources against rules
func (u *alertUsecase) CheckResources(ctx context.Context) {
	containers, err := u.dockerClient.ContainerList(ctx, false)
	if err != nil {
		log.Printf("Error listing containers for alert check: %v", err)
		return
	}

	for _, container := range containers {
		stats, err := u.dockerClient.ContainerStatsOnce(ctx, container.ID)
		if err != nil {
			log.Printf("Error getting stats for container %s: %v", container.ID[:12], err)
			continue
		}

		u.evaluateRules(ctx, container.ID, container.Names[0], stats)
	}
}

func (u *alertUsecase) evaluateRules(ctx context.Context, containerID, containerName string, stats *docker.ContainerStats) {
	u.mu.RLock()
	defer u.mu.RUnlock()

	// Calculate CPU Usage
	// Docker stats calculation is complex. Simplified version:
	// cpu_delta = cpu_total_usage - precpu_total_usage
	// system_cpu_delta = system_cpu_usage - precpu_system_cpu_usage
	// number_cpus = len(percpu_usage) or online_cpus
	// cpu_usage = (cpu_delta / system_cpu_delta) * number_cpus * 100.0

	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage) - float64(stats.PrecpuStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemCPUUsage) - float64(stats.PrecpuStats.SystemCPUUsage)
	onlineCPUs := float64(stats.CPUStats.OnlineCPUs)
	if onlineCPUs == 0.0 {
		onlineCPUs = float64(len(stats.CPUStats.CPUUsage.PercpuUsage))
	}

	var cpuUsage float64
	if systemDelta > 0.0 && cpuDelta > 0.0 {
		cpuUsage = (cpuDelta / systemDelta) * onlineCPUs * 100.0
	}

	// Calculate Memory Usage
	// usage = memory_stats.usage - memory_stats.stats.cache (if available)
	// percent = (usage / limit) * 100
	memUsageBytes := float64(stats.MemoryStats.Usage)
	// Subtract cache if available (Docker CLI does this)
	if stats.MemoryStats.Stats.Cache > 0 {
		memUsageBytes -= float64(stats.MemoryStats.Stats.Cache)
	}

	memLimit := float64(stats.MemoryStats.Limit)
	var memUsagePercent float64
	if memLimit > 0 {
		memUsagePercent = (memUsageBytes / memLimit) * 100.0
	}

	for _, rule := range u.rules {
		if !rule.Enabled {
			continue
		}

		triggered := false
		var value float64

		switch rule.Metric {
		case "cpu":
			if cpuUsage > rule.Threshold {
				triggered = true
				value = cpuUsage
			}
		case "memory":
			if memUsagePercent > rule.Threshold {
				triggered = true
				value = memUsagePercent
			}
		}

		if triggered {
			u.triggerAlert(ctx, rule, containerID, containerName, value)
		}
	}
}

func (u *alertUsecase) triggerAlert(ctx context.Context, rule domain.AlertRule, containerID, containerName string, value float64) {
	message := fmt.Sprintf("ALERT: Container %s (%s) exceeded %s threshold. Current: %.2f%%, Threshold: %.2f%%",
		containerName, containerID[:12], rule.Metric, value, rule.Threshold)

	log.Println(message)

	// Send notification
	if u.notificationUsecase != nil {
		// u.notificationUsecase.Send(...)
	}
}
