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

  // Coverage thresholds (optional - can be adjusted)
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

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
