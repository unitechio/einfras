package managementapp

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

type StorageManager struct {
	servers    domain.ServerRepository
	disks      domain.ServerDiskRepository
	dispatcher AgentCommandDispatcher
}

func NewStorageManager(servers domain.ServerRepository, disks domain.ServerDiskRepository, dispatcher AgentCommandDispatcher) *StorageManager {
	return &StorageManager{servers: servers, disks: disks, dispatcher: dispatcher}
}

func (m *StorageManager) ListDisks(ctx context.Context, serverID string) ([]*domain.ServerDisk, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	return m.disks.ListByServerID(ctx, serverID)
}

func (m *StorageManager) RefreshDisks(ctx context.Context, serverID, userID string) (*agent.Command, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	cmd := "lsblk -J -b -o NAME,KNAME,TYPE,FSTYPE,SIZE,MOUNTPOINT,RM,STATE"
	return m.dispatcher.Dispatch(ctx, serverID, userID, cmd, 60, "disk-refresh:"+serverID)
}

func ParseDisks(serverID, output string) ([]*domain.ServerDisk, error) {
	type blockDevice struct {
		Name       string        `json:"name"`
		KName      string        `json:"kname"`
		Type       string        `json:"type"`
		FSType     string        `json:"fstype"`
		Size       int64         `json:"size"`
		MountPoint string        `json:"mountpoint"`
		RM         bool          `json:"rm"`
		State      string        `json:"state"`
		Children   []blockDevice `json:"children"`
	}
	var payload struct {
		BlockDevices []blockDevice `json:"blockdevices"`
	}
	if err := json.Unmarshal([]byte(output), &payload); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	var collect func(items []blockDevice, result *[]*domain.ServerDisk)
	collect = func(items []blockDevice, result *[]*domain.ServerDisk) {
		for _, item := range items {
			*result = append(*result, &domain.ServerDisk{
				ID:          uuid.NewString(),
				ServerID:    serverID,
				Name:        strings.TrimSpace(item.Name),
				Device:      "/dev/" + strings.TrimSpace(item.KName),
				Type:        item.Type,
				FileSystem:  item.FSType,
				MountPoint:  item.MountPoint,
				TotalBytes:  item.Size,
				FreeBytes:   0,
				UsedBytes:   0,
				IsRemovable: item.RM,
				State:       item.State,
				CreatedAt:   now,
				UpdatedAt:   now,
			})
			collect(item.Children, result)
		}
	}
	result := make([]*domain.ServerDisk, 0, len(payload.BlockDevices))
	collect(payload.BlockDevices, &result)
	return result, nil
}

func BuildProcessActionCommand(pid int, signal string) string {
	if signal == "" {
		signal = "TERM"
	}
	return fmt.Sprintf("kill -s %s %d", signal, pid)
}
