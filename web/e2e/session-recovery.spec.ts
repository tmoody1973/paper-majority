import { expect, test, type Page } from '@playwright/test';

import type { TermState } from '../src/domain/types';

async function state(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

async function waitForSession(page: Page) {
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.getByTestId('week-summary')).toBeVisible({ timeout: 15_000 });
}

async function idFor(page: Page, definitionId: string, form?: TermState['cards'][number]['form']) {
  const card = (await state(page)).cards.find((candidate) =>
    candidate.definitionId === definitionId && (form === undefined || candidate.form === form),
  );
  if (!card) throw new Error(`missing ${definitionId}${form ? ` (${form})` : ''}`);
  return card.id;
}

async function stage(page: Page, cardId: string) {
  await page.getByTestId('work-mat-picker').selectOption(cardId);
  await page.getByTestId('work-mat-stage').click();
}

async function reload(page: Page) {
  await page.reload();
  await waitForSession(page);
}

test('a complete first week remains coherent through paid work, decision and reloads', async ({ page }) => {
  await page.goto('/workbench/session-recovery');
  await waitForSession(page);
  await expect(page.getByRole('list', { name: 'Open obligations' })).toContainText('Answer renter concern');

  // Paid work is checkpointed at acceptance. Reloading carries the same absolute
  // reservation and paid cost without advancing browser-offline time.
  await stage(page, await idFor(page, 'staff-policy-aide'));
  await stage(page, await idFor(page, 'evidence-rent-burden-report', 'raw'));
  await page.getByTestId('work-mat-begin').click();
  const paidStart = await state(page);
  expect(paidStart.activeWork).toHaveLength(1);
  expect(paidStart.resources.staffAttention).toBe(2);
  const completesAt = paidStart.activeWork[0].completesAtSimulationMs;
  await reload(page);
  const carried = await state(page);
  expect(carried.paused).toBe(true);
  expect(carried.simulationMs).toBe(paidStart.simulationMs);
  expect(carried.activeWork[0].completesAtSimulationMs).toBe(completesAt);
  expect(carried.activeWork[0].paidCost.staffAttention).toBe(1);
  await page.getByTestId('week-fast-forward').click();

  const summary = await idFor(page, 'evidence-rent-burden-report', 'summary');
  await stage(page, await idFor(page, 'staff-legislative-counsel'));
  await stage(page, summary);
  await stage(page, await idFor(page, 'policy-housing-choice-voucher', 'raw'));
  await page.getByTestId('work-mat-begin').click();
  await reload(page);
  expect((await state(page)).activeWork).toHaveLength(1);
  await page.getByTestId('week-fast-forward').click();

  const draft = await idFor(page, 'policy-housing-choice-voucher', 'drafted');
  await page.getByTestId('bill-docket-picker').selectOption(draft);
  await page.getByTestId('bill-docket-add').click();
  await expect(page.getByTestId('bill-docket-revision')).toHaveText('Revision 1');
  expect((await state(page)).bill.revision).toBe(1);
  await expect(page.getByTestId('session-save-warning')).toHaveCount(0);

  await stage(page, await idFor(page, 'staff-policy-aide'));
  await stage(page, await idFor(page, 'coalition-office-hillcrest'));
  await page.getByTestId('work-mat-begin').click();
  await reload(page);
  expect((await state(page)).activeWork).toHaveLength(1);
  expect((await state(page)).bill.revision).toBe(1);
  await page.getByTestId('week-fast-forward').click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // The presented demand is itself checkpointed, so this reload happens
  // immediately before the paid/reputational choice.
  await reload(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  const capitalBeforeChoice = (await state(page)).resources.politicalCapital;
  await page.getByTestId('decision-resolve-accept').click();
  await expect(page.getByTestId('bill-docket-revision')).toHaveText('Revision 2');
  const acceptedChoice = await state(page);
  expect(acceptedChoice.resources.politicalCapital).toBe(capitalBeforeChoice - 1);
  expect(acceptedChoice.rewardedOccurrenceIds).toEqual(['demand-renter-protection:revision:1']);
  await reload(page);
  const recoveredChoice = await state(page);
  expect(recoveredChoice.resources.politicalCapital).toBe(capitalBeforeChoice - 1);
  expect(recoveredChoice.rewardedOccurrenceIds).toEqual(acceptedChoice.rewardedOccurrenceIds);
  await expect(page.getByTestId('bill-docket-provision-policy-zoning-incentive')).toBeVisible();

  await page.getByTestId('week-end-early').click();
  await expect(page.getByTestId('week-boundary-preview')).toContainText('District Trust -5');
  await page.getByTestId('week-confirm').click();
  await expect(page.getByText('2 of 6')).toBeVisible();
  await reload(page);

  const recovered = await state(page);
  expect(recovered.week).toBe(2);
  expect(recovered.bill.revision).toBe(2);
  expect(recovered.bill.provisionIds).toEqual(['policy-zoning-incentive']);
  expect(recovered.relationships.find((item) => item.memberId === 'coalition-office-hillcrest')?.support).toBe('committed');
  expect(recovered.resources).toMatchObject({ staffAttention: 3, politicalCapital: 2, districtTrust: 55 });
  expect(recovered.resolvedWeekIds).toContain('week:1');
  expect(recovered.rewardedOccurrenceIds).toEqual(['demand-renter-protection:revision:1']);
  expect(recovered.obligations[0].status).toBe('missed');
  expect(recovered.eventLog).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'PATTERN_COMPLETED', patternId: 'pattern-summarize-evidence' }),
    expect.objectContaining({ type: 'PATTERN_COMPLETED', patternId: 'pattern-draft-policy' }),
    expect.objectContaining({ type: 'PATTERN_COMPLETED', patternId: 'pattern-coalition-outreach' }),
    expect.objectContaining({ type: 'WEEK_RESOLVED', week: 1 }),
  ]));
  expect(recovered.cards.find((card) => card.definitionId === 'constituency-renter-concern')?.location).toBe('filed');
});
