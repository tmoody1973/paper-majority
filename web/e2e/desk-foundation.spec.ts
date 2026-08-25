import { expect, test, type Page } from '@playwright/test';

import type { TermState } from '../src/domain/types';

/**
 * Low-level desk mechanics. These prove the gesture works at all, before the
 * interaction spike proves it is worth playing.
 */

const FIXTURE_URL = '/?fixture=desk-foundation';

async function getState(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

/** Screen coordinates of a card, via the canvas rect plus the card's desk position. */
async function cardScreenPoint(page: Page, cardId: string) {
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('canvas has no bounding box');
  const rect = await page.evaluate(
    (id) => window.__congressGameTestApi!.getCardRect(id),
    cardId,
  );
  if (!rect) throw new Error(`no card ${cardId}`);
  return { x: canvas.x + rect.x, y: canvas.y + rect.y };
}

async function cardIdFor(page: Page, definitionId: string, skip = 0): Promise<string> {
  const state = await getState(page);
  const matches = state.cards.filter((card) => card.definitionId === definitionId);
  const card = matches[skip];
  if (!card) throw new Error(`no instance ${skip} of ${definitionId}`);
  return card.id;
}

test.describe('desk foundation', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    await page.goto(FIXTURE_URL);
    await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  });

  test('loads the canvas and HUD without console errors', async ({ page }) => {
    await expect(page.getByLabel('Office status')).toBeVisible();
    await expect(page.getByTestId('game-canvas-region')).toHaveAttribute(
      'aria-label',
      'Congressional desk',
    );
    await page.waitForTimeout(500);
    expect(consoleErrors).toEqual([]);
  });

  test('a pointer drag changes a card position', async ({ page }) => {
    const cardId = await cardIdFor(page, 'staff-policy-aide');
    const startCard = (await getState(page)).cards.find((card) => card.id === cardId)!;
    const before = await cardScreenPoint(page, cardId);
    const canvas = (await page.locator('canvas').boundingBox())!;

    // Drop into genuinely empty desk space. Every card sits at y >= 74, so the strip
    // above them is free — a drop onto a neighbour would stack instead of move.
    await page.mouse.move(before.x, before.y);
    await page.mouse.down();
    await page.mouse.move(canvas.x + 300, canvas.y + 40, { steps: 16 });
    await page.mouse.up();

    // The engine holds the authoritative position, so assert on that rather than on
    // a screen estimate that ignores camera scroll.
    const state = await getState(page);
    const card = state.cards.find((candidate) => candidate.id === cardId)!;
    expect(Math.abs(card.x - startCard.x) + Math.abs(card.y - startCard.y)).toBeGreaterThan(40);
  });

  test('a valid stack snaps into one stack', async ({ page }) => {
    const staffId = await cardIdFor(page, 'staff-policy-aide');
    const evidenceId = await cardIdFor(page, 'evidence-rent-burden-report');

    const from = await cardScreenPoint(page, staffId);
    const to = await cardScreenPoint(page, evidenceId);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 16 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const state = await getState(page);
        return state.stacks.some((stack) => stack.cardIds.length === 2);
      })
      .toBe(true);
  });

  test('an invalid stack is rejected and changes nothing', async ({ page }) => {
    const policyId = await cardIdFor(page, 'policy-housing-choice-voucher');
    const officeId = await cardIdFor(page, 'coalition-office-hillcrest');
    const before = await getState(page);

    const result = await page.evaluate(
      ([cardId, targetCardId]) => {
        const api = window.__congressGameTestApi!;
        const state = api.getState();
        const target = state.cards.find((card) => card.id === targetCardId)!;
        return api.dispatch({ type: 'STACK_CARD', cardId, targetStackId: target.stackId }).events;
      },
      [policyId, officeId],
    );

    expect(result.some((event) => event.type === 'STACK_REJECTED')).toBe(true);

    const after = await getState(page);
    expect(after.resources).toEqual(before.resources);
    expect(after.discoveredPatternIds).toEqual(before.discoveredPatternIds);
    expect(after.cards.length).toBe(before.cards.length);
  });

  test('pausing stops the clock but still permits moving a card', async ({ page }) => {
    await page.getByTestId('hud-pause').click(); // resume
    await page.waitForTimeout(600);
    await page.getByTestId('hud-pause').click(); // pause again

    const paused = await getState(page);
    expect(paused.paused).toBe(true);
    await page.waitForTimeout(600);

    const later = await getState(page);
    expect(later.elapsedMs).toBe(paused.elapsedMs);

    const cardId = await cardIdFor(page, 'staff-policy-aide');
    await page.evaluate(
      (id) => window.__congressGameTestApi!.dispatch({ type: 'MOVE_CARD', cardId: id, x: 640, y: 640 }),
      cardId,
    );

    const moved = await getState(page);
    expect(moved.cards.find((card) => card.id === cardId)).toMatchObject({ x: 640, y: 640 });
    expect(moved.paused).toBe(true);
  });

  test('wheel zoom stays inside the clamp', async ({ page }) => {
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('no canvas');
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);

    for (let i = 0; i < 12; i += 1) await page.mouse.wheel(0, -900);
    await page.waitForTimeout(120);
    for (let i = 0; i < 24; i += 1) await page.mouse.wheel(0, 900);
    await page.waitForTimeout(120);

    const zoomedOut = await page.evaluate(() => window.__congressGameTestApi!.getZoom());
    expect(zoomedOut).toBeGreaterThanOrEqual(0.65);
    expect(zoomedOut).toBeLessThanOrEqual(1.5);

    for (let i = 0; i < 24; i += 1) await page.mouse.wheel(0, -900);
    await page.waitForTimeout(120);
    const zoomedIn = await page.evaluate(() => window.__congressGameTestApi!.getZoom());
    expect(zoomedIn).toBeGreaterThanOrEqual(0.65);
    expect(zoomedIn).toBeLessThanOrEqual(1.5);
    expect(consoleErrors).toEqual([]);
  });
});
