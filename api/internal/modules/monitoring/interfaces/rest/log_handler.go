package handler

import (
	"github.com/gin-gonic/gin"
	"einfra/api/internal/usecase"
	"einfra/api/pkg/errorx"
)

// LogHandler handles log operations
type LogHandler struct {
	logUsecase usecase.LogUsecase
}

// NewLogHandler creates a new log handler
func NewLogHandler(logUsecase usecase.LogUsecase) *LogHandler {
	return &LogHandler{
		logUsecase: logUsecase,
	}
}

// StreamContainerLogs streams container logs via WebSocket
// @Summary Stream container logs
// @Description Stream real-time container logs via WebSocket
// @Tags logs
// @Accept json
// @Produce json
// @Param id path string true "Container ID"
// @Param tail query string false "Number of lines to tail" default:"100"
// @Success 101 {object} logstream.LogMessage "Switching to WebSocket"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/logs/containers/{id}/stream [get]
// @Security BearerAuth
func (h *LogHandler) StreamContainerLogs(c *gin.Context) {
	containerID := c.Param("id")
	tail := c.DefaultQuery("tail", "100")

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to upgrade to WebSocket"))
		return
	}
	defer conn.Close()

	// Get log stream
	ctx := c.Request.Context()
	logChan, errChan, err := h.logUsecase.StreamContainerLogs(ctx, containerID, tail)
	if err != nil {
		conn.WriteJSON(map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	// Stream logs to WebSocket
	for {
		select {
		case msg, ok := <-logChan:
			if !ok {
				return
			}
			if err := conn.WriteJSON(msg); err != nil {
				return
			}

		case err, ok := <-errChan:
			if !ok {
				return
			}
			conn.WriteJSON(map[string]interface{}{
				"error": err.Error(),
			})
			return

		case <-ctx.Done():
			return
		}
	}
}
