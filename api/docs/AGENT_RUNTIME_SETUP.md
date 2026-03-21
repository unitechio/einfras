# Agent Runtime Setup

This document describes the active runtime layout and environment for the EINFRA agent binary.

## Runtime Layout

The agent runtime is split into:

- `api/cmd/agent`
  - binary entrypoint only
- `api/internal/platform/agentruntime/app`
  - runtime bootstrap and graceful shutdown
- `api/internal/platform/agentruntime/grpcclient`
  - gRPC stream lifecycle with the control plane
- `api/internal/platform/agentruntime/heartbeat`
  - periodic metrics push
- `api/internal/platform/agentruntime/collector`
  - local OS/runtime metrics collection
- `api/internal/platform/agentruntime/executor`
  - shell, service, and typed control operation execution
- `api/internal/platform/agentruntime/config`
  - environment loading and runtime guardrails

## Required Environment Variables

- `CONTROL_PLANE_URL`
  - control plane base URL used by the agent runtime
- `GRPC_URL`
  - gRPC endpoint used for the agent control stream
- `AGENT_TOKEN`
  - token issued by the control plane
- `SERVER_ID`
  - unique server identifier

## Optional Environment Variables

- `AGENT_VERSION`
  - default: `1.0.0`
- `HEARTBEAT_INTERVAL`
  - default: `15` seconds
- `AGENT_ALLOWED_READ_ROOTS`
  - allowlist for read operations
- `AGENT_ALLOWED_WRITE_ROOTS`
  - allowlist for write operations
- `AGENT_PLUGIN_ROOT`
  - plugin directory root
- `AGENT_MAX_READ_BYTES`
  - maximum bytes returned for file reads
- `AGENT_STREAM_CHUNK_BYTES`
  - output chunk size for streaming
- `AGENT_MAX_TAIL_LINES`
  - upper bound for log tail operations

## Example Env File

See [api/cmd/agent/.env.example](/D:/Code/EPASS/EINFRA/einfran/api/cmd/agent/.env.example).

## Runtime Flow

1. `cmd/agent/main.go` calls `agentruntime/app.Run()`.
2. The runtime loads config and creates the gRPC client.
3. Heartbeat starts with the same process context.
4. The gRPC stream reconnects until shutdown is requested.
5. Typed control operations are executed through the shared contract in `internal/modules/agent/domain`.

## Shared Typed Operation Contract

The control plane and the agent runtime now share:

- `agent.ControlOperationPayload`
- `agent.TypedControlResult`
- `agent.ControlOperationCatalog()`
- `agent.AgentAdvertisedCapabilities()`
- `agent.ParseTypedControlResult(...)`
- `agent.MarshalTypedControlResult(...)`

This avoids duplicate schema definitions between:

- control plane command polling
- agent execution results
- gRPC typed operation output handling
- policy role checks
- agent capability registration
