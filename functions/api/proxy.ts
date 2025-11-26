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
    
    // Fetch the content from Dropbox
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ZappaVault/1.0)',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[PROXY] Fetch failed: ${response.status} ${response.statusText} for ${targetUrl}`);
      console.error(`[PROXY] Error details: ${errorText.substring(0, 200)}`);
      return new Response(`Failed to fetch: ${response.status} ${response.statusText}`, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
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
  } catch (error) {
    console.error(`[PROXY] Error fetching ${targetUrl}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[PROXY] Error stack:`, error instanceof Error ? error.stack : 'No stack');
    return new Response(`Proxy error: ${errorMessage}`, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain',
      },
    });
  }
};

