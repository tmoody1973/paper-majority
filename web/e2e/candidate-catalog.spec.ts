import { expect, test, type Page } from '@playwright/test';

import type { TermState } from '../src/domain/types';

async function state(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

test('candidate Story choice and pack reveal use visible controls and survive reload', async ({ page }) => {
  await page.goto('/workbench/catalog');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.getByTestId('candidate-content-notice')).toContainText('human review are pending');

  const dialog = page.getByTestId('story-decision-modal');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Simulated Story event');
  const initial = await state(page);
  expect(initial.pendingStoryDecisions.filter((decision) => decision.status === 'pending')).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  const storyTrigger = page.getByTestId('story-decision-trigger');
  await expect(storyTrigger).toBeFocused();
  await storyTrigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button').first().click();
  await expect(dialog).not.toBeVisible();

  const openPack = page.getByTestId('open-pack-week-two-policy');
  await expect(openPack).toBeVisible();
  await openPack.click();
  await expect(openPack).not.toBeVisible();
  const revealed = await state(page);
  expect(revealed.revealedPacks).toHaveLength(1);
  expect(revealed.eventLog.filter((event) => event.type === 'PACK_OPENED')).toHaveLength(1);
  expect(revealed.rngCursor).toBeGreaterThan(initial.rngCursor);

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.getByTestId('candidate-content-notice')).toBeVisible();
  await expect(page.getByTestId('open-pack-week-two-policy')).toHaveCount(0);
  const loaded = await state(page);
  expect(loaded.revealedPacks).toEqual(revealed.revealedPacks);
  expect(loaded.pendingStoryDecisions).toEqual(revealed.pendingStoryDecisions);
  expect(loaded.rngCursor).toBe(revealed.rngCursor);
});
