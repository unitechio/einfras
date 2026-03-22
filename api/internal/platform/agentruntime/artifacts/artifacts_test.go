package artifacts

import (
	"crypto/ed25519"
	"encoding/base64"
	"testing"
)

func TestSignAndVerifyManifest(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	manifest := Manifest{
		Version:     "1.2.3",
		URL:         "https://cp.example.com/v1/agent/binary?os=linux&arch=amd64",
		SHA256:      "abcd1234",
		Channel:     "stable",
		OS:          "linux",
		Arch:        "amd64",
		PublishedAt: "2026-03-22T00:00:00Z",
	}
	if err := SignManifest(&manifest, base64.StdEncoding.EncodeToString(privateKey)); err != nil {
		t.Fatalf("SignManifest() error = %v", err)
	}
	if manifest.Signature == "" {
		t.Fatalf("expected signature to be set")
	}
	if err := VerifyManifest(manifest, base64.StdEncoding.EncodeToString(publicKey)); err != nil {
		t.Fatalf("VerifyManifest() error = %v", err)
	}
}

func TestVerifyManifestRejectsTampering(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	manifest := Manifest{
		Version:     "1.2.3",
		URL:         "https://cp.example.com/v1/agent/binary?os=linux&arch=amd64",
		SHA256:      "abcd1234",
		Channel:     "stable",
		OS:          "linux",
		Arch:        "amd64",
		PublishedAt: "2026-03-22T00:00:00Z",
	}
	if err := SignManifest(&manifest, base64.StdEncoding.EncodeToString(privateKey)); err != nil {
		t.Fatalf("SignManifest() error = %v", err)
	}
	manifest.URL = "https://evil.example.com/agent"
	if err := VerifyManifest(manifest, base64.StdEncoding.EncodeToString(publicKey)); err == nil {
		t.Fatalf("expected tampered manifest to be rejected")
	}
}
