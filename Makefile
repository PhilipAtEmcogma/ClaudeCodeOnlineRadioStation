# Radio Calico Makefile
# Provides convenient shortcuts for common development, testing, and security tasks

.PHONY: help install dev start test security docker clean

# Default target - show help
help:
	@echo "Radio Calico - Available Make Targets"
	@echo "======================================"
	@echo ""
	@echo "Development:"
	@echo "  make install          - Install npm dependencies"
	@echo "  make dev              - Start development server with auto-reload"
	@echo "  make start            - Start production server"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run all tests (backend + frontend)"
	@echo "  make test-watch       - Run tests in watch mode"
	@echo "  make test-coverage    - Run tests with coverage report"
	@echo "  make test-backend     - Run backend tests only"
	@echo "  make test-frontend    - Run frontend tests only"
	@echo ""
	@echo "Security:"
	@echo "  make security         - Run security audit (moderate+ severity)"
	@echo "  make security-all     - Run full security audit (all severities)"
	@echo "  make security-critical - Run security audit (critical only)"
	@echo "  make security-fix     - Automatically fix security vulnerabilities"
	@echo "  make security-report  - Generate detailed security report"
	@echo ""
	@echo "Docker Development:"
	@echo "  make docker-dev       - Start development Docker container"
	@echo "  make docker-dev-bg    - Start development Docker container (background)"
	@echo "  make docker-dev-logs  - View development container logs"
	@echo "  make docker-dev-shell - Open shell in development container"
	@echo "  make docker-dev-test  - Run tests in development container"
	@echo "  make docker-dev-down  - Stop development container"
	@echo ""
	@echo "Docker Production:"
	@echo "  make docker-prod      - Start production Docker containers"
	@echo "  make docker-prod-build - Build production containers"
	@echo "  make docker-prod-logs - View production container logs"
	@echo "  make docker-prod-down - Stop production containers"
	@echo "  make docker-prod-ps   - Show status of production containers"
	@echo ""
	@echo "Database Management:"
	@echo "  make db-backup        - Backup production PostgreSQL database"
	@echo "  make db-console       - Open PostgreSQL console (production)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean            - Remove generated files and artifacts"
	@echo "  make docker-clean     - Remove all Docker containers and volumes"
	@echo ""

# ========================================
# Development Targets
# ========================================

install:
	npm install

dev:
	npm run dev

start:
	npm start

# ========================================
# Testing Targets
# ========================================

test:
	npm test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

test-backend:
	npm run test:backend

test-frontend:
	npm run test:frontend

# ========================================
# Security Targets
# ========================================

security: security-all
	@echo ""
	@echo "Security audit complete!"
	@echo "Run 'make security-fix' to automatically fix vulnerabilities where possible."

security-all:
	@echo "Running comprehensive security audit..."
	npm audit

security-critical:
	@echo "Running critical severity security audit..."
	npm run security:critical

security-fix:
	@echo "Attempting to fix security vulnerabilities..."
	npm audit fix
	@echo ""
	@echo "Security fixes applied. Run 'make security' to verify."

security-report:
	@echo "Generating detailed security report..."
	@mkdir -p reports
	npm audit --json > reports/security-audit.json
	npm audit > reports/security-audit.txt
	@echo ""
	@echo "Security reports generated:"
	@echo "  - reports/security-audit.json (JSON format)"
	@echo "  - reports/security-audit.txt (human-readable)"

# ========================================
# Docker Development Targets
# ========================================

docker-dev:
	@echo "Starting development Docker container..."
	docker-compose up --build

docker-dev-bg:
	@echo "Starting development Docker container (background)..."
	docker-compose up -d --build

docker-dev-logs:
	docker-compose logs -f

docker-dev-shell:
	docker-compose exec radio-calico-dev sh

docker-dev-test:
	@echo "Running tests in development container..."
	docker-compose exec radio-calico-dev npm test

docker-dev-down:
	docker-compose down

# ========================================
# Docker Production Targets
# ========================================

docker-prod:
	@echo "Starting production Docker containers..."
	@echo "WARNING: Ensure .env file exists with POSTGRES_PASSWORD set!"
	docker-compose -f docker-compose.prod.yml up -d --build

docker-prod-build:
	@echo "Building production Docker containers..."
	docker-compose -f docker-compose.prod.yml build

docker-prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

docker-prod-down:
	docker-compose -f docker-compose.prod.yml down

docker-prod-ps:
	docker-compose -f docker-compose.prod.yml ps

# ========================================
# Database Management Targets
# ========================================

db-backup:
	@echo "Backing up production PostgreSQL database..."
	@mkdir -p backups
	docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio radio > backups/radio-backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup complete! Check backups/ directory."

db-console:
	@echo "Opening PostgreSQL console (production)..."
	docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio

# ========================================
# Cleanup Targets
# ========================================

clean:
	@echo "Cleaning up generated files..."
	rm -rf coverage/
	rm -rf reports/
	rm -rf node_modules/.cache/
	@echo "Cleanup complete!"

docker-clean:
	@echo "WARNING: This will remove ALL Docker containers and volumes!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read -p "" confirm
	docker-compose down -v
	docker-compose -f docker-compose.prod.yml down -v
	docker system prune -af
	@echo "Docker cleanup complete!"
