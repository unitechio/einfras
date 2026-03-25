package managementapp

import (
	"context"
	"testing"

	domain "einfra/api/internal/modules/server/domain"
	servermemory "einfra/api/internal/modules/server/infrastructure/memory"
)

type noopOnlineChecker struct{}

func (noopOnlineChecker) IsAnyTransportOnline(string) bool { return false }

func TestRegisterServerRejectsDuplicateNonLoopbackIP(t *testing.T) {
	repo := servermemory.NewRepository()
	service := NewService(repo, nil, noopOnlineChecker{})

	first := &domain.Server{
		Name:           "server-a",
		Hostname:       "server-a",
		IPAddress:      "10.10.10.10",
		OS:             domain.ServerOSLinux,
		ConnectionMode: domain.ServerConnectionModeAgent,
	}
	if err := service.RegisterServer(context.Background(), first); err != nil {
		t.Fatalf("register first server: %v", err)
	}

	second := &domain.Server{
		Name:           "server-b",
		Hostname:       "server-b",
		IPAddress:      "10.10.10.10",
		OS:             domain.ServerOSLinux,
		ConnectionMode: domain.ServerConnectionModeAgent,
	}
	if err := service.RegisterServer(context.Background(), second); err == nil {
		t.Fatalf("expected duplicate non-loopback ip to be rejected")
	}
}

func TestRegisterServerAllowsDuplicateLoopbackIP(t *testing.T) {
	repo := servermemory.NewRepository()
	service := NewService(repo, nil, noopOnlineChecker{})

	first := &domain.Server{
		Name:           "local-ubuntu-a",
		Hostname:       "local-ubuntu-a",
		IPAddress:      "127.0.0.1",
		OS:             domain.ServerOSLinux,
		ConnectionMode: domain.ServerConnectionModeAgent,
	}
	if err := service.RegisterServer(context.Background(), first); err != nil {
		t.Fatalf("register first loopback server: %v", err)
	}

	second := &domain.Server{
		Name:           "local-ubuntu-b",
		Hostname:       "local-ubuntu-b",
		IPAddress:      "127.0.0.1",
		OS:             domain.ServerOSLinux,
		ConnectionMode: domain.ServerConnectionModeAgent,
	}
	if err := service.RegisterServer(context.Background(), second); err != nil {
		t.Fatalf("expected duplicate loopback ip to be allowed, got: %v", err)
	}
}
