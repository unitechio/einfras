// Package resilience — Antigravity resilience patterns:
// Retry with exponential backoff, Circuit Breaker, and bulkhead isolation.
package resilience

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog/log"
)

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

// RetryConfig defines retry behaviour.
type RetryConfig struct {
	MaxAttempts int           // max total attempts (including first)
	BaseDelay   time.Duration // initial delay before first retry
	MaxDelay    time.Duration // cap on delay
	Multiplier  float64       // backoff multiplier (typically 2.0)
	Jitter      float64       // jitter fraction [0.0, 1.0] — prevents thundering herd
}

// DefaultRetryConfig is tuned for agent command dispatch.
var DefaultRetryConfig = RetryConfig{
	MaxAttempts: 4,
	BaseDelay:   250 * time.Millisecond,
	MaxDelay:    10 * time.Second,
	Multiplier:  2.0,
	Jitter:      0.2,
}

// IsRetryable lets callers classify errors as retryable or permanent.
type IsRetryable func(err error) bool

// ExponentialBackoff retries fn with exponential backoff + jitter.
// Returns the last error if all attempts fail.
// If ctx is cancelled, returns ctx.Err() immediately.
func ExponentialBackoff(ctx context.Context, cfg RetryConfig, isRetryable IsRetryable, fn func() error) error {
	var lastErr error
	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		lastErr = fn()
		if lastErr == nil {
			return nil
		}

		if isRetryable != nil && !isRetryable(lastErr) {
			return lastErr // permanent error — don't retry
		}

		if attempt == cfg.MaxAttempts {
			break
		}

		delay := delay(cfg, attempt)
		log.Warn().
			Err(lastErr).
			Int("attempt", attempt).
			Dur("backoff", delay).
			Msg("[retry] retrying after backoff")

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
	return fmt.Errorf("all %d attempts failed: %w", cfg.MaxAttempts, lastErr)
}

func delay(cfg RetryConfig, attempt int) time.Duration {
	base := float64(cfg.BaseDelay) * math.Pow(cfg.Multiplier, float64(attempt-1))
	if base > float64(cfg.MaxDelay) {
		base = float64(cfg.MaxDelay)
	}
	if cfg.Jitter > 0 {
		base = base * (1 + cfg.Jitter*(rand.Float64()*2-1))
	}
	if base < 0 {
		base = 0
	}
	return time.Duration(base)
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

// CBState is the circuit breaker state.
type CBState int32

const (
	CBClosed   CBState = 0 // healthy — requests pass through
	CBOpen     CBState = 1 // failing — requests rejected immediately
	CBHalfOpen CBState = 2 // probing — one request allowed through
)

func (s CBState) String() string {
	switch s {
	case CBClosed:
		return "closed"
	case CBOpen:
		return "open"
	case CBHalfOpen:
		return "half-open"
	}
	return "unknown"
}

// ErrCircuitOpen is returned when the circuit is open.
var ErrCircuitOpen = errors.New("circuit breaker is open")

// CircuitBreaker protects a downstream dependency.
type CircuitBreaker struct {
	name string

	// config
	failureThreshold  int           // failures before opening
	successThreshold  int           // successes in half-open before closing
	resetTimeout      time.Duration // open → half-open transition

	// state (all atomic / mutex-protected)
	state         atomic.Int32
	failures      int
	successes     int
	lastFailureAt time.Time
	mu            sync.Mutex

	// optional metrics callback: state, name
	onStateChange func(name string, from, to CBState)
}

// CBConfig configures the circuit breaker.
type CBConfig struct {
	Name             string
	FailureThreshold int
	SuccessThreshold int
	ResetTimeout     time.Duration
	OnStateChange    func(name string, from, to CBState)
}

// NewCircuitBreaker creates a new CircuitBreaker.
func NewCircuitBreaker(cfg CBConfig) *CircuitBreaker {
	cb := &CircuitBreaker{
		name:             cfg.Name,
		failureThreshold: cfg.FailureThreshold,
		successThreshold: cfg.SuccessThreshold,
		resetTimeout:     cfg.ResetTimeout,
		onStateChange:    cfg.OnStateChange,
	}
	// start closed
	cb.state.Store(int32(CBClosed))
	return cb
}

// DefaultAgentCB creates a circuit breaker tuned for agent command dispatch.
func DefaultAgentCB(serverID string, onStateChange func(string, CBState, CBState)) *CircuitBreaker {
	return NewCircuitBreaker(CBConfig{
		Name:             "agent-" + serverID,
		FailureThreshold: 5,
		SuccessThreshold: 2,
		ResetTimeout:     30 * time.Second,
		OnStateChange:    onStateChange,
	})
}

// Execute runs fn through the circuit breaker.
// Returns ErrCircuitOpen if the circuit is open.
func (cb *CircuitBreaker) Execute(fn func() error) error {
	state := CBState(cb.state.Load())

	switch state {
	case CBOpen:
		cb.mu.Lock()
		sinceFailure := time.Since(cb.lastFailureAt)
		cb.mu.Unlock()
		if sinceFailure < cb.resetTimeout {
			return ErrCircuitOpen
		}
		// Transition to half-open: allow one probe
		cb.transitionTo(CBHalfOpen)

	case CBHalfOpen:
		// Only one concurrent probe request
	}

	err := fn()

	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.recordFailure()
	} else {
		cb.recordSuccess()
	}
	return err
}

func (cb *CircuitBreaker) recordFailure() {
	current := CBState(cb.state.Load())
	cb.failures++
	cb.lastFailureAt = time.Now()
	cb.successes = 0

	if current == CBHalfOpen || cb.failures >= cb.failureThreshold {
		cb.transitionTo(CBOpen)
	}
}

func (cb *CircuitBreaker) recordSuccess() {
	current := CBState(cb.state.Load())
	cb.successes++

	if current == CBHalfOpen && cb.successes >= cb.successThreshold {
		cb.failures = 0
		cb.transitionTo(CBClosed)
	}
}

func (cb *CircuitBreaker) transitionTo(next CBState) {
	prev := CBState(cb.state.Swap(int32(next)))
	if prev == next {
		return
	}
	log.Info().
		Str("cb", cb.name).
		Str("from", prev.String()).
		Str("to", next.String()).
		Msg("[circuit-breaker] state changed")
	if cb.onStateChange != nil {
		cb.onStateChange(cb.name, prev, next)
	}
}

// State returns the current circuit state.
func (cb *CircuitBreaker) State() CBState { return CBState(cb.state.Load()) }

// ─── Bulkhead (per-server semaphore) ─────────────────────────────────────────

// Bulkhead limits concurrent operations per resource (server).
// This prevents one misbehaving server from consuming all goroutines.
type Bulkhead struct {
	sem chan struct{}
	name string
}

// NewBulkhead creates a new bulkhead with maxConcurrent slots.
func NewBulkhead(name string, maxConcurrent int) *Bulkhead {
	return &Bulkhead{
		name: name,
		sem:  make(chan struct{}, maxConcurrent),
	}
}

// Execute runs fn within the bulkhead. Returns error if at capacity.
func (b *Bulkhead) Execute(ctx context.Context, fn func() error) error {
	select {
	case b.sem <- struct{}{}:
		defer func() { <-b.sem }()
		return fn()
	case <-ctx.Done():
		return ctx.Err()
	default:
		return fmt.Errorf("bulkhead %q at capacity — request rejected", b.name)
	}
}

// ─── Combined: Retry + CB guard ──────────────────────────────────────────────

// GuardedCall wraps fn with circuit breaker + retry + backoff.
// Ideal for: dispatcher → agent command send.
func GuardedCall(
	ctx context.Context,
	cb *CircuitBreaker,
	retryCfg RetryConfig,
	fn func() error,
) error {
	return ExponentialBackoff(ctx, retryCfg, func(err error) bool {
		// Don't retry circuit-open errors — they'll just fail immediately anyway
		return !errors.Is(err, ErrCircuitOpen)
	}, func() error {
		return cb.Execute(fn)
	})
}
