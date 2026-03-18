package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
)

// Config holds all the configuration for the application
// @Description Application configuration structure
type Config struct {
	Server         ServerConfig   `validate:"required"`
	Database       DatabaseConfig `validate:"required"`
	Auth           AuthConfig     `validate:"required"`
	SMTP           SmtpConfig
	Storage        StorageConfig
	Infrastructure InfrastructureConfig
	Monitoring     MonitoringConfig
	Logging        LoggingConfig
	RateLimit      RateLimitConfig
	Redis          RedisConfig
	Minio          MinioConfig
	Encryption     EncryptionConfig
	ELK            ELKConfig
	NATS           NATSConfig
}

type NATSConfig struct {
	URL string `example:"nats://localhost:4222"`
}

type ELKConfig struct {
	ElasticAPMEndpoint string `example:"http://localhost:8200"`
}

// ServerConfig holds the server configuration
type ServerConfig struct {
	Port            string        `validate:"required" example:":8080"`
	GRPCPort        string        `example:":50051"` // gRPC agent server port
	Host            string        `example:"0.0.0.0"`
	ReadTimeout     time.Duration `example:"30s"`
	WriteTimeout    time.Duration `example:"30s"`
	ShutdownTimeout time.Duration `example:"10s"`
	Mode            string        `validate:"oneof=debug release test" example:"release"`
}

// DatabaseConfig holds the database configuration
type DatabaseConfig struct {
	Host            string `validate:"required" example:"localhost"`
	Port            int    `validate:"required" example:"5432"`
	User            string `validate:"required" example:"einfra"`
	Password        string `validate:"required" example:"password"`
	Database        string `validate:"required" example:"einfra_crm"`
	SSLMode         string `example:"disable"`
	Debug           bool   `example:"false"`
	MaxOpenConns    int    `example:"25"`
	MaxIdleConns    int    `example:"5"`
	ConnMaxLifetime int    `example:"300"` // seconds
	AutoMigrate     bool   `example:"true"`
}

// AuthConfig holds the authentication configuration
type AuthConfig struct {
	JWTSecret              string `validate:"required"`
	JWTExpiration          int    `example:"3600"`   // seconds
	RefreshTokenExpiry     int    `example:"604800"` // 7 days in seconds
	PasswordMinLength      int    `example:"8"`
	PasswordRequireSpecial bool   `example:"true"`
	Google                 GoogleOAuthConfig
	Azure                  AzureOAuthConfig
}

type GoogleOAuthConfig struct {
	ClientID     string   `example:"google-client-id"`
	ClientSecret string   `example:"google-client-secret"`
	RedirectURL  string   `example:"http://localhost:8080/auth/google/callback"`
	Scopes       []string `example:"email,profile"`
}

type AzureOAuthConfig struct {
	ClientID     string   `example:"azure-client-id"`
	ClientSecret string   `example:"azure-client-secret"`
	RedirectURL  string   `example:"http://localhost:8080/auth/azure/callback"`
	Scopes       []string `example:"User.Read"`
	Tenant       string   `example:"azure-tenant-id"`
}

// SmtpConfig holds the SMTP configuration
type SmtpConfig struct {
	Host       string `example:"smtp.gmail.com"`
	Port       int    `example:"587"`
	UserName   string `example:"noreply@einfra.com"`
	Password   string
	FromName   string `example:"noreply@einfra.com"`
	FromEmail  string `example:"noreply@einfra.com"`
	UseSSL     bool   `example:"false"`
	UseMSGraph bool   `example:"false"`
}

// StorageConfig holds the file storage configuration
type StorageConfig struct {
	ImagePath  string   `example:"./uploads/images"`
	MaxSizeMB  int      `example:"10"`
	AllowedExt []string `example:"jpg,png,gif"`
}

// InfrastructureConfig holds infrastructure provider configurations
type InfrastructureConfig struct {
	Docker DockerConfig
	K8s    K8sConfig
	Harbor HarborConfig
}

// DockerConfig holds Docker-specific configuration
type DockerConfig struct {
	DefaultHost    string `example:"unix:///var/run/docker.sock"`
	APIVersion     string `example:"1.43"`
	RequestTimeout int    `example:"30"` // seconds
	TLSVerify      bool   `example:"false"`
}

// K8sConfig holds Kubernetes-specific configuration
type K8sConfig struct {
	DefaultContext string `example:"default"`
	ConfigPath     string `example:"~/.kube/config"`
	RequestTimeout int    `example:"30"` // seconds
}

// HarborConfig holds Harbor-specific configuration
type HarborConfig struct {
	DefaultURL     string `example:"https://harbor.example.com"`
	Username       string `example:"admin"`
	Password       string
	RequestTimeout int  `example:"30"` // seconds
	Insecure       bool `example:"false"`
}

// MonitoringConfig holds monitoring and metrics configuration
type MonitoringConfig struct {
	Enabled        bool   `example:"true"`
	PrometheusPort string `example:":9090"`
	MetricsPath    string `example:"/metrics"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level      string `validate:"oneof=debug info warn error fatal" example:"info"`
	Format     string `validate:"oneof=json text" example:"json"`
	Output     string `example:"stdout"`
	FilePath   string `example:"./logs/app.log"`
	MaxSizeMB  int    `example:"100"`
	MaxBackups int    `example:"3"`
	MaxAgeDays int    `example:"28"`
	Compress   bool   `example:"true"`
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	Enabled        bool `example:"true"`
	RequestsPerMin int  `example:"100"`
	Burst          int  `example:"20"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string `example:"localhost"`
	Port     int    `example:"6379"`
	Password string
	DB       int `example:"0"`
	PoolSize int `example:"10"`
}

// MinioConfig holds MinIO configuration
type MinioConfig struct {
	Endpoint        string `example:"localhost:9000"`
	AccessKeyID     string `example:"minioadmin"`
	SecretAccessKey string
	UseSSL          bool   `example:"false"`
	BucketName      string `example:"einfra-crm"`
}

// EncryptionConfig holds encryption configuration for sensitive data
type EncryptionConfig struct {
	Key     string `validate:"required"`
	Version int    `example:"1"`
}

// LoadConfig loads the configuration from environment variables
func LoadConfig(configPath string) (*Config, error) {
	if err := godotenv.Load(configPath); err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
	}

	config := &Config{
		Server: ServerConfig{
			Port:            getEnv("SERVER_PORT", ":8080"),
			Host:            getEnv("SERVER_HOST", "0.0.0.0"),
			ReadTimeout:     getDurationEnv("SERVER_READ_TIMEOUT", 30*time.Second),
			WriteTimeout:    getDurationEnv("SERVER_WRITE_TIMEOUT", 30*time.Second),
			ShutdownTimeout: getDurationEnv("SERVER_SHUTDOWN_TIMEOUT", 10*time.Second),
			Mode:            getEnv("SERVER_MODE", "release"),
		},
		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getIntEnv("DB_PORT", 5432),
			User:            getEnv("DB_USER", "einfra"),
			Password:        getEnv("DB_PASSWORD", ""),
			Database:        getEnv("DB_NAME", "einfra_crm"),
			SSLMode:         getEnv("DB_SSLMODE", "disable"),
			MaxOpenConns:    getIntEnv("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getIntEnv("DB_MAX_IDLE_CONNS", 5),
			ConnMaxLifetime: getIntEnv("DB_CONN_MAX_LIFETIME", 300),
			AutoMigrate:     getBoolEnv("DB_AUTO_MIGRATE", true),
		},
		Auth: AuthConfig{
			JWTSecret:              getEnv("JWT_SECRET", ""),
			JWTExpiration:          getIntEnv("JWT_EXPIRATION", 3600),
			RefreshTokenExpiry:     getIntEnv("REFRESH_TOKEN_EXPIRY", 604800),
			PasswordMinLength:      getIntEnv("PASSWORD_MIN_LENGTH", 8),
			PasswordRequireSpecial: getBoolEnv("PASSWORD_REQUIRE_SPECIAL", true),
			Google: GoogleOAuthConfig{
				ClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
				ClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
				RedirectURL:  getEnv("GOOGLE_REDIRECT_URL", ""),
				Scopes:       getSliceEnv("GOOGLE_SCOPES", []string{"email", "profile"}),
			},
			Azure: AzureOAuthConfig{
				ClientID:     getEnv("AZURE_CLIENT_ID", ""),
				ClientSecret: getEnv("AZURE_CLIENT_SECRET", ""),
				RedirectURL:  getEnv("AZURE_REDIRECT_URL", ""),
				Scopes:       getSliceEnv("AZURE_SCOPES", []string{"User.Read"}),
				Tenant:       getEnv("AZURE_TENANT_ID", ""),
			},
		},
		SMTP: SmtpConfig{
			Host:       getEnv("SMTP_HOST", ""),
			Port:       getIntEnv("SMTP_PORT", 587),
			UserName:   getEnv("SMTP_USERNAME", ""),
			Password:   getEnv("SMTP_PASSWORD", ""),
			FromName:   getEnv("SMTP_FROM_NAME", ""),
			FromEmail:  getEnv("SMTP_FROM_EMAIL", ""),
			UseSSL:     getEnv("SMTP_USE_SSL", "false") == "true",
			UseMSGraph: getEnv("SMTP_USE_MSGRAPH", "false") == "true",
		},
		Storage: StorageConfig{
			ImagePath:  getEnv("STORAGE_IMAGE_PATH", "./uploads/images"),
			MaxSizeMB:  getIntEnv("STORAGE_MAX_SIZE_MB", 10),
			AllowedExt: getSliceEnv("STORAGE_ALLOWED_EXT", []string{"jpg", "jpeg", "png", "gif", "webp"}),
		},
		Infrastructure: InfrastructureConfig{
			Docker: DockerConfig{
				DefaultHost:    getEnv("DOCKER_HOST", "unix:///var/run/docker.sock"),
				APIVersion:     getEnv("DOCKER_API_VERSION", "1.43"),
				RequestTimeout: getIntEnv("DOCKER_TIMEOUT", 30),
				TLSVerify:      getBoolEnv("DOCKER_TLS_VERIFY", false),
			},
			K8s: K8sConfig{
				DefaultContext: getEnv("K8S_CONTEXT", "default"),
				ConfigPath:     getEnv("K8S_CONFIG_PATH", "~/.kube/config"),
				RequestTimeout: getIntEnv("K8S_TIMEOUT", 30),
			},
			Harbor: HarborConfig{
				DefaultURL:     getEnv("HARBOR_URL", ""),
				Username:       getEnv("HARBOR_USERNAME", "admin"),
				Password:       getEnv("HARBOR_PASSWORD", ""),
				RequestTimeout: getIntEnv("HARBOR_TIMEOUT", 30),
				Insecure:       getBoolEnv("HARBOR_INSECURE", false),
			},
		},
		Monitoring: MonitoringConfig{
			Enabled:        getBoolEnv("MONITORING_ENABLED", true),
			PrometheusPort: getEnv("PROMETHEUS_PORT", ":9090"),
			MetricsPath:    getEnv("METRICS_PATH", "/metrics"),
		},
		Logging: LoggingConfig{
			Level:      getEnv("LOG_LEVEL", "info"),
			Format:     getEnv("LOG_FORMAT", "json"),
			Output:     getEnv("LOG_OUTPUT", "stdout"),
			FilePath:   getEnv("LOG_FILE_PATH", "./logs/app.log"),
			MaxSizeMB:  getIntEnv("LOG_MAX_SIZE_MB", 100),
			MaxBackups: getIntEnv("LOG_MAX_BACKUPS", 3),
			MaxAgeDays: getIntEnv("LOG_MAX_AGE_DAYS", 28),
			Compress:   getBoolEnv("LOG_COMPRESS", true),
		},
		RateLimit: RateLimitConfig{
			Enabled:        getBoolEnv("RATE_LIMIT_ENABLED", true),
			RequestsPerMin: getIntEnv("RATE_LIMIT_REQUESTS_PER_MIN", 100),
			Burst:          getIntEnv("RATE_LIMIT_BURST", 20),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getIntEnv("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getIntEnv("REDIS_DB", 0),
			PoolSize: getIntEnv("REDIS_POOL_SIZE", 10),
		},
		Minio: MinioConfig{
			Endpoint:        getEnv("MINIO_ENDPOINT", "localhost:9000"),
			AccessKeyID:     getEnv("MINIO_ACCESS_KEY_ID", "minioadmin"),
			SecretAccessKey: getEnv("MINIO_SECRET_ACCESS_KEY", "minioadmin"),
			UseSSL:          getBoolEnv("MINIO_USE_SSL", false),
			BucketName:      getEnv("MINIO_BUCKET_NAME", "einfra-crm"),
		},
		Encryption: EncryptionConfig{
			Key:     getEnv("ENCRYPTION_KEY", ""),
			Version: getIntEnv("ENCRYPTION_KEY_VERSION", 1),
		},
		ELK: ELKConfig{
			ElasticAPMEndpoint: getEnv("ELASTIC_APM_ENDPOINT", "http://localhost:8200"),
		},
		NATS: NATSConfig{
			URL: getEnv("NATS_URL", "nats://localhost:4222"),
		},
	}

	// Validate configuration
	validate := validator.New()
	if err := validate.Struct(config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	// Check required fields
	if config.Auth.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}
	if config.Database.Password == "" {
		return nil, fmt.Errorf("DB_PASSWORD environment variable is required")
	}

	return config, nil
}

// Helper functions to get environment variables with defaults

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func getSliceEnv(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}
