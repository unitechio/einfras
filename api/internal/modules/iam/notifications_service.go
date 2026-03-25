package iam

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type NotificationListOptions struct {
	Search   string
	Status   string
	Channel  string
	Priority string
	Unread   *bool
	Limit    int
}

type UpsertNotificationRequest struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Type        string         `json:"type"`
	Channel     string         `json:"channel"`
	Priority    string         `json:"priority"`
	Status      string         `json:"status"`
	Metadata    map[string]any `json:"metadata"`
}

type UpdateNotificationStatusRequest struct {
	Status string `json:"status"`
}

type UpsertNotificationPreferencesRequest struct {
	InAppEnabled     bool   `json:"in_app_enabled"`
	EmailEnabled     bool   `json:"email_enabled"`
	TelegramEnabled  bool   `json:"telegram_enabled"`
	WhatsAppEnabled  bool   `json:"whatsapp_enabled"`
	OnlyHighPriority bool   `json:"only_high_priority"`
	Digest           string `json:"digest"`
}

type UpsertIntegrationPluginRequest struct {
	Name     string         `json:"name"`
	Enabled  bool           `json:"enabled"`
	Status   string         `json:"status"`
	Endpoint string         `json:"endpoint"`
	Secret   string         `json:"secret"`
	Events   string         `json:"events"`
	Metadata map[string]any `json:"metadata"`
}

type UpsertNotificationRoutingRuleRequest struct {
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	Enabled         bool           `json:"enabled"`
	IntegrationKind string         `json:"integration_kind"`
	EventTypes      []string       `json:"event_types"`
	Priorities      []string       `json:"priorities"`
	Channels        []string       `json:"channels"`
	Statuses        []string       `json:"statuses"`
	Tags            []string       `json:"tags"`
	TagPrefixes     []string       `json:"tag_prefixes"`
	Metadata        map[string]any `json:"metadata"`
}

type NotificationRoutingSimulationRequest struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Type        string         `json:"type"`
	Channel     string         `json:"channel"`
	Priority    string         `json:"priority"`
	Status      string         `json:"status"`
	Tags        []string       `json:"tags"`
	Metadata    map[string]any `json:"metadata"`
}

type NotificationRoutingRuleSimulationResult struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	IntegrationKind string   `json:"integration_kind"`
	Matched         bool     `json:"matched"`
	Reasons         []string `json:"reasons"`
}

type NotificationRoutingProviderSimulationResult struct {
	Kind            string   `json:"kind"`
	Name            string   `json:"name"`
	Enabled         bool     `json:"enabled"`
	Interested      bool     `json:"interested"`
	HasRuleSet      bool     `json:"has_rule_set"`
	MatchedRuleIDs  []string `json:"matched_rule_ids"`
	WouldDeliver    bool     `json:"would_deliver"`
	DecisionReasons []string `json:"decision_reasons"`
}

type NotificationRoutingSimulationResponse struct {
	ExtractedTags []string                                      `json:"extracted_tags"`
	RuleResults   []NotificationRoutingRuleSimulationResult     `json:"rule_results"`
	Providers     []NotificationRoutingProviderSimulationResult `json:"providers"`
}

func (s *Service) ListNotifications(ctx context.Context, principal *Principal, opts NotificationListOptions) ([]NotificationRecord, error) {
	limit := opts.Limit
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	query := s.db.WithContext(ctx).
		Where("user_id = ? AND organization_id = ?", principal.UserID, principal.OrganizationID).
		Order("created_at desc").
		Limit(limit)
	if search := strings.TrimSpace(opts.Search); search != "" {
		query = query.Where("title ILIKE ? OR description ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if status := strings.TrimSpace(opts.Status); status != "" {
		query = query.Where("status = ?", status)
	}
	if channel := strings.TrimSpace(opts.Channel); channel != "" {
		query = query.Where("channel = ?", channel)
	}
	if priority := strings.TrimSpace(opts.Priority); priority != "" {
		query = query.Where("priority = ?", priority)
	}
	if opts.Unread != nil {
		query = query.Where("is_read = ?", !*opts.Unread)
	}
	var items []NotificationRecord
	if err := query.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) CreateNotificationRecord(ctx context.Context, principal *Principal, req UpsertNotificationRequest) (*NotificationRecord, error) {
	item := &NotificationRecord{
		UserID:         principal.UserID,
		OrganizationID: principal.OrganizationID,
		Title:          strings.TrimSpace(req.Title),
		Description:    strings.TrimSpace(req.Description),
		Type:           defaultString(req.Type, "system"),
		Channel:        defaultString(req.Channel, "in-app"),
		Priority:       defaultString(req.Priority, "medium"),
		Status:         defaultString(req.Status, "open"),
		Metadata:       JSONObject(req.Metadata),
	}
	if item.Title == "" {
		return nil, fmt.Errorf("title is required")
	}
	if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
		return nil, err
	}
	_ = s.dispatchNotification(ctx, item)
	return item, nil
}

func (s *Service) GetNotificationRecord(ctx context.Context, principal *Principal, id string) (*NotificationRecord, error) {
	var item NotificationRecord
	if err := s.db.WithContext(ctx).Where("id = ? AND user_id = ? AND organization_id = ?", id, principal.UserID, principal.OrganizationID).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) MarkNotificationRead(ctx context.Context, principal *Principal, id string, read bool) error {
	return s.db.WithContext(ctx).
		Model(&NotificationRecord{}).
		Where("id = ? AND user_id = ? AND organization_id = ?", id, principal.UserID, principal.OrganizationID).
		Update("is_read", read).Error
}

func (s *Service) MarkAllNotificationsRead(ctx context.Context, principal *Principal) error {
	return s.db.WithContext(ctx).
		Model(&NotificationRecord{}).
		Where("user_id = ? AND organization_id = ?", principal.UserID, principal.OrganizationID).
		Update("is_read", true).Error
}

func (s *Service) UpdateNotificationStatus(ctx context.Context, principal *Principal, id, status string) error {
	status = strings.TrimSpace(status)
	if status == "" {
		return fmt.Errorf("status is required")
	}
	if err := s.db.WithContext(ctx).
		Model(&NotificationRecord{}).
		Where("id = ? AND user_id = ? AND organization_id = ?", id, principal.UserID, principal.OrganizationID).
		Update("status", status).Error; err != nil {
		return err
	}
	item, err := s.GetNotificationRecord(ctx, principal, id)
	if err == nil {
		_ = s.dispatchNotification(ctx, item)
	}
	return nil
}

func (s *Service) DeleteNotificationRecord(ctx context.Context, principal *Principal, id string) error {
	return s.db.WithContext(ctx).Where("id = ? AND user_id = ? AND organization_id = ?", id, principal.UserID, principal.OrganizationID).Delete(&NotificationRecord{}).Error
}

func (s *Service) GetNotificationPreferences(ctx context.Context, principal *Principal) (*NotificationPreferenceRecord, error) {
	var item NotificationPreferenceRecord
	err := s.db.WithContext(ctx).Where("user_id = ? AND organization_id = ?", principal.UserID, principal.OrganizationID).First(&item).Error
	if err == nil {
		return &item, nil
	}
	item = NotificationPreferenceRecord{
		UserID:           principal.UserID,
		OrganizationID:   principal.OrganizationID,
		InAppEnabled:     true,
		EmailEnabled:     true,
		TelegramEnabled:  true,
		WhatsAppEnabled:  false,
		OnlyHighPriority: false,
		Digest:           "realtime",
	}
	if createErr := s.db.WithContext(ctx).Create(&item).Error; createErr != nil {
		return nil, createErr
	}
	return &item, nil
}

func (s *Service) UpsertNotificationPreferences(ctx context.Context, principal *Principal, req UpsertNotificationPreferencesRequest) (*NotificationPreferenceRecord, error) {
	item, err := s.GetNotificationPreferences(ctx, principal)
	if err != nil {
		return nil, err
	}
	item.InAppEnabled = req.InAppEnabled
	item.EmailEnabled = req.EmailEnabled
	item.TelegramEnabled = req.TelegramEnabled
	item.WhatsAppEnabled = req.WhatsAppEnabled
	item.OnlyHighPriority = req.OnlyHighPriority
	item.Digest = defaultString(req.Digest, "realtime")
	if err := s.db.WithContext(ctx).Save(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) ListIntegrationPlugins(ctx context.Context, principal *Principal) ([]IntegrationPluginRecord, error) {
	var items []IntegrationPluginRecord
	if err := s.db.WithContext(ctx).Where("organization_id = ?", principal.OrganizationID).Order("kind asc").Find(&items).Error; err != nil {
		return nil, err
	}
	if len(items) > 0 {
		return items, nil
	}
	defaults := []IntegrationPluginRecord{
		{OrganizationID: principal.OrganizationID, Kind: "github-actions", Name: "GitHub Actions", Status: "Not configured"},
		{OrganizationID: principal.OrganizationID, Kind: "gitlab-cicd", Name: "GitLab CI/CD", Status: "Not configured"},
		{OrganizationID: principal.OrganizationID, Kind: "telegram", Name: "Telegram", Status: "Not configured"},
		{OrganizationID: principal.OrganizationID, Kind: "whatsapp", Name: "WhatsApp", Status: "Not configured"},
	}
	for index := range defaults {
		if err := s.db.WithContext(ctx).Create(&defaults[index]).Error; err != nil {
			return nil, err
		}
	}
	return defaults, nil
}

func (s *Service) UpsertIntegrationPlugin(ctx context.Context, principal *Principal, kind string, req UpsertIntegrationPluginRequest) (*IntegrationPluginRecord, error) {
	kind = strings.TrimSpace(kind)
	if kind == "" {
		return nil, fmt.Errorf("kind is required")
	}
	var item IntegrationPluginRecord
	err := s.db.WithContext(ctx).Where("organization_id = ? AND kind = ?", principal.OrganizationID, kind).First(&item).Error
	if err != nil {
		item = IntegrationPluginRecord{
			OrganizationID: principal.OrganizationID,
			Kind:           kind,
		}
	}
	item.Name = defaultString(req.Name, defaultPluginName(kind))
	item.Enabled = req.Enabled
	item.Status = defaultString(req.Status, pluginStatus(req.Enabled, req.Endpoint))
	item.Endpoint = strings.TrimSpace(req.Endpoint)
	item.Secret = strings.TrimSpace(req.Secret)
	item.Events = strings.TrimSpace(req.Events)
	item.Metadata = JSONObject(req.Metadata)
	if item.ID == "" {
		if err := s.db.WithContext(ctx).Create(&item).Error; err != nil {
			return nil, err
		}
	} else if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) SendIntegrationTest(ctx context.Context, principal *Principal, kind string) error {
	var integration IntegrationPluginRecord
	if err := s.db.WithContext(ctx).Where("organization_id = ? AND kind = ?", principal.OrganizationID, kind).First(&integration).Error; err != nil {
		return err
	}
	payload := map[string]any{
		"type":         "integration.test",
		"kind":         integration.Kind,
		"organization": principal.OrganizationID,
		"sent_at":      time.Now().UTC().Format(time.RFC3339),
		"message":      "Einfra integration connectivity test",
	}
	return s.dispatchIntegration(ctx, integration, payload)
}

func (s *Service) ListNotificationRoutingRules(ctx context.Context, principal *Principal) ([]NotificationRoutingRuleRecord, error) {
	var items []NotificationRoutingRuleRecord
	if err := s.db.WithContext(ctx).
		Where("organization_id = ?", principal.OrganizationID).
		Order("enabled desc, integration_kind asc, name asc").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) CreateNotificationRoutingRule(ctx context.Context, principal *Principal, req UpsertNotificationRoutingRuleRequest) (*NotificationRoutingRuleRecord, error) {
	item := &NotificationRoutingRuleRecord{
		OrganizationID:  principal.OrganizationID,
		Name:            defaultString(req.Name, "Routing Rule"),
		Description:     strings.TrimSpace(req.Description),
		Enabled:         req.Enabled,
		IntegrationKind: strings.TrimSpace(req.IntegrationKind),
		EventTypes:      sanitizeStringSlice(req.EventTypes),
		Priorities:      sanitizeStringSlice(req.Priorities),
		Channels:        sanitizeStringSlice(req.Channels),
		Statuses:        sanitizeStringSlice(req.Statuses),
		Tags:            sanitizeStringSlice(req.Tags),
		TagPrefixes:     sanitizeStringSlice(req.TagPrefixes),
		Metadata:        JSONObject(req.Metadata),
	}
	if item.IntegrationKind == "" {
		return nil, fmt.Errorf("integration_kind is required")
	}
	if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) UpdateNotificationRoutingRule(ctx context.Context, principal *Principal, id string, req UpsertNotificationRoutingRuleRequest) (*NotificationRoutingRuleRecord, error) {
	var item NotificationRoutingRuleRecord
	if err := s.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, principal.OrganizationID).
		First(&item).Error; err != nil {
		return nil, err
	}
	item.Name = defaultString(req.Name, item.Name)
	item.Description = strings.TrimSpace(req.Description)
	item.Enabled = req.Enabled
	item.IntegrationKind = defaultString(strings.TrimSpace(req.IntegrationKind), item.IntegrationKind)
	item.EventTypes = sanitizeStringSlice(req.EventTypes)
	item.Priorities = sanitizeStringSlice(req.Priorities)
	item.Channels = sanitizeStringSlice(req.Channels)
	item.Statuses = sanitizeStringSlice(req.Statuses)
	item.Tags = sanitizeStringSlice(req.Tags)
	item.TagPrefixes = sanitizeStringSlice(req.TagPrefixes)
	item.Metadata = mergeJSONObjects(item.Metadata, JSONObject(req.Metadata))
	if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) DeleteNotificationRoutingRule(ctx context.Context, principal *Principal, id string) error {
	return s.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, principal.OrganizationID).
		Delete(&NotificationRoutingRuleRecord{}).Error
}

func (s *Service) SimulateNotificationRouting(ctx context.Context, principal *Principal, req NotificationRoutingSimulationRequest) (*NotificationRoutingSimulationResponse, error) {
	if principal == nil {
		return nil, fmt.Errorf("principal is required")
	}
	metadata := JSONObject(req.Metadata)
	tags := sanitizeStringSlice(req.Tags)
	if len(tags) > 0 {
		metadata["tags"] = append([]string(nil), tags...)
		metadata["einfra.tags"] = append([]string(nil), tags...)
	}
	notification := &NotificationRecord{
		UserID:         principal.UserID,
		OrganizationID: principal.OrganizationID,
		Title:          defaultString(req.Title, "Simulation notification"),
		Description:    strings.TrimSpace(req.Description),
		Type:           defaultString(req.Type, "system"),
		Channel:        defaultString(req.Channel, "in-app"),
		Priority:       defaultString(req.Priority, "medium"),
		Status:         defaultString(req.Status, "open"),
		Metadata:       metadata,
		CreatedAt:      time.Now().UTC(),
	}

	var integrations []IntegrationPluginRecord
	if err := s.db.WithContext(ctx).
		Where("organization_id = ?", principal.OrganizationID).
		Order("kind asc").
		Find(&integrations).Error; err != nil {
		return nil, err
	}
	var rules []NotificationRoutingRuleRecord
	if err := s.db.WithContext(ctx).
		Where("organization_id = ?", principal.OrganizationID).
		Order("integration_kind asc, name asc").
		Find(&rules).Error; err != nil {
		return nil, err
	}

	extractedTags := extractNotificationTags(notification.Metadata)
	ruleResults := make([]NotificationRoutingRuleSimulationResult, 0, len(rules))
	matchedRuleIDsByProvider := map[string][]string{}
	for _, rule := range rules {
		reasons := evaluateRoutingRule(rule, notification, extractedTags)
		matched := len(reasons) == 0
		if matched {
			matchedRuleIDsByProvider[rule.IntegrationKind] = append(matchedRuleIDsByProvider[rule.IntegrationKind], rule.ID)
		}
		ruleResults = append(ruleResults, NotificationRoutingRuleSimulationResult{
			ID:              rule.ID,
			Name:            rule.Name,
			IntegrationKind: rule.IntegrationKind,
			Matched:         matched,
			Reasons:         reasons,
		})
	}

	providers := make([]NotificationRoutingProviderSimulationResult, 0, len(integrations))
	for _, integration := range integrations {
		reasons := make([]string, 0, 4)
		interested := integrationInterested(integration.Events, notification.Type, notification.Status)
		if !interested {
			reasons = append(reasons, "provider event subscription does not include this notification")
		}
		hasRuleSet := hasRulesForIntegration(rules, integration.Kind)
		matchedRuleIDs := append([]string(nil), matchedRuleIDsByProvider[integration.Kind]...)
		if hasRuleSet && len(matchedRuleIDs) == 0 {
			reasons = append(reasons, "no routing rule matched this provider")
		}
		if !integration.Enabled {
			reasons = append(reasons, "provider is disabled")
		}
		filterReasons := evaluateIntegrationFilters(integration, notification, extractedTags)
		reasons = append(reasons, filterReasons...)
		providers = append(providers, NotificationRoutingProviderSimulationResult{
			Kind:            integration.Kind,
			Name:            integration.Name,
			Enabled:         integration.Enabled,
			Interested:      interested,
			HasRuleSet:      hasRuleSet,
			MatchedRuleIDs:  matchedRuleIDs,
			WouldDeliver:    interested && integration.Enabled && (!hasRuleSet || len(matchedRuleIDs) > 0) && len(filterReasons) == 0,
			DecisionReasons: reasons,
		})
	}

	return &NotificationRoutingSimulationResponse{
		ExtractedTags: extractedTags,
		RuleResults:   ruleResults,
		Providers:     providers,
	}, nil
}

func (s *Service) dispatchNotification(ctx context.Context, notification *NotificationRecord) error {
	var integrations []IntegrationPluginRecord
	if err := s.db.WithContext(ctx).Where("organization_id = ? AND enabled = ?", notification.OrganizationID, true).Find(&integrations).Error; err != nil {
		return err
	}
	var rules []NotificationRoutingRuleRecord
	if err := s.db.WithContext(ctx).
		Where("organization_id = ? AND enabled = ?", notification.OrganizationID, true).
		Find(&rules).Error; err != nil {
		return err
	}
	tags := extractNotificationTags(notification.Metadata)
	payload := map[string]any{
		"type":         "notification",
		"id":           notification.ID,
		"title":        notification.Title,
		"description":  notification.Description,
		"priority":     notification.Priority,
		"status":       notification.Status,
		"channel":      notification.Channel,
		"metadata":     notification.Metadata,
		"tags":         tags,
		"organization": notification.OrganizationID,
		"user_id":      notification.UserID,
		"created_at":   notification.CreatedAt.Format(time.RFC3339),
	}
	for _, integration := range integrations {
		if !integrationInterested(integration.Events, notification.Type, notification.Status) {
			continue
		}
		if hasRulesForIntegration(rules, integration.Kind) && !matchesAnyRoutingRule(rules, integration.Kind, notification, tags) {
			continue
		}
		if !integrationMatchesNotification(integration, notification, tags) {
			continue
		}
		_ = s.dispatchIntegration(ctx, integration, payload)
	}
	return nil
}

func hasRulesForIntegration(rules []NotificationRoutingRuleRecord, integrationKind string) bool {
	for _, rule := range rules {
		if strings.EqualFold(rule.IntegrationKind, integrationKind) {
			return true
		}
	}
	return false
}

func matchesAnyRoutingRule(rules []NotificationRoutingRuleRecord, integrationKind string, notification *NotificationRecord, tags []string) bool {
	for _, rule := range rules {
		if !strings.EqualFold(rule.IntegrationKind, integrationKind) {
			continue
		}
		if routingRuleMatchesNotification(rule, notification, tags) {
			return true
		}
	}
	return false
}

func routingRuleMatchesNotification(rule NotificationRoutingRuleRecord, notification *NotificationRecord, tags []string) bool {
	return len(evaluateRoutingRule(rule, notification, tags)) == 0
}

func evaluateRoutingRule(rule NotificationRoutingRuleRecord, notification *NotificationRecord, tags []string) []string {
	if notification == nil {
		return []string{"notification payload is missing"}
	}
	if !rule.Enabled {
		return []string{"rule is disabled"}
	}
	if len(rule.EventTypes) > 0 && !hasAnyFold([]string{notification.Type}, rule.EventTypes) {
		return []string{"event type did not match"}
	}
	if len(rule.Priorities) > 0 && !hasAnyFold([]string{notification.Priority}, rule.Priorities) {
		return []string{"priority did not match"}
	}
	if len(rule.Channels) > 0 && !hasAnyFold([]string{notification.Channel}, rule.Channels) {
		return []string{"channel did not match"}
	}
	if len(rule.Statuses) > 0 && !hasAnyFold([]string{notification.Status}, rule.Statuses) {
		return []string{"status did not match"}
	}
	if len(rule.Tags) > 0 && !hasAnyFold(tags, rule.Tags) {
		return []string{"exact tags did not match"}
	}
	if len(rule.TagPrefixes) > 0 && !hasPrefixMatchFold(tags, rule.TagPrefixes) {
		return []string{"tag prefixes did not match"}
	}
	return nil
}

func (s *Service) dispatchIntegration(ctx context.Context, integration IntegrationPluginRecord, payload map[string]any) error {
	switch integration.Kind {
	case "telegram":
		return s.sendTelegram(ctx, integration, payload)
	case "whatsapp":
		return s.sendWhatsApp(ctx, integration, payload)
	case "github-actions":
		return s.sendGitHubActions(ctx, integration, payload)
	case "gitlab-cicd":
		return s.sendGitLabPipeline(ctx, integration, payload)
	default:
		return s.sendWebhook(ctx, integration.Endpoint, integration.Secret, payload)
	}
}

func (s *Service) sendWebhook(ctx context.Context, endpoint, secret string, payload map[string]any) error {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return nil
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if secret = strings.TrimSpace(secret); secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
		req.Header.Set("X-Einfra-Webhook-Secret", secret)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("webhook failed with status %d", resp.StatusCode)
	}
	return nil
}

func (s *Service) sendTelegram(ctx context.Context, integration IntegrationPluginRecord, payload map[string]any) error {
	botToken := strings.TrimSpace(stringMetadata(integration.Metadata, "bot_token"))
	chatID := strings.TrimSpace(stringMetadata(integration.Metadata, "chat_id"))
	if botToken == "" || chatID == "" {
		return s.sendWebhook(ctx, integration.Endpoint, integration.Secret, payload)
	}
	body := map[string]any{
		"chat_id": chatID,
		"text":    providerMessage(integration.Kind, payload),
	}
	return s.sendJSONRequest(ctx, http.MethodPost, "https://api.telegram.org/bot"+botToken+"/sendMessage", "", body, map[string]string{})
}

func (s *Service) sendWhatsApp(ctx context.Context, integration IntegrationPluginRecord, payload map[string]any) error {
	phoneNumberID := strings.TrimSpace(stringMetadata(integration.Metadata, "phone_number_id"))
	recipient := strings.TrimSpace(stringMetadata(integration.Metadata, "recipient"))
	token := strings.TrimSpace(firstNonEmpty(integration.Secret, stringMetadata(integration.Metadata, "access_token")))
	endpoint := strings.TrimSpace(integration.Endpoint)
	if endpoint == "" && phoneNumberID != "" {
		endpoint = "https://graph.facebook.com/v21.0/" + phoneNumberID + "/messages"
	}
	if endpoint == "" || recipient == "" || token == "" {
		return s.sendWebhook(ctx, integration.Endpoint, integration.Secret, payload)
	}
	body := map[string]any{
		"messaging_product": "whatsapp",
		"to":                recipient,
		"type":              "text",
		"text": map[string]any{
			"body": providerMessage(integration.Kind, payload),
		},
	}
	return s.sendJSONRequest(ctx, http.MethodPost, endpoint, token, body, map[string]string{})
}

func (s *Service) sendGitHubActions(ctx context.Context, integration IntegrationPluginRecord, payload map[string]any) error {
	repo := strings.TrimSpace(stringMetadata(integration.Metadata, "repository"))
	workflowID := strings.TrimSpace(stringMetadata(integration.Metadata, "workflow_id"))
	ref := defaultString(stringMetadata(integration.Metadata, "ref"), "main")
	token := strings.TrimSpace(firstNonEmpty(integration.Secret, stringMetadata(integration.Metadata, "token")))
	endpoint := strings.TrimSpace(integration.Endpoint)
	if endpoint == "" && repo != "" && workflowID != "" {
		endpoint = "https://api.github.com/repos/" + repo + "/actions/workflows/" + workflowID + "/dispatches"
	}
	if endpoint == "" || token == "" {
		return s.sendWebhook(ctx, integration.Endpoint, integration.Secret, payload)
	}
	body := map[string]any{
		"ref": ref,
		"inputs": map[string]any{
			"event_type": payload["type"],
			"message":    providerMessage(integration.Kind, payload),
			"payload":    jsonCompact(payload),
		},
	}
	return s.sendJSONRequest(ctx, http.MethodPost, endpoint, token, body, map[string]string{
		"Accept":               "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	})
}

func (s *Service) sendGitLabPipeline(ctx context.Context, integration IntegrationPluginRecord, payload map[string]any) error {
	projectID := strings.TrimSpace(stringMetadata(integration.Metadata, "project_id"))
	ref := defaultString(stringMetadata(integration.Metadata, "ref"), "main")
	triggerToken := strings.TrimSpace(firstNonEmpty(integration.Secret, stringMetadata(integration.Metadata, "trigger_token")))
	endpoint := strings.TrimSpace(integration.Endpoint)
	if endpoint == "" && projectID != "" {
		endpoint = "https://gitlab.com/api/v4/projects/" + url.PathEscape(projectID) + "/trigger/pipeline"
	}
	if endpoint == "" || triggerToken == "" {
		return s.sendWebhook(ctx, integration.Endpoint, integration.Secret, payload)
	}
	form := url.Values{}
	form.Set("token", triggerToken)
	form.Set("ref", ref)
	form.Set("variables[EINFRA_EVENT_TYPE]", fmt.Sprint(payload["type"]))
	form.Set("variables[EINFRA_MESSAGE]", providerMessage(integration.Kind, payload))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("gitlab trigger failed with status %d", resp.StatusCode)
	}
	return nil
}

func (s *Service) sendJSONRequest(ctx context.Context, method, endpoint, bearerToken string, payload map[string]any, headers map[string]string) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	if strings.TrimSpace(bearerToken) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(bearerToken))
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("provider request failed with status %d", resp.StatusCode)
	}
	return nil
}

func providerMessage(kind string, payload map[string]any) string {
	title := strings.TrimSpace(fmt.Sprint(payload["title"]))
	if title == "" {
		title = strings.TrimSpace(fmt.Sprint(payload["message"]))
	}
	description := strings.TrimSpace(fmt.Sprint(payload["description"]))
	status := strings.TrimSpace(fmt.Sprint(payload["status"]))
	priority := strings.TrimSpace(fmt.Sprint(payload["priority"]))
	prefix := strings.ToUpper(strings.ReplaceAll(kind, "-", " "))
	parts := []string{prefix}
	if title != "" {
		parts = append(parts, title)
	}
	if description != "" {
		parts = append(parts, description)
	}
	if status != "" || priority != "" {
		parts = append(parts, strings.TrimSpace(status+" "+priority))
	}
	return strings.Join(parts, " | ")
}

func stringMetadata(metadata JSONObject, key string) string {
	if metadata == nil {
		return ""
	}
	if value, ok := metadata[key]; ok && value != nil {
		return fmt.Sprint(value)
	}
	return ""
}

func jsonCompact(payload map[string]any) string {
	body, err := json.Marshal(payload)
	if err != nil {
		return "{}"
	}
	return string(body)
}

func integrationInterested(events, notificationType, status string) bool {
	events = strings.TrimSpace(strings.ToLower(events))
	if events == "" {
		return true
	}
	for _, item := range strings.Split(events, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if item == "*" || strings.Contains(item, strings.ToLower(notificationType)) || strings.Contains(item, strings.ToLower(status)) {
			return true
		}
	}
	return false
}

func integrationMatchesNotification(integration IntegrationPluginRecord, notification *NotificationRecord, tags []string) bool {
	return len(evaluateIntegrationFilters(integration, notification, tags)) == 0
}

func evaluateIntegrationFilters(integration IntegrationPluginRecord, notification *NotificationRecord, tags []string) []string {
	if notification == nil {
		return []string{"notification payload is missing"}
	}
	metadata := integration.Metadata
	if value := strings.TrimSpace(strings.ToLower(stringMetadata(metadata, "priority_filter"))); value != "" && value != "all" {
		if !strings.EqualFold(value, notification.Priority) {
			return []string{"provider priority filter did not match"}
		}
	}
	if value := strings.TrimSpace(strings.ToLower(stringMetadata(metadata, "channel_filter"))); value != "" && value != "all" {
		if !strings.EqualFold(value, notification.Channel) {
			return []string{"provider channel filter did not match"}
		}
	}
	if value := strings.TrimSpace(strings.ToLower(stringMetadata(metadata, "status_filter"))); value != "" && value != "all" {
		if !strings.EqualFold(value, notification.Status) {
			return []string{"provider status filter did not match"}
		}
	}
	if value := strings.TrimSpace(strings.ToLower(stringMetadata(metadata, "type_filter"))); value != "" && value != "all" {
		if !strings.EqualFold(value, notification.Type) {
			return []string{"provider type filter did not match"}
		}
	}
	requiredTags := csvMetadata(metadata, "route_tags")
	if len(requiredTags) > 0 && !hasAnyFold(tags, requiredTags) {
		return []string{"provider exact tag filter did not match"}
	}
	requiredPrefixes := csvMetadata(metadata, "route_tag_prefixes")
	if len(requiredPrefixes) > 0 && !hasPrefixMatchFold(tags, requiredPrefixes) {
		return []string{"provider tag prefix filter did not match"}
	}
	return nil
}

func extractNotificationTags(metadata JSONObject) []string {
	if metadata == nil {
		return nil
	}
	seen := map[string]struct{}{}
	appendTag := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		key := strings.ToLower(value)
		if _, exists := seen[key]; exists {
			return
		}
		seen[key] = struct{}{}
	}
	switch raw := metadata["tags"].(type) {
	case []string:
		for _, item := range raw {
			appendTag(item)
		}
	case []any:
		for _, item := range raw {
			appendTag(fmt.Sprint(item))
		}
	case string:
		for _, item := range strings.Split(raw, ",") {
			appendTag(item)
		}
	}
	switch raw := metadata["einfra.tags"].(type) {
	case []string:
		for _, item := range raw {
			appendTag(item)
		}
	case []any:
		for _, item := range raw {
			appendTag(fmt.Sprint(item))
		}
	case string:
		for _, item := range strings.Split(raw, ",") {
			appendTag(item)
		}
	}
	for key, value := range metadata {
		if !strings.HasPrefix(strings.ToLower(key), "einfra.tag.") {
			continue
		}
		tagKey := strings.TrimSpace(strings.TrimPrefix(key, "einfra.tag."))
		if tagKey == "" {
			continue
		}
		tagValue := strings.TrimSpace(fmt.Sprint(value))
		if tagValue == "" || strings.EqualFold(tagValue, "true") {
			appendTag(tagKey)
			continue
		}
		appendTag(tagKey + ":" + tagValue)
	}
	items := make([]string, 0, len(seen))
	for item := range seen {
		items = append(items, item)
	}
	return items
}

func csvMetadata(metadata JSONObject, key string) []string {
	raw := strings.TrimSpace(stringMetadata(metadata, key))
	if raw == "" {
		return nil
	}
	items := strings.Split(raw, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}

func hasAnyFold(values, expected []string) bool {
	for _, value := range values {
		for _, item := range expected {
			if strings.EqualFold(strings.TrimSpace(value), strings.TrimSpace(item)) {
				return true
			}
		}
	}
	return false
}

func hasPrefixMatchFold(values, prefixes []string) bool {
	for _, value := range values {
		normalizedValue := strings.ToLower(strings.TrimSpace(value))
		for _, prefix := range prefixes {
			normalizedPrefix := strings.ToLower(strings.TrimSpace(prefix))
			if normalizedPrefix != "" && strings.HasPrefix(normalizedValue, normalizedPrefix) {
				return true
			}
		}
	}
	return false
}

func defaultPluginName(kind string) string {
	switch kind {
	case "github-actions":
		return "GitHub Actions"
	case "gitlab-cicd":
		return "GitLab CI/CD"
	case "telegram":
		return "Telegram"
	case "whatsapp":
		return "WhatsApp"
	default:
		return kind
	}
}

func pluginStatus(enabled bool, endpoint string) string {
	if !enabled {
		return "Disabled"
	}
	if strings.TrimSpace(endpoint) == "" {
		return "Pending webhook"
	}
	return "Connected"
}

func defaultString(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}
