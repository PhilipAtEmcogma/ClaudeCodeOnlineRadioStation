/**
 * Database Abstraction Layer
 * Supports both SQLite (development) and PostgreSQL (production)
 */

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';

let db;
let dbType;

/**
 * Initialize database connection based on environment
 */
async function initializeDatabase() {
  if (DATABASE_TYPE === 'postgres') {
    const { Pool } = require('pg');

    db = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'radio',
      user: process.env.POSTGRES_USER || 'radio',
      password: process.env.POSTGRES_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    dbType = 'postgres';
    console.log('📊 Using PostgreSQL database');

    await createPostgresSchema();
    await migratePostgresSchema();
  } else {
    const Database = require('better-sqlite3');
    const DB_PATH = process.env.DB_PATH || 'radio.db';

    db = new Database(DB_PATH);
    dbType = 'sqlite';
    console.log(`📊 Using SQLite database: ${DB_PATH}`);

    createSqliteSchema();
    migrateSqliteSchema();
  }

  return db;
}

/**
 * Create tables for SQLite
 */
function createSqliteSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listeners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      first_connected DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_connected DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_listening_time INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS listening_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listener_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration INTEGER,
      FOREIGN KEY (listener_id) REFERENCES listeners(id)
    );

    CREATE TABLE IF NOT EXISTS song_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listener_name TEXT,
      song_title TEXT NOT NULL,
      artist TEXT,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listener_name TEXT,
      email TEXT,
      message TEXT NOT NULL,
      rating INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS song_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL,
      session_id TEXT,
      ip_address TEXT,
      user_fingerprint TEXT,
      rating INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Create tables for PostgreSQL
 */
async function createPostgresSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS listeners (
      id SERIAL PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      first_connected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_connected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_listening_time INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS listening_sessions (
      id SERIAL PRIMARY KEY,
      listener_id INTEGER NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP,
      duration INTEGER,
      FOREIGN KEY (listener_id) REFERENCES listeners(id)
    );

    CREATE TABLE IF NOT EXISTS song_requests (
      id SERIAL PRIMARY KEY,
      listener_name TEXT,
      song_title TEXT NOT NULL,
      artist TEXT,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      listener_name TEXT,
      email TEXT,
      message TEXT NOT NULL,
      rating INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS song_ratings (
      id SERIAL PRIMARY KEY,
      song_id TEXT NOT NULL,
      session_id TEXT,
      ip_address TEXT,
      user_fingerprint TEXT,
      rating INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Migrate SQLite schema
 */
function migrateSqliteSchema() {
  try {
    const columns = db.prepare("PRAGMA table_info(song_ratings)").all();
    const columnNames = columns.map(col => col.name);

    const indexes = db.prepare("PRAGMA index_list(song_ratings)").all();
    const hasOldUniqueConstraint = indexes.some(idx => idx.origin === 'u' && idx.name.includes('song_id'));

    if (hasOldUniqueConstraint || !columnNames.includes('user_fingerprint')) {
      console.log('📦 Migrating song_ratings table to new schema...');

      db.exec(`CREATE TABLE IF NOT EXISTS song_ratings_backup AS SELECT * FROM song_ratings;`);
      db.exec('DROP TABLE IF EXISTS song_ratings;');
      db.exec(`
        CREATE TABLE song_ratings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          song_id TEXT NOT NULL,
          session_id TEXT,
          ip_address TEXT,
          user_fingerprint TEXT,
          rating INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const backupColumns = db.prepare("PRAGMA table_info(song_ratings_backup)").all().map(col => col.name);

      if (backupColumns.includes('user_fingerprint')) {
        db.exec(`
          INSERT INTO song_ratings (song_id, session_id, ip_address, user_fingerprint, rating, created_at)
          SELECT song_id, session_id, ip_address, user_fingerprint, rating, created_at
          FROM song_ratings_backup
          WHERE id IN (
            SELECT MAX(id) FROM song_ratings_backup GROUP BY song_id, user_fingerprint
          );
        `);
      } else {
        const columnsToMigrate = backupColumns.filter(col =>
          ['song_id', 'session_id', 'ip_address', 'rating', 'created_at'].includes(col)
        );
        db.exec(`
          INSERT INTO song_ratings (${columnsToMigrate.join(', ')})
          SELECT ${columnsToMigrate.join(', ')} FROM song_ratings_backup;
        `);
      }

      db.exec('DROP TABLE song_ratings_backup;');
      console.log('✅ Table migration complete');
    } else {
      if (!columnNames.includes('ip_address')) {
        console.log('📦 Adding ip_address column...');
        db.exec('ALTER TABLE song_ratings ADD COLUMN ip_address TEXT');
      }

      if (!columnNames.includes('user_fingerprint')) {
        console.log('📦 Adding user_fingerprint column...');
        db.exec('ALTER TABLE song_ratings ADD COLUMN user_fingerprint TEXT');
      }
    }

    db.exec('CREATE INDEX IF NOT EXISTS idx_song_ip ON song_ratings(song_id, ip_address)');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_song_fingerprint ON song_ratings(song_id, user_fingerprint)');

    console.log('✅ Database schema up to date');
  } catch (migrationError) {
    console.error('⚠️ Database migration error:', migrationError.message);
  }
}

/**
 * Migrate PostgreSQL schema
 */
async function migratePostgresSchema() {
  try {
    // Check if indexes exist
    const indexCheck = await db.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'song_ratings' AND indexname = 'idx_song_fingerprint'
    `);

    if (indexCheck.rows.length === 0) {
      console.log('📦 Creating indexes for PostgreSQL...');
      await db.query('CREATE INDEX IF NOT EXISTS idx_song_ip ON song_ratings(song_id, ip_address)');
      await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_song_fingerprint ON song_ratings(song_id, user_fingerprint) WHERE user_fingerprint IS NOT NULL');
      console.log('✅ PostgreSQL indexes created');
    }

    console.log('✅ PostgreSQL schema up to date');
  } catch (migrationError) {
    console.error('⚠️ PostgreSQL migration error:', migrationError.message);
  }
}

/**
 * Unified query interface
 */
async function query(sql, params = []) {
  if (dbType === 'postgres') {
    // PostgreSQL uses $1, $2, etc. for parameters
    const pgSql = sql.replace(/\?/g, (_, index) => {
      const count = sql.substring(0, _).split('?').length;
      return `$${count}`;
    });
    const result = await db.query(pgSql, params);
    return result.rows;
  } else {
    // SQLite synchronous query
    const stmt = db.prepare(sql);
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params);
      } else {
        const info = stmt.run(...params);
        return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
      }
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Get a single row
 */
async function get(sql, params = []) {
  if (dbType === 'postgres') {
    const pgSql = sql.replace(/\?/g, (_, index) => {
      const count = sql.substring(0, _).split('?').length;
      return `$${count}`;
    });
    const result = await db.query(pgSql, params);
    return result.rows[0] || null;
  } else {
    const stmt = db.prepare(sql);
    return stmt.get(...params) || null;
  }
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 */
async function run(sql, params = []) {
  if (dbType === 'postgres') {
    const pgSql = sql.replace(/\?/g, (_, index) => {
      const count = sql.substring(0, _).split('?').length;
      return `$${count}`;
    });

    // For INSERT, add RETURNING id to get the inserted ID
    let finalSql = pgSql;
    if (sql.trim().toUpperCase().startsWith('INSERT')) {
      finalSql = pgSql.replace(/;?\s*$/, ' RETURNING id');
    }

    const result = await db.query(finalSql, params);

    return {
      lastInsertRowid: result.rows[0]?.id || null,
      changes: result.rowCount || 0
    };
  } else {
    const stmt = db.prepare(sql);
    const info = stmt.run(...params);
    return {
      lastInsertRowid: info.lastInsertRowid,
      changes: info.changes
    };
  }
}

/**
 * Get all rows
 */
async function all(sql, params = []) {
  if (dbType === 'postgres') {
    const pgSql = sql.replace(/\?/g, (_, index) => {
      const count = sql.substring(0, _).split('?').length;
      return `$${count}`;
    });
    const result = await db.query(pgSql, params);
    return result.rows;
  } else {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }
}

/**
 * Close database connection
 */
async function close() {
  if (dbType === 'postgres') {
    await db.end();
  } else {
    db.close();
  }
}

module.exports = {
  initializeDatabase,
  query,
  get,
  run,
  all,
  close,
  getDb: () => db,
  getDbType: () => dbType
};
