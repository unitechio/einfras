package config

import (
	"fmt"
	"os"
	"strings"
)

// Load loads the application configuration from environment variables.
// It prefers an explicit EINFRA_ENV_FILE, then falls back to .env and .env.dev.
func Load() *Config {
	cfg, err := loadWithFallback()
	if err != nil {
		panic("failed to load config: " + err.Error())
	}
	return cfg
}

// MustLoad loads config and panics with a clear message on failure.
func MustLoad() *Config {
	return Load()
}

func loadWithFallback() (*Config, error) {
	candidates := configCandidates()
	var lastErr error
	for _, path := range candidates {
		cfg, err := LoadConfig(path)
		if err == nil {
			return cfg, nil
		}
		lastErr = err
	}
	return nil, fmt.Errorf("%w (checked %s)", lastErr, strings.Join(candidates, ", "))
}

func configCandidates() []string {
	seen := map[string]struct{}{}
	candidates := make([]string, 0, 3)
	add := func(path string) {
		path = strings.TrimSpace(path)
		if path == "" {
			return
		}
		if _, ok := seen[path]; ok {
			return
		}
		seen[path] = struct{}{}
		candidates = append(candidates, path)
	}

	add(os.Getenv("EINFRA_ENV_FILE"))
	add(".env")
	add(".env.dev")
	return candidates
}
