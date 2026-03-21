package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	agentregistry "einfra/api/internal/modules/agent/application"
	agentdomain "einfra/api/internal/modules/agent/domain"
	agentpostgres "einfra/api/internal/modules/agent/infrastructure/repository"
	agenthandler "einfra/api/internal/modules/agent/interfaces"
	managementapp "einfra/api/internal/modules/server/application/management"
	serverdomain "einfra/api/internal/modules/server/domain"
	serverpostgres "einfra/api/internal/modules/server/infrastructure/postgres"
	serverhttp "einfra/api/internal/modules/server/interfaces/httpapi"
	"einfra/api/internal/shared/platform/config"
)

type Runtime struct {
	server *http.Server
	db     *gorm.DB
}

func NewRuntime() (*Runtime, error) {
	cfg := config.MustLoad()
	db, err := openRuntimeDatabase(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	if cfg.Database.AutoMigrate {
		if err := autoMigrateRuntime(db); err != nil {
			return nil, fmt.Errorf("auto-migrate database: %w", err)
		}
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
	onboardingHandler := serverhttp.NewOnboardingHandler(tokenService)
	commandHandler := agenthandler.NewCommandHandler(dispatcher, commandRepo)
	agentWSHandler := agenthandler.NewAgentWSHandler(hub, dispatcher, agentStatusRepo, tokenService, observabilityManager)
	clientWSHandler := agenthandler.NewClientWSHandler(hub)
	agentStatusHandler := agenthandler.NewAgentStatusHandler(hub, agentInfoRepo)
	tokenHandler := agenthandler.NewAgentTokenHandler(tokenService)

	router := mux.NewRouter()
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
		db: db,
		server: &http.Server{
			Addr:         buildListenAddr(cfg.Server.Host, cfg.Server.Port),
			Handler:      router,
			ReadTimeout:  cfg.Server.ReadTimeout,
			WriteTimeout: cfg.Server.WriteTimeout,
			IdleTimeout:  60 * time.Second,
		},
	}, nil
}

func (r *Runtime) Run(ctx context.Context) error {
	errCh := make(chan error, 1)

	go func() {
		log.Printf("EINFRA API listening on %s", r.server.Addr)
		if err := r.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

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
	if err := r.server.Shutdown(ctx); err != nil {
		return err
	}
	if r.db != nil {
		sqlDB, err := r.db.DB()
		if err == nil {
			return sqlDB.Close()
		}
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
