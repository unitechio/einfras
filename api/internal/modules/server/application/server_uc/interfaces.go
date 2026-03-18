package usecase

import (
	"context"
)

// ServerUsecase defines the interface for Server operations
type ServerUsecase interface {
	// Add methods as needed
	ListServers(ctx context.Context) (interface{}, error)
	CreateServer(ctx context.Context, server interface{}) error
}

// ServerBackupUsecase defines the interface for Server backup operations
type ServerBackupUsecase interface {
	CreateBackup(ctx context.Context, serverID string) error
}

// ServerCronjobUsecase defines the interface for Server cronjob operations
type ServerCronjobUsecase interface {
	ManageCronjob(ctx context.Context, serverID string, config interface{}) error
}

// ServerIptableUsecase defines the interface for Server iptable operations
type ServerIptableUsecase interface {
	ManageIptable(ctx context.Context, serverID string, config interface{}) error
}

// ServerNetworkUsecase defines the interface for Server network operations
type ServerNetworkUsecase interface {
	GetNetworkInfo(ctx context.Context, serverID string) (interface{}, error)
}

// ServerServiceUsecase defines the interface for Server service operations
type ServerServiceUsecase interface {
	ManageService(ctx context.Context, serverID string, config interface{}) error
}

type AlertUsecase interface {
	StartMonitoring(ctx context.Context)
	CheckResources(ctx context.Context)
}
