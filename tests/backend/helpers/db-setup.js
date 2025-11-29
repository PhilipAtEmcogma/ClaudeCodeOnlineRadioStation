const Database = require('better-sqlite3');

/**
 * Creates an isolated in-memory SQLite database for testing
 * @returns {Database} Configured test database instance
 */
function setupTestDatabase() {
  // Use in-memory database for fast, isolated tests
  const db = new Database(':memory:');

  // Create song_ratings table with current schema
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

  // Create indexes as in production
  db.exec('CREATE INDEX idx_song_ip ON song_ratings(song_id, ip_address)');
  db.exec('CREATE UNIQUE INDEX idx_song_fingerprint ON song_ratings(song_id, user_fingerprint)');

  // Create other tables if needed for integration tests
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
  `);

  return db;
}

/**
 * Cleans up and closes test database
 * @param {Database} db - Database instance to close
 */
function teardownTestDatabase(db) {
  if (db && db.open) {
    db.close();
  }
}

/**
 * Seeds test data into the database
 * @param {Database} db - Database instance
 * @param {Array} ratings - Array of rating objects to insert
 */
function seedRatings(db, ratings) {
  const stmt = db.prepare(`
    INSERT INTO song_ratings (song_id, session_id, ip_address, user_fingerprint, rating)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const rating of ratings) {
    stmt.run(
      rating.song_id,
      rating.session_id || 'test-session',
      rating.ip_address || '127.0.0.1',
      rating.user_fingerprint,
      rating.rating
    );
  }
}

/**
 * Clears all data from song_ratings table
 * @param {Database} db - Database instance
 */
function clearRatings(db) {
  db.prepare('DELETE FROM song_ratings').run();
}

module.exports = {
  setupTestDatabase,
  teardownTestDatabase,
  seedRatings,
  clearRatings
};
