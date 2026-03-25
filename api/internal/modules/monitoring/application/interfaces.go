//go:build legacy
// +build legacy

package usecase

import (
	"context"

	"github.com/gorilla/websocket"
)

// EventUsecase handles Docker event monitoring
type EventUsecase interface {
	MonitorEvents(ctx context.Context)
	Subscribe(conn *websocket.Conn)
	Unsubscribe(conn *websocket.Conn)
}
