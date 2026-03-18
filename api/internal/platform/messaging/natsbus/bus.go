package natsbus

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"
)

const (
	streamName     = "INFRA"
	streamSubjects = "infra.>"
	ackWait        = 30 * time.Second
	maxDeliver     = 5
)

type Bus struct {
	nc *nats.Conn
	js nats.JetStreamContext
}

func Connect(url string) (*Bus, error) {
	nc, err := nats.Connect(url,
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			log.Warn().Err(err).Msg("[nats] disconnected")
		}),
		nats.ReconnectHandler(func(_ *nats.Conn) {
			log.Info().Msg("[nats] reconnected")
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("nats connect %s: %w", url, err)
	}

	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("nats jetstream: %w", err)
	}

	if err := ensureStream(js); err != nil {
		nc.Close()
		return nil, err
	}

	log.Info().Str("url", url).Msg("[nats] connected")
	return &Bus{nc: nc, js: js}, nil
}

func ensureStream(js nats.JetStreamContext) error {
	_, err := js.StreamInfo(streamName)
	if err == nats.ErrStreamNotFound {
		_, err = js.AddStream(&nats.StreamConfig{
			Name:       streamName,
			Subjects:   []string{streamSubjects},
			Retention:  nats.LimitsPolicy,
			MaxAge:     7 * 24 * time.Hour,
			Storage:    nats.FileStorage,
			Replicas:   1,
			Duplicates: 5 * time.Minute,
		})
		if err != nil {
			return fmt.Errorf("nats create stream: %w", err)
		}
		log.Info().Str("stream", streamName).Msg("[nats] stream created")
		return nil
	}
	return err
}

func (b *Bus) Publish(subject string, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}
	_, err = b.js.Publish(subject, data)
	return err
}

func (b *Bus) PublishAsync(subject string, v any) {
	go func() {
		if err := b.Publish(subject, v); err != nil {
			log.Error().Err(err).Str("subject", subject).Msg("[nats] publish failed")
		}
	}()
}

type HandlerFunc func(ctx context.Context, data []byte) error

func (b *Bus) Subscribe(subject, consumer string, handler HandlerFunc) error {
	_, err := b.js.Subscribe(subject, func(msg *nats.Msg) {
		ctx, cancel := context.WithTimeout(context.Background(), ackWait)
		defer cancel()

		if err := handler(ctx, msg.Data); err != nil {
			log.Error().Err(err).Str("subject", subject).Msg("[nats] handler error — nack")
			_ = msg.Nak()
			return
		}
		_ = msg.Ack()
	},
		nats.Durable(consumer),
		nats.AckExplicit(),
		nats.MaxDeliver(maxDeliver),
		nats.AckWait(ackWait),
		nats.ManualAck(),
	)
	return err
}

func (b *Bus) Close() {
	b.nc.Drain()
}
