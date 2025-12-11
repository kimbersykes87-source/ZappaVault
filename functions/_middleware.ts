/**
 * Global middleware to protect all routes with password authentication
 * Excludes the login page itself and static assets
 */

import { isAuthenticated, getLoginPageResponse } from './utils/auth.ts';
import type { AuthEnv } from './utils/auth.ts';

export interface EnvBindings extends AuthEnv {
  SITE_PASSWORD?: string;
}

export const onRequest: PagesFunction<EnvBindings> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  
  // Allow access to login page and static assets without authentication
  const publicPaths = [
    '/login',
    '/favicon.ico',
    '/robots.txt',
  ];
  
  // Check if path is public
  const isPublicPath = publicPaths.some(path => url.pathname === path || url.pathname.startsWith('/assets/'));
  
  // Allow static assets (images, CSS, JS) - these are typically served by Cloudflare Pages
  const isStaticAsset = url.pathname.match(/\.(jpg|jpeg|png|gif|svg|css|js|woff|woff2|ttf|eot)$/i);
  
  if (isPublicPath || isStaticAsset) {
    // Allow access to public paths and static assets
    return next();
  }
  
  // Check authentication for all other paths
  if (!isAuthenticated(request, env)) {
    // For API requests, return 401 JSON (frontend can handle redirect)
    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required', loginUrl: '/login' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
    
    // For page requests, redirect to login, preserving the original URL
    const loginUrl = `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`;
    return new Response(null, {
      status: 302,
      headers: {
        'Location': loginUrl,
      },
    });
  }
  
  // User is authenticated, continue to the requested page
  return next();
};

