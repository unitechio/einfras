//go:build legacy
// +build legacy

package workers

import (
	"context"
	"encoding/json"

	"github.com/rs/zerolog/log"
	"github.com/prometheus/client_golang/prometheus"

	"einfra/api/internal/shared/events"
	"einfra/api/internal/shared/infra/messaging/natsbus"
)

type MetricsWorker struct {
	bus             *natsbus.Bus
	cpuGauge        *prometheus.GaugeVec
	memGauge        *prometheus.GaugeVec
	diskGauge       *prometheus.GaugeVec
	commandsCounter *prometheus.CounterVec
	commandDuration *prometheus.HistogramVec
}

func NewMetricsWorker(bus *natsbus.Bus, reg prometheus.Registerer) *MetricsWorker {
	w := &MetricsWorker{
		bus: bus,
		cpuGauge: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "einfra_agent_cpu_percent",
			Help: "Agent CPU usage percent.",
		}, []string{"server_id"}),
		memGauge: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "einfra_agent_mem_percent",
			Help: "Agent memory usage percent.",
		}, []string{"server_id"}),
		diskGauge: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "einfra_agent_disk_percent",
			Help: "Agent disk usage percent.",
		}, []string{"server_id"}),
		commandsCounter: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "einfra_commands_done_total",
			Help: "Total completed commands.",
		}, []string{"server_id", "status"}),
		commandDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "einfra_command_duration_seconds",
			Help:    "Command execution duration.",
			Buckets: []float64{0.5, 1, 5, 15, 30, 60, 120, 300},
		}, []string{"server_id"}),
	}
	reg.MustRegister(w.cpuGauge, w.memGauge, w.diskGauge, w.commandsCounter, w.commandDuration)
	return w
}

func (w *MetricsWorker) Start() error {
	if err := w.bus.Subscribe(events.SubjectAgentMetrics, "metrics-agent", w.handleMetrics); err != nil {
		return err
	}
	return w.bus.Subscribe(events.SubjectCommandDone, "metrics-command-done", w.handleCommandDone)
}

func (w *MetricsWorker) handleMetrics(ctx context.Context, data []byte) error {
	var e events.AgentMetricsEvent
	if err := json.Unmarshal(data, &e); err != nil {
		return err
	}
	w.cpuGauge.WithLabelValues(e.ServerID).Set(float64(e.CPUPercent))
	w.memGauge.WithLabelValues(e.ServerID).Set(float64(e.MemPercent))
	w.diskGauge.WithLabelValues(e.ServerID).Set(float64(e.DiskPercent))
	return nil
}

func (w *MetricsWorker) handleCommandDone(_ context.Context, data []byte) error {
	var e events.CommandDoneEvent
	if err := json.Unmarshal(data, &e); err != nil {
		return err
	}
	w.commandsCounter.WithLabelValues(e.ServerID, e.Status).Inc()
	w.commandDuration.WithLabelValues(e.ServerID).Observe(float64(e.DurationMs) / 1000.0)
	log.Debug().Str("server_id", e.ServerID).Str("status", e.Status).Msg("[metrics-worker] command done")
	return nil
}
