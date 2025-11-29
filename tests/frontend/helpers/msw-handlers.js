/**
 * Mock Service Worker (MSW) handlers for API endpoints
 * Used to mock HTTP requests in frontend tests
 */

const { http, HttpResponse } = require('msw');

// In-memory store for test data
let mockRatingsStore = {};

/**
 * Resets the mock ratings store
 */
function resetMockRatings() {
  mockRatingsStore = {};
}

/**
 * Sets mock rating data for a specific song
 */
function setMockRating(songId, data) {
  mockRatingsStore[songId] = data;
}

/**
 * API handlers for ratings endpoints
 */
const handlers = [
  // GET /api/ratings/:song_id
  http.get('/api/ratings/:song_id', ({ params }) => {
    const { song_id } = params;

    const rating = mockRatingsStore[song_id] || {
      song_id,
      thumbs_up: 0,
      thumbs_down: 0,
      user_rating: null
    };

    return HttpResponse.json(rating);
  }),

  // POST /api/ratings
  http.post('/api/ratings', async ({ request }) => {
    const body = await request.json();
    const { song_id, rating } = body;

    // Validation
    if (!song_id) {
      return HttpResponse.json(
        { error: 'song_id and session_id are required' },
        { status: 400 }
      );
    }

    if (rating !== 1 && rating !== -1) {
      return HttpResponse.json(
        { error: 'rating must be 1 (thumbs up) or -1 (thumbs down)' },
        { status: 400 }
      );
    }

    // Get current ratings or initialize
    const current = mockRatingsStore[song_id] || {
      song_id,
      thumbs_up: 0,
      thumbs_down: 0,
      user_rating: null
    };

    // Handle vote logic
    if (current.user_rating === rating) {
      // Same vote - idempotent
      return HttpResponse.json({
        message: 'Rating submitted',
        thumbs_up: current.thumbs_up,
        thumbs_down: current.thumbs_down,
        user_rating: rating
      });
    } else if (current.user_rating !== null) {
      // Changing vote
      if (current.user_rating === 1) {
        current.thumbs_up = Math.max(0, current.thumbs_up - 1);
      } else {
        current.thumbs_down = Math.max(0, current.thumbs_down - 1);
      }
    }

    // Add new vote
    if (rating === 1) {
      current.thumbs_up += 1;
    } else {
      current.thumbs_down += 1;
    }
    current.user_rating = rating;

    mockRatingsStore[song_id] = current;

    return HttpResponse.json({
      message: 'Rating submitted',
      thumbs_up: current.thumbs_up,
      thumbs_down: current.thumbs_down,
      user_rating: rating
    });
  }),

  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' });
  })
];

module.exports = {
  handlers,
  resetMockRatings,
  setMockRating
};
