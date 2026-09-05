import { expect, test, type Page } from '@playwright/test';

import type { TermState } from '../src/domain/types';

async function state(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

async function idFor(page: Page, definitionId: string, form = 'raw') {
  const card = (await state(page)).cards.find(
    (candidate) => candidate.definitionId === definitionId && candidate.form === form,
  );
  if (!card) throw new Error(`missing ${definitionId} (${form})`);
  return card.id;
}

async function stageWithKeyboard(page: Page, cardId: string) {
  const picker = page.getByTestId('work-mat-picker');
  const values = await picker.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value),
  );
  const index = values.indexOf(cardId);
  if (index < 0) throw new Error(`card ${cardId} is unavailable in the Work Mat picker`);
  const label = await picker.locator(`option[value="${cardId}"]`).textContent();
  if (!label) throw new Error(`card ${cardId} has no picker label`);
  await picker.focus();
  await page.keyboard.type(label);
  await expect(picker).toHaveValue(cardId, { timeout: 10_000 });
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('work-mat-stage')).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Space');
  await expect(page.getByTestId(`work-mat-ghost-${cardId}`)).toBeVisible({ timeout: 10_000 });
}

async function clickDeskCard(page: Page, cardId: string) {
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('canvas has no box');
  const point = await page.evaluate((id) => {
    const camera = (window as unknown as {
      __congressGameCamera: { getScreenPoint(cardId: string): { x: number; y: number } | undefined };
    }).__congressGameCamera;
    return camera.getScreenPoint(id);
  }, cardId);
  if (!point) throw new Error(`card ${cardId} has no rendered point`);
  await page.mouse.click(canvas.x + point.x, canvas.y + point.y);
}

async function dragDeskCard(page: Page, cardId: string, target: { x: number; y: number }) {
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('canvas has no box');
  const start = await page.evaluate((id) => {
    const camera = (window as unknown as {
      __congressGameCamera: { getScreenPoint(cardId: string): { x: number; y: number } | undefined };
    }).__congressGameCamera;
    return camera.getScreenPoint(id);
  }, cardId);
  if (!start) throw new Error(`card ${cardId} has no rendered point`);
  await page.mouse.move(canvas.x + start.x, canvas.y + start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 16 });
  await page.mouse.up();
}

async function makeSummary(page: Page, exerciseDrag = false) {
  const aide = await idFor(page, 'staff-policy-aide');
  const evidence = await idFor(page, 'evidence-rent-burden-report');
  if (exerciseDrag) {
    const target = await page.evaluate((id) => {
      const camera = (window as unknown as {
        __congressGameCamera: { getScreenPoint(cardId: string): { x: number; y: number } | undefined };
      }).__congressGameCamera;
      return camera.getScreenPoint(id);
    }, evidence);
    const canvas = await page.locator('canvas').boundingBox();
    if (!target || !canvas) throw new Error('missing drag target');
    await dragDeskCard(page, aide, { x: canvas.x + target.x, y: canvas.y + target.y });
    await expect.poll(async () => (await state(page)).activeWork.length).toBe(1);
    expect((await state(page)).cards.find((card) => card.id === aide)?.stackId).toBe(
      (await state(page)).cards.find((card) => card.id === evidence)?.stackId,
    );
    await dragDeskCard(page, aide, { x: canvas.x + 28, y: canvas.y + 28 });
    await expect.poll(async () => (await state(page)).activeWork.length).toBe(0);
    expect((await state(page)).cards.find((card) => card.id === aide)?.stackId).not.toBe(
      (await state(page)).cards.find((card) => card.id === evidence)?.stackId,
    );
    await expect(page.locator('[data-testid^="work-mat-ghost-"]')).toHaveCount(0);
  }
  await stageWithKeyboard(page, aide);
  await stageWithKeyboard(page, evidence);
  const begin = page.getByTestId('work-mat-begin');
  const beginBox = await begin.boundingBox();
  if (!beginBox) throw new Error('Begin Work has no box');
  await page.mouse.click(beginBox.x + beginBox.width / 2, beginBox.y + beginBox.height / 2);
  await expect.poll(async () => (await state(page)).activeWork.length, { timeout: 10_000 }).toBe(1);
  await page.getByTestId('hud-pause').click();
  await expect.poll(async () => (await state(page)).paused, { timeout: 10_000 }).toBe(false);
  const startedAt = (await state(page)).simulationMs;
  await expect.poll(async () => (await state(page)).simulationMs, { timeout: 10_000 }).toBeGreaterThan(startedAt);
  await expect.poll(async () => (await state(page)).cards.some(
    (card) => card.definitionId === 'evidence-rent-burden-report' && card.form === 'summary',
  ), { timeout: 10_000 }).toBe(true);
}

test('three-input Work Mat is usable by pointer while paused and keyboard while running', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  await page.goto('/workbench');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await makeSummary(page, true);

  // Pointer path while paused: card taps stage, a ghost removes, and restaging is free.
  await page.getByTestId('hud-pause').click();
  const counsel = await idFor(page, 'staff-legislative-counsel');
  const summary = await idFor(page, 'evidence-rent-burden-report', 'summary');
  const policy = await idFor(page, 'policy-housing-choice-voucher');
  const before = (await state(page)).resources.staffAttention;
  for (const id of [counsel, summary, policy]) await clickDeskCard(page, id);
  await page.getByRole('button', { name: /remove rent burden report/i }).click();
  await clickDeskCard(page, summary);
  expect((await state(page)).resources.staffAttention).toBe(before);
  expect((await state(page)).activeWork).toEqual([]);
  await page.getByTestId('work-mat-begin').click();
  await expect.poll(async () => (await state(page)).activeWork.length).toBe(1);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect.poll(async () => (await state(page)).activeWork.length, { timeout: 10_000 }).toBe(0);
  expect((await state(page)).resources.staffAttention).toBe(before);

  // Cancellation keeps the real pile. Pull its cards apart before tapping each one again.
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('canvas has no box');
  await dragDeskCard(page, counsel, { x: canvas.x + 64, y: canvas.y + 72 });
  await dragDeskCard(page, summary, { x: canvas.x + 176, y: canvas.y + 72 });
  await expect.poll(async () => new Set(
    (await state(page)).cards
      .filter((card) => [counsel, summary, policy].includes(card.id))
      .map((card) => card.stackId),
  ).size, { timeout: 10_000 }).toBe(3);
  await expect(page.locator('[data-testid^="work-mat-ghost-"]')).toHaveCount(0, { timeout: 10_000 });
  for (const id of [counsel, summary, policy]) await clickDeskCard(page, id);
  await expect(page.locator('[data-testid^="work-mat-ghost-"]')).toHaveCount(3, { timeout: 10_000 });
  await expect(page.getByTestId('work-mat-begin')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('work-mat-begin').click();
  await page.getByTestId('hud-pause').click();
  await expect.poll(async () => (await state(page)).activeWork.length, { timeout: 10_000 }).toBe(0);
  expect((await state(page)).cards.some((card) => card.definitionId === 'policy-housing-choice-voucher' && card.form === 'drafted')).toBe(true);

  // Fresh run, keyboard path while running: cancel once, then restage and complete.
  await page.goto('/workbench');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));
  await makeSummary(page);
  const keyboardCounsel = await idFor(page, 'staff-legislative-counsel');
  const keyboardSummary = await idFor(page, 'evidence-rent-burden-report', 'summary');
  const keyboardPolicy = await idFor(page, 'policy-housing-choice-voucher');
  const keyboardBefore = (await state(page)).resources.staffAttention;
  for (const id of [keyboardCounsel, keyboardSummary, keyboardPolicy]) await stageWithKeyboard(page, id);
  await page.getByRole('button', { name: /remove rent burden report/i }).focus();
  await page.keyboard.press('Space');
  await stageWithKeyboard(page, keyboardSummary);
  expect((await state(page)).resources.staffAttention).toBe(keyboardBefore);
  await page.getByTestId('work-mat-begin').focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).activeWork.length).toBe(1);
  await page.getByRole('button', { name: 'Cancel' }).focus();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).activeWork.length).toBe(0);
  for (const id of [keyboardCounsel, keyboardSummary, keyboardPolicy]) await stageWithKeyboard(page, id);
  await page.getByTestId('work-mat-begin').focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).activeWork.length, { timeout: 10_000 }).toBe(0);
  const finished = await state(page);
  expect(finished.cards.some((card) => card.definitionId === 'policy-housing-choice-voucher' && card.form === 'drafted')).toBe(true);
  expect(finished.resources.staffAttention).toBe(keyboardBefore);
  expect(browserErrors).toEqual([]);
});
