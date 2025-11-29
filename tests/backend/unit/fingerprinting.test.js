/**
 * Unit tests for user fingerprinting functions
 * Tests server-side fingerprint generation from request headers
 */

const { getClientIP, getUserFingerprint } = require('../../../server');
const { createMockRequest } = require('../helpers/mock-requests');

describe('getClientIP', () => {
  test('should extract IP from x-forwarded-for header', () => {
    const req = createMockRequest({ ip: '203.0.113.1' });
    const ip = getClientIP(req);
    expect(ip).toBe('203.0.113.1');
  });

  test('should handle multiple IPs in x-forwarded-for (use first one)', () => {
    const req = createMockRequest({ ip: '203.0.113.1' });
    req.headers['x-forwarded-for'] = '203.0.113.1, 198.51.100.1, 192.0.2.1';
    const ip = getClientIP(req);
    expect(ip).toBe('203.0.113.1');
  });

  test('should fallback to x-real-ip if x-forwarded-for is missing', () => {
    const req = createMockRequest({ ip: '203.0.113.1' });
    delete req.headers['x-forwarded-for'];
    req.headers['x-real-ip'] = '198.51.100.1';
    const ip = getClientIP(req);
    expect(ip).toBe('198.51.100.1');
  });

  test('should fallback to connection.remoteAddress', () => {
    const req = createMockRequest({ ip: '127.0.0.1' });
    delete req.headers['x-forwarded-for'];
    const ip = getClientIP(req);
    expect(ip).toBe('127.0.0.1');
  });

  test('should return "unknown" when all IP sources fail', () => {
    const req = {
      headers: {},
      connection: {},
      socket: {}
    };
    const ip = getClientIP(req);
    expect(ip).toBe('unknown');
  });
});

describe('getUserFingerprint', () => {
  test('should generate consistent 64-character SHA-256 hash', () => {
    const req = createMockRequest();
    const fingerprint = getUserFingerprint(req);

    expect(fingerprint).toHaveLength(64);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test('should generate same fingerprint for identical requests', () => {
    const req1 = createMockRequest({
      ip: '203.0.113.1',
      userAgent: 'Mozilla/5.0',
      acceptLanguage: 'en-US',
      acceptEncoding: 'gzip'
    });

    const req2 = createMockRequest({
      ip: '203.0.113.1',
      userAgent: 'Mozilla/5.0',
      acceptLanguage: 'en-US',
      acceptEncoding: 'gzip'
    });

    expect(getUserFingerprint(req1)).toBe(getUserFingerprint(req2));
  });

  test('should generate different fingerprint for different IPs', () => {
    const req1 = createMockRequest({ ip: '203.0.113.1' });
    const req2 = createMockRequest({ ip: '203.0.113.2' });

    expect(getUserFingerprint(req1)).not.toBe(getUserFingerprint(req2));
  });

  test('should generate different fingerprint for different User-Agents', () => {
    const req1 = createMockRequest({ userAgent: 'Mozilla/5.0 (Windows)' });
    const req2 = createMockRequest({ userAgent: 'Mozilla/5.0 (Mac)' });

    expect(getUserFingerprint(req1)).not.toBe(getUserFingerprint(req2));
  });

  test('should generate different fingerprint for different languages', () => {
    const req1 = createMockRequest({ acceptLanguage: 'en-US' });
    const req2 = createMockRequest({ acceptLanguage: 'es-ES' });

    expect(getUserFingerprint(req1)).not.toBe(getUserFingerprint(req2));
  });

  test('should handle missing headers gracefully', () => {
    const req = {
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' }
    };

    const fingerprint = getUserFingerprint(req);
    expect(fingerprint).toHaveLength(64);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test('should include all header components in fingerprint', () => {
    // Change one component at a time to verify it affects the hash
    const baseReq = createMockRequest({
      ip: '203.0.113.1',
      userAgent: 'Mozilla/5.0',
      acceptLanguage: 'en-US',
      acceptEncoding: 'gzip'
    });

    const baseFingerprint = getUserFingerprint(baseReq);

    // Modify each component and verify fingerprint changes
    const components = [
      { ip: '203.0.113.2' },
      { userAgent: 'Chrome/91.0' },
      { acceptLanguage: 'fr-FR' },
      { acceptEncoding: 'br' }
    ];

    components.forEach(override => {
      const modifiedReq = createMockRequest({ ...baseReq.headers, ...override });
      const modifiedFingerprint = getUserFingerprint(modifiedReq);
      expect(modifiedFingerprint).not.toBe(baseFingerprint);
    });
  });
});
