const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const database = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

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
app.post('/api/listeners', async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const existing = await database.get('SELECT * FROM listeners WHERE session_id = ?', [session_id]);

    if (existing) {
      // Update last connected time
      await database.run('UPDATE listeners SET last_connected = CURRENT_TIMESTAMP WHERE session_id = ?', [session_id]);
      res.json({ message: 'Listener updated', listener: existing });
    } else {
      // Create new listener
      const result = await database.run('INSERT INTO listeners (session_id) VALUES (?)', [session_id]);
      res.json({ message: 'Listener registered', id: result.lastInsertRowid });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get listener stats
app.get('/api/listeners/stats', async (req, res) => {
  try {
    const stats = await database.get(`
      SELECT
        COUNT(*) as total_listeners,
        SUM(total_listening_time) as total_minutes
      FROM listeners
    `);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= LISTENING SESSIONS API =============

// Start listening session
app.post('/api/sessions/start', async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const listener = await database.get('SELECT id FROM listeners WHERE session_id = ?', [session_id]);

    if (!listener) {
      return res.status(404).json({ error: 'Listener not found. Register first.' });
    }

    const result = await database.run('INSERT INTO listening_sessions (listener_id) VALUES (?)', [listener.id]);

    res.json({ message: 'Session started', session_id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End listening session
app.post('/api/sessions/end', async (req, res) => {
  try {
    const { session_id, listening_session_id } = req.body;

    if (!session_id || !listening_session_id) {
      return res.status(400).json({ error: 'session_id and listening_session_id are required' });
    }

    const session = await database.get('SELECT * FROM listening_sessions WHERE id = ?', [listening_session_id]);

    if (!session) {
      return res.status(404).json({ error: 'Listening session not found' });
    }

    const startedAt = new Date(session.started_at);
    const endedAt = new Date();
    const duration = Math.floor((endedAt - startedAt) / 1000 / 60); // in minutes

    // Update session
    await database.run(`
      UPDATE listening_sessions
      SET ended_at = CURRENT_TIMESTAMP, duration = ?
      WHERE id = ?
    `, [duration, listening_session_id]);

    // Update listener total time
    await database.run(`
      UPDATE listeners
      SET total_listening_time = total_listening_time + ?
      WHERE session_id = ?
    `, [duration, session_id]);

    res.json({ message: 'Session ended', duration_minutes: duration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= SONG REQUESTS API =============

// Submit song request
app.post('/api/requests', async (req, res) => {
  try {
    const { listener_name, song_title, artist, message } = req.body;

    if (!song_title) {
      return res.status(400).json({ error: 'song_title is required' });
    }

    const result = await database.run(`
      INSERT INTO song_requests (listener_name, song_title, artist, message)
      VALUES (?, ?, ?, ?)
    `, [listener_name || 'Anonymous', song_title, artist, message]);

    res.json({
      message: 'Request submitted',
      id: result.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all song requests
app.get('/api/requests', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const requests = await database.all('SELECT * FROM song_requests WHERE status = ? ORDER BY created_at DESC', [status]);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update request status
app.patch('/api/requests/:id', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'approved', 'played', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await database.run('UPDATE song_requests SET status = ? WHERE id = ?', [status, req.params.id]);

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
app.post('/api/feedback', async (req, res) => {
  try {
    const { listener_name, email, message, rating } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const result = await database.run(`
      INSERT INTO feedback (listener_name, email, message, rating)
      VALUES (?, ?, ?, ?)
    `, [listener_name, email, message, rating]);

    res.json({
      message: 'Feedback submitted',
      id: result.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all feedback
app.get('/api/feedback', async (req, res) => {
  try {
    const feedback = await database.all('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get average rating
app.get('/api/feedback/rating', async (req, res) => {
  try {
    const result = await database.get(`
      SELECT
        AVG(rating) as average_rating,
        COUNT(*) as total_ratings
      FROM feedback
      WHERE rating IS NOT NULL
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= SONG RATINGS API =============

// Submit song rating
app.post('/api/ratings', async (req, res) => {
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
    const existingVote = await database.get(`
      SELECT id, rating FROM song_ratings
      WHERE song_id = ? AND user_fingerprint = ?
    `, [song_id, user_fingerprint]);

    if (existingVote) {
      if (existingVote.rating === rating) {
        // Same vote - just return current counts (idempotent)
        console.log(`User already voted ${rating} for song ${song_id}`);
      } else {
        // Changing vote - update it (old vote automatically removed, new vote added)
        console.log(`User changing vote from ${existingVote.rating} to ${rating} for song ${song_id}`);
        await database.run(`
          UPDATE song_ratings
          SET rating = ?, session_id = ?, ip_address = ?
          WHERE song_id = ? AND user_fingerprint = ?
        `, [rating, session_id, ip_address, song_id, user_fingerprint]);
      }
    } else {
      // New vote
      console.log(`New vote ${rating} for song ${song_id}`);
      await database.run(`
        INSERT INTO song_ratings (song_id, session_id, ip_address, user_fingerprint, rating)
        VALUES (?, ?, ?, ?, ?)
      `, [song_id, session_id, ip_address, user_fingerprint, rating]);
    }

    // Get updated counts
    const counts = await database.get(`
      SELECT
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as thumbs_up,
        SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as thumbs_down
      FROM song_ratings
      WHERE song_id = ?
    `, [song_id]);

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
app.get('/api/ratings/:song_id', async (req, res) => {
  try {
    const { song_id } = req.params;
    const user_fingerprint = getUserFingerprint(req);

    const counts = await database.get(`
      SELECT
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as thumbs_up,
        SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as thumbs_down
      FROM song_ratings
      WHERE song_id = ?
    `, [song_id]);

    const result = {
      song_id,
      thumbs_up: counts.thumbs_up || 0,
      thumbs_down: counts.thumbs_down || 0,
      user_rating: null
    };

    // Check if this user (by fingerprint) has already rated this song
    const userRating = await database.get(`
      SELECT rating FROM song_ratings
      WHERE song_id = ? AND user_fingerprint = ?
    `, [song_id, user_fingerprint]);

    if (userRating) {
      result.user_rating = userRating.rating;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= HEALTH CHECK =============

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start server (only if not being required as a module)
if (require.main === module) {
  (async () => {
    await database.initializeDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🎵 Radio Server running on http://localhost:${PORT}`);
      console.log(`📊 Database type: ${database.getDbType()}`);
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
  })();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await database.close();
  process.exit(0);
});

// Export for testing
module.exports = {
  app,
  database,
  getClientIP,
  getUserFingerprint
};
