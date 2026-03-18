
.PHONY: build test run lint docker-up docker-down swagger migrate-up migrate-down test-coverage help clean

# Go variables
BINARY_NAME=einfra-crm-be
MAIN_PATH=./main.go
DOCKER_IMAGE=einfra-crm-be:latest

# Colors for output
GREEN=\033[0;32m
YELLOW=\033[1;33m
NC=\033[0m # No Color

# Default command
help:
	@echo "$(GREEN)EINFRA CRM Backend - Makefile Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  make build          Build the Go application"
	@echo "  make run            Run the application locally"
	@echo "  make test           Run all tests"
	@echo "  make test-coverage  Run tests with coverage report"
	@echo "  make lint           Run golangci-lint"
	@echo "  make swagger        Generate Swagger documentation"
	@echo ""
	@echo "$(YELLOW)Docker:$(NC)"
	@echo "  make docker-build   Build Docker image"
	@echo "  make docker-up      Start all services with docker-compose"
	@echo "  make docker-down    Stop all services"
	@echo "  make docker-logs    View docker-compose logs"
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@echo "  make migrate-up     Run database migrations"
	@echo "  make migrate-down   Rollback database migrations"
	@echo ""
	@echo "$(YELLOW)Utilities:$(NC)"
	@echo "  make clean          Clean build artifacts"
	@echo "  make deps           Download dependencies"
	@echo "  make fmt            Format code"

# Build the Go application
build:
	@echo "$(GREEN)Building the application...$(NC)"
	@go build -o $(BINARY_NAME) $(MAIN_PATH)
	@echo "$(GREEN)Build complete: $(BINARY_NAME)$(NC)"

# Run the application
run:
	@echo "$(GREEN)Running the application...$(NC)"
	@go run $(MAIN_PATH)

# Run tests
test:
	@echo "$(GREEN)Running tests...$(NC)"
	@go test -v -race ./...

# Run tests with coverage
test-coverage:
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	@go test -v -race -coverprofile=coverage.out -covermode=atomic ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "$(GREEN)Coverage report generated: coverage.html$(NC)"

# Run integration tests
test-integration:
	@echo "$(GREEN)Running integration tests...$(NC)"
	@go test -v -tags=integration ./...

# Run the linter
lint:
	@echo "$(GREEN)Running linter...$(NC)"
	@golangci-lint run --config .golangci.yml

# Format code
fmt:
	@echo "$(GREEN)Formatting code...$(NC)"
	@go fmt ./...
	@gofmt -s -w .

# Generate Swagger documentation
swagger:
	@echo "$(GREEN)Generating Swagger documentation...$(NC)"
	@swag init -g main.go -o ./docs --parseDependency --parseInternal
	@echo "$(GREEN)Swagger docs generated in ./docs$(NC)"

# Download dependencies
deps:
	@echo "$(GREEN)Downloading dependencies...$(NC)"
	@go mod download
	@go mod tidy
	@echo "$(GREEN)Dependencies updated$(NC)"

# Build Docker image
docker-build:
	@echo "$(GREEN)Building Docker image...$(NC)"
	@docker build -t $(DOCKER_IMAGE) .
	@echo "$(GREEN)Docker image built: $(DOCKER_IMAGE)$(NC)"

# Start all docker services
docker-up:
	@echo "$(GREEN)Starting docker services...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)Services started$(NC)"

# Stop all docker services
docker-down:
	@echo "$(GREEN)Stopping docker services...$(NC)"
	@docker-compose down
	@echo "$(GREEN)Services stopped$(NC)"

# View docker-compose logs
docker-logs:
	@docker-compose logs -f

# Run database migrations up
migrate-up:
	@echo "$(GREEN)Running database migrations...$(NC)"
	@migrate -path ./migrations -database "$(DB_URL)" up
	@echo "$(GREEN)Migrations applied$(NC)"

# Rollback database migrations
migrate-down:
	@echo "$(GREEN)Rolling back database migrations...$(NC)"
	@migrate -path ./migrations -database "$(DB_URL)" down
	@echo "$(GREEN)Migrations rolled back$(NC)"

# Create a new migration
migrate-create:
	@read -p "Enter migration name: " name; \
	migrate create -ext sql -dir ./migrations -seq $$name
	@echo "$(GREEN)Migration created$(NC)"

# Clean build artifacts
clean:
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	@rm -f $(BINARY_NAME)
	@rm -f coverage.out coverage.html
	@rm -rf ./tmp
	@echo "$(GREEN)Clean complete$(NC)"

# Install development tools
install-tools:
	@echo "$(GREEN)Installing development tools...$(NC)"
	@go install github.com/swaggo/swag/cmd/swag@latest
	@go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
	@echo "$(GREEN)Tools installed$(NC)"

# Run the application in development mode with hot reload
dev:
	@echo "$(GREEN)Starting development server with hot reload...$(NC)"
	@air

# Security scan
security-scan:
	@echo "$(GREEN)Running security scan...$(NC)"
	@gosec ./...

# Check for outdated dependencies
deps-check:
	@echo "$(GREEN)Checking for outdated dependencies...$(NC)"
	@go list -u -m all

# Generate mocks for testing
mocks:
	@echo "$(GREEN)Generating mocks...$(NC)"
	@mockgen -source=internal/domain/server.go -destination=internal/mocks/server_mock.go -package=mocks
	@mockgen -source=internal/domain/docker.go -destination=internal/mocks/docker_mock.go -package=mocks
	@mockgen -source=internal/domain/kubernetes.go -destination=internal/mocks/kubernetes_mock.go -package=mocks
	@mockgen -source=internal/domain/harbor.go -destination=internal/mocks/harbor_mock.go -package=mocks
	@echo "$(GREEN)Mocks generated$(NC)"

# Run all quality checks
check: fmt lint test
	@echo "$(GREEN)All checks passed!$(NC)"

# Full build pipeline
ci: deps check swagger build
	@echo "$(GREEN)CI pipeline complete!$(NC)"
