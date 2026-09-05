import { expect, test } from '@playwright/test';
import fixture from '../src/test/fixtures/outreachOverlap.json';
import { getCandidateScenario } from '../src/content/loadScenario';
import { validateAndMigrateSave } from '../src/persistence/saveMigrations';
import type { TermState } from '../src/domain/types';

const SAVE_KEY = 'congress-game.save.current';
test('resumes the archived overlapping outreach, recovers its packet, and reloads the honest checkpoint', async ({ page }) => {
  await page.addInitScript(({ key, envelope }) => {
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, JSON.stringify(envelope));
  }, { key: SAVE_KEY, envelope: fixture.acceptedEnvelope });
  await page.goto('/');
  await page.getByTestId('session-resume').click();
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  const state = () => page.evaluate(() => window.__congressGameTestApi!.getState()) as Promise<TermState>;
  expect((await state()).activeWork).toHaveLength(2);
  await page.getByTestId('week-fast-forward').click();
  await expect.poll(async () => (await state()).pendingDecisions.filter((decision) => decision.status === 'pending').length).toBe(1);
  if (!await page.getByTestId('decision-modal').isVisible()) await page.getByTestId('decision-trigger').click();
  await page.getByRole('button', { name: 'Refuse without cost', exact: true }).click();
  await page.getByTestId('week-fast-forward').click();
  await expect.poll(async () => (await state()).activeWork.length).toBe(0);
  await expect(page.getByTestId('hud-result')).toContainText('Reserved cards returned');
  const recovered = await state();
  expect(recovered.cards.find((card) => card.id === 'card-17')).toMatchObject({ form: 'prepared', status: 'idle' });
  expect(recovered.eventLog.filter((event) => event.type === 'WORK_RECOVERED')).toHaveLength(1);
  expect(recovered.eventLog.some((event) => event.type === 'PATTERN_COMPLETED' && event.workId === 'work-9')).toBe(false);
  expect(recovered.resources.staffAttention).toBe(3);
  const savedBytes = await page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY);
  expect(validateAndMigrateSave(JSON.parse(savedBytes!), getCandidateScenario()).kind).toBe('valid');
  await page.reload();
  await page.getByTestId('session-resume').click();
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  const resumed = await state();
  expect(resumed.cards.find((card) => card.id === 'card-17')).toEqual(recovered.cards.find((card) => card.id === 'card-17'));
  expect(resumed.resources).toEqual(recovered.resources);
  expect(resumed.eventLog).toEqual(recovered.eventLog);
  expect(resumed.activeWork).toHaveLength(0);
});
