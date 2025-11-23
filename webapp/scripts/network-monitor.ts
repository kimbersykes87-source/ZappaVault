import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Network monitoring script to analyze API calls and performance
 * Usage: tsx scripts/network-monitor.ts [url]
 */
interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timing?: {
    startTime: number;
    responseTime: number;
    duration: number;
  };
  size?: number;
  type?: string;
}

async function monitorNetwork(url: string = 'http://localhost:5173') {
  console.log(`🌐 Monitoring network activity for: ${url}\n`);

  const browser: Browser = await chromium.launch({
    headless: false,
  });

  const page: Page = await browser.newPage();
  const requests: NetworkRequest[] = [];
  const responses: Map<string, NetworkRequest> = new Map();

  // Track requests
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    
    responses.set(request.url(), {
      url,
      method,
      status: 0,
      statusText: '',
      headers,
      timing: {
        startTime: Date.now(),
        responseTime: 0,
        duration: 0,
      },
    });
  });

  // Track responses
  page.on('response', async (response) => {
    const request = responses.get(response.url());
    if (request) {
      const timing = request.timing;
      if (timing) {
        timing.responseTime = Date.now();
        timing.duration = timing.responseTime - timing.startTime;
      }

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers())) {
        headers[key] = value;
      }

      const networkRequest: NetworkRequest = {
        url: response.url(),
        method: request.method,
        status: response.status(),
        statusText: response.statusText(),
        headers,
        timing,
        type: response.headers()['content-type'] || 'unknown',
      };

      // Try to get response size
      try {
        const body = await response.body();
        networkRequest.size = body.length;
      } catch (e) {
        // Some responses can't be read
      }

      requests.push(networkRequest);
      
      // Log in real-time
      const statusIcon = response.status() >= 400 ? '❌' : response.status() >= 300 ? '⚠️' : '✅';
      const duration = timing?.duration ? `${timing.duration}ms` : '?';
      console.log(`${statusIcon} ${response.status()} ${request.method} ${response.url()} (${duration})`);
    }
  });

  // Track failed requests
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    console.error(`❌ FAILED ${request.method()} ${request.url()}`);
    if (failure) {
      console.error(`   Error: ${failure.errorText}`);
    }
    
    requests.push({
      url: request.url(),
      method: request.method(),
      status: 0,
      statusText: 'FAILED',
      headers: request.headers(),
      type: 'failed',
    });
  });

  try {
    console.log('Navigating to page...\n');
    await page.goto(url, { waitUntil: 'networkidle' });
    
    console.log('\n⏳ Waiting 5 seconds for any delayed requests...\n');
    await page.waitForTimeout(5000);

    // Analyze results
    console.log('\n📊 Network Analysis:\n');
    
    const successful = requests.filter(r => r.status >= 200 && r.status < 300);
    const redirects = requests.filter(r => r.status >= 300 && r.status < 400);
    const clientErrors = requests.filter(r => r.status >= 400 && r.status < 500);
    const serverErrors = requests.filter(r => r.status >= 500);
    const failed = requests.filter(r => r.status === 0);

    console.log(`Total requests: ${requests.length}`);
    console.log(`✅ Successful (2xx): ${successful.length}`);
    console.log(`⚠️  Redirects (3xx): ${redirects.length}`);
    console.log(`❌ Client errors (4xx): ${clientErrors.length}`);
    console.log(`❌ Server errors (5xx): ${serverErrors.length}`);
    console.log(`💥 Failed: ${failed.length}`);

    // Performance stats
    const requestsWithTiming = requests.filter(r => r.timing && r.timing.duration > 0);
    if (requestsWithTiming.length > 0) {
      const durations = requestsWithTiming.map(r => r.timing!.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      console.log(`\n⏱️  Performance:`);
      console.log(`   Average response time: ${Math.round(avgDuration)}ms`);
      console.log(`   Fastest: ${minDuration}ms`);
      console.log(`   Slowest: ${maxDuration}ms`);
    }

    // Size stats
    const requestsWithSize = requests.filter(r => r.size !== undefined);
    if (requestsWithSize.length > 0) {
      const totalSize = requestsWithSize.reduce((sum, r) => sum + (r.size || 0), 0);
      const sizeInMB = (totalSize / 1024 / 1024).toFixed(2);
      console.log(`\n💾 Total data transferred: ${sizeInMB} MB`);
    }

    // API endpoints
    const apiRequests = requests.filter(r => 
      r.url.includes('/api/') || 
      r.url.includes('/functions/') ||
      r.type?.includes('json')
    );
    
    if (apiRequests.length > 0) {
      console.log(`\n🔌 API Requests (${apiRequests.length}):`);
      apiRequests.forEach(req => {
        const duration = req.timing?.duration ? `${req.timing.duration}ms` : '?';
        console.log(`   ${req.method} ${req.url} - ${req.status} (${duration})`);
      });
    }

    // Save detailed report
    const reportDir = join(process.cwd(), 'network-reports');
    try {
      mkdirSync(reportDir, { recursive: true });
    } catch (e) {}

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(reportDir, `network-report-${timestamp}.json`);
    
    const report = {
      url,
      timestamp: new Date().toISOString(),
      summary: {
        total: requests.length,
        successful: successful.length,
        redirects: redirects.length,
        clientErrors: clientErrors.length,
        serverErrors: serverErrors.length,
        failed: failed.length,
      },
      requests: requests.map(r => ({
        ...r,
        timing: r.timing ? {
          ...r.timing,
          startTime: new Date(r.timing.startTime).toISOString(),
        } : undefined,
      })),
    };

    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Full report saved to: ${reportPath}`);

    // Show errors if any
    if (clientErrors.length > 0 || serverErrors.length > 0 || failed.length > 0) {
      console.log(`\n⚠️  Issues found:`);
      [...clientErrors, ...serverErrors, ...failed].forEach(req => {
        console.log(`   ${req.method} ${req.url} - ${req.statusText}`);
      });
    }

    console.log('\n✅ Network monitoring complete. Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Error during network monitoring:', error);
  } finally {
    await browser.close();
  }
}

const url = process.argv[2] || 'http://localhost:5173';
monitorNetwork(url).catch(console.error);

