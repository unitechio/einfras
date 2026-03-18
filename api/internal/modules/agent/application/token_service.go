// Package agentregistry — token_service.go
// Issues, hashes and validates agent tokens.
// Each server (node) gets its own token; the raw token is returned once on
// creation and the bcrypt hash is persisted in agent_tokens table.
package agentregistry

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"einfra/api/internal/modules/agent/domain"
)

// AgentTokenRepository persists and validates agent tokens.
type AgentTokenRepository interface {
	// Save stores a new hashed token for serverID.
	Save(ctx context.Context, tok *agent.AgentToken) error
	// FindByServerID returns the token record for a server.
	FindByServerID(ctx context.Context, serverID string) (*agent.AgentToken, error)
	// Delete removes the token for a server (used to rotate).
	Delete(ctx context.Context, serverID string) error
}

// TokenService issues and validates agent bearer tokens.
type TokenService struct {
	repo AgentTokenRepository
}

// NewTokenService creates a TokenService backed by the given repository.
func NewTokenService(repo AgentTokenRepository) *TokenService {
	return &TokenService{repo: repo}
}

// Issue generates a new random token for serverID, stores its hash and
// returns the raw (plaintext) token to be sent to the agent once.
// Calling Issue again rotates the token.
func (s *TokenService) Issue(ctx context.Context, serverID string) (rawToken string, err error) {
	// 1. Generate 32 random bytes → 64-char hex string
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", fmt.Errorf("token generation: %w", err)
	}
	rawToken = hex.EncodeToString(b)

	// 2. Hash with bcrypt (cost 10 is fine for tokens — they're long)
	hash, err := bcrypt.GenerateFromPassword([]byte(rawToken), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("token hash: %w", err)
	}

	// 3. Rotate: delete old token then insert new
	_ = s.repo.Delete(ctx, serverID) // ignore "not found"
	tok := &agent.AgentToken{
		ID:        newUUID(),
		ServerID:  serverID,
		Token:     string(hash),
		IssuedAt:  time.Now(),
		ExpiresAt: time.Now().Add(365 * 24 * time.Hour), // 1 year; rotate as needed
	}
	if err = s.repo.Save(ctx, tok); err != nil {
		return "", fmt.Errorf("token persist: %w", err)
	}

	return rawToken, nil
}

// Validate returns nil if rawToken is valid for serverID.
// It checks expiry and bcrypt hash.
func (s *TokenService) Validate(ctx context.Context, serverID, rawToken string) error {
	if serverID == "" || rawToken == "" {
		return fmt.Errorf("missing credentials")
	}

	tok, err := s.repo.FindByServerID(ctx, serverID)
	if err != nil {
		return fmt.Errorf("unknown server: %w", err)
	}

	if time.Now().After(tok.ExpiresAt) {
		return fmt.Errorf("agent token expired")
	}

	// bcrypt compare  — timing-safe
	if err := bcrypt.CompareHashAndPassword([]byte(tok.Token), []byte(rawToken)); err != nil {
		return fmt.Errorf("invalid agent token")
	}
	return nil
}

// ValidateFromHeader extracts the bearer token from the Authorization header
// and validates it against serverID.
func (s *TokenService) ValidateFromHeader(ctx context.Context, serverID, authHeader string) error {
	rawToken := strings.TrimPrefix(authHeader, "Bearer ")
	rawToken = strings.TrimSpace(rawToken)
	return s.Validate(ctx, serverID, rawToken)
}

// ── tiny helper ──────────────────────────────────────────────────────────────

func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant bits
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
