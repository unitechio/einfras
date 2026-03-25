package iam

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

type tokenClaims struct {
	UserID         string   `json:"uid"`
	OrganizationID string   `json:"org"`
	Username       string   `json:"usr"`
	Email          string   `json:"email"`
	Roles          []string `json:"roles"`
	Permissions    []string `json:"perms"`
	Teams          []string `json:"teams"`
	jwt.RegisteredClaims
}

type TokenManager struct {
	secret        []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
	issuer        string
	otpIssuerName string
}

func NewTokenManager(secret string, accessTTL, refreshTTL time.Duration) *TokenManager {
	return &TokenManager{
		secret:        []byte(secret),
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
		issuer:        "einfra",
		otpIssuerName: "EINFRA",
	}
}

func (m *TokenManager) HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (m *TokenManager) ComparePassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

func (m *TokenManager) NewTokenPair(principal *Principal) (*TokenPair, string, error) {
	now := time.Now().UTC()
	accessExp := now.Add(m.accessTTL)
	claims := tokenClaims{
		UserID:         principal.UserID,
		OrganizationID: principal.OrganizationID,
		Username:       principal.Username,
		Email:          principal.Email,
		Roles:          append([]string(nil), principal.Roles...),
		Permissions:    append([]string(nil), principal.Permissions...),
		Teams:          append([]string(nil), principal.Teams...),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   principal.UserID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExp),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString(m.secret)
	if err != nil {
		return nil, "", err
	}
	refreshToken, err := randomToken(48)
	if err != nil {
		return nil, "", err
	}
	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresAt:    accessExp,
	}, m.HashToken(refreshToken), nil
}

func (m *TokenManager) ParseAccessToken(raw string) (*Principal, error) {
	parsed, err := jwt.ParseWithClaims(raw, &tokenClaims{}, func(token *jwt.Token) (any, error) {
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*tokenClaims)
	if !ok || !parsed.Valid {
		return nil, fmt.Errorf("invalid access token")
	}
	return &Principal{
		UserID:         claims.UserID,
		OrganizationID: claims.OrganizationID,
		Username:       claims.Username,
		Email:          claims.Email,
		Roles:          append([]string(nil), claims.Roles...),
		Permissions:    append([]string(nil), claims.Permissions...),
		Teams:          append([]string(nil), claims.Teams...),
		ExpiresAt:      claims.ExpiresAt.Time,
	}, nil
}

func (m *TokenManager) HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (m *TokenManager) RefreshTTL() time.Duration {
	return m.refreshTTL
}

func (m *TokenManager) GenerateActionToken() (string, string, error) {
	raw, err := randomToken(32)
	if err != nil {
		return "", "", err
	}
	return raw, m.HashToken(raw), nil
}

func (m *TokenManager) GenerateTOTP(user *User) (*otp.Key, string, []string, error) {
	secret := strings.TrimRight(base32.StdEncoding.EncodeToString(randomBytes(20)), "=")
	key, err := otp.NewKeyFromURL((&url.URL{
		Scheme: "otpauth",
		Host:   "totp",
		Path:   "/" + url.PathEscape(m.otpIssuerName+":"+user.Email),
		RawQuery: url.Values{
			"secret": []string{secret},
			"issuer": []string{m.otpIssuerName},
		}.Encode(),
	}).String())
	if err != nil {
		return nil, "", nil, err
	}
	codes := make([]string, 0, 8)
	for i := 0; i < 8; i++ {
		code, genErr := randomToken(5)
		if genErr != nil {
			return nil, "", nil, genErr
		}
		codes = append(codes, strings.ToUpper(code))
	}
	return key, secret, codes, nil
}

func (m *TokenManager) VerifyTOTP(secret, code string) bool {
	return totp.Validate(strings.TrimSpace(code), secret)
}

func randomBytes(size int) []byte {
	buf := make([]byte, size)
	_, _ = rand.Read(buf)
	return buf
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return strings.TrimRight(base32.StdEncoding.EncodeToString(buf), "="), nil
}

type ctxKey string

const principalContextKey ctxKey = "iam_principal"

func ContextWithPrincipal(ctx context.Context, principal *Principal) context.Context {
	return context.WithValue(ctx, principalContextKey, principal)
}

func PrincipalFromContext(ctx context.Context) (*Principal, bool) {
	principal, ok := ctx.Value(principalContextKey).(*Principal)
	return principal, ok && principal != nil
}

func OrganizationIDFromContext(ctx context.Context) string {
	principal, ok := PrincipalFromContext(ctx)
	if !ok {
		return ""
	}
	return principal.OrganizationID
}
