package database

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"einfra/api/internal/domain"
	domentagent "einfra/api/internal/modules/agent/domain"
	serverdomain "einfra/api/internal/modules/server/domain"
	"einfra/api/internal/shared/platform/config"
)

func NewPostgresConnection(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host,
		cfg.Port,
		cfg.User,
		cfg.Password,
		cfg.Database,
		cfg.SSLMode,
	)

	var gormLogger logger.Interface
	if cfg.Debug {
		gormLogger = logger.Default.LogMode(logger.Info)
	} else {
		gormLogger = logger.Default.LogMode(logger.Silent)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                 gormLogger,
		SkipDefaultTransaction: true,
		PrepareStmt:            true,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("✅ Connected to PostgreSQL database: %s", cfg.User)
	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	log.Println("🔄 Running database migrations...")

	err := db.AutoMigrate(
		// Core auth
		&domain.User{},
		&domain.Role{},
		&domain.Permission{},
		&domain.RefreshToken{},
		&domain.Session{},
		&domain.LoginAttempt{},
		&domain.AuditLog{},
		&domain.Notification{},
		&domain.NotificationTemplate{},
		&domain.NotificationPreference{},

		// Multi-tenant (Phase 2)
		&domain.Organization{},
		&domain.OrgMember{},

		// Agent (Phase 1 additions)
		&domentagent.AgentToken{},
		&domentagent.Command{},
		&domentagent.CommandLog{},
		&domentagent.AgentInfo{},

		// Server / Infrastructure
		&serverdomain.Server{},
		&serverdomain.ServerBackup{},
		&serverdomain.ServerService{},
		&serverdomain.ServerCronjob{},
		&serverdomain.CronjobExecution{},
		&serverdomain.ServerIPTable{},
		&serverdomain.IPTableBackup{},
		&serverdomain.NetworkInterface{},
		&serverdomain.NetworkConnectivityCheck{},
	)

	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	log.Println("✅ Database migrations completed successfully")
	return nil
}

func SeedDefaultData(db *gorm.DB) error {
	log.Println("🌱 Seeding default data...")

	allPermissions := []domain.Permission{
		// User management
		{Name: "user.create", Description: "Create users", Resource: "user", Action: "create"},
		{Name: "user.read", Description: "Read users", Resource: "user", Action: "read"},
		{Name: "user.update", Description: "Update users", Resource: "user", Action: "update"},
		{Name: "user.delete", Description: "Delete users", Resource: "user", Action: "delete"},
		// Role management
		{Name: "role.create", Description: "Create roles", Resource: "role", Action: "create"},
		{Name: "role.read", Description: "Read roles", Resource: "role", Action: "read"},
		{Name: "role.update", Description: "Update roles", Resource: "role", Action: "update"},
		{Name: "role.delete", Description: "Delete roles", Resource: "role", Action: "delete"},
		// Server (infra) permissions
		{Name: "server:create", Description: "Add servers", Resource: "server", Action: "create", IsSystem: true},
		{Name: "server:read", Description: "View servers", Resource: "server", Action: "read", IsSystem: true},
		{Name: "server:delete", Description: "Remove servers", Resource: "server", Action: "delete", IsSystem: true},
		{Name: "server:command", Description: "Run commands on servers", Resource: "server", Action: "command", IsSystem: true},
		{Name: "server:token", Description: "Issue agent tokens", Resource: "server", Action: "token", IsSystem: true},
		// Container permissions
		{Name: "container:create", Description: "Deploy containers", Resource: "container", Action: "create", IsSystem: true},
		{Name: "container:delete", Description: "Remove containers", Resource: "container", Action: "delete", IsSystem: true},
		{Name: "container:read", Description: "View containers", Resource: "container", Action: "read", IsSystem: true},
		// Cluster permissions
		{Name: "cluster:read", Description: "View clusters", Resource: "cluster", Action: "read", IsSystem: true},
		{Name: "cluster:manage", Description: "Manage clusters", Resource: "cluster", Action: "manage", IsSystem: true},
		// Org permissions
		{Name: "org:manage", Description: "Manage organization settings", Resource: "org", Action: "manage", IsSystem: true},
		{Name: "member:invite", Description: "Invite org members", Resource: "member", Action: "invite", IsSystem: true},
		{Name: "member:remove", Description: "Remove org members", Resource: "member", Action: "remove", IsSystem: true},
		// Billing permissions
		{Name: "billing:read", Description: "View billing", Resource: "billing", Action: "read", IsSystem: true},
		{Name: "billing:manage", Description: "Manage billing", Resource: "billing", Action: "manage", IsSystem: true},
	}

	for _, perm := range allPermissions {
		var existing domain.Permission
		if err := db.Where("name = ?", perm.Name).First(&existing).Error; err == gorm.ErrRecordNotFound {
			if err := db.Create(&perm).Error; err != nil {
				return fmt.Errorf("failed to create permission %s: %w", perm.Name, err)
			}
		}
	}

	var adminRole domain.Role
	if err := db.Where("name = ?", "admin").First(&adminRole).Error; err == gorm.ErrRecordNotFound {
		adminRole = domain.Role{
			Name:        "admin",
			Description: "Administrator role with full access",
			IsSystem:    true,
			IsActive:    true,
		}
		if err := db.Create(&adminRole).Error; err != nil {
			return fmt.Errorf("failed to create admin role: %w", err)
		}

		var permissions []domain.Permission
		db.Find(&permissions)
		if err := db.Model(&adminRole).Association("Permissions").Append(permissions); err != nil {
			return fmt.Errorf("failed to assign permissions to admin role: %w", err)
		}
	}

	var memberRole domain.Role
	if err := db.Where("name = ?", "member").First(&memberRole).Error; err == gorm.ErrRecordNotFound {
		memberRole = domain.Role{
			Name:        "member",
			Description: "Standard org member role",
			IsSystem:    true,
			IsActive:    true,
		}
		if err := db.Create(&memberRole).Error; err != nil {
			return fmt.Errorf("failed to create member role: %w", err)
		}
		// Seed member permissions (read + command)
		var memberPerms []domain.Permission
		db.Where("name IN ?", []string{"server:read", "server:command", "container:read", "cluster:read"}).Find(&memberPerms)
		_ = db.Model(&memberRole).Association("Permissions").Append(memberPerms)
	}

	log.Println("✅ Default data seeded successfully")
	return nil
}

func InitDatabases(cfgs map[string]config.DatabaseConfig) (map[string]*gorm.DB, error) {
	connections := make(map[string]*gorm.DB)

	for name, dbCfg := range cfgs {
		conn, err := NewPostgresConnection(dbCfg)
		if err != nil {
			// Close already opened connections
			for _, c := range connections {
				sqlDB, _ := c.DB()
				if sqlDB != nil {
					_ = sqlDB.Close()
				}
			}
			return nil, fmt.Errorf("error connecting to %s: %w", name, err)
		}
		connections[name] = conn
		log.Printf("📊 Database '%s' registered successfully", name)
	}

	return connections, nil
}

func CloseAll(connections map[string]*gorm.DB) {
	for name, conn := range connections {
		sqlDB, err := conn.DB()
		if err != nil {
			log.Printf("⚠️  Error getting sqlDB for %s: %v", name, err)
			continue
		}
		if err := sqlDB.Close(); err != nil {
			log.Printf("⚠️  Error closing database %s: %v", name, err)
		} else {
			log.Printf("✅ Closed database connection: %s", name)
		}
	}
}
