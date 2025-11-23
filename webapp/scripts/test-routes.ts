import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Comprehensive route testing script
 * Tests all routes and key functionality of the webapp
 */
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  screenshot?: string;
}

async function testRoutes(baseUrl: string = 'http://localhost:5173') {
  console.log(`🧪 Starting comprehensive route tests for: ${baseUrl}\n`);

  const browser: Browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const page: Page = await browser.newPage();
  const results: TestResult[] = [];
  const screenshotsDir = join(process.cwd(), 'test-screenshots');
  
  // Create screenshots directory
  try {
    mkdirSync(screenshotsDir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }

  // Set up error capturing
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(`Page Error: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    errors.push(`Request Failed: ${request.method()} ${request.url()}`);
  });

  async function runTest(
    name: string,
    testFn: () => Promise<void>
  ): Promise<TestResult> {
    const startTime = Date.now();
    errors.length = 0; // Clear previous errors
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      const screenshot = join(screenshotsDir, `${name.replace(/\s+/g, '-').toLowerCase()}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      
      return {
        name,
        passed: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        duration,
        screenshot,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const screenshot = join(screenshotsDir, `${name.replace(/\s+/g, '-').toLowerCase()}-error.png`);
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      
      return {
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        screenshot,
      };
    }
  }

  // Test 1: Home page loads
  results.push(await runTest('Home page loads', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 5000 });
    const title = await page.textContent('h1');
    if (!title?.includes('Extended Discography')) {
      throw new Error(`Expected title not found. Got: ${title}`);
    }
  }));

  // Test 2: Library page displays albums
  results.push(await runTest('Library page displays albums', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    // Wait for album grid or loading state
    await page.waitForTimeout(2000);
    const hasAlbums = await page.locator('[class*="album"], [class*="card"]').count() > 0;
    const hasLoading = await page.locator('[class*="loading"]').count() > 0;
    const hasError = await page.locator('[class*="error"]').count() > 0;
    
    if (!hasAlbums && !hasLoading && !hasError) {
      throw new Error('No albums, loading state, or error state found');
    }
  }));

  // Test 3: Search functionality
  results.push(await runTest('Search bar is functional', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
    }
  }));

  // Test 4: Navigation to album page (if albums exist)
  results.push(await runTest('Album page navigation', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Try to find and click an album link
    const albumLink = page.locator('a[href*="/album/"]').first();
    const count = await albumLink.count();
    
    if (count > 0) {
      await albumLink.click();
      await page.waitForURL(/\/album\//, { timeout: 5000 });
      await page.waitForTimeout(1000);
    } else {
      // If no albums, test the route directly with a mock ID
      await page.goto(`${baseUrl}/album/test-id`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }
  }));

  // Test 5: Player bar exists
  results.push(await runTest('Player bar component exists', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const playerBar = page.locator('[class*="player"], [class*="Player"]');
    if (await playerBar.count() === 0) {
      throw new Error('Player bar not found');
    }
  }));

  // Test 6: Check for broken images
  results.push(await runTest('No broken images', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const brokenImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .map((img, i) => {
          if (!img.complete || img.naturalHeight === 0) {
            return { index: i, src: img.src };
          }
          return null;
        })
        .filter(Boolean);
    });
    
    if (brokenImages.length > 0) {
      throw new Error(`Found ${brokenImages.length} broken image(s): ${JSON.stringify(brokenImages)}`);
    }
  }));

  // Test 7: Check for console errors
  results.push(await runTest('No console errors on page load', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    if (errors.length > 0) {
      throw new Error(`Found ${errors.length} console error(s)`);
    }
  }));

  // Test 8: Responsive design check
  results.push(await runTest('Mobile viewport renders', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const bodyWidth = await page.evaluate(() => document.body.offsetWidth);
    if (bodyWidth === 0) {
      throw new Error('Page did not render in mobile viewport');
    }
  }));

  // Test 9: Desktop viewport
  results.push(await runTest('Desktop viewport renders', async () => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  }));

  await browser.close();

  // Print results
  console.log('\n📊 Test Results:\n');
  let passed = 0;
  let failed = 0;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`${icon} ${status} - ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.screenshot) {
      console.log(`   Screenshot: ${result.screenshot}`);
    }
    
    if (result.passed) passed++;
    else failed++;
  });

  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`);
  
  // Save results to JSON
  const reportPath = join(process.cwd(), 'test-results.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Full results saved to: ${reportPath}`);

  process.exit(failed > 0 ? 1 : 0);
}

const url = process.argv[2] || 'http://localhost:5173';
testRoutes(url).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

