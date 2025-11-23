import { test, expect } from '@playwright/test';

test.describe('ZappaVault Webapp', () => {
  test('home page loads and displays title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Extended Discography');
  });

  test('library page displays content', async ({ page }) => {
    await page.goto('/');
    // Wait for content to load (either albums, loading, or error state)
    await page.waitForTimeout(2000);
    const hasContent = await page.locator('main').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('search bar is present', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test('player bar is present', async ({ page }) => {
    await page.goto('/');
    const playerBar = page.locator('[class*="player"], [class*="Player"]');
    await expect(playerBar.first()).toBeVisible({ timeout: 5000 });
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Try to navigate to an album if one exists
    const albumLink = page.locator('a[href*="/album/"]').first();
    const count = await albumLink.count();
    
    if (count > 0) {
      await albumLink.click();
      await expect(page).toHaveURL(/\/album\//);
    }
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });
});

