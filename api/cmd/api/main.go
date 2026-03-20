// @title Ebetool API
// @version 1.0
// @description This is a sample server for a content management system.
// @host localhost:8080
// @BasePath /
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"net/http"

	"einfra/api/internal/apps/api-gateway/router_http"
	"einfra/api/internal/http/handler"
	"einfra/api/internal/modules/auth/domain"
	"einfra/api/internal/repository"
	"einfra/api/internal/shared/infra/database"
	storage "einfra/api/internal/shared/infra/filestorage"
	"einfra/api/internal/shared/platform/config"
	"einfra/api/internal/shared/platform/logger"
	"einfra/api/internal/usecase"
	"einfra/api/pkg/docker"
	"einfra/api/pkg/security"
	"einfra/api/pkg/ssh"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	env := os.Getenv("APP_ENV")
	configFile := ".env.dev"
	if env == "production" {
		configFile = ".env.production"
	}
	log.Printf("📦 Loading configuration from %s", configFile)

	cfg, err := config.LoadConfig(configFile)
	if err != nil {
		log.Fatalf("❌ Failed to load configuration: %v", err)
	}

	// --- Logger ---
	_ = logger.NewZapLogger(logger.LoggerConfig{
		Level:      logger.LogLevel(cfg.Logging.Level),
		OutputPath: cfg.Logging.FilePath,
		DevMode:    cfg.Server.Mode == "debug",
	})

	db, err := database.NewPostgresConnection(cfg.Database)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get database instance: %v", err)
	}
	defer sqlDB.Close()

	if cfg.Database.AutoMigrate {
		if err := database.AutoMigrate(db); err != nil {
			log.Fatalf("Could not run database migrations: %v\n", err)
		}
		if err := database.SeedDefaultData(db); err != nil {
			log.Printf("Warning: Failed to seed default data: %v", err)
		}
	}

	jwtService := auth.NewJWTService(&cfg.Auth)
	storage, err := storage.NewMinioStorage(cfg.Minio)
	if err != nil {
		log.Fatalf("❌ Failed to initialize storage service: %v", err)
	}

	encryptionService, err := security.NewAESEncryption(cfg.Encryption.Key)
	if err != nil {
		log.Fatalf("❌ Failed to initialize encryption service: %v", err)
	}
	credentialAuditor := security.NewSimpleAuditor()

	// Repositories
	userRepo := repository.NewUserRepository(db)
	roleRepo := repository.NewRoleRepository(db)
	permissionRepo := repository.NewPermissionRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	authRepo := repository.NewAuthRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	loginAttemptRepo := repository.NewLoginAttemptRepository(db)
	systemSettingRepo := repository.NewSystemSettingRepository(db)
	featureFlagRepo := repository.NewFeatureFlagRepository(db)
	userSettingsRepo := repository.NewUserSettingsRepository(db)
	documentRepo := repository.NewDocumentRepository(db)
	authorizationRepo := repository.NewAuthorizationRepository(db)
	environmentRepo := repository.NewEnvironmentRepository(db)

	// Infrastructure Repositories
	serverRepo := repository.NewServerRepository(db, encryptionService, credentialAuditor)
	dockerRepo := repository.NewDockerHostRepository(db)
	dockerStackRepo := repository.NewDockerStackRepository(db)
	k8sRepo := repository.NewK8sClusterRepository(db)
	harborRepo := repository.NewHarborRegistryRepository(db)
	k8sBackupRepo := repository.NewK8sBackupRepository(db)
	imageDeploymentRepo := repository.NewImageDeploymentRepository(db)
	emailRepo := repository.NewEmailRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)
	notificationTemplateRepo := repository.NewNotificationTemplateRepository(db)
	notificationPrefRepo := repository.NewNotificationPreferenceRepository(db)
	licenseRepo := repository.NewLicenseRepository(db)
	imageRepo := repository.NewImageRepository(db)

	// Server Feature Repositories
	serverBackupRepo := repository.NewServerBackupRepository(db)
	serverServiceRepo := repository.NewServerServiceRepository(db)
	serverCronjobRepo := repository.NewServerCronjobRepository(db)
	serverNetworkRepo := repository.NewServerNetworkRepository(db)
	serverIPTableRepo := repository.NewServerIPTableRepository(db)

	// Usecases
	authUsecase := usecase.NewAuthUsecase(authRepo, userRepo, sessionRepo, loginAttemptRepo, nil, cfg.Auth, jwtService)
	userUsecase := usecase.NewUserUsecase(userRepo, roleRepo, authRepo, jwtService)
	roleUsecase := usecase.NewRoleUsecase(roleRepo)
	permissionUsecase := usecase.NewPermissionUsecase(permissionRepo)
	authorizationUsecase := usecase.NewAuthorizationUsecase(authorizationRepo, roleRepo, userRepo, environmentRepo)
	environmentUsecase := usecase.NewEnvironmentUsecase(environmentRepo)
	_ = authorizationUsecase
	_ = environmentUsecase
	auditUsecase := usecase.NewAuditUsecase(auditRepo)
	systemSettingUsecase := usecase.NewSystemSettingUsecase(systemSettingRepo)
	featureFlagUsecase := usecase.NewFeatureFlagUsecase(featureFlagRepo)
	userSettingsUsecase := usecase.NewUserSettingsUsecase(userSettingsRepo)
	documentUsecase := usecase.NewDocumentUsecase(documentRepo, storage)
	emailUsecase := usecase.NewEmailUsecase(emailRepo)
	notificationUsecase := usecase.NewNotificationUsecase(
		notificationRepo,
		notificationTemplateRepo,
		notificationPrefRepo,
		userRepo,
		emailUsecase,
		nil, // WebSocket hub - will be initialized later if needed
		nil, // Logger - will be initialized later if needed
	)
	licenseUsecase := usecase.NewLicenseUsecase(licenseRepo)
	imageUsecase := usecase.NewImageUsecase(imageRepo, cfg.Storage.ImagePath)

	// Tunnel Manager
	tunnelManager := ssh.NewTunnelManager()

	// Infrastructure Usecases
	serverUsecase := usecase.NewServerUsecase(serverRepo, tunnelManager)
	dockerUsecase := usecase.NewDockerUsecase(dockerRepo)
	kubernetesUsecase := usecase.NewKubernetesUsecase(k8sRepo)
	harborUsecase := usecase.NewHarborUsecase(harborRepo)
	k8sBackupUsecase := usecase.NewK8sBackupUsecase(k8sBackupRepo, k8sRepo)
	imageDeploymentUsecase := usecase.NewImageDeploymentUsecase(imageDeploymentRepo, kubernetesUsecase)

	// Docker Client
	dockerClient, err := docker.NewClient("unix:///var/run/docker.sock")
	if err != nil {
		log.Printf("⚠️  Warning: Failed to create Docker client: %v", err)
		// Continue without Docker support
	}
	if dockerClient != nil {
		defer dockerClient.Close()
	}

	// Docker Exec & Stats Usecases
	var dockerExecUsecase usecase.DockerExecUsecase
	var dockerStatsUsecase usecase.DockerStatsUsecase
	var dockerNetworkUsecase usecase.DockerNetworkUsecase
	var dockerImageUsecase usecase.DockerImageUsecase
	var logUsecase usecase.LogUsecase
	var eventUsecase usecase.EventUsecase
	var alertUsecase usecase.AlertUsecase
	if dockerClient != nil {
		dockerExecUsecase = usecase.NewDockerExecUsecase(dockerClient)
		dockerStatsUsecase = usecase.NewDockerStatsUsecase(dockerClient)
		dockerNetworkUsecase = usecase.NewDockerNetworkUsecase(dockerClient)
		dockerImageUsecase = usecase.NewDockerImageUsecase(dockerClient)
		logUsecase = usecase.NewLogUsecase(dockerClient)
		eventUsecase = usecase.NewEventUsecase(dockerClient)
		alertUsecase = usecase.NewAlertUsecase(dockerClient, notificationUsecase)

		// Start Alert Monitoring
		go alertUsecase.StartMonitoring(context.Background())
	}

	// Docker Stack & File Browser Usecases
	dockerStackUsecase := usecase.NewDockerStackUsecase(dockerStackRepo)
	fileBrowserUsecase := usecase.NewFileBrowserUsecase()

	// Server Feature Usecases (with tunnel support)
	serverUsecase = usecase.NewServerUsecase(serverRepo, tunnelManager)
	serverBackupUsecase := usecase.NewServerBackupUsecase(serverBackupRepo, serverRepo)
	serverServiceUsecase := usecase.NewServerServiceUsecase(serverServiceRepo, serverRepo)
	serverCronjobUsecase := usecase.NewServerCronjobUsecase(serverCronjobRepo, serverRepo)
	serverNetworkUsecase := usecase.NewServerNetworkUsecase(serverNetworkRepo, serverRepo)
	serverIPTableUsecase := usecase.NewServerIPTableUsecase(serverIPTableRepo, serverRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(authUsecase)
	userHandler := handler.NewUserHandler(userUsecase, roleUsecase)
	roleHandler := handler.NewRoleHandler(roleUsecase)
	permissionHandler := handler.NewPermissionHandler(permissionUsecase)
	auditHandler := handler.NewAuditHandler(auditUsecase)
	systemSettingHandler := handler.NewSystemSettingHandler(systemSettingUsecase)
	featureFlagHandler := handler.NewFeatureFlagHandler(featureFlagUsecase)
	userSettingsHandler := handler.NewUserSettingsHandler(userSettingsUsecase)
	documentHandler := handler.NewDocumentHandler(documentUsecase)
	pingHandler := handler.NewPingHandler(auditUsecase)
	emailHandler := handler.NewEmailHandler(emailUsecase)
	notificationHandler := handler.NewNotificationHandler(notificationUsecase, nil)
	licenseHandler := handler.NewLicenseHandler(licenseUsecase)
	websocketHandler := handler.NewWebSocketHandler(nil, cfg, jwtService)
	environmentHandler := handler.NewEnvironmentHandler(environmentUsecase)
	authorizationHandler := handler.NewAuthorizationHandler(authorizationUsecase)
	imageHandler := handler.NewImageHandler(imageUsecase)
	healthHandler := handler.NewHealthHandler()

	// Infrastructure Handlers
	serverHandler := handler.NewServerHandler(
		serverUsecase,
		serverBackupUsecase,
		serverServiceUsecase,
		serverCronjobUsecase,
		serverNetworkUsecase,
		serverIPTableUsecase,
	)
	dockerHandler := handler.NewDockerHandler(dockerUsecase)
	kubernetesHandler := handler.NewKubernetesHandler(kubernetesUsecase, k8sBackupUsecase)
	harborHandler := handler.NewHarborHandler(harborUsecase, imageDeploymentUsecase)

	// Docker Exec & Stats Handlers
	var dockerExecHandler *handler.DockerExecHandler
	var dockerStatsHandler *handler.DockerStatsHandler
	var dockerNetworkHandler *handler.DockerNetworkHandler
	var dockerImageHandler *handler.DockerImageHandler
	var logHandler *handler.LogHandler
	var eventHandler *handler.EventHandler
	if dockerExecUsecase != nil {
		dockerExecHandler = handler.NewDockerExecHandler(dockerExecUsecase)
		dockerStatsHandler = handler.NewDockerStatsHandler(dockerStatsUsecase)
		dockerNetworkHandler = handler.NewDockerNetworkHandler(dockerNetworkUsecase)
		dockerImageHandler = handler.NewDockerImageHandler(dockerImageUsecase)
		logHandler = handler.NewLogHandler(logUsecase)
		eventHandler = handler.NewEventHandler(eventUsecase)
	}

	// Docker Stack & File Browser Handlers
	dockerStackHandler := handler.NewDockerStackHandler(dockerStackUsecase)
	fileBrowserHandler := handler.NewFileBrowserHandler(fileBrowserUsecase)

	// Tunnel & Kubeconfig Handlers
	tunnelHandler := handler.NewTunnelHandler(tunnelManager)
	kubeconfigHandler := handler.NewKubeconfigHandler()

	r := router.InitRouter(cfg,
		authHandler,
		userHandler,
		roleHandler,
		permissionHandler,
		auditHandler,
		auditUsecase,
		documentHandler,
		systemSettingHandler,
		featureFlagHandler,
		userSettingsHandler,
		serverHandler,
		dockerHandler,
		dockerExecHandler,
		dockerStatsHandler,
		dockerStackHandler,
		dockerNetworkHandler,
		dockerImageHandler,
		fileBrowserHandler,
		logHandler,
		eventHandler,
		kubernetesHandler,
		harborHandler,
		pingHandler,
		emailHandler,
		notificationHandler,
		licenseHandler,
		websocketHandler,
		environmentHandler,
		authorizationHandler,
		imageHandler,
		healthHandler,
		tunnelHandler,
		kubeconfigHandler,
	)
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 600 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("🚀 Server starting on %s", srv.Addr)
	log.Printf("📖 Swagger: http://localhost:%d/swagger/index.html", cfg.Server.Port)
	log.Println("✅ Server is ready!")

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Failed to start server: %v", err)
		}
	}()

	// Graceful shutdown on context cancel (optional)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	<-ctx.Done()
}
