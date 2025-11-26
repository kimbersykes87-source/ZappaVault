import type { EnvBindings } from '../utils/library.ts';

export const onRequestGet = async (context: {
  request: Request;
  env: EnvBindings;
}) => {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Get the target URL from query parameter
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('Missing url parameter', { 
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Validate that the URL is from Dropbox (security measure)
  if (!targetUrl.includes('dropbox.com') && !targetUrl.includes('dropboxusercontent.com')) {
    console.error(`[PROXY] Invalid URL: ${targetUrl}`);
    return new Response('Invalid URL: must be from Dropbox', {
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    console.log(`[PROXY] Fetching: ${targetUrl}`);
    
    // Fetch the content from Dropbox with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(targetUrl, {
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
        
        console.error(`[PROXY] Fetch failed: ${response.status} ${response.statusText} for ${targetUrl}`);
        console.error(`[PROXY] Error details: ${errorText.substring(0, 500)}`);
        console.error(`[PROXY] Response headers:`, Object.fromEntries(response.headers.entries()));
        
        // Return the actual status code from Dropbox, not 500
        return new Response(`Failed to fetch from Dropbox: ${response.status} ${response.statusText}\n${errorText.substring(0, 200)}`, {
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
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
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
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
            'Access-Control-Allow-Origin': '*',
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
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain',
      },
    });
  }
};

