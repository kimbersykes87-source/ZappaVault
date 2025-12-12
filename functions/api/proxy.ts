import type { EnvBindings } from '../utils/library.ts';
import { getValidDropboxToken } from '../utils/dropboxToken.ts';

/**
 * Validate that URL is a legitimate Dropbox URL or file path
 * Prevents SSRF (Server-Side Request Forgery) attacks
 */
function isValidDropboxUrl(url: string): boolean {
  // If it's a file path (starts with /), validate it's a Dropbox path
  if (url.startsWith('/')) {
    // Validate it starts with expected Dropbox path prefix
    // Allow paths like /Apps/ZappaVault/ZappaLibrary/...
    return url.startsWith('/Apps/') || url.startsWith('/ZappaLibrary/');
  }
  
  // Otherwise, validate it's a Dropbox HTTP URL
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
    if (!path.startsWith('/s/') && !path.startsWith('/scl/') && !path.startsWith('/2/')) {
      // Allow API endpoints (/2/) and share links (/s/, /scl/)
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a Dropbox file path to a temporary HTTP URL
 */
async function getTemporaryLink(filePath: string, env: EnvBindings): Promise<string> {
  const token = await getValidDropboxToken(env);
  if (!token) {
    throw new Error('Dropbox token not configured');
  }
  
  const response = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: filePath }),
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to get temporary link: ${response.status} ${errorText}`);
  }
  
  const data = await response.json() as { link: string };
  return data.link;
}

/**
 * Get CORS headers with origin whitelist
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  const ALLOWED_ORIGINS = [
    'https://zappavault.pages.dev',
    'https://www.zappavault.pages.dev',
    // Add custom domain here if you have one
  ];
  
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

export const onRequestGet = async (context: {
  request: Request;
  env: EnvBindings;
}) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Get the target URL from query parameter
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('Missing url parameter', { 
      status: 400,
      headers: corsHeaders,
    });
  }

  // Validate that the URL is from Dropbox (security measure)
  if (!isValidDropboxUrl(targetUrl)) {
    console.error(`[PROXY] Invalid URL: ${targetUrl}`);
    return new Response('Invalid URL: must be from Dropbox', {
      status: 400,
      headers: corsHeaders,
    });
  }

  // If it's a file path (starts with /), convert it to a temporary HTTP URL
  let fetchUrl = targetUrl;
  if (targetUrl.startsWith('/')) {
    try {
      console.log(`[PROXY] Converting file path to temporary link: ${targetUrl}`);
      fetchUrl = await getTemporaryLink(targetUrl, env);
      console.log(`[PROXY] Got temporary link: ${fetchUrl.substring(0, 80)}...`);
    } catch (error) {
      console.error(`[PROXY] Failed to get temporary link for ${targetUrl}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(`Failed to get Dropbox temporary link: ${errorMessage}`, {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain',
        },
      });
    }
  }

  try {
    console.log(`[PROXY] Fetching: ${fetchUrl}`);
    
    // Fetch the content from Dropbox with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
        } catch (e) {
          console.error(`[PROXY] Could not read error response body:`, e);
        }
        
        console.error(`[PROXY] Fetch failed: ${response.status} ${response.statusText} for ${fetchUrl}`);
        console.error(`[PROXY] Error details: ${errorText.substring(0, 500)}`);
        console.error(`[PROXY] Response headers:`, Object.fromEntries(response.headers.entries()));
        
        // Return the actual status code from Dropbox, not 500
        return new Response(`Failed to fetch from Dropbox: ${response.status} ${response.statusText}\n${errorText.substring(0, 200)}`, {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain',
          },
        });
      }

      // Get the content type from the response
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      // Get the content
      const content = await response.arrayBuffer();
      
      console.log(`[PROXY] Success: ${content.byteLength} bytes, type: ${contentType}`);

      // Return with CORS headers
      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[PROXY] Timeout fetching ${targetUrl} (30s)`);
        return new Response('Request timeout', {
          status: 504,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain',
          },
        });
      }
      
      // Log network errors in detail
      if (fetchError instanceof Error) {
        console.error(`[PROXY] Network error fetching ${targetUrl}:`, fetchError.name, fetchError.message);
        console.error(`[PROXY] Error stack:`, fetchError.stack);
      } else {
        console.error(`[PROXY] Unknown error type:`, fetchError);
      }
      
      throw fetchError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error(`[PROXY] Unexpected error fetching ${targetUrl}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[PROXY] Error type: ${errorName}`);
    console.error(`[PROXY] Error stack:`, error instanceof Error ? error.stack : 'No stack');
    
    // Provide more specific error messages
    let statusCode = 500;
    let errorMsg = `Proxy error: ${errorMessage}`;
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      statusCode = 502; // Bad Gateway
      errorMsg = 'Network error: Could not connect to Dropbox';
    } else if (error instanceof Error && error.name === 'AbortError') {
      statusCode = 504; // Gateway Timeout
      errorMsg = 'Request timeout';
    }
    
    return new Response(errorMsg, {
      status: statusCode,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
      },
    });
  }
};

