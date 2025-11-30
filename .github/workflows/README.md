# GitHub Actions Workflows

This directory contains the CI/CD workflows for Radio Calico.

## Key Features

**🔄 Consistency with Local Development**

The workflows use the **exact same Makefile commands** that developers use locally:
- `make test-backend` / `make test-frontend` / `make test-coverage`
- `make security` / `make security-report` / `make security-full`
- `make install`

**Benefits:**
- ✅ CI runs the same commands you test locally
- ✅ Single source of truth (Makefile)
- ✅ Update Makefile once, CI automatically uses new behavior
- ✅ Easier debugging - reproduce CI failures locally with same commands

---

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `master`, `develop`, or `feature/*` branches
- Pull requests to `master` or `develop`

**Jobs:**

#### Unit Tests
- Runs on Node.js 22.x
- Executes backend tests (`make test-backend`)
- Executes frontend tests (`make test-frontend`)
- Generates coverage report (`make test-coverage`)
- Uploads coverage to Codecov (optional)
- Archives coverage report as artifact (30 days retention)

#### Security Scans
- Runs security audit (`make security`)
- Generates security reports (`make security-report`)
- Archives security reports as artifact (30 days retention)

#### Code Quality
- Runs ESLint on all JavaScript files
- Enforces zero warnings policy

#### Docker Build Test
- Builds development Docker image (`Dockerfile.dev`)
- Builds production API Docker image (`Dockerfile.prod`)
- Uses GitHub Actions cache for faster builds
- Does not push images (build verification only)

#### Summary
- Aggregates results from all jobs
- Fails if critical jobs (tests, Docker build) fail
- Security and lint failures are warnings only

**Artifacts:**
- `coverage-report` - Test coverage HTML report
- `security-reports` - npm audit JSON and text reports

---

### 2. Comprehensive Security Scan (`security-full.yml`)

**Triggers:**
- **Schedule:** Weekly on Mondays at 2 AM UTC
- **Manual:** Can be triggered via GitHub Actions UI
- **Push:** Runs on pushes to `master` branch

**Jobs:**

#### Full Security Audit
- **Installs security tools:** Runs `make security-install` to set up Snyk, ESLint plugins
- **Comprehensive scan:** Runs `make security-full` which executes:
  - npm audit - Checks for known vulnerabilities in dependencies
  - Snyk - Advanced dependency scanning (requires `SNYK_TOKEN` secret)
  - ESLint + Semgrep - Static analysis for security vulnerabilities (OWASP Top 10)
  - Trivy - Scans Docker images for vulnerabilities
- Generates security summary markdown
- Comments on PRs with security findings

#### Dependency Review
- Only runs on pull requests
- Reviews dependency changes for security and license issues
- Fails on moderate+ severity vulnerabilities
- Blocks GPL-3.0 and AGPL-3.0 licenses

**Artifacts:**
- `security-full-reports-{run_number}` - Complete security scan results (90 days retention)

---

## Setup Instructions

### Required Secrets

Add these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

#### Optional (for enhanced security scanning):
- `SNYK_TOKEN` - Snyk API token for dependency scanning
  - Sign up at [snyk.io](https://snyk.io)
  - Get token from Account Settings > API Token
  - Add as repository secret

#### Optional (for coverage reporting):
- `CODECOV_TOKEN` - Codecov token for coverage uploads
  - Sign up at [codecov.io](https://codecov.io)
  - Add repository and get upload token
  - Add as repository secret

### Branch Protection Rules

Recommended branch protection for `master`:

1. Go to `Settings > Branches > Add rule`
2. Branch name pattern: `master`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Select: `Unit Tests`, `Docker Build Test`
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

### Viewing Results

**Test Coverage:**
1. Go to Actions tab
2. Click on workflow run
3. Scroll to "Artifacts" section
4. Download `coverage-report`
5. Open `index.html` in browser

**Security Reports:**
1. Go to Actions tab
2. Click on workflow run
3. Download `security-reports` or `security-full-reports-{run_number}`
4. Review JSON/text files for findings

**GitHub Security:**
1. Go to Security tab
2. Click "Code scanning"
3. View Trivy and Semgrep findings

---

## Local Testing

Test workflows locally before pushing using the **same Make commands** that CI uses:

### Run tests locally:
```bash
make test              # Run all tests (same as CI)
make test-backend      # Backend tests only
make test-frontend     # Frontend tests only
make test-coverage     # Generate coverage report
```

### Run security scans locally:
```bash
make security          # Quick security audit (same as CI)
make security-full     # Comprehensive scan (same as weekly scan)
make security-report   # Generate detailed reports
```

### Build Docker images locally:
```bash
make docker-dev        # Build and start dev container
make docker-prod       # Build and start production containers
```

**Benefit:** Using Make commands ensures your local testing **exactly matches** what runs in CI.

### Command Mapping: Local → CI

| Local Command | CI Workflow | What It Does |
|--------------|-------------|--------------|
| `make test-backend` | CI Pipeline (test job) | Runs backend unit/integration tests |
| `make test-frontend` | CI Pipeline (test job) | Runs frontend unit tests |
| `make test-coverage` | CI Pipeline (test job) | Generates test coverage report |
| `make security` | CI Pipeline (security job) | Quick npm audit scan |
| `make security-report` | CI Pipeline (security job) | Generates security reports in `reports/` |
| `make security-full` | Security Full (weekly) | Comprehensive scan: npm audit, Snyk, ESLint, Semgrep, Trivy |
| `make security-install` | Security Full (weekly) | Installs Snyk and ESLint security plugins |
| `make docker-dev` | CI Pipeline (docker-build job) | Builds development Docker image |
| `make docker-prod` | CI Pipeline (docker-build job) | Builds production Docker images |

---

## Workflow Customization

### Adjust Test Coverage Thresholds

Edit `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 50,    // Increase for stricter coverage
    functions: 50,
    lines: 50,
    statements: 50
  }
}
```

### Change Security Scan Schedule

Edit `security-full.yml`:
```yaml
schedule:
  - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM UTC
  # Examples:
  # - cron: '0 2 * * *'     # Daily at 2 AM UTC
  # - cron: '0 2 1 * *'     # Monthly on 1st at 2 AM UTC
```

### Add More Node.js Versions

Edit `ci.yml`:
```yaml
strategy:
  matrix:
    node-version: [20.x, 22.x, 23.x]
```

---

## Troubleshooting

### Tests Failing in CI but Passing Locally

**Cause:** Environment differences (timezone, OS, Node version)

**Solution:**
- Check Node.js version matches (22.x)
- Review workflow logs for specific errors
- Run tests in Docker locally: `docker-compose exec radio-calico-dev npm test`

### Security Scan Timeouts

**Cause:** Large dependency tree or slow network

**Solution:**
- Increase timeout in workflow:
  ```yaml
  - name: Run Snyk security scan
    timeout-minutes: 10
  ```

### Docker Build Failures

**Cause:** Missing dependencies or build context issues

**Solution:**
- Test build locally: `docker build -f Dockerfile.dev .`
- Check `.dockerignore` isn't excluding required files
- Review Dockerfile for syntax errors

### Artifacts Not Uploading

**Cause:** Path not found or retention limits

**Solution:**
- Verify path exists: Add `ls -la reports/` before upload
- Check retention days (max 90 for free tier)
- Ensure job didn't fail before upload step

---

## Best Practices

### Development Workflow

1. **Before committing code:**
   ```bash
   make test              # Run all tests
   make security          # Quick security check
   ```

2. **Before creating a PR:**
   ```bash
   make test-coverage     # Ensure coverage thresholds met
   make security-report   # Generate detailed security reports
   ```

3. **Before deploying to production:**
   ```bash
   make security-full     # Comprehensive security scan
   make docker-prod       # Test production build
   ```

### CI/CD Maintenance

1. **Review security reports** from weekly scans in GitHub Security tab
2. **Keep dependencies updated** - run `make security-fix` and `npm outdated` regularly
3. **Monitor workflow success rate** - investigate failures promptly
4. **Use artifacts** for debugging - download and review locally
5. **Enable branch protection** on master/develop branches
6. **Require status checks** before merging PRs (`Unit Tests`, `Docker Build Test`)
7. **Address security findings** based on severity (Critical/High first)

### Consistency Benefits

**Using Make commands everywhere ensures:**
- ✅ What works locally will work in CI
- ✅ CI failures are easy to reproduce locally
- ✅ One command update affects both local dev and CI
- ✅ New team members use the same commands as CI
- ✅ Documentation stays in sync (Makefile is the source of truth)

---

## CI/CD Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         Push/PR                             │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌────────┐      ┌────────┐      ┌────────┐
    │  Test  │      │Security│      │  Lint  │
    └───┬────┘      └───┬────┘      └───┬────┘
        │               │               │
        └───────┬───────┴───────┬───────┘
                ▼               ▼
           ┌─────────┐     ┌─────────┐
           │ Docker  │     │ Summary │
           │  Build  │     │         │
           └─────────┘     └────┬────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ✅ Success   ⚠️ Warning   ❌ Failure
```

---

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Testing Framework](https://jestjs.io/)
- [Snyk Security Platform](https://snyk.io/docs/)
- [Semgrep Static Analysis](https://semgrep.dev/docs/)
- [Trivy Container Scanner](https://aquasecurity.github.io/trivy/)
- [Codecov Coverage Reports](https://docs.codecov.com/)
