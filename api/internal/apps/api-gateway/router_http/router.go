package router

import (
	"time"

	"github.com/gin-gonic/gin"

	"einfra/api/internal/shared/platform/config"
	"einfra/api/internal/http/handler"
	"einfra/api/internal/apps/api-gateway/middleware_http"
	"einfra/api/internal/usecase"
)

func InitRouter(
	cfg *config.Config,
	authHandler *handler.AuthHandler,
	userHandler *handler.UserHandler,
	roleHandler *handler.RoleHandler,
	permissionHandler *handler.PermissionHandler,
	auditHandler *handler.AuditHandler,
	auditUsecase usecase.AuditUsecase,
	documentHandler *handler.DocumentHandler,
	systemSettingHandler *handler.SystemSettingHandler,
	featureFlagHandler *handler.FeatureFlagHandler,
	userSettingsHandler *handler.UserSettingsHandler,
	serverHandler *handler.ServerHandler,
	dockerHandler *handler.DockerHandler,
	dockerExecHandler *handler.DockerExecHandler,
	dockerStatsHandler *handler.DockerStatsHandler,
	dockerStackHandler *handler.DockerStackHandler,
	dockerNetworkHandler *handler.DockerNetworkHandler,
	dockerImageHandler *handler.DockerImageHandler,
	wsHandler *handler.DockerWebSocketHandler,
	swarmHandler *handler.DockerSwarmHandler,
	fileBrowserHandler *handler.FileBrowserHandler,
	logHandler *handler.LogHandler,
	eventHandler *handler.EventHandler,
	kubernetesHandler *handler.KubernetesHandler,
	harborHandler *handler.HarborHandler,
	pingHandler *handler.PingHandler,
	emailHandler *handler.EmailHandler,
	notificationHandler *handler.NotificationHandler,
	licenseHandler *handler.LicenseHandler,
	websocketHandler *handler.WebSocketHandler,
	environmentHandler *handler.EnvironmentHandler,
	authorizationHandler *handler.AuthorizationHandler,
	imageHandler *handler.ImageHandler,
	healthHandler *handler.HealthHandler,
	tunnelHandler *handler.TunnelHandler,
	kubeconfigHandler *handler.KubeconfigHandler,
) *gin.Engine {
	router := gin.Default()
	// jwtService := auth.NewJWTService(&cfg.Auth)

	router.Use(middleware.CorsMiddleware())
	router.Use(gin.Logger())
	router.Use(middleware.RecoveryMiddleware())
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.TimeoutMiddleware(30 * time.Second))

	// Health Check
	router.GET("/health", healthHandler.HealthCheck)

	// WebSocket
	router.GET("/ws", websocketHandler.HandleWebSocket)

	router.GET("/ping", pingHandler.Ping)

	v1 := router.Group("/api/v1")

	// Audit Log Middleware for all v1 routes (except auth maybe?)
	// v1.Use(middleware.AuditLog(auditUsecase))

	// Auth Routes
	auth := v1.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.POST("/logout", authHandler.Logout)
		auth.POST("/forgot-password", authHandler.ForgotPassword)
		auth.POST("/reset-password", authHandler.ResetPassword)
		auth.POST("/verify-email", authHandler.VerifyEmail)
	}

	// Protected Routes
	protected := v1.Group("")
	// protected.Use(middleware.AuthMiddleware(cfg.JWT.Secret)) // Uncomment when middleware is ready
	{
		// User Routes
		users := protected.Group("/users")
		{
			users.POST("", userHandler.Create)
			users.GET("", userHandler.List)
			users.GET("/:id", userHandler.Get)
			users.PUT("/:id", userHandler.Update)
			users.DELETE("/:id", userHandler.Delete)
			users.PUT("/:id/password", userHandler.ChangePassword)
			users.PUT("/:id/settings", userHandler.UpdateSettings)
			users.POST("/import", userHandler.ImportUsers)
			users.GET("/export", userHandler.ExportUsers)
		}

		// Role Routes
		roles := protected.Group("/roles")
		{
			roles.POST("", roleHandler.Create)
			roles.GET("", roleHandler.List)
			roles.GET("/:id", roleHandler.Get)
			roles.PUT("/:id", roleHandler.Update)
			roles.DELETE("/:id", roleHandler.Delete)
		}

		// Permission Routes
		permissions := protected.Group("/permissions")
		{
			permissions.POST("", permissionHandler.Create)
			permissions.GET("", permissionHandler.List)
			permissions.GET("/:id", permissionHandler.Get)
			permissions.PUT("/:id", permissionHandler.Update)
			permissions.DELETE("/:id", permissionHandler.Delete)
			permissions.GET("/resource/:resource", permissionHandler.GetByResource)

			// Authorization - Resource Permissions
			permissions.POST("/grant", authorizationHandler.GrantResourcePermission)
			permissions.POST("/revoke", authorizationHandler.RevokeResourcePermission)
			permissions.POST("/assign-role", authorizationHandler.AssignEnvironmentRole)
			permissions.DELETE("/environment-roles/:id", authorizationHandler.RemoveEnvironmentRole)
			permissions.POST("/cleanup", authorizationHandler.CleanupExpiredPermissions)
		}

		// Audit Routes
		audits := protected.Group("/audits")
		{
			audits.POST("/logs", auditHandler.Log)
			audits.GET("/logs", auditHandler.GetAll)
			audits.GET("/logs/:id", auditHandler.GetByID)
			audits.GET("/users/:user_id/logs", auditHandler.GetUserAuditLogs)
			audits.GET("/resources/:resource/:resource_id/logs", auditHandler.GetResourceAuditLogs)
			audits.GET("/statistics", auditHandler.GetStatistics)
			audits.POST("/cleanup", auditHandler.CleanupOldLogs)
			audits.GET("/export", auditHandler.ExportAuditLogs)
		}

		document := protected.Group("/documents")
		{
			// Document CRUD
			document.POST("/upload", documentHandler.UploadDocument)
			document.GET("/list", documentHandler.GetDocuments)
			document.GET("/entity/:type/:id", documentHandler.GetDocumentsByEntity)
			document.GET("/:id", documentHandler.GetDocumentByID)
			document.GET("/code/:code", documentHandler.GetDocumentByCode)
			document.GET("/view/:id", documentHandler.ViewDocument)
			document.GET("/view-url/:id", documentHandler.GetDocumentViewURL)
			document.PUT("/:id", documentHandler.UpdateDocument)
			document.DELETE("/:id", documentHandler.DeleteDocument)
			document.GET("/download/:id", documentHandler.DownloadDocument)

			// Permissions
			document.POST("/permissions", documentHandler.AddDocumentPermission)
			document.GET("/:id/permissions", documentHandler.GetDocumentPermissions)
			document.PUT("/permissions/:id", documentHandler.UpdateDocumentPermission)
			document.DELETE("/permissions/:id", documentHandler.DeleteDocumentPermission)

			// Comments
			document.POST("/comments", documentHandler.AddDocumentComment)
			document.GET("/:id/comments", documentHandler.GetDocumentComments)
			document.PUT("/comments/:id", documentHandler.UpdateDocumentComment)
			document.DELETE("/comments/:id", documentHandler.DeleteDocumentComment)

			// Versions
			document.GET("/:id/versions", documentHandler.GetDocumentVersions)
		}

		// User Settings Routes
		userSettings := protected.Group("/users/:userId/settings")
		{
			userSettings.GET("", userSettingsHandler.Get)
			userSettings.PUT("", userSettingsHandler.Update)
			userSettings.PATCH("", userSettingsHandler.Patch)
			userSettings.POST("/reset", userSettingsHandler.Reset)
		}

		// System Settings Routes
		systemSettings := protected.Group("/system-settings")
		{
			systemSettings.GET("", systemSettingHandler.GetAllSystemSettings)
			systemSettings.POST("", systemSettingHandler.CreateSystemSetting)
			systemSettings.GET("/key/:key", systemSettingHandler.GetSystemSettingByKey)
			systemSettings.GET("/category/:category", systemSettingHandler.GetSystemSettingsByCategory)
			systemSettings.PUT("/:id", systemSettingHandler.UpdateSystemSetting)
			systemSettings.DELETE("/:id", systemSettingHandler.DeleteSystemSetting)
		}

		// Feature Flags
		flags := protected.Group("/feature-flags")
		{
			flags.POST("", featureFlagHandler.CreateFeatureFlag)
			flags.GET("", featureFlagHandler.GetAllFeatureFlags)
			flags.GET("/name/:name", featureFlagHandler.GetFeatureFlagByName)
			flags.GET("/category/:category", featureFlagHandler.GetFeatureFlagsByCategory)
			flags.PUT("/:id", featureFlagHandler.UpdateFeatureFlag)
			flags.DELETE("/:id", featureFlagHandler.DeleteFeatureFlag)
		}

		// Infrastructure Management Routes
		servers := protected.Group("/servers")
		{
			servers.POST("", serverHandler.Create)
			servers.GET("", serverHandler.List)
			servers.GET("/:id", serverHandler.Get)
			servers.PUT("/:id", serverHandler.Update)
			servers.DELETE("/:id", serverHandler.Delete)
			servers.GET("/:id/metrics", serverHandler.GetMetrics)
			servers.POST("/:id/health-check", serverHandler.HealthCheck)

			// Server Backups
			servers.POST("/:id/backups", serverHandler.CreateBackup)
			servers.GET("/:id/backups", serverHandler.ListBackups)

			// Server Services
			servers.GET("/:id/services", serverHandler.ListServices)
			servers.GET("/:id/services/:serviceName", serverHandler.GetServiceStatus)
			servers.POST("/:id/services/:serviceName/action", serverHandler.PerformServiceAction)
			servers.GET("/:id/services/:serviceName/logs", serverHandler.GetServiceLogs)

			// Server Cronjobs
			servers.POST("/:id/cronjobs", serverHandler.CreateCronjob)
			servers.GET("/:id/cronjobs", serverHandler.ListCronjobs)

			// Server Network
			servers.GET("/:id/network/interfaces", serverHandler.GetNetworkInterfaces)
			servers.POST("/:id/network/check", serverHandler.CheckConnectivity)
			servers.POST("/:id/network/test-port", serverHandler.TestPort)
			servers.GET("/:id/network/history", serverHandler.GetConnectivityHistory)

			// Server IPTables
			servers.GET("/:id/iptables", serverHandler.ListIPTableRules)
			servers.POST("/:id/iptables", serverHandler.AddIPTableRule)
			servers.POST("/:id/iptables/apply", serverHandler.ApplyIPTableRules)
			servers.POST("/:id/iptables/backup", serverHandler.BackupIPTableConfig)
		}

		// Backup Management (non-server-specific routes)
		backups := protected.Group("/backups")
		{
			backups.GET("/:backupId", serverHandler.GetBackup)
			backups.POST("/:backupId/restore", serverHandler.RestoreBackup)
			backups.DELETE("/:backupId", serverHandler.DeleteBackup)
		}

		// Cronjob Management (non-server-specific routes)
		cronjobs := protected.Group("/cronjobs")
		{
			cronjobs.GET("/:cronjobId", serverHandler.GetCronjob)
			cronjobs.PUT("/:cronjobId", serverHandler.UpdateCronjob)
			cronjobs.DELETE("/:cronjobId", serverHandler.DeleteCronjob)
			cronjobs.POST("/:cronjobId/execute", serverHandler.ExecuteCronjob)
			cronjobs.GET("/:cronjobId/history", serverHandler.GetCronjobHistory)
		}

		// Docker Container Management
		dockerContainers := protected.Group("/docker/containers")
		{
			// Container Exec (Interactive Shell)
			dockerContainers.POST("/:id/exec", dockerExecHandler.CreateExec)
			dockerContainers.POST("/:id/command", dockerExecHandler.ExecuteCommand)

			// Container Stats
			dockerContainers.GET("/:id/stats", dockerStatsHandler.GetStatsStream) // WebSocket
			dockerContainers.GET("/:id/stats/once", dockerStatsHandler.GetStatsOnce)

			// Container Lifecycle
			dockerContainers.POST("/:id/pause", dockerStatsHandler.PauseContainer)
			dockerContainers.POST("/:id/unpause", dockerStatsHandler.UnpauseContainer)
			dockerContainers.POST("/:id/commit", dockerStatsHandler.CommitContainer)
		}

		// Docker Exec Management
		dockerExec := protected.Group("/docker/exec")
		{
			dockerExec.POST("/:execId/start", dockerExecHandler.StartExec)
			dockerExec.GET("/:execId/inspect", dockerExecHandler.InspectExec)
			dockerExec.POST("/:execId/resize", dockerExecHandler.ResizeExec)
		}

		// Docker Stack Management
		dockerStacks := protected.Group("/docker/stacks")
		{
			dockerStacks.POST("", dockerStackHandler.DeployStack)
			dockerStacks.GET("", dockerStackHandler.ListStacks)
			dockerStacks.GET("/:id", dockerStackHandler.GetStack)
			dockerStacks.PUT("/:id", dockerStackHandler.UpdateStack)
			dockerStacks.DELETE("/:id", dockerStackHandler.RemoveStack)
			dockerStacks.GET("/:id/logs", dockerStackHandler.GetStackLogs)
			dockerStacks.POST("/:id/start", dockerStackHandler.StartStack)
			dockerStacks.POST("/:id/stop", dockerStackHandler.StopStack)
		}

		// Docker Network Management
		dockerNetworks := protected.Group("/docker/networks")
		{
			dockerNetworks.POST("", dockerNetworkHandler.CreateNetwork)
			dockerNetworks.DELETE("/:id", dockerNetworkHandler.RemoveNetwork)
			dockerNetworks.GET("/:id", dockerNetworkHandler.InspectNetwork)
			dockerNetworks.POST("/:id/connect", dockerNetworkHandler.ConnectContainer)
			dockerNetworks.POST("/:id/disconnect", dockerNetworkHandler.DisconnectContainer)
		}

		// Docker Image Management
		dockerImages := protected.Group("/docker/images")
		{
			dockerImages.POST("/build", dockerImageHandler.BuildImage)
			dockerImages.POST("/push", dockerImageHandler.PushImage)
			dockerImages.GET("/:id", dockerImageHandler.InspectImage)
			dockerImages.DELETE("/:id", dockerImageHandler.RemoveImage)
		}

		dockerWS := protected.Group("/docker/ws")
		{
			dockerWS.GET("/servers/:server_id/containers/:container_id/logs", wsHandler.StreamContainerLogs)
			dockerWS.GET("/servers/:server_id/containers/:container_id/stats", wsHandler.StreamContainerStats)
			dockerWS.GET("/servers/:server_id/events", wsHandler.StreamDockerEvents)
			dockerWS.GET("/servers/:server_id/services/:service_id/logs", wsHandler.StreamServiceLogs)
			dockerWS.GET("/servers/:server_id/stacks/:stack_name/logs", wsHandler.StreamStackLogs)
			dockerWS.GET("/servers/:server_id/containers/:container_id/exec", wsHandler.ContainerExecWebSocket)
		}

		// Swarm HTTP routes
		swarm := protected.Group("/docker/servers/:server_id/swarm")
		{
			swarm.POST("/init", swarmHandler.InitSwarm)
			swarm.POST("/join", swarmHandler.JoinSwarm)
			swarm.POST("/leave", swarmHandler.LeaveSwarm)
			swarm.GET("", swarmHandler.InspectSwarm)

			swarm.POST("/services", swarmHandler.CreateService)
			swarm.GET("/services", swarmHandler.ListServices)
			swarm.POST("/services/:service_id/scale", swarmHandler.ScaleService)

			swarm.GET("/nodes", swarmHandler.ListNodes)
			swarm.POST("/nodes/:node_id/promote", swarmHandler.PromoteNode)
			swarm.POST("/nodes/:node_id/demote", swarmHandler.DemoteNode)

			swarm.POST("/secrets", swarmHandler.CreateSecret)
			swarm.GET("/secrets", swarmHandler.ListSecrets)
		}

		// File Browser (Volumes)
		fileBrowser := protected.Group("/volumes/:volume_name")
		{
			fileBrowser.GET("/browse", fileBrowserHandler.ListFiles)
			fileBrowser.POST("/upload", fileBrowserHandler.UploadFile)
			fileBrowser.GET("/download", fileBrowserHandler.DownloadFile)
			fileBrowser.DELETE("/files", fileBrowserHandler.DeleteFile)
			fileBrowser.POST("/mkdir", fileBrowserHandler.CreateFolder)
			fileBrowser.GET("/read", fileBrowserHandler.ReadFile)
		}

		// Log Streaming
		logs := protected.Group("/logs")
		{
			logs.GET("/containers/:id/stream", logHandler.StreamContainerLogs)
		}

		// Event Streaming
		events := protected.Group("/events")
		{
			events.GET("/stream", eventHandler.StreamEvents)
		}

		// IPTables Management (non-server-specific routes)
		iptables := protected.Group("/iptables")
		{
			iptables.PUT("/:ruleId", serverHandler.UpdateIPTableRule)
			iptables.DELETE("/:ruleId", serverHandler.DeleteIPTableRule)
			iptables.POST("/backups/:backupId/restore", serverHandler.RestoreIPTableConfig)
		}

		// Docker Management Routes
		docker := protected.Group("/docker")
		{
			// Docker Hosts
			docker.POST("/hosts", dockerHandler.CreateHost)
			docker.GET("/hosts", dockerHandler.ListHosts)
			docker.GET("/hosts/:id", dockerHandler.GetHost)
			docker.PUT("/hosts/:id", dockerHandler.UpdateHost)
			docker.DELETE("/hosts/:id", dockerHandler.DeleteHost)

			// Containers
			docker.GET("/hosts/:host_id/containers", dockerHandler.ListContainers)
			docker.POST("/hosts/:host_id/containers/:container_id/start", dockerHandler.StartContainer)
			docker.POST("/hosts/:host_id/containers/:container_id/stop", dockerHandler.StopContainer)
			docker.GET("/hosts/:host_id/containers/:container_id/logs", dockerHandler.GetContainerLogs)

			// Images
			docker.GET("/hosts/:host_id/images", dockerHandler.ListImages)
			docker.POST("/hosts/:host_id/images/pull", dockerHandler.PullImage)
		}

		// Kubernetes Management Routes
		k8s := protected.Group("/kubernetes")
		{
			// Clusters
			k8s.POST("/clusters", kubernetesHandler.CreateCluster)
			k8s.GET("/clusters", kubernetesHandler.ListClusters)
			k8s.GET("/clusters/:id", kubernetesHandler.GetCluster)
			k8s.PUT("/clusters/:id", kubernetesHandler.UpdateCluster)
			k8s.DELETE("/clusters/:id", kubernetesHandler.DeleteCluster)

			// Namespaces
			k8s.GET("/clusters/:cluster_id/namespaces", kubernetesHandler.ListNamespaces)

			// Deployments
			k8s.GET("/clusters/:cluster_id/deployments", kubernetesHandler.ListDeployments)
			k8s.POST("/clusters/:cluster_id/namespaces/:namespace/deployments/:name/scale", kubernetesHandler.ScaleDeployment)

			// Pods
			k8s.GET("/clusters/:cluster_id/pods", kubernetesHandler.ListPods)
			k8s.GET("/clusters/:cluster_id/namespaces/:namespace/pods/:pod_name/logs", kubernetesHandler.GetPodLogs)

			// Nodes
			k8s.GET("/clusters/:cluster_id/nodes", kubernetesHandler.ListNodes)
			// ConfigMaps
			k8s.GET("/clusters/:cluster_id/configmaps", kubernetesHandler.ListConfigMaps)

			// Secrets
			k8s.GET("/clusters/:cluster_id/secrets", kubernetesHandler.ListSecrets)

			// Ingresses
			k8s.GET("/clusters/:cluster_id/ingresses", kubernetesHandler.ListIngresses)

			// Backups
			k8s.POST("/clusters/:cluster_id/backups", kubernetesHandler.CreateBackup)
			k8s.GET("/clusters/:cluster_id/backups", kubernetesHandler.ListBackups)
			k8s.POST("/backups/:id/restore", kubernetesHandler.RestoreBackup)
		}

		// Harbor Management Routes
		harbor := protected.Group("/harbor")
		{
			// Registries
			harbor.POST("/registries", harborHandler.CreateRegistry)
			harbor.GET("/registries", harborHandler.ListRegistries)
			harbor.GET("/registries/:id", harborHandler.GetRegistry)
			harbor.PUT("/registries/:id", harborHandler.UpdateRegistry)
			harbor.DELETE("/registries/:id", harborHandler.DeleteRegistry)

			// Projects
			harbor.GET("/registries/:registry_id/projects", harborHandler.ListProjects)

			// Repositories
			harbor.GET("/registries/:registry_id/repositories", harborHandler.ListRepositories)

			// Artifacts
			harbor.GET("/registries/:registry_id/artifacts", harborHandler.ListArtifacts)

			// Vulnerability Scanning
			harbor.POST("/registries/:registry_id/scan", harborHandler.ScanArtifact)
			harbor.GET("/registries/:registry_id/scan-report", harborHandler.GetScanReport)

			// Image Deployment Tracking
			harbor.POST("/deployments", harborHandler.TrackDeployment)
			harbor.GET("/deployments/history", harborHandler.GetDeploymentHistory)
			harbor.GET("/deployments/:cluster_id/active", harborHandler.GetCurrentDeployments)
			harbor.POST("/deployments/:cluster_id/sync", harborHandler.SyncDeployments)
		}

		// Email Routes
		emails := protected.Group("/emails")
		{
			emails.POST("/send", emailHandler.SendEmail)
			emails.POST("/send-template", emailHandler.SendTemplateEmail)
			emails.POST("/send-bulk", emailHandler.SendBulkEmail)
			emails.POST("/send-with-attachment", emailHandler.SendEmailWithAttachment)
			emails.POST("/schedule", emailHandler.ScheduleEmail)
			emails.GET("/logs", emailHandler.GetEmailLogs)
			emails.GET("/logs/:id", emailHandler.GetEmailLog)
			emails.GET("/logs/:id/status", emailHandler.GetEmailStatus)
			emails.POST("/validate", emailHandler.ValidateEmail)
		}

		// Notification Routes
		notifications := protected.Group("/notifications")
		{
			notifications.GET("", notificationHandler.GetUserNotifications)
			notifications.GET("/:id", notificationHandler.GetByID)
			notifications.POST("", notificationHandler.Create)
			notifications.PUT("/:id/read", notificationHandler.MarkAsRead)
			notifications.PUT("/read-all", notificationHandler.MarkAllAsRead)
			notifications.GET("/unread-count", notificationHandler.GetUnreadCount)
			notifications.DELETE("/:id", notificationHandler.Delete)
		}

		// License Routes
		licenses := protected.Group("/licenses")
		{
			licenses.POST("/activate", licenseHandler.ActivateLicense)
			licenses.GET("/validate", licenseHandler.ValidateLicense)
			licenses.GET("/current", licenseHandler.GetCurrentLicense)
			licenses.GET("/usage", licenseHandler.GetUsageStatistics)
			licenses.POST("/upgrade", licenseHandler.UpgradeLicense)
		}

		// Admin License Routes
		adminLicenses := protected.Group("/admin/licenses")
		{
			adminLicenses.POST("", licenseHandler.CreateLicense)
			adminLicenses.GET("", licenseHandler.ListLicenses)
			adminLicenses.POST("/:license_key/suspend", licenseHandler.SuspendLicense)
			adminLicenses.POST("/:license_key/reactivate", licenseHandler.ReactivateLicense)
		}

		// WebSocket Stats (protected)
		protected.GET("/ws/stats", websocketHandler.GetStats)

		// Environment Routes
		environments := protected.Group("/environments")
		{
			environments.POST("", environmentHandler.Create)
			environments.GET("", environmentHandler.List)
			environments.GET("/:id", environmentHandler.Get)
			environments.PUT("/:id", environmentHandler.Update)
			environments.DELETE("/:id", environmentHandler.Delete)
		}

		// Authorization - User and Resource Permissions
		protected.GET("/users/:user_id/permissions", authorizationHandler.GetUserPermissions)
		protected.GET("/resources/:resource_type/:resource_id/permissions", authorizationHandler.GetResourcePermissions)

		// Image Routes
		images := protected.Group("/images")
		{
			images.POST("/upload", imageHandler.UploadImage)
		}

		// Tunnel management routes
		tunnels := protected.Group("/tunnels")
		{
			tunnels.POST("", tunnelHandler.CreateTunnel)
			tunnels.GET("", tunnelHandler.ListTunnels)
			tunnels.GET("/:id/stats", tunnelHandler.GetTunnelStats)
			tunnels.DELETE("/:id", tunnelHandler.StopTunnel)
			tunnels.POST("/stop-all", tunnelHandler.StopAllTunnels)
		}

		// Kubeconfig management routes
		kubeconfigs := protected.Group("/kubeconfigs")
		{
			kubeconfigs.POST("", kubeconfigHandler.UploadKubeconfig)
			kubeconfigs.GET("", kubeconfigHandler.ListKubeconfigs)
			kubeconfigs.GET("/:id", kubeconfigHandler.GetKubeconfig)
			kubeconfigs.DELETE("/:id", kubeconfigHandler.DeleteKubeconfig)
			kubeconfigs.POST("/:id/test", kubeconfigHandler.TestKubeconfig)
		}

		// Other routes (placeholders as I don't have handler methods)
		// customer, ocs, im, vehicle, operator, sql
	}

	return router
}
