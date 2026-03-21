package managementapp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

type ControlManager struct {
	servers             domain.ServerRepository
	dispatcher          AgentCommandDispatcher
	audit               *ObservabilityManager
	agents              AgentInfoReader
	tenantAllowlist     map[string]struct{}
	tenantDenylist      map[string]struct{}
	groupAllowlist      map[string]struct{}
	groupDenylist       map[string]struct{}
	groupOperationRoles map[string]map[string]map[string]struct{}
}

func NewControlManager(servers domain.ServerRepository, dispatcher AgentCommandDispatcher, audit *ObservabilityManager, agents AgentInfoReader) *ControlManager {
	return &ControlManager{
		servers:             servers,
		dispatcher:          dispatcher,
		audit:               audit,
		agents:              agents,
		tenantAllowlist:     parsePolicyCSV(os.Getenv("EINFRA_CONTROL_TENANT_ALLOWLIST")),
		tenantDenylist:      parsePolicyCSV(os.Getenv("EINFRA_CONTROL_TENANT_DENYLIST")),
		groupAllowlist:      parsePolicyCSV(os.Getenv("EINFRA_CONTROL_GROUP_ALLOWLIST")),
		groupDenylist:       parsePolicyCSV(os.Getenv("EINFRA_CONTROL_GROUP_DENYLIST")),
		groupOperationRoles: parsePolicyMatrix(os.Getenv("EINFRA_CONTROL_POLICY_MATRIX")),
	}
}

func (m *ControlManager) FileRead(ctx context.Context, serverID, userID, filePath string, lines int) (*agent.Command, error) {
	if lines <= 0 {
		lines = 200
	}
	return m.dispatchOperation(ctx, serverID, userID, "file.read", "file", filePath, map[string]any{
		"path":  filePath,
		"lines": lines,
	}, 120, "file-read:"+serverID+":"+filePath)
}

func (m *ControlManager) FileList(ctx context.Context, serverID, userID, dirPath string, depth int) (*agent.Command, error) {
	if depth <= 0 {
		depth = 2
	}
	return m.dispatchOperation(ctx, serverID, userID, "file.list", "directory", dirPath, map[string]any{
		"path":  dirPath,
		"depth": depth,
	}, 180, "file-list:"+serverID+":"+dirPath)
}

func (m *ControlManager) FileWrite(ctx context.Context, serverID, userID, filePath, content string) (*agent.Command, error) {
	return m.dispatchOperation(ctx, serverID, userID, "file.write", "file", filePath, map[string]any{
		"path":    filePath,
		"content": content,
	}, 180, "file-write:"+serverID+":"+filePath)
}

func (m *ControlManager) FileChmod(ctx context.Context, serverID, userID, filePath, mode string) (*agent.Command, error) {
	return m.dispatchOperation(ctx, serverID, userID, "file.chmod", "file", filePath, map[string]any{
		"path": filePath,
		"mode": mode,
	}, 60, "file-chmod:"+serverID+":"+filePath)
}

func (m *ControlManager) Terminal(ctx context.Context, serverID, userID, command string, timeoutSec int) (*agent.Command, error) {
	return m.dispatch(ctx, serverID, userID, "terminal.exec", "", command, defaultTimeout(timeoutSec, 600), "terminal:"+uuid.NewString())
}

func (m *ControlManager) ProcessAction(ctx context.Context, serverID, userID string, pid int, signal string) (*agent.Command, error) {
	return m.dispatchOperation(ctx, serverID, userID, "process.signal", "process", fmt.Sprintf("%d", pid), map[string]any{
		"pid":    pid,
		"signal": signal,
	}, 60, fmt.Sprintf("process-signal:%s:%d:%s", serverID, pid, signal))
}

func (m *ControlManager) PackageAction(ctx context.Context, serverID, userID, action, packageName string) (*agent.Command, error) {
	action = strings.ToLower(strings.TrimSpace(action))
	packageName = strings.TrimSpace(packageName)
	if packageName == "" {
		return nil, errors.New("package_name is required")
	}
	return m.dispatchOperation(ctx, serverID, userID, "package."+action, "package", packageName, map[string]any{
		"action":       action,
		"package_name": packageName,
	}, 1800, fmt.Sprintf("package:%s:%s:%s", serverID, action, packageName))
}

func (m *ControlManager) TailLog(ctx context.Context, serverID, userID, logPath string, lines int) (*agent.Command, error) {
	if lines <= 0 {
		lines = 200
	}
	return m.dispatchOperation(ctx, serverID, userID, "log.tail", "log_file", logPath, map[string]any{
		"path":  logPath,
		"lines": lines,
	}, 120, "log-tail:"+serverID+":"+logPath)
}

func (m *ControlManager) AccessAction(ctx context.Context, serverID, userID, action, target, payload string) (*agent.Command, error) {
	switch action {
	case "list-users":
	case "list-ssh-keys":
	case "add-ssh-key":
	default:
		return nil, fmt.Errorf("unsupported access action %q", action)
	}
	return m.dispatchOperation(ctx, serverID, userID, "access."+action, "access", target, map[string]any{
		"action":  action,
		"target":  target,
		"payload": payload,
	}, 180, fmt.Sprintf("access:%s:%s:%s", serverID, action, target))
}

func (m *ControlManager) ConfigAction(ctx context.Context, serverID, userID, action, target, payload string) (*agent.Command, error) {
	switch action {
	case "read":
	case "write":
	case "list-env":
	default:
		return nil, fmt.Errorf("unsupported config action %q", action)
	}
	return m.dispatchOperation(ctx, serverID, userID, "config."+action, "config", target, map[string]any{
		"action":  action,
		"target":  target,
		"payload": payload,
	}, 180, fmt.Sprintf("config:%s:%s:%s", serverID, action, target))
}

func (m *ControlManager) PluginAction(ctx context.Context, serverID, userID, action, target string) (*agent.Command, error) {
	switch action {
	case "list":
	case "enable":
	case "disable":
	case "capabilities":
	default:
		return nil, fmt.Errorf("unsupported plugin action %q", action)
	}
	return m.dispatchOperation(ctx, serverID, userID, "plugin."+action, "plugin", target, map[string]any{
		"action": action,
		"target": target,
	}, 180, fmt.Sprintf("plugin:%s:%s:%s", serverID, action, target))
}

func (m *ControlManager) dispatch(ctx context.Context, serverID, userID, action, resourceID, command string, timeoutSec int, idempotencyKey string) (*agent.Command, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	cmd, err := m.dispatcher.Dispatch(ctx, serverID, userID, command, timeoutSec, idempotencyKey)
	status := "accepted"
	details := command
	if err != nil {
		status = "failed"
		details = err.Error()
	}
	if m.audit != nil {
		_ = m.audit.Audit(ctx, &domain.ServerAuditLog{
			ID:           uuid.NewString(),
			ServerID:     serverID,
			ActorID:      userID,
			Action:       action,
			ResourceType: strings.Split(action, ".")[0],
			ResourceID:   resourceID,
			Status:       status,
			Details:      details,
			CreatedAt:    time.Now().UTC(),
		})
	}
	return cmd, err
}

func (m *ControlManager) dispatchOperation(ctx context.Context, serverID, userID, action, resourceType, resourceID string, params map[string]any, timeoutSec int, idempotencyKey string) (*agent.Command, error) {
	server, err := m.servers.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	requiredCapability, policyDecision, policyReason, err := m.authorizeOperation(ctx, server, action)
	if err != nil {
		m.writeAudit(ctx, server, userID, ActorRoleFromContext(ctx), action, resourceType, resourceID, "denied", policyDecision, policyReason, requiredCapability, params, err.Error())
		return nil, err
	}
	cmd, err := m.dispatcher.DispatchOperation(ctx, serverID, userID, action, params, timeoutSec, idempotencyKey)
	status := "accepted"
	details := action
	if err != nil {
		status = "failed"
		details = err.Error()
	}
	m.writeAudit(ctx, server, userID, ActorRoleFromContext(ctx), action, resourceType, resourceID, status, policyDecision, policyReason, requiredCapability, params, details)
	return cmd, err
}

func (m *ControlManager) authorizeOperation(ctx context.Context, server *domain.Server, action string) (string, string, string, error) {
	role := ActorRoleFromContext(ctx)
	definition, ok := agent.LookupControlOperation(action)
	if !ok {
		return action, "operation_unknown", "operation is not registered", fmt.Errorf("unsupported control operation %q", action)
	}
	if !containsString(definition.AllowedRoles, role) {
		return action, "role_denied", "role not permitted", fmt.Errorf("role %q is not allowed to execute %s", role, action)
	}
	if decision, reason, err := m.evaluatePolicyMatrix(server, action, role); err != nil {
		return action, decision, reason, err
	}
	if err := m.evaluateTenantAndGroups(server); err != nil {
		return action, "scope_denied", err.Error(), err
	}
	if m.agents == nil {
		return action, "allowed", "role allowed without agent capability check", nil
	}
	info, err := m.agents.GetByServerID(server.ID)
	if err != nil {
		return action, "capability_unknown", "agent info unavailable", fmt.Errorf("agent info unavailable for capability check: %w", err)
	}
	requiredCapability := definition.RequiredCapability()
	if !containsString(info.Capabilities, requiredCapability) && !containsString(info.Capabilities, "control-operation") {
		return requiredCapability, "capability_denied", "agent capability missing", fmt.Errorf("agent does not advertise capability %q", requiredCapability)
	}
	return requiredCapability, "allowed", "role and scope allowed", nil
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if strings.EqualFold(strings.TrimSpace(item), strings.TrimSpace(target)) {
			return true
		}
	}
	return false
}

func (m *ControlManager) evaluateTenantAndGroups(server *domain.Server) error {
	if len(m.tenantDenylist) > 0 {
		if _, found := m.tenantDenylist[strings.ToLower(strings.TrimSpace(server.TenantID))]; found {
			return fmt.Errorf("tenant %q is denied by control policy", server.TenantID)
		}
	}
	if len(m.tenantAllowlist) > 0 {
		if _, found := m.tenantAllowlist[strings.ToLower(strings.TrimSpace(server.TenantID))]; !found {
			return fmt.Errorf("tenant %q is not in control allowlist", server.TenantID)
		}
	}
	for _, tag := range server.Tags {
		tagKey := strings.ToLower(strings.TrimSpace(tag))
		if _, found := m.groupDenylist[tagKey]; found {
			return fmt.Errorf("server group %q is denied by control policy", tag)
		}
	}
	if len(m.groupAllowlist) > 0 {
		for _, tag := range server.Tags {
			if _, found := m.groupAllowlist[strings.ToLower(strings.TrimSpace(tag))]; found {
				return nil
			}
		}
		return fmt.Errorf("server groups %v are not in control allowlist", server.Tags)
	}
	return nil
}

func parsePolicyCSV(value string) map[string]struct{} {
	items := make(map[string]struct{})
	for _, part := range strings.Split(value, ",") {
		part = strings.ToLower(strings.TrimSpace(part))
		if part != "" {
			items[part] = struct{}{}
		}
	}
	return items
}

func parsePolicyMatrix(value string) map[string]map[string]map[string]struct{} {
	matrix := make(map[string]map[string]map[string]struct{})
	if strings.TrimSpace(value) == "" {
		return matrix
	}
	var raw map[string]map[string][]string
	if err := json.Unmarshal([]byte(value), &raw); err != nil {
		return matrix
	}
	for group, operations := range raw {
		groupKey := strings.ToLower(strings.TrimSpace(group))
		if groupKey == "" {
			continue
		}
		matrix[groupKey] = make(map[string]map[string]struct{})
		for operation, roles := range operations {
			opKey := strings.ToLower(strings.TrimSpace(operation))
			if opKey == "" {
				continue
			}
			matrix[groupKey][opKey] = make(map[string]struct{})
			for _, role := range roles {
				roleKey := strings.ToLower(strings.TrimSpace(role))
				if roleKey != "" {
					matrix[groupKey][opKey][roleKey] = struct{}{}
				}
			}
		}
	}
	return matrix
}

func (m *ControlManager) evaluatePolicyMatrix(server *domain.Server, action, role string) (string, string, error) {
	if len(m.groupOperationRoles) == 0 {
		return "allowed", "no policy matrix configured", nil
	}
	action = strings.ToLower(strings.TrimSpace(action))
	role = strings.ToLower(strings.TrimSpace(role))
	for _, tag := range server.Tags {
		groupKey := strings.ToLower(strings.TrimSpace(tag))
		operations, ok := m.groupOperationRoles[groupKey]
		if !ok {
			continue
		}
		roles, ok := operations[action]
		if !ok {
			continue
		}
		if _, allowed := roles[role]; allowed {
			return "allowed", fmt.Sprintf("policy matrix allowed via group %q", tag), nil
		}
		return "matrix_denied", fmt.Sprintf("role %q is not allowed for %s in group %q", role, action, tag), fmt.Errorf("role %q is not allowed for %s in group %q", role, action, tag)
	}
	return "allowed", "no group-specific policy matched", nil
}

func (m *ControlManager) writeAudit(ctx context.Context, server *domain.Server, userID, role, action, resourceType, resourceID, status, policyDecision, policyReason, requiredCapability string, params map[string]any, details string) {
	if m.audit == nil || server == nil {
		return
	}
	safeParams := sanitizeAuditParams(params)
	rawParams, _ := json.Marshal(safeParams)
	_ = m.audit.Audit(ctx, &domain.ServerAuditLog{
		ID:                  uuid.NewString(),
		ServerID:            server.ID,
		TenantID:            server.TenantID,
		ServerGroups:        append([]string(nil), server.Tags...),
		ActorID:             userID,
		ActorRole:           role,
		Action:              action,
		ResourceType:        resourceType,
		ResourceID:          resourceID,
		Status:              status,
		PolicyDecision:      policyDecision,
		PolicyReason:        policyReason,
		RequiredCapability:  requiredCapability,
		OperationParamsJSON: string(rawParams),
		Details:             details,
		CreatedAt:           time.Now().UTC(),
	})
}

func sanitizeAuditParams(params map[string]any) map[string]any {
	if len(params) == 0 {
		return nil
	}
	out := make(map[string]any, len(params))
	for key, value := range params {
		lowerKey := strings.ToLower(key)
		switch {
		case strings.Contains(lowerKey, "content"),
			strings.Contains(lowerKey, "payload"),
			strings.Contains(lowerKey, "secret"),
			strings.Contains(lowerKey, "token"),
			strings.Contains(lowerKey, "password"),
			strings.Contains(lowerKey, "key"):
			out[key] = "<redacted>"
		default:
			out[key] = value
		}
	}
	return out
}
