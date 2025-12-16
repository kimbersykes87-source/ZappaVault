/**
 * Analytics API endpoint
 * Tracks page views with city, device, and dwell time
 * Stores data in Cloudflare KV
 */

import type { EnvBindings } from '../_middleware.ts';

interface AnalyticsEvent {
  timestamp: number;
  path: string;
  city?: string;
  country?: string;
  region?: string;
  device: string;
  browser: string;
  os: string;
  dwellTime?: number; // in milliseconds
  referrer?: string;
}

interface DeviceInfo {
  device: string;
  browser: string;
  os: string;
}

function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  
  // Detect device type
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }
  
  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
  }
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }
  
  return { device, browser, os };
}

export const onRequestPost: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;
  
  try {
    const body: Partial<AnalyticsEvent> = await request.json();
    
    // Get geolocation from Cloudflare Workers (available in request.cf)
    const cf = (request as any).cf;
    const city = cf?.city || body.city || 'Unknown';
    const country = cf?.country || body.country || 'Unknown';
    const region = cf?.region || body.region || 'Unknown';
    
    // Parse user agent
    const userAgent = request.headers.get('user-agent') || '';
    const deviceInfo = parseUserAgent(userAgent);
    
    // Create analytics event
    const event: AnalyticsEvent = {
      timestamp: body.timestamp || Date.now(),
      path: body.path || '/',
      city,
      country,
      region,
      device: body.device || deviceInfo.device,
      browser: body.browser || deviceInfo.browser,
      os: body.os || deviceInfo.os,
      dwellTime: body.dwellTime,
      referrer: body.referrer || request.headers.get('referer') || undefined,
    };
    
    // Store in KV with date-based key for easy querying
    const date = new Date(event.timestamp);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const hourKey = `${dateKey}-${date.getUTCHours()}`;
    
    // Store individual event
    const eventKey = `analytics:event:${event.timestamp}:${Math.random().toString(36).substr(2, 9)}`;
    await env.LIBRARY_KV.put(eventKey, JSON.stringify(event), {
      expirationTtl: 60 * 60 * 24 * 90, // 90 days retention
    });
    
    // Aggregate daily stats
    const dailyKey = `analytics:daily:${dateKey}`;
    const dailyData = await env.LIBRARY_KV.get(dailyKey, 'json') || {
      date: dateKey,
      pageViews: 0,
      uniquePaths: new Set<string>(),
      cities: {} as Record<string, number>,
      devices: {} as Record<string, number>,
      browsers: {} as Record<string, number>,
      os: {} as Record<string, number>,
      totalDwellTime: 0,
      sessions: 0,
    };
    
    // Update aggregates
    dailyData.pageViews = (dailyData.pageViews || 0) + 1;
    if (!dailyData.uniquePaths) dailyData.uniquePaths = new Set<string>();
    dailyData.uniquePaths.add(event.path);
    
    // Count cities
    if (!dailyData.cities) dailyData.cities = {};
    dailyData.cities[city] = (dailyData.cities[city] || 0) + 1;
    
    // Count devices
    if (!dailyData.devices) dailyData.devices = {};
    dailyData.devices[event.device] = (dailyData.devices[event.device] || 0) + 1;
    
    // Count browsers
    if (!dailyData.browsers) dailyData.browsers = {};
    dailyData.browsers[event.browser] = (dailyData.browsers[event.browser] || 0) + 1;
    
    // Count OS
    if (!dailyData.os) dailyData.os = {};
    dailyData.os[event.os] = (dailyData.os[event.os] || 0) + 1;
    
    // Track dwell time
    if (event.dwellTime) {
      dailyData.totalDwellTime = (dailyData.totalDwellTime || 0) + event.dwellTime;
      dailyData.sessions = (dailyData.sessions || 0) + 1;
    }
    
    // Convert Set to Array for JSON storage
    const dailyDataForStorage = {
      ...dailyData,
      uniquePaths: Array.from(dailyData.uniquePaths),
    };
    
    await env.LIBRARY_KV.put(dailyKey, JSON.stringify(dailyDataForStorage), {
      expirationTtl: 60 * 60 * 24 * 365, // 1 year retention
    });
    
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to record analytics' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
};

// GET endpoint to retrieve analytics data
export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '7', 10);
  
  try {
    const today = new Date();
    const analytics: any[] = [];
    
    // Fetch last N days of data
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dailyKey = `analytics:daily:${dateKey}`;
      
      const dailyData = await env.LIBRARY_KV.get(dailyKey, 'json');
      if (dailyData) {
        // Calculate average dwell time
        const avgDwellTime = dailyData.sessions > 0
          ? Math.round(dailyData.totalDwellTime / dailyData.sessions / 1000) // Convert to seconds
          : 0;
        
        analytics.push({
          date: dateKey,
          pageViews: dailyData.pageViews || 0,
          uniquePaths: (dailyData.uniquePaths || []).length,
          cities: dailyData.cities || {},
          devices: dailyData.devices || {},
          browsers: dailyData.browsers || {},
          os: dailyData.os || {},
          avgDwellTimeSeconds: avgDwellTime,
          totalSessions: dailyData.sessions || 0,
        });
      }
    }
    
    return new Response(JSON.stringify(analytics.reverse()), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Analytics retrieval error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve analytics' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
};
