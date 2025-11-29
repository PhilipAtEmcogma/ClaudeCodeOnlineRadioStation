# Testing Guide for Radio Calico

This document describes the testing framework for the Radio Calico ratings system.

## Overview

The testing framework uses **Jest** with separate configurations for backend and frontend tests:
- **Backend**: Node.js environment with Supertest for API testing
- **Frontend**: JSDOM environment with Testing Library for DOM testing
- **Coverage**: Configured to collect coverage from `server.js` and `public/app.js`

## Running Tests

### All Tests
```bash
npm test
```

### Backend Tests Only
```bash
npm run test:backend
```

### Frontend Tests Only
```bash
npm run test:frontend
```

### Watch Mode (auto-rerun on file changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```
Opens a detailed HTML coverage report in `coverage/lcov-report/index.html`

## Test Structure

```
tests/
├── backend/
│   ├── unit/
│   │   └── fingerprinting.test.js       # Tests getUserFingerprint(), getClientIP()
│   ├── integration/
│   │   ├── ratings-api.test.js          # Tests POST/GET /api/ratings endpoints
│   │   └── ratings-security.test.js     # Security and edge case tests
│   └── helpers/
│       ├── setup.js                     # Backend test setup (runs before each test)
│       ├── db-setup.js                  # In-memory database utilities
│       └── mock-requests.js             # Request object factories
└── frontend/
    ├── unit/
    │   └── rating-display.test.js       # Tests rating UI functions
    └── helpers/
        ├── setup.js                     # Frontend test setup (runs before each test)
        └── setup-dom.js                 # DOM fixture utilities
```

## Test Results

### Current Status: ✅ All Tests Passing

**Backend Tests**
- `fingerprinting.test.js`: 12 tests
  - IP extraction from various header sources
  - Fingerprint generation and consistency
  - Handling of missing headers

- `ratings-api.test.js`: 11 tests
  - POST /api/ratings endpoint validation
  - Vote submission and idempotency
  - Vote changes and multiple users
  - GET /api/ratings/:song_id retrieval

- `ratings-security.test.js`: 17 tests
  - SQL injection protection (prepared statements)
  - Input validation (empty strings, null values, type checking)
  - Edge cases (very long strings, unicode, special characters)
  - Malformed input handling

**Frontend Tests**
- `rating-display.test.js`: 17 tests
  - updateRatingDisplay() DOM updates
  - Active button state management
  - submitRating() API calls
  - Error handling

## Writing New Tests

### Backend Unit Test Example
```javascript
const { createMockRequest } = require('../helpers/mock-requests');

test('should extract IP from x-forwarded-for header', () => {
  const req = createMockRequest({ ip: '203.0.113.1' });
  const ip = getClientIP(req);
  expect(ip).toBe('203.0.113.1');
});
```

### Backend Integration Test Example
```javascript
const request = require('supertest');
const { setupTestDatabase, teardownTestDatabase } = require('../helpers/db-setup');

let db, app;

beforeEach(() => {
  db = setupTestDatabase();
  app = createTestApp(db);
});

afterEach(() => {
  teardownTestDatabase(db);
});

test('should accept valid thumbs up rating', async () => {
  const response = await request(app)
    .post('/api/ratings')
    .send({
      song_id: 'test-song-1',
      session_id: 'session-123',
      rating: 1
    })
    .expect(200);

  expect(response.body.thumbs_up).toBe(1);
});
```

### Frontend Test Example
```javascript
const { setupRatingsDOM, getRatingElements } = require('../helpers/setup-dom');

beforeEach(() => {
  setupRatingsDOM();
  const elements = getRatingElements();
  // ... assign elements
});

test('should update thumbs up count in DOM', () => {
  updateRatingDisplay({ thumbs_up: 42, thumbs_down: 5, user_rating: null });
  expect(thumbsUpCount.textContent).toBe('42');
});
```

## Helper Utilities

### Backend Helpers

**db-setup.js**
- `setupTestDatabase()` - Creates in-memory SQLite database
- `teardownTestDatabase(db)` - Closes database connection
- `seedRatings(db, ratings)` - Seeds test rating data
- `clearRatings(db)` - Clears all ratings

**mock-requests.js**
- `createMockRequest(options)` - Creates Express request object
- `createMockResponse()` - Creates Express response object with spies
- `createMultipleUsers(count)` - Creates multiple users with unique fingerprints
- `createSameFingerprintRequest(req, overrides)` - Duplicates user fingerprint

### Frontend Helpers

**setup-dom.js**
- `setupRatingsDOM()` - Creates rating UI elements
- `setupFullPlayerDOM()` - Creates complete player UI
- `getRatingElements()` - Returns references to rating DOM elements
- `cleanupDOM()` - Removes all DOM elements
- `setupLocalStorage()` - Mocks localStorage
- `setupMockFetch()` - Creates fetch mock

**msw-handlers.js** (for future use)
- API mock handlers for integration tests
- `resetMockRatings()` - Resets mock data store
- `setMockRating(songId, data)` - Sets mock rating data

## Test Coverage Goals

Current thresholds (can be adjusted in `jest.config.js`):
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

To view detailed coverage:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Important Notes

### Backend Testing

1. **Fingerprinting Functions**: Currently duplicated in test files. For production, consider:
   - Exporting functions from `server.js`: Add `module.exports = { app, db, getUserFingerprint, getClientIP };`
   - Creating separate module: `src/utils/fingerprinting.js`

2. **Database Tests**: All tests use in-memory SQLite (`:memory:`) for speed and isolation

3. **API Integration Tests**: Currently use a mock Express app. To test the real `server.js`:
   - Export `app` from `server.js`
   - Import in tests: `const { app } = require('../../../server');`

### Frontend Testing

1. **Function Extraction**: Rating functions are duplicated in tests. Consider:
   - Refactoring `public/app.js` to export testable functions
   - Using a build step (webpack/rollup) to support ES modules

2. **Fetch Mocking**: Tests use Jest's mock fetch. For integration tests, consider MSW (Mock Service Worker)

3. **DOM Testing**: Uses jsdom for browser environment simulation

## Continuous Integration

To add GitHub Actions CI:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Troubleshooting

### Tests Won't Run
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Clear Jest cache
npx jest --clearCache
```

### Coverage Threshold Errors
Adjust thresholds in `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 40,  // Lower if needed
    functions: 40,
    lines: 40,
    statements: 40
  }
}
```

### JSDOM Errors
Ensure `jest-environment-jsdom` is installed:
```bash
npm install --save-dev jest-environment-jsdom
```

## Next Steps

1. **Expand Coverage**: Add tests for other endpoints (listeners, sessions, feedback)
2. **Refactor for Testability**: Export functions from `server.js` and `app.js`
3. **Add E2E Tests**: Consider Playwright or Cypress for full browser testing
4. **Performance Tests**: Add load testing for concurrent vote submissions
5. **Visual Regression**: Add screenshot testing for UI components

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Library](https://testing-library.com/)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
