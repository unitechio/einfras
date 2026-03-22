# Agent Install And Runtime

## Goals

The EINFRA agent now supports three execution modes from one install script:

- `systemd`: production Linux VM / bare metal
- `foreground`: Docker / container / no-systemd environments
- `manual`: debug mode with direct foreground execution

The generated installer is returned by:

- `POST /v1/servers/{id}/agent/install-script`

## Installer behavior

The install script:

- accepts `--server-id`, `--token`, `--server`
- optionally accepts `--grpc-url`, `--binary-url`, `--mode`, `--verbose`
- detects Docker with `/.dockerenv` and `/proc/1/cgroup`
- detects systemd with `systemctl` plus `/run/systemd/system`
- writes:
  - `/etc/einfra-agent/agent.env`
  - `/etc/einfra-agent/config.yaml`
- avoids passing the token on the process list by using env/config files
- validates control plane URL and token shape
- checks `${CONTROL_PLANE_URL}/health` before starting
- safely re-runs by rewriting the same config and service files

## Runtime config

The agent runtime supports:

- `CONTROL_PLANE_URL` or `CONTROL_PLANE_URLS`
- `GRPC_URL` or `GRPC_URLS`
- config file fallback via `EINFRA_AGENT_CONFIG_FILE`
- automatic gRPC target derivation from control plane host to `:50051`
- exponential reconnect backoff with jitter
- structured logs to stdout and file

Important envs:

- `SERVER_ID`
- `AGENT_TOKEN`
- `CONTROL_PLANE_URL`
- `GRPC_URL`
- `AGENT_LOG_FILE`
- `AGENT_BACKOFF_INITIAL`
- `AGENT_BACKOFF_MAX`
- `AGENT_HEALTH_CHECK_TIMEOUT`

See:

- `api/cmd/agent/.env.example`

## Production notes

- Do not use `localhost` unless the agent and API/gRPC endpoints run on the same host.
- For Docker Desktop, prefer a routable address or `host.docker.internal` when appropriate.
- For NAT/private networks, pass the reachable control-plane address with `--server`.
- For HA control planes, use `CONTROL_PLANE_URLS` and `GRPC_URLS`.

## gRPC control plane

The agent still uses gRPC bidi streaming for control-plane connectivity. On each successful connect it:

- authenticates with server ID + bearer token metadata
- auto-registers capabilities
- resumes heartbeat publishing
- reconnects with exponential backoff on transient failures

## Current scope

Implemented:

- multi-mode installer
- systemd unit generation
- Docker/manual foreground fallback
- config file support
- structured logging
- preflight reachability checks
- reconnect with failover-ready target list
- background auto-update manifest polling
- tenant/group policy enforcement inside the agent executor

Current auto-update manifest shape:

```json
{
  "version": "1.2.0",
  "url": "https://downloads.example.com/einfra-agent-linux-amd64",
  "sha256": "optional-hex-checksum",
  "channel": "stable",
  "min_version": "1.0.0"
}
```

Relevant envs:

- `AGENT_UPDATE_MANIFEST_URL`
- `AGENT_UPDATE_CHECK_INTERVAL`
- `AGENT_UPDATE_CHANNEL`
- `EINFRA_AGENT_TENANT_ALLOWLIST`
- `EINFRA_AGENT_TENANT_DENYLIST`
- `EINFRA_AGENT_GROUP_ALLOWLIST`
- `EINFRA_AGENT_GROUP_DENYLIST`
- `EINFRA_AGENT_POLICY_MATRIX`

Not yet fully implemented:

- signed update verification beyond optional SHA256
- artifact publishing endpoint on the control plane
- hot in-process binary handoff without supervisor restart
