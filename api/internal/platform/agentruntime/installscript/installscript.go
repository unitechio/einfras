package installscript

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"
)

type Payload struct {
	ServerID          string
	AgentToken        string
	ControlPlaneURL   string
	GRPCURL           string
	BinaryURL         string
	ConfigPath        string
	EnvPath           string
	BinaryPath        string
	ServiceName       string
	LogFilePath       string
	UpdateManifestURL string
	UpdatePublicKey   string
	InstallerVersion  string
}

func Render(payload Payload) (string, error) {
	payload = normalize(payload)
	tpl, err := template.New("install-script").Parse(scriptTemplate)
	if err != nil {
		return "", fmt.Errorf("parse install script template: %w", err)
	}
	var out bytes.Buffer
	if err := tpl.Execute(&out, payload); err != nil {
		return "", fmt.Errorf("render install script: %w", err)
	}
	return out.String(), nil
}

func normalize(payload Payload) Payload {
	if strings.TrimSpace(payload.ConfigPath) == "" {
		payload.ConfigPath = "/etc/einfra-agent/config.yaml"
	}
	if strings.TrimSpace(payload.EnvPath) == "" {
		payload.EnvPath = "/etc/einfra-agent/agent.env"
	}
	if strings.TrimSpace(payload.BinaryPath) == "" {
		payload.BinaryPath = "/usr/local/bin/einfra-agent"
	}
	if strings.TrimSpace(payload.ServiceName) == "" {
		payload.ServiceName = "einfra-agent"
	}
	if strings.TrimSpace(payload.LogFilePath) == "" {
		payload.LogFilePath = "/var/log/einfra-agent/agent.log"
	}
	if strings.TrimSpace(payload.BinaryURL) == "" && strings.TrimSpace(payload.ControlPlaneURL) != "" {
		payload.BinaryURL = strings.TrimRight(strings.TrimSpace(payload.ControlPlaneURL), "/") + "/v1/agent/binary?os=linux&arch=amd64"
	}
	if strings.TrimSpace(payload.InstallerVersion) == "" {
		payload.InstallerVersion = "installer-v2"
	}
	return payload
}

const scriptTemplate = `#!/usr/bin/env bash
set -eu

SERVER_ID_DEFAULT='{{ .ServerID }}'
AGENT_TOKEN_DEFAULT='{{ .AgentToken }}'
CONTROL_PLANE_URL_DEFAULT='{{ .ControlPlaneURL }}'
GRPC_URL_DEFAULT='{{ .GRPCURL }}'
BINARY_URL_DEFAULT='{{ .BinaryURL }}'
BINARY_PATH='{{ .BinaryPath }}'
CONFIG_PATH='{{ .ConfigPath }}'
ENV_PATH='{{ .EnvPath }}'
SERVICE_NAME='{{ .ServiceName }}'
LOG_FILE_PATH='{{ .LogFilePath }}'
UPDATE_MANIFEST_URL_DEFAULT='{{ .UpdateManifestURL }}'
UPDATE_PUBLIC_KEY_DEFAULT='{{ .UpdatePublicKey }}'
INSTALLER_VERSION='{{ .InstallerVersion }}'

MODE='auto'
SERVER_ID="${SERVER_ID_DEFAULT}"
AGENT_TOKEN="${AGENT_TOKEN_DEFAULT}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL_DEFAULT}"
GRPC_URL="${GRPC_URL_DEFAULT}"
BINARY_URL="${BINARY_URL_DEFAULT}"
UPDATE_MANIFEST_URL="${UPDATE_MANIFEST_URL_DEFAULT}"
UPDATE_PUBLIC_KEY="${UPDATE_PUBLIC_KEY_DEFAULT}"
VERBOSE='false'

usage() {
  cat <<'USAGE'
Usage:
  install.sh --server-id <uuid> --token <token> --server <control-plane-url> [--grpc-url host:port] [--binary-url url] [--mode auto|systemd|foreground|manual] [--verbose]

Example:
  curl -fsSL install.sh | bash -s -- \
    --server-id xxx \
    --token yyy \
    --server http://10.0.0.1:8080
USAGE
}

log() {
  printf '[einfra-install] %s\n' "$*"
}

debug() {
  if [ "${VERBOSE}" = 'true' ]; then
    printf '[einfra-install][debug] %s\n' "$*"
  fi
}

fail() {
  printf '[einfra-install][error] %s\n' "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

detect_docker() {
  if [ -f '/.dockerenv' ]; then
    return 0
  fi
  if [ -r '/proc/1/cgroup' ] && grep -Eq '(docker|containerd|kubepods|podman)' /proc/1/cgroup 2>/dev/null; then
    return 0
  fi
  return 1
}

has_systemd() {
  if ! command_exists systemctl; then
    return 1
  fi
  if [ ! -d '/run/systemd/system' ]; then
    return 1
  fi
  return 0
}

validate_token() {
  [ -n "${AGENT_TOKEN}" ] || fail 'AGENT_TOKEN is required'
  case "${AGENT_TOKEN}" in
    *" "*|*"\t"*|*"\n"*) fail 'AGENT_TOKEN must not contain whitespace' ;;
  esac
  [ "${#AGENT_TOKEN}" -ge 16 ] || fail 'AGENT_TOKEN appears too short'
}

validate_url() {
  case "$1" in
    http://*|https://*) return 0 ;;
    *) fail "invalid URL: $1" ;;
  esac
}

retry_download() {
  url="$1"
  destination="$2"
  attempt=1
  delay=1
  while [ "${attempt}" -le 3 ]; do
    if command_exists curl; then
      if curl -fsSL --connect-timeout 10 --retry 0 "${url}" -o "${destination}"; then
        return 0
      fi
    elif command_exists wget; then
      if wget -qO "${destination}" "${url}"; then
        return 0
      fi
    else
      fail 'curl or wget is required to download the agent binary'
    fi
    if [ "${attempt}" -lt 3 ]; then
      log "binary download attempt ${attempt} failed; retrying in ${delay}s"
      sleep "${delay}"
      delay=$((delay * 2))
    fi
    attempt=$((attempt + 1))
  done
  return 1
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --server-id) SERVER_ID="$2"; shift 2 ;;
      --token) AGENT_TOKEN="$2"; shift 2 ;;
      --server|--control-plane-url) CONTROL_PLANE_URL="$2"; shift 2 ;;
      --grpc-url) GRPC_URL="$2"; shift 2 ;;
      --binary-url) BINARY_URL="$2"; shift 2 ;;
      --update-manifest-url) UPDATE_MANIFEST_URL="$2"; shift 2 ;;
      --update-public-key) UPDATE_PUBLIC_KEY="$2"; shift 2 ;;
      --mode) MODE="$2"; shift 2 ;;
      --verbose) VERBOSE='true'; shift ;;
      --help|-h) usage; exit 0 ;;
      *) fail "unknown argument: $1" ;;
    esac
  done
}

ensure_grpc_url() {
  if [ -n "${GRPC_URL}" ]; then
    return 0
  fi
  host_part="${CONTROL_PLANE_URL#*://}"
  host_part="${host_part%%/*}"
  host_part="${host_part%%:*}"
  [ -n "${host_part}" ] || fail 'failed to derive gRPC host from CONTROL_PLANE_URL'
  GRPC_URL="${host_part}:50051"
}

ensure_dirs() {
  mkdir -p "$(dirname "${CONFIG_PATH}")" "$(dirname "${ENV_PATH}")" "$(dirname "${LOG_FILE_PATH}")"
}

download_agent() {
  if [ -x "${BINARY_PATH}" ]; then
    debug "agent binary already present at ${BINARY_PATH}"
    return 0
  fi
  [ -n "${BINARY_URL}" ] || BINARY_URL="${CONTROL_PLANE_URL%/}/v1/agent/binary?os=linux&arch=amd64"
  validate_url "${BINARY_URL}"
  log "downloading agent binary from ${BINARY_URL}"
  tmp_file="${BINARY_PATH}.tmp.$$"
  if ! retry_download "${BINARY_URL}" "${tmp_file}"; then
    fail "failed to download agent binary from ${BINARY_URL} after 3 attempts"
  fi
  # Placeholder for future signed checksum verification.
  if [ -n "${AGENT_BINARY_SHA256:-}" ]; then
    debug "AGENT_BINARY_SHA256 provided; checksum verification hook reserved for future use"
  fi
  chmod 0755 "${tmp_file}"
  mv "${tmp_file}" "${BINARY_PATH}"
}

check_connectivity() {
  health_url="${CONTROL_PLANE_URL%/}/health"
  log "checking control plane reachability via ${health_url}"
  if command_exists curl; then
    curl -fsS --max-time 5 "${health_url}" >/dev/null 2>&1 && return 0
  elif command_exists wget; then
    wget -qO- --timeout=5 "${health_url}" >/dev/null 2>&1 && return 0
  fi
  log "health check did not succeed; continuing because control plane may be warming up"
  return 0
}

write_env_file() {
  umask 077
  cat >"${ENV_PATH}" <<EOF
SERVER_ID=${SERVER_ID}
AGENT_TOKEN=${AGENT_TOKEN}
CONTROL_PLANE_URL=${CONTROL_PLANE_URL}
GRPC_URL=${GRPC_URL}
AGENT_LOG_FILE=${LOG_FILE_PATH}
AGENT_UPDATE_MANIFEST_URL=${UPDATE_MANIFEST_URL}
AGENT_UPDATE_PUBLIC_KEY=${UPDATE_PUBLIC_KEY}
EOF
}

write_config_file() {
  umask 077
  cat >"${CONFIG_PATH}" <<EOF
server_id: "${SERVER_ID}"
agent_token: "${AGENT_TOKEN}"
control_plane_urls:
  - "${CONTROL_PLANE_URL}"
grpc_urls:
  - "${GRPC_URL}"
log_file_path: "${LOG_FILE_PATH}"
update_manifest_url: "${UPDATE_MANIFEST_URL}"
update_public_key: "${UPDATE_PUBLIC_KEY}"
heartbeat_interval_sec: 15
connect_timeout_sec: 10
health_check_timeout_sec: 5
backoff_initial_sec: 2
backoff_max_sec: 60
update_check_interval_sec: 1800
update_channel: "stable"
EOF
}

write_systemd_unit() {
  service_path="/etc/systemd/system/${SERVICE_NAME}.service"
  cat >"${service_path}" <<EOF
[Unit]
Description=EINFRA Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_PATH}
ExecStart=${BINARY_PATH}
Restart=always
RestartSec=5
StartLimitIntervalSec=0
User=root
WorkingDirectory=/var/lib/einfra-agent
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  mkdir -p /var/lib/einfra-agent
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1 || true
  systemctl restart "${SERVICE_NAME}"
  log "systemd service ${SERVICE_NAME} installed"
}

run_foreground() {
  log "starting agent in foreground mode"
  exec env \
    SERVER_ID="${SERVER_ID}" \
    AGENT_TOKEN="${AGENT_TOKEN}" \
    CONTROL_PLANE_URL="${CONTROL_PLANE_URL}" \
    GRPC_URL="${GRPC_URL}" \
    AGENT_LOG_FILE="${LOG_FILE_PATH}" \
    AGENT_UPDATE_MANIFEST_URL="${UPDATE_MANIFEST_URL}" \
    AGENT_UPDATE_PUBLIC_KEY="${UPDATE_PUBLIC_KEY}" \
    "${BINARY_PATH}"
}

main() {
  parse_args "$@"

  echo "EINFRA_INSTALLER_VERSION=v2"
  [ -n "${SERVER_ID}" ] || fail 'SERVER_ID is required'
  validate_token
  validate_url "${CONTROL_PLANE_URL}"
  ensure_grpc_url
  ensure_dirs
  download_agent
  check_connectivity
  write_env_file
  write_config_file

  if [ "${MODE}" = 'systemd' ]; then
    has_systemd || fail 'systemd requested but not available'
    write_systemd_unit
    exit 0
  fi

  if [ "${MODE}" = 'foreground' ] || [ "${MODE}" = 'manual' ]; then
    run_foreground
  fi

  if detect_docker; then
    log 'docker/container environment detected; using foreground mode'
    run_foreground
  fi

  if has_systemd; then
    write_systemd_unit
    exit 0
  fi

  log 'systemd not available; using foreground mode'
  run_foreground
}

main "$@"
`
