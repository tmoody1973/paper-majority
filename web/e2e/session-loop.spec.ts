import { expect, test, type Page } from '@playwright/test';

import type { TermState } from '../src/domain/types';

async function state(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

async function exportedBytes(page: Page, testId: string): Promise<string> {
  const href = await page.getByTestId(testId).getAttribute('href');
  if (!href?.includes(',')) throw new Error(`${testId} has no data export`);
  return decodeURIComponent(href.slice(href.indexOf(',') + 1));
}

async function activate(page: Page, locator: ReturnType<Page['locator']>, keyboard: boolean) {
  if (!keyboard) {
    await locator.click();
    return;
  }
  await locator.focus();
  await page.keyboard.press('Enter');
}

async function resolveStory(page: Page, keyboard = false) {
  const dialog = page.getByTestId('story-decision-modal');
  if (await dialog.isVisible().catch(() => false)) {
    await activate(page, dialog.locator('button[data-story-choice]:not([disabled])').first(), keyboard);
    await expect(dialog).not.toBeVisible();
  }
}

async function cardId(page: Page, definitionId: string) {
  const id = (await state(page)).cards.find((card) => card.definitionId === definitionId)?.id;
  if (!id) throw new Error(`Missing ${definitionId}`);
  return id;
}

async function canvasTap(page: Page, id: string) {
  const canvas = await page.locator('canvas').boundingBox();
  const point = await page.evaluate((card) => (
    window as unknown as { __congressGameCamera: { getExposedScreenPoint(id: string): { x: number; y: number } | undefined } }
  ).__congressGameCamera.getExposedScreenPoint(card), id);
  if (!canvas || !point) throw new Error(`No exposed point for ${id}`);
  await page.mouse.click(canvas.x + point.x, canvas.y + point.y);
}

async function keyboardStage(page: Page, id: string) {
  const picker = page.getByTestId('work-mat-picker');
  await picker.selectOption(id);
  await picker.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('work-mat-stage')).toBeFocused();
  await page.keyboard.press('Space');
}

async function makeCoalitionChoice(page: Page, choice: 'accept' | 'reject', keyboard: boolean) {
  const aide = await cardId(page, 'staff-policy-aide');
  const office = await cardId(page, choice === 'accept'
    ? 'coalition-office-mike-flood'
    : 'coalition-office-maxine-waters');
  await expect(page.locator('[data-testid^="work-mat-ghost-"]')).toHaveCount(0);
  if (keyboard) {
    await keyboardStage(page, aide);
    await keyboardStage(page, office);
    await page.getByTestId('work-mat-begin').focus();
    await page.keyboard.press('Enter');
  } else {
    await canvasTap(page, aide);
    await expect(page.locator('[data-testid^="work-mat-ghost-"]')).toHaveCount(1);
    await keyboardStage(page, office);
    await expect(page.locator('[data-testid^="work-mat-ghost-"]')).toHaveCount(2);
    await page.getByTestId('work-mat-begin').click();
  }
  await activate(page, page.getByTestId('week-fast-forward'), keyboard);
  const decision = page.getByTestId('decision-modal');
  await expect(decision).toBeVisible();
  const action = page.getByTestId(`decision-resolve-${choice}`);
  if (keyboard) {
    await action.focus();
    await page.keyboard.press('Enter');
  } else {
    await action.click();
  }
  await expect(decision).not.toBeVisible();
}

async function finishSixWeeks(page: Page, keyboard = false) {
  for (let week = 1; week <= 6; week += 1) {
    await resolveStory(page, keyboard);
    if (week >= 2) {
      const pack = page.locator('[data-testid^="open-pack-"]').first();
      await expect(pack).toBeVisible();
      await activate(page, pack, keyboard);
    }
    await activate(page, page.getByTestId('week-end-early'), keyboard);
    await expect(page.getByTestId('week-boundary-preview')).toBeVisible();
    await activate(page, page.getByTestId('week-confirm'), keyboard);
    if (week < 6) await expect.poll(async () => (await state(page)).week).toBe(week + 1);
  }
  await activate(page, page.getByTestId('session-conclude'), keyboard);
  await expect(page.getByTestId('session-record')).toBeVisible();
}

async function start(page: Page, pace: 'standard' | 'relaxed') {
  await page.getByLabel('Pace').selectOption(pace);
  await page.getByTestId('session-start-new').click();
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('week-one-agenda')).toBeVisible();
  await expect(page.getByTestId('week-one-agenda').locator('[data-observed="true"]')).toHaveCount(0);
  await resolveStory(page);
  await expect(page.getByTestId('week-one-agenda').locator('[data-observed="true"]')).toHaveCount(1);
}

test('completes standard and relaxed six-week Sessions through canvas and keyboard controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /six-week housing package/i })).toBeVisible();
  await expect(page.getByTestId('session-district').locator('option')).toHaveCount(6);
  await start(page, 'standard');
  await makeCoalitionChoice(page, 'accept', false);
  await expect(page.getByTestId('week-one-agenda').locator('[data-observed="true"]')).toHaveCount(2);
  await page.getByTestId('sourcebook-toggle').click();
  await expect(page.getByLabel('Sourcebook')).toContainText('Official public source');
  await expect(page.getByLabel('Sourcebook')).toContainText('Simulated for play');
  await page.getByTestId('sourcebook-toggle').click();
  await finishSixWeeks(page);
  expect((await state(page)).week).toBe(6);
  expect((await state(page)).runStatus).toBe('complete');
  const frozenRecord = JSON.stringify((await state(page)).sessionRecord);
  const storyHistoryA = [...(await state(page)).storyHistory];
  const bytesA = await page.evaluate(() => window.localStorage.getItem('congress-game.save.current'));
  if (!bytesA) throw new Error('Run A has no current checkpoint');

  await page.reload();
  expect(await exportedBytes(page, 'export-current-save')).toBe(bytesA);
  await expect(page.getByTestId('export-preserved-save')).toHaveCount(0);
  await page.getByTestId('session-resume').click();
  await expect(page.getByTestId('session-record')).toBeVisible();
  expect(JSON.stringify((await state(page)).sessionRecord)).toBe(frozenRecord);
  expect((await state(page)).storyHistory).toEqual(storyHistoryA);
  await page.getByTestId('session-restart').click();
  await page.getByLabel('Pace').selectOption('relaxed');
  await page.getByLabel('Seed').focus();
  await page.keyboard.press('Meta+A');
  await page.keyboard.type('20260906');
  await page.getByTestId('session-start-new').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  expect((await state(page)).seed).toBe(20260906);
  await resolveStory(page, true);
  await page.getByTestId('hud-reduced-motion').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hud-reduced-motion')).toHaveAttribute('aria-pressed', 'true');
  await makeCoalitionChoice(page, 'reject', true);
  await finishSixWeeks(page, true);
  expect((await state(page)).settings.pace).toBe('relaxed');
  expect((await state(page)).settings.reducedMotion).toBe(true);
  expect((await state(page)).runStatus).toBe('complete');
  await expect(page.getByTestId('session-record-export')).toHaveAttribute('download', /paper-majority/);
  const bytesB = await page.evaluate(() => window.localStorage.getItem('congress-game.save.current'));
  if (!bytesB) throw new Error('Run B has no current checkpoint');
  expect(bytesB).not.toBe(bytesA);
  expect(await exportedBytes(page, 'session-prior-save-export')).toBe(bytesA);
  expect(await exportedBytes(page, 'session-current-save-export')).toBe(bytesB);

  await page.reload();
  expect(await exportedBytes(page, 'export-preserved-save')).toBe(bytesA);
  expect(await exportedBytes(page, 'export-current-save')).toBe(bytesB);
  await page.getByTestId('session-resume').click();
  await expect(page.getByTestId('session-record')).toBeVisible();
  expect((await state(page)).seed).toBe(20260906);
  expect(await exportedBytes(page, 'session-prior-save-export')).toBe(bytesA);
});

test('keeps the legacy interaction fixture separate from normal setup', async ({ page }) => {
  await page.goto('/?fixture=interaction-spike');
  await expect(page.getByLabel('Office status')).toBeVisible();
  await expect(page.getByTestId('session-start-new')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /sourcebook/i })).toHaveCount(0);
});
