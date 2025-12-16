# How to View Analytics - Complete Walkthrough

## 🎯 Quick Start: View Analytics Online

The easiest way to view your analytics is through the built-in dashboard on your website.

### Step 1: Visit Your Analytics Dashboard

1. Go to your website: **https://zappavault.pages.dev**
2. Log in with your site password (if required)
3. Navigate to: **https://zappavault.pages.dev/analytics**

That's it! You'll see a beautiful dashboard with all your analytics data.

---

## 📊 What You'll See on the Dashboard

The analytics dashboard shows:

### Summary Cards (Top Section)
- **Total Page Views** - Total number of page views in the selected period
- **Total Sessions** - Number of user sessions tracked
- **Avg. Dwell Time** - Average time users spend on pages
- **Days Analyzed** - Number of days in the current view

### Top Cities
A bar chart showing which cities your visitors are from, sorted by most visits.

### Top Devices
Breakdown of device types:
- Desktop
- Mobile
- Tablet

### Top Browsers
Which browsers your visitors use:
- Chrome
- Safari
- Firefox
- Edge
- Opera
- etc.

### Top Operating Systems
OS breakdown:
- Windows
- macOS
- Linux
- iOS
- Android

### Daily Breakdown Table
A detailed table showing day-by-day statistics:
- Date
- Page Views per day
- Unique Paths visited
- Average Dwell Time per day

### Time Period Selector
Use the dropdown at the top to view different time periods:
- Last 7 days
- Last 14 days
- Last 30 days
- Last 60 days
- Last 90 days

---

## 🔧 Alternative Methods to View Analytics

### Method 1: Direct API Access (Browser)

1. **Open your browser** and go to:
   ```
   https://zappavault.pages.dev/api/analytics-viewer?days=30
   ```

2. You'll see raw JSON data. Most browsers will format it nicely.

3. **To view different time periods**, change the `days` parameter:
   - `?days=7` - Last 7 days
   - `?days=14` - Last 14 days
   - `?days=60` - Last 60 days
   - `?days=90` - Last 90 days

**Note:** You must be logged in (authenticated) to access this endpoint.

### Method 2: Using cURL (Command Line)

If you prefer command line:

```bash
# Get last 30 days of analytics
curl https://zappavault.pages.dev/api/analytics-viewer?days=30

# Get last 7 days
curl https://zappavault.pages.dev/api/analytics-viewer?days=7
```

**Note:** If your site requires authentication, you'll need to include cookies or authentication headers.

### Method 3: Using Browser Developer Tools

1. **Open your website** in your browser
2. **Open Developer Tools** (F12 or Right-click → Inspect)
3. Go to the **Console** tab
4. **Run this JavaScript:**
   ```javascript
   fetch('/api/analytics-viewer?days=30')
     .then(res => res.json())
     .then(data => console.table(data.summary));
   ```

This will show a formatted table in the console.

### Method 4: Create a Custom Script

You can create a simple HTML file to view analytics:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Analytics Viewer</title>
</head>
<body>
  <h1>Analytics Data</h1>
  <pre id="data"></pre>
  <script>
    fetch('https://zappavault.pages.dev/api/analytics-viewer?days=30')
      .then(res => res.json())
      .then(data => {
        document.getElementById('data').textContent = JSON.stringify(data, null, 2);
      });
  </script>
</body>
</html>
```

---

## 📱 Mobile Access

The analytics dashboard is fully responsive and works on mobile devices:

1. Open your mobile browser
2. Go to: **https://zappavault.pages.dev/analytics**
3. Log in if required
4. View your analytics on the go!

---

## 🔍 Understanding the Data

### City Data
- **Accuracy:** City-level data comes from Cloudflare's geolocation service
- **Limitations:** May show "Unknown" if:
  - User is using a VPN
  - User is using a proxy
  - Cloudflare can't determine location
- **Privacy:** Only city-level, not exact addresses

### Device Detection
- Based on User-Agent header analysis
- Categories: Desktop, Mobile, Tablet
- May not be 100% accurate for all devices

### Dwell Time
- **Minimum:** Only tracks if user spends >1 second on page
- **Calculation:** Time from page load to page unload/change
- **Average:** Calculated as total dwell time ÷ number of sessions

### Page Views
- Counted each time a page is loaded
- Includes all routes (homepage, album pages, etc.)

---

## 🚨 Troubleshooting

### "No analytics data available yet"
**Solution:** 
- Analytics only appear after users visit your site
- Wait a few hours after deployment for data to accumulate
- Make sure you've visited the site yourself to generate initial data

### "Error loading analytics"
**Possible causes:**
- Not logged in (authentication required)
- Cloudflare Functions error
- KV storage issue

**Solutions:**
1. Make sure you're logged in to the site
2. Check Cloudflare Functions logs in dashboard
3. Try refreshing the page
4. Check that KV namespace is properly configured

### City shows as "Unknown"
**This is normal if:**
- User is using VPN/proxy
- Cloudflare can't determine location
- Some requests don't include geolocation data

### Dashboard is blank
**Check:**
1. Are you logged in? (Required for `/analytics` route)
2. Has anyone visited the site yet? (Need data to display)
3. Check browser console for errors (F12 → Console)

---

## 📈 Tips for Best Results

1. **Wait for data:** Analytics need time to accumulate. Check back after a few days.

2. **Regular checks:** View analytics weekly or monthly to track trends.

3. **Compare periods:** Use different day ranges to see growth over time.

4. **Share access:** Family members can view analytics by visiting `/analytics` (if logged in).

5. **Export data:** You can copy JSON data from the API endpoint for external analysis.

---

## 🔐 Security Notes

- Analytics dashboard is **protected by authentication** (same as rest of site)
- Only logged-in users can view analytics
- Data is stored in your Cloudflare KV (private to your account)
- No third-party services involved

---

## 📞 Need Help?

If you encounter issues:

1. **Check Cloudflare Dashboard:**
   - Go to Cloudflare Dashboard → Pages → Your Site → Functions
   - Check logs for errors

2. **Verify KV Namespace:**
   - Ensure `LIBRARY_KV` is bound in `wrangler.toml`
   - Check KV namespace exists in Cloudflare

3. **Test API Directly:**
   - Try accessing `/api/analytics-viewer?days=7` directly
   - Check if it returns data or errors

4. **Check Authentication:**
   - Make sure you're logged in
   - Verify `SITE_PASSWORD` is set in Cloudflare Pages environment variables

---

## 🎉 You're All Set!

Your analytics are now live and tracking. Visit **https://zappavault.pages.dev/analytics** to see your data!

The dashboard will automatically update as more visitors use your site. Check back regularly to see trends and insights.
