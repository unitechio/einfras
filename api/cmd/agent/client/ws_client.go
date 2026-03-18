// Package client manages the WebSocket connection from the agent to the control plane.
// It handles: connection, auto-reconnect with exponential backoff, message routing,
// command execution, and message sending.
package client

import (
	"bufio"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"os/exec"
	"time"

	"einfra-agent/config"

	"github.com/gorilla/websocket"
)

const maxBackoffSeconds = 60

// Client manages the WebSocket lifecycle and command execution.
type Client struct {
	cfg  *config.Config
	conn *websocket.Conn
	send chan any
}

// New creates a new agent Client.
func New(cfg *config.Config) *Client {
	return &Client{
		cfg:  cfg,
		send: make(chan any, 512),
	}
}

// Send enqueues a message to be sent to the control plane.
func (c *Client) Send(msg any) {
	select {
	case c.send <- msg:
	default:
		log.Printf("[agent] send buffer full — dropping message")
	}
}

// Connect runs a persistent connection loop with exponential backoff.
// This is intended to run in a goroutine.
func (c *Client) Connect() {
	attempt := 0
	for {
		attempt++
		if err := c.dial(); err != nil {
			backoff := time.Duration(math.Min(float64(attempt)*2, float64(maxBackoffSeconds))) * time.Second
			log.Printf("[agent] connect failed (attempt %d): %v — retry in %s", attempt, err, backoff)
			time.Sleep(backoff)
			continue
		}
		// Successful connection — reset backoff
		attempt = 0
		log.Println("[agent] successfully connected to control plane ✓")
		c.serve() // blocks until disconnected
		log.Println("[agent] disconnected from control plane — reconnecting in 3s...")
		time.Sleep(3 * time.Second)
	}
}

func (c *Client) dial() error {
	url := c.cfg.ControlPlaneURL + "/ws/agent/" + c.cfg.ServerID
	headers := http.Header{
		"Authorization": []string{"Bearer " + c.cfg.AgentToken},
	}
	conn, _, err := websocket.DefaultDialer.Dial(url, headers)
	if err != nil {
		return err
	}
	c.conn = conn
	return nil
}

func (c *Client) serve() {
	// Start write loop in background
	done := make(chan struct{})
	go func() {
		defer close(done)
		c.writeLoop()
	}()

	// Pong handler to reset read deadline
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	// Read loop — blocks until disconnect
	for {
		_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			_ = c.conn.Close()
			<-done
			return
		}

		var msg map[string]json.RawMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("[agent] bad message: %v", err)
			continue
		}

		msgType := string(msg["type"])
		switch msgType {
		case `"EXEC_COMMAND"`:
			go c.execCommand(msg["payload"])
		case `"PING"`:
			c.Send(map[string]any{"type": "PONG", "ts": time.Now().UnixMilli()})
		case `"CANCEL_COMMAND"`:
			// TODO: track running processes by command ID to support cancellation
			log.Printf("[agent] CANCEL_COMMAND received (not yet implemented)")
		default:
			log.Printf("[agent] unknown message type: %s", msgType)
		}
	}
}

func (c *Client) writeLoop() {
	for msg := range c.send {
		if err := c.conn.WriteJSON(msg); err != nil {
			log.Printf("[agent] write error: %v", err)
			return
		}
	}
}

// execCommand runs a shell command and streams output back to the control plane.
func (c *Client) execCommand(rawPayload json.RawMessage) {
	var payload struct {
		CommandID string `json:"command_id"`
		Cmd       string `json:"cmd"`
		TimeoutS  int    `json:"timeout_s"`
	}
	if rawPayload == nil {
		return
	}
	if err := json.Unmarshal(rawPayload, &payload); err != nil {
		log.Printf("[agent] bad EXEC_COMMAND payload: %v", err)
		return
	}

	log.Printf("[agent] executing command [%s]: %q", payload.CommandID, payload.Cmd)

	cmd := exec.Command("sh", "-c", payload.Cmd)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		c.sendCommandError(payload.CommandID, err.Error())
		return
	}
	stderr, _ := cmd.StderrPipe()

	start := time.Now()
	if err := cmd.Start(); err != nil {
		c.sendCommandError(payload.CommandID, err.Error())
		return
	}

	seq := 0
	sendChunk := func(line string) {
		c.Send(map[string]any{
			"type":       "COMMAND_OUTPUT",
			"message_id": payload.CommandID,
			"server_id":  c.cfg.ServerID,
			"ts":         time.Now().UnixMilli(),
			"payload": map[string]any{
				"command_id": payload.CommandID,
				"chunk":      line,
				"seq":        seq,
			},
		})
		seq++
	}

	// Stream stdout
	stdoutScanner := bufio.NewScanner(stdout)
	for stdoutScanner.Scan() {
		sendChunk(stdoutScanner.Text())
	}

	// Stream stderr with prefix
	stderrScanner := bufio.NewScanner(stderr)
	for stderrScanner.Scan() {
		sendChunk("[stderr] " + stderrScanner.Text())
	}

	err = cmd.Wait()
	durationMs := time.Since(start).Milliseconds()

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
	}

	if exitCode != 0 {
		c.Send(map[string]any{
			"type":       "COMMAND_ERROR",
			"message_id": payload.CommandID,
			"server_id":  c.cfg.ServerID,
			"ts":         time.Now().UnixMilli(),
			"payload": map[string]any{
				"command_id":  payload.CommandID,
				"exit_code":   exitCode,
				"error":       "command exited with code " + string(rune('0'+exitCode)),
				"duration_ms": durationMs,
			},
		})
	} else {
		c.Send(map[string]any{
			"type":       "COMMAND_DONE",
			"message_id": payload.CommandID,
			"server_id":  c.cfg.ServerID,
			"ts":         time.Now().UnixMilli(),
			"payload": map[string]any{
				"command_id":  payload.CommandID,
				"exit_code":   exitCode,
				"duration_ms": durationMs,
			},
		})
	}

	log.Printf("[agent] command [%s] done (exit=%d, %dms)", payload.CommandID, exitCode, durationMs)
}

func (c *Client) sendCommandError(commandID, errMsg string) {
	c.Send(map[string]any{
		"type":       "COMMAND_ERROR",
		"message_id": commandID,
		"server_id":  c.cfg.ServerID,
		"ts":         time.Now().UnixMilli(),
		"payload": map[string]any{
			"command_id": commandID,
			"error":      errMsg,
			"exit_code":  -1,
		},
	})
}
