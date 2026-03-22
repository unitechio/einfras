package updater

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"einfra/api/internal/platform/agentruntime/artifacts"
	"einfra/api/internal/platform/agentruntime/config"
)

func TestShouldUpdateAcceptsNewerStableVersion(t *testing.T) {
	u := New(&config.Config{
		Version:       "1.0.0",
		UpdateChannel: "stable",
	}, nil)

	ok, err := u.shouldUpdate(&Manifest{
		Version:  "1.1.0",
		URL:      "https://downloads.example.com/einfra-agent",
		SHA256:   "abcd1234",
		Channel:  "stable",
		GRPCURLs: []string{"cp.example.com:50051"},
	})
	if err != nil {
		t.Fatalf("shouldUpdate() error = %v", err)
	}
	if !ok {
		t.Fatalf("expected update to be accepted")
	}
}

func TestShouldUpdateRejectsWrongChannel(t *testing.T) {
	u := New(&config.Config{
		Version:       "1.0.0",
		UpdateChannel: "stable",
	}, nil)

	ok, err := u.shouldUpdate(&Manifest{
		Version:  "1.1.0",
		URL:      "https://downloads.example.com/einfra-agent",
		SHA256:   "abcd1234",
		Channel:  "beta",
		GRPCURLs: []string{"cp.example.com:50051"},
	})
	if err != nil {
		t.Fatalf("shouldUpdate() error = %v", err)
	}
	if ok {
		t.Fatalf("expected update to be rejected by channel")
	}
}

func TestStartReturnsImmediatelyWhenDisabled(t *testing.T) {
	u := New(&config.Config{
		UpdateCheckInterval: time.Second,
	}, nil)

	done := make(chan struct{})
	go func() {
		u.Start(context.Background())
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("Start() did not return for disabled updater")
	}
}

func TestValidateManifestRequiresGRPCURLs(t *testing.T) {
	err := validateManifest(&Manifest{
		Version: "1.1.0",
		URL:     "https://downloads.example.com/einfra-agent",
		SHA256:  "abcd1234",
	})
	if err == nil {
		t.Fatalf("expected missing grpc_urls to be rejected")
	}
}

func TestFetchManifestDecodesEscapedAmpersandsAndVerifiesSignature(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	manifest := artifacts.Manifest{
		Version:     "1.1.0",
		URL:         "http://localhost:8080/v1/agent/binary?os=linux&arch=amd64",
		SHA256:      "abcd1234",
		Channel:     "stable",
		OS:          "linux",
		Arch:        "amd64",
		GRPCURLs:    []string{"localhost:50051"},
		PublishedAt: "2026-03-22T00:00:00Z",
	}
	if err := artifacts.SignManifest(&manifest, base64.StdEncoding.EncodeToString(privateKey)); err != nil {
		t.Fatalf("SignManifest() error = %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"version":"1.1.0","url":"http://localhost:8080/v1/agent/binary?os=linux\\u0026arch=amd64","sha256":"abcd1234","channel":"stable","os":"linux","arch":"amd64","grpc_urls":["localhost:50051"],"published_at":"2026-03-22T00:00:00Z","signature":"` + manifest.Signature + `"}`))
	}))
	defer server.Close()

	u := New(&config.Config{
		UpdateManifestURL: server.URL,
		UpdatePublicKey:   base64.StdEncoding.EncodeToString(publicKey),
		UpdateChannel:     "stable",
	}, nil)
	fetched, err := u.fetchManifest(context.Background())
	if err != nil {
		t.Fatalf("fetchManifest() error = %v", err)
	}
	if fetched.URL != "http://localhost:8080/v1/agent/binary?os=linux&arch=amd64" {
		t.Fatalf("URL = %q", fetched.URL)
	}
	if len(fetched.GRPCURLs) != 1 || fetched.GRPCURLs[0] != "localhost:50051" {
		t.Fatalf("GRPCURLs = %#v", fetched.GRPCURLs)
	}
}

func TestFetchManifestAcceptsEnvelopeResponse(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	manifest := artifacts.Manifest{
		Version:     "1.1.0",
		URL:         "http://localhost:8080/v1/agent/binary?os=linux&arch=amd64",
		SHA256:      "abcd1234",
		Channel:     "stable",
		OS:          "linux",
		Arch:        "amd64",
		GRPCURLs:    []string{"localhost:50051"},
		PublishedAt: "2026-03-22T00:00:00Z",
	}
	if err := artifacts.SignManifest(&manifest, base64.StdEncoding.EncodeToString(privateKey)); err != nil {
		t.Fatalf("SignManifest() error = %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":"ok","resource":"agent_manifest","item":{"version":"1.1.0","url":"http://localhost:8080/v1/agent/binary?os=linux&arch=amd64","sha256":"abcd1234","channel":"stable","os":"linux","arch":"amd64","grpc_urls":["localhost:50051"],"published_at":"2026-03-22T00:00:00Z","signature":"` + manifest.Signature + `"}}`))
	}))
	defer server.Close()

	u := New(&config.Config{
		UpdateManifestURL: server.URL,
		UpdatePublicKey:   base64.StdEncoding.EncodeToString(publicKey),
		UpdateChannel:     "stable",
	}, nil)
	fetched, err := u.fetchManifest(context.Background())
	if err != nil {
		t.Fatalf("fetchManifest() error = %v", err)
	}
	if fetched.Version != "1.1.0" {
		t.Fatalf("Version = %q", fetched.Version)
	}
}

func TestSanitizeLoopbackURLUsesHostDockerInternalInContainerMode(t *testing.T) {
	t.Setenv("EINFRA_FORCE_CONTAINER", "1")
	got := sanitizeLoopbackURL("http://localhost:8080/v1/agent/manifest")
	if got != "http://host.docker.internal:8080/v1/agent/manifest" {
		t.Fatalf("sanitizeLoopbackURL() = %q", got)
	}
}

func TestSanitizeLoopbackURLUsesLocalhostOnHostMode(t *testing.T) {
	t.Setenv("EINFRA_FORCE_CONTAINER", "0")
	got := sanitizeLoopbackURL("http://host.docker.internal:8080/v1/agent/manifest")
	if got != "http://localhost:8080/v1/agent/manifest" {
		t.Fatalf("sanitizeLoopbackURL() = %q", got)
	}
}
