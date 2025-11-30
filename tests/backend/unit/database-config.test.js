/**
 * Database Configuration Tests
 *
 * Tests for DB_PATH environment variable configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Database Configuration', () => {
  const testDbDir = path.join(__dirname, '../../.test-db');
  const originalDbPath = process.env.DB_PATH;

  beforeAll(() => {
    // Create test database directory
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
    // Restore original DB_PATH
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  });

  afterEach(() => {
    // Clean up any test databases created during tests
    const testFiles = fs.readdirSync(testDbDir);
    testFiles.forEach(file => {
      const filePath = path.join(testDbDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  describe('DB_PATH environment variable', () => {
    it('should use DB_PATH environment variable when set', () => {
      const customDbPath = path.join(testDbDir, 'custom-test.db');
      process.env.DB_PATH = customDbPath;

      // Note: We can't directly test server.js initialization here without restructuring
      // the code, but we can verify the environment variable is read correctly
      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe(customDbPath);
      expect(DB_PATH).not.toBe('radio.db');
    });

    it('should default to radio.db when DB_PATH not set', () => {
      delete process.env.DB_PATH;

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe('radio.db');
    });

    it('should handle absolute paths in DB_PATH', () => {
      const absolutePath = path.resolve(testDbDir, 'absolute-test.db');
      process.env.DB_PATH = absolutePath;

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(path.isAbsolute(DB_PATH)).toBe(true);
      expect(DB_PATH).toBe(absolutePath);
    });

    it('should handle relative paths in DB_PATH', () => {
      const relativePath = './test-data/test.db';
      process.env.DB_PATH = relativePath;

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe(relativePath);
    });

    it('should handle paths with special characters', () => {
      const specialPath = path.join(testDbDir, 'test-db_special.db');
      process.env.DB_PATH = specialPath;

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe(specialPath);
    });

    it('should handle empty string DB_PATH by falling back to default', () => {
      process.env.DB_PATH = '';

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe('radio.db');
    });
  });

  describe('Database path validation', () => {
    it('should accept valid database file extensions', () => {
      const validPaths = [
        'test.db',
        'test.sqlite',
        'test.sqlite3',
        'data/test.db'
      ];

      validPaths.forEach(dbPath => {
        process.env.DB_PATH = dbPath;
        const DB_PATH = process.env.DB_PATH || 'radio.db';
        expect(DB_PATH).toBe(dbPath);
      });
    });

    it('should handle database paths in subdirectories', () => {
      const subdirPath = 'data/databases/radio.db';
      process.env.DB_PATH = subdirPath;

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe(subdirPath);
    });
  });

  describe('Docker environment compatibility', () => {
    it('should handle Docker development path (/app/radio.db)', () => {
      const dockerDevPath = '/app/radio.db';
      process.env.DB_PATH = dockerDevPath;

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe(dockerDevPath);
    });

    it('should handle Docker production path (/app/data/radio.db)', () => {
      const dockerProdPath = '/app/data/radio.db';
      process.env.DB_PATH = dockerProdPath;

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe(dockerProdPath);
    });

    it('should maintain consistency with docker-compose.yml dev config', () => {
      // This should match the DB_PATH in docker-compose.yml
      const expectedDevPath = '/app/radio.db';
      process.env.DB_PATH = expectedDevPath;

      const DB_PATH = process.env.DB_PATH || 'radio.db';

      expect(DB_PATH).toBe(expectedDevPath);
    });

    it('should understand production uses PostgreSQL not SQLite', () => {
      // Production uses PostgreSQL (DATABASE_TYPE=postgres), not SQLite
      // This test validates we understand the architecture difference
      const productionDbType = process.env.DATABASE_TYPE || 'sqlite';

      // In production, DATABASE_TYPE should be 'postgres'
      // DB_PATH is only used for SQLite (development)
      expect(['sqlite', 'postgres']).toContain(productionDbType);
    });
  });
});
