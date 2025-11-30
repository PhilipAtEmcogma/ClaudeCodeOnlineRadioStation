# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Radio Calico is a full-featured live radio streaming web application with HLS audio streaming, real-time metadata updates, listener analytics, song ratings, and request management.

**Architecture:**
- **Development:** Monolithic - SQLite + Express (API + static files) - Single Docker container
- **Production:** Three-service - PostgreSQL + Node.js API + Nginx - Three Docker containers

## Technology Stack

**Development:** Node.js v22+ | Express | SQLite (better-sqlite3) | Jest + Supertest | Nodemon | helmet.js | express-rate-limit | express-validator

**Production:** Node.js v22+ | Express (API only) | PostgreSQL 16 (pg) | Nginx (static + reverse proxy) | Docker Compose | Custom db.js abstraction layer

**Frontend:** Vanilla JS | HTML5 | CSS3 | HLS.js | Google Fonts (Montserrat, Open Sans)

## Quick Commands

### Make Commands (Recommended)
```bash
make                    # Show all available targets
make dev                # Start dev server with auto-reload
make test               # Run all tests
make test-coverage      # Run tests with coverage
make security           # Run security audit
make security-full      # Comprehensive security scan (before deployment)
make docker-dev         # Start development Docker container
make docker-prod        # Start production Docker containers
```

### NPM Commands
```bash
npm start               # Production mode
npm run dev             # Development with auto-reload (nodemon)
npm test                # Run all tests (backend + frontend)
npm run test:coverage   # Generate coverage report
make security           # Security audit
```

**IMPORTANT:** When starting the webserver, run in background (assumes already running unless explicitly asked to restart).

### Docker Commands

**⚠️ PREREQUISITE:** Docker Desktop must be running. Verify with `docker ps`. Common error if not running: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`

**Development:**
```bash
docker-compose up --build              # Start (foreground)
docker-compose up -d --build           # Start (detached)
docker-compose logs -f                 # View logs
docker-compose down                    # Stop and remove
```

**Production:**
```bash
docker-compose -f docker-compose.prod.yml up --build -d    # Start all services
docker-compose -f docker-compose.prod.yml logs -f          # View all logs
docker-compose -f docker-compose.prod.yml ps               # Check status
docker-compose -f docker-compose.prod.yml down             # Stop all
```

**Notes:**
- Development: `Dockerfile.dev`, SQLite in `./radio.db`
- Production: `Dockerfile.prod`, three containers (postgres, API, nginx), PostgreSQL in volume `postgres-data`
- Production requires `.env` file with `POSTGRES_PASSWORD`
- See `DOCKER.md` for comprehensive deployment guide

## Architecture

### Database Abstraction Layer (db.js ~365 lines)

**Key Features:**
- Auto-detects database via `DATABASE_TYPE` env variable
- Unified async API: `get()`, `all()`, `run()`, `query()`
- Auto-converts `?` placeholders to PostgreSQL `$1, $2, ...`
- Handles schema creation and migrations for both databases
- Returns consistent result formats

**Database Selection:**
- **SQLite (dev):** Synchronous better-sqlite3 wrapped in async
- **PostgreSQL (prod):** Async pg library with connection pooling

### Backend Structure (server.js)

1. **Database Initialization** - Imports db.js, initializes connection, creates tables (`listeners`, `listening_sessions`, `song_requests`, `feedback`, `song_ratings`), runs migrations (all async/await)

2. **User Fingerprinting** - Server-side: combines IP + User-Agent + Accept-Language + Accept-Encoding → SHA-256 hash (prevents duplicate votes without login)

3. **API Endpoints** - RESTful API (all routes async):
   - Listeners API, Listening Sessions API, Song Requests API, Feedback API, Song Ratings API (thumbs up/down with deduplication), Health Check

4. **Server Lifecycle** - Port 3000 (configurable), binds to 0.0.0.0 (Docker), graceful shutdown

### Nginx (Production Only - nginx.conf)

**Responsibilities:**
1. Serves static files from `/usr/share/nginx/html` (1-year caching, gzip)
2. Reverse proxies `/api/*` to `http://radio-calico-api:3000` (preserves client IP)
3. Adds security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
4. Health check at `/health`
5. Content Security Policy (CSP) for CloudFront resources

**CSP Configuration (Critical for HLS Streaming):**
The nginx.conf includes a Content Security Policy that allows:
- `media-src 'self' https://d3d4yli4hf5bmh.cloudfront.net blob:` - HLS media segments
- `img-src 'self' data: https://d3d4yli4hf5bmh.cloudfront.net` - Album art from CloudFront
- `connect-src 'self' https://d3d4yli4hf5bmh.cloudfront.net https://cdn.jsdelivr.net` - Metadata API and HLS.js source maps
- `worker-src 'self' blob:` - HLS.js web workers
- `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net` - HLS.js library

**IMPORTANT:** If HLS stream doesn't play, verify CSP headers with `curl -I http://localhost:3000/`

**Benefits:** Performance (static file optimization), security (only nginx exposed), flexibility (HTTPS, rate limiting), scalability

**Customize:** Edit `nginx.conf` → reload → `docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload`

### Frontend Structure (public/)

- **index.html** (~77 lines) - Semantic markup for album art, track info, player controls, rating UI, recent tracks
- **app.js** (~472 lines) - HLS player, metadata fetching (every 5s when playing), song ratings, browser fingerprinting, audio controls, timer
- **styles.css** - Brand colors (mint, forest green, teal, calico orange), two-column layout, responsive breakpoints (1200px, 968px, 640px)

### Database Schema

**Tables:** `listeners`, `listening_sessions`, `song_requests`, `feedback`, `song_ratings`

**song_ratings** (most complex):
- `user_fingerprint` (SHA-256 hash of server fingerprint)
- Unique index on `(song_id, user_fingerprint)` prevents duplicate votes
- Users can UPDATE votes, not INSERT duplicates

**SQLite vs PostgreSQL differences:**
- Auto-increment: `AUTOINCREMENT` vs `SERIAL`
- Timestamps: `DATETIME` vs `TIMESTAMP`
- Indexes: PostgreSQL uses `WHERE user_fingerprint IS NOT NULL`

**Migrations:** Run on startup via db.js (idempotent) - SQLite uses `PRAGMA table_info`, PostgreSQL uses `pg_indexes`

### Key Technical Details

**Song Rating Flow:**
1. User clicks thumbs up/down → POST `/api/ratings` with `song_id`, `session_id`, `rating` (1/-1)
2. Backend generates fingerprint → check existing vote
3. Same vote: return counts | Different: UPDATE | None: INSERT
4. Return aggregated counts + user's vote

**Metadata:** Poll `https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json` every 5s (title, artist, album, bit_depth, sample_rate, is_explicit, is_new, 5 recent tracks). Year badge from regex: `\((\d{4})\)`

**HLS Streaming:** `https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8` - HLS.js for non-Safari, native HLS for Safari, low latency mode

## Brand Design Guidelines

**When making UI changes:**
- Never modify brand colors without explicit request
- Maintain two-column layout (album left, info right) on desktop
- Preserve responsive breakpoints
- Use typography hierarchy: Montserrat (headings), Open Sans (body)
- Reference `RadioCalico_Style_Guide.txt` and `RadioCalicoLayout.png`

## Development Patterns

### Adding API Endpoint

1. Add async route handler in `server.js`
2. Use db.js methods: `await db.get(sql, params)`, `await db.all(sql, params)`, `await db.run(sql, params)`
3. Wrap in try-catch, return appropriate HTTP status
4. Use consistent response format: `{ message: 'Success' }` or `{ error: 'Error message' }`
5. Write tests in `tests/backend/integration/` (see `ratings-api.test.js`)

**Example:**
```javascript
app.get('/api/example/:id', async (req, res) => {
  try {
    const result = await db.get('SELECT * FROM table WHERE id = ?', [req.params.id]);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Database Queries

**IMPORTANT: All operations are async**

- Import: `const db = require('./db');`
- Methods: `await db.get(sql, params)` (single row), `await db.all(sql, params)` (all rows), `await db.run(sql, params)` (INSERT/UPDATE/DELETE)
- Always use parameterized queries: `await db.get('SELECT * FROM users WHERE id = ?', [userId])`
- Result properties: `.lastInsertRowid` (INSERT), `.changes` (UPDATE/DELETE)
- Migration note: Old synchronous `db.prepare()` code won't work

### Frontend Development

- All JS in `public/app.js`
- Metadata fetching only when `isPlaying === true`
- Album art cache-busting: `cover.jpg?t=${Date.now()}`
- Use `fetchRatings()` on song change
- Browser fingerprinting in `generateFingerprint()` (canvas, screen, navigator)
- Write tests in `tests/frontend/unit/` (see `rating-display.test.js`)

## Testing Framework

See `TESTING.md` for complete documentation.

**Structure:** `tests/backend/` (unit, integration, helpers) | `tests/frontend/` (unit, helpers)

**Configuration:**
- Backend: Node.js + in-memory SQLite
- Frontend: jsdom + mocked fetch
- Coverage: 50% thresholds
- Status: All passing (40 backend, 17 frontend)

**Key Helpers:**
- Backend: `setupTestDatabase()`, `createMockRequest()`, `createMockResponse()`, `seedRatings()`
- Frontend: `setupRatingsDOM()`, `getRatingElements()`, `setupMockFetch()`

**When adding features:**
1. Write unit tests for functions
2. Write integration tests for API endpoints
3. Run `npm run test:coverage` to verify thresholds
4. Reference `TESTING.md` for patterns

## Security Framework

See `SECURITY.md` for comprehensive guide. See `SECURITY-AUDIT-REPORT.md` for current findings.

### Implemented Security

**1. Rate Limiting (express-rate-limit)**
- General API: 100 req/15min
- Write ops: 30 req/15min
- Ratings: 10 req/1min

**2. Input Validation (express-validator)**
- Trim, length limits, character whitelists, type validation
- Protects against: SQL injection, XSS, buffer overflows, type confusion, DoS

**3. Security Headers (helmet.js)**
- Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, X-XSS-Protection

**4. CORS Configuration**
- Production: `ALLOWED_ORIGINS` env var
- Development: `*`

**5. Database Security**
- Always parameterized queries: `await db.get('SELECT * FROM users WHERE id = ?', [userId])`
- Never string interpolation: ❌ `await db.get(`SELECT * FROM users WHERE id = ${userId}`)`

### Security Tools

**Quick scan (before commits):** `make security`
**Comprehensive scan (before deployment):** `make security-full`

**Tools:** npm audit, Snyk (deps), ESLint + Semgrep (static), Trivy (containers), OWASP ZAP (dynamic)

**Reports:** `reports/` directory (security-audit, snyk-report, eslint-security, semgrep-report, trivy-*, zap-report)

### Security Best Practices

**Before Every Commit:**
```bash
make security          # npm audit
make test              # ensure tests pass
```

**Before Every Deployment:**
```bash
make security-full     # comprehensive scan
make test-coverage     # verify coverage
npm outdated           # check updates
# Review HIGH/CRITICAL findings, backup database, set ALLOWED_ORIGINS, verify HTTPS
```

**Production Checklist (Critical):**
- [ ] HTTPS/TLS in nginx
- [ ] Set `ALLOWED_ORIGINS`
- [ ] Add authentication for admin endpoints
- [ ] Implement CSRF protection
- [ ] Sanitize error messages (no stack traces)
- [ ] Set `NODE_ENV=production`
- [ ] Strong PostgreSQL password
- [ ] Review HIGH/CRITICAL security findings

### Known Security Limitations

1. **No Authentication** - All endpoints public (add JWT/API key before production)
2. **No CSRF Protection** - Implement csurf middleware
3. **Client-side fingerprinting bypassed** - Server-side fingerprint is primary defense
4. **IP Storage** - GDPR concern (consider hashing or removal)
5. **No HTTPS in dev** - Critical for production (configure SSL/TLS in nginx)

## Docker Environment

### Environment Variables

**Development (SQLite):** `NODE_ENV`, `PORT`, `DATABASE_TYPE=sqlite`, `DB_PATH=radio.db`

**Production (PostgreSQL):** `NODE_ENV`, `PORT`, `DATABASE_TYPE=postgres`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (required)

**Using .env file (production):**
```bash
cp .env.example .env  # Edit and set POSTGRES_PASSWORD
# docker-compose.prod.yml auto-loads .env
```

### Docker Architecture

**Development (Single Container - Dockerfile.dev):**
- node:22-alpine + build tools (python3, make, g++)
- All deps (including dev), source mounted (hot-reload), SQLite in `./radio.db`
- Health check `/api/health` every 30s, ~350MB

**Production (Three Containers - Dockerfile.prod):**
1. **postgres:** postgres:16-alpine, volume `postgres-data`, health check `pg_isready` every 10s, internal only
2. **radio-calico-api:** Multi-stage build, non-root user (nodejs:1001), prod deps only, connects to postgres:5432, health check every 30s, internal only, ~150MB
3. **nginx:** nginx:1.25-alpine, serves `./public`, proxies `/api/*`, security headers + caching, health check every 30s, exposed port 80, ~40MB

**Dependencies:** nginx → API → postgres

### Database Management

**Development (SQLite):**
- File: `./radio.db` (persists across restarts)
- Backup: `cp radio.db radio.db.backup`

**Production (PostgreSQL):**
- Volume: `postgres-data` (persists when containers removed)
- Backup: `docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio radio > backup.sql`
- Restore: `cat backup.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U radio -d radio`
- Connect: `docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio`

See Database Management section in DOCKER.md for comprehensive backup/restore commands.

### Docker Workflows

**Development:**
1. `docker-compose up --build`
2. Edit code (auto-syncs via volume mount)
3. Nodemon restarts on `server.js` changes
4. Frontend changes instant
5. Run tests: `docker-compose exec radio-calico-dev npm test`

**Production:**
1. `cp .env.example .env` (set `POSTGRES_PASSWORD`)
2. `docker-compose -f docker-compose.prod.yml up --build -d`
3. Verify: `docker ps` (3 healthy containers)
4. Test: `curl http://localhost/` and `curl http://localhost/api/health`
5. Monitor: `docker-compose -f docker-compose.prod.yml logs -f`
6. Backup database before updates

## Troubleshooting

### Production HLS Stream Issues

**Problem:** Play button not working, album art not showing, metadata not updating

**Root Cause:** Content Security Policy (CSP) blocking CloudFront resources

**Solution:**
1. Verify CSP headers include CloudFront domains:
   ```bash
   curl -I http://localhost:3000/ | grep "Content-Security-Policy"
   ```
2. Check nginx.conf has correct CSP directives (see Nginx section above)
3. Reload nginx configuration:
   ```bash
   docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```
4. Hard refresh browser: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

**Browser Console Errors:**
- `NotSupportedError: Failed to load` → CSP blocking media-src or blob:
- `Blocked by CSP` → Add missing domain to appropriate CSP directive
- `Network error` → Check connect-src includes CloudFront

### Docker Build Failures

**Problem:** `npm ci --only=production` fails with missing Python/build tools

**Root Cause:** better-sqlite3 requires native compilation in production stage

**Solution:** Copy pre-built node_modules from builder stage instead of rebuilding
```dockerfile
# In Dockerfile.prod, production stage:
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
```

### PostgreSQL Connection Issues

**Problem:** API can't connect to database in production

**Solution:**
1. Verify `.env` file exists with `POSTGRES_PASSWORD` set
2. Check all 3 containers are running: `docker ps`
3. Check postgres container health: `docker-compose -f docker-compose.prod.yml ps`
4. View postgres logs: `docker-compose -f docker-compose.prod.yml logs postgres`

## Known Issues

- **Docker Desktop required:** Must be running before docker commands (Start Menu → wait for steady whale icon → verify `docker ps`)
- **Production .env:** Required with `POSTGRES_PASSWORD` set
- **Different databases:** Dev=SQLite (sync), Prod=PostgreSQL (async), all code uses async/await via db.js
- **Production architecture:** 3 containers, only nginx port 80 exposed, API/DB internal
- **Nginx prod only:** Dev uses Express for static files, prod uses nginx
- **SQLite locking:** One connection at a time (close DB viewer tools before running server)
- **Session management:** Fingerprint-based IDs in localStorage (not server-side sessions)
- **Metadata polling:** Every 5s (not 1s) to reduce load
- **Docker on Windows:** Use PowerShell or WSL (Git Bash may have path mounting issues)
- **Hot-reload in Docker:** Frontend instant, `server.js`/`db.js` ~2-3s (nodemon)
- **Ports:** Dev=3000, Prod=80 (nginx) with API on internal 3000
- **CSP strict:** CloudFront domains must be explicitly allowed in nginx.conf CSP headers

## File Reference

### Application
`server.js` (main server) | `db.js` (abstraction layer) | `nginx.conf` (prod config) | `.env.example` (template) | `public/index.html` (HTML) | `public/app.js` (all JS) | `public/styles.css` (all CSS) | `radio.db` (SQLite, gitignored)

### Testing
`jest.config.js` | `TESTING.md` | `tests/backend/` | `tests/frontend/` | `coverage/` (gitignored)

### Docker
`Dockerfile` (legacy redirect) | `Dockerfile.dev` | `Dockerfile.prod` | `docker-compose.yml` | `docker-compose.prod.yml` | `.dockerignore` | `DOCKER.md` | `RUNDOCKER.md` (gitignored)

### Configuration
`package.json` | `Makefile` | `.eslintrc.json` | `CLAUDE.md` (this file) | `README.md` | `SECURITY.md` | `SECURITY-AUDIT-REPORT.md` | `.gitignore`

### Design
`RadioCalico_Style_Guide.txt` | `RadioCalicoLayout.png` | `stream_URL.txt`

## Version Control

**Tracked:** Source code, Docker configs (infrastructure as code), documentation, configuration files

**Gitignored:** `*.db` (runtime data), `logs/`, `node_modules/`, `.env*` (secrets), `coverage/`, `reports/`, `backups/`, `.snyk`, `RUNDOCKER.md`, `docker-compose.override.yml`, `.docker/`, OS files

**Never commit:** Database files, .env files, node_modules, personal notes

**Always commit:** Docker configs, documentation, source code, configuration changes

**Adding env vars:**
1. Add to `.env.example` (template) - COMMIT
2. Add to `.env` (real values) - DON'T COMMIT
3. Document in README.md and DOCKER.md

## Best Practices

### Testing
- Run `npm test` before commits
- Write tests for new features (follow existing patterns)
- Run `npm run test:coverage` to verify thresholds
- Use `npm run test:watch` during development

### Security
- Run `make security` before commits
- Run `make security-full` before deployments
- Always parameterized queries (`?` placeholders)
- Always validate input (express-validator)
- Never expose detailed errors in production
- Never commit secrets
- HTTPS required for production
- Review `reports/` regularly
- Keep dependencies updated

### Docker
- Dev: `docker-compose up` (hot-reload)
- Prod: `docker-compose.prod.yml` (3 containers)
- Backup database before updates
- Verify health: `docker ps`
- Monitor logs: `docker-compose logs -f`
- Prod runs as non-root (never override)
- Use named volumes (prod), never host directories
- Test in dev container, not prod
- `--no-cache` if deps/base changed
- `docker system prune` regularly
- `NODE_ENV=production` for prod
- See `DOCKER.md` for comprehensive guide

### Version Control
- Commit Docker configs (infrastructure as code)
- Never commit secrets (.env), runtime data (*.db, logs, node_modules, coverage, reports)
- Organize .gitignore with comments
- Gitignore personal files (RUNDOCKER.md) and local overrides (docker-compose.override.yml)
- `git status` before commit (check for sensitive files)
