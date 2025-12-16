import { useEffect, useState } from 'react';
import './AnalyticsPage.css';

interface AnalyticsSummary {
  totalPageViews: number;
  totalSessions: number;
  avgDwellTimeSeconds: number;
  daysAnalyzed: number;
}

interface TopItem {
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  count: number;
}

interface DailyData {
  date: string;
  pageViews: number;
  uniquePaths: number;
  avgDwellTimeSeconds: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  topCities: TopItem[];
  topDevices: TopItem[];
  topBrowsers: TopItem[];
  topOS: TopItem[];
  dailyData: DailyData[];
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/analytics-viewer?days=${days}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const analyticsData = await response.json();
        setData(analyticsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [days]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-loading">
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="analytics-error">
          <p>Error loading analytics: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="analytics-page">
        <div className="analytics-empty">
          <p>No analytics data available yet.</p>
          <p className="analytics-empty-hint">
            Analytics will appear here once users start visiting your site.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <h1>Analytics Dashboard</h1>
        <div className="analytics-controls">
          <label>
            Time Period:
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="analytics-days-select"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>
      </header>

      <section className="analytics-summary">
        <div className="summary-card">
          <h2>Total Page Views</h2>
          <p className="summary-value">{formatNumber(data.summary.totalPageViews)}</p>
        </div>
        <div className="summary-card">
          <h2>Total Sessions</h2>
          <p className="summary-value">{formatNumber(data.summary.totalSessions)}</p>
        </div>
        <div className="summary-card">
          <h2>Avg. Dwell Time</h2>
          <p className="summary-value">{formatTime(data.summary.avgDwellTimeSeconds)}</p>
        </div>
        <div className="summary-card">
          <h2>Days Analyzed</h2>
          <p className="summary-value">{data.summary.daysAnalyzed}</p>
        </div>
      </section>

      <section className="analytics-section">
        <h2>Top Cities</h2>
        {data.topCities.length > 0 ? (
          <div className="analytics-list">
            {data.topCities.map((item, index) => (
              <div key={item.city || index} className="analytics-item">
                <span className="analytics-item-label">{item.city || 'Unknown'}</span>
                <div className="analytics-item-bar">
                  <div
                    className="analytics-item-fill"
                    style={{
                      width: `${(item.count / data.topCities[0].count) * 100}%`,
                    }}
                  />
                </div>
                <span className="analytics-item-value">{formatNumber(item.count)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics-empty-state">No city data available</p>
        )}
      </section>

      <section className="analytics-section">
        <h2>Top Devices</h2>
        {data.topDevices.length > 0 ? (
          <div className="analytics-list">
            {data.topDevices.map((item, index) => (
              <div key={item.device || index} className="analytics-item">
                <span className="analytics-item-label">{item.device || 'Unknown'}</span>
                <div className="analytics-item-bar">
                  <div
                    className="analytics-item-fill"
                    style={{
                      width: `${(item.count / data.topDevices[0].count) * 100}%`,
                    }}
                  />
                </div>
                <span className="analytics-item-value">{formatNumber(item.count)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics-empty-state">No device data available</p>
        )}
      </section>

      <section className="analytics-section">
        <h2>Top Browsers</h2>
        {data.topBrowsers.length > 0 ? (
          <div className="analytics-list">
            {data.topBrowsers.map((item, index) => (
              <div key={item.browser || index} className="analytics-item">
                <span className="analytics-item-label">{item.browser || 'Unknown'}</span>
                <div className="analytics-item-bar">
                  <div
                    className="analytics-item-fill"
                    style={{
                      width: `${(item.count / data.topBrowsers[0].count) * 100}%`,
                    }}
                  />
                </div>
                <span className="analytics-item-value">{formatNumber(item.count)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics-empty-state">No browser data available</p>
        )}
      </section>

      <section className="analytics-section">
        <h2>Top Operating Systems</h2>
        {data.topOS.length > 0 ? (
          <div className="analytics-list">
            {data.topOS.map((item, index) => (
              <div key={item.os || index} className="analytics-item">
                <span className="analytics-item-label">{item.os || 'Unknown'}</span>
                <div className="analytics-item-bar">
                  <div
                    className="analytics-item-fill"
                    style={{
                      width: `${(item.count / data.topOS[0].count) * 100}%`,
                    }}
                  />
                </div>
                <span className="analytics-item-value">{formatNumber(item.count)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics-empty-state">No OS data available</p>
        )}
      </section>

      <section className="analytics-section">
        <h2>Daily Breakdown</h2>
        {data.dailyData.length > 0 ? (
          <div className="analytics-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Page Views</th>
                  <th>Unique Paths</th>
                  <th>Avg. Dwell Time</th>
                </tr>
              </thead>
              <tbody>
                {data.dailyData.map((day) => (
                  <tr key={day.date}>
                    <td>{new Date(day.date).toLocaleDateString()}</td>
                    <td>{formatNumber(day.pageViews)}</td>
                    <td>{day.uniquePaths}</td>
                    <td>{formatTime(day.avgDwellTimeSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="analytics-empty-state">No daily data available</p>
        )}
      </section>
    </div>
  );
}
