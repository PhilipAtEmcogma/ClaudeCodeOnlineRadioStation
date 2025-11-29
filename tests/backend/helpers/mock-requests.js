/**
 * Factory functions to create mock Express request objects for testing
 */

/**
 * Creates a mock Express request object with custom headers
 * @param {Object} options - Request configuration
 * @param {string} options.ip - Client IP address
 * @param {string} options.userAgent - User-Agent header
 * @param {string} options.acceptLanguage - Accept-Language header
 * @param {string} options.acceptEncoding - Accept-Encoding header
 * @param {Object} options.body - Request body
 * @param {Object} options.params - URL parameters
 * @param {Object} options.query - Query string parameters
 * @returns {Object} Mock request object
 */
function createMockRequest({
  ip = '127.0.0.1',
  userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  acceptLanguage = 'en-US,en;q=0.9',
  acceptEncoding = 'gzip, deflate, br',
  body = {},
  params = {},
  query = {}
} = {}) {
  return {
    headers: {
      'user-agent': userAgent,
      'accept-language': acceptLanguage,
      'accept-encoding': acceptEncoding,
      'x-forwarded-for': ip
    },
    body,
    params,
    query,
    connection: {
      remoteAddress: ip
    },
    socket: {
      remoteAddress: ip
    }
  };
}

/**
 * Creates a mock Express response object with Jest spies
 * @returns {Object} Mock response object with spy functions
 */
function createMockResponse() {
  const res = {
    statusCode: 200,
    _data: null,
    status: jest.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function(data) {
      this._data = data;
      return this;
    }),
    send: jest.fn(function(data) {
      this._data = data;
      return this;
    })
  };
  return res;
}

/**
 * Creates multiple mock requests with different fingerprints (different IPs)
 * @param {number} count - Number of unique users to create
 * @returns {Array<Object>} Array of mock request objects
 */
function createMultipleUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(createMockRequest({
      ip: `192.168.1.${i + 1}`,
      userAgent: `User-Agent-${i}`,
      acceptLanguage: i % 2 === 0 ? 'en-US' : 'es-ES'
    }));
  }
  return users;
}

/**
 * Creates a request with the same fingerprint as another request
 * Useful for testing duplicate vote prevention
 * @param {Object} originalRequest - Original request to copy fingerprint from
 * @param {Object} overrides - Properties to override (e.g., body)
 * @returns {Object} New request with same fingerprint
 */
function createSameFingerprintRequest(originalRequest, overrides = {}) {
  return {
    ...originalRequest,
    ...overrides,
    headers: { ...originalRequest.headers },
    connection: { ...originalRequest.connection },
    socket: { ...originalRequest.socket }
  };
}

module.exports = {
  createMockRequest,
  createMockResponse,
  createMultipleUsers,
  createSameFingerprintRequest
};
