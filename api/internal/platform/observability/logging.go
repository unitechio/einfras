package observability

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	stdlog "log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"einfra/api/internal/platform/apierrors"
	"einfra/api/internal/platform/loggingx"
	"einfra/api/internal/shared/platform/config"
)

const requestIDHeader = "X-Request-ID"

var httpLogger = loggingx.New("http")

type closeGroup struct {
	closers []io.Closer
}

func (g *closeGroup) Add(closer io.Closer) {
	if closer != nil {
		g.closers = append(g.closers, closer)
	}
}

func (g *closeGroup) Close() error {
	var firstErr error
	for _, closer := range g.closers {
		if err := closer.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func Setup(cfg config.LoggingConfig, elkCfg config.ELKConfig) (io.Closer, error) {
	level, err := zerolog.ParseLevel(strings.ToLower(strings.TrimSpace(cfg.Level)))
	if err != nil {
		return nil, fmt.Errorf("parse LOG_LEVEL: %w", err)
	}
	zerolog.SetGlobalLevel(level)
	zerolog.TimeFieldFormat = time.RFC3339Nano

	closers := &closeGroup{}
	writers := make([]io.Writer, 0, 3)

	stdoutEnabled, fileEnabled := resolveOutputs(cfg)
	if stdoutEnabled {
		writers = append(writers, stdoutWriter(cfg))
	}
	if fileEnabled {
		fileWriter, err := newDailyRotateWriter(cfg.FilePath, cfg.MaxAgeDays)
		if err != nil {
			return nil, err
		}
		closers.Add(fileWriter)
		writers = append(writers, fileWriter)
	}
	if elkCfg.ElasticsearchEnabled && elkCfg.ElasticsearchEndpoint != "" {
		esWriter := newElasticsearchWriter(elkCfg)
		closers.Add(esWriter)
		writers = append(writers, esWriter)
	}
	if len(writers) == 0 {
		writers = append(writers, os.Stdout)
	}

	logger := zerolog.New(io.MultiWriter(writers...)).Level(level).With().Timestamp().Logger()
	log.Logger = logger

	stdLogger := logger.With().Str("logger", "stdlib").Logger()
	stdlog.SetFlags(0)
	stdlog.SetOutput(stdLogger)

	return closers, nil
}

func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := strings.TrimSpace(r.Header.Get(requestIDHeader))
		if requestID == "" {
			requestID = newRequestID()
		}
		w.Header().Set(requestIDHeader, requestID)
		ctx := context.WithValue(r.Context(), requestIDContextKey{}, requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Error().
					Str("request_id", RequestIDFromContext(r.Context())).
					Bytes("stack", debug.Stack()).
					Interface("panic", recovered).
					Str("component", "http").
					Str("event", "panic-recovered").
					Str("status", "error").
					Interface("details", map[string]any{
						"method": r.Method,
						"path":   r.URL.Path,
						"route":  currentRoute(r),
					}).
					Send()
				apierrors.Write(
					w,
					"",
					"",
					apierrors.Internal("internal server error"),
					http.StatusInternalServerError,
					"internal_error",
					"internal server error",
					nil,
				)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func HTTPLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recorder := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(recorder, r)

		latency := time.Since(start)
		remoteIP := clientIP(r)
		route := currentRoute(r)
		if route == "/v1/servers/{id}/agent-status" && strings.TrimSpace(recorder.Header().Get("X-Agent-Status-Changed")) != "true" {
			return
		}
		event := log.Info()
		statusLabel := "ok"
		if recorder.statusCode >= http.StatusInternalServerError {
			event = log.Error()
			statusLabel = "error"
		} else if recorder.statusCode >= http.StatusBadRequest {
			event = log.Warn()
			statusLabel = "warn"
		}
		httpLoggerInfo(event, r, route, statusLabel, remoteIP, recorder, latency)
	})
}

func httpLoggerInfo(event *zerolog.Event, r *http.Request, route, statusLabel, remoteIP string, recorder *statusRecorder, latency time.Duration) {
	details := map[string]any{
		"method":        r.Method,
		"path":          r.URL.Path,
		"route":         route,
		"url":           loggingx.NormalizeURL(r.URL.String()),
		"query":         loggingx.QueryDetails(r.URL.Query()),
		"remote_ip":     remoteIP,
		"user_id":       strings.TrimSpace(r.Header.Get("X-User-ID")),
		"user_role":     strings.TrimSpace(r.Header.Get("X-User-Role")),
		"request_id":    RequestIDFromContext(r.Context()),
		"status_code":   recorder.statusCode,
		"bytes_written": recorder.bytesWritten,
		"duration_ms":   latency.Milliseconds(),
	}
	httpLoggerInfoWithEvent(event, "", statusLabel, details)
}

func httpLoggerInfoWithEvent(event *zerolog.Event, serverID, statusLabel string, details map[string]any) {
	if event == nil {
		return
	}
	evt := event.Str("component", "http").Str("event", "request-completed").Str("status", statusLabel)
	if serverID != "" {
		evt = evt.Str("server_id", serverID)
	}
	evt.Interface("details", details).Send()
}

type requestIDContextKey struct{}

func RequestIDFromContext(ctx context.Context) string {
	value, _ := ctx.Value(requestIDContextKey{}).(string)
	return value
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int
}

func (r *statusRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func (r *statusRecorder) Write(payload []byte) (int, error) {
	n, err := r.ResponseWriter.Write(payload)
	r.bytesWritten += n
	return n, err
}

type dailyRotateWriter struct {
	mu         sync.Mutex
	dir        string
	baseName   string
	ext        string
	maxAgeDays int
	currentDay string
	file       *os.File
}

func newDailyRotateWriter(path string, maxAgeDays int) (*dailyRotateWriter, error) {
	dir := filepath.Dir(path)
	if dir == "." || dir == "" {
		dir = "logs"
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create log dir: %w", err)
	}
	base := filepath.Base(path)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	if name == "" {
		name = "app"
	}
	return &dailyRotateWriter{
		dir:        dir,
		baseName:   name,
		ext:        ext,
		maxAgeDays: maxAgeDays,
	}, nil
}

func (w *dailyRotateWriter) Write(payload []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if err := w.rotateIfNeeded(time.Now()); err != nil {
		return 0, err
	}
	return w.file.Write(payload)
}

func (w *dailyRotateWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return nil
	}
	err := w.file.Close()
	w.file = nil
	return err
}

func (w *dailyRotateWriter) rotateIfNeeded(now time.Time) error {
	day := now.Format("2006-01-02")
	if w.file != nil && w.currentDay == day {
		return nil
	}
	if w.file != nil {
		_ = w.file.Close()
		w.file = nil
	}
	filename := filepath.Join(w.dir, fmt.Sprintf("%s-%s%s", w.baseName, day, defaultLogExt(w.ext)))
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open log file: %w", err)
	}
	w.file = file
	w.currentDay = day
	w.cleanup(now)
	return nil
}

func (w *dailyRotateWriter) cleanup(now time.Time) {
	if w.maxAgeDays <= 0 {
		return
	}
	pattern := filepath.Join(w.dir, fmt.Sprintf("%s-*%s", w.baseName, defaultLogExt(w.ext)))
	files, err := filepath.Glob(pattern)
	if err != nil {
		return
	}
	cutoff := now.AddDate(0, 0, -w.maxAgeDays)
	for _, name := range files {
		info, err := os.Stat(name)
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			_ = os.Remove(name)
		}
	}
}

type elasticsearchWriter struct {
	client      *http.Client
	endpoint    string
	apiKey      string
	indexPrefix string
	ch          chan []byte
	wg          sync.WaitGroup
}

func newElasticsearchWriter(cfg config.ELKConfig) *elasticsearchWriter {
	w := &elasticsearchWriter{
		client:      &http.Client{Timeout: 5 * time.Second},
		endpoint:    strings.TrimRight(cfg.ElasticsearchEndpoint, "/"),
		apiKey:      cfg.ElasticsearchAPIKey,
		indexPrefix: strings.TrimSpace(cfg.ElasticsearchIndexPrefix),
		ch:          make(chan []byte, 1024),
	}
	if w.indexPrefix == "" {
		w.indexPrefix = "einfra-api"
	}
	w.wg.Add(1)
	go w.loop()
	return w
}

func (w *elasticsearchWriter) Write(payload []byte) (int, error) {
	line := bytes.TrimSpace(payload)
	if len(line) == 0 {
		return len(payload), nil
	}
	copyLine := append([]byte(nil), line...)
	select {
	case w.ch <- copyLine:
	default:
	}
	return len(payload), nil
}

func (w *elasticsearchWriter) Close() error {
	close(w.ch)
	w.wg.Wait()
	return nil
}

func (w *elasticsearchWriter) loop() {
	defer w.wg.Done()
	for line := range w.ch {
		w.send(line)
	}
}

func (w *elasticsearchWriter) send(line []byte) {
	index := fmt.Sprintf("%s-%s", w.indexPrefix, time.Now().Format("2006.01.02"))
	req, err := http.NewRequest(http.MethodPost, w.endpoint+"/"+index+"/_doc", bytes.NewReader(line))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if w.apiKey != "" {
		req.Header.Set("Authorization", "ApiKey "+w.apiKey)
	}
	resp, err := w.client.Do(req)
	if err != nil {
		return
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
}

func resolveOutputs(cfg config.LoggingConfig) (bool, bool) {
	switch strings.ToLower(strings.TrimSpace(cfg.Output)) {
	case "file":
		return false, true
	case "both":
		return true, true
	case "stdout", "":
		return true, true
	default:
		return true, true
	}
}

func stdoutWriter(cfg config.LoggingConfig) io.Writer {
	if strings.EqualFold(cfg.Format, "text") {
		return zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
			FormatLevel: func(i any) string {
				level := strings.ToUpper(fmt.Sprint(i))
				switch level {
				case "INFO":
					return "\x1b[32m[INF]\x1b[0m"
				case "WARN":
					return "\x1b[33m[WRN]\x1b[0m"
				case "ERROR", "FATAL", "PANIC":
					return "\x1b[31m[ERR]\x1b[0m"
				default:
					return "[" + level + "]"
				}
			},
		}
	}
	return os.Stdout
}

func defaultLogExt(ext string) string {
	if ext == "" {
		return ".log"
	}
	return ext
}

func newRequestID() string {
	var random [12]byte
	if _, err := rand.Read(random[:]); err == nil {
		return hex.EncodeToString(random[:])
	}
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func currentRoute(r *http.Request) string {
	route := mux.CurrentRoute(r)
	if route == nil {
		return ""
	}
	template, err := route.GetPathTemplate()
	if err != nil {
		return ""
	}
	return template
}

func clientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
