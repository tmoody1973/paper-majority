import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { getCandidateScenario } from '../src/content/loadScenario';
import type { GameCommand } from '../src/domain/commands';
import type { TermState } from '../src/domain/types';
import { chooseCommand } from '../scripts/balance/policies';

const scenario = getCandidateScenario();
const SAVE_KEY = 'congress-game.save.current';

async function state(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

async function keyboardActivate(page: Page, locator: Locator): Promise<void> {
  await locator.focus();
  await page.keyboard.press('Enter');
}

async function selectByKeyboard(page: Page, locator: Locator, value: string): Promise<void> {
  const label = await locator.locator(`option[value="${value}"]`).textContent();
  if (!label) throw new Error(`No visible option for ${value}`);
  await locator.focus();
  await page.keyboard.type(label);
  await expect(locator).toHaveValue(value);
}

async function stageByKeyboard(page: Page, cardId: string): Promise<void> {
  const picker = page.getByTestId('work-mat-picker');
  await selectByKeyboard(page, picker, cardId);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('work-mat-stage')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByTestId(`work-mat-ghost-${cardId}`)).toBeVisible();
}

async function moveVisibleCardWithPointer(page: Page, cardId: string): Promise<void> {
  const canvas = await page.locator('canvas').boundingBox();
  const point = await page.evaluate((id) => (
    window as unknown as {
      __congressGameCamera: { getExposedScreenPoint(cardId: string): { x: number; y: number } | undefined };
    }
  ).__congressGameCamera.getExposedScreenPoint(id), cardId);
  if (!canvas || !point) throw new Error(`No exposed canvas point for ${cardId}`);
  const before = (await state(page)).cards.find((card) => card.id === cardId)!;
  await page.mouse.move(canvas.x + point.x, canvas.y + point.y);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 80, canvas.y + 90, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => {
    const card = (await state(page)).cards.find((entry) => entry.id === cardId)!;
    return `${card.x}:${card.y}`;
  }).not.toBe(`${before.x}:${before.y}`);
}

async function performCommand(page: Page, command: GameCommand): Promise<void> {
  switch (command.type) {
    case 'RESOLVE_STORY': {
      const event = scenario.storyEvents.find((entry) =>
        entry.choices.some((choice) => choice.id === command.choiceId));
      const label = event?.choices.find((choice) => choice.id === command.choiceId)?.label;
      if (!label) throw new Error(`Unknown Story choice ${command.choiceId}`);
      if (!await page.getByTestId('story-decision-modal').isVisible()) {
        await keyboardActivate(page, page.getByTestId('story-decision-trigger'));
      }
      await keyboardActivate(page, page.getByRole('button', { name: label, exact: true }));
      break;
    }
    case 'RESOLVE_DECISION': {
      const choice = scenario.decisionChoices.find((entry) => entry.id === command.choiceId);
      if (!choice) throw new Error(`Unknown coalition choice ${command.choiceId}`);
      if (!await page.getByTestId('decision-modal').isVisible()) {
        await keyboardActivate(page, page.getByTestId('decision-trigger'));
      }
      await keyboardActivate(page, page.getByTestId(`decision-resolve-${choice.action}`));
      break;
    }
    case 'OPEN_PACK':
      await keyboardActivate(page, page.getByTestId(`open-pack-${command.categoryId}`));
      break;
    case 'SUBMIT_WORK':
      await expect(page.locator('[data-testid^="work-mat-ghost-"]')).toHaveCount(0);
      for (const cardId of command.cardIds) await stageByKeyboard(page, cardId);
      await keyboardActivate(page, page.getByTestId('work-mat-begin'));
      break;
    case 'START_ASSIGNMENT':
      await selectByKeyboard(page, page.getByTestId('controls-source'), command.staffCardId);
      await selectByKeyboard(page, page.getByTestId('controls-target'), command.targetCardId);
      await keyboardActivate(page, page.getByTestId(command.assignmentKind === 'study-tactic'
        ? 'controls-study'
        : 'controls-combine'));
      break;
    case 'DOCKET_PROVISION':
      await selectByKeyboard(page, page.getByTestId('bill-docket-picker'), command.cardId);
      await keyboardActivate(page, page.getByTestId('bill-docket-add'));
      break;
    case 'FAST_FORWARD':
      await keyboardActivate(page, page.getByTestId('week-fast-forward'));
      break;
    case 'ADVANCE_WEEK':
      await keyboardActivate(page, command.confirmEarly
        ? page.getByTestId('week-end-early')
        : page.getByTestId('week-confirm'));
      break;
    case 'CONCLUDE_SESSION':
      await keyboardActivate(page, page.getByTestId('session-conclude'));
      break;
    default:
      throw new Error(`UI replay does not support ${command.type}`);
  }
}

test('completes, reloads, and exports a ready Session through actual controls', async ({ context, page }) => {
  test.setTimeout(120_000);
  const origin = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:3100').origin;
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await page.goto('/');
  await expect(page).toHaveTitle(/Paper Majority/);
  await page.getByTestId('session-district').selectOption('GA-05');
  await page.getByLabel('Party').selectOption('democratic');
  await page.getByLabel('First governing value').selectOption('Tenant Stability');
  await page.getByLabel('Second governing value').selectOption('Housing Supply');
  await page.getByLabel('Seed').fill('1');
  await keyboardActivate(page, page.getByTestId('session-start-new'));
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });

  const opening = await state(page);
  const openingCommand = chooseCommand('district-advocate', opening, scenario);
  expect(openingCommand.type).toBe('RESOLVE_STORY');
  await performCommand(page, openingCommand);
  const aide = opening.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
  await moveVisibleCardWithPointer(page, aide.id);

  for (let count = 0; count < 200; count += 1) {
    const before = await state(page);
    if (before.runStatus === 'complete') break;
    const command = chooseCommand('district-advocate', before, scenario);
    await performCommand(page, command);
    await expect.poll(async () => {
      const after = await state(page);
      return `${after.runStatus}|${after.week}|${after.simulationMs}|${after.eventLog.length}|${after.bill.revision}`;
    }).not.toBe(`${before.runStatus}|${before.week}|${before.simulationMs}|${before.eventLog.length}|${before.bill.revision}`);
  }

  const completed = await state(page);
  expect(completed.runStatus).toBe('complete');
  expect(completed.sessionRecord?.outcome).toBe('ready');
  expect(completed.activeWork).toEqual([]);
  await expect(page.getByTestId('session-record')).toContainText('Ready to move forward');
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  const frozenRecord = JSON.stringify(completed.sessionRecord);
  const frozenSetup = completed.sessionRecord!.setup;
  const savedBytes = await page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY);
  if (!savedBytes) throw new Error('Ready Session did not save its exact checkpoint');
  await keyboardActivate(page, page.getByTestId('session-copy-record'));
  expect(JSON.stringify(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())))).toBe(frozenRecord);
  const exportControl = page.getByTestId('session-record-export');
  await expect(exportControl).toHaveAttribute('download', /paper-majority/);
  const downloadPromise = page.waitForEvent('download');
  await keyboardActivate(page, exportControl);
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Record export did not create a local download');
  expect(JSON.stringify(JSON.parse(await readFile(downloadPath, 'utf8')))).toBe(frozenRecord);

  await page.reload();
  await expect(page.getByTestId('session-resume')).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)).toBe(savedBytes);
  await keyboardActivate(page, page.getByTestId('session-resume'));
  await expect(page.getByTestId('session-record')).toBeVisible();
  const reloaded = await state(page);
  expect(JSON.stringify(reloaded.sessionRecord)).toBe(frozenRecord);
  expect(reloaded.sessionRecord?.setup).toEqual(frozenSetup);
  expect(reloaded.sessionRecord?.outcome).toBe('ready');
});
