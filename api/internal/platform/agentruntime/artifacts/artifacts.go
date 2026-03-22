package artifacts

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type Target struct {
	OS   string `json:"os"`
	Arch string `json:"arch"`
}

type Manifest struct {
	Version      string   `json:"version"`
	URL          string   `json:"url"`
	SHA256       string   `json:"sha256"`
	Channel      string   `json:"channel"`
	MinVersion   string   `json:"min_version,omitempty"`
	OS           string   `json:"os,omitempty"`
	Arch         string   `json:"arch,omitempty"`
	GRPCURLs     []string `json:"grpc_urls,omitempty"`
	ReleaseNotes string   `json:"release_notes,omitempty"`
	PublishedAt  string   `json:"published_at,omitempty"`
	Signature    string   `json:"signature,omitempty"`
}

func NormalizeTarget(goos, goarch string) Target {
	goos = strings.ToLower(strings.TrimSpace(goos))
	goarch = strings.ToLower(strings.TrimSpace(goarch))
	if goos == "" {
		goos = "linux"
	}
	if goarch == "" {
		goarch = "amd64"
	}
	return Target{OS: goos, Arch: goarch}
}

func ValidateTarget(target Target) error {
	switch target.OS {
	case "linux":
	default:
		return fmt.Errorf("unsupported os %q", target.OS)
	}
	switch target.Arch {
	case "amd64", "arm64":
	default:
		return fmt.Errorf("unsupported arch %q", target.Arch)
	}
	return nil
}

func ManifestSigningPayload(manifest Manifest) ([]byte, error) {
	payload := struct {
		Version      string   `json:"version"`
		URL          string   `json:"url"`
		SHA256       string   `json:"sha256"`
		Channel      string   `json:"channel"`
		MinVersion   string   `json:"min_version,omitempty"`
		OS           string   `json:"os,omitempty"`
		Arch         string   `json:"arch,omitempty"`
		GRPCURLs     []string `json:"grpc_urls,omitempty"`
		ReleaseNotes string   `json:"release_notes,omitempty"`
		PublishedAt  string   `json:"published_at,omitempty"`
	}{
		Version:      strings.TrimSpace(manifest.Version),
		URL:          strings.TrimSpace(manifest.URL),
		SHA256:       strings.TrimSpace(manifest.SHA256),
		Channel:      strings.TrimSpace(manifest.Channel),
		MinVersion:   strings.TrimSpace(manifest.MinVersion),
		OS:           strings.TrimSpace(manifest.OS),
		Arch:         strings.TrimSpace(manifest.Arch),
		GRPCURLs:     trimAll(manifest.GRPCURLs),
		ReleaseNotes: strings.TrimSpace(manifest.ReleaseNotes),
		PublishedAt:  strings.TrimSpace(manifest.PublishedAt),
	}
	return json.Marshal(payload)
}

func SignManifest(manifest *Manifest, privateKeyBase64 string) error {
	if manifest == nil {
		return fmt.Errorf("manifest is nil")
	}
	privateKey, err := decodePrivateKey(privateKeyBase64)
	if err != nil {
		return err
	}
	payload, err := ManifestSigningPayload(*manifest)
	if err != nil {
		return err
	}
	signature := ed25519.Sign(privateKey, payload)
	manifest.Signature = base64.StdEncoding.EncodeToString(signature)
	return nil
}

func VerifyManifest(manifest Manifest, publicKeyBase64 string) error {
	if strings.TrimSpace(publicKeyBase64) == "" {
		return nil
	}
	publicKey, err := decodePublicKey(publicKeyBase64)
	if err != nil {
		return err
	}
	signature, err := base64.StdEncoding.DecodeString(strings.TrimSpace(manifest.Signature))
	if err != nil {
		return fmt.Errorf("decode manifest signature: %w", err)
	}
	payload, err := ManifestSigningPayload(manifest)
	if err != nil {
		return err
	}
	if !ed25519.Verify(publicKey, payload, signature) {
		return fmt.Errorf("manifest signature verification failed")
	}
	return nil
}

func SHA256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func TimestampNow() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func decodePrivateKey(raw string) (ed25519.PrivateKey, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, fmt.Errorf("artifact signing private key is required")
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(raw))
	if err != nil {
		return nil, fmt.Errorf("decode artifact signing private key: %w", err)
	}
	switch len(decoded) {
	case ed25519.PrivateKeySize:
		return ed25519.PrivateKey(decoded), nil
	case ed25519.SeedSize:
		return ed25519.NewKeyFromSeed(decoded), nil
	default:
		return nil, fmt.Errorf("artifact signing private key must be 32-byte seed or 64-byte private key")
	}
}

func decodePublicKey(raw string) (ed25519.PublicKey, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, fmt.Errorf("artifact signing public key is required")
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(raw))
	if err != nil {
		return nil, fmt.Errorf("decode artifact signing public key: %w", err)
	}
	if len(decoded) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("artifact signing public key must be %d bytes", ed25519.PublicKeySize)
	}
	return ed25519.PublicKey(decoded), nil
}

func trimAll(items []string) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}
