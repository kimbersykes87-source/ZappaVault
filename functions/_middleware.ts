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
  
  // Allow access to login page and public static assets without authentication
  const publicPaths = [
    '/login',
    '/favicon.ico',
    '/robots.txt',
  ];
  
  // Allow logo files to be accessed without authentication (needed for login page)
  const publicLogoFiles = [
    '/Zappa-Logo.png',
    '/Zappa-Logo.svg',
    '/Zappa-Loading.svg',
  ];
  
  // Check if path is public
  const isPublicPath = publicPaths.some(path => url.pathname === path || url.pathname.startsWith('/assets/')) ||
                       publicLogoFiles.includes(url.pathname);
  
  // CRITICAL: Block access to data files (library JSON, track durations, links)
  // These contain sensitive metadata and should only be accessible via authenticated API
  if (url.pathname.startsWith('/data/')) {
    // Data files must be accessed through authenticated API endpoints, not directly
    if (!isAuthenticated(request, env)) {
      return new Response('Authentication required', { status: 401 });
    }
  }
  
  // Block access to cover images without authentication (they're part of the collection)
  if (url.pathname.startsWith('/covers/')) {
    if (!isAuthenticated(request, env)) {
      return new Response('Authentication required', { status: 401 });
    }
  }
  
  // Allow public static assets (only logo, loading SVG, etc. - not data or covers)
  const isPublicStaticAsset = url.pathname.match(/\.(svg|css|js|woff|woff2|ttf|eot)$/i) && 
                              !url.pathname.startsWith('/data/') && 
                              !url.pathname.startsWith('/covers/');
  
  if (isPublicPath || isPublicStaticAsset) {
    // Allow access to public paths and safe static assets
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

