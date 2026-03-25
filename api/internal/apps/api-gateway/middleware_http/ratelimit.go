//go:build legacy
// +build legacy

package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"

	"einfra/api/internal/shared/platform/config"
)

// IPRateLimiter manages rate limiters for different IPs
type IPRateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	r        rate.Limit
	b        int
}

// NewIPRateLimiter creates a new IP-based rate limiter
func NewIPRateLimiter(cfg config.RateLimitConfig) *IPRateLimiter {
	// Convert requests per minute to requests per second
	requestsPerSecond := float64(cfg.RequestsPerMin) / 60.0

	return &IPRateLimiter{
		limiters: make(map[string]*rate.Limiter),
		r:        rate.Limit(requestsPerSecond),
		b:        cfg.Burst,
	}
}

// GetLimiter returns the rate limiter for the given IP
func (i *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	limiter, exists := i.limiters[ip]
	if !exists {
		limiter = rate.NewLimiter(i.r, i.b)
		i.limiters[ip] = limiter
	}

	return limiter
}

// CleanupOldLimiters removes limiters that haven't been used recently
func (i *IPRateLimiter) CleanupOldLimiters() {
	i.mu.Lock()
	defer i.mu.Unlock()

	// In production, implement proper cleanup logic
	// For now, just clear all limiters periodically
	if len(i.limiters) > 10000 {
		i.limiters = make(map[string]*rate.Limiter)
	}
}

// RateLimitMiddleware returns a middleware that limits requests per IP
func (i *IPRateLimiter) RateLimitMiddleware() gin.HandlerFunc {
	// Start cleanup goroutine
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			i.CleanupOldLimiters()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := i.GetLimiter(ip)

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"code":        "RATE_LIMIT_EXCEEDED",
				"retry_after": "60s",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimitMiddlewareWithConfig creates rate limit middleware with custom config
func RateLimitMiddlewareWithConfig(requestsPerMin int, burst int) gin.HandlerFunc {
	limiter := &IPRateLimiter{
		limiters: make(map[string]*rate.Limiter),
		r:        rate.Limit(float64(requestsPerMin) / 60.0),
		b:        burst,
	}

	return limiter.RateLimitMiddleware()
}

// GlobalRateLimiter is a simple global rate limiter
type GlobalRateLimiter struct {
	limiter *rate.Limiter
}

// NewGlobalRateLimiter creates a new global rate limiter
func NewGlobalRateLimiter(requestsPerMin int, burst int) *GlobalRateLimiter {
	return &GlobalRateLimiter{
		limiter: rate.NewLimiter(rate.Limit(float64(requestsPerMin)/60.0), burst),
	}
}

// Middleware returns the middleware function
func (g *GlobalRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !g.limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded",
				"code":  "RATE_LIMIT_EXCEEDED",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
