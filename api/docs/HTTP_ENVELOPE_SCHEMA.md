# HTTP Envelope Schema

This document defines the normalized HTTP response schema used by the active `server` and `agent` backend modules.

## Goal

All HTTP endpoints should return a consistent envelope for both success and failure so frontend clients can:

- parse a single top-level shape
- read metadata consistently
- avoid endpoint-specific error parsing
- consume async command/action responses in the same way as CRUD/list responses

## Success Envelope

```json
{
  "status": "ok",
  "resource": "server",
  "action": "server.get",
  "item": {},
  "items": [],
  "command": {},
  "result": {},
  "meta": {}
}
```

Fields:

- `status`: logical status such as `ok`, `created`, `updated`, `deleted`, `accepted`
- `resource`: normalized resource name such as `server`, `command`, `backup`, `cronjob`
- `action`: optional action name such as `server.update`, `backup.restore`, `command.cancel`
- `item`: single resource payload
- `items`: list payload
- `command`: async command metadata when a request schedules work through the agent/control plane
- `result`: action result payload or secondary object tied to the action
- `meta`: pagination, filters, limits, counts, or extra context

Only the relevant payload fields should be populated for a given endpoint.

## Error Envelope

```json
{
  "status": "error",
  "resource": "command",
  "action": "command.create",
  "error": {
    "code": "dispatch_failed",
    "message": "agent is offline",
    "details": {
      "server_id": "srv_123"
    }
  }
}
```

Fields:

- `status`: always `error`
- `resource`: resource related to the failure
- `action`: action being attempted when the failure occurred
- `error.code`: stable machine-readable code
- `error.message`: human-readable message
- `error.details`: optional structured context for frontend/debugging/audit correlation

## Resource Patterns

### Single item

```json
{
  "status": "ok",
  "resource": "server",
  "item": {
    "id": "srv_123",
    "name": "prod-api-01"
  }
}
```

### List with pagination

```json
{
  "status": "ok",
  "resource": "backup",
  "items": [],
  "meta": {
    "total": 25,
    "page": 1,
    "page_size": 20
  }
}
```

### Async action accepted

```json
{
  "status": "accepted",
  "resource": "file",
  "action": "file.read",
  "command": {
    "id": "cmd_123",
    "command_type": "control_operation",
    "status": "queued"
  }
}
```

### Delete completed

```json
{
  "status": "deleted",
  "resource": "cronjob",
  "action": "cronjob.delete",
  "result": {
    "id": "cron_123"
  }
}
```

## Command Polling Result

Command polling follows the same envelope:

```json
{
  "status": "ok",
  "resource": "command",
  "item": {
    "id": "cmd_123",
    "command_type": "control_operation",
    "status": "done",
    "result": {
      "schema_version": "typed-control/v1",
      "operation": "file.read",
      "status": "success",
      "summary": "file content loaded",
      "data": {},
      "preview": "..."
    }
  }
}
```

## Naming Rules

- use singular `resource` names for both item and list responses
- use dotted `action` names such as `server.create`, `config.write`, `command.cancel`
- keep `error.code` stable and machine-friendly
- put filters, pagination, limits, and counts under `meta`
- do not return raw top-level `error` strings outside the envelope

## Current Scope

This envelope is currently the active contract for:

- `server` HTTP handlers under `api/internal/modules/server/interfaces/httpapi`
- `agent` HTTP handlers under `api/internal/modules/agent/interfaces`

WebSocket and gRPC messages use transport-specific envelopes and are not covered by this document.

## Runtime Catalog Endpoint

Frontend clients can fetch the active control-plane catalog from:

- `GET /v1/catalog/control-plane`
- `GET /v1/catalog/openapi.json`

The response includes:

- `operations`
  - operation name
  - resource
  - required capability
  - allowed roles
- `capabilities`
  - agent capability catalog derived from the shared registry
- `schemas`
  - `http_envelope`
  - `error_envelope`
  - `typed_control_result`
  - `control_operation`
- `policy_metadata`
  - environment keys used for policy matrix and allow/deny controls

The generated OpenAPI document is intentionally minimal and runtime-derived. It is designed for:

- frontend client generation bootstrap
- API explorer import
- schema discovery without hardcoding operation metadata
