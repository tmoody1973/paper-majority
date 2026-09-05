import { expect, test, type Page } from '@playwright/test';

import type { TermState } from '../src/domain/types';

async function state(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

async function idFor(page: Page, definitionId: string) {
  const card = (await state(page)).cards.find((candidate) => candidate.definitionId === definitionId);
  if (!card) throw new Error(`missing ${definitionId}`);
  return card.id;
}

async function stage(page: Page, cardId: string) {
  await page.getByTestId('work-mat-picker').selectOption(cardId);
  await page.getByTestId('work-mat-stage').click();
}

test('filing, cancellation, fast-forward and boundary review use visible Session controls', async ({ page }) => {
  await page.goto('/workbench/week-boundary');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.getByTestId('week-summary')).toBeVisible({ timeout: 15_000 });

  const evidence = await idFor(page, 'evidence-rent-burden-report');
  await page.getByTestId('controls-source').selectOption(evidence);
  await page.getByTestId('controls-file').click();
  expect((await state(page)).cards.find((card) => card.id === evidence)?.location).toBe('filed');
  await page.getByTestId('all-commitments').locator('summary').click();
  await expect(page.getByRole('list', { name: 'All commitments and deadlines' })).toContainText('Answer renter concern');
  await expect(page.getByRole('list', { name: 'All commitments and deadlines' })).toContainText('Source card: not currently held');
  await page.getByRole('button', { name: 'Return to desk' }).click();
  expect((await state(page)).cards.find((card) => card.id === evidence)?.location).toBe('desk');

  const aide = await idFor(page, 'staff-policy-aide');
  await stage(page, aide);
  await stage(page, evidence);
  await page.getByTestId('work-mat-begin').click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  expect((await state(page)).resources.staffAttention).toBe(2);
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect((await state(page)).resources.staffAttention).toBe(3);

  await stage(page, aide);
  await stage(page, evidence);
  await page.getByTestId('work-mat-begin').click();
  await page.getByTestId('week-fast-forward').click();
  await expect.poll(async () => (await state(page)).activeWork.length).toBe(0);
  expect((await state(page)).simulationMs).toBe(1_200);

  await page.getByTestId('week-end-early').click();
  await expect(page.getByTestId('week-boundary-preview')).toBeVisible();
  const boundary = await state(page);
  expect(boundary.week).toBe(1);
  expect(boundary.weekPhase).toBe('boundary');
  expect(boundary.resources.districtTrust).toBe(60);
  await expect(page.getByTestId('week-boundary-preview')).toContainText('District Trust -5');

  await page.getByTestId('week-confirm').click();
  const advanced = await state(page);
  expect(advanced.week).toBe(2);
  expect(advanced.resources.districtTrust).toBe(55);
  expect(advanced.rewardedOccurrenceIds.filter((id) => id === 'obligation-answer-renters:workbench')).toHaveLength(0);
});

test('a decision completed at the boundary blocks the visible week confirmation', async ({ page }) => {
  await page.goto('/workbench/week-boundary');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.getByTestId('week-summary')).toBeVisible({ timeout: 15_000 });

  await stage(page, await idFor(page, 'staff-policy-aide'));
  await stage(page, await idFor(page, 'coalition-office-hillcrest'));
  await page.getByTestId('work-mat-begin').click();
  await page.getByTestId('week-end-early').click();

  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await state(page)).weekPhase).toBe('boundary');
  await expect(page.getByTestId('week-confirm')).toBeDisabled();
  await page.getByTestId('decision-resolve-reject').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('week-confirm')).toBeEnabled();
  await page.getByTestId('week-confirm').click();
  expect((await state(page)).week).toBe(2);
});
