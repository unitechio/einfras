package serverhttp

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	"einfra/api/internal/platform/agentruntime/artifacts"
	"einfra/api/internal/platform/agentruntime/distribution"
	"einfra/api/internal/platform/agentruntime/installscript"
	sharedconfig "einfra/api/internal/shared/platform/config"
)

const installerVersion = "installer-v2"

type tokenIssuer interface {
	Issue(ctx context.Context, serverID string) (string, error)
}

type OnboardingHandler struct {
	issuer      tokenIssuer
	distributor *distribution.Distributor
	artifacts   sharedconfig.AgentArtifactsConfig
}

type installScriptResponse struct {
	Version           string `json:"version"`
	ServerID          string `json:"server_id"`
	ControlPlaneURL   string `json:"control_plane_url"`
	GRPCURL           string `json:"grpc_url,omitempty"`
	BinaryURL         string `json:"binary_url,omitempty"`
	UpdateManifestURL string `json:"update_manifest_url,omitempty"`
	Script            string `json:"script"`
	InstallScript     string `json:"install_script"`
	Command           string `json:"command"`
	CommandMinimal    string `json:"command_minimal,omitempty"`
	InstallURL        string `json:"install_url,omitempty"`
}

func NewOnboardingHandler(issuer tokenIssuer, distributor *distribution.Distributor, artifactsCfg sharedconfig.AgentArtifactsConfig) *OnboardingHandler {
	if distributor == nil {
		distributor = distribution.New(resolveProjectRoot())
	}
	return &OnboardingHandler{
		issuer:      issuer,
		distributor: distributor,
		artifacts:   artifactsCfg,
	}
}

func (h *OnboardingHandler) Register(r *mux.Router) {
	r.HandleFunc("/v1/servers/{id}/agent/install-script", h.getInstallScript).Methods(http.MethodPost)
	r.HandleFunc("/install.sh", h.serveInstallScript).Methods(http.MethodGet)
	r.HandleFunc("/v1/agent/binary", h.serveAgentBinary).Methods(http.MethodGet)
	r.HandleFunc("/v1/agent/manifest", h.serveAgentManifest).Methods(http.MethodGet)
}

func (h *OnboardingHandler) getInstallScript(w http.ResponseWriter, r *http.Request) {
	serverID := strings.TrimSpace(mux.Vars(r)["id"])
	if serverID == "" {
		writeError(w, http.StatusBadRequest, "agent_install_script", "agent.install_script", "server_id_required", "server_id is required", nil)
		return
	}

	token, err := h.issuer.Issue(r.Context(), serverID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "agent_install_script", "agent.install_script", "token_issue_failed", "failed to issue agent token", map[string]any{"server_id": serverID})
		return
	}

	response, err := h.buildInstallerResponse(r, serverID, token)
	if err != nil {
		writeError(w, http.StatusBadRequest, "agent_install_script", "agent.install_script", "installer_request_invalid", err.Error(), map[string]any{"server_id": serverID})
		return
	}

	log.Info().
		Str("installer_path", "server_onboarding_post").
		Str("server_id", serverID).
		Str("control_plane_url", response.ControlPlaneURL).
		Bool("installscript_rendered", true).
		Msg("agent installer generated")

	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "agent_install_script", response, nil))
}

func (h *OnboardingHandler) serveInstallScript(w http.ResponseWriter, r *http.Request) {
	serverID := strings.TrimSpace(r.URL.Query().Get("server_id"))
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if serverID == "" || token == "" {
		writeError(w, http.StatusBadRequest, "agent_install_script", "agent.install_shell", "missing_query_params", "server_id and token query params are required", nil)
		return
	}

	response, err := h.buildInstallerResponse(r, serverID, token)
	if err != nil {
		writeError(w, http.StatusBadRequest, "agent_install_script", "agent.install_shell", "installer_request_invalid", err.Error(), map[string]any{"server_id": serverID})
		return
	}

	log.Info().
		Str("installer_path", "public_install_sh").
		Str("server_id", serverID).
		Str("control_plane_url", response.ControlPlaneURL).
		Bool("installscript_rendered", true).
		Msg("agent installer shell served")

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "text/x-shellscript; charset=utf-8")
	_, _ = w.Write([]byte(response.Script))
}

func (h *OnboardingHandler) serveAgentBinary(w http.ResponseWriter, r *http.Request) {
	goos := strings.TrimSpace(r.URL.Query().Get("os"))
	goarch := strings.TrimSpace(r.URL.Query().Get("arch"))
	if goos == "" {
		goos = "linux"
	}
	if goarch == "" {
		goarch = "amd64"
	}

	log.Info().
		Str("distribution_path", "agent_binary").
		Str("os", goos).
		Str("arch", goarch).
		Msg("resolving agent binary artifact")

	path, err := h.distributor.ResolveBinary(goos, goarch)
	if err != nil {
		writeError(w, http.StatusBadRequest, "agent_binary", "agent.binary", "binary_build_failed", err.Error(), map[string]any{"os": goos, "arch": goarch})
		return
	}
	artifact, err := h.distributor.ResolveArtifact(goos, goarch)
	if err == nil {
		w.Header().Set("ETag", fmt.Sprintf(`"%s"`, artifact.SHA256))
		w.Header().Set("X-Checksum-SHA256", artifact.SHA256)
	}

	fileName := "einfra-agent"
	if goos == "windows" {
		fileName += ".exe"
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	http.ServeFile(w, r, path)
}

func (h *OnboardingHandler) serveAgentManifest(w http.ResponseWriter, r *http.Request) {
	target := artifacts.NormalizeTarget(r.URL.Query().Get("os"), r.URL.Query().Get("arch"))
	if err := artifacts.ValidateTarget(target); err != nil {
		writeError(w, http.StatusBadRequest, "agent_manifest", "agent.manifest", "unsupported_target", err.Error(), map[string]any{"os": target.OS, "arch": target.Arch})
		return
	}
	artifact, err := h.distributor.ResolveArtifact(target.OS, target.Arch)
	if err != nil {
		writeError(w, http.StatusBadRequest, "agent_manifest", "agent.manifest", "manifest_build_failed", err.Error(), map[string]any{"os": target.OS, "arch": target.Arch})
		return
	}
	manifest, err := h.buildManifest(r, artifact)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "agent_manifest", "agent.manifest", "manifest_render_failed", err.Error(), map[string]any{"os": target.OS, "arch": target.Arch})
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "agent_manifest", manifest, nil))
}

func (h *OnboardingHandler) buildInstallerResponse(r *http.Request, serverID, token string) (installScriptResponse, error) {
	controlPlaneURL, err := resolveControlPlaneURL(r)
	if err != nil {
		return installScriptResponse{}, err
	}
	grpcURL := resolveGRPCURL(r, controlPlaneURL)
	binaryURL := normalizeArtifactURL(strings.TrimSpace(firstNonEmpty(
		r.Header.Get("X-Agent-Binary-URL"),
		r.URL.Query().Get("binary_url"),
		strings.TrimRight(controlPlaneURL, "/")+"/v1/agent/binary?os=linux&arch=amd64",
	)), "/v1/agent/binary", r)
	updateManifestURL := normalizeArtifactURL(strings.TrimSpace(firstNonEmpty(
		r.Header.Get("X-Agent-Update-Manifest-URL"),
		r.URL.Query().Get("update_manifest_url"),
		strings.TrimRight(controlPlaneURL, "/")+"/v1/agent/manifest?os=linux&arch=amd64",
	)), "/v1/agent/manifest", r)

	script, err := installscript.Render(installscript.Payload{
		ServerID:          serverID,
		AgentToken:        token,
		ControlPlaneURL:   controlPlaneURL,
		GRPCURL:           grpcURL,
		BinaryURL:         binaryURL,
		UpdateManifestURL: updateManifestURL,
		UpdatePublicKey:   strings.TrimSpace(h.artifacts.SigningPublicKey),
		InstallerVersion:  installerVersion,
	})
	if err != nil {
		log.Error().
			Err(err).
			Str("server_id", serverID).
			Str("control_plane_url", controlPlaneURL).
			Msg("installscript.Render failed")
		return installScriptResponse{}, fmt.Errorf("failed to render agent install script")
	}

	installURL := buildInstallScriptURL(r, serverID, token, controlPlaneURL, binaryURL, updateManifestURL)
	command := buildInstallCommand(installURL)
	commandMinimal := buildMinimalInstallCommand(controlPlaneURL, serverID, token)
	return installScriptResponse{
		Version:           installerVersion,
		ServerID:          serverID,
		ControlPlaneURL:   controlPlaneURL,
		GRPCURL:           grpcURL,
		BinaryURL:         binaryURL,
		UpdateManifestURL: updateManifestURL,
		Script:            script,
		InstallScript:     script,
		Command:           command,
		CommandMinimal:    commandMinimal,
		InstallURL:        installURL,
	}, nil
}

func (h *OnboardingHandler) buildManifest(r *http.Request, artifact *distribution.Artifact) (artifacts.Manifest, error) {
	if artifact == nil {
		return artifacts.Manifest{}, fmt.Errorf("artifact is nil")
	}
	base := strings.TrimRight(buildExternalBaseURL(r), "/")
	if base == "" {
		return artifacts.Manifest{}, fmt.Errorf("failed to derive external base url")
	}
	binaryURL := fmt.Sprintf("%s/v1/agent/binary?os=%s&arch=%s", base, artifact.Target.OS, artifact.Target.Arch)
	manifest := artifacts.Manifest{
		Version:      strings.TrimSpace(h.artifacts.Version),
		URL:          binaryURL,
		SHA256:       artifact.SHA256,
		Channel:      strings.TrimSpace(h.artifacts.Channel),
		MinVersion:   strings.TrimSpace(h.artifacts.MinVersion),
		OS:           artifact.Target.OS,
		Arch:         artifact.Target.Arch,
		GRPCURLs:     []string{resolveGRPCURL(r, base)},
		ReleaseNotes: strings.TrimSpace(h.artifacts.ReleaseNotes),
		PublishedAt:  artifacts.TimestampNow(),
	}
	if manifest.Version == "" {
		manifest.Version = "1.0.0"
	}
	if manifest.Channel == "" {
		manifest.Channel = "stable"
	}
	if strings.TrimSpace(h.artifacts.SigningPrivateKey) != "" {
		if err := artifacts.SignManifest(&manifest, h.artifacts.SigningPrivateKey); err != nil {
			return artifacts.Manifest{}, err
		}
	}
	return manifest, nil
}

func resolveControlPlaneURL(r *http.Request) (string, error) {
	if value := strings.TrimSpace(firstNonEmpty(r.Header.Get("X-Control-Plane-URL"), r.URL.Query().Get("server"))); value != "" {
		parsed, err := url.Parse(value)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return "", fmt.Errorf("invalid control plane url %q", value)
		}
		return value, nil
	}

	scheme := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto"))
	if scheme == "" {
		if r.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}
	host := strings.TrimSpace(firstNonEmpty(r.Header.Get("X-Forwarded-Host"), r.Host))
	if host == "" {
		return "", fmt.Errorf("unable to determine control plane url from request; provide X-Control-Plane-URL or server query param")
	}
	return scheme + "://" + host, nil
}

func resolveGRPCURL(r *http.Request, controlPlaneURL string) string {
	if value := strings.TrimSpace(firstNonEmpty(r.Header.Get("X-Agent-GRPC-URL"), r.URL.Query().Get("grpc_url"))); value != "" {
		return value
	}
	parsed, err := url.Parse(controlPlaneURL)
	if err != nil || parsed.Host == "" {
		return ""
	}
	host := parsed.Hostname()
	if host == "" {
		return ""
	}
	return net.JoinHostPort(host, "50051")
}

func buildInstallScriptURL(r *http.Request, serverID, token, controlPlaneURL, binaryURL, updateManifestURL string) string {
	base := buildExternalBaseURL(r)
	if base == "" {
		return ""
	}
	query := url.Values{}
	query.Set("server_id", serverID)
	query.Set("token", token)
	query.Set("server", controlPlaneURL)
	if binaryURL != "" {
		query.Set("binary_url", binaryURL)
	}
	if updateManifestURL != "" {
		query.Set("update_manifest_url", updateManifestURL)
	}
	return strings.TrimRight(base, "/") + "/install.sh?" + query.Encode()
}

func buildExternalBaseURL(r *http.Request) string {
	scheme := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto"))
	if scheme == "" {
		if r.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}
	host := strings.TrimSpace(firstNonEmpty(r.Header.Get("X-Forwarded-Host"), r.Host))
	if host == "" {
		return ""
	}
	return scheme + "://" + host
}

func buildInstallCommand(installURL string) string {
	if installURL == "" {
		return ""
	}
	return "curl -fsSL " + shellQuote(installURL) + " | bash"
}

func buildMinimalInstallCommand(controlPlaneURL, serverID, token string) string {
	controlPlaneURL = strings.TrimSpace(controlPlaneURL)
	serverID = strings.TrimSpace(serverID)
	token = strings.TrimSpace(token)
	if controlPlaneURL == "" || serverID == "" || token == "" {
		return ""
	}
	return "curl -fsSL " + shellQuote(strings.TrimRight(controlPlaneURL, "/")+"/install.sh") +
		" | bash -s -- --server-id " + shellQuote(serverID) +
		" --token " + shellQuote(token) +
		" --server " + shellQuote(controlPlaneURL)
}

func normalizeArtifactURL(raw, defaultPath string, r *http.Request) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return raw
	}
	if parsed.Query().Get("arch") != "" && parsed.Query().Get("os") != "" {
		return parsed.String()
	}
	values := parsed.Query()
	if values.Get("os") == "" {
		values.Set("os", strings.TrimSpace(firstNonEmpty(r.URL.Query().Get("os"), "linux")))
	}
	if values.Get("arch") == "" {
		values.Set("arch", strings.TrimSpace(firstNonEmpty(r.URL.Query().Get("arch"), "amd64")))
	}
	parsed.RawQuery = values.Encode()
	if parsed.Path == "" || parsed.Path == "/" {
		parsed.Path = defaultPath
	}
	return parsed.String()
}

func shellQuote(value string) string {
	if value == "" {
		return "''"
	}
	return "'" + strings.ReplaceAll(value, "'", `'\''`) + "'"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func resolveProjectRoot() string {
	if env := strings.TrimSpace(os.Getenv("EINFRA_PROJECT_ROOT")); env != "" {
		return env
	}
	if wd, err := os.Getwd(); err == nil {
		current := wd
		for {
			if _, err := os.Stat(filepath.Join(current, "go.mod")); err == nil {
				return current
			}
			parent := filepath.Dir(current)
			if parent == current {
				break
			}
			current = parent
		}
	}
	return "."
}
