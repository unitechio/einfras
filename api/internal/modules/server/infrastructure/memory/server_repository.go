package servermemory

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	domain "einfra/api/internal/modules/server/domain"
)

type Repository struct {
	mu      sync.RWMutex
	servers map[string]*domain.Server
}

func NewRepository() *Repository {
	return &Repository{
		servers: make(map[string]*domain.Server),
	}
}

func (r *Repository) Create(_ context.Context, server *domain.Server) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if server.ID == "" {
		server.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	if server.CreatedAt.IsZero() {
		server.CreatedAt = now
	}
	server.UpdatedAt = now
	r.servers[server.ID] = cloneServer(server)
	return nil
}

func (r *Repository) GetByID(_ context.Context, id string) (*domain.Server, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	server, ok := r.servers[id]
	if !ok {
		return nil, fmt.Errorf("server %q not found", id)
	}
	return cloneServer(server), nil
}

func (r *Repository) GetByIPAddress(_ context.Context, ip string) (*domain.Server, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, server := range r.servers {
		if strings.EqualFold(server.IPAddress, ip) {
			return cloneServer(server), nil
		}
	}
	return nil, fmt.Errorf("server with ip %q not found", ip)
}

func (r *Repository) List(_ context.Context, filter domain.ServerFilter) ([]*domain.Server, int64, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	filtered := make([]*domain.Server, 0, len(r.servers))
	for _, server := range r.servers {
		if filter.Status != "" && server.Status != filter.Status {
			continue
		}
		if filter.OS != "" && server.OS != filter.OS {
			continue
		}
		if filter.Location != "" && !strings.EqualFold(server.Location, filter.Location) {
			continue
		}
		if filter.Provider != "" && !strings.EqualFold(server.Provider, filter.Provider) {
			continue
		}
		if len(filter.Tags) > 0 && !hasAllTags(server.Tags, filter.Tags) {
			continue
		}
		filtered = append(filtered, cloneServer(server))
	}

	slices.SortFunc(filtered, func(a, b *domain.Server) int {
		return strings.Compare(a.Name, b.Name)
	})

	total := int64(len(filtered))
	page := max(filter.Page, 1)
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	start := (page - 1) * pageSize
	if start >= len(filtered) {
		return []*domain.Server{}, total, nil
	}
	end := min(start+pageSize, len(filtered))
	return filtered[start:end], total, nil
}

func (r *Repository) Update(_ context.Context, server *domain.Server) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.servers[server.ID]; !ok {
		return fmt.Errorf("server %q not found", server.ID)
	}
	server.UpdatedAt = time.Now().UTC()
	r.servers[server.ID] = cloneServer(server)
	return nil
}

func (r *Repository) UpdateStatus(_ context.Context, id string, status domain.ServerStatus) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	server, ok := r.servers[id]
	if !ok {
		return fmt.Errorf("server %q not found", id)
	}
	server.Status = status
	server.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *Repository) Delete(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.servers[id]; !ok {
		return fmt.Errorf("server %q not found", id)
	}
	delete(r.servers, id)
	return nil
}

func cloneServer(server *domain.Server) *domain.Server {
	if server == nil {
		return nil
	}
	copyServer := *server
	copyServer.Tags = append([]string(nil), server.Tags...)
	return &copyServer
}

func hasAllTags(current, wanted []string) bool {
	if len(wanted) == 0 {
		return true
	}
	set := make(map[string]struct{}, len(current))
	for _, tag := range current {
		set[strings.ToLower(tag)] = struct{}{}
	}
	for _, tag := range wanted {
		if _, ok := set[strings.ToLower(tag)]; !ok {
			return false
		}
	}
	return true
}
