import { expect, test, type Page } from '@playwright/test';

/**
 * The two timing requirements from the approved motion language, measured in a real
 * browser rather than read off a constant.
 *
 *   - Pickup or valid-hover feedback begins within 100 ms.
 *   - A completed transformation communicates its result within one second.
 */

const URL = '/?fixture=interaction-spike';

async function cardIdFor(page: Page, definitionId: string): Promise<string> {
  return page.evaluate((id) => {
    const state = window.__congressGameTestApi!.getState();
    return state.cards.find((card) => card.definitionId === id)!.id;
  }, definitionId);
}

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() =>
    Boolean((window as unknown as Record<string, unknown>).__congressGameCamera),
  );
});

test.describe('interaction spike timing', () => {
test('pickup feedback begins within 100 ms', async ({ page }) => {
  const cardId = await cardIdFor(page, 'staff-policy-aide');
  const canvas = (await page.locator('canvas').boundingBox())!;
  const rect = (await page.evaluate(
    (id) => window.__congressGameTestApi!.getCardRect(id),
    cardId,
  ))!;

  // Measure from the browser's own pointerdown to the first rendered movement, so
  // the number reflects what a player feels rather than test-harness latency.
  const watching = page.evaluate((id) => {
    const probe = (
      window as unknown as {
        __congressGameCamera: { getViewY: (cardId: string) => number | undefined };
      }
    ).__congressGameCamera;
    const restingY = probe.getViewY(id)!;
    let start = performance.now();
    window.addEventListener('pointerdown', () => { start = performance.now(); }, { once: true, capture: true });
    return new Promise<number>((resolve) => {
      const tick = () => {
        const y = probe.getViewY(id);
        if (y !== undefined && Math.abs(y - restingY) > 0.5) {
          resolve(performance.now() - start);
          return;
        }
        if (performance.now() - start > 2000) {
          resolve(-1);
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, cardId);

  await page.mouse.move(canvas.x + rect.x, canvas.y + rect.y);
  await page.mouse.down();
  await page.mouse.move(canvas.x + rect.x + 3, canvas.y + rect.y + 3, { steps: 2 });

  const elapsed = await watching;
  await page.mouse.up();

  console.log(`MEASURED pickup feedback: ${elapsed.toFixed(1)} ms`);
  expect(elapsed).toBeGreaterThan(0);
  expect(elapsed).toBeLessThan(100);
});

test('a completed transformation communicates its result within one second', async ({ page }) => {
  const aide = await cardIdFor(page, 'staff-policy-aide');
  const report = await cardIdFor(page, 'evidence-rent-burden-report');

  await page.evaluate(
    ([moving, onto]) => {
      const api = window.__congressGameTestApi!;
      const target = api.getState().cards.find((card) => card.id === onto)!;
      api.dispatch({ type: 'STACK_CARD', cardId: moving, targetStackId: target.stackId });
      api.dispatch({ type: 'SET_PAUSED', paused: false });
      for (let elapsed = 0; elapsed < 5000; elapsed += 1000) {
        api.dispatch({ type: 'TICK', deltaMs: 1000 });
      }
    },
    [aide, report],
  );

  await expect(page.getByTestId('hud-result')).toBeEmpty();

  const elapsed = await page.evaluate(() => {
    const api = window.__congressGameTestApi!;
    const start = performance.now();
    // The final tick crosses zero and emits CARD_TRANSFORMED.
    api.dispatch({ type: 'TICK', deltaMs: 1000 });
    return new Promise<number>((resolve) => {
      const tick = () => {
        const node = document.querySelector('[data-testid="hud-result"]');
        if (node && (node.textContent ?? '').trim().length > 0) {
          resolve(performance.now() - start);
          return;
        }
        if (performance.now() - start > 5000) {
          resolve(-1);
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });

  console.log(`MEASURED transformation result phrase: ${elapsed.toFixed(1)} ms`);
  expect(elapsed).toBeGreaterThan(0);
  expect(elapsed).toBeLessThan(1000);

  await expect(page.getByTestId('hud-result')).toContainText(/summary/i);
});
});
