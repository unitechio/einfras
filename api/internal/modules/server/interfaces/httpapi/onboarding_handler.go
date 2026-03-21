package serverhttp

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

type tokenIssuer interface {
	Issue(ctx context.Context, serverID string) (string, error)
}

type OnboardingHandler struct {
	issuer tokenIssuer
}

func NewOnboardingHandler(issuer tokenIssuer) *OnboardingHandler {
	return &OnboardingHandler{issuer: issuer}
}

func (h *OnboardingHandler) Register(r *mux.Router) {
	r.HandleFunc("/v1/servers/{id}/agent/install-script", h.getInstallScript).Methods(http.MethodPost)
}

func (h *OnboardingHandler) getInstallScript(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	token, err := h.issuer.Issue(r.Context(), serverID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "agent_install_script", "agent.install_script", "token_issue_failed", "failed to issue agent token", map[string]any{"server_id": serverID})
		return
	}

	controlPlaneURL := strings.TrimSpace(r.Header.Get("X-Control-Plane-URL"))
	if controlPlaneURL == "" {
		controlPlaneURL = "http://localhost:8080"
	}

	script := fmt.Sprintf(`#!/usr/bin/env bash
							set -euo pipefail

							SERVER_ID="%s"
							AGENT_TOKEN="%s"
							CONTROL_PLANE_URL="%s"

							cat >/etc/systemd/system/einfra-agent.service <<EOF
							[Unit]
							Description=EINFRA Agent
							After=network.target

							[Service]
							Environment=SERVER_ID=$SERVER_ID
							Environment=AGENT_TOKEN=$AGENT_TOKEN
							Environment=CONTROL_PLANE_URL=$CONTROL_PLANE_URL
							ExecStart=/usr/local/bin/einfra-agent
							Restart=always
							RestartSec=5

							[Install]
							WantedBy=multi-user.target
							EOF

							systemctl daemon-reload
							systemctl enable --now einfra-agent
							echo "EINFRA agent installed for server $SERVER_ID"
							`, serverID, token, controlPlaneURL)

	writeJSON(w, http.StatusOK, itemEnvelope("ok", "agent_install_script", map[string]string{
		"server_id":      serverID,
		"install_script": script,
	}, nil))
}
