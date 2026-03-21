package app

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"einfra/api/internal/platform/agentruntime/config"
	"einfra/api/internal/platform/agentruntime/grpcclient"
	"einfra/api/internal/platform/agentruntime/heartbeat"
)

func Run() error {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)

	cfg := config.Load()
	log.Printf("[agent] EINFRA Agent v%s starting", cfg.Version)
	log.Printf("[agent] server_id=%s -> %s", cfg.ServerID, cfg.ControlPlaneURL)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	client := grpcclient.NewGRPC(cfg)
	defer client.Close()

	hb := heartbeat.New(client, cfg, cfg.HeartbeatInterval)
	go hb.Start(ctx)
	go client.Connect(ctx)

	<-ctx.Done()
	log.Printf("[agent] shutdown requested")
	return nil
}
