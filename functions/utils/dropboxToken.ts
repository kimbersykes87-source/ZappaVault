/**
 * Dropbox token refresh utilities for Cloudflare Functions
 */

export interface DropboxTokenEnv {
  DROPBOX_TOKEN?: string;
  DROPBOX_REFRESH_TOKEN?: string;
  DROPBOX_APP_KEY?: string;
  DROPBOX_APP_SECRET?: string;
}

/**
 * Refresh a Dropbox access token using a refresh token
 */
export async function refreshDropboxToken(
  refreshToken: string,
  appKey: string,
  appSecret: string,
): Promise<string> {
  const credentials = btoa(`${appKey}:${appSecret}`);
  
  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * Get a valid Dropbox access token, refreshing if necessary
 * This function will use the existing token if available, or refresh if needed
 */
export async function getValidDropboxToken(env: DropboxTokenEnv): Promise<string | undefined> {
  // If we have a token, use it (but it might be expired, we'll handle that in the request)
  if (env.DROPBOX_TOKEN) {
    return env.DROPBOX_TOKEN;
  }
  
  // Otherwise, try to refresh
  if (env.DROPBOX_REFRESH_TOKEN && env.DROPBOX_APP_KEY && env.DROPBOX_APP_SECRET) {
    try {
      return await refreshDropboxToken(
        env.DROPBOX_REFRESH_TOKEN,
        env.DROPBOX_APP_KEY,
        env.DROPBOX_APP_SECRET,
      );
    } catch (error) {
      console.error('[TOKEN] Failed to refresh token:', error);
      return undefined;
    }
  }
  
  return undefined;
}

/**
 * Make a Dropbox API request with automatic token refresh on expiration
 */
export async function dropboxRequestWithRefresh<T>(
  endpoint: string,
  body: Record<string, unknown>,
  env: DropboxTokenEnv,
): Promise<T> {
  let token = await getValidDropboxToken(env);
  
  if (!token) {
    throw new Error('No Dropbox token available. Please configure refresh token credentials (DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET).');
  }

  let response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // If token expired, refresh and retry once
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      
      if (errorData.error?.['.tag'] === 'expired_access_token' && env.DROPBOX_REFRESH_TOKEN) {
        console.log('[TOKEN] Access token expired, refreshing...');
        try {
          token = await refreshDropboxToken(
            env.DROPBOX_REFRESH_TOKEN,
            env.DROPBOX_APP_KEY!,
            env.DROPBOX_APP_SECRET!,
          );
          console.log('[TOKEN] Successfully refreshed access token, retrying request...');
          
          // Retry the request with new token
          response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          
          if (response.ok) {
            return (await response.json()) as T;
          }
        } catch (refreshError) {
          console.error('[TOKEN] Failed to refresh token:', refreshError);
          throw new Error(`Token refresh failed: ${refreshError instanceof Error ? refreshError.message : refreshError}`);
        }
      }
    } catch {
      // If parsing fails, continue with original error
    }
    
    throw new Error(`Dropbox API error: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

