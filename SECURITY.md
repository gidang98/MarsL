# MarsL Security

This document describes the security measures in place and how to report vulnerabilities.

## Implemented Protections

### Rate Limiting

All API routes are protected by rate limiters to prevent abuse:

| Endpoint | Window | Max Requests | Behavior |
|----------|--------|-------------|----------|
| `/api/*` (general) | 1 minute | 120 | Block after limit |
| `/api/*` (speed) | 1 minute | 60 | Gradual slowdown (100ms per extra request) |
| `/api/login` | 15 minutes | 10 | Block after limit (skips successful requests) |
| `/api/register` | 1 hour | 5 | Strict block after limit |
| `/api/password` | 15 minutes | 10 | Block after limit |

### Security Headers

Helmet middleware adds the following headers to all responses:

- `Strict-Transport-Security` (HSTS): 1 year max-age, includeSubDomains, preload
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-XSS-Protection` — legacy XSS filter

### Input Validation

All incoming request bodies are checked for:

- XSS payloads (`<script>`, `javascript:`, `onload=`, etc.)
- Excessively long strings (>10,000 chars are truncated)
- Suspicious path traversal (`..`, `\x00`, `.env`, `.git`)

### Bot Detection

Requests with known bot user-agents are blocked from API routes:

- Blocked: `bot`, `crawler`, `spider`, `scraper`, `curl`, `wget`, `python-requests`, `httpx`, `aiohttp`, `axios`, `node-fetch`, `undici`
- Allowed: `/api/config` (needed for client initialization)

### Request Logging

Suspicious requests are logged to console:

- Path traversal attempts
- Requests to sensitive files (`.env`, `.git`, `config.json`)
- Slow requests (>5 seconds)

### Security Audit

Run the security audit script to scan for potential issues:

```bash
npm run security:audit
```

This checks for:
- SQL injection risks in `db.prepare()` calls
- `eval()` usage
- Hardcoded secrets
- Sensitive data in console logs

## Reporting Vulnerabilities

If you discover a security vulnerability, please email the maintainer directly rather than opening a public issue.

## Planned Improvements

- [ ] CSRF token validation for state-changing routes
- [ ] Session token rotation on privilege changes
- [ ] IP-based anomaly detection (unusual login locations)
- [ ] CAPTCHA for registration after failed attempts
- [ ] Content Security Policy (currently disabled due to inline scripts)
