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

async function stage(page: Page, cardId: string) {
  await page.getByTestId('work-mat-picker').selectOption(cardId);
  await page.getByTestId('work-mat-stage').click();
  await expect(page.getByTestId(`work-mat-ghost-${cardId}`)).toBeVisible({ timeout: 10_000 });
}

async function begin(page: Page, cardIds: string[]) {
  for (const cardId of cardIds) await stage(page, cardId);
  await page.getByTestId('work-mat-begin').click();
  await expect.poll(async () => (await state(page)).activeWork.length, { timeout: 10_000 }).toBeGreaterThan(0);
}

async function openWorkbench(page: Page) {
  await page.goto('/workbench');
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.getByTestId('bill-docket')).toBeVisible({ timeout: 15_000 });
}

async function runOutreach(page: Page, officeDefinitionId: string) {
  await begin(page, [
    await idFor(page, 'staff-policy-aide'),
    await idFor(page, officeDefinitionId),
  ]);
  if ((await state(page)).paused) await page.getByTestId('hud-pause').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
}

async function waitForForm(page: Page, definitionId: string, form: string) {
  await expect.poll(async () => (await state(page)).cards.some(
    (card) => card.definitionId === definitionId && card.form === form,
  ), { timeout: 10_000 }).toBe(true);
}

test('opposing-party agreement preserves identity and values-derived integrity', async ({ page }) => {
  await openWorkbench(page);
  await runOutreach(page, 'coalition-office-ridgeline');

  await expect(page.getByRole('dialog')).toContainText('republican');
  await page.getByTestId('decision-resolve-accept').click();

  const accepted = await state(page);
  expect(accepted.player.party).toBe('democratic');
  expect(accepted.resources.policyIntegrity).toBe(76);
  expect(accepted.relationships.find((entry) => entry.memberId === 'coalition-office-ridgeline')?.support).toBe('committed');
  expect(accepted.bill.provisionReceipts[0]).toMatchObject({
    origin: 'decision',
    sourceId: 'demand-rural-supply',
    sourceDefinitionIds: ['policy-housing-choice-voucher'],
  });
  await expect(page.getByTestId('bill-docket-provision-policy-housing-choice-voucher')).toContainText('Negotiated');
});

test('same-party refusal is an explicit accepted decision', async ({ page }) => {
  await openWorkbench(page);
  await runOutreach(page, 'coalition-office-hillcrest');

  await expect(page.getByTestId('decision-choice-accept')).toContainText('Tenant Stability');
  await page.getByTestId('decision-resolve-reject').click();

  const refused = await state(page);
  expect(refused.relationships.find((entry) => entry.memberId === 'coalition-office-hillcrest')?.support).toBe('refused');
  expect(refused.eventLog.filter((event) => event.type === 'DECISION_RESOLVED')).toHaveLength(1);
  expect(refused.eventLog.filter((event) => event.type === 'OPPORTUNITY_DECLINED')).toHaveLength(1);
  await expect(page.getByTestId('coalition-status-coalition-office-hillcrest')).toContainText('refused');
});

test('counteroffer reserves visible evidence and staff, then fulfills the exact promise', async ({ page }) => {
  await openWorkbench(page);

  await begin(page, [
    await idFor(page, 'staff-policy-aide'),
    await idFor(page, 'evidence-rent-burden-report'),
  ]);
  await page.getByTestId('hud-pause').click();
  await waitForForm(page, 'evidence-rent-burden-report', 'summary');

  await begin(page, [
    await idFor(page, 'staff-district-director'),
    await idFor(page, 'evidence-rent-burden-report', 'summary'),
    await idFor(page, 'coalition-office-hillcrest'),
    await idFor(page, 'constituency-renter-concern'),
  ]);
  await waitForForm(page, 'evidence-rent-burden-report', 'prepared');

  await runOutreach(page, 'coalition-office-hillcrest');
  const counter = page.getByTestId('decision-choice-counter');
  await expect(counter).toContainText('District Director');
  await expect(counter).toContainText('Rent Burden Report');
  await expect(counter).toContainText('Consumes Rent Burden Report');
  await page.getByTestId('decision-resolve-counter').click();

  const working = await state(page);
  expect(working.activeWork).toHaveLength(1);
  expect(working.activeWork[0].decisionOrigin).toMatchObject({
    choiceId: 'choice-counter-renter-protection',
    officeDefinitionId: 'coalition-office-hillcrest',
  });
  expect(working.resources.staffAttention).toBe(2);
  expect(working.eventLog.filter((event) => event.type === 'WORK_SUBMITTED')).toHaveLength(4);
  expect(working.eventLog.filter((event) => event.type === 'DECISION_RESOLVED')).toHaveLength(1);
  await page.getByTestId('hud-pause').click();
  await expect.poll(async () => (await state(page)).activeWork.length, { timeout: 10_000 }).toBe(0);
  const completed = await state(page);
  expect(completed.resources.staffAttention).toBe(3);
  expect(completed.relationships.find((entry) => entry.memberId === 'coalition-office-hillcrest')?.support).toBe('committed');
  expect(completed.eventLog.filter((event) => event.type === 'PROMISE_CHANGED' && event.status === 'fulfilled')).toHaveLength(1);
});
