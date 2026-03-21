# Agent Runtime Refactor Notes

This note defines the intended boundary between `cmd/agent` and `internal/modules/agent`.

## Current State

`api/cmd/agent` currently contains:

- process bootstrap
- config loading
- heartbeat scheduling
- gRPC stream client
- command/service/control executors
- local metrics collection

This is workable, but it makes `cmd` too heavy. The package now holds real runtime logic rather than only application startup wiring.

## Recommended Boundary

Keep in `cmd/agent`:

- `main.go`
- composition/bootstrap wiring only

Move out of `cmd/agent`:

- `client/grpc_client.go`
- `executor/*`
- `collector/*`
- `heartbeat/*`
- `config/*`

## Target Layout

Option A: module-focused runtime

```text
api/internal/modules/agent/
  application/
  domain/
  infrastructure/
    grpcclient/
    collector/
    executor/
    heartbeat/
  interfaces/
```

Option B: split transport/runtime from domain module

```text
api/internal/modules/agent/
  application/
  domain/
  infrastructure/
  interfaces/

api/internal/platform/agentruntime/
  config/
  grpcclient/
  collector/
  executor/
  heartbeat/
```

## Recommendation

Prefer Option B.

Reason:

- `internal/modules/agent` should model control-plane backend concerns
- the agent binary is a separate runtime/process with its own OS-facing logic
- filesystem/package/process execution is not control-plane domain logic
- keeping runtime execution under `platform/agentruntime` avoids mixing server-side module code with node-local agent code

## gRPC Recommendation

For agent-to-control-plane communication, gRPC streaming is a good default and should remain the primary transport.

Use gRPC for:

- bidirectional control streams
- typed protobuf contracts
- backpressure-friendly task/event streaming
- lower overhead than ad hoc JSON over WebSocket for agent traffic

Keep WebSocket for:

- browser/frontend real-time updates
- development compatibility where needed

## Next Refactor Slice

The safest next move is:

1. create `api/internal/platform/agentruntime`
2. move `config`, `collector`, `heartbeat`, `executor`, and `grpc_client` there
3. leave `api/cmd/agent/main.go` as a thin bootstrap
4. keep protobuf contracts in `api/internal/modules/agent/infrastructure/grpcpb`
5. avoid moving control-plane REST/WS handlers out of `internal/modules/agent`

This keeps the backend module clean while preserving the agent binary as a first-class runtime.
