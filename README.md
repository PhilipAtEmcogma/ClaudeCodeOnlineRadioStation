# Radio Calico - Live Streaming Web Application

A full-featured live radio streaming web application with HLS audio streaming, real-time metadata, listener analytics, song ratings, and request management. Features a professional design following the Radio Calico brand style guide with a modern horizontal layout.

## Features

### 🎵 Core Features
- **Live HLS Audio Streaming** - High-quality audio streaming with HLS.js support
- **Real-time Metadata** - Displays currently playing song, artist, album, and cover art
- **Recently Played Tracks** - Shows the last 5 songs that were played
- **Audio Quality Indicators** - Displays bit depth, sample rate, and content flags (Explicit, New)

### 👍 Rating System
- **Song Voting** - Users can vote thumbs up or thumbs down on songs
- **Vote Changes** - Users can change their vote from thumbs up to thumbs down (and vice versa)
- **Persistent User Identification** - Votes are tracked per user without requiring login
  - Server-side fingerprinting based on IP address, User-Agent, and browser headers
  - Client-side fingerprinting as backup using canvas, screen, and browser properties
  - Combined approach ensures one vote per user per song across sessions

### 📊 Analytics & Tracking
- **Listener Statistics** - Track total listeners and listening time
- **Session Management** - Monitor active listening sessions with duration tracking
- **Song Rating Analytics** - View aggregated thumbs up/down counts per song

### 🎤 User Engagement
- **Song Requests** - Users can request songs with optional messages
- **Feedback System** - Collect user feedback with ratings (1-5 stars)
- **Request Management** - Approve, reject, or mark requests as played

## Design & Branding

### Radio Calico Brand Identity

The application follows the official **Radio Calico Style Guide** with a cohesive brand identity:

#### Color Palette
- **Mint** (#D8F2D5) - Background accents and footer
- **Forest Green** (#1F4E23) - Primary buttons and headings
- **Teal** (#38A29D) - Navigation and interactive elements
- **Calico Orange** (#EFA63C) - Call-to-action highlights
- **Charcoal** (#231F20) - Body text and icons
- **Cream** (#F5EADA) - Secondary backgrounds
- **White** (#FFFFFF) - Text on dark backgrounds

#### Typography
- **Headings:** Montserrat (500-700 weight)
- **Body Text:** Open Sans (400-600 weight)
- **Fallback Stack:** System fonts for optimal performance

#### Logo
Features the iconic Radio Calico logo: a calico cat wearing headphones on a mint green circular background, with a forest green border.

### User Interface Layout

The application uses a modern **horizontal two-column layout**:

#### Header (Full-width)
- Dark gray (#555) background spanning full viewport width
- Centered logo (50px circular) and "Radio Calico" title
- Clean, professional navigation bar appearance

#### Main Content (Two Columns)
**Left Column - Album Display:**
- Large 540×540px album artwork
- Dynamic year badge (top-right corner, diagonal red accent)
- Year extracted from song title metadata
- High-quality shadow effects

**Right Column - Track Information:**
- Large artist name (56px Montserrat Bold)
- Song title (42px Montserrat SemiBold)
- Album name (20px Open Sans)
- Source quality indicator (updates per track)
- Stream quality display (constant 48kHz FLAC/HLS)
- Rating interface with thumbs up/down emojis
- Compact player controls (dark gray bar)

#### Player Controls
- Minimalist dark gray bar (#4A4A4A)
- Play/Pause button
- Live time display (format: "0:35 / Live")
- Volume slider with speaker icon
- No bulky cards or excessive padding

#### Footer (Full-width)
- Mint green (#D8F2D5) background
- "Previous tracks:" heading (24px Montserrat SemiBold)
- Simple list format: **Artist:** *Song Title*
- Recently played tracks from metadata

### Responsive Design
- Desktop: Full horizontal two-column layout
- Tablet (< 1200px): Reduced album art size, adjusted typography
- Mobile (< 968px): Stacks vertically, centered album art
- Maintains brand colors and readability at all sizes

## Tech Stack

- **Runtime:** Node.js v22.16.0
- **Web Framework:** Express.js
- **Database:**
  - Development: SQLite with better-sqlite3
  - Production: PostgreSQL 16
- **Web Server (Production):** Nginx (reverse proxy + static file serving)
- **Audio Streaming:** HLS.js
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Testing:** Jest with Supertest (backend) and Testing Library (frontend)
- **Security:** helmet.js, express-rate-limit, express-validator
- **Security Testing:** Snyk, ESLint, Semgrep, Trivy, OWASP ZAP
- **Auto-reload:** Nodemon (development)

## Prerequisites

- Node.js 22+ installed
- npm or yarn package manager
- (Optional) Docker Desktop for containerized deployment

## Quick Start

### Local Development (without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   # Or using Make:
   make install
   ```

2. **Start the development server:**
   ```bash
   npm run dev              # Development mode with auto-reload
   # Or using Make:
   make dev
   ```

3. **Access the application:**
   - Open your browser to: http://localhost:3000
   - The server will automatically reload when you make changes (via nodemon)

4. **Run tests (optional):**
   ```bash
   npm test                 # Run all tests
   npm run test:coverage    # Run with coverage report
   # Or using Make:
   make test
   make test-coverage
   ```

5. **Run security scans (recommended):**
   ```bash
   npm run security         # Check for vulnerabilities
   # Or using Make:
   make security
   ```

**Tip:** Run `make` or `make help` to see all available commands.

### Docker Deployment

The application uses **different architectures for development and production**:

**Development:** Single container with SQLite database
**Production:** Three-container architecture with PostgreSQL database, Node.js API, and Nginx web server

**⚠️ IMPORTANT:** Before running any Docker commands, ensure **Docker Desktop is running**. Open Docker Desktop from your Start Menu and wait for the whale icon to appear steady in your system tray. Verify with `docker ps` command.

#### Development Mode (SQLite + Express)
Single container that serves both API and static files:

```bash
# Start development server
docker-compose up --build

# Or run in background
docker-compose up -d --build

# View logs
docker-compose logs -f
```

**Access:** http://localhost:3000

#### Production Mode (PostgreSQL + Nginx + API)
Three containers working together:
- **PostgreSQL:** Production database
- **API:** Express.js backend (API only)
- **Nginx:** Web server (static files + reverse proxy)

```bash
# 1. Configure environment variables (REQUIRED)
cp .env.example .env
# Edit .env and set a strong POSTGRES_PASSWORD

# 2. Start all services
docker-compose -f docker-compose.prod.yml up --build -d

# 3. Verify all services are healthy
docker ps  # Should show 3 containers: postgres, radio-calico-api, nginx

# 4. View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop the server
docker-compose -f docker-compose.prod.yml down
```

**Access:** http://localhost:80 (or custom port configured in `.env`)

**Why different architectures?**
- **Development:** SQLite is simple, requires no configuration, perfect for local development
- **Production:** PostgreSQL handles concurrent connections better, Nginx provides superior static file performance and security

**Docker Documentation:**
- **[DOCKER.md](DOCKER.md)** - Comprehensive deployment guide covering PostgreSQL management, nginx configuration, three-service architecture, backup strategies, and troubleshooting
- **RUNDOCKER.md** - Quick reference guide with copy-paste commands (personal file, gitignored)

## Project Structure

```
Radio/
├── server.js                      # Main Express server & API endpoints
├── db.js                          # Database abstraction layer (SQLite/PostgreSQL)
├── nginx.conf                     # Nginx configuration (production)
├── package.json                   # Node.js dependencies
├── Makefile                       # Development, testing, security, and Docker shortcuts
├── .env.example                   # Environment variables template
├── radio.db                       # SQLite database (dev, auto-created, gitignored)
├── public/
│   ├── index.html                # Radio player HTML structure
│   ├── app.js                    # Client-side JavaScript (player logic)
│   ├── styles.css                # RadioCalico brand stylesheet
│   └── RadioCalicoLogoTM.png     # Brand logo image
├── tests/                         # Testing framework
│   ├── backend/
│   │   ├── unit/                 # Backend unit tests
│   │   │   └── fingerprinting.test.js
│   │   ├── integration/          # Backend integration tests
│   │   │   └── ratings-api.test.js
│   │   └── helpers/              # Test utilities
│   │       ├── db-setup.js       # In-memory database setup
│   │       ├── mock-requests.js  # Request/response factories
│   │       └── setup.js          # Test configuration
│   └── frontend/
│       ├── unit/                 # Frontend unit tests
│       │   └── rating-display.test.js
│       └── helpers/              # Test utilities
│           ├── setup-dom.js      # DOM fixture helpers
│           ├── msw-handlers.js   # API mock handlers
│           └── setup.js          # Test configuration
├── jest.config.js                 # Jest test configuration
├── TESTING.md                     # Testing documentation
├── SECURITY.md                    # Security testing guide and best practices
├── SECURITY-AUDIT-REPORT.md       # Security audit findings and remediation
├── .eslintrc.json                 # ESLint configuration with security plugins
├── RadioCalico_Style_Guide.txt    # Official brand style guide
├── RadioCalicoLayout.png          # Reference layout mockup
├── RadioCalicoLogoTM.png          # Logo source file
├── Dockerfile                     # Legacy Docker config (redirects to dev)
├── Dockerfile.dev                 # Development Docker configuration
├── Dockerfile.prod                # Production Docker configuration
├── docker-compose.yml             # Development orchestration
├── docker-compose.prod.yml        # Production orchestration
├── .dockerignore                  # Docker build exclusions
├── stream_URL.txt                # HLS stream URL
├── DOCKER.md                      # Docker deployment guide (comprehensive)
├── RUNDOCKER.md                   # Docker quick reference (gitignored, personal)
├── CLAUDE.md                      # Development instructions
├── .gitignore                     # Git ignore rules
└── README.md                      # This file
```

### Version Control

**Files tracked in Git (committed to repository):**
- ✅ All Docker configuration files (`Dockerfile*`, `docker-compose*.yml`, `.dockerignore`)
- ✅ Source code (`server.js`, `db.js`, `public/*`, `tests/*`)
- ✅ Documentation (`README.md`, `CLAUDE.md`, `DOCKER.md`, `TESTING.md`, `SECURITY.md`, `SECURITY-AUDIT-REPORT.md`)
- ✅ Configuration (`package.json`, `jest.config.js`, `Makefile`, `.eslintrc.json`)
- ✅ Design assets (`RadioCalico_Style_Guide.txt`, `RadioCalicoLayout.png`)

**Files ignored by Git (in `.gitignore`):**
- 🚫 Runtime data (`*.db`, `*.db-shm`, `*.db-wal`, `logs/`)
- 🚫 Dependencies (`node_modules/`)
- 🚫 Secrets (`.env*`)
- 🚫 Test coverage reports (`coverage/`)
- 🚫 Security reports (`reports/`)
- 🚫 Database backups (`backups/`)
- 🚫 Security tool cache (`.snyk`)
- 🚫 Personal reference files (`RUNDOCKER.md`)
- 🚫 Docker runtime files (`docker-compose.override.yml`, `.docker/`)
- 🚫 OS-specific files (`.DS_Store`, `Thumbs.db`)

**Why Docker config files ARE in Git:**
- Enables team collaboration with consistent environments
- Required for CI/CD pipelines
- Documents how the project should be containerized
- Allows version control of infrastructure changes

## API Documentation

### Health Check
- `GET /api/health` - Server health check

### Listener Management
- `POST /api/listeners` - Register or update a listener session
  - Body: `{ session_id: string }`
- `GET /api/listeners/stats` - Get total listener statistics

### Listening Sessions
- `POST /api/sessions/start` - Start a new listening session
  - Body: `{ session_id: string }`
- `POST /api/sessions/end` - End a listening session
  - Body: `{ session_id: string, listening_session_id: number }`

### Song Ratings
- `POST /api/ratings` - Submit or update a song rating
  - Body: `{ song_id: string, session_id: string, rating: 1 | -1 }`
  - Returns: `{ thumbs_up: number, thumbs_down: number, user_rating: number }`
- `GET /api/ratings/:song_id` - Get ratings for a specific song
  - Query: `?session_id=string` (optional)
  - Returns: `{ song_id: string, thumbs_up: number, thumbs_down: number, user_rating: number | null }`

### Song Requests
- `POST /api/requests` - Submit a song request
  - Body: `{ listener_name: string, song_title: string, artist: string, message: string }`
- `GET /api/requests` - Get song requests (filtered by status)
  - Query: `?status=pending|approved|played|rejected` (default: pending)
- `PATCH /api/requests/:id` - Update request status
  - Body: `{ status: 'pending' | 'approved' | 'played' | 'rejected' }`

### Feedback
- `POST /api/feedback` - Submit user feedback
  - Body: `{ listener_name: string, email: string, message: string, rating: 1-5 }`
- `GET /api/feedback` - Get all feedback
- `GET /api/feedback/rating` - Get average feedback rating

## Database Schema

### listeners
- Tracks unique listeners by session ID
- Fields: id, session_id, first_connected, last_connected, total_listening_time

### listening_sessions
- Tracks individual listening sessions with duration
- Fields: id, listener_id, started_at, ended_at, duration

### song_ratings
- Stores user votes (thumbs up/down) with fingerprint-based deduplication
- Fields: id, song_id, session_id, ip_address, user_fingerprint, rating, created_at
- **Unique constraint:** One vote per user_fingerprint per song_id

### song_requests
- Stores user song requests
- Fields: id, listener_name, song_title, artist, message, status, created_at

### feedback
- Stores user feedback and ratings
- Fields: id, listener_name, email, message, rating, created_at

## Testing

The application includes a comprehensive Jest-based testing framework covering both backend and frontend functionality.

### Running Tests

```bash
npm test                 # Run all 40 tests (backend + frontend)
npm run test:backend     # Run backend tests only (23 tests)
npm run test:frontend    # Run frontend tests only (17 tests)
npm run test:watch       # Watch mode - auto-rerun on file changes
npm run test:coverage    # Generate coverage report
```

### Test Coverage

**Current Status:** ✅ 40 tests passing

**Backend Tests (23 tests):**
- User fingerprinting (IP extraction, SHA-256 hash generation)
- Rating API endpoints (POST/GET /api/ratings)
- Vote submission, changes, and deduplication
- Multi-user vote aggregation
- Database unique constraint enforcement

**Frontend Tests (17 tests):**
- Rating display updates (counts, active states)
- Rating submission (API calls, error handling)
- UI state management
- Network error resilience

### Test Architecture

- **Backend:** Node.js environment with in-memory SQLite databases
- **Frontend:** JSDOM environment with mocked fetch API
- **Isolation:** Each test uses a fresh database instance
- **Speed:** In-memory databases ensure fast test execution
- **Coverage:** 50% threshold for branches, functions, lines, statements

### Writing Tests

When adding new features, write tests following these patterns:

1. **Backend Unit Tests:** `tests/backend/unit/`
   - Test individual functions in isolation
   - Use helper utilities from `tests/backend/helpers/`

2. **Backend Integration Tests:** `tests/backend/integration/`
   - Test complete API endpoints with Supertest
   - Use in-memory database from `db-setup.js`

3. **Frontend Unit Tests:** `tests/frontend/unit/`
   - Test UI functions with jsdom
   - Mock fetch API for network requests

See `TESTING.md` for detailed documentation, examples, and helper API reference.

## Security

The application implements comprehensive security measures including rate limiting, input validation, security headers, and automated security testing.

### Security Features

**1. Rate Limiting**
- General API: 100 requests per 15 minutes
- Write operations: 30 requests per 15 minutes
- Ratings/voting: 10 votes per minute
- Protects against abuse and DoS attacks

**2. Input Validation**
- All user input validated with express-validator
- Character whitelisting and length limits
- XSS protection via HTML escaping
- SQL injection prevention via parameterized queries

**3. Security Headers**
- Content-Security-Policy (prevents XSS)
- X-Frame-Options (prevents clickjacking)
- Strict-Transport-Security (enforces HTTPS)
- X-Content-Type-Options (prevents MIME sniffing)
- Implemented via helmet.js

**4. CORS Protection**
- Restricted origins in production (via `ALLOWED_ORIGINS` env var)
- Limited to GET, POST, PATCH methods
- Prevents cross-origin attacks

**5. Request Size Limits**
- Body size limited to 10kb
- Prevents DoS via large payloads

### Security Testing

The project includes multiple security testing tools:

**Dependency Scanning:**
- **npm audit** - Built-in vulnerability scanner
- **Snyk** - Enhanced scanning with larger database

**Static Analysis:**
- **ESLint + security plugins** - Detects unsafe code patterns
- **Semgrep** - Pattern-based OWASP Top 10 scanner

**Container Security:**
- **Trivy** - Scans Docker images for vulnerabilities

**Dynamic Testing:**
- **OWASP ZAP** - Penetration testing for running application

### Running Security Scans

```bash
# Install security tools first (one-time)
make security-install

# Quick scan (before commits)
make security                # npm audit

# Comprehensive scan (before deployments)
make security-full           # All tools: npm audit, Snyk, ESLint, Semgrep, Trivy

# Individual scans
make security-deps           # Snyk dependency scan
make security-code           # ESLint + Semgrep static analysis
make security-docker         # Trivy container scan
make security-api            # OWASP ZAP (requires running server)

# Generate detailed reports
make security-report         # JSON + text reports in reports/

# Fix vulnerabilities
make security-fix            # Auto-fix dependencies
```

### Security Reports

All security reports are saved in the `reports/` directory:

- `security-audit.json/txt` - npm audit results
- `snyk-report.json/txt` - Dependency vulnerabilities
- `eslint-security.json/txt` - Code security issues
- `semgrep-report.json/txt` - Pattern-based findings
- `trivy-*.txt` - Container vulnerabilities (dev, api, nginx)
- `zap-report.json/html` - Penetration test results

### Security Documentation

- **`SECURITY.md`** - Comprehensive security testing guide
  - Tool installation and configuration
  - Detailed testing procedures
  - Security best practices
  - Vulnerability response process
  - GDPR/CCPA compliance considerations

- **`SECURITY-AUDIT-REPORT.md`** - Security audit findings
  - 2 Critical issues
  - 4 High severity issues
  - 6 Medium severity issues
  - Prioritized remediation roadmap
  - Production deployment checklist

### Security Best Practices

**Before Every Commit:**
```bash
make security          # Check for vulnerabilities
make test              # Ensure tests pass
```

**Before Every Deployment:**
```bash
make security-full     # Comprehensive security scan
make test-coverage     # Verify test coverage
npm outdated           # Check for updates
# Review all HIGH/CRITICAL findings
# Set ALLOWED_ORIGINS in .env
# Verify HTTPS is configured
```

**Production Requirements:**
- [ ] HTTPS/TLS configured in nginx
- [ ] `ALLOWED_ORIGINS` environment variable set
- [ ] Strong PostgreSQL password
- [ ] All CRITICAL/HIGH security issues resolved
- [ ] Security monitoring in place

## Configuration

### Stream URL
The HLS stream URL is configured in:
- **Frontend:** `public/app.js` (line 20, `streamUrl` constant)
- **Reference:** `stream_URL.txt`

Current stream: `https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`

### Metadata URL
Metadata is fetched from: `https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`

The metadata includes:
- **Track info:** title, artist, album
- **Audio quality:** bit_depth, sample_rate
- **Content flags:** is_explicit, is_new
- **Recently played:** prev_artist_1-5, prev_title_1-5

Metadata is automatically fetched every 5 seconds while the player is active and updates:
- Artist name, song title, album name
- Album artwork (with cache-busting)
- Source quality (bit depth and sample rate from original file)
- Year badge (extracted from title if present in format "Title (Year)")
- Recently played tracks in the footer

### Frontend Architecture
The frontend uses a clean separation of concerns:
- **`public/index.html`** - HTML structure and semantic markup only
- **`public/app.js`** - All client-side JavaScript (HLS player, metadata fetching, ratings, fingerprinting)
- **`public/styles.css`** - All Radio Calico brand styles with CSS variables
- **Google Fonts** - Montserrat and Open Sans loaded via CDN
- **Responsive breakpoints:** 1200px, 968px, 640px

### Server Port
Default port: 3000 (configurable via `PORT` environment variable)

## User Identification System

The application uses a **dual-layer fingerprinting system** to ensure users can only vote once per song without requiring login:

### Server-Side Fingerprinting
The server generates a SHA-256 hash from:
- Client IP address
- User-Agent header
- Accept-Language header
- Accept-Encoding header

### Client-Side Fingerprinting
The frontend (`public/app.js`) generates a fingerprint using:
- Canvas fingerprinting
- User-Agent string
- Screen resolution and color depth
- Timezone and offset
- Hardware concurrency
- Device memory
- Installed plugins
- Touch support detection

This combined approach ensures:
- ✅ One vote per user per song
- ✅ Votes persist across browser sessions
- ✅ No login required
- ✅ Privacy-friendly (hashed fingerprints)
- ✅ Resistant to cookie deletion

## Database Migrations

The application includes automatic database migrations that run on server startup:
- Adds missing columns to existing tables
- Removes conflicting unique constraints
- Preserves existing data during schema updates
- Creates necessary indexes for performance

To reset the database:
```bash
# Stop the server
# Delete the database file
rm radio.db
# Restart the server
npm start
```

## Development

### Making Changes

1. Edit files in the project directory
2. The server automatically reloads when you edit `server.js` (thanks to nodemon)
3. Database changes persist in `radio.db`
4. Frontend changes are immediately reflected (static file serving)
   - **HTML structure:** Edit `public/index.html`
   - **JavaScript logic:** Edit `public/app.js`
   - **Styling:** Edit `public/styles.css`
5. **Run tests after changes:**
   ```bash
   npm test                 # Verify nothing broke
   npm run test:watch       # Auto-rerun tests during development
   ```

### Test-Driven Development

For best results, follow this workflow:

1. **Write a failing test** for the new feature
2. **Implement the feature** until the test passes
3. **Refactor** while keeping tests green
4. **Check coverage** with `npm run test:coverage`

Example workflow:
```bash
# Start test watch mode in one terminal
npm run test:watch

# Edit code in your editor
# Tests automatically rerun on save

# When done, check coverage
npm run test:coverage
open coverage/lcov-report/index.html
```

### Customizing the Design

The Radio Calico design can be customized by editing:

**Brand Colors (`public/styles.css`):**
```css
:root {
    --mint: #D8F2D5;
    --forest-green: #1F4E23;
    --teal: #38A29D;
    --calico-orange: #EFA63C;
    /* ... modify these values ... */
}
```

**Typography:**
- Change font families in the CSS `@import` statement
- Update `--font-heading` and `--font-body` CSS variables

**Layout Dimensions:**
- Album art size: `.album-art-container` width/height
- Max content width: `--max-width` CSS variable (default 1400px)
- Responsive breakpoints: `@media` queries at bottom of CSS

**Logo:**
Replace `public/RadioCalicoLogoTM.png` with your own logo (recommended: 512×512px PNG with transparency)

### Adding Dependencies

```bash
npm install package-name
```

For Docker:
```bash
docker-compose down
docker-compose up --build
```

### Database Management

View/edit the SQLite database using:
- [DB Browser for SQLite](https://sqlitebrowser.org/)
- [SQLite CLI](https://sqlite.org/cli.html)
- VS Code extensions (SQLite Viewer)

### Logging

The server logs include:
- Vote submissions and changes
- Database migration status
- HLS streaming events
- API request/response status

Check console output for debugging.

## Deployment Considerations

### Production Checklist

**Security (Critical):**
- [ ] **Run comprehensive security scan:** `make security-full`
- [ ] **Review security audit:** Address all CRITICAL/HIGH findings in `SECURITY-AUDIT-REPORT.md`
- [ ] **Configure HTTPS/TLS:** Set up SSL certificates in nginx (Let's Encrypt recommended)
- [ ] **Set ALLOWED_ORIGINS:** Configure allowed domains in `.env`
- [ ] **Strong passwords:** Use strong PostgreSQL password in `.env`
- [ ] **Authentication:** Add authentication for admin endpoints (feedback, request management)
- [ ] **CSRF protection:** Implement CSRF tokens (especially important if adding auth)
- [ ] **Error handling:** Sanitize error messages (no stack traces in production)

**Testing:**
- [ ] **Run all tests:** `npm test` or `make test` (ensure all tests pass)
- [ ] **Check coverage:** `npm run test:coverage` or `make test-coverage` (verify thresholds met)
- [ ] **Load testing:** Test under expected traffic load

**Infrastructure:**
- [ ] Set `NODE_ENV=production`
- [ ] Use a reverse proxy (Nginx ✅ already configured)
- [ ] Set up database backups (automated)
- [ ] Configure monitoring and alerting
- [ ] Set up health check monitoring
- [ ] Consider using a CDN for static assets
- [ ] Set up log aggregation (e.g., ELK stack)

**Documentation:**
- [ ] Update environment variables in `.env`
- [ ] Document deployment procedure
- [ ] Create incident response plan

### Environment Variables

**Development (SQLite):**
```bash
NODE_ENV=development         # Environment mode
PORT=3000                    # Server port
DATABASE_TYPE=sqlite         # Database type
DB_PATH=radio.db             # SQLite database file path
```

**Production (PostgreSQL):**
```bash
NODE_ENV=production          # Environment mode
PORT=80                      # Nginx external port (API uses 3000 internally)
DATABASE_TYPE=postgres       # Database type
POSTGRES_HOST=postgres       # PostgreSQL hostname (container name)
POSTGRES_PORT=5432           # PostgreSQL port
POSTGRES_DB=radio            # Database name
POSTGRES_USER=radio          # Database user
POSTGRES_PASSWORD=your_secure_password  # Database password (REQUIRED)
```

**Using `.env` file (recommended for production):**
```bash
cp .env.example .env
# Edit .env and set your values
# IMPORTANT: Use a strong password for POSTGRES_PASSWORD
```

### Performance Optimization

- The database uses indexes on frequently queried columns
- HLS.js configured for low latency mode
- Metadata fetched every 5 seconds (not every second)
- Vote fingerprints are cached per request

## Troubleshooting

### Docker Desktop Not Running
**Error:** `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`

**Solution:**
1. Start Docker Desktop from Start Menu
2. Wait for whale icon in system tray to be steady (not spinning)
3. Verify: `docker ps` should work without errors
4. Then run your docker-compose command

### Port Already in Use
```bash
# Change port in package.json or use environment variable
PORT=3001 npm start
```

### Database Locked Error
- Close any database viewer applications
- Ensure only one server instance is running
- Check file permissions on `radio.db`

### HLS Stream Not Playing
- Check network console for CORS errors
- Verify stream URL is accessible: `curl https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`
- Try a different browser (Safari has native HLS support)

### Vote Counts Not Updating
- Check browser console for JavaScript errors
- Verify API is responding: `curl http://localhost:3000/api/health`
- Check server logs for database errors

### Metadata Not Updating
- Metadata refreshes every 5 seconds while playing
- Check browser console for fetch errors
- Verify metadata URL is accessible: `curl https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`
- Ensure CORS is properly configured
- Try clicking play/pause to restart metadata fetching

### Migration Errors on Startup
- Backup your database: `cp radio.db radio.db.backup`
- Delete and recreate: `rm radio.db && npm start`
- Check file permissions

### Test Failures
```bash
# Clear Jest cache
npx jest --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- tests/backend/unit/fingerprinting.test.js
```

### Coverage Threshold Errors
If tests pass but coverage thresholds fail, either:
- Add more tests to increase coverage
- Adjust thresholds in `jest.config.js` (lower the percentages)

## Browser Compatibility

- **Chrome/Edge:** Full support (HLS.js)
- **Firefox:** Full support (HLS.js)
- **Safari:** Native HLS support
- **Mobile browsers:** Fully responsive design with optimized layouts
  - Vertical stacking on screens < 968px
  - Touch-friendly controls and tap targets
  - Maintains brand aesthetics on all screen sizes

## Design Reference Files

The project includes several design reference files:

- **`RadioCalico_Style_Guide.txt`** - Complete brand style guide with:
  - Color palette with hex/RGB values
  - Typography specifications (fonts, sizes, weights)
  - UI component guidelines (buttons, forms, audio controls)
  - Layout and spacing rules
  - Voice and tone guidelines

- **`RadioCalicoLayout.png`** - Reference mockup showing:
  - Ideal two-column layout
  - Header and footer design
  - Album art positioning with year badge
  - Track information hierarchy
  - Player control bar appearance

- **`RadioCalicoLogoTM.png`** - High-resolution brand logo
  - Transparent PNG format
  - Features calico cat with headphones
  - Mint green circular background with forest green border

These files serve as the design foundation for the application and should be consulted when making visual changes.

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

## Credits

- Built with Express.js and HLS.js
- Uses better-sqlite3 for database management
- Tested with Jest, Supertest, and Testing Library
- Fingerprinting techniques for privacy-preserving user tracking

## Support

For issues or questions:
- Check the console logs
- Review API documentation above
- Check browser developer console
- Verify stream URL is accessible
