package config

// SessionConfig holds session management configuration
type SessionConfig struct {
	// Session timeout duration in hours
	TimeoutHours int `example:"24"`

	// Refresh token timeout in hours
	RefreshTokenTimeoutHours int `example:"168"` // 7 days

	// Maximum concurrent sessions per user (0 = unlimited)
	MaxConcurrentSessions int `example:"5"`

	// Session cleanup interval in hours
	CleanupIntervalHours int `example:"1"`

	// Enable session persistence across server restarts
	PersistSessions bool `example:"true"`

	// Session cookie settings
	CookieName     string `example:"einfra_session"`
	CookieSecure   bool   `example:"true"`
	CookieHTTPOnly bool   `example:"true"`
	CookieSameSite string `example:"Lax"` // Strict, Lax, None

	// Remember me duration in hours
	RememberMeDuration int `example:"720"` // 30 days
}
