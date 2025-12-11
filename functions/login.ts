/**
 * Login endpoint for password authentication
 * Handles both GET (show login page) and POST (process login)
 */

import { createAuthResponse, getLoginPageResponse } from './utils/auth.ts';
import type { AuthEnv } from './utils/auth.ts';

export interface EnvBindings extends AuthEnv {
  SITE_PASSWORD?: string;
}

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  return getLoginPageResponse();
};

export const onRequestPost: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;
  
  // Get password from form data
  const formData = await request.formData();
  const password = formData.get('password') as string | null;
  
  if (!password) {
    return new Response('Password required', { status: 400 });
  }
  
  // Get redirect URL if provided
  const url = new URL(request.url);
  const redirectUrl = url.searchParams.get('redirect') || '/';
  
  // Create auth response (sets cookie and redirects)
  return createAuthResponse(password, env, redirectUrl);
};

