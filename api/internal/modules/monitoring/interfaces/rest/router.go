//go:build legacy
// +build legacy

package handler

import (
	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/monitoring/application"
)

// MonitoringHandlers groups all Monitoring-related handlers
type MonitoringHandlers struct {
	Log       *LogHandler
	Event     *EventHandler
	Health    *HealthHandler
	Ping      *PingHandler
	WebSocket *WebSocketHandler
}

// NewMonitoringHandlers creates a new Monitoring handlers instance
func NewMonitoringHandlers(
	logUC usecase.LogUsecase,
	eventUC usecase.EventUsecase,
	healthUC usecase.HealthUsecase,
) *MonitoringHandlers {
	return &MonitoringHandlers{
		Log:       NewLogHandler(logUC),
		Event:     NewEventHandler(eventUC),
		Health:    NewHealthHandler(healthUC),
		Ping:      NewPingHandler(),
		WebSocket: NewWebSocketHandler(logUC),
	}
}

// RegisterMonitoringRoutes registers all Monitoring-related routes
func RegisterMonitoringRoutes(r *gin.RouterGroup, h *MonitoringHandlers) {
	// Logs
	logs := r.Group("/logs")
	{
		logs.GET("", h.Log.GetLogs)
		logs.GET("/stream", h.Log.StreamLogs)
		logs.GET("/:log_id", h.Log.GetLog)
		logs.DELETE("/:log_id", h.Log.DeleteLog)
		logs.POST("/clear", h.Log.ClearLogs)
	}

	// Events
	events := r.Group("/events")
	{
		events.GET("", h.Event.ListEvents)
		events.GET("/:event_id", h.Event.GetEvent)
		events.POST("", h.Event.CreateEvent)
		events.DELETE("/:event_id", h.Event.DeleteEvent)
	}

	// Health & Status
	r.GET("/health", h.Health.HealthCheck)
	r.GET("/ping", h.Ping.Ping)
	r.GET("/status", h.Health.GetSystemStatus)

	// WebSocket for real-time logs
	r.GET("/ws/logs", h.WebSocket.StreamLogs)
	r.GET("/ws/events", h.WebSocket.StreamEvents)
}
