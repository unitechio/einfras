package iam

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm/clause"
)

type PresenceUserSummary struct {
	UserID         string   `json:"user_id"`
	Email          string   `json:"email"`
	FullName       string   `json:"full_name"`
	LastSeenAt     string   `json:"last_seen_at"`
	ActiveSessions int      `json:"active_sessions"`
	OnlineWindows  []string `json:"online_windows"`
}

type PresenceSummary struct {
	OnlineUsers5m  int                   `json:"online_users_5m"`
	OnlineUsers15m int                   `json:"online_users_15m"`
	ActiveSessions int                   `json:"active_sessions"`
	Users          []PresenceUserSummary `json:"users"`
	GeneratedAt    string                `json:"generated_at"`
}

func (s *Service) TouchSessionPresence(ctx context.Context, principal *Principal, rawToken, userAgent, ipAddress string) error {
	if principal == nil || strings.TrimSpace(rawToken) == "" {
		return nil
	}
	now := time.Now().UTC()
	sessionKey := s.tokens.HashToken(strings.TrimSpace(rawToken))
	record := &SessionPresenceRecord{
		UserID:         principal.UserID,
		OrganizationID: principal.OrganizationID,
		SessionKey:     sessionKey,
		UserAgent:      truncateString(strings.TrimSpace(userAgent), 512),
		IPAddress:      truncateString(strings.TrimSpace(ipAddress), 128),
		LastSeenAt:     now,
		ExpiresAt:      principal.ExpiresAt.UTC(),
	}
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "session_key"}},
			DoUpdates: clause.Assignments(map[string]any{
				"user_id":         record.UserID,
				"organization_id": record.OrganizationID,
				"user_agent":      record.UserAgent,
				"ip_address":      record.IPAddress,
				"last_seen_at":    record.LastSeenAt,
				"expires_at":      record.ExpiresAt,
				"updated_at":      now,
			}),
		}).
		Create(record).Error
}

func (s *Service) GetPresenceSummary(ctx context.Context, principal *Principal) (*PresenceSummary, error) {
	if principal == nil {
		return nil, fmt.Errorf("principal is required")
	}
	now := time.Now().UTC()
	cutoff15m := now.Add(-15 * time.Minute)
	cutoff5m := now.Add(-5 * time.Minute)

	if err := s.db.WithContext(ctx).
		Where("expires_at <= ? OR last_seen_at <= ?", now, now.Add(-24*time.Hour)).
		Delete(&SessionPresenceRecord{}).Error; err != nil {
		return nil, err
	}

	var sessions []SessionPresenceRecord
	if err := s.db.WithContext(ctx).
		Where("organization_id = ? AND expires_at > ? AND last_seen_at >= ?", principal.OrganizationID, now, cutoff15m).
		Order("last_seen_at desc").
		Find(&sessions).Error; err != nil {
		return nil, err
	}

	userIDs := make([]string, 0, len(sessions))
	seenUserIDs := map[string]struct{}{}
	for _, session := range sessions {
		if _, exists := seenUserIDs[session.UserID]; exists {
			continue
		}
		seenUserIDs[session.UserID] = struct{}{}
		userIDs = append(userIDs, session.UserID)
	}

	userByID := map[string]User{}
	if len(userIDs) > 0 {
		var users []User
		if err := s.db.WithContext(ctx).Where("id IN ?", userIDs).Find(&users).Error; err != nil {
			return nil, err
		}
		for _, user := range users {
			userByID[user.ID] = user
		}
	}

	type aggregate struct {
		lastSeen  time.Time
		sessions  int
		online5m  bool
		online15m bool
	}
	aggregates := map[string]*aggregate{}
	for _, session := range sessions {
		item := aggregates[session.UserID]
		if item == nil {
			item = &aggregate{}
			aggregates[session.UserID] = item
		}
		item.sessions++
		if session.LastSeenAt.After(item.lastSeen) {
			item.lastSeen = session.LastSeenAt
		}
		if session.LastSeenAt.After(cutoff5m) {
			item.online5m = true
		}
		item.online15m = true
	}

	users := make([]PresenceUserSummary, 0, len(aggregates))
	online5m := 0
	online15m := 0
	for userID, item := range aggregates {
		if item.online5m {
			online5m++
		}
		if item.online15m {
			online15m++
		}
		user := userByID[userID]
		windows := make([]string, 0, 2)
		if item.online5m {
			windows = append(windows, "5m")
		}
		if item.online15m {
			windows = append(windows, "15m")
		}
		users = append(users, PresenceUserSummary{
			UserID:         userID,
			Email:          user.Email,
			FullName:       firstNonEmpty(strings.TrimSpace(user.FullName), strings.TrimSpace(user.Username), strings.TrimSpace(user.Email)),
			LastSeenAt:     item.lastSeen.Format(time.RFC3339),
			ActiveSessions: item.sessions,
			OnlineWindows:  windows,
		})
	}

	sort.Slice(users, func(i, j int) bool {
		return users[i].LastSeenAt > users[j].LastSeenAt
	})

	return &PresenceSummary{
		OnlineUsers5m:  online5m,
		OnlineUsers15m: online15m,
		ActiveSessions: len(sessions),
		Users:          users,
		GeneratedAt:    now.Format(time.RFC3339),
	}, nil
}

func truncateString(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit]
}
