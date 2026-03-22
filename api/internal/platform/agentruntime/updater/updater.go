package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Masterminds/semver"
	"github.com/rs/zerolog/log"

	"einfra/api/internal/platform/agentruntime/artifacts"
	"einfra/api/internal/platform/agentruntime/config"
	"einfra/api/internal/platform/loggingx"
)

type Manifest = artifacts.Manifest

type Updater struct {
	cfg       *config.Config
	client    *http.Client
	onUpdated func(version string)
}

func New(cfg *config.Config, onUpdated func(version string)) *Updater {
	return &Updater{
		cfg: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		onUpdated: onUpdated,
	}
}

func (u *Updater) Enabled() bool {
	return strings.TrimSpace(u.cfg.UpdateManifestURL) != ""
}

func (u *Updater) Start(ctx context.Context) {
	if !u.Enabled() {
		return
	}
	log.Info().
		Str("component", "agent").
		Str("event", "auto-update-loop").
		Str("server_id", u.cfg.ServerID).
		Str("status", "starting").
		Interface("details", map[string]any{
			"manifest_url":       sanitizeLoopbackURL(u.cfg.UpdateManifestURL),
			"check_interval_ms":  u.cfg.UpdateCheckInterval.Milliseconds(),
			"retry_interval_ms":  u.cfg.UpdateRetryInterval.Milliseconds(),
			"max_retries":        u.cfg.UpdateMaxRetries,
			"container":          inContainer(),
			"heartbeat_interval": u.cfg.HeartbeatInterval.String(),
			"grpc_targets":       sanitizeTargets(u.cfg.GRPCTargets()),
		}).Send()

	u.checkWithRetries(ctx)
	ticker := time.NewTicker(u.cfg.UpdateCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("agent auto-update loop stopped")
			return
		case <-ticker.C:
			u.checkWithRetries(ctx)
		}
	}
}

func (u *Updater) checkWithRetries(ctx context.Context) {
	maxRetries := u.cfg.UpdateMaxRetries
	if maxRetries <= 0 {
		maxRetries = 1
	}
	for attempt := 1; attempt <= maxRetries; attempt++ {
		manifest, err := u.fetchManifest(ctx)
		if err == nil {
			u.applyManifest(ctx, manifest)
			return
		}
		loggingx.New("agent").Warn(log.Logger, "manifest-fetch", u.cfg.ServerID, "retrying", map[string]any{
			"attempt":           attempt,
			"max_retries":       maxRetries,
			"retry_interval_ms": u.cfg.UpdateRetryInterval.Milliseconds(),
			"reason":            err.Error(),
			"manifest_url":      sanitizeLoopbackURL(u.cfg.UpdateManifestURL),
		})
		if attempt >= maxRetries {
			loggingx.New("agent").Error(log.Logger, "manifest-fetch", u.cfg.ServerID, "using-current-binary", map[string]any{
				"max_retries":  maxRetries,
				"reason":       err.Error(),
				"manifest_url": sanitizeLoopbackURL(u.cfg.UpdateManifestURL),
			})
			return
		}
		if !sleepWithContext(ctx, u.cfg.UpdateRetryInterval) {
			return
		}
	}
}

func (u *Updater) applyManifest(ctx context.Context, manifest *Manifest) {
	ok, err := u.shouldUpdate(manifest)
	if err != nil {
		loggingx.New("agent").Warn(log.Logger, "manifest-validate", u.cfg.ServerID, "rejected", map[string]any{
			"reason": err.Error(),
		})
		return
	}
	loggingx.New("agent").Info(log.Logger, "manifest-accepted", u.cfg.ServerID, "ok", map[string]any{
		"manifest_version": manifest.Version,
		"binary_url":       manifest.URL,
		"grpc_urls":        manifest.GRPCURLs,
	})
	if !ok {
		return
	}
	if len(manifest.GRPCURLs) > 0 {
		u.cfg.GRPCURLs = dedupe(trimAll(sanitizeTargets(manifest.GRPCURLs)))
		loggingx.New("agent").Info(log.Logger, "grpc-targets", u.cfg.ServerID, "updated", map[string]any{
			"grpc_targets": u.cfg.GRPCTargets(),
		})
	}
	if err := u.installUpdate(ctx, manifest); err != nil {
		loggingx.New("agent").Error(log.Logger, "binary-install", u.cfg.ServerID, "failed", map[string]any{
			"version": manifest.Version,
			"reason":  err.Error(),
		})
		return
	}
	loggingx.New("agent").Info(log.Logger, "binary-install", u.cfg.ServerID, "installed", map[string]any{
		"version": manifest.Version,
	})
	if u.onUpdated != nil {
		u.onUpdated(manifest.Version)
	}
}

func (u *Updater) fetchManifest(ctx context.Context) (*Manifest, error) {
	manifestURL := sanitizeLoopbackURL(u.cfg.UpdateManifestURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := u.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("manifest request returned %d", resp.StatusCode)
	}
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	manifest, err := decodeManifestResponse(rawBody)
	if err != nil {
		return nil, err
	}
	manifest.URL = decodeEscapedAmpersands(manifest.URL)
	signedManifest := *manifest
	if err := validateManifest(manifest); err != nil {
		return nil, err
	}
	if err := artifacts.VerifyManifest(signedManifest, u.cfg.UpdatePublicKey); err != nil {
		return nil, fmt.Errorf("verify manifest signature: %w", err)
	}
	manifest.URL = sanitizeLoopbackURL(manifest.URL)
	manifest.GRPCURLs = sanitizeTargets(manifest.GRPCURLs)
	loggingx.New("agent").Info(log.Logger, "manifest-fetched", u.cfg.ServerID, "ok", map[string]any{
		"manifest_version": manifest.Version,
		"binary_url":       manifest.URL,
		"grpc_urls":        manifest.GRPCURLs,
	})
	return manifest, nil
}

func (u *Updater) shouldUpdate(manifest *Manifest) (bool, error) {
	if manifest == nil {
		return false, fmt.Errorf("manifest is nil")
	}
	if err := validateManifest(manifest); err != nil {
		return false, err
	}
	channel := strings.ToLower(strings.TrimSpace(manifest.Channel))
	if channel != "" && channel != strings.ToLower(u.cfg.UpdateChannel) {
		return false, nil
	}
	current, err := semver.NewVersion(normalizeSemver(u.cfg.Version))
	if err != nil {
		return false, fmt.Errorf("parse current version: %w", err)
	}
	target, err := semver.NewVersion(normalizeSemver(manifest.Version))
	if err != nil {
		return false, fmt.Errorf("parse target version: %w", err)
	}
	if !target.GreaterThan(current) {
		return false, nil
	}
	if manifest.MinVersion != "" {
		minimum, err := semver.NewVersion(normalizeSemver(manifest.MinVersion))
		if err != nil {
			return false, fmt.Errorf("parse min_version: %w", err)
		}
		if current.LessThan(minimum) {
			return false, fmt.Errorf("current version %s lower than manifest min_version %s", current, minimum)
		}
	}
	return true, nil
}

func (u *Updater) installUpdate(ctx context.Context, manifest *Manifest) error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve current executable: %w", err)
	}

	loggingx.New("agent").Info(log.Logger, "binary-download", u.cfg.ServerID, "starting", map[string]any{
		"version":     manifest.Version,
		"binary_url":  manifest.URL,
		"target_path": exePath,
	})

	tmpFile, checksum, err := u.downloadBinary(ctx, manifest.URL)
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile)

	if !strings.EqualFold(strings.TrimSpace(manifest.SHA256), checksum) {
		return fmt.Errorf("sha256 mismatch: got %s want %s", checksum, manifest.SHA256)
	}

	if runtime.GOOS == "windows" {
		pendingPath := exePath + ".new"
		if err := os.Rename(tmpFile, pendingPath); err != nil {
			return fmt.Errorf("stage windows update: %w", err)
		}
		loggingx.New("agent").Info(log.Logger, "binary-stage", u.cfg.ServerID, "staged", map[string]any{
			"path": pendingPath,
		})
		return nil
	}

	dir := filepath.Dir(exePath)
	stagedPath := filepath.Join(dir, ".einfra-agent.updated")
	if err := os.Rename(tmpFile, stagedPath); err != nil {
		return fmt.Errorf("stage update: %w", err)
	}
	if err := os.Chmod(stagedPath, 0o755); err != nil {
		_ = os.Remove(stagedPath)
		return fmt.Errorf("chmod staged update: %w", err)
	}
	backupPath := exePath + ".bak"
	_ = os.Remove(backupPath)
	if err := os.Rename(exePath, backupPath); err != nil {
		_ = os.Remove(stagedPath)
		return fmt.Errorf("backup current binary: %w", err)
	}
	if err := os.Rename(stagedPath, exePath); err != nil {
		_ = os.Rename(backupPath, exePath)
		return fmt.Errorf("activate updated binary: %w", err)
	}
	if err := os.Chmod(exePath, 0o755); err != nil {
		return fmt.Errorf("chmod updated binary: %w", err)
	}
	if shouldForegroundRestart(u.cfg) {
		if err := restartForeground(exePath); err != nil {
			return fmt.Errorf("restart updated agent in foreground: %w", err)
		}
		loggingx.New("agent").Info(log.Logger, "agent-restart", u.cfg.ServerID, "spawned", map[string]any{
			"path": exePath,
			"mode": u.cfg.Mode,
		})
	}
	return nil
}

func (u *Updater) downloadBinary(ctx context.Context, rawURL string) (string, string, error) {
	downloadURL := sanitizeLoopbackURL(decodeEscapedAmpersands(rawURL))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return "", "", err
	}
	resp, err := u.client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("binary download returned %d", resp.StatusCode)
	}

	tmp, err := os.CreateTemp("", "einfra-agent-update-*")
	if err != nil {
		return "", "", err
	}
	defer tmp.Close()

	hasher := sha256.New()
	writer := io.MultiWriter(tmp, hasher)
	if _, err := io.Copy(writer, resp.Body); err != nil {
		return "", "", err
	}
	return tmp.Name(), hex.EncodeToString(hasher.Sum(nil)), nil
}

func validateManifest(manifest *Manifest) error {
	if manifest == nil {
		return fmt.Errorf("manifest is nil")
	}
	if strings.TrimSpace(manifest.Version) == "" {
		return fmt.Errorf("manifest missing version")
	}
	if strings.TrimSpace(manifest.URL) == "" {
		return fmt.Errorf("manifest missing url")
	}
	if strings.TrimSpace(manifest.SHA256) == "" {
		return fmt.Errorf("manifest missing sha256")
	}
	if len(trimAll(manifest.GRPCURLs)) == 0 {
		return fmt.Errorf("manifest missing grpc_urls")
	}
	for _, target := range manifest.GRPCURLs {
		if !strings.Contains(strings.TrimSpace(target), ":") {
			return fmt.Errorf("manifest has invalid grpc target %q", target)
		}
	}
	if _, err := url.ParseRequestURI(strings.TrimSpace(manifest.URL)); err != nil {
		return fmt.Errorf("manifest has invalid url: %w", err)
	}
	return nil
}

func normalizeSemver(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "v") {
		return value
	}
	return "v" + value
}

func inContainer() bool {
	if forced := strings.TrimSpace(os.Getenv("EINFRA_FORCE_CONTAINER")); forced != "" {
		return forced == "1" || strings.EqualFold(forced, "true")
	}
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return true
	}
	return false
}

func sanitizeLoopbackURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return raw
	}
	host := parsed.Hostname()
	if host == "" {
		return raw
	}
	replacement := preferredLoopbackHost()
	switch strings.ToLower(host) {
	case "localhost", "127.0.0.1", "::1", "host.docker.internal":
		if replacement == host {
			return raw
		}
		port := parsed.Port()
		if port != "" {
			parsed.Host = replacement + ":" + port
		} else {
			parsed.Host = replacement
		}
		return parsed.String()
	default:
		return raw
	}
}

func sanitizeTargets(targets []string) []string {
	out := make([]string, 0, len(targets))
	replacement := preferredLoopbackHost()
	for _, target := range trimAll(targets) {
		host, port, err := strings.Cut(target, ":")
		if !err || strings.TrimSpace(port) == "" {
			out = append(out, target)
			continue
		}
		switch strings.ToLower(strings.TrimSpace(host)) {
		case "localhost", "127.0.0.1", "::1", "host.docker.internal":
			out = append(out, replacement+":"+strings.TrimSpace(port))
		default:
			out = append(out, target)
		}
	}
	return dedupe(out)
}

func preferredLoopbackHost() string {
	if inContainer() {
		return "host.docker.internal"
	}
	return "localhost"
}

func decodeEscapedAmpersands(value string) string {
	return strings.ReplaceAll(value, "\\u0026", "&")
}

func decodeManifestResponse(raw []byte) (*Manifest, error) {
	var manifest Manifest
	if err := json.Unmarshal(raw, &manifest); err == nil && looksLikeManifest(&manifest) {
		return &manifest, nil
	}

	var envelope struct {
		Item json.RawMessage `json:"item"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("decode manifest response: %w", err)
	}
	if len(envelope.Item) == 0 {
		return nil, fmt.Errorf("manifest response missing item payload")
	}
	if err := json.Unmarshal(envelope.Item, &manifest); err != nil {
		return nil, fmt.Errorf("decode manifest item: %w", err)
	}
	return &manifest, nil
}

func looksLikeManifest(manifest *Manifest) bool {
	if manifest == nil {
		return false
	}
	return strings.TrimSpace(manifest.Version) != "" ||
		strings.TrimSpace(manifest.URL) != "" ||
		strings.TrimSpace(manifest.SHA256) != ""
}

func restartForeground(exePath string) error {
	cmd := exec.Command(exePath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()
	return cmd.Start()
}

func shouldForegroundRestart(cfg *config.Config) bool {
	if cfg == nil {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(cfg.Mode)) {
	case "foreground", "manual", "debug":
		return true
	case "auto":
		return inContainer()
	default:
		return false
	}
}

func sleepWithContext(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
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

func dedupe(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}
