package app

import (
	"context"
	"fmt"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog/log"

	"einfra/api/internal/platform/agentruntime/config"
	"einfra/api/internal/platform/agentruntime/grpcclient"
	"einfra/api/internal/platform/agentruntime/heartbeat"
	agentruntimelogging "einfra/api/internal/platform/agentruntime/logging"
	"einfra/api/internal/platform/agentruntime/updater"
	"einfra/api/internal/platform/loggingx"
)

func Run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logCloser, err := agentruntimelogging.Setup(cfg)
	if err != nil {
		return err
	}
	defer func() {
		_ = logCloser.Close()
	}()

	loggingx.New("agent").Info(log.Logger, "runtime-start", cfg.ServerID, "starting", map[string]any{
		"version":           cfg.Version,
		"mode":              cfg.Mode,
		"control_plane_url": cfg.PrimaryControlPlaneURL(),
		"grpc_targets":      cfg.GRPCTargets(),
	})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	client := grpcclient.NewGRPC(cfg)
	defer client.Close()

	hb := heartbeat.New(client, cfg, cfg.HeartbeatInterval)
	go hb.Start(ctx)
	go client.Connect(ctx)
	go updater.New(cfg, func(version string) {
		loggingx.New("agent").Info(log.Logger, "auto-update", cfg.ServerID, "restart-requested", map[string]any{
			"version": version,
		})
		stop()
	}).Start(ctx)

	<-ctx.Done()
	loggingx.New("agent").Info(log.Logger, "runtime-stop", cfg.ServerID, "stopping", map[string]any{})
	return nil
}

func MustRun() {
	if err := Run(); err != nil {
		panic(fmt.Sprintf("agent runtime failed: %v", err))
	}
}
