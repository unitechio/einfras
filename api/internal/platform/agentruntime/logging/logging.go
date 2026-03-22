package logging

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"einfra/api/internal/platform/agentruntime/config"
)

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

func Setup(cfg *config.Config) (io.Closer, error) {
	level, err := zerolog.ParseLevel(strings.ToLower(strings.TrimSpace(cfg.LogLevel)))
	if err != nil {
		return nil, fmt.Errorf("parse AGENT_LOG_LEVEL: %w", err)
	}
	zerolog.SetGlobalLevel(level)
	zerolog.TimeFieldFormat = time.RFC3339Nano

	closers := &closeGroup{}
	writers := make([]io.Writer, 0, 2)

	if strings.TrimSpace(cfg.LogFilePath) != "" {
		if err := config.EnsureLogDir(cfg.LogFilePath); err != nil {
			return nil, fmt.Errorf("create agent log dir: %w", err)
		}
		file, err := os.OpenFile(cfg.LogFilePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return nil, fmt.Errorf("open agent log file: %w", err)
		}
		closers.Add(file)
		writers = append(writers, file)
	}

	if strings.EqualFold(cfg.LogFormat, "text") {
		writers = append(writers, zerolog.ConsoleWriter{
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
		})
	} else {
		writers = append(writers, os.Stdout)
	}

	logger := zerolog.New(io.MultiWriter(writers...)).With().Timestamp().Logger()
	log.Logger = logger.Level(level)
	return closers, nil
}
