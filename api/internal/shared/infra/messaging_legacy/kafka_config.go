
package messaging

import "time"

// KafkaConfig holds the configuration for the Kafka message broker.
type KafkaConfig struct {
	Brokers        []string      `mapstructure:"brokers"`
	GroupID        string        `mapstructure:"group_id"`
	DefaultTopic   string        `mapstructure:"default_topic"`
	DLQTopic       string        `mapstructure:"dlq_topic"`
	MaxRetries     int           `mapstructure:"max_retries"`
	RetryBackoff   time.Duration `mapstructure:"retry_backoff"`
}
