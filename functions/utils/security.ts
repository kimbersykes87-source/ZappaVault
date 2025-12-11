/**
 * Security headers utility for API responses
 */

export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    // Note: Strict-Transport-Security should only be added if you have a custom domain with HTTPS
    // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

