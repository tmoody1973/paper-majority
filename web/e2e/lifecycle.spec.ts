import { expect, test } from '@playwright/test';

/**
 * Phase 1 ships no sound, so the game must never open a WebAudio context.
 *
 * Phaser opened one regardless, and every teardown — a hot reload, a StrictMode
 * double-mount, a tab switch — raced to suspend a context that was already closed:
 *   InvalidStateError: Cannot suspend a closed AudioContext.
 *
 * The reliable guard is the cause, not the symptom: count context constructions.
 * The symptom needs a real browser tab and dev-mode remounting to surface, which a
 * headless run does not reproduce.
 */
test('the game never constructs an audio context', async ({ page }) => {
  await page.addInitScript(() => {
    const store = window as unknown as { __audioContexts: number };
    store.__audioContexts = 0;
    for (const key of ['AudioContext', 'webkitAudioContext'] as const) {
      const Original = (window as unknown as Record<string, unknown>)[key] as
        | (new (...args: unknown[]) => object)
        | undefined;
      if (!Original) continue;
      (window as unknown as Record<string, unknown>)[key] = new Proxy(Original, {
        construct(target, args) {
          store.__audioContexts += 1;
          return Reflect.construct(target, args);
        },
      });
    }
  });

  await page.goto('/?fixture=interaction-spike');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);

  const created = await page.evaluate(
    () => (window as unknown as { __audioContexts: number }).__audioContexts,
  );
  expect(created).toBe(0);
});

test('remounting and backgrounding the game raises no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/?fixture=interaction-spike');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });

  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(400);

  await page.goto('about:blank');
  await page.waitForTimeout(400);

  expect(errors).toEqual([]);
});
