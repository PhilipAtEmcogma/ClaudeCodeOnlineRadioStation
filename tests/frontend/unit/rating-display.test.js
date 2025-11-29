/**
 * Frontend unit tests for rating display functionality
 * Tests the updateRatingDisplay() and rating UI behavior
 */

const { setupRatingsDOM, getRatingElements, cleanupDOM } = require('../helpers/setup-dom');

// NOTE: These functions are extracted from public/app.js for testing
// In a real setup, you might want to refactor app.js to export these functions

// Mock global variables from app.js
let currentSongId = null;
let userSessionId = 'test-session-123';

// DOM element references (will be set in beforeEach)
let thumbsUpBtn, thumbsDownBtn, thumbsUpCount, thumbsDownCount;

// Copy of updateRatingDisplay function from app.js
function updateRatingDisplay(data) {
    thumbsUpCount.textContent = data.thumbs_up || 0;
    thumbsDownCount.textContent = data.thumbs_down || 0;

    // Reset button states
    thumbsUpBtn.classList.remove('active');
    thumbsDownBtn.classList.remove('active');
    thumbsUpBtn.disabled = false;
    thumbsDownBtn.disabled = false;

    // Mark user's previous rating if exists
    if (data.user_rating === 1) {
        thumbsUpBtn.classList.add('active');
    } else if (data.user_rating === -1) {
        thumbsDownBtn.classList.add('active');
    }
}

// Copy of submitRating function from app.js (simplified for testing)
async function submitRating(rating) {
    if (!currentSongId) return;

    try {
        const response = await fetch('/api/ratings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                song_id: currentSongId,
                session_id: userSessionId,
                rating: rating
            })
        });

        if (!response.ok) throw new Error('Failed to submit rating');

        const data = await response.json();

        // Update display with new counts
        thumbsUpCount.textContent = data.thumbs_up || 0;
        thumbsDownCount.textContent = data.thumbs_down || 0;

        // Mark active button
        thumbsUpBtn.classList.remove('active');
        thumbsDownBtn.classList.remove('active');

        if (rating === 1) {
            thumbsUpBtn.classList.add('active');
        } else {
            thumbsDownBtn.classList.add('active');
        }

        thumbsUpBtn.disabled = false;
        thumbsDownBtn.disabled = false;
    } catch (error) {
        console.error('Error submitting rating:', error);
        throw error;
    }
}

describe('updateRatingDisplay', () => {
    beforeEach(() => {
        setupRatingsDOM();
        const elements = getRatingElements();
        thumbsUpBtn = elements.thumbsUpBtn;
        thumbsDownBtn = elements.thumbsDownBtn;
        thumbsUpCount = elements.thumbsUpCount;
        thumbsDownCount = elements.thumbsDownCount;
    });

    afterEach(() => {
        cleanupDOM();
    });

    test('should update thumbs up count in DOM', () => {
        updateRatingDisplay({ thumbs_up: 42, thumbs_down: 5, user_rating: null });
        expect(thumbsUpCount.textContent).toBe('42');
    });

    test('should update thumbs down count in DOM', () => {
        updateRatingDisplay({ thumbs_up: 10, thumbs_down: 23, user_rating: null });
        expect(thumbsDownCount.textContent).toBe('23');
    });

    test('should handle zero counts', () => {
        updateRatingDisplay({ thumbs_up: 0, thumbs_down: 0, user_rating: null });
        expect(thumbsUpCount.textContent).toBe('0');
        expect(thumbsDownCount.textContent).toBe('0');
    });

    test('should add active class to thumbs up when user_rating is 1', () => {
        updateRatingDisplay({ thumbs_up: 5, thumbs_down: 3, user_rating: 1 });
        expect(thumbsUpBtn.classList.contains('active')).toBe(true);
        expect(thumbsDownBtn.classList.contains('active')).toBe(false);
    });

    test('should add active class to thumbs down when user_rating is -1', () => {
        updateRatingDisplay({ thumbs_up: 5, thumbs_down: 3, user_rating: -1 });
        expect(thumbsUpBtn.classList.contains('active')).toBe(false);
        expect(thumbsDownBtn.classList.contains('active')).toBe(true);
    });

    test('should remove active from both buttons when user_rating is null', () => {
        // First set them as active
        thumbsUpBtn.classList.add('active');
        thumbsDownBtn.classList.add('active');

        updateRatingDisplay({ thumbs_up: 5, thumbs_down: 3, user_rating: null });

        expect(thumbsUpBtn.classList.contains('active')).toBe(false);
        expect(thumbsDownBtn.classList.contains('active')).toBe(false);
    });

    test('should keep buttons enabled', () => {
        updateRatingDisplay({ thumbs_up: 5, thumbs_down: 3, user_rating: 1 });
        expect(thumbsUpBtn.disabled).toBe(false);
        expect(thumbsDownBtn.disabled).toBe(false);
    });

    test('should reset button states before applying new state', () => {
        // User previously voted thumbs up
        thumbsUpBtn.classList.add('active');

        // Now they have a thumbs down vote
        updateRatingDisplay({ thumbs_up: 5, thumbs_down: 3, user_rating: -1 });

        expect(thumbsUpBtn.classList.contains('active')).toBe(false);
        expect(thumbsDownBtn.classList.contains('active')).toBe(true);
    });

    test('should handle missing vote counts (null/undefined)', () => {
        updateRatingDisplay({ user_rating: null });
        expect(thumbsUpCount.textContent).toBe('0');
        expect(thumbsDownCount.textContent).toBe('0');
    });
});

describe('submitRating', () => {
    beforeEach(() => {
        setupRatingsDOM();
        const elements = getRatingElements();
        thumbsUpBtn = elements.thumbsUpBtn;
        thumbsDownBtn = elements.thumbsDownBtn;
        thumbsUpCount = elements.thumbsUpCount;
        thumbsDownCount = elements.thumbsDownCount;

        // Set current song
        currentSongId = 'test-song-123';

        // Mock fetch
        global.fetch = jest.fn();
    });

    afterEach(() => {
        cleanupDOM();
        currentSongId = null;
        jest.clearAllMocks();
    });

    test('should POST to /api/ratings with correct payload', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ thumbs_up: 1, thumbs_down: 0, user_rating: 1 })
        });

        await submitRating(1);

        expect(global.fetch).toHaveBeenCalledWith('/api/ratings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                song_id: 'test-song-123',
                session_id: 'test-session-123',
                rating: 1
            })
        });
    });

    test('should update UI with response counts after thumbs up', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ thumbs_up: 5, thumbs_down: 2, user_rating: 1 })
        });

        await submitRating(1);

        expect(thumbsUpCount.textContent).toBe('5');
        expect(thumbsDownCount.textContent).toBe('2');
    });

    test('should mark thumbs up button as active after voting', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ thumbs_up: 1, thumbs_down: 0, user_rating: 1 })
        });

        await submitRating(1);

        expect(thumbsUpBtn.classList.contains('active')).toBe(true);
        expect(thumbsDownBtn.classList.contains('active')).toBe(false);
    });

    test('should mark thumbs down button as active after voting', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ thumbs_up: 0, thumbs_down: 1, user_rating: -1 })
        });

        await submitRating(-1);

        expect(thumbsUpBtn.classList.contains('active')).toBe(false);
        expect(thumbsDownBtn.classList.contains('active')).toBe(true);
    });

    test('should not submit if currentSongId is null', async () => {
        currentSongId = null;

        await submitRating(1);

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle fetch errors gracefully', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 400
        });

        await expect(submitRating(1)).rejects.toThrow('Failed to submit rating');
    });

    test('should handle network errors', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(submitRating(1)).rejects.toThrow('Network error');
    });

    test('should keep buttons enabled after submission', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ thumbs_up: 1, thumbs_down: 0, user_rating: 1 })
        });

        await submitRating(1);

        expect(thumbsUpBtn.disabled).toBe(false);
        expect(thumbsDownBtn.disabled).toBe(false);
    });
});
