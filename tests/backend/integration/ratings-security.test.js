/**
 * Security and edge case tests for ratings API
 * Tests input validation, SQL injection protection, and edge cases
 */

const request = require('supertest');
const express = require('express');
const { setupTestDatabase, teardownTestDatabase } = require('../helpers/db-setup');
const { getClientIP, getUserFingerprint } = require('../../../server');

// Create test app with ratings endpoints using real helper functions
function createTestApp(db) {
  const app = express();
  app.use(express.json());

  // POST /api/ratings - Uses real getClientIP and getUserFingerprint
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

  return app;
}

describe('Security Tests - SQL Injection Protection', () => {
  let db;
  let app;

  beforeEach(() => {
    db = setupTestDatabase();
    app = createTestApp(db);
  });

  afterEach(() => {
    teardownTestDatabase(db);
  });

  test('should prevent SQL injection in song_id', async () => {
    const maliciousSongId = "'; DROP TABLE song_ratings; --";

    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: maliciousSongId,
        session_id: 'session-123',
        rating: 1
      })
      .expect(200);

    // Should treat as literal string, not execute SQL
    expect(response.body.message).toBe('Rating submitted');

    // Verify table still exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='song_ratings'").get();
    expect(tableCheck).toBeDefined();
    expect(tableCheck.name).toBe('song_ratings');

    // Verify the malicious string was inserted as a literal song_id
    const rating = db.prepare('SELECT * FROM song_ratings WHERE song_id = ?').get(maliciousSongId);
    expect(rating).toBeDefined();
    expect(rating.song_id).toBe(maliciousSongId);
  });

  test('should prevent SQL injection in session_id', async () => {
    const maliciousSessionId = "'; DELETE FROM song_ratings WHERE '1'='1";

    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        session_id: maliciousSessionId,
        rating: 1
      })
      .expect(200);

    expect(response.body.message).toBe('Rating submitted');

    // Verify record was inserted (not deleted)
    const count = db.prepare('SELECT COUNT(*) as count FROM song_ratings').get();
    expect(count.count).toBe(1);
  });

  test('should handle SQL-like characters in song_id', async () => {
    const songId = "Bob's Burgers Theme (2011) -- Season 1";

    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: songId,
        session_id: 'session-123',
        rating: 1
      })
      .expect(200);

    expect(response.body.message).toBe('Rating submitted');

    // Verify it was stored correctly
    const rating = db.prepare('SELECT * FROM song_ratings WHERE song_id = ?').get(songId);
    expect(rating).toBeDefined();
    expect(rating.song_id).toBe(songId);
  });
});

describe('Edge Case Tests - Input Validation', () => {
  let db;
  let app;

  beforeEach(() => {
    db = setupTestDatabase();
    app = createTestApp(db);
  });

  afterEach(() => {
    teardownTestDatabase(db);
  });

  test('should reject empty string song_id', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: '',
        session_id: 'session-123',
        rating: 1
      })
      .expect(400);

    expect(response.body.error).toContain('required');
  });

  test('should reject empty string session_id', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        session_id: '',
        rating: 1
      })
      .expect(400);

    expect(response.body.error).toContain('required');
  });

  test('should reject missing song_id field', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        session_id: 'session-123',
        rating: 1
      })
      .expect(400);

    expect(response.body.error).toBe('song_id and session_id are required');
  });

  test('should reject missing session_id field', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        rating: 1
      })
      .expect(400);

    expect(response.body.error).toBe('song_id and session_id are required');
  });

  test('should reject rating value of 0', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        session_id: 'session-123',
        rating: 0
      })
      .expect(400);

    expect(response.body.error).toBe('rating must be 1 (thumbs up) or -1 (thumbs down)');
  });

  test('should reject rating value of 2', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        session_id: 'session-123',
        rating: 2
      })
      .expect(400);

    expect(response.body.error).toBe('rating must be 1 (thumbs up) or -1 (thumbs down)');
  });

  test('should reject string rating value "1"', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        session_id: 'session-123',
        rating: '1'  // String instead of number
      })
      .expect(400);

    expect(response.body.error).toBe('rating must be 1 (thumbs up) or -1 (thumbs down)');
  });

  test('should handle very long song_id', async () => {
    const longSongId = 'a'.repeat(1000);

    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: longSongId,
        session_id: 'session-123',
        rating: 1
      })
      .expect(200);

    expect(response.body.message).toBe('Rating submitted');

    // Verify it was stored
    const rating = db.prepare('SELECT * FROM song_ratings WHERE song_id = ?').get(longSongId);
    expect(rating).toBeDefined();
    expect(rating.song_id).toBe(longSongId);
  });

  test('should handle special characters in session_id', async () => {
    const specialSessionId = 'session-!@#$%^&*()_+-={}[]|:";\'<>?,./';

    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        session_id: specialSessionId,
        rating: 1
      })
      .expect(200);

    expect(response.body.message).toBe('Rating submitted');

    // Verify it was stored
    const rating = db.prepare('SELECT * FROM song_ratings WHERE session_id = ?').get(specialSessionId);
    expect(rating).toBeDefined();
    expect(rating.session_id).toBe(specialSessionId);
  });

  test('should handle unicode characters in song_id', async () => {
    const unicodeSongId = 'Song Title 🎵🎶 - Artist Name 日本語';

    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: unicodeSongId,
        session_id: 'session-123',
        rating: 1
      })
      .expect(200);

    expect(response.body.message).toBe('Rating submitted');

    // Verify it was stored correctly
    const rating = db.prepare('SELECT * FROM song_ratings WHERE song_id = ?').get(unicodeSongId);
    expect(rating).toBeDefined();
    expect(rating.song_id).toBe(unicodeSongId);
  });

  test('should reject null rating value', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        session_id: 'session-123',
        rating: null
      })
      .expect(400);

    expect(response.body.error).toBe('rating must be 1 (thumbs up) or -1 (thumbs down)');
  });

  test('should reject undefined rating value', async () => {
    const response = await request(app)
      .post('/api/ratings')
      .send({
        song_id: 'test-song',
        session_id: 'session-123'
        // rating field missing
      })
      .expect(400);

    expect(response.body.error).toBe('rating must be 1 (thumbs up) or -1 (thumbs down)');
  });
});
