import { expect, test } from '@playwright/test';

/**
 * Guard against testing the wrong application.
 *
 * Port 3000 was found serving an unrelated Next.js app, and `reuseExistingServer`
 * would have pointed this whole suite at it. Prove we are on Paper Majority before
 * asserting anything about Paper Majority.
 */
test('the suite is pointed at Paper Majority', async ({ page }) => {
  await page.goto('/?fixture=interaction-spike');

  await expect(page).toHaveTitle(/Paper Majority/);
  await expect(page.getByLabel('Office status')).toBeVisible();
  await expect(page.getByTestId('game-canvas-region')).toHaveAttribute(
    'aria-label',
    'Congressional desk',
  );

  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  const snapshotId = await page.evaluate(() => window.__congressGameTestApi!.getState().snapshotId);
  expect(snapshotId).toBe('interaction-spike-2026-08-24');
});
