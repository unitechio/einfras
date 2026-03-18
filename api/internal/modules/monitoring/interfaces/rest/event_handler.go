package handler

import (
	"context"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/usecase"
	"einfra/api/pkg/errorx"
)

// EventHandler handles event operations
type EventHandler struct {
	eventUsecase usecase.EventUsecase
}

// NewEventHandler creates a new event handler
func NewEventHandler(eventUsecase usecase.EventUsecase) *EventHandler {
	// Start monitoring in background
	go eventUsecase.MonitorEvents(context.Background())
	return &EventHandler{
		eventUsecase: eventUsecase,
	}
}

// StreamEvents streams Docker events via WebSocket
// @Summary Stream Docker events
// @Description Stream real-time Docker events via WebSocket
// @Tags events
// @Accept json
// @Produce json
// @Success 101 {object} map[string]interface{} "Switching to WebSocket"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/events/stream [get]
// @Security BearerAuth
func (h *EventHandler) StreamEvents(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to upgrade to WebSocket"))
		return
	}

	h.eventUsecase.Subscribe(conn)

	// Keep connection open until client disconnects
	// The write loop is handled by the usecase
	// We just need a read loop to detect disconnect
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			h.eventUsecase.Unsubscribe(conn)
			break
		}
	}
}
