//go:build legacy
// +build legacy


package messaging

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/segmentio/kafka-go"
	"einfra/api/internal/shared/platform/logger"
)

const (
	// RetryCountHeader is the header key for the retry count.
	RetryCountHeader = "x-retry-count"
)

// KafkaAdapter is a Kafka implementation of the Publisher and Subscriber interfaces.
type KafkaAdapter struct {
	writer *kafka.Writer
	reader *kafka.Reader
	log    logger.Logger
	cfg    KafkaConfig
}

// NewKafkaAdapter creates a new KafkaAdapter.
func NewKafkaAdapter(cfg KafkaConfig, log logger.Logger) *KafkaAdapter {
	return &KafkaAdapter{
		cfg: cfg,
		log: log,
	}
}

// --- Publisher Implementation ---

// Publish sends a message to a Kafka topic.
func (a *KafkaAdapter) Publish(ctx context.Context, msg Message) error {
	if a.writer == nil {
		a.writer = &kafka.Writer{
			Addr:     kafka.TCP(a.cfg.Brokers...),
			Topic:    msg.Topic,
			Balancer: &kafka.LeastBytes{},
		}
	}

	kafkaMsg := kafka.Message{
		Key:   []byte(msg.ID),
		Value: msg.Payload,
		Headers: []kafka.Header{},
	}

	for k, v := range msg.Headers {
		kafkaMsg.Headers = append(kafkaMsg.Headers, kafka.Header{Key: k, Value: []byte(v)})
	}

	err := a.writer.WriteMessages(ctx, kafkaMsg)
	if err != nil {
		return fmt.Errorf("failed to write kafka message: %w", err)
	}

	a.log.Info(ctx, "Message published to Kafka", logger.LogField{Key: "topic", Value: msg.Topic}, logger.LogField{Key: "message_id", Value: msg.ID})
	return nil
}

// Close closes the Kafka writer connection.
func (a *KafkaAdapter) Close() {
	if a.writer != nil {
		if err := a.writer.Close(); err != nil {
			a.log.Error(context.Background(), "Failed to close Kafka writer", logger.LogField{Key: "error", Value: err})
		}
	}
	if a.reader != nil {
		if err := a.reader.Close(); err != nil {
			a.log.Error(context.Background(), "Failed to close Kafka reader", logger.LogField{Key: "error", Value: err})
		}
	}
}

// --- Subscriber Implementation ---

// Subscribe listens for messages on a Kafka topic and processes them.
func (a *KafkaAdapter) Subscribe(ctx context.Context, topic string, handler MessageHandler) error {
	if a.reader == nil {
		a.reader = kafka.NewReader(kafka.ReaderConfig{
			Brokers:  a.cfg.Brokers,
			GroupID:  a.cfg.GroupID,
			Topic:    topic,
			MinBytes: 10e3, // 10KB
			MaxBytes: 10e6, // 10MB
		})
	}

	// Wrap the handler with our retry and DLQ logic
	retryHandler := a.withRetry(handler)

	a.log.Info(ctx, "Subscribing to Kafka topic", logger.LogField{Key: "topic", Value: topic}, logger.LogField{Key: "group_id", Value: a.cfg.GroupID})

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			kmsg, err := a.reader.FetchMessage(ctx)
			if err != nil {
				if errors.Is(err, context.Canceled) {
					return nil
				}
				a.log.Error(ctx, "Failed to fetch message from Kafka", logger.LogField{Key: "error", Value: err})
				continue // Or break, depending on desired behavior
			}

			msg := a.toInternalMessage(kmsg)

			if err := retryHandler(ctx, msg); err != nil {
				a.log.Error(ctx, "Message processing failed after all retries", logger.LogField{Key: "error", Value: err}, logger.LogField{Key: "message_id", Value: msg.ID})
			}

			if err := a.reader.CommitMessages(ctx, kmsg); err != nil {
				a.log.Error(ctx, "Failed to commit message", logger.LogField{Key: "error", Value: err}, logger.LogField{Key: "message_id", Value: msg.ID})
			}
		}
	}
}

// withRetry is a subscriber middleware that adds retry and DLQ functionality.
func (a *KafkaAdapter) withRetry(handler MessageHandler) MessageHandler {
	return func(ctx context.Context, msg Message) error {
		var attempts int
		if retryCountStr, ok := msg.Headers[RetryCountHeader]; ok {
			attempts, _ = strconv.Atoi(retryCountStr)
		}

		err := handler(ctx, msg)
		if err == nil {
			return nil // Success
		}

		a.log.Warn(ctx, "Message handler failed, attempting retry",
			logger.LogField{Key: "error", Value: err},
			logger.LogField{Key: "message_id", Value: msg.ID},
			logger.LogField{Key: "attempt", Value: attempts + 1},
			logger.LogField{Key: "max_retries", Value: a.cfg.MaxRetries},
		)

		if attempts < a.cfg.MaxRetries {
			// Increment retry count and republish for retry
			msg.Headers[RetryCountHeader] = strconv.Itoa(attempts + 1)
			
			// Optional: Add a backoff before retrying
			time.Sleep(a.cfg.RetryBackoff)

			return a.Publish(ctx, msg) // Republish to the original topic
		} else {
			// Max retries exceeded, send to Dead-Letter Queue
			a.log.Error(ctx, "Max retries exceeded, sending to DLQ",
				logger.LogField{Key: "error", Value: err},
				logger.LogField{Key: "message_id", Value: msg.ID},
				logger.LogField{Key: "dlq_topic", Value: a.cfg.DLQTopic},
			)
			dlqMsg := Message{
				ID:      msg.ID,
				Topic:   a.cfg.DLQTopic,
				Payload: msg.Payload,
				Headers: msg.Headers, // Preserve original headers
			}
			if dlqErr := a.Publish(ctx, dlqMsg); dlqErr != nil {
				a.log.Error(ctx, "Failed to publish message to DLQ",
					logger.LogField{Key: "error", Value: dlqErr},
					logger.LogField{Key: "original_message_id", Value: msg.ID},
				)
				return dlqErr // Return the DLQ publish error
			}
		}

		return nil // The original message is considered handled (either retried or sent to DLQ)
	}
}

// toInternalMessage converts a kafka.Message to our internal Message type.
func (a *KafkaAdapter) toInternalMessage(kmsg kafka.Message) Message {
	msg := Message{
		ID:      string(kmsg.Key),
		Topic:   kmsg.Topic,
		Payload: kmsg.Value,
		Headers: make(map[string]string),
	}
	for _, h := range kmsg.Headers {
		msg.Headers[h.Key] = string(h.Value)
	}
	return msg
}
