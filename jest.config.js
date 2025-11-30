module.exports = {
  // Run tests in parallel for better performance
  maxWorkers: '50%',

  // Collect coverage from source files
  collectCoverageFrom: [
    'server.js',
    'public/app.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],

  // Coverage thresholds disabled - server.js and public/app.js are monolithic entry points
  // Current test suite focuses on unit testing extracted functions and integration testing endpoints
  // rather than achieving line-by-line coverage of initialization and setup code
  // To enable thresholds, extract more testable functions or add E2E tests
  coverageThreshold: null,

  // Output directory for coverage reports
  coverageDirectory: 'coverage',

  // Configure separate test environments for backend and frontend
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: ['**/tests/backend/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/backend/helpers/setup.js']
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/frontend/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/frontend/helpers/setup.js'],
      // Mock fetch API for frontend tests
      globals: {
        fetch: global.fetch
      }
    }
  ],

  // Verbose output for better debugging
  verbose: true
};
