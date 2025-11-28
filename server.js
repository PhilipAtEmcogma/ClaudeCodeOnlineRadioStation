const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const db = new Database('radio.db');

// Create tables for radio application
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
    rating INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Database migration: Add new columns and fix constraints
try {
  // Check if we need to migrate the table structure
  const columns = db.prepare("PRAGMA table_info(song_ratings)").all();
  const columnNames = columns.map(col => col.name);

  // Check for old unique constraint by examining indexes
  const indexes = db.prepare("PRAGMA index_list(song_ratings)").all();
  const hasOldUniqueConstraint = indexes.some(idx => idx.origin === 'u' && idx.name.includes('song_id'));

  if (hasOldUniqueConstraint || !columnNames.includes('user_fingerprint')) {
    console.log('📦 Migrating song_ratings table to new schema...');

    // Backup existing data
    db.exec(`
      CREATE TABLE IF NOT EXISTS song_ratings_backup AS SELECT * FROM song_ratings;
    `);

    // Drop old table
    db.exec('DROP TABLE IF EXISTS song_ratings;');

    // Create new table with correct schema
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

    // Migrate data back (deduplicate by fingerprint if it exists)
    const backupColumns = db.prepare("PRAGMA table_info(song_ratings_backup)").all().map(col => col.name);

    if (backupColumns.includes('user_fingerprint')) {
      // Keep only the most recent vote per fingerprint+song
      db.exec(`
        INSERT INTO song_ratings (song_id, session_id, ip_address, user_fingerprint, rating, created_at)
        SELECT song_id, session_id, ip_address, user_fingerprint, rating, created_at
        FROM song_ratings_backup
        WHERE id IN (
          SELECT MAX(id) FROM song_ratings_backup GROUP BY song_id, user_fingerprint
        );
      `);
    } else {
      // Old data without fingerprint - migrate as is
      const columnsToMigrate = backupColumns.filter(col => ['song_id', 'session_id', 'ip_address', 'rating', 'created_at'].includes(col));
      db.exec(`
        INSERT INTO song_ratings (${columnsToMigrate.join(', ')})
        SELECT ${columnsToMigrate.join(', ')} FROM song_ratings_backup;
      `);
    }

    // Drop backup table
    db.exec('DROP TABLE song_ratings_backup;');

    console.log('✅ Table migration complete');
  } else {
    // Just add missing columns if needed
    if (!columnNames.includes('ip_address')) {
      console.log('📦 Adding ip_address column...');
      db.exec('ALTER TABLE song_ratings ADD COLUMN ip_address TEXT');
    }

    if (!columnNames.includes('user_fingerprint')) {
      console.log('📦 Adding user_fingerprint column...');
      db.exec('ALTER TABLE song_ratings ADD COLUMN user_fingerprint TEXT');
    }
  }

  // Create indexes after ensuring columns exist
  db.exec('CREATE INDEX IF NOT EXISTS idx_song_ip ON song_ratings(song_id, ip_address)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_song_fingerprint ON song_ratings(song_id, user_fingerprint)');

  console.log('✅ Database schema up to date');
} catch (migrationError) {
  console.error('⚠️ Database migration error:', migrationError.message);
  console.error('Stack:', migrationError.stack);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Helper function to get client IP address
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.connection.socket?.remoteAddress ||
         'unknown';
}

// Helper function to generate a consistent user fingerprint
// This creates a unique identifier based on IP, User-Agent, and other headers
// without requiring login or client-side storage
function getUserFingerprint(req) {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';

  // Combine multiple factors to create a unique fingerprint
  const fingerprintString = `${ip}|${userAgent}|${acceptLanguage}|${acceptEncoding}`;

  // Create a hash of the fingerprint for privacy and consistency
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

// ============= LISTENERS API =============

// Register new listener or update existing
app.post('/api/listeners', (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const existing = db.prepare('SELECT * FROM listeners WHERE session_id = ?').get(session_id);

    if (existing) {
      // Update last connected time
      db.prepare('UPDATE listeners SET last_connected = CURRENT_TIMESTAMP WHERE session_id = ?')
        .run(session_id);
      res.json({ message: 'Listener updated', listener: existing });
    } else {
      // Create new listener
      const stmt = db.prepare('INSERT INTO listeners (session_id) VALUES (?)');
      const result = stmt.run(session_id);
      res.json({ message: 'Listener registered', id: result.lastInsertRowid });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get listener stats
app.get('/api/listeners/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_listeners,
        SUM(total_listening_time) as total_minutes
      FROM listeners
    `).get();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= LISTENING SESSIONS API =============

// Start listening session
app.post('/api/sessions/start', (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const listener = db.prepare('SELECT id FROM listeners WHERE session_id = ?').get(session_id);

    if (!listener) {
      return res.status(404).json({ error: 'Listener not found. Register first.' });
    }

    const stmt = db.prepare('INSERT INTO listening_sessions (listener_id) VALUES (?)');
    const result = stmt.run(listener.id);

    res.json({ message: 'Session started', session_id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End listening session
app.post('/api/sessions/end', (req, res) => {
  try {
    const { session_id, listening_session_id } = req.body;

    if (!session_id || !listening_session_id) {
      return res.status(400).json({ error: 'session_id and listening_session_id are required' });
    }

    const session = db.prepare('SELECT * FROM listening_sessions WHERE id = ?').get(listening_session_id);

    if (!session) {
      return res.status(404).json({ error: 'Listening session not found' });
    }

    const startedAt = new Date(session.started_at);
    const endedAt = new Date();
    const duration = Math.floor((endedAt - startedAt) / 1000 / 60); // in minutes

    // Update session
    db.prepare(`
      UPDATE listening_sessions
      SET ended_at = CURRENT_TIMESTAMP, duration = ?
      WHERE id = ?
    `).run(duration, listening_session_id);

    // Update listener total time
    db.prepare(`
      UPDATE listeners
      SET total_listening_time = total_listening_time + ?
      WHERE session_id = ?
    `).run(duration, session_id);

    res.json({ message: 'Session ended', duration_minutes: duration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= SONG REQUESTS API =============

// Submit song request
app.post('/api/requests', (req, res) => {
  try {
    const { listener_name, song_title, artist, message } = req.body;

    if (!song_title) {
      return res.status(400).json({ error: 'song_title is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO song_requests (listener_name, song_title, artist, message)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(listener_name || 'Anonymous', song_title, artist, message);

    res.json({
      message: 'Request submitted',
      id: result.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all song requests
app.get('/api/requests', (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const requests = db.prepare('SELECT * FROM song_requests WHERE status = ? ORDER BY created_at DESC')
      .all(status);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update request status
app.patch('/api/requests/:id', (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'approved', 'played', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const stmt = db.prepare('UPDATE song_requests SET status = ? WHERE id = ?');
    const result = stmt.run(status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Request updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= FEEDBACK API =============

// Submit feedback
app.post('/api/feedback', (req, res) => {
  try {
    const { listener_name, email, message, rating } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const stmt = db.prepare(`
      INSERT INTO feedback (listener_name, email, message, rating)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(listener_name, email, message, rating);

    res.json({
      message: 'Feedback submitted',
      id: result.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all feedback
app.get('/api/feedback', (req, res) => {
  try {
    const feedback = db.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all();
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get average rating
app.get('/api/feedback/rating', (req, res) => {
  try {
    const result = db.prepare(`
      SELECT
        AVG(rating) as average_rating,
        COUNT(*) as total_ratings
      FROM feedback
      WHERE rating IS NOT NULL
    `).get();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= SONG RATINGS API =============

// Submit song rating
app.post('/api/ratings', (req, res) => {
  try {
    const { song_id, session_id, rating } = req.body;
    const ip_address = getClientIP(req);
    const user_fingerprint = getUserFingerprint(req);

    if (!song_id || !session_id) {
      return res.status(400).json({ error: 'song_id and session_id are required' });
    }

    if (rating !== 1 && rating !== -1) {
      return res.status(400).json({ error: 'rating must be 1 (thumbs up) or -1 (thumbs down)' });
    }

    // Check if user already voted
    const existingVote = db.prepare(`
      SELECT id, rating FROM song_ratings
      WHERE song_id = ? AND user_fingerprint = ?
    `).get(song_id, user_fingerprint);

    if (existingVote) {
      if (existingVote.rating === rating) {
        // Same vote - just return current counts (idempotent)
        console.log(`User already voted ${rating} for song ${song_id}`);
      } else {
        // Changing vote - update it (old vote automatically removed, new vote added)
        console.log(`User changing vote from ${existingVote.rating} to ${rating} for song ${song_id}`);
        db.prepare(`
          UPDATE song_ratings
          SET rating = ?, session_id = ?, ip_address = ?
          WHERE song_id = ? AND user_fingerprint = ?
        `).run(rating, session_id, ip_address, song_id, user_fingerprint);
      }
    } else {
      // New vote
      console.log(`New vote ${rating} for song ${song_id}`);
      db.prepare(`
        INSERT INTO song_ratings (song_id, session_id, ip_address, user_fingerprint, rating)
        VALUES (?, ?, ?, ?, ?)
      `).run(song_id, session_id, ip_address, user_fingerprint, rating);
    }

    // Get updated counts
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as thumbs_up,
        SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as thumbs_down
      FROM song_ratings
      WHERE song_id = ?
    `).get(song_id);

    console.log(`Vote counts for song ${song_id}: up=${counts.thumbs_up || 0}, down=${counts.thumbs_down || 0}`);

    res.json({
      message: 'Rating submitted',
      thumbs_up: counts.thumbs_up || 0,
      thumbs_down: counts.thumbs_down || 0,
      user_rating: rating
    });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get ratings for a song
app.get('/api/ratings/:song_id', (req, res) => {
  try {
    const { song_id } = req.params;
    const user_fingerprint = getUserFingerprint(req);

    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as thumbs_up,
        SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as thumbs_down
      FROM song_ratings
      WHERE song_id = ?
    `).get(song_id);

    const result = {
      song_id,
      thumbs_up: counts.thumbs_up || 0,
      thumbs_down: counts.thumbs_down || 0,
      user_rating: null
    };

    // Check if this user (by fingerprint) has already rated this song
    const userRating = db.prepare(`
      SELECT rating FROM song_ratings
      WHERE song_id = ? AND user_fingerprint = ?
    `).get(song_id, user_fingerprint);

    if (userRating) {
      result.user_rating = userRating.rating;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= HEALTH CHECK =============

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Radio Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: radio.db`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   POST   /api/listeners          - Register/update listener`);
  console.log(`   GET    /api/listeners/stats    - Get listener statistics`);
  console.log(`   POST   /api/sessions/start     - Start listening session`);
  console.log(`   POST   /api/sessions/end       - End listening session`);
  console.log(`   POST   /api/requests           - Submit song request`);
  console.log(`   GET    /api/requests           - Get song requests`);
  console.log(`   PATCH  /api/requests/:id       - Update request status`);
  console.log(`   POST   /api/feedback           - Submit feedback`);
  console.log(`   GET    /api/feedback           - Get all feedback`);
  console.log(`   GET    /api/feedback/rating    - Get average rating`);
  console.log(`   POST   /api/ratings            - Submit song rating (thumbs up/down)`);
  console.log(`   GET    /api/ratings/:song_id   - Get ratings for a song`);
  console.log(`   GET    /api/health             - Health check\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close();
  process.exit(0);
});
