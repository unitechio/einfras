package logger

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// ElasticsearchAdapter sends logs to Elasticsearch
type ElasticsearchAdapter struct {
	client      *http.Client
	endpoint    string
	indexPrefix string
	batchSize   int
	buffer      []map[string]interface{}
	logger      *zap.Logger
}

// ElasticsearchConfig holds configuration for Elasticsearch adapter
type ElasticsearchConfig struct {
	Endpoint    string
	IndexPrefix string
	BatchSize   int
	Username    string
	Password    string
}

// NewElasticsearchAdapter creates a new Elasticsearch adapter
func NewElasticsearchAdapter(config ElasticsearchConfig, logger *zap.Logger) *ElasticsearchAdapter {
	return &ElasticsearchAdapter{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		endpoint:    config.Endpoint,
		indexPrefix: config.IndexPrefix,
		batchSize:   config.BatchSize,
		buffer:      make([]map[string]interface{}, 0, config.BatchSize),
		logger:      logger,
	}
}

// Write implements zapcore.WriteSyncer
func (e *ElasticsearchAdapter) Write(p []byte) (n int, err error) {
	// Parse log entry
	var logEntry map[string]interface{}
	if err := json.Unmarshal(p, &logEntry); err != nil {
		return 0, fmt.Errorf("failed to parse log entry: %w", err)
	}

	// Add to buffer
	e.buffer = append(e.buffer, logEntry)

	// Flush if buffer is full
	if len(e.buffer) >= e.batchSize {
		if err := e.Flush(); err != nil {
			return 0, err
		}
	}

	return len(p), nil
}

// Sync implements zapcore.WriteSyncer
func (e *ElasticsearchAdapter) Sync() error {
	return e.Flush()
}

// Flush sends buffered logs to Elasticsearch
func (e *ElasticsearchAdapter) Flush() error {
	if len(e.buffer) == 0 {
		return nil
	}

	// Create index name with current date
	indexName := fmt.Sprintf("%s-%s", e.indexPrefix, time.Now().Format("2006.01.02"))

	// Build bulk request
	var bulkBody strings.Builder
	for _, entry := range e.buffer {
		// Index action
		action := map[string]interface{}{
			"index": map[string]interface{}{
				"_index": indexName,
			},
		}
		actionJSON, _ := json.Marshal(action)
		bulkBody.WriteString(string(actionJSON))
		bulkBody.WriteString("\n")

		// Document
		docJSON, _ := json.Marshal(entry)
		bulkBody.WriteString(string(docJSON))
		bulkBody.WriteString("\n")
	}

	// Send to Elasticsearch
	req, err := http.NewRequestWithContext(
		context.Background(),
		"POST",
		e.endpoint+"/_bulk",
		strings.NewReader(bulkBody.String()),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := e.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send logs to Elasticsearch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("Elasticsearch returned error status: %d", resp.StatusCode)
	}

	// Clear buffer
	e.buffer = e.buffer[:0]

	return nil
}

// NewZapLoggerWithElasticsearch creates a zap logger with Elasticsearch output
func NewZapLoggerWithElasticsearch(config LoggerConfig, esConfig ElasticsearchConfig) Logger {
	// Create base encoder config
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "@timestamp",
		LevelKey:       "log.level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "message",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.CapitalLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	// Create JSON encoder for Elasticsearch
	jsonEncoder := zapcore.NewJSONEncoder(encoderConfig)

	// Set log level
	var level zapcore.Level
	switch config.Level {
	case DebugLevel:
		level = zapcore.DebugLevel
	case InfoLevel:
		level = zapcore.InfoLevel
	case WarnLevel:
		level = zapcore.WarnLevel
	case ErrorLevel:
		level = zapcore.ErrorLevel
	default:
		level = zapcore.InfoLevel
	}

	// Create base logger for local logging
	baseLogger := NewZapLogger(config).(*zapLogger)

	// Create Elasticsearch adapter
	esAdapter := NewElasticsearchAdapter(esConfig, baseLogger.logger)

	// Create multi-writer core (file + console + Elasticsearch)
	var writers []zapcore.WriteSyncer
	writers = append(writers, zapcore.AddSync(esAdapter))

	multiCore := zapcore.NewTee(
		baseLogger.logger.Core(),
		zapcore.NewCore(jsonEncoder, zapcore.NewMultiWriteSyncer(writers...), level),
	)

	log := zap.New(multiCore,
		zap.AddCaller(),
		zap.AddCallerSkip(1),
		zap.AddStacktrace(zapcore.ErrorLevel),
		zap.Fields(
			zap.String("service.name", config.ServiceName),
			zap.String("service.version", config.ServiceVersion),
			zap.String("environment", config.Environment),
			zap.String("host.name", config.HostName),
			zap.String("host.ip", config.HostIP),
		),
	)

	return &zapLogger{logger: log, fields: []zap.Field{}}
}
