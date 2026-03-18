package messaging

import (
	"context"
)

// Message represents a message to be sent or received from the broker.
// It contains the payload and metadata, such as headers for retry counts.
type Message struct {
	ID      string
	Topic   string
	Payload []byte
	Headers map[string]string
}

// Publisher defines a generic interface for publishing messages to a message broker.
// This abstraction allows for different broker implementations (e.g., Kafka, NATS, RabbitMQ).
type Publisher interface {
	// Publish sends a message to the specified topic.
	Publish(ctx context.Context, msg Message) error
	// Close gracefully shuts down the publisher connection.
	Close()
}

// MessageHandler is a function type that processes a received message.
// If the handler returns an error, the message may be redelivered or sent to a DLQ.
type MessageHandler func(ctx context.Context, msg Message) error

// Subscriber defines a generic interface for subscribing to topics from a message broker.
type Subscriber interface {
	// Subscribe listens for messages on a given topic and processes them using the provided handler.
	// This is a blocking call, so it should typically be run in a separate goroutine.
	Subscribe(ctx context.Context, topic string, handler MessageHandler) error
	// Close gracefully shuts down the subscriber connection.
	Close()
}
