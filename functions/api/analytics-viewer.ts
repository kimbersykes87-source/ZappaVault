/**
 * Simple analytics viewer endpoint
 * Returns formatted analytics data for viewing
 * Protected by authentication (middleware)
 */

import type { EnvBindings } from '../_middleware.ts';

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  
  try {
    const today = new Date();
    const analytics: any[] = [];
    let totalPageViews = 0;
    const cityCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = {};
    const browserCounts: Record<string, number> = {};
    const osCounts: Record<string, number> = {};
    let totalDwellTime = 0;
    let totalSessions = 0;
    
    // Fetch last N days of data
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dailyKey = `analytics:daily:${dateKey}`;
      
      const dailyData = await env.LIBRARY_KV.get(dailyKey, 'json');
      if (dailyData) {
        totalPageViews += dailyData.pageViews || 0;
        totalSessions += dailyData.sessions || 0;
        totalDwellTime += dailyData.totalDwellTime || 0;
        
        // Aggregate cities
        Object.entries(dailyData.cities || {}).forEach(([city, count]) => {
          cityCounts[city] = (cityCounts[city] || 0) + (count as number);
        });
        
        // Aggregate devices
        Object.entries(dailyData.devices || {}).forEach(([device, count]) => {
          deviceCounts[device] = (deviceCounts[device] || 0) + (count as number);
        });
        
        // Aggregate browsers
        Object.entries(dailyData.browsers || {}).forEach(([browser, count]) => {
          browserCounts[browser] = (browserCounts[browser] || 0) + (count as number);
        });
        
        // Aggregate OS
        Object.entries(dailyData.os || {}).forEach(([os, count]) => {
          osCounts[os] = (osCounts[os] || 0) + (count as number);
        });
        
        const avgDwellTime = dailyData.sessions > 0
          ? Math.round(dailyData.totalDwellTime / dailyData.sessions / 1000)
          : 0;
        
        analytics.push({
          date: dateKey,
          pageViews: dailyData.pageViews || 0,
          uniquePaths: (dailyData.uniquePaths || []).length,
          avgDwellTimeSeconds: avgDwellTime,
        });
      }
    }
    
    // Calculate top cities, devices, browsers, OS
    const topCities = Object.entries(cityCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([city, count]) => ({ city, count }));
    
    const topDevices = Object.entries(deviceCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([device, count]) => ({ device, count }));
    
    const topBrowsers = Object.entries(browserCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([browser, count]) => ({ browser, count }));
    
    const topOS = Object.entries(osCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([os, count]) => ({ os, count }));
    
    const avgDwellTimeSeconds = totalSessions > 0
      ? Math.round(totalDwellTime / totalSessions / 1000)
      : 0;
    
    return new Response(
      JSON.stringify({
        summary: {
          totalPageViews,
          totalSessions,
          avgDwellTimeSeconds,
          daysAnalyzed: days,
        },
        topCities,
        topDevices,
        topBrowsers,
        topOS,
        dailyData: analytics.reverse(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Analytics viewer error:', error);
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
