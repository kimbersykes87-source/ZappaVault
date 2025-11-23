import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Screenshot utility for capturing page states
 * Usage: tsx scripts/screenshot.ts [url] [output-dir]
 */
async function takeScreenshots(
  url: string = 'http://localhost:5173',
  outputDir: string = 'screenshots'
) {
  console.log(`📸 Taking screenshots of: ${url}`);
  console.log(`📁 Output directory: ${outputDir}\n`);

  const browser: Browser = await chromium.launch({
    headless: true, // Faster for screenshots
  });

  const page: Page = await browser.newPage();

  // Create output directory
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshots: Array<{ name: string; path: string }> = [];

  async function capture(name: string, options?: { waitFor?: string; delay?: number }) {
    if (options?.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 5000 }).catch(() => {});
    }
    if (options?.delay) {
      await page.waitForTimeout(options.delay);
    }
    
    const filename = `${name}-${timestamp}.png`;
    const filepath = join(outputDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    screenshots.push({ name, path: filepath });
    console.log(`✅ Captured: ${name}`);
  }

  try {
    // Home page
    await page.goto(url, { waitUntil: 'networkidle' });
    await capture('home-page', { delay: 1000 });

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload({ waitUntil: 'networkidle' });
    await capture('home-mobile', { delay: 1000 });

    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload({ waitUntil: 'networkidle' });
    await capture('home-tablet', { delay: 1000 });

    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload({ waitUntil: 'networkidle' });
    await capture('home-desktop', { delay: 1000 });

    // Try to capture album page if albums exist
    const albumLink = page.locator('a[href*="/album/"]').first();
    if (await albumLink.count() > 0) {
      await albumLink.click();
      await page.waitForURL(/\/album\//, { timeout: 5000 });
      await page.waitForTimeout(1000);
      await capture('album-page', { delay: 1000 });
    }

    // Capture with search
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('zappa');
      await page.waitForTimeout(2000);
      await capture('search-results', { delay: 500 });
    }

  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }

  // Generate report
  const report = {
    url,
    timestamp: new Date().toISOString(),
    screenshots,
  };

  const reportPath = join(outputDir, `screenshot-report-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📊 Screenshot report saved to: ${reportPath}`);
  console.log(`\n✅ Captured ${screenshots.length} screenshots`);
}

const url = process.argv[2] || 'http://localhost:5173';
const outputDir = process.argv[3] || 'screenshots';
takeScreenshots(url, outputDir).catch(console.error);

