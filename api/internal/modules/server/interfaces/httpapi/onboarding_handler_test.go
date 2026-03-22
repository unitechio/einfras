package serverhttp

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"

	sharedconfig "einfra/api/internal/shared/platform/config"
)

type stubTokenIssuer struct {
	token string
	err   error
}

func (s stubTokenIssuer) Issue(context.Context, string) (string, error) {
	return s.token, s.err
}

func TestPostInstallScriptReturnsRenderedInstaller(t *testing.T) {
	handler := NewOnboardingHandler(stubTokenIssuer{token: "super-secure-agent-token"}, nil, sharedconfig.AgentArtifactsConfig{})
	router := mux.NewRouter()
	handler.Register(router)

	req := httptest.NewRequest(http.MethodPost, "/v1/servers/11111111-1111-1111-1111-111111111111/agent/install-script", nil)
	req.Host = "control-plane.example.com"
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	body := rec.Body.String()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, body)
	}
	for _, want := range []string{
		`"version":"installer-v2"`,
		`"command":"curl -fsSL 'http://control-plane.example.com/install.sh?`,
		`"script":"#!/usr/bin/env bash`,
		`--server-id`,
		`detect_docker`,
		`has_systemd`,
		`/etc/einfra-agent/config.yaml`,
		`/v1/agent/binary?os=linux&arch=amd64`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("response missing %q\nbody=%s", want, body)
		}
	}
	if strings.Contains(body, "localhost:8080") {
		t.Fatalf("response unexpectedly contains localhost:8080: %s", body)
	}
}

func TestGetAgentBinaryRejectsUnsupportedTarget(t *testing.T) {
	handler := NewOnboardingHandler(stubTokenIssuer{}, nil, sharedconfig.AgentArtifactsConfig{})
	router := mux.NewRouter()
	handler.Register(router)

	req := httptest.NewRequest(http.MethodGet, "/v1/agent/binary?os=darwin&arch=amd64", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "unsupported os") {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestGetInstallShReturnsShellScript(t *testing.T) {
	handler := NewOnboardingHandler(stubTokenIssuer{}, nil, sharedconfig.AgentArtifactsConfig{})
	router := mux.NewRouter()
	handler.Register(router)

	req := httptest.NewRequest(http.MethodGet, "/install.sh?server_id=11111111-1111-1111-1111-111111111111&token=super-secure-agent-token&server=https://cp.example.com", nil)
	req.Host = "cp.example.com"
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	body := rec.Body.String()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, body)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/x-shellscript") {
		t.Fatalf("unexpected content-type %q", ct)
	}
	for _, want := range []string{
		"#!/usr/bin/env bash",
		"--server-id",
		"detect_docker",
		"has_systemd",
		"/etc/einfra-agent/config.yaml",
		"check_connectivity",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("script missing %q\nbody=%s", want, body)
		}
	}
	if strings.Contains(body, "localhost:8080") {
		t.Fatalf("script unexpectedly contains localhost:8080: %s", body)
	}
}

func TestGetAgentManifestReturnsSignedManifest(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	handler := NewOnboardingHandler(stubTokenIssuer{}, nil, sharedconfig.AgentArtifactsConfig{
		Version:           "1.2.3",
		Channel:           "stable",
		SigningPrivateKey: base64.StdEncoding.EncodeToString(priv),
		SigningPublicKey:  base64.StdEncoding.EncodeToString(pub),
	})
	router := mux.NewRouter()
	handler.Register(router)

	req := httptest.NewRequest(http.MethodGet, "/v1/agent/manifest?os=linux&arch=amd64", nil)
	req.Host = "control-plane.example.com"
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	body := rec.Body.String()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, body)
	}
	for _, want := range []string{
		`"resource":"agent_manifest"`,
		`"version":"1.2.3"`,
		`"channel":"stable"`,
		`"signature":"`,
		`"url":"http://control-plane.example.com/v1/agent/binary?os=linux&arch=amd64"`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("response missing %q\nbody=%s", want, body)
		}
	}
}

func TestGetInstallShNormalizesSplitArtifactQueries(t *testing.T) {
	handler := NewOnboardingHandler(stubTokenIssuer{}, nil, sharedconfig.AgentArtifactsConfig{})
	router := mux.NewRouter()
	handler.Register(router)

	req := httptest.NewRequest(http.MethodGet, "/install.sh?server_id=11111111-1111-1111-1111-111111111111&token=super-secure-agent-token&server=http://host.docker.internal:8080&binary_url=http://host.docker.internal:8080/v1/agent/binary?os=linux&arch=amd64&update_manifest_url=http://host.docker.internal:8080/v1/agent/manifest?os=linux&arch=amd64", nil)
	req.Host = "host.docker.internal:8080"
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	body := rec.Body.String()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, body)
	}
	for _, want := range []string{
		"BINARY_URL_DEFAULT='http://host.docker.internal:8080/v1/agent/binary?arch=amd64&os=linux'",
		"UPDATE_MANIFEST_URL_DEFAULT='http://host.docker.internal:8080/v1/agent/manifest?arch=amd64&os=linux'",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("script missing %q\nbody=%s", want, body)
		}
	}
}
