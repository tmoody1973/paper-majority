import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import type { TermState } from '../src/domain/types';

const PROFILE_KEY = 'congress-game.player-profile';
const SAVE_KEY = 'congress-game.save.current';

async function state(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

async function waitForSession(page: Page) {
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.getByTestId('week-summary')).toBeVisible({ timeout: 15_000 });
}

async function newProfile(
  browser: Browser,
  origin: string,
  returning = false,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: origin });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  if (returning) {
    await context.addInitScript(({ key }) => {
      window.localStorage.setItem(key, JSON.stringify({
        schemaVersion: 1,
        lifetimeDiscoveredPatternIds: ['pattern-summarize-evidence'],
      }));
    }, { key: PROFILE_KEY });
  }
  const page = await context.newPage();
  return { context, page };
}

async function importChallenge(page: Page, code: string) {
  await page.goto('/');
  await expect(page.getByTestId('challenge-code-input')).toBeVisible();
  await page.getByTestId('challenge-code-input').fill(code);
  await page.getByTestId('challenge-start').focus();
  await page.keyboard.press('Enter');
  await waitForSession(page);
}

function withReducedMotion(code: string, reducedMotion: boolean): string {
  const separator = code.indexOf(':');
  const setup = JSON.parse(decodeURIComponent(code.slice(separator + 1))) as {
    settings: { reducedMotion: boolean };
  };
  setup.settings.reducedMotion = reducedMotion;
  return `${code.slice(0, separator + 1)}${encodeURIComponent(JSON.stringify(setup))}`;
}

test('replays one exported setup across clean and returning browser profiles and preserves a run on rejection', async ({ browser, context, page }) => {
  test.setTimeout(60_000);
  const origin = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:3100').origin;
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await page.goto('/');
  await page.getByTestId('session-district').selectOption('TX-24');
  await page.getByLabel('Party').selectOption('republican');
  await page.getByLabel('First governing value').selectOption('Fair Access');
  await page.getByLabel('Second governing value').selectOption('Local Control');
  await page.getByLabel('Seed').fill('918273');
  await page.getByLabel('Pace').selectOption('brisk');
  await page.getByLabel('Guidance').selectOption('expert');
  await page.getByLabel('Session style').selectOption('breaking-cycle');
  await page.getByTestId('copy-challenge-setup').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('challenge-notice')).toContainText('Challenge copied locally');
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code.length).toBeLessThanOrEqual(8_192);

  await page.getByTestId('session-start-new').click();
  await waitForSession(page);
  const exportedState = await state(page);
  expect(exportedState).toMatchObject({
    seed: 918273,
    rngCursor: 13,
    player: { districtId: 'TX-24', party: 'republican', values: ['Fair Access', 'Local Control'] },
    settings: { pace: 'brisk', guidance: 'expert', termStyle: 'breaking-cycle' },
  });
  expect(exportedState.storyHistory).toHaveLength(1);
  expect(exportedState.pendingStoryDecisions).toHaveLength(1);
  expect(exportedState.cards.some((card) => card.staffTraitId !== undefined)).toBe(true);

  const clean = await newProfile(browser, origin);
  await importChallenge(clean.page, code);
  expect(await state(clean.page)).toEqual(exportedState);

  const returning = await newProfile(browser, origin, true);
  await importChallenge(returning.page, code);
  expect(await state(returning.page)).toEqual(exportedState);
  await returning.page.keyboard.press('Escape');
  await expect(returning.page.getByTestId('story-decision-modal')).not.toBeVisible();
  await returning.page.getByTestId('hud-handbook').click();
  await expect(returning.page.getByTestId('handbook-entry-pattern-summarize-evidence')).toContainText('Remembered');
  expect(await state(returning.page)).toEqual(exportedState);

  const explicitMotion = await newProfile(browser, origin);
  await explicitMotion.context.addInitScript(() => {
    window.matchMedia = () => ({ matches: false }) as MediaQueryList;
  });
  await importChallenge(explicitMotion.page, withReducedMotion(code, true));
  const explicitMotionState = await state(explicitMotion.page);
  expect(explicitMotionState.settings.reducedMotion).toBe(true);
  expect({ ...explicitMotionState, settings: { ...explicitMotionState.settings, reducedMotion: false } })
    .toEqual(exportedState);

  const savedBytes = await clean.page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY);
  if (!savedBytes) throw new Error('Imported challenge did not create a checkpoint');
  await clean.page.reload();
  await expect(clean.page.getByTestId('session-resume')).toBeVisible();
  await clean.page.getByTestId('challenge-code-input').fill('paper-majority.challenge.v1:%7Bbad');
  await clean.page.getByTestId('challenge-start').click();
  await expect(clean.page.getByTestId('challenge-notice')).toContainText('could not be read');
  expect(await clean.page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)).toBe(savedBytes);
  await clean.page.getByTestId('session-resume').click();
  await waitForSession(clean.page);
  expect(await state(clean.page)).toEqual(exportedState);

  await clean.context.close();
  await returning.context.close();
  await explicitMotion.context.close();
});
