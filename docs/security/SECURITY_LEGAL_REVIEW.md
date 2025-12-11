# Security and Legal Review - ZappaVault

**Date:** 2025-01-28  
**Status:** ⚠️ Multiple security and legal concerns identified

---

## 🔒 SECURITY CONCERNS

### 1. **CRITICAL: Weak Admin Authentication**

**Issue:** Admin token authentication has multiple vulnerabilities:
- Token accepted in query string (`?token=...`) - exposed in logs, browser history, referrer headers
- Returns `true` (allows access) if `ADMIN_TOKEN` is not set
- No rate limiting on admin endpoints
- Token comparison is simple string equality (timing attack possible)

**Location:** `functions/utils/library.ts:249-258`

**Solution:**
```typescript
export function requireAdmin(request: Request, env: EnvBindings): boolean {
  const expected = env.ADMIN_TOKEN;
  if (!expected) {
    // Security by default: deny if not configured
    console.error('[AUTH] ADMIN_TOKEN not configured - denying access');
    return false;
  }

  // Only accept token in header, never in query string
  const headerToken = request.headers.get('x-admin-token');
  if (!headerToken) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return constantTimeEqual(headerToken, expected);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

**Action Required:** 
- Remove query string token support
- Change default behavior to deny access if token not configured
- Implement constant-time comparison

---

### 2. **CRITICAL: Open CORS Policy**

**Issue:** Proxy endpoint allows requests from any origin (`Access-Control-Allow-Origin: *`)

**Location:** `functions/api/proxy.ts` (all responses)

**Risk:** 
- Any website can make requests through your proxy
- Potential for abuse/DoS attacks
- Data leakage to third parties

**Solution:**
```typescript
// Add origin whitelist
const ALLOWED_ORIGINS = [
  'https://zappavault.pages.dev',
  'https://www.zappavault.pages.dev',
  // Add your custom domain if you have one
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : 'null';
    
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

// In proxy.ts
const origin = request.headers.get('Origin');
const corsHeaders = getCorsHeaders(origin);

return new Response(content, {
  status: 200,
  headers: {
    'Content-Type': contentType,
    ...corsHeaders,
    'Cache-Control': 'public, max-age=3600',
  },
});
```

**Action Required:** Restrict CORS to your domain only

---

### 3. **HIGH: Weak URL Validation in Proxy**

**Issue:** Proxy only checks if URL contains "dropbox.com" or "dropboxusercontent.com"

**Location:** `functions/api/proxy.ts:23`

**Risk:**
- SSRF (Server-Side Request Forgery) attacks
- Access to internal services
- Data exfiltration

**Solution:**
```typescript
function isValidDropboxUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Whitelist specific Dropbox domains
    const allowedDomains = [
      'www.dropbox.com',
      'dropbox.com',
      'dl.dropboxusercontent.com',
      'content.dropboxapi.com',
    ];
    
    if (!allowedDomains.includes(hostname)) {
      return false;
    }
    
    // Additional validation: ensure it's a valid Dropbox share link format
    // Dropbox share links typically have format: /s/... or /scl/...
    const path = parsed.pathname;
    if (!path.startsWith('/s/') && !path.startsWith('/scl/')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
```

**Action Required:** Implement strict URL whitelist validation

---

### 4. **HIGH: No Rate Limiting**

**Issue:** No rate limiting on any API endpoints

**Risk:**
- DoS attacks
- Resource exhaustion
- Cost overruns (Cloudflare/Dropbox API limits)

**Solution:** Implement rate limiting using Cloudflare's built-in features or a KV-based solution:

```typescript
// Add to functions/utils/rateLimit.ts
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  request: Request,
  env: EnvBindings,
  limit: number = 100, // requests
  window: number = 60, // seconds
): Promise<RateLimitResult> {
  // Use Cloudflare's IP address
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ratelimit:${ip}`;
  
  if (!env.RATE_LIMIT_KV) {
    // If no KV, allow (for development)
    return { allowed: true, remaining: limit, resetAt: Date.now() + window * 1000 };
  }
  
  const data = await env.RATE_LIMIT_KV.get(key, 'json') as { count: number; resetAt: number } | null;
  const now = Date.now();
  
  if (!data || now > data.resetAt) {
    // Reset window
    await env.RATE_LIMIT_KV.put(key, JSON.stringify({ count: 1, resetAt: now + window * 1000 }), {
      expirationTtl: window,
    });
    return { allowed: true, remaining: limit - 1, resetAt: now + window * 1000 };
  }
  
  if (data.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: data.resetAt };
  }
  
  // Increment count
  await env.RATE_LIMIT_KV.put(key, JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }), {
    expirationTtl: Math.ceil((data.resetAt - now) / 1000),
  });
  
  return { allowed: true, remaining: limit - data.count - 1, resetAt: data.resetAt };
}

// Use in endpoints:
const rateLimit = await checkRateLimit(request, env, 100, 60);
if (!rateLimit.allowed) {
  return new Response('Rate limit exceeded', { 
    status: 429,
    headers: {
      'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(rateLimit.resetAt),
    },
  });
}
```

**Action Required:** Implement rate limiting on all public endpoints

---

### 5. **MEDIUM: Sensitive Data in Logs**

**Issue:** Console.log statements may expose sensitive information

**Locations:** Throughout codebase, especially:
- `functions/api/albums/[id].ts` - logs file paths, tokens
- `functions/utils/dropboxToken.ts` - logs token refresh details

**Solution:**
```typescript
// Create a safe logger utility
function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  const sanitized = sanitizeLogData(data);
  console[level](message, sanitized);
}

function sanitizeLogData(data: unknown): unknown {
  if (typeof data === 'string') {
    // Remove potential tokens/secrets
    return data
      .replace(/token[=:]\s*[\w-]+/gi, 'token=***')
      .replace(/bearer\s+[\w-]+/gi, 'bearer ***')
      .replace(/password[=:]\s*\S+/gi, 'password=***');
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (['token', 'password', 'secret', 'key', 'authorization'].some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitizeLogData(value);
      }
    }
    return sanitized;
  }
  return data;
}
```

**Action Required:** Sanitize all log output

---

### 6. **MEDIUM: No Request Size Limits**

**Issue:** No limits on request body size for admin endpoints

**Location:** `functions/api/refresh.ts`

**Risk:** Memory exhaustion, DoS attacks

**Solution:**
```typescript
// Add size limit check
const MAX_BODY_SIZE = 25 * 1024 * 1024; // 25MB (Cloudflare KV limit)

const contentLength = request.headers.get('content-length');
if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
  return new Response('Request body too large', { status: 413 });
}

// Also check actual body size
const body = await request.text();
if (body.length > MAX_BODY_SIZE) {
  return new Response('Request body too large', { status: 413 });
}
```

**Action Required:** Add request size limits

---

### 7. **MEDIUM: No Input Validation**

**Issue:** Limited input validation on query parameters and request bodies

**Locations:** All API endpoints

**Solution:** Use Zod for validation (already in dependencies):

```typescript
import { z } from 'zod';

const LibraryQuerySchema = z.object({
  q: z.string().max(200).optional(),
  formats: z.array(z.string()).max(10).optional(),
  era: z.enum(['Mothers Of Invention', 'Solo']).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  sort: z.enum(['title', 'year', 'recent']).optional(),
  page: z.number().int().min(1).max(1000).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});

// In library.ts endpoint
const query = LibraryQuerySchema.parse({
  q: url.searchParams.get('q'),
  formats: url.searchParams.getAll('format'),
  // ... etc
});
```

**Action Required:** Add input validation to all endpoints

---

### 8. **LOW: Missing Security Headers**

**Issue:** No security headers set on responses

**Solution:** Add security headers middleware:

```typescript
function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    // Only add Strict-Transport-Security if you have HTTPS
    // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

// Add to all responses
return new Response(JSON.stringify(data), {
  headers: {
    'content-type': 'application/json',
    ...getSecurityHeaders(),
  },
});
```

**Action Required:** Add security headers to all responses

---

## ⚖️ LEGAL CONCERNS

### 1. **CRITICAL: Copyright Infringement Risk**

**Issue:** Site streams and distributes copyrighted Frank Zappa music without apparent licensing

**Risk:**
- DMCA takedown notices
- Copyright infringement lawsuits
- Service shutdown
- Financial penalties

**Solutions:**

**Option A: Private Family Use Only (Current Stated Purpose)**
- Add prominent disclaimer: "Private family collection - not for public distribution"
- Restrict access with authentication (see security recommendations)
- Add robots.txt to prevent indexing
- Remove from public GitHub if repository is public
- Add password protection to Cloudflare Pages

**Option B: Obtain Proper Licensing**
- Contact Zappa Family Trust for licensing
- Use licensed streaming service APIs
- Purchase distribution rights

**Option C: Transform into Educational/Archive Site**
- Focus on metadata, not audio streaming
- Link to licensed sources (Spotify, Apple Music, etc.)
- Provide historical context only

**Action Required:** 
- Add copyright disclaimer
- Implement access controls
- Review hosting terms of service

---

### 2. **CRITICAL: Missing Privacy Policy**

**Issue:** No privacy policy published

**Legal Requirement:**
- Required in many jurisdictions (GDPR, CCPA, etc.)
- Required by Cloudflare Pages Terms of Service
- Required if collecting any user data

**Solution:** Create `PRIVACY_POLICY.md` and link from footer:

```markdown
# Privacy Policy

**Last Updated:** [Date]

## Data Collection
This site does not collect personal information. We do not use cookies, analytics, or tracking technologies.

## Third-Party Services
- **Cloudflare Pages:** Hosting provider (see [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/))
- **Dropbox:** File storage (see [Dropbox Privacy Policy](https://www.dropbox.com/privacy))

## Data Storage
No user data is stored on our servers. All content is served from Cloudflare's CDN and Dropbox storage.

## Contact
For privacy concerns, contact: [your-email]
```

**Action Required:** Create and publish privacy policy

---

### 3. **CRITICAL: Missing Terms of Service**

**Issue:** No terms of service

**Legal Requirement:**
- Protects you from liability
- Sets usage rules
- Required by some hosting providers

**Solution:** Create `TERMS_OF_SERVICE.md`:

```markdown
# Terms of Service

**Last Updated:** [Date]

## Acceptance of Terms
By accessing this site, you agree to these terms.

## Use Restrictions
- This site is for private, personal use only
- Do not redistribute content
- Do not use for commercial purposes
- Respect copyright laws

## Disclaimer
Content is provided "as is" without warranties. We are not responsible for:
- Copyright infringement by users
- Loss of data
- Service interruptions

## Limitation of Liability
[Your name/entity] shall not be liable for any damages arising from use of this site.

## Contact
For questions: [your-email]
```

**Action Required:** Create and publish terms of service

---

### 4. **HIGH: No DMCA Takedown Policy**

**Issue:** No procedure for handling copyright complaints

**Legal Requirement:**
- Required for safe harbor protection (DMCA)
- Protects you from liability if users infringe

**Solution:** Create `DMCA_POLICY.md`:

```markdown
# DMCA Takedown Policy

## Copyright Agent
[Your name/entity]
[Your address]
[Your email]

## Procedure
To file a DMCA takedown notice, provide:
1. Identification of copyrighted work
2. Location of infringing material (URLs)
3. Your contact information
4. Statement of good faith
5. Statement of accuracy
6. Physical or electronic signature

## Counter-Notification
If you believe content was removed in error, you may file a counter-notification.

## Repeat Infringers
We reserve the right to terminate access for repeat copyright infringers.
```

**Action Required:** Create DMCA policy and register with US Copyright Office

---

### 5. **MEDIUM: GDPR Compliance (if EU users)**

**Issue:** No GDPR compliance measures if EU users access site

**Requirements:**
- Privacy policy (see above)
- Cookie consent (if using cookies)
- Data processing legal basis
- User rights (access, deletion, etc.)

**Solution:**
- Add privacy policy
- Add cookie banner if using cookies
- Document data processing activities
- Provide contact for data requests

**Action Required:** Assess if EU users access site, implement if needed

---

### 6. **LOW: Missing Copyright Notices**

**Issue:** No copyright notices on site

**Solution:** Add footer with:
```
© [Year] [Your Name]. All rights reserved.
Frank Zappa music © Zappa Family Trust. Used for private family collection only.
```

**Action Required:** Add copyright notices

---

## 📋 PRIORITY ACTION ITEMS

### Immediate (This Week)
1. ✅ Fix admin authentication (remove query string, deny by default)
2. ✅ Restrict CORS to your domain only
3. ✅ Add URL validation to proxy endpoint
4. ✅ Create and publish privacy policy
5. ✅ Create and publish terms of service
6. ✅ Add copyright disclaimer

### High Priority (This Month)
7. ✅ Implement rate limiting
8. ✅ Sanitize log output
9. ✅ Add security headers
10. ✅ Add input validation
11. ✅ Create DMCA policy
12. ✅ Add request size limits

### Medium Priority (Next Quarter)
13. ✅ Implement access controls (if keeping private)
14. ✅ Add robots.txt
15. ✅ Review and update all documentation
16. ✅ Set up monitoring/alerting for security events

---

## 🔧 IMPLEMENTATION CHECKLIST

- [ ] Security fixes implemented
- [ ] Legal documents created and published
- [ ] Privacy policy linked in footer
- [ ] Terms of service linked in footer
- [ ] Copyright disclaimer added
- [ ] DMCA policy created
- [ ] Security headers added
- [ ] Rate limiting implemented
- [ ] CORS restricted
- [ ] Input validation added
- [ ] Log sanitization implemented
- [ ] Access controls reviewed (if private)

---

## 📞 RECOMMENDATIONS

1. **Consult with an attorney** specializing in:
   - Copyright law
   - Internet law
   - Privacy law (GDPR/CCPA)

2. **Review hosting terms:**
   - Cloudflare Pages Terms of Service
   - Dropbox Terms of Service
   - Ensure compliance with both

3. **Consider access controls:**
   - If truly "family use only", implement authentication
   - Use Cloudflare Access or similar
   - Remove from public GitHub if repository is public

4. **Monitor for:**
   - DMCA takedown notices
   - Copyright complaints
   - Security incidents
   - Unusual traffic patterns

---

**Note:** This review is for informational purposes only and does not constitute legal advice. Consult with qualified legal counsel for specific legal questions.

