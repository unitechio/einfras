package serverhttp

import (
	"net/http"

	"github.com/gorilla/mux"

	agent "einfra/api/internal/modules/agent/domain"
)

type CatalogHandler struct{}

func NewCatalogHandler() *CatalogHandler {
	return &CatalogHandler{}
}

func (h *CatalogHandler) Register(r *mux.Router) {
	r.HandleFunc("/v1/catalog/control-plane", h.getControlPlaneCatalog).Methods(http.MethodGet)
	r.HandleFunc("/v1/catalog/openapi.json", h.getOpenAPISpec).Methods(http.MethodGet)
}

type controlOperationCatalogItem struct {
	Name               string   `json:"name"`
	Resource           string   `json:"resource"`
	RequiredCapability string   `json:"required_capability"`
	AllowedRoles       []string `json:"allowed_roles"`
}

func (h *CatalogHandler) getControlPlaneCatalog(w http.ResponseWriter, _ *http.Request) {
	operations := agent.ControlOperationCatalog()
	items := make([]controlOperationCatalogItem, 0, len(operations))
	for _, operation := range operations {
		items = append(items, controlOperationCatalogItem{
			Name:               operation.Name,
			Resource:           operation.Resource,
			RequiredCapability: operation.RequiredCapability(),
			AllowedRoles:       append([]string(nil), operation.AllowedRoles...),
		})
	}

	writeJSON(w, http.StatusOK, itemEnvelope("ok", "control_plane_catalog", map[string]any{
		"operations":   items,
		"capabilities": agent.AgentAdvertisedCapabilities(),
		"schemas": map[string]any{
			"http_envelope":        httpEnvelopeSchema(),
			"error_envelope":       errorEnvelopeSchema(),
			"typed_control_result": typedControlResultSchema(),
			"control_operation":    controlOperationPayloadSchema(),
		},
		"policy_metadata": map[string]any{
			"registry_source": "agent/domain/control_catalog.go",
			"group_policy_env": map[string]string{
				"policy_matrix":    "EINFRA_CONTROL_POLICY_MATRIX",
				"tenant_allowlist": "EINFRA_CONTROL_TENANT_ALLOWLIST",
				"tenant_denylist":  "EINFRA_CONTROL_TENANT_DENYLIST",
				"group_allowlist":  "EINFRA_CONTROL_GROUP_ALLOWLIST",
				"group_denylist":   "EINFRA_CONTROL_GROUP_DENYLIST",
			},
		},
	}, nil))
}

func (h *CatalogHandler) getOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}

	spec := map[string]any{
		"openapi": "3.1.0",
		"info": map[string]any{
			"title":       "EINFRA Control Plane API",
			"version":     "1.0.0",
			"description": "Generated runtime spec for control-plane catalog, envelopes, commands, and typed control operations.",
		},
		"servers": []map[string]any{
			{"url": scheme + "://" + r.Host},
		},
		"paths": map[string]any{
			"/health": map[string]any{
				"get": map[string]any{
					"summary":     "Health check",
					"operationId": "getHealth",
					"responses": map[string]any{
						"200": map[string]any{
							"description": "Healthy",
							"content": map[string]any{
								"application/json": map[string]any{
									"schema": map[string]any{
										"type": "object",
										"properties": map[string]any{
											"status":  map[string]any{"type": "string"},
											"service": map[string]any{"type": "string"},
										},
									},
								},
							},
						},
					},
				},
			},
			"/v1/catalog/control-plane": map[string]any{
				"get": map[string]any{
					"summary":     "Get control-plane catalog",
					"operationId": "getControlPlaneCatalog",
					"responses": map[string]any{
						"200": map[string]any{
							"description": "Catalog response",
							"content": map[string]any{
								"application/json": map[string]any{
									"schema": map[string]any{
										"$ref": "#/components/schemas/ControlPlaneCatalogEnvelope",
									},
								},
							},
						},
					},
				},
			},
			"/v1/catalog/openapi.json": map[string]any{
				"get": map[string]any{
					"summary":     "Get generated OpenAPI spec",
					"operationId": "getOpenAPISpec",
					"responses": map[string]any{
						"200": map[string]any{
							"description": "OpenAPI document",
						},
					},
				},
			},
			"/v1/servers/{id}/commands": map[string]any{
				"get": map[string]any{
					"summary":     "List commands for a server",
					"operationId": "listServerCommands",
					"parameters": []map[string]any{
						pathParameter("id", "Server ID"),
						queryParameter("limit", "integer", "List limit"),
					},
					"responses": map[string]any{
						"200": jsonResponse("#/components/schemas/CommandListEnvelope", "Command list"),
					},
				},
				"post": map[string]any{
					"summary":     "Create command for a server",
					"operationId": "createServerCommand",
					"parameters": []map[string]any{
						pathParameter("id", "Server ID"),
					},
					"requestBody": map[string]any{
						"required": true,
						"content": map[string]any{
							"application/json": map[string]any{
								"schema": map[string]any{
									"type": "object",
									"properties": map[string]any{
										"cmd":             map[string]any{"type": "string"},
										"timeout_sec":     map[string]any{"type": "integer"},
										"idempotency_key": map[string]any{"type": "string"},
									},
									"required": []string{"cmd"},
								},
							},
						},
					},
					"responses": map[string]any{
						"201": jsonResponse("#/components/schemas/CommandEnvelope", "Command created"),
						"400": jsonResponse("#/components/schemas/ErrorEnvelope", "Invalid request"),
						"502": jsonResponse("#/components/schemas/ErrorEnvelope", "Dispatch failed"),
					},
				},
			},
			"/v1/servers/{id}/commands/{cmd_id}": map[string]any{
				"get": map[string]any{
					"summary":     "Get command by ID",
					"operationId": "getServerCommand",
					"parameters": []map[string]any{
						pathParameter("id", "Server ID"),
						pathParameter("cmd_id", "Command ID"),
					},
					"responses": map[string]any{
						"200": jsonResponse("#/components/schemas/CommandEnvelope", "Command response"),
						"404": jsonResponse("#/components/schemas/ErrorEnvelope", "Command not found"),
					},
				},
				"delete": map[string]any{
					"summary":     "Cancel command",
					"operationId": "cancelServerCommand",
					"parameters": []map[string]any{
						pathParameter("id", "Server ID"),
						pathParameter("cmd_id", "Command ID"),
					},
					"responses": map[string]any{
						"200": jsonResponse("#/components/schemas/ActionEnvelope", "Cancel accepted"),
						"502": jsonResponse("#/components/schemas/ErrorEnvelope", "Cancel failed"),
					},
				},
			},
		},
		"components": map[string]any{
			"schemas": map[string]any{
				"HttpEnvelope":                httpEnvelopeSchema(),
				"ErrorEnvelope":               errorEnvelopeSchema(),
				"TypedControlResult":          typedControlResultSchema(),
				"ControlOperationPayload":     controlOperationPayloadSchema(),
				"ControlOperationCatalogItem": controlOperationCatalogItemSchema(),
				"ControlPlaneCatalogEnvelope": controlPlaneCatalogEnvelopeSchema(),
				"CommandResponse":             commandResponseSchema(),
				"CommandEnvelope":             itemEnvelopeSchema("command", "#/components/schemas/CommandResponse"),
				"CommandListEnvelope":         listEnvelopeSchema("command", "#/components/schemas/CommandResponse"),
				"ActionEnvelope":              actionOnlyEnvelopeSchema(),
			},
		},
	}

	writeJSON(w, http.StatusOK, spec)
}

func httpEnvelopeSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"status":   map[string]any{"type": "string"},
			"resource": map[string]any{"type": "string"},
			"action":   map[string]any{"type": "string"},
			"item":     map[string]any{"type": []string{"object", "array", "string", "number", "boolean", "null"}},
			"items":    map[string]any{"type": []string{"array", "null"}},
			"command":  map[string]any{"type": []string{"object", "null"}},
			"result":   map[string]any{"type": []string{"object", "array", "string", "number", "boolean", "null"}},
			"meta":     map[string]any{"type": []string{"object", "null"}},
			"error":    map[string]any{"$ref": "#/schemas/error_envelope/properties/error"},
		},
		"required": []string{"status"},
	}
}

func errorEnvelopeSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"status":   map[string]any{"type": "string", "const": "error"},
			"resource": map[string]any{"type": "string"},
			"action":   map[string]any{"type": "string"},
			"error": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"code":    map[string]any{"type": "string"},
					"message": map[string]any{"type": "string"},
					"details": map[string]any{"type": []string{"object", "null"}},
				},
				"required": []string{"code", "message"},
			},
		},
		"required": []string{"status", "error"},
	}
}

func typedControlResultSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"schema_version": map[string]any{"type": "string", "const": agent.TypedControlSchemaVersion},
			"operation":      map[string]any{"type": "string"},
			"status":         map[string]any{"type": "string"},
			"summary":        map[string]any{"type": "string"},
			"data":           map[string]any{"type": []string{"object", "array", "string", "number", "boolean", "null"}},
			"preview":        map[string]any{"type": "string"},
			"redactions":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"truncated":      map[string]any{"type": "boolean"},
			"meta":           map[string]any{"type": []string{"object", "null"}},
		},
		"required": []string{"schema_version", "operation", "status", "summary"},
	}
}

func controlOperationPayloadSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"command_id": map[string]any{"type": "string"},
			"operation":  map[string]any{"type": "string", "enum": agent.ControlOperationNames()},
			"timeout_s":  map[string]any{"type": "integer"},
			"params":     map[string]any{"type": "object"},
		},
		"required": []string{"operation"},
	}
}

func controlOperationCatalogItemSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"name":                map[string]any{"type": "string", "enum": agent.ControlOperationNames()},
			"resource":            map[string]any{"type": "string"},
			"required_capability": map[string]any{"type": "string"},
			"allowed_roles":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		},
		"required": []string{"name", "resource", "required_capability", "allowed_roles"},
	}
}

func controlPlaneCatalogEnvelopeSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"status":   map[string]any{"type": "string"},
			"resource": map[string]any{"type": "string"},
			"item": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"operations": map[string]any{
						"type":  "array",
						"items": map[string]any{"$ref": "#/components/schemas/ControlOperationCatalogItem"},
					},
					"capabilities": map[string]any{
						"type":  "array",
						"items": map[string]any{"type": "string"},
					},
					"schemas": map[string]any{
						"type": "object",
					},
					"policy_metadata": map[string]any{
						"type": "object",
					},
				},
				"required": []string{"operations", "capabilities", "schemas", "policy_metadata"},
			},
		},
		"required": []string{"status", "resource", "item"},
	}
}

func commandResponseSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"id":              map[string]any{"type": "string"},
			"server_id":       map[string]any{"type": "string"},
			"user_id":         map[string]any{"type": "string"},
			"idempotency_key": map[string]any{"type": "string"},
			"command_type": map[string]any{
				"type": "string",
				"enum": []string{"shell", "service_action", "control_operation"},
			},
			"command":        map[string]any{"type": "string"},
			"status":         map[string]any{"type": "string"},
			"exit_code":      map[string]any{"type": []string{"integer", "null"}},
			"timeout_sec":    map[string]any{"type": "integer"},
			"created_at":     map[string]any{"type": "string", "format": "date-time"},
			"started_at":     map[string]any{"type": []string{"string", "null"}, "format": "date-time"},
			"done_at":        map[string]any{"type": []string{"string", "null"}, "format": "date-time"},
			"output_preview": map[string]any{"type": "string"},
			"output_chunks":  map[string]any{"type": "integer"},
			"result":         map[string]any{"$ref": "#/components/schemas/TypedControlResult"},
			"raw_output":     map[string]any{"type": "string"},
		},
		"required": []string{"id", "server_id", "user_id", "command_type", "command", "status", "timeout_sec", "created_at", "output_chunks"},
	}
}

func itemEnvelopeSchema(resource, ref string) map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"status":   map[string]any{"type": "string"},
			"resource": map[string]any{"type": "string", "const": resource},
			"item":     map[string]any{"$ref": ref},
			"meta":     map[string]any{"type": []string{"object", "null"}},
		},
		"required": []string{"status", "resource", "item"},
	}
}

func listEnvelopeSchema(resource, ref string) map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"status":   map[string]any{"type": "string"},
			"resource": map[string]any{"type": "string", "const": resource},
			"items": map[string]any{
				"type":  "array",
				"items": map[string]any{"$ref": ref},
			},
			"meta": map[string]any{"type": []string{"object", "null"}},
		},
		"required": []string{"status", "resource", "items"},
	}
}

func actionOnlyEnvelopeSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"status":   map[string]any{"type": "string"},
			"resource": map[string]any{"type": "string"},
			"action":   map[string]any{"type": "string"},
			"result":   map[string]any{"type": []string{"object", "array", "string", "number", "boolean", "null"}},
			"meta":     map[string]any{"type": []string{"object", "null"}},
		},
		"required": []string{"status", "resource", "action"},
	}
}

func pathParameter(name, description string) map[string]any {
	return map[string]any{
		"name":        name,
		"in":          "path",
		"required":    true,
		"description": description,
		"schema":      map[string]any{"type": "string"},
	}
}

func queryParameter(name, schemaType, description string) map[string]any {
	return map[string]any{
		"name":        name,
		"in":          "query",
		"required":    false,
		"description": description,
		"schema":      map[string]any{"type": schemaType},
	}
}

func jsonResponse(schemaRef, description string) map[string]any {
	return map[string]any{
		"description": description,
		"content": map[string]any{
			"application/json": map[string]any{
				"schema": map[string]any{
					"$ref": schemaRef,
				},
			},
		},
	}
}
