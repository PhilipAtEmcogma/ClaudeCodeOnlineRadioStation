# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Radio Calico is a full-featured live radio streaming web application with HLS audio streaming, real-time metadata updates, listener analytics, song ratings, and request management. The application uses a **monolithic architecture** with a single Node.js/Express backend serving both the API and static frontend files.

## Technology Stack

- **Backend:** Node.js v22+ with Express.js
- **Database:** SQLite with better-sqlite3 (synchronous API)
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 with HLS.js for audio streaming
- **Testing:** Jest with Supertest (backend) and Testing Library (frontend)
- **Development:** Nodemon for auto-reload
- **Containerization:** Docker with separate dev/prod configurations

## Development Commands

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

**Production mode** (optimized, security-hardened):
```bash
docker-compose -f docker-compose.prod.yml up --build -d     # Start prod server (detached)
docker-compose -f docker-compose.prod.yml logs -f           # View logs
docker-compose -f docker-compose.prod.yml ps                # Check status
docker-compose -f docker-compose.prod.yml down              # Stop and remove
docker-compose -f docker-compose.prod.yml down -v           # Stop and remove volumes
```

**IMPORTANT:**
- The user has Docker Desktop for Windows (v28.1.1+) installed
- **Docker Desktop MUST be running before any docker commands** - if not running, user will see error: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`
- If you need the user to run Docker commands, ALWAYS remind them to start Docker Desktop first and verify with `docker ps`
- Development uses `Dockerfile.dev`, production uses `Dockerfile.prod`
- Database persists in Docker volume for production (`radio_radio-data`)
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

## High-Level Architecture

### Backend Structure (server.js)

The application is entirely contained in a single `server.js` file (~540 lines) organized into these sections:

1. **Database Initialization** (lines 10-141)
   - Creates SQLite tables on startup
   - Database path configurable via `DB_PATH` environment variable (default: `radio.db`)
   - Runs automatic schema migrations to add new columns/indexes
   - Migration logic handles backwards compatibility and data preservation
   - Tables: `listeners`, `listening_sessions`, `song_requests`, `feedback`, `song_ratings`

2. **User Fingerprinting System** (lines 149-173)
   - Server-side fingerprinting: Combines IP, User-Agent, Accept-Language, Accept-Encoding into SHA-256 hash
   - Used to prevent duplicate votes without requiring user login
   - Critical for the rating system's one-vote-per-user guarantee

3. **API Endpoints** - RESTful API organized by feature:
   - **Listeners API** (lines 175-217): Register/update listeners, get stats
   - **Listening Sessions API** (lines 219-282): Track session start/end, calculate duration
   - **Song Requests API** (lines 284-342): Submit/retrieve/update song requests
   - **Feedback API** (lines 344-398): Submit feedback with star ratings
   - **Song Ratings API** (lines 400-503): Thumbs up/down voting with deduplication logic
   - **Health Check** (line 507): Simple health endpoint

4. **Server Lifecycle** (lines 515-540)
   - Starts server on port 3000 (configurable via PORT env var)
   - Binds to 0.0.0.0 for Docker compatibility
   - Graceful shutdown handler to close database connection

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

**song_ratings table** - Most complex table due to fingerprinting:
- `user_fingerprint`: SHA-256 hash of server-side fingerprint
- Unique index on `(song_id, user_fingerprint)` prevents duplicate votes
- Users can change votes (UPDATE), not add multiple votes

**Migration system:**
- Runs on every server startup
- Checks for schema changes using `PRAGMA table_info` and `PRAGMA index_list`
- Creates backup tables, migrates data, drops old tables
- Safe to run repeatedly (idempotent)

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
2. Use prepared statements: `db.prepare('SELECT...').get()` or `.all()` or `.run()`
3. Always wrap in try-catch and return appropriate HTTP status codes
4. Use consistent response format: `{ message: 'Success' }` or `{ error: 'Error message' }`
5. **Write tests:** Create integration test in `tests/backend/integration/` following the pattern in `ratings-api.test.js`

### Database queries

- **better-sqlite3 is synchronous** - no async/await needed
- Use `.get()` for single row, `.all()` for multiple rows, `.run()` for INSERT/UPDATE/DELETE
- Always use parameterized queries: `db.prepare('SELECT * FROM users WHERE id = ?').get(userId)`
- Access result properties: `.lastInsertRowid` for INSERT, `.changes` for UPDATE/DELETE

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
1. Build optimized image: `docker-compose -f docker-compose.prod.yml build`
2. Test locally: `docker-compose -f docker-compose.prod.yml up`
3. Verify health: `docker ps` (should show "healthy" status)
4. Deploy to server/cloud
5. Set up database backups (see Docker Environment section)
6. Configure reverse proxy (nginx/Caddy) for HTTPS
7. Monitor logs: `docker-compose -f docker-compose.prod.yml logs -f`

**Database configuration in Docker:**
- Use `DB_PATH` environment variable to specify database location
- Development: Database in project directory (`./radio.db`)
- Production: Database in Docker volume (`/app/data/radio.db`)
- Always backup production database before updates

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

## Known Issues and Quirks

- **Docker Desktop must be running:** Before any `docker` or `docker-compose` commands, Docker Desktop must be started and running. Common error if not running: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`. Solution: Start Docker Desktop from Start Menu, wait for whale icon in system tray to be steady, verify with `docker ps`.
- **Database locking:** Only one connection at a time. If using DB viewer tools, close them before running server.
- **Session management:** Uses fingerprint-based session IDs stored in localStorage, not server-side sessions.
- **Client-side fingerprinting:** `app.js` includes canvas fingerprinting code that generates browser-unique IDs, sent with API requests along with server-side fingerprint for redundancy.
- **Metadata polling:** Happens every 5 seconds, not every second, to reduce server load.
- **Docker on Windows:** Use PowerShell or WSL for best Docker experience. Git Bash may have issues with path mounting.
- **Docker database access:** Production database is in a Docker volume, not directly accessible. Use backup/restore commands from Docker Environment section.
- **Hot-reloading in Docker:** Frontend changes (HTML/CSS/JS in `public/`) are instant, but `server.js` changes require nodemon restart (~2-3 seconds).

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
- **Health check:** `curl http://localhost:3000/api/health`
- **Stream accessibility:** `curl https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`
- **Metadata accessibility:** `curl https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`
- **Test rating endpoint:** POST to `/api/ratings` with JSON body

### Database Inspection

**Local database:**
- **View database:** Use DB Browser for SQLite or `sqlite3 radio.db` CLI
- **Test database:** In-memory databases are created automatically for tests (no cleanup needed)

**Docker database:**
- **Development:** Database is at `./radio.db` in project directory (accessible from host)
- **Production:** Database is in Docker volume (use backup commands from Docker Environment section)
- **Query from container:** `docker-compose exec radio-calico-dev sqlite3 /app/radio.db`

## File Reference

### Application Files
- `server.js` - Entire backend (API + database + server)
- `public/index.html` - Frontend HTML structure (minimal, clean markup only)
- `public/app.js` - All client-side JavaScript (player, metadata, ratings, fingerprinting)
- `public/styles.css` - All brand styling and responsive design
- `radio.db` - SQLite database (auto-created on first run, gitignored)

### Testing Files
- `jest.config.js` - Jest configuration (backend + frontend projects)
- `TESTING.md` - Comprehensive testing documentation and guide
- `tests/backend/` - Backend unit and integration tests
- `tests/frontend/` - Frontend unit tests
- `coverage/` - Test coverage reports (generated by `npm run test:coverage`, gitignored)

### Docker & Deployment Files
- `Dockerfile` - Legacy Docker file (now redirects to dev configuration for backwards compatibility)
- `Dockerfile.dev` - Development-optimized Docker image (hot-reloading, all dependencies, ~350MB)
- `Dockerfile.prod` - Production-optimized Docker image (multi-stage build, non-root user, ~150MB)
- `docker-compose.yml` - Development environment orchestration (source mounting, local database)
- `docker-compose.prod.yml` - Production environment orchestration (volume persistence, health checks)
- `.dockerignore` - Docker build exclusions (tests, docs, dev files excluded from images)
- `DOCKER.md` - Comprehensive Docker deployment guide (350+ lines covering all deployment scenarios)
- `RUNDOCKER.md` - Quick reference guide with copy-paste Docker commands (gitignored personal file)

### Configuration & Documentation
- `package.json` - Dependencies and npm scripts (including test commands)
- `CLAUDE.md` - This file (project memory for Claude Code)
- `README.md` - User-facing documentation
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
- `README.md`, `CLAUDE.md`, `DOCKER.md`, `TESTING.md`
- Design files: `RadioCalico_Style_Guide.txt`, `RadioCalicoLayout.png`

**Configuration:**
- `package.json`, `jest.config.js`

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

The application supports the following environment variables:

- **`PORT`** (default: `3000`) - Server port number
- **`NODE_ENV`** (default: `development`) - Environment mode (`development` or `production`)
- **`DB_PATH`** (default: `radio.db`) - SQLite database file path

**Example usage:**
```bash
# Local development
PORT=8080 NODE_ENV=development npm start

# Docker development (set in docker-compose.yml)
environment:
  - PORT=3000
  - NODE_ENV=development

# Docker production (set in docker-compose.prod.yml)
environment:
  - PORT=3000
  - NODE_ENV=production
  - DB_PATH=/app/data/radio.db
```

### Docker Architecture

**Development Container (`Dockerfile.dev`):**
- Based on `node:22-alpine`
- Includes build tools (python3, make, g++) for better-sqlite3 compilation
- Installs all dependencies (including devDependencies)
- Source code mounted as volume for hot-reloading with nodemon
- Database file stored in project directory (`./radio.db`)
- Health check pings `/api/health` every 30 seconds
- Size: ~350MB

**Production Container (`Dockerfile.prod`):**
- Multi-stage build for optimization
- Stage 1 (builder): Compiles dependencies
- Stage 2 (production): Minimal runtime image
- Runs as non-root user (`nodejs:nodejs` uid:1001)
- Only production dependencies installed
- Database stored in Docker named volume (`radio_radio-data`)
- Health check with 30s interval, 40s start period
- Auto-restart on failure
- Size: ~150MB

### Database Management in Docker

**Development:**
- Database file: `./radio.db` (in project directory)
- Persists across container restarts
- Can be edited with SQLite tools on host machine
- Deleted when volume is removed with `docker-compose down -v`

**Production:**
- Database stored in Docker named volume: `radio_radio-data`
- Persists even when containers are removed
- Not directly accessible from host (requires Docker volume commands)

**Backup production database:**
```bash
docker run --rm \
  -v radio_radio-data:/data \
  -v ${PWD}:/backup \
  alpine tar czf /backup/db-backup.tar.gz -C /data .
```

**Restore production database:**
```bash
docker run --rm \
  -v radio_radio-data:/data \
  -v ${PWD}:/backup \
  alpine tar xzf /backup/db-backup.tar.gz -C /data
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