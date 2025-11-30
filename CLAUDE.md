# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Radio Calico is a full-featured live radio streaming web application with HLS audio streaming, real-time metadata updates, listener analytics, song ratings, and request management.

The application uses **different architectures for development and production**:
- **Development:** Monolithic architecture with SQLite database and Express serving both API and static files
- **Production:** Three-service architecture with PostgreSQL database, Node.js API backend, and Nginx web server

## Technology Stack

### Development
- **Backend:** Node.js v22+ with Express.js
- **Database:** SQLite with better-sqlite3 (synchronous API)
- **Deployment:** Single Docker container
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 with HLS.js for audio streaming
- **Testing:** Jest with Supertest (backend) and Testing Library (frontend)
- **Security:** helmet.js, express-rate-limit, express-validator
- **Auto-reload:** Nodemon

### Production
- **Backend:** Node.js v22+ with Express.js (API only)
- **Database:** PostgreSQL 16 (asynchronous API via pg library)
- **Web Server:** Nginx (static files + reverse proxy)
- **Deployment:** Three Docker containers (postgres, radio-calico-api, nginx)
- **Database Abstraction:** Custom db.js layer supports both SQLite and PostgreSQL
- **Containerization:** Docker Compose with health checks and restart policies
- **Security:** Rate limiting, input validation, security headers, CORS restrictions

## Development Commands

### Using Make (Recommended)

The project includes a comprehensive Makefile with convenient shortcuts for all common tasks. Run `make help` or just `make` to see all available targets:

```bash
make                         # Show all available targets
make install                 # Install npm dependencies
make dev                     # Start development server with auto-reload
make test                    # Run all tests
make test-coverage           # Run tests with coverage
make security                # Run security audit
make docker-dev              # Start development Docker container
make docker-prod             # Start production Docker containers
```

**Why use Make?**
- Shorter, easier-to-remember commands
- Consistent interface across development, testing, security, and Docker workflows
- Built-in help with `make help`
- Cross-platform compatibility (works on Windows with Make for Windows, macOS, Linux)

### Start the server
```bash
npm start          # Production mode (node server.js)
npm run dev        # Development mode with auto-reload (nodemon)
```

**IMPORTANT:** When starting the webserver, do not run "npm start" in the foreground, as that will block. Run it in the background if you must restart it. Also, assume that it is already running unless explicitly asked to restart it.

### Install dependencies
```bash
npm install
```

### Docker commands

**⚠️ PREREQUISITE:** Docker Desktop must be running before executing any Docker commands. Users should start Docker Desktop from Start Menu and wait for the whale icon to appear steady in the system tray. Verify with `docker ps`.

**Development mode** (hot-reloading, source code mounted):
```bash
docker-compose up --build              # Start dev server (foreground)
docker-compose up -d --build           # Start dev server (background/detached)
docker-compose logs -f                 # View logs (follow mode)
docker-compose exec radio-calico-dev sh  # Shell into container
docker-compose restart                 # Restart dev server
docker-compose down                    # Stop and remove containers
```

**Production mode** (three-service architecture: PostgreSQL + API + Nginx):
```bash
docker-compose -f docker-compose.prod.yml up --build -d     # Start all services (detached)
docker-compose -f docker-compose.prod.yml logs -f           # View logs for all services
docker-compose -f docker-compose.prod.yml logs -f nginx     # View nginx logs
docker-compose -f docker-compose.prod.yml logs -f radio-calico-api  # View API logs
docker-compose -f docker-compose.prod.yml logs -f postgres  # View PostgreSQL logs
docker-compose -f docker-compose.prod.yml ps                # Check status of all services
docker-compose -f docker-compose.prod.yml down              # Stop and remove containers
docker-compose -f docker-compose.prod.yml down -v           # Stop and remove volumes (DANGER: deletes database)
```

**IMPORTANT:**
- The user has Docker Desktop for Windows (v28.1.1+) installed
- **Docker Desktop MUST be running before any docker commands** - if not running, user will see error: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`
- If you need the user to run Docker commands, ALWAYS remind them to start Docker Desktop first and verify with `docker ps`
- **Development:** Uses `Dockerfile.dev`, single container, SQLite database in `./radio.db`
- **Production:** Uses `Dockerfile.prod`, three containers (postgres, radio-calico-api, nginx), PostgreSQL data in Docker volume (`postgres-data`)
- Production requires `.env` file with `POSTGRES_PASSWORD` set
- See `DOCKER.md` for comprehensive deployment documentation
- See `RUNDOCKER.md` for quick reference guide with copy-paste commands (gitignored personal file)

### Testing commands
```bash
npm test                     # Run all tests (backend + frontend)
npm run test:backend         # Run backend tests only
npm run test:frontend        # Run frontend tests only
npm run test:watch           # Run tests in watch mode (auto-rerun on changes)
npm run test:coverage        # Run tests with coverage report
```

**IMPORTANT:** See `TESTING.md` for complete testing documentation, test structure, and writing new tests.

### Security scanning commands
```bash
npm run audit                # Run basic security audit
npm run audit:fix            # Automatically fix security vulnerabilities
npm run security             # Run security audit (moderate+ severity)
npm run security:critical    # Run security audit (critical only)
```

**Using Make for convenience:**
```bash
make security                # Run comprehensive security audit
make security-critical       # Run critical severity audit only
make security-fix            # Automatically fix vulnerabilities
make security-report         # Generate detailed security reports (JSON + text)
```

**IMPORTANT:** Security scanning uses npm audit to check for known vulnerabilities in dependencies. Run security scans regularly, especially before deployments. The `make security-report` target generates detailed reports in the `reports/` directory for review.

## High-Level Architecture

### Database Abstraction Layer (db.js)

The application uses a **database abstraction layer** in `db.js` (~365 lines) that supports both SQLite and PostgreSQL:

**Key Features:**
- Auto-detects database type via `DATABASE_TYPE` environment variable
- Provides unified async API: `get()`, `all()`, `run()`, `query()`
- Automatically converts `?` placeholders to PostgreSQL `$1, $2, ...` syntax
- Creates database schemas on initialization
- Runs migrations for both SQLite and PostgreSQL
- Returns consistent result formats across both databases

**Database Selection:**
- **SQLite (development):** Synchronous better-sqlite3 wrapped in async functions
- **PostgreSQL (production):** Async pg library with connection pooling

### Backend Structure (server.js)

The main application file (`server.js`) is organized into these sections:

1. **Database Initialization**
   - Imports `db.js` and initializes database connection
   - Calls `initializeDatabase()` which creates tables and runs migrations
   - All database operations are now **async/await**
   - Tables: `listeners`, `listening_sessions`, `song_requests`, `feedback`, `song_ratings`

2. **User Fingerprinting System**
   - Server-side fingerprinting: Combines IP, User-Agent, Accept-Language, Accept-Encoding into SHA-256 hash
   - Used to prevent duplicate votes without requiring user login
   - Critical for the rating system's one-vote-per-user guarantee

3. **API Endpoints** - RESTful API organized by feature:
   - **Listeners API:** Register/update listeners, get stats
   - **Listening Sessions API:** Track session start/end, calculate duration
   - **Song Requests API:** Submit/retrieve/update song requests
   - **Feedback API:** Submit feedback with star ratings
   - **Song Ratings API:** Thumbs up/down voting with deduplication logic
   - **Health Check:** Simple health endpoint
   - **All routes are now async** due to database abstraction layer

4. **Server Lifecycle**
   - Starts server on port 3000 (configurable via PORT env var)
   - Binds to 0.0.0.0 for Docker compatibility
   - Graceful shutdown handler to close database connection (supports both SQLite and PostgreSQL)

### Nginx Configuration (Production Only)

In production, Nginx serves as the web server and reverse proxy. Configuration is in `nginx.conf`:

**Nginx responsibilities:**
1. **Serves static files** from `/usr/share/nginx/html` (mounted from `./public/`)
   - HTML, CSS, JavaScript, images, fonts
   - Caching: 1 year for static assets with immutable cache control
   - Gzip compression enabled for text files
2. **Reverse proxies API requests** from `/api/*` to `http://radio-calico-api:3000`
   - Preserves client IP (`X-Real-IP`, `X-Forwarded-For` headers)
   - No buffering for real-time responses
3. **Adds security headers**
   - X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
4. **Provides health check** at `/health` endpoint (separate from API health check)

**Why nginx in production?**
- **Performance:** Nginx is optimized for serving static files with caching
- **Security:** Only nginx is exposed externally, API and database are internal
- **Flexibility:** Easy to add HTTPS, rate limiting, custom error pages
- **Scalability:** Can add load balancing if needed

**Customizing nginx:**
- Edit `nginx.conf` in project root
- Rebuild: `docker-compose -f docker-compose.prod.yml up -d --build nginx`
- Test config: `docker-compose -f docker-compose.prod.yml exec nginx nginx -t`
- Reload: `docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload`

### Frontend Structure (public/)

The frontend follows a clean separation of concerns with three main files:

- **index.html** (~77 lines) - Clean HTML structure only:
  - Semantic markup for album art, track info, player controls
  - Rating UI (thumbs up/down buttons and counts)
  - Recently played tracks footer
  - Links to external resources (HLS.js, Google Fonts, styles.css, app.js)

- **app.js** (~472 lines) - All client-side JavaScript logic:
  - HLS player initialization and error handling
  - Metadata fetching and UI updates (every 5 seconds when playing)
  - Song rating system (fetch/submit ratings via API)
  - Browser fingerprinting for user identification
  - Audio controls (play/pause, volume, mute/unmute)
  - Timer and status management

- **styles.css** - Radio Calico brand styling:
  - CSS variables for brand colors (mint, forest green, teal, calico orange)
  - Two-column horizontal layout (album left, track info right)
  - Responsive design with breakpoints at 1200px, 968px, 640px
  - Uses Montserrat (headings) and Open Sans (body) fonts from Google Fonts

### Key Technical Details

#### Database Schema

The database schema is **identical for both SQLite and PostgreSQL**, with minor syntax differences handled by `db.js`:

**Tables:**
- `listeners` - Unique listeners by session ID
- `listening_sessions` - Individual listening sessions with duration
- `song_requests` - User song requests with status
- `feedback` - User feedback with star ratings
- `song_ratings` - Thumbs up/down votes with fingerprint deduplication

**song_ratings table** - Most complex table due to fingerprinting:
- `user_fingerprint`: SHA-256 hash of server-side fingerprint
- Unique index on `(song_id, user_fingerprint)` prevents duplicate votes
- Users can change votes (UPDATE), not add multiple votes

**Key differences between SQLite and PostgreSQL:**
- **Auto-increment:** SQLite uses `AUTOINCREMENT`, PostgreSQL uses `SERIAL`
- **Timestamps:** SQLite uses `DATETIME`, PostgreSQL uses `TIMESTAMP`
- **Indexes:** PostgreSQL unique index uses `WHERE user_fingerprint IS NOT NULL` clause

**Migration system:**
- Runs on every server startup via `db.js`
- **SQLite:** Uses `PRAGMA table_info` and `PRAGMA index_list` to check schema
- **PostgreSQL:** Uses `pg_indexes` system table to check indexes
- Creates backup tables, migrates data, drops old tables
- Safe to run repeatedly (idempotent)
- Migrations are database-specific (handled in `db.js`)

#### Song Rating System Flow

1. User clicks thumbs up/down
2. Frontend sends POST to `/api/ratings` with `song_id`, `session_id`, `rating` (1 or -1)
3. Backend generates fingerprint from request headers
4. Check for existing vote:
   - If same vote: Return current counts (idempotent)
   - If different vote: UPDATE to change vote
   - If no vote: INSERT new vote
5. Return aggregated counts and user's current vote

#### Metadata Fetching

- Frontend polls `https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json` every 5 seconds
- Metadata includes: title, artist, album, bit_depth, sample_rate, is_explicit, is_new
- Also includes 5 recently played tracks (prev_artist_1-5, prev_title_1-5)
- Year badge extracted from title using regex: `\((\d{4})\)`

#### HLS Streaming

- Stream URL: `https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`
- Uses HLS.js for browsers without native HLS support
- Safari uses native HLS support
- Low latency mode configured in frontend

## Brand Design Guidelines

The application follows the Radio Calico Style Guide. When making UI changes:

- **Never modify brand colors** without explicit user request
- **Maintain the two-column layout** (album left, info right) on desktop
- **Preserve responsive breakpoints** for mobile/tablet compatibility
- **Use established typography hierarchy**: Montserrat for headings, Open Sans for body
- **Reference RadioCalico_Style_Guide.txt** and **RadioCalicoLayout.png** for design decisions

## Common Development Patterns

### Adding a new API endpoint

1. Add route handler in appropriate section of `server.js`
2. **Make route handler async:** All routes must use async/await due to database abstraction
3. Use database abstraction methods from `db.js`:
   - `await db.get(sql, params)` - Get single row
   - `await db.all(sql, params)` - Get all rows
   - `await db.run(sql, params)` - Execute INSERT/UPDATE/DELETE
4. Always wrap in try-catch and return appropriate HTTP status codes
5. Use consistent response format: `{ message: 'Success' }` or `{ error: 'Error message' }`
6. **Write tests:** Create integration test in `tests/backend/integration/` following the pattern in `ratings-api.test.js`

**Example:**
```javascript
app.get('/api/example/:id', async (req, res) => {
  try {
    const result = await db.get('SELECT * FROM table WHERE id = ?', [req.params.id]);
    if (!result) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Database queries

**IMPORTANT: All database operations are now async** due to the abstraction layer.

- **Use async/await** for all database operations
- Import database: `const db = require('./db');`
- Available methods (all async):
  - `await db.get(sql, params)` - Get single row (returns object or null)
  - `await db.all(sql, params)` - Get all rows (returns array)
  - `await db.run(sql, params)` - Execute INSERT/UPDATE/DELETE (returns `{ lastInsertRowid, changes }`)
  - `await db.query(sql, params)` - Generic query (returns rows or result)
- Always use parameterized queries: `await db.get('SELECT * FROM users WHERE id = ?', [userId])`
- Access result properties: `.lastInsertRowid` for INSERT, `.changes` for UPDATE/DELETE
- Database abstraction handles differences between SQLite and PostgreSQL automatically

**Migration note:** Older code using synchronous `db.prepare()` must be updated to async `db.get()` / `db.all()` / `db.run()`

### Frontend JavaScript development

- All JavaScript is in `public/app.js` - modify this file for client-side changes
- Metadata fetching only runs while player is active (`isPlaying === true`)
- Album art uses cache-busting: `cover.jpg?t=${Date.now()}`
- Update all relevant DOM elements when metadata changes (title, artist, album, quality, year badge, recent tracks)
- Use `fetchRatings()` when song changes to get current vote counts
- Browser fingerprinting happens in `generateFingerprint()` - creates unique ID from canvas, screen, navigator properties
- **Write tests:** Create unit tests in `tests/frontend/unit/` for new UI functions (see `rating-display.test.js` for patterns)

### Docker deployment patterns

**When to use Docker:**
- Testing production builds locally before deployment
- Deploying to cloud platforms (AWS, Google Cloud, Azure)
- Ensuring consistent environments across development and production
- Isolating the application from host system dependencies

**Development with Docker:**
1. Start container: `docker-compose up --build`
2. Make code changes in your editor
3. Changes automatically sync to container (volume mounting)
4. Nodemon restarts server on `server.js` changes
5. Frontend changes are instant (static file serving)
6. Run tests: `docker-compose exec radio-calico-dev npm test`
7. Stop: `docker-compose down`

**Production deployment:**
1. **Configure environment:** Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD`
2. Build optimized images: `docker-compose -f docker-compose.prod.yml build`
3. Test locally: `docker-compose -f docker-compose.prod.yml up`
4. Verify health: `docker ps` (should show 3 healthy containers: postgres, radio-calico-api, nginx)
5. Test endpoints:
   - `curl http://localhost/` (nginx serves static files)
   - `curl http://localhost/api/health` (nginx proxies to API)
6. Deploy to server/cloud
7. Set up PostgreSQL backups (see Docker Environment section)
8. Configure HTTPS in nginx.conf for production domain
9. Monitor logs: `docker-compose -f docker-compose.prod.yml logs -f`

**Database configuration in Docker:**
- **Development:** SQLite database in project directory (`./radio.db`)
  - Set `DATABASE_TYPE=sqlite` and `DB_PATH=radio.db`
- **Production:** PostgreSQL in Docker volume (`postgres-data`)
  - Set `DATABASE_TYPE=postgres` and PostgreSQL connection details
  - Database persists in Docker volume even when containers are removed
- Always backup production PostgreSQL database before updates (see DOCKER.md for backup commands)

**Environment variable configuration:**
- Set in `docker-compose.yml` for development
- Set in `docker-compose.prod.yml` for production
- Can override with command line: `docker run -e PORT=8080 ...`

**Image optimization tips:**
- Use `.dockerignore` to exclude unnecessary files (tests, docs)
- Production image uses multi-stage builds (smaller size)
- Only production dependencies in final image
- Non-root user for security

## Testing Framework

The application has a comprehensive Jest-based testing framework covering both backend and frontend ratings functionality.

### Test Structure

```
tests/
├── backend/
│   ├── unit/
│   │   └── fingerprinting.test.js       # getUserFingerprint(), getClientIP() tests
│   ├── integration/
│   │   ├── ratings-api.test.js          # POST/GET /api/ratings endpoint tests
│   │   └── ratings-security.test.js     # Security and edge case tests
│   └── helpers/
│       ├── setup.js                     # Backend test configuration
│       ├── db-setup.js                  # In-memory SQLite utilities
│       └── mock-requests.js             # Mock Express request/response factories
└── frontend/
    ├── unit/
    │   └── rating-display.test.js       # updateRatingDisplay(), submitRating() tests
    └── helpers/
        ├── setup.js                     # Frontend test configuration
        └── setup-dom.js                 # DOM fixture utilities
```

### Test Configuration

- **Backend tests**: Run in Node.js environment with in-memory SQLite database
- **Frontend tests**: Run in jsdom environment with mocked fetch API
- **Coverage**: Configured with 50% thresholds for branches, functions, lines, statements
- **Current status**: All tests passing (40 backend, 17 frontend)

### Key Test Helpers

**Backend (`tests/backend/helpers/`):**
- `setupTestDatabase()` - Creates isolated in-memory database for each test
- `createMockRequest(options)` - Factory for Express request objects with custom headers
- `createMockResponse()` - Factory for Express response objects with Jest spies
- `seedRatings(db, ratings)` - Seeds test rating data

**Frontend (`tests/frontend/helpers/`):**
- `setupRatingsDOM()` - Creates rating UI elements matching index.html structure
- `getRatingElements()` - Returns references to rating DOM elements
- `setupMockFetch()` - Configures global fetch mock for API calls

### Writing Tests

When adding new features:
1. Write unit tests for individual functions
2. Write integration tests for API endpoints
3. Run `npm run test:coverage` to ensure coverage thresholds are met
4. Reference `TESTING.md` for detailed examples and patterns

### Test Coverage Areas

**Backend (server.js:149-548):**
- User fingerprinting logic (IP extraction, hash generation)
- Rating submission (new votes, duplicate votes, vote changes)
- Rating retrieval (counts, user vote status)
- Multi-user vote aggregation
- Unique constraint enforcement
- SQL injection protection (parameterized queries)
- Input validation (empty strings, null values, type checking)
- Edge cases (unicode, special characters, very long strings)

**Frontend (public/app.js:231-307):**
- Rating display updates (counts, active button states)
- Rating submission (fetch calls, error handling)
- UI state management (enabling/disabling buttons)
- Network error resilience

## Security Framework

The application implements comprehensive security measures including rate limiting, input validation, security headers, and automated security testing.

### Security Features Implemented

**1. Rate Limiting (express-rate-limit)**

Three tiers of rate limiting protect against abuse and DoS attacks:

```javascript
// General API: 100 requests per 15 minutes
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

// Write operations: 30 requests per 15 minutes
const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

// Ratings: 10 votes per minute (most restrictive)
const ratingsLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 10 });
```

**Application:**
- All `/api/*` routes → general limiter
- POST/PATCH endpoints → strict limiter
- `/api/ratings` → ratings limiter (strictest)

**2. Input Validation (express-validator)**

All user input is validated and sanitized:

```javascript
app.post('/api/ratings',
  ratingsLimiter,
  [
    body('song_id')
      .trim()                          // Remove whitespace
      .notEmpty()                      // Required field
      .isLength({ max: 255 })          // Length limit
      .matches(/^[a-zA-Z0-9_: -]+$/),  // Character whitelist
    body('rating')
      .isIn([1, -1])                   // Enum validation
      .toInt()
  ],
  handleValidationErrors,
  async (req, res) => { /* ... */ }
);
```

**Protection against:**
- SQL injection (parameterized queries + validation)
- XSS attacks (HTML escaping)
- Buffer overflows (length limits)
- Type confusion (type validation)
- DoS via large inputs (10kb request limit)

**3. Security Headers (helmet.js)**

Helmet adds essential security headers:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      // ... more directives
    },
  },
  frameguard: { action: 'sameorigin' },  // Prevent clickjacking
}));
```

**Headers added:**
- Content-Security-Policy (prevents XSS)
- X-Frame-Options (prevents clickjacking)
- X-Content-Type-Options (prevents MIME sniffing)
- Strict-Transport-Security (enforces HTTPS)
- X-XSS-Protection (browser XSS filter)

**4. CORS Configuration**

Production-ready CORS restrictions:

```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost'
    : '*',
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

**Set in production .env:**
```
ALLOWED_ORIGINS=https://radiocalico.com,https://www.radiocalico.com
```

**5. Database Security**

All queries use parameterized statements:

```javascript
// GOOD: Parameterized query (always use this)
await database.get('SELECT * FROM users WHERE id = ?', [userId]);

// BAD: String concatenation (NEVER do this)
await database.get(`SELECT * FROM users WHERE id = ${userId}`);
```

**Protection:**
- SQL injection prevention
- Database abstraction handles both SQLite and PostgreSQL
- Automatic placeholder conversion (`?` → `$1, $2, ...` for PostgreSQL)

### Security Testing Tools

The project includes a comprehensive security testing framework with multiple tools:

**Dependency Scanning:**
- **npm audit** - Built-in vulnerability scanner
- **Snyk** - Enhanced dependency scanning with larger vulnerability database

**Static Analysis:**
- **ESLint + security plugins** - Detects unsafe code patterns
- **Semgrep** - Pattern-based security scanner for OWASP Top 10

**Container Scanning:**
- **Trivy** - Scans Docker images for vulnerabilities in OS packages and dependencies

**Dynamic Testing:**
- **OWASP ZAP** - Dynamic application security testing (penetration testing)

**Make Commands:**

```bash
# Install security tools
make security-install

# Quick scan (before commits)
make security

# Comprehensive scan (before deployments)
make security-full

# Individual scans
make security-deps       # Snyk dependency scan
make security-code       # ESLint + Semgrep
make security-docker     # Trivy image scan
make security-api        # OWASP ZAP (requires running server)

# Generate reports
make security-report     # Detailed JSON + text reports
```

**Report locations:**
All security reports are generated in the `reports/` directory:
- `security-audit.json/txt` - npm audit results
- `snyk-report.json/txt` - Snyk dependency scan
- `eslint-security.json/txt` - ESLint findings
- `semgrep-report.json/txt` - Semgrep analysis
- `trivy-dev.txt`, `trivy-api.txt`, `trivy-nginx.txt` - Container scans
- `zap-report.json/html` - OWASP ZAP penetration test results

### Security Documentation

**SECURITY.md** - Comprehensive security testing guide:
- Tool installation and setup
- Security testing workflows
- Detailed testing procedures for each tool
- Security best practices
- Vulnerability response process
- Common vulnerabilities and prevention
- GDPR/CCPA compliance considerations

**SECURITY-AUDIT-REPORT.md** - Detailed security audit findings:
- 2 Critical issues identified
- 4 High severity issues identified
- 6 Medium severity issues identified
- 3 Low severity issues identified
- 10 Positive security findings
- Prioritized remediation roadmap
- Production deployment checklist

### Security Best Practices for Development

**Before Every Commit:**
```bash
make security          # Run npm audit
make test              # Ensure tests pass
# Check for hardcoded secrets
# Review new code for security issues
```

**Before Every Deployment:**
```bash
make security-full     # Comprehensive security scan
make test-coverage     # Verify coverage thresholds
npm outdated           # Check for updates
# Review HIGH/CRITICAL findings
# Backup database
# Set ALLOWED_ORIGINS in .env
# Verify HTTPS is configured
```

**Common Security Pitfalls to Avoid:**

❌ **BAD:**
```javascript
// String interpolation in SQL
await db.get(`SELECT * FROM users WHERE name = '${userName}'`);

// Using .innerHTML with user data
element.innerHTML = userData;

// No input validation
const { email } = req.body;
await sendEmail(email);

// Exposing detailed errors
res.status(500).json({ error: error.stack });
```

✅ **GOOD:**
```javascript
// Parameterized queries
await db.get('SELECT * FROM users WHERE name = ?', [userName]);

// Using .textContent (safe)
element.textContent = userData;

// Input validation
body('email').trim().isEmail().normalizeEmail()

// Generic errors in production
res.status(500).json({ error: 'Internal server error' });
```

### Production Security Checklist

**Critical (Must Fix Before Production):**
- [ ] Configure HTTPS/TLS in nginx
- [ ] Set `ALLOWED_ORIGINS` environment variable
- [ ] Add authentication for admin endpoints
- [ ] Implement CSRF protection
- [ ] Sanitize error messages (no stack traces)
- [ ] Set `NODE_ENV=production`
- [ ] Use strong passwords for PostgreSQL
- [ ] Review and address all HIGH/CRITICAL security findings

**Recommended:**
- [ ] Add structured logging (Winston)
- [ ] Set up monitoring and alerting
- [ ] Configure request timeouts
- [ ] Review GDPR compliance (IP storage)
- [ ] Add anomaly detection for vote manipulation
- [ ] Set up automated security scans in CI/CD
- [ ] Regular security audits (monthly/quarterly)

### Security Monitoring

**What to Monitor:**
- Rate limit violations (potential attacks)
- Failed validation attempts (malicious input)
- Unusual voting patterns (vote manipulation)
- Database errors (possible injection attempts)
- Authentication failures (when implemented)
- Large request payloads (DoS attempts)

**Logging Best Practices:**
- Log all security events
- Don't log sensitive data (passwords, tokens, PII)
- Use structured logging (JSON format)
- Rotate logs regularly
- Monitor logs for suspicious patterns
- Set up alerts for critical events

### Known Security Limitations

⚠️ **Current Limitations:**

1. **No Authentication** - All endpoints are public
   - Impact: Anyone can view feedback, modify request status
   - Mitigation: Add JWT or API key authentication before production

2. **No CSRF Protection** - Cross-site request forgery possible
   - Impact: Low currently (no auth), will be critical when auth added
   - Mitigation: Implement csurf middleware

3. **Client-side fingerprinting** - Can be bypassed
   - Impact: Vote manipulation possible (but rate-limited)
   - Mitigation: Server-side fingerprint is primary defense

4. **IP Address Storage** - GDPR concern
   - Impact: May require user consent, data deletion API
   - Mitigation: Consider hashing IPs or removing column

5. **No HTTPS in Development** - Acceptable for dev, critical for production
   - Impact: Data transmitted in cleartext
   - Mitigation: Configure SSL/TLS certificates in nginx for production

See `SECURITY-AUDIT-REPORT.md` for detailed findings and remediation steps.

## Known Issues and Quirks

- **Docker Desktop must be running:** Before any `docker` or `docker-compose` commands, Docker Desktop must be started and running. Common error if not running: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`. Solution: Start Docker Desktop from Start Menu, wait for whale icon in system tray to be steady, verify with `docker ps`.
- **Production requires .env file:** Production deployment requires creating a `.env` file with `POSTGRES_PASSWORD` set. Copy `.env.example` and edit it before running `docker-compose -f docker-compose.prod.yml up`.
- **Different databases:** Development uses SQLite (synchronous), production uses PostgreSQL (async). All code uses async/await via `db.js` abstraction layer.
- **Async/await required:** All database operations must use async/await. Old synchronous `db.prepare()` code won't work with PostgreSQL.
- **Production architecture:** Production uses 3 containers (postgres, API, nginx). Only nginx port 80 is exposed. API and database are internal only.
- **Nginx in production only:** Development uses Express to serve static files. Production uses nginx for static files and reverse proxy.
- **Database locking (SQLite only):** SQLite allows only one connection at a time. If using DB viewer tools in development, close them before running server.
- **Session management:** Uses fingerprint-based session IDs stored in localStorage, not server-side sessions.
- **Client-side fingerprinting:** `app.js` includes canvas fingerprinting code that generates browser-unique IDs, sent with API requests along with server-side fingerprint for redundancy.
- **Metadata polling:** Happens every 5 seconds, not every second, to reduce server load.
- **Docker on Windows:** Use PowerShell or WSL for best Docker experience. Git Bash may have issues with path mounting.
- **Docker database access:** Production PostgreSQL database is in a Docker volume, not directly accessible. Use `docker exec` commands (see Docker Environment section).
- **Hot-reloading in Docker:** Frontend changes (HTML/CSS/JS in `public/`) are instant, but `server.js` and `db.js` changes require nodemon restart (~2-3 seconds).
- **Port differences:** Development uses port 3000, production uses port 80 (nginx) with API on internal port 3000.

## Manual Testing & Verification

### Automated Tests

**Local (without Docker):**
```bash
npm test                 # Run all 40 unit and integration tests
npm run test:coverage    # Generate coverage report (see coverage/lcov-report/index.html)
```

**In Docker container:**
```bash
# Development container
docker-compose exec radio-calico-dev npm test
docker-compose exec radio-calico-dev npm run test:coverage

# Production container (not recommended - tests excluded)
# Use development container for testing
```

### Manual API Testing

**Development (port 3000):**
- **Health check:** `curl http://localhost:3000/api/health`
- **Stream accessibility:** `curl https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`
- **Metadata accessibility:** `curl https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`
- **Test rating endpoint:** POST to `/api/ratings` with JSON body

**Production (port 80 via nginx):**
- **Health check (nginx):** `curl http://localhost/health`
- **Health check (API via nginx):** `curl http://localhost/api/health`
- **Test static files:** `curl http://localhost/` (should return HTML)
- **Test API proxy:** All API requests go through nginx reverse proxy

### Database Inspection

**Local database:**
- **View database:** Use DB Browser for SQLite or `sqlite3 radio.db` CLI
- **Test database:** In-memory databases are created automatically for tests (no cleanup needed)

**Docker database:**
- **Development (SQLite):** Database is at `./radio.db` in project directory (accessible from host)
  - Query from container: `docker-compose exec radio-calico-dev sqlite3 /app/radio.db`
- **Production (PostgreSQL):** Database is in Docker volume `postgres-data`
  - Connect to PostgreSQL: `docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio`
  - Check tables: `docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio -c "\dt"`
  - Run query: `docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio -c "SELECT * FROM listeners;"`

## File Reference

### Application Files
- `server.js` - Main Express server (API endpoints, routes, server lifecycle)
- `db.js` - Database abstraction layer (supports SQLite and PostgreSQL)
- `nginx.conf` - Nginx configuration for production (reverse proxy + static file serving)
- `.env.example` - Environment variables template (copy to `.env` for production)
- `public/index.html` - Frontend HTML structure (minimal, clean markup only)
- `public/app.js` - All client-side JavaScript (player, metadata, ratings, fingerprinting)
- `public/styles.css` - All brand styling and responsive design
- `radio.db` - SQLite database (auto-created on first run in development, gitignored)

### Testing Files
- `jest.config.js` - Jest configuration (backend + frontend projects)
- `TESTING.md` - Comprehensive testing documentation and guide
- `tests/backend/` - Backend unit and integration tests
- `tests/frontend/` - Frontend unit tests
- `coverage/` - Test coverage reports (generated by `npm run test:coverage`, gitignored)

### Docker & Deployment Files
- `Dockerfile` - Legacy Docker file (now redirects to dev configuration for backwards compatibility)
- `Dockerfile.dev` - Development-optimized Docker image (hot-reloading, SQLite, all dependencies, ~350MB)
- `Dockerfile.prod` - Production-optimized Docker image (multi-stage build, API only, non-root user, ~150MB)
- `docker-compose.yml` - Development environment orchestration (single container, SQLite, source mounting)
- `docker-compose.prod.yml` - Production environment orchestration (three containers: postgres + API + nginx)
- `.dockerignore` - Docker build exclusions (tests, docs, dev files excluded from images)
- `DOCKER.md` - Comprehensive Docker deployment guide covering PostgreSQL, nginx, three-service architecture
- `RUNDOCKER.md` - Quick reference guide with copy-paste Docker commands (gitignored personal file)

### Configuration & Documentation
- `package.json` - Dependencies and npm scripts (including test and security commands)
- `Makefile` - Convenient shortcuts for development, testing, security, and Docker workflows
- `.eslintrc.json` - ESLint configuration with security plugins
- `CLAUDE.md` - This file (project memory for Claude Code)
- `README.md` - User-facing documentation
- `SECURITY.md` - Comprehensive security testing guide and best practices
- `SECURITY-AUDIT-REPORT.md` - Detailed security audit findings and remediation roadmap
- `.gitignore` - Git ignore rules (organized by category: dependencies, runtime data, secrets, logs, personal files, Docker runtime)

### Design Reference
- `RadioCalico_Style_Guide.txt` - Official brand guidelines
- `RadioCalicoLayout.png` - Reference design mockup
- `stream_URL.txt` - HLS stream URL reference

## Version Control & Git

### What's Tracked in Git (Committed)

**Source Code:**
- `server.js` - Main application
- `public/` - All frontend files (HTML, JS, CSS, images)
- `tests/` - All test files and helpers

**Docker Configuration (Infrastructure as Code):**
- `Dockerfile`, `Dockerfile.dev`, `Dockerfile.prod` - Container definitions
- `docker-compose.yml`, `docker-compose.prod.yml` - Orchestration configs
- `.dockerignore` - Build exclusions
- **Why these are tracked:** Team collaboration, CI/CD pipelines, consistent environments, documentation

**Documentation:**
- `README.md`, `CLAUDE.md`, `DOCKER.md`, `TESTING.md`, `SECURITY.md`, `SECURITY-AUDIT-REPORT.md`
- Design files: `RadioCalico_Style_Guide.txt`, `RadioCalicoLayout.png`

**Configuration:**
- `package.json`, `jest.config.js`, `Makefile`, `.eslintrc.json`

### What's Ignored by Git (.gitignore)

**Runtime Data:**
- `*.db`, `*.db-shm`, `*.db-wal` - SQLite database files (generated at runtime)
- `logs/`, `*.log` - Application and npm logs

**Dependencies:**
- `node_modules/` - Installed via `npm install`

**Environment & Secrets:**
- `.env`, `.env.local`, `.env.*.local` - May contain API keys, passwords, tokens

**Test & Build Artifacts:**
- `coverage/` - Test coverage reports (regenerated with `npm run test:coverage`)
- `reports/` - Security audit reports (generated by `make security-report` and `make security-full`)
- `backups/` - Database backups (generated by `make db-backup`)
- `.snyk` - Snyk configuration and cache

**Personal Files:**
- `RUNDOCKER.md` - User's personal Docker reference (not needed in repo)

**Docker Runtime Files:**
- `docker-compose.override.yml` - Local development overrides
- `.docker/` - Docker runtime data directory

**OS-Specific:**
- `.DS_Store` (macOS), `Thumbs.db` (Windows)

### Important Git Practices

**NEVER commit:**
- Database files (contain user data)
- `.env` files (contain secrets)
- `node_modules/` (huge, regeneratable)
- Personal notes or machine-specific configs

**ALWAYS commit:**
- Docker configuration files (Dockerfile*, docker-compose*.yml)
- Documentation updates
- Source code changes
- Configuration changes (package.json, jest.config.js)

**When adding new environment variables:**
1. Add to `.env.example` (template without real values) - COMMIT THIS
2. Add to `.env` (actual values) - DO NOT COMMIT
3. Document in README.md and DOCKER.md

## Docker Environment

### Environment Variables

The application supports different environment variables for development and production:

**Development (SQLite):**
- **`NODE_ENV`** (default: `development`) - Environment mode
- **`PORT`** (default: `3000`) - Server port number
- **`DATABASE_TYPE`** (default: `sqlite`) - Database type
- **`DB_PATH`** (default: `radio.db`) - SQLite database file path

**Production (PostgreSQL):**
- **`NODE_ENV`** (default: `production`) - Environment mode
- **`PORT`** (default: `80`) - Nginx external port (API uses 3000 internally)
- **`DATABASE_TYPE`** (default: `postgres`) - Database type
- **`POSTGRES_HOST`** (default: `localhost`) - PostgreSQL hostname
- **`POSTGRES_PORT`** (default: `5432`) - PostgreSQL port
- **`POSTGRES_DB`** (default: `radio`) - PostgreSQL database name
- **`POSTGRES_USER`** (default: `radio`) - PostgreSQL username
- **`POSTGRES_PASSWORD`** (required) - PostgreSQL password

**Example usage:**
```bash
# Local development with SQLite
PORT=8080 NODE_ENV=development DATABASE_TYPE=sqlite npm start

# Docker development (set in docker-compose.yml)
environment:
  - PORT=3000
  - NODE_ENV=development
  - DATABASE_TYPE=sqlite
  - DB_PATH=radio.db

# Docker production (set in docker-compose.prod.yml or .env file)
environment:
  - PORT=3000  # API internal port (nginx exposes port 80)
  - NODE_ENV=production
  - DATABASE_TYPE=postgres
  - POSTGRES_HOST=postgres
  - POSTGRES_PORT=5432
  - POSTGRES_DB=radio
  - POSTGRES_USER=radio
  - POSTGRES_PASSWORD=your_secure_password_here
```

**Using `.env` file (recommended for production):**
```bash
# Copy template
cp .env.example .env

# Edit .env and set secure password
# docker-compose.prod.yml automatically loads .env file
```

### Docker Architecture

**Development Architecture (Single Container):**

`Dockerfile.dev` creates a single development container:
- Based on `node:22-alpine`
- Includes build tools (python3, make, g++) for better-sqlite3 compilation
- Installs all dependencies (including devDependencies)
- Source code mounted as volume for hot-reloading with nodemon
- SQLite database file stored in project directory (`./radio.db`)
- Serves both API and static files via Express
- Health check pings `/api/health` every 30 seconds
- Size: ~350MB

**Production Architecture (Three Containers):**

Production uses three separate containers defined in `docker-compose.prod.yml`:

1. **PostgreSQL Container (`postgres`):**
   - Image: `postgres:16-alpine`
   - Data stored in named volume `postgres-data`
   - Environment: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
   - Health check: `pg_isready -U radio` every 10s
   - Not exposed externally (internal only)

2. **API Container (`radio-calico-api`):**
   - Built from `Dockerfile.prod`
   - Multi-stage build for optimization
   - Stage 1 (builder): Compiles dependencies (better-sqlite3 + pg)
   - Stage 2 (production): Minimal runtime image with only `server.js` and `db.js`
   - Runs as non-root user (`nodejs:nodejs` uid:1001)
   - Only production dependencies installed
   - Connects to PostgreSQL via `postgres:5432`
   - Health check: GET `http://localhost:3000/api/health` every 30s
   - Not exposed externally (nginx proxies requests)
   - Size: ~150MB

3. **Nginx Container (`nginx`):**
   - Image: `nginx:1.25-alpine`
   - Serves static files from `./public` directory
   - Reverse proxies `/api/*` requests to `radio-calico-api:3000`
   - Adds security headers and caching
   - Health check: GET `http://localhost/health` every 30s
   - Exposed on port 80 (configurable)
   - Size: ~40MB

**Production container dependencies:**
- Nginx depends on radio-calico-api
- API depends on postgres (waits for health check)

### Database Management in Docker

**Development (SQLite):**
- Database file: `./radio.db` (in project directory)
- Persists across container restarts
- Can be edited with SQLite tools on host machine
- Deleted when volume is removed with `docker-compose down -v`
- Backup: `cp radio.db radio.db.backup`

**Production (PostgreSQL):**
- Database runs in separate `postgres` container
- Data stored in Docker named volume: `postgres-data`
- Persists even when containers are removed
- Not directly accessible from host (use `docker exec` commands)

**Backup production PostgreSQL database:**
```bash
# SQL dump (recommended)
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio radio > backup.sql

# Compressed SQL dump
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio radio | gzip > backup.sql.gz

# Custom format (faster restore)
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U radio -Fc radio > backup.dump
```

**Restore production PostgreSQL database:**
```bash
# From SQL dump
cat backup.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U radio -d radio

# From compressed SQL dump
gunzip -c backup.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U radio -d radio

# From custom format
docker-compose -f docker-compose.prod.yml exec -T postgres pg_restore -U radio -d radio -c < backup.dump
```

**Access PostgreSQL directly:**
```bash
# Connect with psql
docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio

# Check tables
docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio -c "\dt"

# Run query
docker-compose -f docker-compose.prod.yml exec postgres psql -U radio -d radio -c "SELECT COUNT(*) FROM song_ratings;"
```

### Docker Development Workflow

1. **Start development environment:**
   ```bash
   docker-compose up --build
   ```

2. **Edit code locally** - changes automatically reflected due to volume mounting

3. **Nodemon restarts server** - happens automatically when `server.js` changes

4. **View logs:**
   ```bash
   docker-compose logs -f
   ```

5. **Run tests in container:**
   ```bash
   docker-compose exec radio-calico-dev npm test
   ```

6. **Shell into container for debugging:**
   ```bash
   docker-compose exec radio-calico-dev sh
   ```

### Docker Production Deployment

1. **Build and start production container:**
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

2. **Verify health status:**
   ```bash
   docker ps  # Check "STATUS" column shows "healthy"
   ```

3. **Monitor logs:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

4. **Backup database regularly:**
   ```bash
   # Use backup commands from Database Management section
   ```

5. **Update to new version:**
   ```bash
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

### Common Docker Patterns

**Rebuild without cache:**
```bash
docker-compose build --no-cache
docker-compose up -d
```

**View container stats:**
```bash
docker stats radio-calico-prod
```

**Clean up everything:**
```bash
docker-compose down -v        # Remove containers and volumes
docker system prune -a        # Clean up all unused Docker resources
```

**Run tests in production image:**
```bash
# Not recommended - tests are excluded from prod image via .dockerignore
# Use development image for testing instead
```

## Development Best Practices

### Test-Driven Development
- **Always run tests before committing:** `npm test` to ensure nothing broke
- **Write tests for new features:** Follow the patterns in existing test files
- **Check coverage:** `npm run test:coverage` to identify untested code paths
- **Use watch mode during development:** `npm run test:watch` for instant feedback

### Code Quality
- Tests provide documentation of expected behavior - read them to understand how features work
- All test helpers are well-documented with JSDoc comments
- Test files mirror the structure of source files for easy navigation
- In-memory databases ensure tests are fast and don't pollute the production database

### Security Best Practices
- **Always run security scans before committing:** `make security` to check for vulnerabilities
- **Comprehensive scan before deployment:** `make security-full` runs all security tools
- **Never use string interpolation in SQL queries:** Always use parameterized queries with `?` placeholders
- **Always validate user input:** Use express-validator on all API endpoints
- **Never expose detailed errors in production:** Use generic error messages, log details server-side
- **Never commit secrets:** Use environment variables for passwords, API keys, tokens
- **Always use HTTPS in production:** Configure SSL/TLS certificates in nginx
- **Review security reports regularly:** Check `reports/` directory for findings
- **Keep dependencies updated:** Run `npm outdated` and `npm update` regularly
- **Follow the Security Framework guidelines:** See Security Framework section above for detailed practices
- **Read security documentation:** Refer to `SECURITY.md` for comprehensive testing procedures and `SECURITY-AUDIT-REPORT.md` for current security status

### Docker Best Practices
- **Development:** Use `docker-compose up` for local development with hot-reloading
- **Production:** Always use `docker-compose.prod.yml` for production deployments
- **Database backups:** Backup production database before deploying updates
- **Health checks:** Verify container health with `docker ps` after deployment
- **Logs:** Monitor logs regularly with `docker-compose logs -f`
- **Security:** Production image runs as non-root user, never override this
- **Volumes:** Use named volumes for production databases, never mount host directories
- **Testing:** Run tests in development container, not production
- **Rebuilding:** Use `--no-cache` if dependencies or base image changed
- **Cleanup:** Regularly prune unused Docker resources with `docker system prune`
- **Environment:** Always set `NODE_ENV=production` for production deployments
- **Documentation:** Refer to `DOCKER.md` for comprehensive deployment instructions, or `RUNDOCKER.md` for quick reference commands

### Version Control Best Practices
- **Commit Docker configs:** Always commit Dockerfile*, docker-compose*.yml, and .dockerignore files
- **Never commit secrets:** Keep .env files out of Git, use .env.example for templates
- **Never commit runtime data:** Database files (*.db), logs, node_modules, coverage reports stay local
- **Organize .gitignore:** Group related entries with comments for clarity
- **Personal files:** Keep personal reference files (like RUNDOCKER.md) gitignored
- **Docker overrides:** If using docker-compose.override.yml for local dev, keep it gitignored
- **Check before commit:** Run `git status` to ensure no sensitive files are staged
- **Infrastructure as Code:** Docker configs are infrastructure - version control them like source code