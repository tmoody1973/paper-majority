import { expect, test, type Page } from '@playwright/test';

import type { TermState } from '../src/domain/types';

async function state(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

async function idFor(page: Page, definitionId: string, form = 'raw'): Promise<string> {
  const card = (await state(page)).cards.find(
    (candidate) => candidate.definitionId === definitionId && candidate.form === form,
  );
  if (!card) throw new Error(`missing ${definitionId} (${form})`);
  return card.id;
}

async function cardScreenPoint(page: Page, cardId: string): Promise<{ x: number; y: number }> {
  const point = await page.evaluate((id) => (
    window as unknown as {
      __congressGameCamera: { getScreenPoint(cardId: string): { x: number; y: number } | undefined };
    }
  ).__congressGameCamera.getScreenPoint(id), cardId);
  if (!point) throw new Error(`card ${cardId} has no rendered point`);
  return point;
}

async function docketScreenPoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(() => (
    window as unknown as {
      __congressGameCamera: { getDocketScreenPoint(): { x: number; y: number } | undefined };
    }
  ).__congressGameCamera.getDocketScreenPoint());
  if (!point) throw new Error('Bill Docket has no rendered point');
  return point;
}

async function dragCard(page: Page, cardId: string, target: { x: number; y: number }) {
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('canvas has no box');
  const start = await cardScreenPoint(page, cardId);
  await page.mouse.move(canvas.x + start.x, canvas.y + start.y);
  await page.mouse.down();
  await page.mouse.move(canvas.x + target.x, canvas.y + target.y, { steps: 16 });
  await page.mouse.up();
}

async function stageWithPointer(page: Page, cardId: string) {
  await page.getByTestId('work-mat-picker').selectOption(cardId);
  await page.getByTestId('work-mat-stage').click();
}

async function stageWithKeyboard(page: Page, cardId: string) {
  const picker = page.getByTestId('work-mat-picker');
  const label = await picker.locator(`option[value="${cardId}"]`).textContent();
  if (!label) throw new Error(`card ${cardId} has no Work Mat label`);
  await picker.focus();
  await page.keyboard.type(label);
  await expect(picker).toHaveValue(cardId, { timeout: 10_000 });
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('work-mat-stage')).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Space');
}

async function waitForWorkbench(page: Page) {
  await page.goto('/workbench');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('bill-docket')).toBeVisible({ timeout: 10_000 });
}

async function waitForForm(page: Page, definitionId: string, form: string) {
  await expect.poll(
    async () => (await state(page)).cards.some(
      (card) => card.definitionId === definitionId && card.form === form,
    ),
    { timeout: 10_000 },
  ).toBe(true);
}

test('drafted policy reaches the visible Docket through real pointer gestures', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  await waitForWorkbench(page);

  const aide = await idFor(page, 'staff-policy-aide');
  const evidence = await idFor(page, 'evidence-rent-burden-report');
  await dragCard(page, aide, await cardScreenPoint(page, evidence));
  await expect.poll(async () => (await state(page)).activeWork.length, { timeout: 10_000 }).toBe(1);
  await page.getByTestId('hud-pause').click();
  await waitForForm(page, 'evidence-rent-burden-report', 'summary');

  const counsel = await idFor(page, 'staff-legislative-counsel');
  const summary = await idFor(page, 'evidence-rent-burden-report', 'summary');
  const policy = await idFor(page, 'policy-housing-choice-voucher');
  for (const id of [counsel, summary, policy]) await stageWithPointer(page, id);
  await page.getByTestId('work-mat-begin').click();
  await waitForForm(page, 'policy-housing-choice-voucher', 'drafted');

  const drafted = await idFor(page, 'policy-housing-choice-voucher', 'drafted');
  await dragCard(page, drafted, await docketScreenPoint(page));
  await expect.poll(async () => (await state(page)).bill.revision, { timeout: 10_000 }).toBe(1);

  const finished = await state(page);
  expect(finished.bill.provisionIds).toEqual(['policy-housing-choice-voucher']);
  expect(finished.bill.provisionReceipts[0].sourceDefinitionIds).toEqual(['evidence-rent-burden-report']);
  expect(finished.resources.policyIntegrity).toBe(76);
  await expect(page.getByTestId('bill-docket-provision-policy-housing-choice-voucher')).toContainText('Rent Burden Report');
  expect(browserErrors).toEqual([]);
});

test('keyboard users can summarize, draft, and Add to Bill through the same controls', async ({ page }) => {
  await waitForWorkbench(page);

  for (const id of [
    await idFor(page, 'staff-policy-aide'),
    await idFor(page, 'evidence-rent-burden-report'),
  ]) await stageWithKeyboard(page, id);
  await page.getByTestId('work-mat-begin').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('hud-pause').focus();
  await page.keyboard.press('Enter');
  await waitForForm(page, 'evidence-rent-burden-report', 'summary');

  for (const id of [
    await idFor(page, 'staff-legislative-counsel'),
    await idFor(page, 'evidence-rent-burden-report', 'summary'),
    await idFor(page, 'policy-housing-choice-voucher'),
  ]) await stageWithKeyboard(page, id);
  await page.getByTestId('work-mat-begin').focus();
  await page.keyboard.press('Enter');
  await waitForForm(page, 'policy-housing-choice-voucher', 'drafted');

  const drafted = await idFor(page, 'policy-housing-choice-voucher', 'drafted');
  const picker = page.getByTestId('bill-docket-picker');
  const label = await picker.locator(`option[value="${drafted}"]`).textContent();
  if (!label) throw new Error('drafted provision has no Docket label');
  await picker.focus();
  await page.keyboard.type(label);
  await expect(picker).toHaveValue(drafted, { timeout: 10_000 });
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('bill-docket-add')).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Enter');

  await expect.poll(async () => (await state(page)).bill.revision, { timeout: 10_000 }).toBe(1);
  await expect(page.getByTestId('bill-docket-feedback')).toHaveText(/added to the bill/i);
  expect((await state(page)).bill.provisionReceipts[0].sourceDefinitionIds).toEqual([
    'evidence-rent-burden-report',
  ]);
});
