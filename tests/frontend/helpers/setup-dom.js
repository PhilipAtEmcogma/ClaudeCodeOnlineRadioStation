/**
 * DOM setup utilities for frontend tests
 * Creates HTML fixtures matching the structure in index.html
 */

/**
 * Creates the ratings UI elements in the DOM
 * Matches the structure from public/index.html
 */
function setupRatingsDOM() {
  document.body.innerHTML = `
    <div class="rating-section">
      <div class="rating-buttons">
        <button id="thumbs-up" class="rating-btn thumbs-up" aria-label="Thumbs up">
          <span class="icon">👍</span>
          <span id="thumbs-up-count" class="count">0</span>
        </button>
        <button id="thumbs-down" class="rating-btn thumbs-down" aria-label="Thumbs down">
          <span class="icon">👎</span>
          <span id="thumbs-down-count" class="count">0</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Creates the complete player UI including ratings
 * Use this for integration tests
 */
function setupFullPlayerDOM() {
  document.body.innerHTML = `
    <div class="container">
      <div class="player">
        <div class="album-art">
          <img id="album-cover" src="cover.jpg" alt="Album Cover">
        </div>

        <div class="track-info">
          <h1 id="track-title">Loading...</h1>
          <h2 id="track-artist">Radio Calico</h2>
          <p id="track-album">Starting stream...</p>

          <div class="rating-section">
            <div class="rating-buttons">
              <button id="thumbs-up" class="rating-btn thumbs-up" aria-label="Thumbs up">
                <span class="icon">👍</span>
                <span id="thumbs-up-count" class="count">0</span>
              </button>
              <button id="thumbs-down" class="rating-btn thumbs-down" aria-label="Thumbs down">
                <span class="icon">👎</span>
                <span id="thumbs-down-count" class="count">0</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <audio id="audio-player" preload="auto"></audio>
  `;
}

/**
 * Gets rating DOM elements
 * @returns {Object} Object containing rating UI elements
 */
function getRatingElements() {
  return {
    thumbsUpBtn: document.getElementById('thumbs-up'),
    thumbsDownBtn: document.getElementById('thumbs-down'),
    thumbsUpCount: document.getElementById('thumbs-up-count'),
    thumbsDownCount: document.getElementById('thumbs-down-count')
  };
}

/**
 * Cleans up DOM after tests
 */
function cleanupDOM() {
  document.body.innerHTML = '';
}

/**
 * Sets up localStorage mock
 */
function setupLocalStorage() {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  global.localStorage = localStorageMock;
  return localStorageMock;
}

/**
 * Creates a mock fetch function for testing
 * @returns {jest.Mock} Mock fetch function
 */
function setupMockFetch() {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;
  return mockFetch;
}

module.exports = {
  setupRatingsDOM,
  setupFullPlayerDOM,
  getRatingElements,
  cleanupDOM,
  setupLocalStorage,
  setupMockFetch
};
