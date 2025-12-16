/**
 * Analytics hook to track page views and dwell time
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface AnalyticsEvent {
  path: string;
  timestamp: number;
  dwellTime?: number;
  referrer?: string;
}

export function useAnalytics() {
  const location = useLocation();
  const pageLoadTime = useRef<number>(Date.now());
  const lastPath = useRef<string>(location.pathname);
  const sessionStartTime = useRef<number>(Date.now());

  useEffect(() => {
    const currentPath = location.pathname;
    const now = Date.now();

    // If path changed, record dwell time for previous page
    if (lastPath.current !== currentPath && lastPath.current !== '') {
      const dwellTime = now - pageLoadTime.current;
      
      // Only record if user spent at least 1 second on the page
      if (dwellTime > 1000) {
        trackEvent({
          path: lastPath.current,
          timestamp: pageLoadTime.current,
          dwellTime,
          referrer: document.referrer || undefined,
        });
      }
    }

    // Track new page view
    trackEvent({
      path: currentPath,
      timestamp: now,
      referrer: lastPath.current !== currentPath ? document.referrer || undefined : undefined,
    });

    // Update refs
    lastPath.current = currentPath;
    pageLoadTime.current = now;

    // Track session end on page unload
    const handleBeforeUnload = () => {
      const totalDwellTime = Date.now() - sessionStartTime.current;
      if (totalDwellTime > 1000) {
        // Use sendBeacon for reliable tracking on page unload
        const event: AnalyticsEvent = {
          path: currentPath,
          timestamp: pageLoadTime.current,
          dwellTime: totalDwellTime,
        };
        
        const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics', blob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Record final dwell time when component unmounts
      const finalDwellTime = Date.now() - pageLoadTime.current;
      if (finalDwellTime > 1000) {
        trackEvent({
          path: currentPath,
          timestamp: pageLoadTime.current,
          dwellTime: finalDwellTime,
        });
      }
    };
  }, [location.pathname]);
}

async function trackEvent(event: AnalyticsEvent) {
  try {
    // Use fetch with keepalive for better reliability
    await fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
      keepalive: true, // Ensures request completes even if page unloads
    });
  } catch (error) {
    // Silently fail - analytics shouldn't break the app
    console.debug('Analytics tracking failed:', error);
  }
}
