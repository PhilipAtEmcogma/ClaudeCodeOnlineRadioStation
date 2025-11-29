// Backend test setup - runs before each test file

// Suppress console output during tests (optional - comment out if debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
// };

// Set longer timeout for database operations
jest.setTimeout(10000);
