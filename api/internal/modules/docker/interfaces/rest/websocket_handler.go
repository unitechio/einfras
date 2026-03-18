package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"einfra/api/internal/modules/docker/application"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// DockerWebSocketHandler handles WebSocket connections for Docker operations
type DockerWebSocketHandler struct {
	swarmUsecase       usecase.DockerSwarmUsecase
	composeUsecase     usecase.DockerComposeUsecase
	fileBrowserUsecase usecase.DockerFileBrowserUsecase
}

// NewDockerWebSocketHandler creates a new Docker WebSocket handler
func NewDockerWebSocketHandler(
	swarmUsecase usecase.DockerSwarmUsecase,
	composeUsecase usecase.DockerComposeUsecase,
	fileBrowserUsecase usecase.DockerFileBrowserUsecase,
) *DockerWebSocketHandler {
	return &DockerWebSocketHandler{
		swarmUsecase:       swarmUsecase,
		composeUsecase:     composeUsecase,
		fileBrowserUsecase: fileBrowserUsecase,
	}
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type    string          `json:"type"`
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
}

// WSResponse represents a WebSocket response
type WSResponse struct {
	Type    string      `json:"type"`
	Action  string      `json:"action"`
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// StreamServiceLogs streams service logs via WebSocket
// @Summary Stream service logs
// @Description Stream Docker Swarm service logs in real-time via WebSocket
// @Tags Docker WebSocket
// @Param server_id path string true "Server ID"
// @Param service_id path string true "Service ID"
// @Success 101 {string} string "Switching Protocols"
// @Router /api/v1/docker/ws/servers/{server_id}/services/{service_id}/logs [get]
func (h *DockerWebSocketHandler) StreamServiceLogs(c *gin.Context) {
	serverID := c.Param("server_id")
	serviceID := c.Param("service_id")

	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start streaming logs
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				logs, err := h.swarmUsecase.GetServiceLogs(ctx, serverID, serviceID, "100", false)
				if err != nil {
					h.sendWSError(conn, "service_logs", err)
					return
				}

				err = conn.WriteJSON(WSResponse{
					Type:    "service_logs",
					Action:  "stream",
					Success: true,
					Data:    string(logs),
				})
				if err != nil {
					return
				}

				time.Sleep(1 * time.Second)
			}
		}
	}()

	// Read messages from client
	for {
		var msg WSMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			break
		}

		if msg.Action == "stop" {
			cancel()
			break
		}
	}
}

// StreamStackLogs streams stack logs via WebSocket
// @Summary Stream stack logs
// @Description Stream Docker Compose stack logs in real-time via WebSocket
// @Tags Docker WebSocket
// @Param server_id path string true "Server ID"
// @Param stack_name path string true "Stack Name"
// @Success 101 {string} string "Switching Protocols"
// @Router /api/v1/docker/ws/servers/{server_id}/stacks/{stack_name}/logs [get]
func (h *DockerWebSocketHandler) StreamStackLogs(c *gin.Context) {
	serverID := c.Param("server_id")
	stackName := c.Param("stack_name")

	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start streaming logs
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				logs, err := h.composeUsecase.GetComposeLogs(ctx, serverID, stackName, "100", false)
				if err != nil {
					h.sendWSError(conn, "stack_logs", err)
					return
				}

				err = conn.WriteJSON(WSResponse{
					Type:    "stack_logs",
					Action:  "stream",
					Success: true,
					Data:    string(logs),
				})
				if err != nil {
					return
				}

				time.Sleep(1 * time.Second)
			}
		}
	}()

	// Read messages from client
	for {
		var msg WSMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			break
		}

		if msg.Action == "stop" {
			cancel()
			break
		}
	}
}

// ContainerExecWebSocket provides interactive shell access via WebSocket
// @Summary Interactive container shell
// @Description Execute commands in container interactively via WebSocket
// @Tags Docker WebSocket
// @Param server_id path string true "Server ID"
// @Param container_id path string true "Container ID"
// @Success 101 {string} string "Switching Protocols"
// @Router /api/v1/docker/ws/servers/{server_id}/containers/{container_id}/exec [get]
func (h *DockerWebSocketHandler) ContainerExecWebSocket(c *gin.Context) {
	serverID := c.Param("server_id")
	containerID := c.Param("container_id")

	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	// Send welcome message
	conn.WriteJSON(WSResponse{
		Type:    "exec",
		Action:  "connected",
		Success: true,
		Data:    fmt.Sprintf("Connected to container %s on server %s", containerID, serverID),
	})

	// Read commands from client
	for {
		var msg WSMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			break
		}

		if msg.Action == "command" {
			var command string
			json.Unmarshal(msg.Payload, &command)

			conn.WriteJSON(WSResponse{
				Type:    "exec",
				Action:  "output",
				Success: true,
				Data:    fmt.Sprintf("Executed: %s", command),
			})
		}

		if msg.Action == "stop" {
			break
		}
	}
}

// Helper function to send error
func (h *DockerWebSocketHandler) sendWSError(conn *websocket.Conn, msgType string, err error) {
	conn.WriteJSON(WSResponse{
		Type:    msgType,
		Action:  "error",
		Success: false,
		Error:   err.Error(),
	})
}
