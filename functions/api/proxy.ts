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
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    // Fetch the content from Dropbox
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      return new Response(`Failed to fetch: ${response.status} ${response.statusText}`, {
        status: response.status,
      });
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Get the content
    const content = await response.arrayBuffer();

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
    console.error('Proxy error:', error);
    return new Response(`Proxy error: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
    });
  }
};

