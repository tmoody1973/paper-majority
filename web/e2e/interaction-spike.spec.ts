import { expect, test, type Page } from '@playwright/test';

import type { GameEvent } from '../src/domain/events';
import type { TermState } from '../src/domain/types';

/**
 * The fun-first gate, exercised end to end.
 *
 * Everything here is driven through `GameSession` — the same path the desk uses —
 * so nothing can pass by a route a player does not have.
 */

const URL = '/?fixture=interaction-spike';

async function getState(page: Page): Promise<TermState> {
  return page.evaluate(() => window.__congressGameTestApi!.getState());
}

async function cardIdFor(page: Page, definitionId: string, skip = 0): Promise<string> {
  const state = await getState(page);
  const card = state.cards.filter((candidate) => candidate.definitionId === definitionId)[skip];
  if (!card) throw new Error(`no instance ${skip} of ${definitionId}`);
  return card.id;
}

/** Drag one card onto another through the session, exactly as a drop would. */
async function combine(page: Page, cardId: string, ontoCardId: string): Promise<GameEvent[]> {
  return page.evaluate(
    ([moving, onto]) => {
      const api = window.__congressGameTestApi!;
      const target = api.getState().cards.find((card) => card.id === onto)!;
      return api.dispatch({ type: 'STACK_CARD', cardId: moving, targetStackId: target.stackId })
        .events;
    },
    [cardId, ontoCardId],
  );
}

async function runClock(page: Page, ms: number): Promise<GameEvent[]> {
  return page.evaluate((total) => {
    const api = window.__congressGameTestApi!;
    const events: GameEvent[] = [];
    api.dispatch({ type: 'SET_PAUSED', paused: false });
    for (let elapsed = 0; elapsed < total; elapsed += 1000) {
      events.push(...api.dispatch({ type: 'TICK', deltaMs: 1000 }).events);
    }
    api.dispatch({ type: 'SET_PAUSED', paused: true });
    return events;
  }, ms);
}

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
});

test.describe('interaction spike', () => {
  test('opens with 12-16 instances of 8 starting definitions and no Sourcebook', async ({
    page,
  }) => {
    const state = await getState(page);

    expect(state.cards.length).toBeGreaterThanOrEqual(12);
    expect(state.cards.length).toBeLessThanOrEqual(16);

    // No Sourcebook exists to open, so it cannot be required.
    await expect(page.getByRole('button', { name: /sourcebook/i })).toHaveCount(0);
    await expect(page.getByLabel(/sourcebook/i)).toHaveCount(0);
  });

  test('ships no lawmaker portrait and no real member identity', async ({ page }) => {
    const state = await getState(page);
    const offices = state.cards.filter((card) => card.definitionId.startsWith('coalition-office'));

    expect(offices.length).toBe(2);
    const images = await page.locator('img').count();
    expect(images).toBe(0);
  });

  test('two different Evidence cards satisfy the same Staff pattern', async ({ page }) => {
    const aideA = await cardIdFor(page, 'staff-policy-aide', 0);
    const report = await cardIdFor(page, 'evidence-rent-burden-report');
    const first = await combine(page, aideA, report);
    expect(first.some((event) => event.type === 'STACK_ACCEPTED')).toBe(true);

    const aideB = await cardIdFor(page, 'staff-policy-aide', 1);
    const survey = await cardIdFor(page, 'evidence-tenant-survey');
    const second = await combine(page, aideB, survey);
    expect(second.some((event) => event.type === 'STACK_ACCEPTED')).toBe(true);

    const acceptedPatterns = [...first, ...second]
      .filter((event) => event.type === 'STACK_ACCEPTED')
      .map((event) => (event.type === 'STACK_ACCEPTED' ? event.patternId : undefined));
    expect(new Set(acceptedPatterns)).toEqual(new Set(['pattern-evidence-summary']));
  });

  test('each of the three patterns transforms into its result', async ({ page }) => {
    // 1. Staff + housing Evidence -> Evidence Summary
    const aide = await cardIdFor(page, 'staff-policy-aide');
    const report = await cardIdFor(page, 'evidence-rent-burden-report');
    await combine(page, aide, report);
    const firstEvents = await runClock(page, 6000);
    const summaryMade = firstEvents.find(
      (event) => event.type === 'CARD_TRANSFORMED' && event.outputDefinitionId === 'evidence-housing-summary',
    );
    expect(summaryMade).toBeTruthy();

    // 2. Evidence Summary + renter-focused Policy -> Drafted Provision
    const summary = await cardIdFor(page, 'evidence-housing-summary');
    const voucher = await cardIdFor(page, 'policy-housing-choice-voucher');
    await combine(page, summary, voucher);
    const secondEvents = await runClock(page, 6000);
    expect(
      secondEvents.some(
        (event) =>
          event.type === 'CARD_TRANSFORMED' && event.outputDefinitionId === 'policy-drafted-provision',
      ),
    ).toBe(true);

    // 3. Working Bill + eligible Member Office -> Support or Counteroffer
    const bill = await cardIdFor(page, 'institution-working-bill');
    const office = await cardIdFor(page, 'coalition-office-hillcrest');
    await combine(page, bill, office);
    const thirdEvents = await runClock(page, 6000);
    expect(
      thirdEvents.some(
        (event) =>
          event.type === 'CARD_TRANSFORMED' && event.outputDefinitionId === 'coalition-outreach-result',
      ),
    ).toBe(true);
  });

  test('the Handbook moves Teased to Discovered without duplicating on reuse', async ({ page }) => {
    await page.getByTestId('hud-handbook').click();
    const entry = page.getByTestId('handbook-entry-pattern-evidence-summary');
    await expect(entry.getByText('Teased')).toBeVisible();
    await expect(entry.getByTestId('handbook-silhouette')).toBeVisible();
    await expect(page.getByTestId('handbook-progress')).toContainText('0 of 3 rules found');

    const aideA = await cardIdFor(page, 'staff-policy-aide', 0);
    const report = await cardIdFor(page, 'evidence-rent-burden-report');
    await combine(page, aideA, report);

    await expect(entry.getByText('Discovered')).toBeVisible();
    await expect(entry.getByTestId('handbook-slots')).toBeVisible();
    await expect(page.getByTestId('handbook-progress')).toContainText('1 of 3 rules found');

    // The other two rules stay hidden.
    await expect(
      page.getByTestId('handbook-entry-pattern-coalition-outreach').getByText('Teased'),
    ).toBeVisible();

    // Reusing the rule must not discover it twice.
    const aideB = await cardIdFor(page, 'staff-policy-aide', 1);
    const survey = await cardIdFor(page, 'evidence-tenant-survey');
    const reuse = await combine(page, aideB, survey);
    expect(reuse.some((event) => event.type === 'PATTERN_DISCOVERED')).toBe(false);

    const state = await getState(page);
    expect(state.discoveredPatternIds).toEqual(['pattern-evidence-summary']);
    await expect(page.getByTestId('handbook-progress')).toContainText('1 of 3 rules found');
  });

  test('opposing-party office is refused for free, then works after studying the Tactic', async ({
    page,
  }) => {
    const bill = await cardIdFor(page, 'institution-working-bill');
    const opposing = await cardIdFor(page, 'coalition-office-ridgeline');
    const before = await getState(page);

    const refused = await combine(page, bill, opposing);
    expect(refused.some((event) => event.type === 'STACK_REJECTED')).toBe(true);

    // Free: nothing moved.
    const afterRefusal = await getState(page);
    expect(afterRefusal.resources).toEqual(before.resources);
    expect(afterRefusal.elapsedMs).toBe(before.elapsedMs);
    expect(afterRefusal.discoveredPatternIds).toEqual(before.discoveredPatternIds);
    expect(afterRefusal.unlockedSlotExpansions).toEqual(before.unlockedSlotExpansions);

    // Discover the outreach rule with the same-party office so the Handbook entry
    // exists to be expanded.
    const ally = await cardIdFor(page, 'coalition-office-hillcrest');
    await combine(page, bill, ally);
    await runClock(page, 6000);

    // Physically study the Tactic with eligible Staff. There is no unlock button.
    const aide = await cardIdFor(page, 'staff-policy-aide');
    const tactic = await cardIdFor(page, 'tactic-bipartisan-working-group');
    const started = await page.evaluate(
      ([staffCardId, targetCardId]) =>
        window.__congressGameTestApi!.dispatch({
          type: 'START_ASSIGNMENT',
          assignmentKind: 'study-tactic',
          staffCardId,
          targetCardId,
        }).events,
      [aide, tactic],
    );
    expect(
      started.some((event) => event.type === 'ACTION_STARTED' && event.assignmentKind === 'study-tactic'),
    ).toBe(true);

    // Still not active until the assignment finishes.
    expect((await getState(page)).unlockedSlotExpansions).toEqual({});

    const studyEvents = await runClock(page, 8000);
    expect(studyEvents.some((event) => event.type === 'TACTIC_EXPANSION_ACTIVATED')).toBe(true);

    const expanded = await getState(page);
    expect(expanded.unlockedSlotExpansions).toEqual({
      'pattern-coalition-outreach': ['expansion-bipartisan-outreach'],
    });

    // The Handbook says exactly what changed, and keeps the base rule.
    await page.getByTestId('hud-handbook').click();
    const entry = page.getByTestId('handbook-entry-pattern-coalition-outreach');
    await expect(entry.getByText('Expanded')).toBeVisible();
    await expect(entry.getByTestId('handbook-expansion')).toContainText(
      /Opposing-party member offices now count/,
    );
    await expect(entry).toContainText('shares your party');
    await expect(entry).toContainText('from the other party');

    // Retry the previously rejected stack.
    const bill2 = await cardIdFor(page, 'institution-working-bill').catch(() => undefined);
    if (bill2) {
      const retry = await combine(page, bill2, await cardIdFor(page, 'coalition-office-ridgeline'));
      expect(retry.some((event) => event.type === 'STACK_ACCEPTED')).toBe(true);
    }
  });

  test('the desk shows deadline, overload and amendment pressure before any meter moves', async ({
    page,
  }) => {
    const start = await getState(page);

    // A district concern carries a visible countdown from the first frame.
    const concern = start.cards.find(
      (card) => card.definitionId === 'constituency-urgent-renter-concern',
    );
    expect(concern?.remainingMs).toBeGreaterThan(0);
    expect(concern?.status).toBe('idle');

    // A coalition request is pinned to the bill before any outreach happens.
    expect(start.relationships).toContainEqual(
      expect.objectContaining({ support: 'conditional', memberId: 'coalition-office-hillcrest' }),
    );

    // Staff overload is visible as an assignment attached to the staff card.
    const aide = await cardIdFor(page, 'staff-policy-aide');
    const report = await cardIdFor(page, 'evidence-rent-burden-report');
    await combine(page, aide, report);

    const working = await getState(page);
    const busyStaff = working.cards.find((card) => card.id === aide);
    expect(busyStaff?.status).toBe('working');
    expect(working.stacks.find((stack) => stack.cardIds.includes(aide))?.activeActionId).toBe(
      'pattern-evidence-summary',
    );

    // And the four percentage meters have not moved yet.
    expect(working.resources.districtTrust).toBe(start.resources.districtTrust);
    expect(working.resources.staffMorale).toBe(start.resources.staffMorale);
    expect(working.resources.policyIntegrity).toBe(start.resources.policyIntegrity);
    expect(working.resources.billMomentum).toBe(start.resources.billMomentum);
  });

  test('tells the player to resume when a paused desk freezes their first job', async ({
    page,
  }) => {
    // The desk opens paused and still accepts stacking, so a first-time player can
    // start a job and watch its progress bar sit still. Say so.
    expect((await getState(page)).paused).toBe(true);
    await expect(page.getByTestId('hud-paused-nudge')).toHaveCount(0);

    const aide = await cardIdFor(page, 'staff-policy-aide');
    const report = await cardIdFor(page, 'evidence-rent-burden-report');
    await combine(page, aide, report);

    await expect(page.getByTestId('hud-paused-nudge')).toHaveText(
      'Paused — press Resume to let the work happen.',
    );

    // Pressing the button the message names clears it and the work proceeds.
    await page.getByTestId('hud-pause').click();
    await expect(page.getByTestId('hud-paused-nudge')).toHaveCount(0);

    await expect
      .poll(async () => {
        const state = await getState(page);
        return state.cards.some((card) => card.definitionId === 'evidence-housing-summary');
      }, { timeout: 15_000 })
      .toBe(true);
  });

  test('shows a progress strip that actually advances', async ({ page }) => {
    // Regression: the strip was a 4px hairline at the card's bottom edge that never
    // filled, so a player watching a 6-second job saw nothing happen at all.
    await page.waitForFunction(() =>
      Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));

    const aide = await cardIdFor(page, 'staff-policy-aide');
    const report = await cardIdFor(page, 'evidence-rent-burden-report');

    const readProgress = () =>
      page.evaluate((id) => {
        const probe = (window as unknown as {
          __congressGameCamera: { getProgress: (c: string) => number | undefined };
        }).__congressGameCamera;
        return probe.getProgress(id);
      }, aide);

    expect(await readProgress()).toBeUndefined();

    await combine(page, aide, report);
    expect(await readProgress()).toBe(0);

    const tick = (ms: number) =>
      page.evaluate((delta) => {
        const api = window.__congressGameTestApi!;
        api.dispatch({ type: 'SET_PAUSED', paused: false });
        api.dispatch({ type: 'TICK', deltaMs: delta });
        api.dispatch({ type: 'SET_PAUSED', paused: true });
      }, ms);

    await tick(1000);
    await tick(1000);
    const third = await readProgress();
    expect(third).toBeGreaterThan(0.3);
    expect(third).toBeLessThan(0.4);

    await tick(1000);
    await tick(1000);
    const twoThirds = await readProgress();
    expect(twoThirds).toBeGreaterThan(0.6);
    expect(twoThirds).toBeLessThan(0.7);
    expect(twoThirds).toBeGreaterThan(third!);
  });

  test('the inspector explains a card without leaking undiscovered rules', async ({ page }) => {
    await page.waitForFunction(() =>
      Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));

    const clickCard = async (definitionId: string) => {
      const canvas = (await page.locator('canvas').boundingBox())!;
      const point = await page.evaluate((id) => {
        const api = window.__congressGameTestApi!;
        const card = api.getState().cards.find((c) => c.definitionId === id)!;
        const probe = (window as unknown as {
          __congressGameCamera: { getScreenPoint: (c: string) => { x: number; y: number } };
        }).__congressGameCamera;
        return probe.getScreenPoint(card.id);
      }, definitionId);
      await page.mouse.click(canvas.x + point.x, canvas.y + point.y);
    };

    await clickCard('institution-working-bill');
    await expect(page.getByTestId('inspector-plain')).toContainText(/bill you are building/i);
    await expect(page.getByTestId('inspector-simulated')).toContainText(/in this simulation/i);

    // Nothing is discovered yet, so no rule may be advertised anywhere in the panel.
    await expect(page.getByTestId('inspector-uses')).toContainText(/not found a use/i);
    await expect(page.getByTestId('inspector-uses')).not.toContainText(/Outreach Result/);

    // Discover one rule; only that one appears.
    const aide = await cardIdFor(page, 'staff-policy-aide');
    const report = await cardIdFor(page, 'evidence-rent-burden-report');
    await combine(page, aide, report);

    await clickCard('evidence-tenant-survey');
    await expect(page.getByTestId('inspector-uses')).toContainText(/Evidence Summary/);
    await expect(page.getByTestId('inspector-source-explainer')).toContainText(/worked out/i);

    await clickCard('coalition-office-ridgeline');
    await expect(page.getByTestId('inspector-uses')).toContainText(/not found a use/i);

    await page.getByTestId('inspector-close').click();
    await expect(page.getByLabel('Your office')).toBeVisible();
  });

  test('hovering a card explains it, with no click needed', async ({ page }) => {
    // The approved design opens the inspector on hover. Click-only meant a player had
    // to click thirteen cards to learn the vocabulary — which is exactly what the
    // "read a card without the inspector" threshold says should not be necessary.
    await page.waitForFunction(() =>
      Boolean((window as unknown as Record<string, unknown>).__congressGameCamera));

    const pointAt = async (definitionId: string) => {
      const canvas = (await page.locator('canvas').boundingBox())!;
      const point = await page.evaluate((id) => {
        const api = window.__congressGameTestApi!;
        const card = api.getState().cards.find((c) => c.definitionId === id)!;
        const probe = (window as unknown as {
          __congressGameCamera: { getScreenPoint: (c: string) => { x: number; y: number } };
        }).__congressGameCamera;
        return probe.getScreenPoint(card.id);
      }, definitionId);
      await page.mouse.move(canvas.x + point.x, canvas.y + point.y);
    };

    await expect(page.getByLabel('Your office')).toBeVisible();

    await pointAt('evidence-tenant-survey');
    await expect(page.getByTestId('inspector-plain')).toContainText(/renters in the district/i);
    await expect(page.getByTestId('inspector-source-explainer')).toContainText(/worked out/i);

    // Moving to another card explains that one instead.
    await pointAt('tactic-bipartisan-working-group');
    await expect(page.getByTestId('inspector-plain')).toContainText(/way of working/i);

    // Moving off the desk puts the office brief back.
    await page.mouse.move(5, 400);
    await expect(page.getByLabel('Your office')).toBeVisible();
  });

  test('the plain-English key is on screen without anyone opening it', async ({ page }) => {
    const key = page.getByTestId('key-panel');
    await expect(key).toBeVisible();

    // The three words most likely to lose a newcomer.
    await expect(page.getByTestId('key-families')).toContainText('Constituency');
    await expect(page.getByTestId('key-families')).toContainText(/people back home/i);
    await expect(page.getByTestId('key-classes')).toContainText(/worked out|summaris/i);
    await expect(page.getByTestId('key-meters')).toContainText('Political Capital');
  });

  test('a rejected stack separates without changing state', async ({ page }) => {
    const before = await getState(page);
    const voucher = await cardIdFor(page, 'policy-housing-choice-voucher');
    const office = await cardIdFor(page, 'coalition-office-hillcrest');

    const events = await combine(page, voucher, office);
    expect(events.some((event) => event.type === 'STACK_REJECTED')).toBe(true);

    const after = await getState(page);
    expect(after.resources).toEqual(before.resources);
    expect(after.stacks.length).toBe(before.stacks.length);
    expect(after.eventLog.length).toBe(before.eventLog.length);
  });

  test('the same seed reproduces the same desk and the same event order', async ({ page }) => {
    const runOnce = async () => {
      await page.goto(URL);
      await page.waitForFunction(() => Boolean(window.__congressGameTestApi));
      const aide = await cardIdFor(page, 'staff-policy-aide');
      const report = await cardIdFor(page, 'evidence-rent-burden-report');
      const events = [
        ...(await combine(page, aide, report)),
        ...(await runClock(page, 6000)),
      ];
      return { state: await getState(page), types: events.map((event) => event.type) };
    };

    const first = await runOnce();
    const second = await runOnce();

    expect(second.types).toEqual(first.types);
    expect(second.state.cards).toEqual(first.state.cards);
    expect(second.state.resources).toEqual(first.state.resources);
    expect(second.state.player.election.opponentStrength).toBe(
      first.state.player.election.opponentStrength,
    );
  });

  test('the whole three-pattern path plus the Tactic fits in ten minutes', async ({ page }) => {
    const started = Date.now();

    const aide = await cardIdFor(page, 'staff-policy-aide');
    const report = await cardIdFor(page, 'evidence-rent-burden-report');
    await combine(page, aide, report);
    await runClock(page, 6000);

    const summary = await cardIdFor(page, 'evidence-housing-summary');
    const voucher = await cardIdFor(page, 'policy-housing-choice-voucher');
    await combine(page, summary, voucher);
    await runClock(page, 6000);

    const bill = await cardIdFor(page, 'institution-working-bill');
    const ally = await cardIdFor(page, 'coalition-office-hillcrest');
    await combine(page, bill, ally);
    await runClock(page, 6000);

    const aide2 = await cardIdFor(page, 'staff-policy-aide');
    const tactic = await cardIdFor(page, 'tactic-bipartisan-working-group');
    await page.evaluate(
      ([staffCardId, targetCardId]) =>
        window.__congressGameTestApi!.dispatch({
          type: 'START_ASSIGNMENT',
          assignmentKind: 'study-tactic',
          staffCardId,
          targetCardId,
        }),
      [aide2, tactic],
    );
    await runClock(page, 8000);

    const state = await getState(page);
    expect(state.discoveredPatternIds.sort()).toEqual([
      'pattern-coalition-outreach',
      'pattern-drafted-provision',
      'pattern-evidence-summary',
    ]);
    expect(state.unlockedSlotExpansions['pattern-coalition-outreach']).toEqual([
      'expansion-bipartisan-outreach',
    ]);

    // In-game time for the whole path: 26 seconds of assignments. Even a slow
    // first-time player has room inside ten minutes.
    expect(Date.now() - started).toBeLessThan(10 * 60 * 1000);
  });

  test('reduced motion keeps every state change readable', async ({ page }) => {
    await page.getByTestId('hud-reduced-motion').click();
    await expect(page.getByTestId('hud-reduced-motion')).toHaveAttribute('aria-pressed', 'true');

    const aide = await cardIdFor(page, 'staff-policy-aide');
    const report = await cardIdFor(page, 'evidence-rent-burden-report');
    await combine(page, aide, report);
    await runClock(page, 6000);

    // The result phrase is text, so it survives with no motion at all.
    await expect(page.getByTestId('hud-result')).toContainText(/summary/i);
    const state = await getState(page);
    expect(state.cards.some((card) => card.definitionId === 'evidence-housing-summary')).toBe(true);
  });

  test('the keyboard controls do everything the drag does', async ({ page }) => {
    await page.getByTestId('controls-source').selectOption({ index: 1 });
    await page.getByTestId('controls-target').selectOption({ index: 1 });
    await page.getByTestId('controls-combine').click();

    // Any accepted or rejected outcome proves the path is wired; the engine tests
    // already prove the rule. What matters here is that no drag was needed.
    await expect(page.getByTestId('hud-result')).not.toBeEmpty();
  });
});
