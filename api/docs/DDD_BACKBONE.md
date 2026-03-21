# EINFRA Backend DDD Backbone

This document defines the active backend direction for the `api` workspace.

## Active bounded contexts

- `server-management`
  - Owns server inventory, runtime status views, and management-facing metrics.
- `agent-control`
  - Owns agent connection lifecycle, command dispatch, token issuance, and live telemetry.

## Current clean path

```text
cmd/api, cmd/server
  -> internal/app
    -> modules/server/application/management
    -> modules/server/infrastructure/memory
    -> modules/server/interfaces/httpapi
    -> modules/agent/application
    -> modules/agent/infrastructure/repository
    -> modules/agent/interfaces
```

## Layer responsibilities

- `domain`
  - Pure business concepts and contracts.
- `application`
  - Use cases and orchestration between domain and infrastructure.
- `infrastructure`
  - Persistence, external gateways, adapters.
- `interfaces`
  - HTTP or WebSocket transport concerns only.
- `internal/app`
  - Composition root. Wiring only, no domain logic.

## Refactor rule going forward

- New server management work should extend `modules/server/application/management`.
- New agent orchestration work should extend `modules/agent/application`.
- Do not add new business logic into `cmd/*`.
- Do not reintroduce mixed transport/business code into router bootstrap files.
- Legacy packages that do not fit this flow should be migrated or isolated incrementally.
