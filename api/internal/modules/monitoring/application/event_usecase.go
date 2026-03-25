//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"log"

	"github.com/docker/docker/api/types/events"
	"github.com/gorilla/websocket"
	"einfra/api/pkg/docker"
)

type eventUsecase struct {
	dockerClient *docker.Client
	clients      map[*websocket.Conn]bool
	broadcast    chan events.Message
	register     chan *websocket.Conn
	unregister   chan *websocket.Conn
}

// NewEventUsecase creates a new event usecase
func NewEventUsecase(dockerClient *docker.Client) EventUsecase {
	u := &eventUsecase{
		dockerClient: dockerClient,
		clients:      make(map[*websocket.Conn]bool),
		broadcast:    make(chan events.Message),
		register:     make(chan *websocket.Conn),
		unregister:   make(chan *websocket.Conn),
	}
	go u.run()
	return u
}

// MonitorEvents starts monitoring Docker events
func (u *eventUsecase) MonitorEvents(ctx context.Context) {
	msgs, errs := u.dockerClient.Events(ctx)

	for {
		select {
		case msg := <-msgs:
			u.broadcast <- msg
		case err := <-errs:
			if err != nil {
				log.Printf("Error reading docker events: %v", err)
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

func (u *eventUsecase) run() {
	for {
		select {
		case conn := <-u.register:
			u.clients[conn] = true
		case conn := <-u.unregister:
			if _, ok := u.clients[conn]; ok {
				delete(u.clients, conn)
				conn.Close()
			}
		case msg := <-u.broadcast:
			for conn := range u.clients {
				// Filter relevant events if needed
				// For now, broadcast everything
				err := conn.WriteJSON(msg)
				if err != nil {
					log.Printf("Error writing to websocket: %v", err)
					conn.Close()
					delete(u.clients, conn)
				}
			}
		}
	}
}

// Subscribe subscribes a client to event updates
func (u *eventUsecase) Subscribe(conn *websocket.Conn) {
	u.register <- conn
}

// Unsubscribe unsubscribes a client
func (u *eventUsecase) Unsubscribe(conn *websocket.Conn) {
	u.unregister <- conn
}
