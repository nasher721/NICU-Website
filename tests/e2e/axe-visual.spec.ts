import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility and Visual Gates', () => {
  test('Main Campus Home should pass a11y and visual regression', async ({ page }) => {
    await page.goto('/main-campus');
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // visual
    await expect(page).toHaveScreenshot('main-campus.png', { fullPage: true });
  });

  test('Akron General Home should pass a11y and visual regression', async ({ page }) => {
    await page.goto('/akron');
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // visual
    await expect(page).toHaveScreenshot('akron.png', { fullPage: true });
  });
});
