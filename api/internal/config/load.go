// Load is a convenience wrapper around LoadConfig that reads from the
// default .env path. This is used by cmd/server/main.go.
package config

// Load loads the application configuration from environment variables.
// It first tries to load from ".env" in the working directory.
func Load() *Config {
	cfg, err := LoadConfig(".env")
	if err != nil {
		// Return a zero-value struct with safe defaults when config
		// validation fails (e.g. during test runs or if env is partial).
		// main.go handles fatals separately.
		panic("failed to load config: " + err.Error())
	}
	return cfg
}

// MustLoad loads config and panics with a clear message on failure.
// Use in production main.go where config failure should halt startup.
func MustLoad() *Config {
	return Load()
}
