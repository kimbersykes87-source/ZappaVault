# Analytics Implementation

A free, privacy-focused analytics solution built using Cloudflare Workers and KV storage.

## Features

✅ **City-level location tracking** - Uses Cloudflare Workers geolocation (from `request.cf`)  
✅ **Device detection** - Tracks device type (Mobile/Tablet/Desktop), browser, and OS  
✅ **Dwell time tracking** - Measures time spent on each page  
✅ **100% Free** - Uses existing Cloudflare infrastructure (no additional costs)  
✅ **Privacy-focused** - No cookies, no third-party tracking, data stored in your KV

## How It Works

1. **Frontend Tracking** (`webapp/src/hooks/useAnalytics.ts`)
   - Automatically tracks page views on route changes
   - Calculates dwell time (time spent on each page)
   - Sends events to `/api/analytics` endpoint

2. **Backend Collection** (`functions/api/analytics.ts`)
   - Receives analytics events via POST
   - Extracts city from Cloudflare Workers geolocation (`request.cf.city`)
   - Parses device info from User-Agent header
   - Stores data in Cloudflare KV with daily aggregation

3. **Data Storage**
   - Individual events stored with 90-day retention
   - Daily aggregates stored with 1-year retention
   - Data organized by date for easy querying

## API Endpoints

### POST `/api/analytics`
Records an analytics event.

**Request Body:**
```json
{
  "path": "/album/123",
  "timestamp": 1704067200000,
  "dwellTime": 45000,
  "referrer": "https://example.com"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET `/api/analytics`
Retrieves raw analytics data for the last N days.

**Query Parameters:**
- `days` (optional) - Number of days to retrieve (default: 7)

**Response:**
```json
[
  {
    "date": "2025-01-15",
    "pageViews": 42,
    "uniquePaths": 8,
    "cities": { "New York": 15, "London": 10, "Tokyo": 5 },
    "devices": { "Desktop": 25, "Mobile": 15, "Tablet": 2 },
    "browsers": { "Chrome": 30, "Safari": 8, "Firefox": 4 },
    "os": { "Windows": 20, "macOS": 15, "iOS": 7 },
    "avgDwellTimeSeconds": 125,
    "totalSessions": 30
  }
]
```

### GET `/api/analytics-viewer`
Returns formatted analytics summary with top cities, devices, browsers, and OS.

**Query Parameters:**
- `days` (optional) - Number of days to analyze (default: 30)

**Response:**
```json
{
  "summary": {
    "totalPageViews": 1250,
    "totalSessions": 450,
    "avgDwellTimeSeconds": 180,
    "daysAnalyzed": 30
  },
  "topCities": [
    { "city": "New York", "count": 250 },
    { "city": "London", "count": 180 }
  ],
  "topDevices": [
    { "device": "Desktop", "count": 800 },
    { "device": "Mobile", "count": 400 }
  ],
  "topBrowsers": [
    { "browser": "Chrome", "count": 700 },
    { "browser": "Safari", "count": 300 }
  ],
  "topOS": [
    { "os": "Windows", "count": 600 },
    { "os": "macOS", "count": 400 }
  ],
  "dailyData": [...]
}
```

## Viewing Analytics

### Option 1: Use the API directly

```bash
# Get last 30 days of analytics
curl https://zappavault.pages.dev/api/analytics-viewer?days=30
```

### Option 2: Create a simple dashboard page

You can create a React component to display analytics:

```tsx
// webapp/src/pages/AnalyticsPage.tsx
import { useEffect, useState } from 'react';

export function AnalyticsPage() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch('/api/analytics-viewer?days=30')
      .then(res => res.json())
      .then(setData);
  }, []);
  
  if (!data) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Analytics</h1>
      <p>Total Page Views: {data.summary.totalPageViews}</p>
      <p>Average Dwell Time: {data.summary.avgDwellTimeSeconds}s</p>
      
      <h2>Top Cities</h2>
      <ul>
        {data.topCities.map(({ city, count }) => (
          <li key={city}>{city}: {count}</li>
        ))}
      </ul>
      
      <h2>Top Devices</h2>
      <ul>
        {data.topDevices.map(({ device, count }) => (
          <li key={device}>{device}: {count}</li>
        ))}
      </ul>
    </div>
  );
}
```

Then add the route in `App.tsx`:
```tsx
<Route path="/analytics" element={<AnalyticsPage />} />
```

## Data Retention

- **Individual events**: 90 days
- **Daily aggregates**: 1 year

## Privacy

- No cookies used
- No third-party tracking
- Data stored only in your Cloudflare KV
- City-level data from Cloudflare Workers (may vary with VPNs/proxies)
- No personal information collected

## Limitations

1. **City accuracy**: Cloudflare geolocation may not be 100% accurate (affected by VPNs, proxies)
2. **Dwell time**: Only tracked for pages where user spends >1 second
3. **Storage**: Uses existing KV namespace (same as library data)

## Cost

**Free** - Uses existing Cloudflare infrastructure:
- Cloudflare Workers (included in Pages)
- Cloudflare KV (already in use for library data)
- No additional services required

## Troubleshooting

### Analytics not recording
- Check Cloudflare Functions logs in dashboard
- Verify KV namespace is bound in `wrangler.toml`
- Ensure middleware allows `/api/analytics` endpoint

### City shows as "Unknown"
- Cloudflare Workers geolocation may not be available for all requests
- VPNs/proxies can affect location accuracy
- Check `request.cf` object in Functions logs

### Dwell time not accurate
- Dwell time is calculated from page load to page unload/change
- Minimum 1 second threshold to avoid noise
- Uses `beforeunload` event for final tracking
