# Security Testing Guide

This document provides comprehensive security testing procedures for Radio Calico.

## Table of Contents

1. [Overview](#overview)
2. [Security Tools Setup](#security-tools-setup)
3. [Security Testing Workflow](#security-testing-workflow)
4. [Dependency Scanning](#dependency-scanning)
5. [Static Code Analysis](#static-code-analysis)
6. [Docker Image Scanning](#docker-image-scanning)
7. [Dynamic Application Security Testing](#dynamic-application-security-testing)
8. [Security Best Practices](#security-best-practices)
9. [Vulnerability Response Process](#vulnerability-response-process)
10. [Security Checklist](#security-checklist)

## Overview

Radio Calico implements multiple layers of security testing to protect against common vulnerabilities:

- **Dependency Scanning**: Detects known vulnerabilities in npm packages
- **Static Analysis**: Identifies security issues in source code
- **Container Scanning**: Finds vulnerabilities in Docker images
- **Dynamic Testing**: Tests running application for security flaws
- **Input Validation**: Prevents injection attacks and malformed data
- **Rate Limiting**: Protects against abuse and DoS attacks
- **Security Headers**: Adds protection against XSS, clickjacking, etc.

## Security Tools Setup

### Prerequisites

- Node.js 22+
- Docker Desktop (for container scans and ZAP testing)
- Make (optional, for convenient commands)

### Installation

Run the security tools installer:

```bash
make security-install
```

This installs:
1. **Snyk** - Enhanced dependency vulnerability scanner
2. **ESLint security plugins** - Static code analysis rules
3. **Trivy** (via Docker) - Container vulnerability scanner
4. **Semgrep** (via Docker) - Pattern-based code scanner
5. **OWASP ZAP** (via Docker) - Dynamic application security testing

### Manual Installation

If you prefer manual installation:

```bash
# Install Snyk globally
npm install -g snyk

# Install ESLint security plugins
npm install --save-dev eslint eslint-plugin-security eslint-plugin-no-secrets

# Trivy, Semgrep, and ZAP run via Docker (no installation needed)
```

## Security Testing Workflow

### Quick Scan (Before Commits)

Run before committing code:

```bash
# Basic dependency check
make security

# Or using npm
npm run security
```

### Full Scan (Before Deployments)

Run comprehensive security audit before production deployments:

```bash
# Run all security scans (except API testing)
make security-full
```

This runs:
1. npm audit (dependency vulnerabilities)
2. Snyk (enhanced dependency scanning)
3. ESLint + Semgrep (code analysis)
4. Trivy (Docker image scanning)

### API Security Testing (Manual)

Test the running application:

```bash
# Start the server first
npm start

# In another terminal, run ZAP
make security-api
```

### Review Reports

All security reports are generated in the `reports/` directory:

```bash
# List all reports
ls -lh reports/

# Reports include:
# - security-audit.json/txt (npm audit)
# - snyk-report.json/txt (Snyk)
# - eslint-security.json/txt (ESLint)
# - semgrep-report.json/txt (Semgrep)
# - trivy-dev.txt, trivy-api.txt, trivy-nginx.txt (Trivy)
# - zap-report.json/html (OWASP ZAP)
```

## Dependency Scanning

### npm audit

Built-in npm vulnerability scanner:

```bash
# Run audit
npm audit

# Run with different severity levels
npm run security              # moderate+
npm run security:critical     # critical only

# Fix automatically
npm audit fix
make security-fix
```

**What it detects:**
- Known vulnerabilities in dependencies
- Outdated packages with security patches
- Supply chain risks

**Limitations:**
- Only checks npm registry
- May have false positives
- Doesn't catch zero-day vulnerabilities

### Snyk

Enhanced dependency scanner with better accuracy:

```bash
# Run Snyk scan
make security-deps

# Or manually
snyk test                     # Scan for vulnerabilities
snyk monitor                  # Continuous monitoring
```

**What it detects:**
- Known vulnerabilities (larger database than npm audit)
- License compliance issues
- Dependency updates with security fixes

**Snyk vs npm audit:**
- Snyk has more comprehensive vulnerability database
- Better remediation advice
- Can integrate with CI/CD for continuous monitoring

## Static Code Analysis

### ESLint Security Plugin

Detects common security anti-patterns in code:

```bash
# Run ESLint security scan
npx eslint . --ext .js

# Or as part of full scan
make security-code
```

**What it detects:**
- Unsafe regular expressions (ReDoS)
- eval() usage
- Command injection risks
- Path traversal vulnerabilities
- Timing attack possibilities
- Hardcoded secrets
- Buffer vulnerabilities

**Example violations:**

```javascript
// BAD: Unsafe regex (ReDoS vulnerability)
const regex = new RegExp(userInput);

// BAD: eval usage
eval(userInput);

// BAD: Hardcoded secret
const apiKey = 'sk_live_123abc456def';

// GOOD: Parameterized query (prevents SQL injection)
await database.get('SELECT * FROM users WHERE id = ?', [userId]);
```

### Semgrep

Pattern-based security scanner:

```bash
# Run Semgrep
make security-code

# Or manually via Docker
docker run --rm -v $(pwd):/src returntocorp/semgrep --config=auto /src
```

**What it detects:**
- OWASP Top 10 vulnerabilities
- Framework-specific security issues
- Custom security rules
- Code quality issues with security impact

**Semgrep vs ESLint:**
- Semgrep uses semantic patterns, not just AST
- Better at detecting complex vulnerabilities
- Can define custom rules for your codebase

## Docker Image Scanning

### Trivy

Scans Docker images for vulnerabilities:

```bash
# Scan all images
make security-docker

# Or scan specific image
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image radio-radio-calico-api
```

**What it detects:**
- OS package vulnerabilities (Alpine, Debian, etc.)
- Application dependency vulnerabilities
- Misconfigurations
- Secrets in images
- License issues

**Severity levels:**
- **CRITICAL**: Immediate action required
- **HIGH**: Fix in next patch release
- **MEDIUM**: Fix in next minor release
- **LOW**: Fix when convenient
- **UNKNOWN**: Review manually

**Example findings:**

```
Total: 15 (CRITICAL: 2, HIGH: 5, MEDIUM: 6, LOW: 2)

CRITICAL: CVE-2024-1234 - Buffer overflow in libfoo
  Installed: 1.2.3
  Fixed: 1.2.4

  Recommendation: Upgrade base image or libfoo package
```

## Dynamic Application Security Testing

### OWASP ZAP (Zed Attack Proxy)

Tests running application for vulnerabilities:

```bash
# Start server first
npm start

# Run ZAP baseline scan (in another terminal)
make security-api
```

**What it detects:**
- SQL injection
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Insecure authentication
- Sensitive data exposure
- Missing security headers
- Insecure configurations

**ZAP Scan Types:**

1. **Baseline Scan** (passive, quick)
   - No active attacks
   - Analyzes responses only
   - Safe for production

2. **Full Scan** (active, thorough)
   - Sends attack payloads
   - May modify/delete data
   - Only use on test environments

**Interpreting ZAP Results:**

- **Risk = High**: Critical security flaw, fix immediately
- **Risk = Medium**: Potential vulnerability, investigate
- **Risk = Low**: Minor issue or informational
- **Risk = Informational**: Best practice recommendation

## Security Best Practices

### 1. Input Validation

All user input is validated using express-validator:

```javascript
// Example: POST /api/ratings
app.post('/api/ratings',
  [
    body('song_id')
      .trim()                      // Remove whitespace
      .notEmpty()                  // Required field
      .isLength({ max: 255 })      // Prevent oversized input
      .matches(/^[a-zA-Z0-9_: -]+$/), // Whitelist characters
    body('rating')
      .isIn([1, -1])               // Enum validation
  ],
  handleValidationErrors,
  async (req, res) => { /* ... */ }
);
```

**Validation rules:**
- **Always validate on server-side** (never trust client)
- **Whitelist allowed characters** (don't blacklist)
- **Limit input length** (prevent DoS)
- **Escape HTML** (prevent XSS)
- **Normalize data** (email, URLs)

### 2. Rate Limiting

Protects against abuse and DoS attacks:

```javascript
// General API rate limit: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// Strict limit for write operations: 30 per 15 minutes
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
});

// Ratings limit: 10 votes per minute
const ratingsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
});
```

**Rate limiting strategy:**
- **Read operations**: Generous limits (100/15min)
- **Write operations**: Stricter limits (30/15min)
- **Voting/ratings**: Very strict (10/min)
- **Per-IP limits** (use X-Forwarded-For behind proxy)

### 3. Security Headers

Helmet.js adds essential security headers:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],               // Only load from same origin
      scriptSrc: ["'self'", "cdn.example"], // Restrict scripts
      // ... more directives
    },
  },
  frameguard: { action: 'sameorigin' },     // Prevent clickjacking
}));
```

**Headers added:**
- **Content-Security-Policy**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Strict-Transport-Security**: Enforces HTTPS
- **X-XSS-Protection**: Browser XSS filter

### 4. Database Security

Prevents SQL injection using parameterized queries:

```javascript
// GOOD: Parameterized query
await database.get('SELECT * FROM users WHERE id = ?', [userId]);

// BAD: String concatenation (NEVER DO THIS!)
await database.get(`SELECT * FROM users WHERE id = ${userId}`);
```

**Database best practices:**
- **Always use parameterized queries**
- **Principle of least privilege** (minimal DB permissions)
- **Encrypt sensitive data at rest**
- **Regular backups** (see `make db-backup`)
- **Audit database access logs**

### 5. Authentication & Authorization

Currently, the application has **no authentication**. All endpoints are public.

**For production, consider adding:**

```javascript
// JWT authentication middleware
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

// Protected endpoint
app.patch('/api/requests/:id', authenticateJWT, async (req, res) => {
  // Only authenticated users can update requests
});
```

### 6. CORS Configuration

Production should restrict origins:

```javascript
// Development: Allow all origins
// Production: Whitelist specific domains
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost'
    : '*',
};
```

**Set in production .env:**
```
ALLOWED_ORIGINS=https://radiocalico.com,https://www.radiocalico.com
```

### 7. HTTPS/TLS

**Development:** HTTP is acceptable
**Production:** HTTPS is **mandatory**

Configure nginx for HTTPS (see `nginx.conf`):

```nginx
server {
    listen 443 ssl http2;
    server_name radiocalico.com;

    ssl_certificate /etc/letsencrypt/live/radiocalico.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/radiocalico.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest of config
}
```

## Vulnerability Response Process

### When a Vulnerability is Found

1. **Assess Severity**
   - **Critical/High**: Fix immediately
   - **Medium**: Fix within 7 days
   - **Low**: Fix in next release

2. **Check Exploitability**
   - Is there a public exploit?
   - Is the vulnerable code actually used?
   - What's the potential impact?

3. **Remediation Options**
   ```bash
   # Try automatic fix first
   make security-fix

   # If that doesn't work:
   # - Update package manually: npm update package-name
   # - Find alternative package
   # - Apply patch from maintainer
   # - Implement workaround
   ```

4. **Verify Fix**
   ```bash
   # Re-run security scans
   make security-full

   # Run tests
   make test

   # Test manually
   ```

5. **Document**
   - Add to `reports/vulnerability-log.md`
   - Update CHANGELOG if user-facing
   - Notify users if data was compromised

### False Positives

Not all reported vulnerabilities affect your application:

```bash
# Example: Vulnerability in dev-only package
"lodash" vulnerability in jest (devDependency)
  Risk: Low (only used in tests, not production)
  Action: Monitor, update when convenient

# Example: Vulnerability in unused code path
"ejs" template injection vulnerability
  Risk: None (we don't use templates)
  Action: Remove package or document false positive
```

## Security Checklist

### Before Every Commit

- [ ] Run `make security` (npm audit)
- [ ] Run `make test` (ensure no broken tests)
- [ ] Check for hardcoded secrets
- [ ] Review new code for security issues

### Before Every Deployment

- [ ] Run `make security-full` (comprehensive scan)
- [ ] Review all HIGH and CRITICAL findings
- [ ] Run `make test-coverage` (ensure 50%+ coverage)
- [ ] Update dependencies: `npm outdated && npm update`
- [ ] Review Docker image scan results
- [ ] Test in staging environment first
- [ ] Backup production database: `make db-backup`
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` in .env
- [ ] Verify HTTPS is enabled
- [ ] Check rate limits are appropriate
- [ ] Review security headers in nginx
- [ ] Monitor logs for suspicious activity

### Monthly Security Review

- [ ] Review all security reports
- [ ] Update all dependencies: `npm update`
- [ ] Review access logs for anomalies
- [ ] Test backup restoration procedure
- [ ] Review user permissions
- [ ] Rotate secrets (database passwords, API keys)
- [ ] Check for new security advisories
- [ ] Update security documentation

### Quarterly Security Audit

- [ ] Full penetration test
- [ ] Review all code changes
- [ ] Update threat model
- [ ] Review incident response plan
- [ ] Security training for team
- [ ] Third-party security assessment

## Common Vulnerabilities & Prevention

### 1. SQL Injection

**Risk**: Attackers can execute arbitrary SQL queries

**Prevention**: Always use parameterized queries
```javascript
// GOOD
await database.get('SELECT * FROM users WHERE id = ?', [userId]);

// BAD
await database.get(`SELECT * FROM users WHERE id = ${userId}`);
```

**Testing**: Use sqlmap or manual testing with `' OR '1'='1`

### 2. Cross-Site Scripting (XSS)

**Risk**: Attackers inject malicious scripts

**Prevention**:
- Escape user input with `.escape()`
- Set Content-Security-Policy headers
- Sanitize HTML output

```javascript
body('message')
  .trim()
  .escape()  // Converts <script> to &lt;script&gt;
```

**Testing**: Try submitting `<script>alert('XSS')</script>`

### 3. Cross-Site Request Forgery (CSRF)

**Risk**: Attackers trick users into unwanted actions

**Prevention**:
- Use CSRF tokens (not implemented yet)
- SameSite cookies
- Verify Origin/Referer headers

**Current status**: ⚠️ Not fully protected (add CSRF middleware)

### 4. Denial of Service (DoS)

**Risk**: Attackers overwhelm server with requests

**Prevention**:
- Rate limiting (✅ implemented)
- Request size limits (✅ implemented: 10kb)
- Connection limits
- Load balancing

**Testing**: Use `ab` (Apache Bench) or `wrk`

### 5. Insecure Direct Object References

**Risk**: Users access unauthorized data

**Prevention**:
- Authorization checks (⚠️ not implemented yet)
- Validate user owns requested resource
- Use UUIDs instead of sequential IDs

**Example vulnerability**:
```javascript
// BAD: No authorization check
app.get('/api/feedback/:id', async (req, res) => {
  const feedback = await database.get('SELECT * FROM feedback WHERE id = ?', [req.params.id]);
  res.json(feedback);  // Anyone can read anyone's feedback!
});
```

### 6. Sensitive Data Exposure

**Risk**: Secrets leaked in code, logs, or responses

**Prevention**:
- Never commit secrets (use `.env`)
- Don't log sensitive data
- Use HTTPS in production
- Sanitize error messages

```javascript
// BAD: Exposes database structure
res.status(500).json({ error: error.stack });

// GOOD: Generic error message
res.status(500).json({ error: 'Internal server error' });
```

### 7. Broken Authentication

**Risk**: Weak login/session management

**Current status**: ⚠️ No authentication implemented

**When adding auth, ensure:**
- Strong password requirements
- Account lockout after failed attempts
- Secure session management
- Multi-factor authentication
- Password reset tokens expire

## Tools Reference

### Quick Commands

```bash
# Security scanning
make security              # npm audit (moderate+)
make security-full         # All scans except API testing
make security-deps         # Snyk dependency scan
make security-code         # ESLint + Semgrep
make security-docker       # Trivy image scan
make security-api          # OWASP ZAP (requires running server)

# Fixes
make security-fix          # Auto-fix dependencies
npm audit fix --force      # Force fix (may break)

# Reports
make security-report       # Generate detailed reports
ls -lh reports/            # List all reports

# Installation
make security-install      # Install security tools
```

### Report Locations

All reports are generated in `reports/` directory:

| Tool | Report Files |
|------|-------------|
| npm audit | `security-audit.json`, `security-audit.txt` |
| Snyk | `snyk-report.json`, `snyk-report.txt` |
| ESLint | `eslint-security.json`, `eslint-security.txt` |
| Semgrep | `semgrep-report.json`, `semgrep-report.txt` |
| Trivy | `trivy-dev.txt`, `trivy-api.txt`, `trivy-nginx.txt` |
| OWASP ZAP | `zap-report.json`, `zap-report.html` |

## Additional Resources

### Documentation

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)

### Tools

- [Snyk](https://snyk.io/) - Dependency scanning
- [Semgrep](https://semgrep.dev/) - Static analysis
- [Trivy](https://trivy.dev/) - Container scanning
- [OWASP ZAP](https://www.zaproxy.org/) - Dynamic testing
- [NodeJsScan](https://github.com/ajinabraham/NodeJsScan) - Static analysis
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Built-in scanner

### Community

- [Node.js Security Working Group](https://github.com/nodejs/security-wg)
- [OWASP Node.js Project](https://owasp.org/www-project-nodejs-security/)
- [Security Mailing Lists](https://github.com/nodejs/security-wg#mailing-list)

## Support

For security issues or questions:

1. Check this guide first
2. Review security reports in `reports/`
3. Search existing GitHub issues
4. Contact security team (if applicable)

**Reporting Security Vulnerabilities:**

If you discover a security vulnerability, please email security@example.com (or create a private GitHub Security Advisory). Do NOT open a public issue.

---

Last updated: 2025-01-11
Version: 1.0
