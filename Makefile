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
	@echo "Advanced Security:"
	@echo "  make security-deps    - Scan dependencies with Snyk"
	@echo "  make security-code    - Static code analysis (ESLint + Semgrep)"
	@echo "  make security-docker  - Scan Docker images with Trivy"
	@echo "  make security-api     - Dynamic API security testing (requires running server)"
	@echo "  make security-full    - Run all security scans (comprehensive)"
	@echo "  make security-install - Install security scanning tools"
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
# Advanced Security Targets
# ========================================

security-install:
	@echo "Installing security scanning tools..."
	@echo ""
	@echo "1. Installing Snyk (dependency scanner)..."
	npm install -g snyk || echo "Snyk installation failed (may require admin/sudo)"
	@echo ""
	@echo "2. Installing ESLint security plugins..."
	npm install --save-dev eslint eslint-plugin-security eslint-plugin-no-secrets || echo "ESLint plugins already installed"
	@echo ""
	@echo "Note: Trivy and Semgrep run via Docker (no installation needed)"
	@echo ""
	@echo "Security tools installed!"
	@echo "Run 'make security-full' to run all security scans."

security-deps:
	@echo "Scanning dependencies with Snyk..."
	@mkdir -p reports
	@if command -v snyk >/dev/null 2>&1; then \
		snyk test --json > reports/snyk-report.json 2>&1 || true; \
		snyk test > reports/snyk-report.txt 2>&1 || true; \
		echo "Snyk scan complete! Reports in reports/snyk-report.*"; \
	else \
		echo "ERROR: Snyk not installed. Run 'make security-install' first."; \
		echo "Or install manually: npm install -g snyk"; \
		exit 1; \
	fi

security-code:
	@echo "Running static code analysis..."
	@mkdir -p reports
	@echo ""
	@echo "1/2 Running ESLint with security plugins..."
	@if [ -f node_modules/.bin/eslint ]; then \
		npx eslint . --ext .js --format json > reports/eslint-security.json 2>&1 || true; \
		npx eslint . --ext .js > reports/eslint-security.txt 2>&1 || true; \
		echo "ESLint scan complete!"; \
	else \
		echo "WARNING: ESLint not installed. Run 'make security-install' first."; \
	fi
	@echo ""
	@echo "2/2 Running Semgrep (pattern-based scanner)..."
	@if command -v docker >/dev/null 2>&1; then \
		docker run --rm -v "$(CURDIR):/src" returntocorp/semgrep \
			--config=auto --json --output=/src/reports/semgrep-report.json /src 2>&1 || true; \
		docker run --rm -v "$(CURDIR):/src" returntocorp/semgrep \
			--config=auto /src > reports/semgrep-report.txt 2>&1 || true; \
		echo "Semgrep scan complete!"; \
	else \
		echo "WARNING: Docker not available. Skipping Semgrep scan."; \
	fi
	@echo ""
	@echo "Code analysis complete! Reports in reports/"

security-docker:
	@echo "Scanning Docker images with Trivy..."
	@mkdir -p reports
	@if command -v docker >/dev/null 2>&1; then \
		echo "Building images first..."; \
		docker-compose build 2>&1 || true; \
		docker-compose -f docker-compose.prod.yml build 2>&1 || true; \
		echo ""; \
		echo "Scanning development image..."; \
		docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
			aquasec/trivy image --format json --output /tmp/trivy-dev.json radio-radio-calico-dev 2>&1 || true; \
		docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
			aquasec/trivy image radio-radio-calico-dev > reports/trivy-dev.txt 2>&1 || true; \
		echo ""; \
		echo "Scanning production API image..."; \
		docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
			aquasec/trivy image --format json --output /tmp/trivy-api.json radio-radio-calico-api 2>&1 || true; \
		docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
			aquasec/trivy image radio-radio-calico-api > reports/trivy-api.txt 2>&1 || true; \
		echo ""; \
		echo "Scanning nginx image..."; \
		docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
			aquasec/trivy image --format json --output /tmp/trivy-nginx.json radio-nginx 2>&1 || true; \
		docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
			aquasec/trivy image radio-nginx > reports/trivy-nginx.txt 2>&1 || true; \
		echo ""; \
		echo "Trivy scans complete! Reports in reports/trivy-*.txt"; \
	else \
		echo "ERROR: Docker not available. Cannot scan images."; \
		exit 1; \
	fi

security-api:
	@echo "Running OWASP ZAP API security test..."
	@mkdir -p reports
	@echo ""
	@echo "WARNING: This test requires the server to be running on http://localhost:3000"
	@echo "Start server in another terminal with: npm start"
	@echo ""
	@read -p "Press Enter to continue or Ctrl+C to cancel..." confirm
	@if command -v docker >/dev/null 2>&1; then \
		echo "Running ZAP baseline scan..."; \
		docker run --rm --network host \
			-v "$(CURDIR)/reports:/zap/wrk:rw" \
			owasp/zap2docker-stable zap-baseline.py \
			-t http://localhost:3000 \
			-r zap-report.html \
			-J zap-report.json 2>&1 || true; \
		echo ""; \
		echo "ZAP scan complete! Reports in reports/zap-report.*"; \
	else \
		echo "ERROR: Docker not available. Cannot run ZAP."; \
		exit 1; \
	fi

security-full:
	@echo "========================================="
	@echo "COMPREHENSIVE SECURITY SCAN"
	@echo "========================================="
	@echo ""
	@mkdir -p reports
	@echo "This will run all security scans:"
	@echo "  1. npm audit (dependency vulnerabilities)"
	@echo "  2. Snyk (enhanced dependency scanning)"
	@echo "  3. ESLint + Semgrep (code analysis)"
	@echo "  4. Trivy (Docker image scanning)"
	@echo "  5. OWASP ZAP (API security testing - SKIPPED, run manually)"
	@echo ""
	@echo "Starting comprehensive security scan..."
	@echo ""
	@echo "========================================="
	@echo "1/4 npm audit"
	@echo "========================================="
	@$(MAKE) security-report
	@echo ""
	@echo "========================================="
	@echo "2/4 Snyk dependency scan"
	@echo "========================================="
	@$(MAKE) security-deps || true
	@echo ""
	@echo "========================================="
	@echo "3/4 Code analysis (ESLint + Semgrep)"
	@echo "========================================="
	@$(MAKE) security-code || true
	@echo ""
	@echo "========================================="
	@echo "4/4 Docker image scanning (Trivy)"
	@echo "========================================="
	@$(MAKE) security-docker || true
	@echo ""
	@echo "========================================="
	@echo "SECURITY SCAN COMPLETE!"
	@echo "========================================="
	@echo ""
	@echo "Review reports in the reports/ directory:"
	@ls -lh reports/ 2>/dev/null || dir reports\ 2>nul
	@echo ""
	@echo "NOTE: API security testing (OWASP ZAP) requires a running server."
	@echo "To run API tests: make security-api"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Review all reports in reports/"
	@echo "  2. Address critical and high severity issues"
	@echo "  3. Run 'make security-fix' to auto-fix dependency issues"
	@echo "  4. Document acceptable risks"

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
