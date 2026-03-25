//go:build legacy
// +build legacy

package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"einfra/api/pkg/logstream"
)

var logUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: Implement proper origin checking in production
		return true
	},
}

// LogWebSocketMessage represents a message sent over WebSocket for logs
type LogWebSocketMessage struct {
	Type string      `json:"type"` // "log", "error", "info", "close"
	Data interface{} `json:"data"`
	Time time.Time   `json:"time"`
}

// StreamLogsOverWebSocket handles WebSocket log streaming
func StreamLogsOverWebSocket(c *gin.Context, logReader func(ctx context.Context) (<-chan logstream.LogEntry, <-chan error)) {
	// Upgrade HTTP connection to WebSocket
	conn, err := logUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upgrade to WebSocket"})
		return
	}
	defer conn.Close()

	// Create context with cancellation
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Start log streaming
	logChan, errChan := logReader(ctx)

	// Send initial connection message
	sendLogMessage(conn, LogWebSocketMessage{
		Type: "info",
		Data: "Connected to log stream",
		Time: time.Now(),
	})

	// Handle incoming messages (for control commands)
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				cancel()
				return
			}
		}
	}()

	// Stream logs to client
	for {
		select {
		case <-ctx.Done():
			sendLogMessage(conn, LogWebSocketMessage{
				Type: "close",
				Data: "Stream closed",
				Time: time.Now(),
			})
			return

		case entry, ok := <-logChan:
			if !ok {
				sendLogMessage(conn, LogWebSocketMessage{
					Type: "close",
					Data: "Log stream ended",
					Time: time.Now(),
				})
				return
			}

			if err := sendLogMessage(conn, LogWebSocketMessage{
				Type: "log",
				Data: entry,
				Time: time.Now(),
			}); err != nil {
				return
			}

		case err, ok := <-errChan:
			if !ok {
				continue
			}

			sendLogMessage(conn, LogWebSocketMessage{
				Type: "error",
				Data: err.Error(),
				Time: time.Now(),
			})
			return
		}
	}
}

// sendLogMessage sends a message over WebSocket
func sendLogMessage(conn *websocket.Conn, msg LogWebSocketMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	return nil
}

// ParseLogOptions parses log options from query parameters
func ParseLogOptions(c *gin.Context) logstream.LogOptions {
	options := logstream.LogOptions{
		Follow:     c.DefaultQuery("follow", "false") == "true",
		Lines:      parseIntQuery(c, "lines", 100),
		Filter:     c.Query("filter"),
		SinceTime:  c.Query("since"),
		Timestamps: c.DefaultQuery("timestamps", "true") == "true",
	}

	// Parse from/to times
	if fromStr := c.Query("from"); fromStr != "" {
		if fromTime, err := time.Parse(time.RFC3339, fromStr); err == nil {
			options.FromTime = &fromTime
		}
	}

	if toStr := c.Query("to"); toStr != "" {
		if toTime, err := time.Parse(time.RFC3339, toStr); err == nil {
			options.ToTime = &toTime
		}
	}

	return options
}

// parseIntQuery parses an integer query parameter with a default value
func parseIntQuery(c *gin.Context, key string, defaultValue int) int {
	if val := c.Query(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultValue
}
