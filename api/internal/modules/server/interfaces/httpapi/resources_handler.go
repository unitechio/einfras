package serverhttp

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"

	managementapp "einfra/api/internal/modules/server/application/management"
	domain "einfra/api/internal/modules/server/domain"
)

type ResourcesHandler struct {
	services      *managementapp.ServiceManager
	networks      *managementapp.NetworkManager
	firewall      *managementapp.FirewallManager
	backups       *managementapp.BackupManager
	cronjobs      *managementapp.CronManager
	storage       *managementapp.StorageManager
	observability *managementapp.ObservabilityManager
	control       *managementapp.ControlManager
}

func NewResourcesHandler(
	services *managementapp.ServiceManager,
	networks *managementapp.NetworkManager,
	firewall *managementapp.FirewallManager,
	backups *managementapp.BackupManager,
	cronjobs *managementapp.CronManager,
	storage *managementapp.StorageManager,
	observability *managementapp.ObservabilityManager,
	control *managementapp.ControlManager,
) *ResourcesHandler {
	return &ResourcesHandler{
		services:      services,
		networks:      networks,
		firewall:      firewall,
		backups:       backups,
		cronjobs:      cronjobs,
		storage:       storage,
		observability: observability,
		control:       control,
	}
}

func (h *ResourcesHandler) Register(r *mux.Router) {
	r.HandleFunc("/v1/servers/{id}/services", h.listServices).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}/services/{service}", h.getService).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}/services/{service}/logs", h.serviceLogs).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/network/interfaces", h.listInterfaces).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}/network/refresh", h.refreshInterfaces).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/network/checks", h.checkConnectivity).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/network/checks", h.connectivityHistory).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}/iptables/rules", h.listRules).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}/iptables/rules", h.createRule).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/iptables/rules/{ruleId}", h.updateRule).Methods(http.MethodPut)
	r.HandleFunc("/v1/servers/{id}/iptables/rules/{ruleId}", h.deleteRule).Methods(http.MethodDelete)
	r.HandleFunc("/v1/servers/{id}/iptables/apply", h.applyRules).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/iptables/backups", h.backupRules).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/iptables/backups", h.listRuleBackups).Methods(http.MethodGet)

	r.HandleFunc("/v1/iptables/backups/{backupId}/restore", h.restoreRuleBackup).Methods(http.MethodPost)

	r.HandleFunc("/v1/servers/{id}/backups", h.createBackup).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/backups", h.listBackups).Methods(http.MethodGet)
	r.HandleFunc("/v1/backups/{backupId}", h.getBackup).Methods(http.MethodGet)
	r.HandleFunc("/v1/backups/{backupId}", h.deleteBackup).Methods(http.MethodDelete)
	r.HandleFunc("/v1/backups/{backupId}/restore", h.restoreBackup).Methods(http.MethodPost)

	r.HandleFunc("/v1/servers/{id}/disks", h.listDisks).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}/disks/refresh", h.refreshDisks).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/metrics/history", h.metricsHistory).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}/audit-logs", h.auditHistory).Methods(http.MethodGet)

	r.HandleFunc("/v1/servers/{id}/cronjobs", h.createCronjob).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/cronjobs", h.listCronjobs).Methods(http.MethodGet)
	r.HandleFunc("/v1/cronjobs/{cronjobId}", h.getCronjob).Methods(http.MethodGet)
	r.HandleFunc("/v1/cronjobs/{cronjobId}", h.updateCronjob).Methods(http.MethodPut)
	r.HandleFunc("/v1/cronjobs/{cronjobId}", h.deleteCronjob).Methods(http.MethodDelete)
	r.HandleFunc("/v1/cronjobs/{cronjobId}/execute", h.executeCronjob).Methods(http.MethodPost)
	r.HandleFunc("/v1/cronjobs/{cronjobId}/history", h.cronjobHistory).Methods(http.MethodGet)

	r.HandleFunc("/v1/servers/{id}/terminal/exec", h.terminalExec).Methods(http.MethodPost)

	r.HandleFunc("/v1/servers/{id}/filesystem/read", h.fileRead).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/filesystem/list", h.fileList).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/filesystem/write", h.fileWrite).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/filesystem/chmod", h.fileChmod).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/processes/actions", h.processAction).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/packages/actions", h.packageAction).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/logs/tail", h.logTail).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/access/actions", h.accessAction).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/config/actions", h.configAction).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/plugins/actions", h.pluginAction).Methods(http.MethodPost)
}

func (h *ResourcesHandler) listServices(w http.ResponseWriter, r *http.Request) {
	items, err := h.services.List(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "service", items, nil))
}

func (h *ResourcesHandler) getService(w http.ResponseWriter, r *http.Request) {
	item, err := h.services.GetByName(r.Context(), mux.Vars(r)["id"], mux.Vars(r)["service"])
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "service", item, nil))
}

func (h *ResourcesHandler) serviceLogs(w http.ResponseWriter, r *http.Request) {
	command, err := h.services.Logs(r.Context(), mux.Vars(r)["id"], r.Header.Get("X-User-ID"), mux.Vars(r)["service"], parseInt(r.URL.Query().Get("lines"), 200))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "service", "service.logs", command, nil, nil))
}

func (h *ResourcesHandler) listInterfaces(w http.ResponseWriter, r *http.Request) {
	items, err := h.networks.ListInterfaces(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "network_interface", items, nil))
}

func (h *ResourcesHandler) refreshInterfaces(w http.ResponseWriter, r *http.Request) {
	command, err := h.networks.RefreshInterfaces(r.Context(), mux.Vars(r)["id"], r.Header.Get("X-User-ID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "network_interface", "network.refresh", command, nil, nil))
}

type connectivityRequest struct {
	TargetHost string `json:"target_host"`
	TargetPort int    `json:"target_port"`
	Protocol   string `json:"protocol"`
}

func (h *ResourcesHandler) checkConnectivity(w http.ResponseWriter, r *http.Request) {
	var request connectivityRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	check, command, err := h.networks.CheckConnectivity(r.Context(), mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.TargetHost, request.TargetPort, request.Protocol)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "network_check", "network.check", command, check, nil))
}

func (h *ResourcesHandler) connectivityHistory(w http.ResponseWriter, r *http.Request) {
	items, err := h.networks.History(r.Context(), mux.Vars(r)["id"], parseInt(r.URL.Query().Get("limit"), 50))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "network_check", items, map[string]any{"limit": parseInt(r.URL.Query().Get("limit"), 50)}))
}

func (h *ResourcesHandler) listRules(w http.ResponseWriter, r *http.Request) {
	items, err := h.firewall.ListRules(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "iptables_rule", items, nil))
}

func (h *ResourcesHandler) createRule(w http.ResponseWriter, r *http.Request) {
	var rule domain.ServerIPTable
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	rule.ServerID = mux.Vars(r)["id"]
	if err := h.firewall.CreateRule(r.Context(), &rule); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, itemEnvelope("created", "iptables_rule", rule, nil))
}

func (h *ResourcesHandler) updateRule(w http.ResponseWriter, r *http.Request) {
	var rule domain.ServerIPTable
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	rule.ID = mux.Vars(r)["ruleId"]
	rule.ServerID = mux.Vars(r)["id"]
	if err := h.firewall.UpdateRule(r.Context(), &rule); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("updated", "iptables_rule", rule, nil))
}

func (h *ResourcesHandler) deleteRule(w http.ResponseWriter, r *http.Request) {
	ruleID := mux.Vars(r)["ruleId"]
	if err := h.firewall.DeleteRule(r.Context(), ruleID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, actionEnvelope("deleted", "iptables_rule", "iptables.delete_rule", nil, map[string]any{"id": ruleID}, nil))
}

func (h *ResourcesHandler) applyRules(w http.ResponseWriter, r *http.Request) {
	command, err := h.firewall.Apply(r.Context(), mux.Vars(r)["id"], r.Header.Get("X-User-ID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "iptables_rule", "iptables.apply", command, nil, nil))
}

type backupRulesRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (h *ResourcesHandler) backupRules(w http.ResponseWriter, r *http.Request) {
	var request backupRulesRequest
	_ = json.NewDecoder(r.Body).Decode(&request)
	backup, err := h.firewall.Backup(r.Context(), mux.Vars(r)["id"], request.Name, request.Description)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, actionEnvelope("created", "iptables_backup", "iptables.backup", nil, backup, nil))
}

func (h *ResourcesHandler) listRuleBackups(w http.ResponseWriter, r *http.Request) {
	items, err := h.firewall.GetBackups(r.Context(), mux.Vars(r)["id"], parseInt(r.URL.Query().Get("limit"), 20))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "iptables_backup", items, map[string]any{"limit": parseInt(r.URL.Query().Get("limit"), 20)}))
}

func (h *ResourcesHandler) restoreRuleBackup(w http.ResponseWriter, r *http.Request) {
	command, err := h.firewall.Restore(r.Context(), mux.Vars(r)["backupId"], r.Header.Get("X-User-ID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "iptables_backup", "iptables.restore", command, nil, nil))
}

type createBackupRequest struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Type        string     `json:"type"`
	BackupPath  string     `json:"backup_path"`
	Paths       []string   `json:"paths"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

func (h *ResourcesHandler) createBackup(w http.ResponseWriter, r *http.Request) {
	var request createBackupRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	backup := &domain.ServerBackup{
		ServerID:    mux.Vars(r)["id"],
		Name:        request.Name,
		Description: request.Description,
		Type:        domain.BackupType(request.Type),
		BackupPath:  request.BackupPath,
		ExpiresAt:   request.ExpiresAt,
		Compressed:  true,
	}
	command, err := h.backups.Create(r.Context(), backup, r.Header.Get("X-User-ID"), request.Paths)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "backup", "backup.create", command, backup, nil))
}

func (h *ResourcesHandler) listBackups(w http.ResponseWriter, r *http.Request) {
	items, total, err := h.backups.List(r.Context(), domain.BackupFilter{
		ServerID: mux.Vars(r)["id"],
		Page:     parseInt(r.URL.Query().Get("page"), 1),
		PageSize: parseInt(r.URL.Query().Get("page_size"), 20),
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "backup", items, map[string]any{
		"total":     total,
		"page":      parseInt(r.URL.Query().Get("page"), 1),
		"page_size": parseInt(r.URL.Query().Get("page_size"), 20),
	}))
}

func (h *ResourcesHandler) getBackup(w http.ResponseWriter, r *http.Request) {
	backup, err := h.backups.Get(r.Context(), mux.Vars(r)["backupId"])
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "backup", backup, nil))
}

func (h *ResourcesHandler) deleteBackup(w http.ResponseWriter, r *http.Request) {
	backupID := mux.Vars(r)["backupId"]
	if err := h.backups.Delete(r.Context(), backupID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, actionEnvelope("deleted", "backup", "backup.delete", nil, map[string]any{"id": backupID}, nil))
}

func (h *ResourcesHandler) restoreBackup(w http.ResponseWriter, r *http.Request) {
	command, err := h.backups.Restore(r.Context(), mux.Vars(r)["backupId"], r.Header.Get("X-User-ID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "backup", "backup.restore", command, nil, nil))
}

func (h *ResourcesHandler) listDisks(w http.ResponseWriter, r *http.Request) {
	items, err := h.storage.ListDisks(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "disk", items, nil))
}

func (h *ResourcesHandler) refreshDisks(w http.ResponseWriter, r *http.Request) {
	command, err := h.storage.RefreshDisks(r.Context(), mux.Vars(r)["id"], r.Header.Get("X-User-ID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "disk", "disk.refresh", command, nil, nil))
}

func (h *ResourcesHandler) metricsHistory(w http.ResponseWriter, r *http.Request) {
	items, err := h.observability.MetricsHistory(r.Context(), mux.Vars(r)["id"], parseInt(r.URL.Query().Get("limit"), 120))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "metric_history", items, map[string]any{"limit": parseInt(r.URL.Query().Get("limit"), 120)}))
}

func (h *ResourcesHandler) auditHistory(w http.ResponseWriter, r *http.Request) {
	items, err := h.observability.AuditHistory(r.Context(), domain.AuditLogFilter{
		ServerID:       mux.Vars(r)["id"],
		TenantID:       r.URL.Query().Get("tenant_id"),
		Action:         r.URL.Query().Get("action"),
		PolicyDecision: r.URL.Query().Get("policy_decision"),
		Limit:          parseInt(r.URL.Query().Get("limit"), 200),
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "audit_log", items, map[string]any{
		"filters": map[string]any{
			"tenant_id":       r.URL.Query().Get("tenant_id"),
			"action":          r.URL.Query().Get("action"),
			"policy_decision": r.URL.Query().Get("policy_decision"),
		},
		"limit": parseInt(r.URL.Query().Get("limit"), 200),
	}))
}

type cronjobRequest struct {
	Name           string `json:"name"`
	Description    string `json:"description"`
	CronExpression string `json:"cron_expression"`
	Command        string `json:"command"`
	WorkingDir     string `json:"working_dir"`
	User           string `json:"user"`
}

func (h *ResourcesHandler) createCronjob(w http.ResponseWriter, r *http.Request) {
	var request cronjobRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	item := &domain.ServerCronjob{
		ServerID:       mux.Vars(r)["id"],
		Name:           request.Name,
		Description:    request.Description,
		CronExpression: request.CronExpression,
		Command:        request.Command,
		WorkingDir:     request.WorkingDir,
		User:           request.User,
	}
	if err := h.cronjobs.Create(r.Context(), item); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, itemEnvelope("created", "cronjob", item, nil))
}

func (h *ResourcesHandler) listCronjobs(w http.ResponseWriter, r *http.Request) {
	items, total, err := h.cronjobs.List(r.Context(), domain.CronjobFilter{
		ServerID: mux.Vars(r)["id"],
		Page:     parseInt(r.URL.Query().Get("page"), 1),
		PageSize: parseInt(r.URL.Query().Get("page_size"), 50),
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "cronjob", items, map[string]any{
		"total":     total,
		"page":      parseInt(r.URL.Query().Get("page"), 1),
		"page_size": parseInt(r.URL.Query().Get("page_size"), 50),
	}))
}

func (h *ResourcesHandler) getCronjob(w http.ResponseWriter, r *http.Request) {
	item, err := h.cronjobs.Get(r.Context(), mux.Vars(r)["cronjobId"])
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "cronjob", item, nil))
}

func (h *ResourcesHandler) updateCronjob(w http.ResponseWriter, r *http.Request) {
	existing, err := h.cronjobs.Get(r.Context(), mux.Vars(r)["cronjobId"])
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	var request cronjobRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	existing.Name = request.Name
	existing.Description = request.Description
	existing.CronExpression = request.CronExpression
	existing.Command = request.Command
	existing.WorkingDir = request.WorkingDir
	existing.User = request.User
	if err := h.cronjobs.Update(r.Context(), existing); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("updated", "cronjob", existing, nil))
}

func (h *ResourcesHandler) deleteCronjob(w http.ResponseWriter, r *http.Request) {
	cronjobID := mux.Vars(r)["cronjobId"]
	if err := h.cronjobs.Delete(r.Context(), cronjobID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, actionEnvelope("deleted", "cronjob", "cronjob.delete", nil, map[string]any{"id": cronjobID}, nil))
}

func (h *ResourcesHandler) executeCronjob(w http.ResponseWriter, r *http.Request) {
	command, err := h.cronjobs.Execute(r.Context(), mux.Vars(r)["cronjobId"], r.Header.Get("X-User-ID"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "cronjob", "cron.execute", command, nil, nil))
}

func (h *ResourcesHandler) cronjobHistory(w http.ResponseWriter, r *http.Request) {
	items, err := h.cronjobs.History(r.Context(), mux.Vars(r)["cronjobId"], parseInt(r.URL.Query().Get("limit"), 50))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "cronjob_history", items, map[string]any{"limit": parseInt(r.URL.Query().Get("limit"), 50)}))
}

type terminalRequest struct {
	Command    string `json:"command"`
	TimeoutSec int    `json:"timeout_sec"`
}

func (h *ResourcesHandler) terminalExec(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request terminalRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.Terminal(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Command, request.TimeoutSec)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "terminal", "terminal.exec", command, nil, nil))
}

type fileReadRequest struct {
	Path  string `json:"path"`
	Lines int    `json:"lines"`
}

func (h *ResourcesHandler) fileRead(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request fileReadRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.FileRead(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Path, request.Lines)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "file", "file.read", command, nil, nil))
}

type fileListRequest struct {
	Path  string `json:"path"`
	Depth int    `json:"depth"`
}

func (h *ResourcesHandler) fileList(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request fileListRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.FileList(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Path, request.Depth)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "file", "file.list", command, nil, nil))
}

type fileWriteRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func (h *ResourcesHandler) fileWrite(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request fileWriteRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.FileWrite(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Path, request.Content)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "file", "file.write", command, nil, nil))
}

type chmodRequest struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
}

func (h *ResourcesHandler) fileChmod(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request chmodRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.FileChmod(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Path, request.Mode)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "file", "file.chmod", command, nil, nil))
}

type processActionRequest struct {
	PID    int    `json:"pid"`
	Signal string `json:"signal"`
}

func (h *ResourcesHandler) processAction(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request processActionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.ProcessAction(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.PID, request.Signal)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "process", "process.signal", command, nil, nil))
}

type packageActionRequest struct {
	Action      string `json:"action"`
	PackageName string `json:"package_name"`
}

func (h *ResourcesHandler) packageAction(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request packageActionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.PackageAction(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Action, request.PackageName)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "package", "package."+request.Action, command, nil, nil))
}

type logTailRequest struct {
	Path  string `json:"path"`
	Lines int    `json:"lines"`
}

func (h *ResourcesHandler) logTail(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request logTailRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.TailLog(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Path, request.Lines)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "log", "log.tail", command, nil, nil))
}

type accessActionRequest struct {
	Action  string `json:"action"`
	Target  string `json:"target"`
	Payload string `json:"payload"`
}

func (h *ResourcesHandler) accessAction(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request accessActionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.AccessAction(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Action, request.Target, request.Payload)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "access", "access."+request.Action, command, nil, nil))
}

type configActionRequest struct {
	Action  string `json:"action"`
	Target  string `json:"target"`
	Payload string `json:"payload"`
}

func (h *ResourcesHandler) configAction(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request configActionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.ConfigAction(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Action, request.Target, request.Payload)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "config", "config."+request.Action, command, nil, nil))
}

type pluginActionRequest struct {
	Action string `json:"action"`
	Target string `json:"target"`
}

func (h *ResourcesHandler) pluginAction(w http.ResponseWriter, r *http.Request) {
	ctx := managementapp.WithActorRole(r.Context(), r.Header.Get("X-User-Role"))
	var request pluginActionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	command, err := h.control.PluginAction(ctx, mux.Vars(r)["id"], r.Header.Get("X-User-ID"), request.Action, request.Target)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "plugin", "plugin."+request.Action, command, nil, nil))
}
