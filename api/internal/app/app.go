package app

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	agentregistry "einfra/api/internal/modules/agent/application"
	agentdomain "einfra/api/internal/modules/agent/domain"
	agentgrpc "einfra/api/internal/modules/agent/infrastructure/grpcserver"
	agentpostgres "einfra/api/internal/modules/agent/infrastructure/repository"
	agenthandler "einfra/api/internal/modules/agent/interfaces"
	managementapp "einfra/api/internal/modules/server/application/management"
	serverdomain "einfra/api/internal/modules/server/domain"
	serverpostgres "einfra/api/internal/modules/server/infrastructure/postgres"
	serverhttp "einfra/api/internal/modules/server/interfaces/httpapi"
	"einfra/api/internal/platform/agentruntime/artifacts"
	"einfra/api/internal/platform/agentruntime/distribution"
	"einfra/api/internal/platform/loggingx"
	"einfra/api/internal/platform/observability"
	"einfra/api/internal/shared/platform/config"
)

type Runtime struct {
	server     *http.Server
	grpcServer *agentgrpc.Server
	grpcAddr   string
	db         *gorm.DB
	logCloser  interface{ Close() error }
}

func NewRuntime() (*Runtime, error) {
	cfg := config.MustLoad()
	logCloser, err := observability.Setup(cfg.Logging, cfg.ELK)
	if err != nil {
		return nil, fmt.Errorf("setup logging: %w", err)
	}
	db, err := openRuntimeDatabase(cfg.Database)
	if err != nil {
		_ = logCloser.Close()
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	if cfg.Database.AutoMigrate {
		if err := autoMigrateRuntime(db); err != nil {
			_ = logCloser.Close()
			return nil, fmt.Errorf("auto-migrate database: %w", err)
		}
	}
	artifactDistributor := distribution.New(resolveProjectRoot())
	if err := warmAgentArtifacts(artifactDistributor, cfg.AgentArtifacts.WarmTargets); err != nil {
		_ = logCloser.Close()
		return nil, fmt.Errorf("warm agent artifacts: %w", err)
	}

	hub := agentregistry.GetHub()

	commandRepo := agentpostgres.NewCommandRepository(db)
	pgAgentInfoRepo := agentpostgres.NewAgentInfoRepository(db)
	agentInfoRepo := agenthandler.AgentInfoReader(pgAgentInfoRepo)
	agentStatusRepo := agenthandler.AgentRepository(pgAgentInfoRepo)
	tokenRepo := agentpostgres.NewAgentTokenRepository(db)
	serverRepository := serverdomain.ServerRepository(serverpostgres.NewRepository(db))
	serviceRepository := serverpostgres.NewServiceRepository(db)
	networkRepository := serverpostgres.NewNetworkRepository(db)
	firewallRepository := serverpostgres.NewIPTableRepository(db)
	backupRepository := serverpostgres.NewBackupRepository(db)
	cronRepository := serverpostgres.NewCronRepository(db)
	resourceRepository := serverpostgres.NewResourceRepository(db)
	tokenService := agentregistry.NewTokenService(tokenRepo)
	projector := managementapp.NewResourceCommandProjector(commandRepo, serviceRepository, networkRepository, firewallRepository, backupRepository, resourceRepository)
	dispatcher := agentregistry.NewDispatcher(hub, commandRepo, agentregistry.NopMetrics{}).WithProjector(projector)
	serverService := managementapp.NewService(serverRepository, agentInfoRepo, hub)
	operationsService := managementapp.NewRemoteOperations(serverRepository, dispatcher)
	serviceManager := managementapp.NewServiceManager(serverRepository, serviceRepository, dispatcher)
	networkManager := managementapp.NewNetworkManager(serverRepository, networkRepository, dispatcher)
	firewallManager := managementapp.NewFirewallManager(serverRepository, firewallRepository, dispatcher)
	backupManager := managementapp.NewBackupManager(serverRepository, backupRepository, dispatcher)
	cronManager := managementapp.NewCronManager(serverRepository, cronRepository, dispatcher)
	observabilityManager := managementapp.NewObservabilityManager(serverRepository, resourceRepository, resourceRepository)
	storageManager := managementapp.NewStorageManager(serverRepository, resourceRepository, dispatcher)
	controlManager := managementapp.NewControlManager(serverRepository, dispatcher, observabilityManager, agentInfoRepo)

	serverHandler := serverhttp.NewHandler(serverService)
	catalogHandler := serverhttp.NewCatalogHandler()
	operationsHandler := serverhttp.NewOperationsHandler(operationsService)
	resourcesHandler := serverhttp.NewResourcesHandler(serviceManager, networkManager, firewallManager, backupManager, cronManager, storageManager, observabilityManager, controlManager)
	onboardingHandler := serverhttp.NewOnboardingHandler(tokenService, artifactDistributor, cfg.AgentArtifacts)
	commandHandler := agenthandler.NewCommandHandler(dispatcher, commandRepo)
	agentWSHandler := agenthandler.NewAgentWSHandler(hub, dispatcher, agentStatusRepo, tokenService, observabilityManager)
	clientWSHandler := agenthandler.NewClientWSHandler(hub)
	agentStatusHandler := agenthandler.NewAgentStatusHandler(hub, agentInfoRepo)
	tokenHandler := agenthandler.NewAgentTokenHandler(tokenService)
	grpcServer := agentgrpc.New(hub, pgAgentInfoRepo, tokenService, commandRepo, nil, serverRepository)

	router := mux.NewRouter()
	router.Use(observability.RequestIDMiddleware)
	router.Use(observability.RecoveryMiddleware)
	router.Use(observability.HTTPLoggingMiddleware)
	router.Use(jsonMiddleware)
	router.HandleFunc("/health", healthHandler).Methods(http.MethodGet)
	serverHandler.Register(router)
	catalogHandler.Register(router)
	operationsHandler.Register(router)
	resourcesHandler.Register(router)
	onboardingHandler.Register(router)

	router.HandleFunc("/ws/agent/{server_id}", agentWSHandler.HandleAgentWS).Methods(http.MethodGet)
	router.HandleFunc("/ws/client/{server_id}", clientWSHandler.HandleClientWS).Methods(http.MethodGet)
	router.HandleFunc("/v1/servers/{id}/commands", commandHandler.CreateCommand).Methods(http.MethodPost)
	router.HandleFunc("/v1/servers/{id}/commands", commandHandler.ListCommands).Methods(http.MethodGet)
	router.HandleFunc("/v1/servers/{id}/commands/{cmd_id}", commandHandler.GetCommand).Methods(http.MethodGet)
	router.HandleFunc("/v1/servers/{id}/commands/{cmd_id}", commandHandler.CancelCommand).Methods(http.MethodDelete)
	router.HandleFunc("/v1/servers/{id}/agent-token", tokenHandler.IssueToken).Methods(http.MethodPost)
	router.HandleFunc("/v1/servers/{id}/agent-status", agentStatusHandler.GetAgentStatus).Methods(http.MethodGet)
	router.HandleFunc("/v1/agents/online", agentStatusHandler.ListOnlineServers).Methods(http.MethodGet)

	return &Runtime{
		db:         db,
		grpcServer: grpcServer,
		grpcAddr:   buildListenAddr(cfg.Server.Host, cfg.Server.GRPCPort),
		logCloser:  logCloser,
		server: &http.Server{
			Addr:         buildListenAddr(cfg.Server.Host, cfg.Server.Port),
			Handler:      router,
			ReadTimeout:  cfg.Server.ReadTimeout,
			WriteTimeout: cfg.Server.WriteTimeout,
			IdleTimeout:  60 * time.Second,
		},
	}, nil
}

func warmAgentArtifacts(distributor *distribution.Distributor, warmTargets []string) error {
	targets := make([]artifacts.Target, 0, len(warmTargets))
	for _, item := range warmTargets {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		parts := strings.SplitN(item, "/", 2)
		target := artifacts.Target{OS: parts[0]}
		if len(parts) > 1 {
			target.Arch = parts[1]
		}
		target = artifacts.NormalizeTarget(target.OS, target.Arch)
		if err := artifacts.ValidateTarget(target); err != nil {
			return fmt.Errorf("invalid warm target %q: %w", item, err)
		}
		targets = append(targets, target)
	}
	if len(targets) == 0 {
		targets = []artifacts.Target{
			artifacts.NormalizeTarget("linux", "amd64"),
			artifacts.NormalizeTarget("linux", "arm64"),
		}
	}
	loggingx.New("api").Info(log.Logger, "artifact-warmup", "", "starting", map[string]any{
		"targets": targets,
	})
	return distributor.Warmup(targets)
}

func resolveProjectRoot() string {
	if env := strings.TrimSpace(os.Getenv("EINFRA_PROJECT_ROOT")); env != "" {
		return env
	}
	if wd, err := os.Getwd(); err == nil {
		current := wd
		for {
			if _, err := os.Stat(current + string(os.PathSeparator) + "go.mod"); err == nil {
				return current
			}
			parent := filepath.Dir(current)
			if parent == current {
				break
			}
			current = parent
		}
	}
	return "."
}

func (r *Runtime) Run(ctx context.Context) error {
	errCh := make(chan error, 1)

	go func() {
		loggingx.New("api").Info(log.Logger, "http-listener", "", "listening", map[string]any{
			"addr": r.server.Addr,
		})
		if err := r.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	if r.grpcServer != nil && r.grpcAddr != "" {
		go func() {
			loggingx.New("api").Info(log.Logger, "grpc-listener", "", "listening", map[string]any{
				"addr": r.grpcAddr,
			})
			if err := r.grpcServer.Start(r.grpcAddr); err != nil {
				errCh <- err
			}
		}()
	}

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return r.Shutdown()
	}
}

func (r *Runtime) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if r.grpcServer != nil {
		r.grpcServer.Stop()
	}
	if err := r.server.Shutdown(ctx); err != nil {
		return err
	}
	if r.db != nil {
		sqlDB, err := r.db.DB()
		if err == nil {
			if closeErr := sqlDB.Close(); closeErr != nil {
				return closeErr
			}
		}
	}
	if r.logCloser != nil {
		return r.logCloser.Close()
	}
	return nil
}

func RunMain() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	runtime, err := NewRuntime()
	if err != nil {
		return err
	}
	return runtime.Run(ctx)
}

func buildListenAddr(host, port string) string {
	if strings.HasPrefix(port, ":") {
		if host == "" || host == "0.0.0.0" {
			return port
		}
		return host + port
	}
	if host == "" {
		return port
	}
	return host + ":" + port
}

func openRuntimeDatabase(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host,
		cfg.Port,
		cfg.User,
		cfg.Password,
		cfg.Database,
		cfg.SSLMode,
	)

	logMode := gormlogger.Silent
	if cfg.Debug {
		logMode = gormlogger.Info
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                 gormlogger.Default.LogMode(logMode),
		SkipDefaultTransaction: true,
		PrepareStmt:            true,
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)
	if err := sqlDB.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}

func autoMigrateRuntime(db *gorm.DB) error {
	return db.AutoMigrate(
		&serverdomain.Server{},
		&serverdomain.ServerBackup{},
		&serverdomain.ServerService{},
		&serverdomain.ServerIPTable{},
		&serverdomain.IPTableBackup{},
		&serverdomain.NetworkInterface{},
		&serverdomain.NetworkConnectivityCheck{},
		&serverdomain.ServerDisk{},
		&serverdomain.ServerMetricSample{},
		&serverdomain.ServerAuditLog{},
		&serverdomain.ServerCronjob{},
		&serverdomain.CronjobExecution{},
		&agentdomain.AgentInfo{},
		&agentdomain.Command{},
		&agentdomain.CommandLog{},
		&agentdomain.AgentToken{},
	)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"ok","service":"einfra-api"}`))
}

func jsonMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}
