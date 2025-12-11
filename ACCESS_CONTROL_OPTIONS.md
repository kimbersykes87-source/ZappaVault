# Access Control Options for ZappaVault

**Date:** January 28, 2025  
**Contact:** Kimber Sykes (kimbersykes@hotmail.com)

---

## Overview

Since ZappaVault is described as a "private family collection," implementing access controls is highly recommended to:
- Protect copyrighted content from unauthorized access
- Reduce legal liability
- Control who can view/stream the music
- Prevent search engine indexing

---

## Option 1: Cloudflare Access (Recommended for Cloudflare Pages)

**Best for:** Sites already on Cloudflare Pages (like yours)

### How It Works
- Cloudflare Access provides authentication before requests reach your site
- Users must authenticate before accessing any content
- Works seamlessly with Cloudflare Pages
- Supports multiple authentication methods

### Features
- ✅ Zero application code changes needed
- ✅ Works at the edge (before requests hit your site)
- ✅ Supports multiple identity providers:
  - Email one-time password (OTP)
  - Google OAuth
  - GitHub OAuth
  - Microsoft/Azure AD
  - Generic OAuth providers
  - Service tokens (for API access)
- ✅ Per-path access rules (e.g., allow public access to `/api/library` but require auth for streaming)
- ✅ Free tier available (up to 50 users)
- ✅ Audit logs

### Setup Steps
1. Go to Cloudflare Dashboard → Zero Trust → Access
2. Create an application:
   - Application name: "ZappaVault"
   - Application domain: `zappavault.pages.dev`
   - Session duration: 24 hours (or your preference)
3. Configure authentication:
   - **Option A:** Email OTP (easiest, no external provider needed)
     - Users enter email, receive one-time code
     - Add allowed email addresses (family members)
   - **Option B:** Google OAuth (if family uses Google accounts)
     - Requires Google Cloud project setup
     - Users sign in with Google
     - Restrict to specific email domains (e.g., `@yourfamily.com`)
4. Set access policies:
   - Allow: Email in list `[family-emails]`
   - Or: Email domain is `@yourfamily.com`
5. Deploy (no code changes needed!)

### Pricing
- **Free tier:** Up to 50 users
- **Paid:** $7/user/month (if you need more than 50 users)

### Pros
- ✅ No code changes required
- ✅ Works immediately after setup
- ✅ Professional authentication UI
- ✅ Supports multiple auth methods
- ✅ Free for small families
- ✅ Built-in audit logs

### Cons
- ⚠️ Requires Cloudflare account (you already have this)
- ⚠️ Free tier limited to 50 users
- ⚠️ Email OTP requires email delivery (may have delays)

---

## Option 2: Application-Level Authentication (Custom)

**Best for:** Full control over authentication flow

### How It Works
- Add authentication directly in your application code
- Users must log in before accessing content
- Store sessions in cookies or tokens

### Implementation Approaches

#### A. Simple Password Protection
```typescript
// functions/api/auth.ts
export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Check for password in query or form
  const password = url.searchParams.get('password') || 
                   (await request.formData()).get('password');
  
  if (password === env.SITE_PASSWORD) {
    // Set secure cookie
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `auth=${generateToken()}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
      },
    });
  }
  
  return new Response('Invalid password', { status: 401 });
};

// Middleware to check auth
function requireAuth(request: Request, env: EnvBindings): boolean {
  const cookie = request.headers.get('Cookie');
  const authToken = cookie?.match(/auth=([^;]+)/)?.[1];
  return validateToken(authToken, env);
}
```

#### B. Multi-User with Email/Password
- Use a simple user database (Cloudflare KV or D1)
- Hash passwords (bcrypt, Argon2)
- Session management
- More complex but more flexible

### Pros
- ✅ Full control over authentication flow
- ✅ Can customize UI/UX
- ✅ No external dependencies
- ✅ Can implement any auth method you want

### Cons
- ⚠️ Requires significant code changes
- ⚠️ You're responsible for security (password hashing, session management)
- ⚠️ More maintenance overhead
- ⚠️ Need to handle edge cases (password reset, etc.)

---

## Option 3: IP Whitelist (Simple but Limited)

**Best for:** Small, fixed group with static IPs

### How It Works
- Only allow requests from specific IP addresses
- Implement at Cloudflare level or application level

### Cloudflare Implementation
1. Go to Cloudflare Dashboard → WAF → Custom Rules
2. Create rule:
   - Field: IP Source Address
   - Operator: is in
   - Value: `[family-ip-addresses]`
   - Action: Block

### Application Implementation
```typescript
const ALLOWED_IPS = [
  '123.45.67.89',  // Family member 1
  '98.76.54.32',  // Family member 2
  // etc.
];

function isAllowedIP(request: Request): boolean {
  const ip = request.headers.get('CF-Connecting-IP') || 
             request.headers.get('X-Forwarded-For');
  return ALLOWED_IPS.includes(ip || '');
}
```

### Pros
- ✅ Very simple to implement
- ✅ No user interaction needed
- ✅ Works automatically for whitelisted IPs

### Cons
- ⚠️ IP addresses change (especially mobile/home networks)
- ⚠️ Doesn't work well with mobile devices
- ⚠️ VPNs can bypass
- ⚠️ Not user-friendly (can't easily add new users)
- ⚠️ Doesn't work if family members travel

---

## Option 4: HTTP Basic Authentication

**Best for:** Quick, simple protection

### How It Works
- Browser prompts for username/password
- Credentials sent in HTTP headers
- No custom UI needed

### Implementation
```typescript
// functions/_middleware.ts or in each endpoint
function requireBasicAuth(request: Request, env: EnvBindings): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Basic ')) {
    return false;
  }
  
  const credentials = atob(auth.substring(6));
  const [username, password] = credentials.split(':');
  
  return username === env.AUTH_USERNAME && 
         password === env.AUTH_PASSWORD;
}

// Return 401 with WWW-Authenticate header if not authenticated
if (!requireBasicAuth(request, env)) {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ZappaVault"',
    },
  });
}
```

### Pros
- ✅ Very simple to implement
- ✅ Built into browsers (no custom UI)
- ✅ Works immediately

### Cons
- ⚠️ Single username/password (not per-user)
- ⚠️ Less secure (credentials in headers, not encrypted in transit if not HTTPS)
- ⚠️ No user management
- ⚠️ Ugly browser popup (not modern UI)

---

## Option 5: Hybrid Approach (Recommended)

**Best for:** Balancing security and usability

### Strategy
1. **Public access** to library browsing (metadata only)
   - Allow anyone to browse albums, see track lists
   - No authentication needed
   - Good for discovery

2. **Authenticated access** for streaming/downloads
   - Require authentication to:
     - Stream audio (`/api/albums/:id?links=1`)
     - Download albums (`/api/albums/:id/download`)
   - Use Cloudflare Access or custom auth

### Implementation
```typescript
// In functions/api/albums/[id].ts
export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const includeLinks = url.searchParams.get('links') === '1';
  
  // If requesting links, require authentication
  if (includeLinks && !requireAuth(request, env)) {
    return new Response('Authentication required for streaming', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="ZappaVault Streaming"',
      },
    });
  }
  
  // Continue with normal logic...
};
```

### Pros
- ✅ Best of both worlds
- ✅ Public can discover content
- ✅ Only authenticated users can stream
- ✅ Reduces legal risk (no public streaming)

### Cons
- ⚠️ More complex to implement
- ⚠️ Need to maintain auth state

---

## Recommendation: Cloudflare Access with Email OTP

**Why this is best for your use case:**

1. **Zero code changes** - Works immediately
2. **Family-friendly** - Email OTP is easy for non-technical users
3. **Free** - Up to 50 users (perfect for family)
4. **Professional** - Looks polished, not a hack
5. **Secure** - Handled by Cloudflare, not your code
6. **Flexible** - Can add/remove users easily
7. **Works with your stack** - Already on Cloudflare Pages

### Quick Setup Guide

1. **Enable Cloudflare Access:**
   ```
   Cloudflare Dashboard → Zero Trust → Access → Applications → Add Application
   ```

2. **Configure Application:**
   - Name: ZappaVault
   - Domain: `zappavault.pages.dev`
   - Session: 24 hours

3. **Set Authentication:**
   - Choose "Email one-time password"
   - Add allowed emails: `[family-member-emails]`

4. **Set Policy:**
   - Rule: Email is in `[family-emails]`
   - Action: Allow

5. **Test:**
   - Visit `zappavault.pages.dev`
   - Should see Cloudflare Access login
   - Enter email, receive code, access site

### Alternative: If You Want Simpler

If Cloudflare Access seems too complex, use **HTTP Basic Auth** with a shared password:
- Quick to implement (1-2 hours)
- Single password for family
- Works immediately
- Less secure but acceptable for family use

---

## Implementation Priority

1. **Immediate:** Add robots.txt to block indexing (already done ✅)
2. **This Week:** Implement Cloudflare Access or HTTP Basic Auth
3. **This Month:** Consider hybrid approach (public browse, auth for streaming)

---

## Questions to Consider

1. **How many users?** 
   - < 10: HTTP Basic Auth or Cloudflare Access (free)
   - 10-50: Cloudflare Access (free)
   - 50+: Cloudflare Access (paid) or custom solution

2. **Technical skill of users?**
   - Low: Cloudflare Access (email OTP is easiest)
   - Medium: HTTP Basic Auth
   - High: Any solution works

3. **Do you want public discovery?**
   - Yes: Hybrid approach (public browse, auth for streaming)
   - No: Full site protection (Cloudflare Access or Basic Auth)

4. **Budget?**
   - $0: Cloudflare Access (free tier) or HTTP Basic Auth
   - $7/user/month: Cloudflare Access (paid)

---

## Next Steps

1. **Decide on approach** based on your needs
2. **If Cloudflare Access:** I can guide you through setup
3. **If HTTP Basic Auth:** I can implement it in your code
4. **If Custom:** We can discuss requirements and implement

**Which approach interests you most?** I can provide detailed implementation steps for any option.

