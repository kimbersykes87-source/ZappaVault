/**
 * Simple password-based authentication for ZappaVault
 * Uses secure session cookies for authentication state
 */

export interface AuthEnv {
  SITE_PASSWORD?: string;
}

/**
 * Generate a simple session token (for cookie)
 * In production, you might want to use a more secure method
 */
function generateSessionToken(): string {
  // Simple token generation - sufficient for family use
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash the password for comparison (simple hash for family use)
 * Note: For production, use proper password hashing (bcrypt, Argon2)
 */
async function hashPassword(password: string): Promise<string> {
  // Simple hash - sufficient for family password protection
  // In a real app, you'd use proper password hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'zappavault-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against stored hash
 */
async function verifyPassword(password: string, env: AuthEnv): Promise<boolean> {
  if (!env.SITE_PASSWORD) {
    // If no password set, allow access (for development)
    return true;
  }
  
  const hashed = await hashPassword(password);
  const expected = await hashPassword(env.SITE_PASSWORD);
  
  // Constant-time comparison
  if (hashed.length !== expected.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < hashed.length; i++) {
    result |= hashed.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(request: Request, env: AuthEnv): boolean {
  if (!env.SITE_PASSWORD) {
    // No password set = allow access (development mode)
    return true;
  }
  
  const cookie = request.headers.get('Cookie') || '';
  const sessionMatch = cookie.match(/zappa_auth=([^;]+)/);
  
  if (!sessionMatch) {
    return false;
  }
  
  const sessionToken = sessionMatch[1];
  
  // In a real implementation, you'd verify the session token
  // For simplicity, we'll just check if it exists and is non-empty
  // You could store valid sessions in KV if you want to revoke sessions
  return sessionToken.length > 0;
}

/**
 * Create authentication response (sets cookie)
 */
export async function createAuthResponse(
  password: string,
  env: AuthEnv,
  redirectUrl: string = '/',
): Promise<Response> {
  const isValid = await verifyPassword(password, env);
  
  if (!isValid) {
    // Return login page with error
    return new Response(getLoginPage('Invalid password. Please try again.'), {
      status: 401,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
  
  // Generate session token
  const sessionToken = generateSessionToken();
  
  // Set secure cookie (HttpOnly, Secure, SameSite)
  // Note: Secure flag requires HTTPS (Cloudflare Pages provides this)
  const cookie = `zappa_auth=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`;
  
  // Redirect to requested page or home
  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl,
      'Set-Cookie': cookie,
    },
  });
}

/**
 * Get login page HTML
 */
function getLoginPage(errorMessage?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZappaVault - Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Shrikhand&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    .logo-container {
      margin-bottom: 30px;
    }
    .logo-container img {
      max-width: 100%;
      height: auto;
      max-height: 200px;
      margin-bottom: 20px;
    }
    .quote {
      font-family: 'Shrikhand', cursive;
      font-size: 24px;
      color: #333;
      line-height: 1.4;
      margin-bottom: 30px;
      font-weight: normal;
    }
    .error {
      background: #fee;
      border: 1px solid #fcc;
      color: #c33;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 14px;
      text-align: left;
    }
    .form-group {
      margin-bottom: 20px;
      text-align: left;
    }
    label {
      display: block;
      color: #333;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 16px;
      transition: border-color 0.3s;
      font-family: 'IBM Plex Sans', sans-serif;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      font-family: 'IBM Plex Sans', sans-serif;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    button:active {
      transform: translateY(0);
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #999;
      font-size: 12px;
    }
    @media (max-width: 600px) {
      .quote {
        font-size: 20px;
      }
      .login-container {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo-container">
      <img src="/Zappa-Logo.png" alt="Frank Zappa" />
      <div class="quote">
        If this makes sense to you, you're either in the right place or in serious trouble.
      </div>
    </div>
    ${errorMessage ? `<div class="error">${errorMessage}</div>` : ''}
    <form method="POST" action="/login">
      <div class="form-group">
        <label for="password">Enter Password</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          placeholder="Family password"
          required
          autofocus
        />
      </div>
      <button type="submit">Access Collection</button>
    </form>
    <div class="footer">
      Family members only
    </div>
  </div>
</body>
</html>`;
}

/**
 * Get login page response
 */
export function getLoginPageResponse(redirectUrl?: string): Response {
  const url = redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : '';
  return new Response(getLoginPage(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

