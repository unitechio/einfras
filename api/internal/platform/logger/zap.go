package logger

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

const (
	RequestIDKey = "request_id"
	UserIDKey    = "user_id"
	TraceIDKey   = "trace_id"
	MaxBodySize  = 50 * 1024 * 1024
)

type LogLevel string

const (
	DebugLevel LogLevel = "DEBUG"
	InfoLevel  LogLevel = "INFO"
	WarnLevel  LogLevel = "WARN"
	ErrorLevel LogLevel = "ERROR"
	FatalLevel LogLevel = "FATAL"
)

type LogField struct {
	Key   string
	Value interface{}
}

type Logger interface {
	Debug(ctx context.Context, msg string, fields ...LogField)
	Info(ctx context.Context, msg string, fields ...LogField)
	Warn(ctx context.Context, msg string, fields ...LogField)
	Error(ctx context.Context, msg string, fields ...LogField)
	Fatal(ctx context.Context, msg string, fields ...LogField)
	WithFields(fields ...LogField) Logger
	WithContext(ctx context.Context) Logger
}

type zapLogger struct {
	logger *zap.Logger
	fields []zap.Field
}

var fieldPool = sync.Pool{
	New: func() interface{} {
		return []zap.Field{}
	},
}

var SensitiveFields = []string{"password", "token", "credit_card", "api_key"}

func FilterSensitiveData(data map[string]interface{}) map[string]interface{} {
	filtered := make(map[string]interface{})
	for k, v := range data {
		if isSensitive(k) {
			filtered[k] = "[FILTERED]"
		} else {
			filtered[k] = v
		}
	}
	return filtered
}

func isSensitive(key string) bool {
	for _, field := range SensitiveFields {
		if field == key {
			return true
		}
	}
	return false
}

func ProcessLargeBody(body []byte, requestID string) (map[string]interface{}, error) {
	if len(body) == 0 {
		return map[string]interface{}{}, nil
	}

	if len(body) > MaxBodySize {
		return map[string]interface{}{
			"body_size_bytes": len(body),
			"truncated":       true,
			"error":           "body exceeds max size limit",
		}, nil
	}

	var bodyData map[string]interface{}
	if err := json.Unmarshal(body, &bodyData); err != nil {
		return map[string]interface{}{
			"body_size_bytes": len(body),
			"error":           "invalid_json",
		}, err
	}
	return FilterSensitiveData(bodyData), nil
}

type LoggerConfig struct {
	Level          LogLevel
	OutputPath     string
	DevMode        bool
	ServiceName    string
	ServiceVersion string
	Environment    string
	HostName       string
	HostIP         string
}

func NewZapLogger(config LoggerConfig) Logger {
	// Always use a production-like JSON encoder
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

	// Use console encoder for development if specified
	var encoder zapcore.Encoder
	if config.DevMode {
		encoder = zapcore.NewConsoleEncoder(encoderConfig)
	} else {
		encoder = zapcore.NewJSONEncoder(encoderConfig)
	}

	// Set up file and console output
	var writers []zapcore.WriteSyncer
	if config.OutputPath != "" {
		if err := os.MkdirAll(filepath.Dir(config.OutputPath), 0755); err != nil {
			panic(fmt.Sprintf("failed to create log directory: %v", err))
		}
		file, err := os.OpenFile(config.OutputPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			panic(fmt.Sprintf("failed to open log file: %v", err))
		}
		writers = append(writers, zapcore.AddSync(file))
	}
	writers = append(writers, zapcore.AddSync(os.Stdout))
	syncer := zapcore.NewMultiWriteSyncer(writers...)

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

	core := zapcore.NewCore(encoder, syncer, level)

	log := zap.New(core,
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

func (l *zapLogger) getContextFields(ctx context.Context) []zap.Field {
	fields := fieldPool.Get().([]zap.Field)[:0]

	if requestID, ok := ctx.Value(RequestIDKey).(string); ok && requestID != "" {
		fields = append(fields, zap.String("request.id", requestID))
	}
	if userID, ok := ctx.Value(UserIDKey).(string); ok && userID != "" {
		fields = append(fields, zap.String("user.id", userID))
	}
	if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
		fields = append(fields,
			zap.String("trace.id", span.SpanContext().TraceID().String()),
			zap.String("span.id", span.SpanContext().SpanID().String()),
		)
	}

	return fields
}

func (l *zapLogger) convertToZapFields(fields []LogField) []zap.Field {
	if len(fields) == 0 {
		return nil
	}

	zapFields := make([]zap.Field, len(fields))
	for i, f := range fields {
		zapFields[i] = zap.Any(f.Key, f.Value)
	}
	return zapFields
}

func (l *zapLogger) logMessage(ctx context.Context, level zapcore.Level, msg string, fields ...LogField) {
	contextFields := l.getContextFields(ctx)
	customFields := l.convertToZapFields(fields)
	allFields := append(l.fields, append(contextFields, customFields...)...)
	defer fieldPool.Put(contextFields)

	// Check if the logger is enabled for the given level before logging
	if ce := l.logger.Check(level, msg); ce != nil {
		ce.Write(allFields...)
	}
}

func (l *zapLogger) Debug(ctx context.Context, msg string, fields ...LogField) {
	l.logMessage(ctx, zapcore.DebugLevel, msg, fields...)
}

func (l *zapLogger) Info(ctx context.Context, msg string, fields ...LogField) {
	l.logMessage(ctx, zapcore.InfoLevel, msg, fields...)
}

func (l *zapLogger) Warn(ctx context.Context, msg string, fields ...LogField) {
	l.logMessage(ctx, zapcore.WarnLevel, msg, fields...)
}

func (l *zapLogger) Error(ctx context.Context, msg string, fields ...LogField) {
	l.logMessage(ctx, zapcore.ErrorLevel, msg, fields...)
}

func (l *zapLogger) Fatal(ctx context.Context, msg string, fields ...LogField) {
	l.logMessage(ctx, zapcore.FatalLevel, msg, fields...)
}

func (l *zapLogger) WithFields(fields ...LogField) Logger {
	zapFields := l.convertToZapFields(fields)
	newLogger := l.logger.With(zapFields...)
	return &zapLogger{
		logger: newLogger,
		fields: append(l.fields, zapFields...),
	}
}

func (l *zapLogger) WithContext(ctx context.Context) Logger {
	contextFields := l.getContextFields(ctx)
	newLogger := l.logger.With(contextFields...)
	return &zapLogger{
		logger: newLogger,
		fields: append(l.fields, contextFields...),
	}
}

func HTTPMiddleware(log Logger) gin.HandlerFunc {
	tracer := otel.Tracer("http-middleware")
	return func(c *gin.Context) {
		start := time.Now()
		requestID := c.GetString(RequestIDKey)
		if requestID == "" {
			requestID = fmt.Sprintf("req-%d", time.Now().UnixNano())
			c.Set(RequestIDKey, requestID)
		}

		ctx, span := tracer.Start(
			c.Request.Context(),
			c.Request.URL.Path,
			trace.WithAttributes(
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.url", c.Request.URL.String()),
				attribute.String("http.client_ip", c.ClientIP()),
			),
		)
		defer span.End()
		c.Request = c.Request.WithContext(ctx)
		ctx = context.WithValue(ctx, RequestIDKey, requestID)

		queryParams := make(map[string]interface{})
		for k, v := range c.Request.URL.Query() {
			queryParams[k] = v[0]
		}
		filteredQueryParams := FilterSensitiveData(queryParams)

		var bodyData map[string]interface{}
		if c.Request.Body != nil {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes)) // Restore body
			bodyData, _ = ProcessLargeBody(bodyBytes, requestID)
		}

		log.Info(ctx, "Request started",
			LogField{Key: "http.request.method", Value: c.Request.Method},
			LogField{Key: "http.request.path", Value: c.Request.URL.Path},
			LogField{Key: "http.request.query", Value: filteredQueryParams},
			LogField{Key: "http.request.body", Value: bodyData},
		)

		c.Next()

		status := c.Writer.Status()
		duration := time.Since(start)

		logFields := []LogField{
			{Key: "http.response.status_code", Value: status},
			{Key: "http.response.duration_ms", Value: duration.Milliseconds()},
		}

		if status >= 400 {
			errorMsg := c.Errors.ByType(gin.ErrorTypePrivate).String()
			if errorMsg == "" {
				errorMsg = "Request failed"
			}
			logFields = append(logFields, LogField{Key: "error.message", Value: errorMsg})
			log.Error(ctx, "Request failed", logFields...)
		} else {
			log.Info(ctx, "Request completed", logFields...)
		}
	}
}
