/**
 * Integration tests for ratings API endpoints
 * Tests POST /api/ratings and GET /api/ratings/:song_id
 *
 * NOTE: This test requires server.js to export the 'app' instance
 * Add this line at the end of server.js: module.exports = { app, db };
 *
 * For now, this demonstrates the testing approach
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const { setupTestDatabase, teardownTestDatabase, clearRatings } = require('../helpers/db-setup');

// Mock Express app with ratings endpoints
// TODO: Replace with actual app from server.js once exported
function createTestApp(db) {
  const app = express();
  app.use(express.json());

  // Helper functions (copied from server.js)
  function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           'unknown';
  }

  function getUserFingerprint(req) {
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const fingerprintString = `${ip}|${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  // POST /api/ratings
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

      const existingVote = db.prepare(`
        SELECT id, rating FROM song_ratings
        WHERE song_id = ? AND user_fingerprint = ?
      `).get(song_id, user_fingerprint);

      if (existingVote) {
        if (existingVote.rating !== rating) {
          db.prepare(`
            UPDATE song_ratings
            SET rating = ?, session_id = ?, ip_address = ?
            WHERE song_id = ? AND user_fingerprint = ?
          `).run(rating, session_id, ip_address, song_id, user_fingerprint);
        }
      } else {
        db.prepare(`
          INSERT INTO song_ratings (song_id, session_id, ip_address, user_fingerprint, rating)
          VALUES (?, ?, ?, ?, ?)
        `).run(song_id, session_id, ip_address, user_fingerprint, rating);
      }

      const counts = db.prepare(`
        SELECT
          SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as thumbs_up,
          SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as thumbs_down
        FROM song_ratings
        WHERE song_id = ?
      `).get(song_id);

      res.json({
        message: 'Rating submitted',
        thumbs_up: counts.thumbs_up || 0,
        thumbs_down: counts.thumbs_down || 0,
        user_rating: rating
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/ratings/:song_id
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

  return app;
}

describe('POST /api/ratings', () => {
  let db;
  let app;

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

    expect(response.body.message).toBe('Rating submitted');
    expect(response.body.thumbs_up).toBe(1);
    expect(response.body.thumbs_down).toBe(0);
    expect(response.body.user_rating).toBe(1);
  });

  test('should accept valid thumbs down rating', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-123',
        rating: -1
      })
      .expect(200);

    expect(response.body.thumbs_down).toBe(1);
    expect(response.body.user_rating).toBe(-1);
  });

  test('should reject invalid rating values', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-123',
        rating: 0
      })
      .expect(400);

    expect(response.body.error).toContain('rating must be');
  });

  test('should require song_id and session_id', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({ rating: 1 })
      .expect(400);

    expect(response.body.error).toContain('required');
  });

  test('should be idempotent for duplicate votes', async () => {
    // First vote
    await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-123',
        rating: 1
      })
      .expect(200);

    // Same vote again (same IP, headers)
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-123',
        rating: 1
      })
      .expect(200);

    // Should still have only 1 thumbs up
    expect(response.body.thumbs_up).toBe(1);
  });

  test('should allow user to change vote', async () => {
    // First vote: thumbs up
    await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-123',
        rating: 1
      })
      .expect(200);

    // Change to thumbs down
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-123',
        rating: -1
      })
      .expect(200);

    expect(response.body.thumbs_up).toBe(0);
    expect(response.body.thumbs_down).toBe(1);
    expect(response.body.user_rating).toBe(-1);
  });

  test('should handle multiple users voting on same song', async () => {
    // User 1 votes thumbs up
    await request(app)
      .post('/api/ratings')
      .set('x-forwarded-for', '192.168.1.1')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-1',
        rating: 1
      })
      .expect(200);

    // User 2 votes thumbs up (different IP)
    await request(app)
      .post('/api/ratings')
      .set('x-forwarded-for', '192.168.1.2')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-2',
        rating: 1
      })
      .expect(200);

    // User 3 votes thumbs down (different IP)
    const response = await request(app)
      .post('/api/ratings')
      .set('x-forwarded-for', '192.168.1.3')
      .send({
        song_id: 'test-song-1',
        session_id: 'session-3',
        rating: -1
      })
      .expect(200);

    expect(response.body.thumbs_up).toBe(2);
    expect(response.body.thumbs_down).toBe(1);
  });
});

describe('GET /api/ratings/:song_id', () => {
  let db;
  let app;

  beforeEach(() => {
    db = setupTestDatabase();
    app = createTestApp(db);
  });

  afterEach(() => {
    teardownTestDatabase(db);
  });

  test('should return zero counts for new song', async () => {
    const response = await request(app)
      .get('/api/ratings/new-song')
      .expect(200);

    expect(response.body.song_id).toBe('new-song');
    expect(response.body.thumbs_up).toBe(0);
    expect(response.body.thumbs_down).toBe(0);
    expect(response.body.user_rating).toBeNull();
  });

  test('should return accurate vote counts', async () => {
    // Add some votes
    await request(app)
      .post('/api/ratings')
      .set('x-forwarded-for', '192.168.1.1')
      .send({ song_id: 'test-song', session_id: 's1', rating: 1 });

    await request(app)
      .post('/api/ratings')
      .set('x-forwarded-for', '192.168.1.2')
      .send({ song_id: 'test-song', session_id: 's2', rating: 1 });

    await request(app)
      .post('/api/ratings')
      .set('x-forwarded-for', '192.168.1.3')
      .send({ song_id: 'test-song', session_id: 's3', rating: -1 });

    const response = await request(app)
      .get('/api/ratings/test-song')
      .expect(200);

    expect(response.body.thumbs_up).toBe(2);
    expect(response.body.thumbs_down).toBe(1);
  });

  test('should return user_rating if user has voted', async () => {
    // User votes
    await request(app)
      .post('/api/ratings')
      .set('x-forwarded-for', '192.168.1.1')
      .set('user-agent', 'TestBrowser/1.0')
      .send({ song_id: 'test-song', session_id: 's1', rating: 1 });

    // Same user checks ratings (same IP and user-agent = same fingerprint)
    const response = await request(app)
      .get('/api/ratings/test-song')
      .set('x-forwarded-for', '192.168.1.1')
      .set('user-agent', 'TestBrowser/1.0')
      .expect(200);

    expect(response.body.user_rating).toBe(1);
  });

  test('should return null user_rating for different user', async () => {
    // User 1 votes
    await request(app)
      .post('/api/ratings')
      .set('x-forwarded-for', '192.168.1.1')
      .send({ song_id: 'test-song', session_id: 's1', rating: 1 });

    // User 2 checks (different IP)
    const response = await request(app)
      .get('/api/ratings/test-song')
      .set('x-forwarded-for', '192.168.1.2')
      .expect(200);

    expect(response.body.user_rating).toBeNull();
  });
});
