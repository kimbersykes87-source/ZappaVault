import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

/**
 * Debug script to view errors and troubleshoot the webapp
 * Usage: tsx scripts/debug.ts [url]
 */
async function debugWebapp(url: string = 'http://localhost:5173') {
  console.log(`Launching Chromium to debug: ${url}`);
  
  const browser: Browser = await chromium.launch({
    headless: false, // Show the browser window
    slowMo: 100, // Slow down operations for easier debugging
  });

  const page: Page = await browser.newPage();

  // Capture console messages
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    
    console.log(`[CONSOLE ${type.toUpperCase()}] ${text}`);
    if (location.url) {
      console.log(`  Location: ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.error(`[PAGE ERROR] ${error.message}`);
    if (error.stack) {
      console.error(`  Stack: ${error.stack}`);
    }
  });

  // Capture request failures
  page.on('requestfailed', (request) => {
    console.error(`[REQUEST FAILED] ${request.method()} ${request.url()}`);
    const failure = request.failure();
    if (failure) {
      console.error(`  Error: ${failure.errorText}`);
    }
  });

  // Capture response errors (4xx, 5xx)
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      console.error(`[HTTP ERROR] ${response.status()} ${response.statusText()} - ${response.url()}`);
    }
  });

  try {
    console.log('Navigating to page...');
    await page.goto(url, { waitUntil: 'networkidle' });
    
    console.log('\n✅ Page loaded successfully!');
    console.log('📊 Page title:', await page.title());
    
    // Wait a bit to capture any delayed errors
    console.log('\nWaiting 5 seconds to capture any delayed errors...');
    await page.waitForTimeout(5000);
    
    // Check for React errors in the DOM
    const reactErrors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('[data-react-error]');
      return Array.from(errorElements).map(el => ({
        text: el.textContent,
        html: el.innerHTML
      }));
    });
    
    if (reactErrors.length > 0) {
      console.warn('\n⚠️ Found React error elements in DOM:');
      reactErrors.forEach((error, i) => {
        console.warn(`  Error ${i + 1}:`, error.text);
      });
    }
    
    console.log('\n✅ Debugging complete. Browser will stay open for 30 seconds...');
    console.log('Press Ctrl+C to close early.');
    
    // Keep browser open for manual inspection
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('\n❌ Error during debugging:');
    console.error(error);
  } finally {
    await browser.close();
    console.log('\n🔒 Browser closed.');
  }
}

// Get URL from command line args or use default
const url = process.argv[2] || 'http://localhost:5173';
debugWebapp(url).catch(console.error);

