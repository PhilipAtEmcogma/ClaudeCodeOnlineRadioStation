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
```bash
docker-compose up --build    # Start with Docker
docker-compose down          # Stop Docker containers
```

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

## Testing Framework

The application has a comprehensive Jest-based testing framework covering both backend and frontend ratings functionality.

### Test Structure

```
tests/
├── backend/
│   ├── unit/
│   │   └── fingerprinting.test.js    # getUserFingerprint(), getClientIP() tests
│   ├── integration/
│   │   └── ratings-api.test.js       # POST/GET /api/ratings endpoint tests
│   └── helpers/
│       ├── setup.js                  # Backend test configuration
│       ├── db-setup.js               # In-memory SQLite utilities
│       └── mock-requests.js          # Mock Express request/response factories
└── frontend/
    ├── unit/
    │   └── rating-display.test.js    # updateRatingDisplay(), submitRating() tests
    └── helpers/
        ├── setup.js                  # Frontend test configuration
        ├── setup-dom.js              # DOM fixture utilities
        └── msw-handlers.js           # API mock handlers
```

### Test Configuration

- **Backend tests**: Run in Node.js environment with in-memory SQLite database
- **Frontend tests**: Run in jsdom environment with mocked fetch API
- **Coverage**: Configured with 50% thresholds for branches, functions, lines, statements
- **Current status**: 40 tests passing (23 backend, 17 frontend)

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

**Backend (server.js:149-503):**
- User fingerprinting logic (IP extraction, hash generation)
- Rating submission (new votes, duplicate votes, vote changes)
- Rating retrieval (counts, user vote status)
- Multi-user vote aggregation
- Unique constraint enforcement

**Frontend (public/app.js:231-307):**
- Rating display updates (counts, active button states)
- Rating submission (fetch calls, error handling)
- UI state management (enabling/disabling buttons)
- Network error resilience

## Known Issues and Quirks

- **Database locking:** Only one connection at a time. If using DB viewer tools, close them before running server.
- **Session management:** Uses fingerprint-based session IDs stored in localStorage, not server-side sessions.
- **Client-side fingerprinting:** `app.js` includes canvas fingerprinting code that generates browser-unique IDs, sent with API requests along with server-side fingerprint for redundancy.
- **Metadata polling:** Happens every 5 seconds, not every second, to reduce server load.

## Manual Testing & Verification

### Automated Tests
```bash
npm test                 # Run all 40 unit and integration tests
npm run test:coverage    # Generate coverage report (see coverage/lcov-report/index.html)
```

### Manual API Testing
- **Health check:** `curl http://localhost:3000/api/health`
- **Stream accessibility:** `curl https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`
- **Metadata accessibility:** `curl https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json`
- **Test rating endpoint:** POST to `/api/ratings` with JSON body

### Database Inspection
- **View database:** Use DB Browser for SQLite or `sqlite3 radio.db` CLI
- **Test database:** In-memory databases are created automatically for tests (no cleanup needed)

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

### Configuration & Documentation
- `package.json` - Dependencies and npm scripts (including test commands)
- `CLAUDE.md` - This file (project memory for Claude Code)
- `README.md` - User-facing documentation
- `.gitignore` - Git ignore rules (node_modules, *.db, .env, coverage, etc.)
- `.dockerignore` - Docker ignore rules (excludes tests from Docker images)

### Design Reference
- `RadioCalico_Style_Guide.txt` - Official brand guidelines
- `RadioCalicoLayout.png` - Reference design mockup
- `stream_URL.txt` - HLS stream URL reference

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
