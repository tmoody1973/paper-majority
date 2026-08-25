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

/**
 * Where a card actually sits on screen.
 *
 * Asks the camera, rather than assuming zoom 1 and no scroll — the desk now opens
 * framed to fit, so the naive mapping would click empty space.
 */
async function cardScreenPoint(page: Page, cardId: string) {
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('canvas has no bounding box');
  const point = await page.evaluate((id) => {
    const probe = (window as unknown as {
      __congressGameCamera?: { getScreenPoint: (c: string) => { x: number; y: number } | undefined };
    }).__congressGameCamera;
    return probe?.getScreenPoint(id);
  }, cardId);
  if (!point) throw new Error(`no card ${cardId}`);
  return { x: canvas.x + point.x, y: canvas.y + point.y };
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
    await page.waitForFunction(() =>
      Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));
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

    // Drop into genuinely empty desk space — the strip above the top row. A drop onto
    // a neighbour would stack instead of move.
    await page.mouse.move(before.x, before.y);
    await page.mouse.down();
    await page.mouse.move(before.x, canvas.y + 8, { steps: 16 });
    await page.mouse.up();

    // The engine holds the authoritative position, so assert on that rather than on
    // a screen estimate that ignores camera scroll.
    const state = await getState(page);
    const card = state.cards.find((candidate) => candidate.id === cardId)!;
    expect(Math.abs(card.x - startCard.x) + Math.abs(card.y - startCard.y)).toBeGreaterThan(40);
  });

  test('a pointer drag still moves a card while the clock is running', async ({ page }) => {
    // Regression. The clock redraws the desk from authoritative state ~10x a second.
    // That redraw used to reset the held card's position AND its depth, and the lost
    // depth made the pan handler mistake a card drag for a desk pan. The card stayed
    // pinned within 6px of its resting spot no matter how far the pointer travelled.
    await page.waitForFunction(() =>
      Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));
    await page.getByTestId('hud-pause').click();
    await expect.poll(async () => (await getState(page)).paused).toBe(false);
    await page.waitForTimeout(300);

    const cardId = await cardIdFor(page, 'staff-policy-aide');
    const startCard = (await getState(page)).cards.find((card) => card.id === cardId)!;
    const before = await cardScreenPoint(page, cardId);

    // Sample the RENDERED card every frame — the end state alone hid this bug.
    const sampling = page.evaluate((id) => {
      const probe = (window as unknown as {
        __congressGameCamera: { getViewY: (cardId: string) => number | undefined };
      }).__congressGameCamera;
      const samples: number[] = [];
      const start = performance.now();
      return new Promise<number[]>((resolve) => {
        const tick = () => {
          const y = probe.getViewY(id);
          if (y !== undefined) samples.push(y);
          if (performance.now() - start > 1800) { resolve(samples); return; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, cardId);

    await page.mouse.move(before.x, before.y);
    await page.mouse.down();
    for (let step = 1; step <= 40; step += 1) {
      await page.mouse.move(before.x, before.y - step * 3);
    }
    const samples = await sampling;
    await page.mouse.up();

    // The card must actually travel with the pointer, not sit in a lift-sized band.
    const travelled = Math.max(...samples) - Math.min(...samples);
    expect(travelled).toBeGreaterThan(60);

    const card = (await getState(page)).cards.find((candidate) => candidate.id === cardId)!;
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

  test('dragging Staff onto a Tactic starts Study Tactic', async ({ page }) => {
    // Regression: the drag path only ever dispatched STACK_CARD. Staff + Tactic
    // matches no pattern, so studying a Tactic was unreachable with a mouse — the
    // one gesture the design says the player must perform.
    const aideId = await cardIdFor(page, 'staff-policy-aide');
    const tacticId = await cardIdFor(page, 'tactic-bipartisan-working-group');

    const from = await cardScreenPoint(page, aideId);
    const to = await cardScreenPoint(page, tacticId);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 16 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const state = await getState(page);
        const aide = state.cards.find((card) => card.id === aideId);
        const tactic = state.cards.find((card) => card.id === tacticId);
        return aide?.status === 'working' && tactic?.status === 'working';
      })
      .toBe(true);

    const state = await getState(page);
    const stack = state.stacks.find((candidate) => candidate.cardIds.includes(tacticId));
    expect(stack?.activeActionId).toBe('study:expansion-bipartisan-outreach');
    // Studying costs the declared Staff Attention and nothing else.
    expect(state.resources.staffAttention).toBe(2);
    expect(state.unlockedSlotExpansions).toEqual({});
  });

  test('one Working Bill can reach both member offices', async ({ page }) => {
    // Regression: outreach consumed the bill, so there was nothing left to try on the
    // second office. Your bill must survive a conversation.
    const billId = await cardIdFor(page, 'institution-working-bill');
    const allyId = await cardIdFor(page, 'coalition-office-hillcrest');

    await page.evaluate(
      ([bill, ally]) => {
        const api = window.__congressGameTestApi!;
        const target = api.getState().cards.find((card) => card.id === ally)!;
        api.dispatch({ type: 'STACK_CARD', cardId: bill, targetStackId: target.stackId });
        api.dispatch({ type: 'SET_PAUSED', paused: false });
        for (let elapsed = 0; elapsed < 7000; elapsed += 1000) {
          api.dispatch({ type: 'TICK', deltaMs: 1000 });
        }
        api.dispatch({ type: 'SET_PAUSED', paused: true });
      },
      [billId, allyId],
    );

    const state = await getState(page);
    expect(state.cards.some((card) => card.definitionId === 'institution-working-bill')).toBe(true);
    expect(state.cards.some((card) => card.definitionId === 'coalition-outreach-result')).toBe(true);
    const bill = state.cards.find((card) => card.definitionId === 'institution-working-bill')!;
    expect(bill.status).toBe('idle');
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
