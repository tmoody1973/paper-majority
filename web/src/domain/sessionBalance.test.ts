import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getCandidateScenario } from '@/content/loadScenario';
import { executeCommand } from '@/domain/engine';
import { DEFAULT_RUN_SETTINGS } from '@/domain/initialState';
import { createRun } from '@/domain/runSetup';
import type { GameCommand } from '@/domain/commands';
import type { Resources, ScenarioDefinition, TermState } from '@/domain/types';
import { previewWork } from '@/domain/work';
import { loadCheckpoint, saveCheckpoint, type SaveStorage } from '@/persistence/saveRepository';
import { chooseCommand, POLICY_IDS, type PolicyId } from '@/../scripts/balance/policies';
import {
  completedTacticUseIds,
  RESOURCE_KEYS,
  runPolicy,
  type BalanceCommandExecutor,
  type BalanceSetup,
} from '@/../scripts/balance/metrics';
import { runBalanceCli } from '@/../scripts/run-balance';

const scenario = getCandidateScenario();

function setup(seed = 1, pace: 'relaxed' | 'standard' | 'brisk' = 'standard'): BalanceSetup {
  return {
    seed,
    districtId: 'GA-05',
    party: 'democratic',
    values: ['Tenant Stability', 'Housing Supply'],
    settings: { ...DEFAULT_RUN_SETTINGS, pace },
  };
}

function apply(state: TermState, command: GameCommand, candidate: ScenarioDefinition = scenario): TermState {
  const result = executeCommand(state, command, { scenario: candidate });
  expect(result.events.find((event) => event.type === 'COMMAND_REJECTED')).toBeUndefined();
  return result.state;
}

function resolveStory(state: TermState): TermState {
  const pending = state.pendingStoryDecisions.find((entry) => entry.status === 'pending');
  if (!pending) return state;
  const event = scenario.storyEvents.find((entry) => entry.id === pending.storyEventId)!;
  const choice = event.choices.find((entry) => Object.entries(entry.cost).every(
    ([key, amount]) => state.resources[key as keyof Resources] >= amount,
  ))!;
  return apply(state, { type: 'RESOLVE_STORY', decisionId: pending.id, choiceId: choice.id });
}

function cardId(state: TermState, definitionId: string, form: 'raw' | 'summary' | 'drafted' = 'raw'): string {
  const card = state.cards.find((entry) => entry.definitionId === definitionId && entry.form === form);
  if (!card) throw new Error(`Missing ${definitionId} (${form})`);
  return card.id;
}

function resourceEventTotals(state: TermState): Resources {
  const totals = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, state.eventLog.reduce(
    (sum, event) => sum + (event.type === 'RESOURCE_CHANGED' ? event.changes[key] ?? 0 : 0), 0,
  )])) as unknown as Resources;
  return totals;
}

function expectResourceAudit(state: TermState, initial: Resources): void {
  const difference = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, state.resources[key] - initial[key]]));
  expect(resourceEventTotals(state)).toEqual(difference);
}

function drivePolicyUntil(
  state: TermState,
  predicate: (candidate: TermState) => boolean,
  policyId: PolicyId = 'greedy-same-party',
): TermState {
  for (let index = 0; index < 100 && !predicate(state); index += 1) {
    state = apply(state, chooseCommand(policyId, state, scenario));
  }
  expect(predicate(state)).toBe(true);
  return state;
}

function outreachCardIds(state: TermState, officeDefinitionId: string): [string, string] {
  return [cardId(state, 'staff-policy-aide'), cardId(state, officeDefinitionId)];
}

function patternCardIds(state: TermState, patternId: string): string[] | undefined {
  const cards = state.cards.filter((card) => card.location === 'desk' && card.status === 'idle');
  let match: string[] | undefined;
  function visit(start: number, selected: string[]): void {
    if (match) return;
    if (selected.length >= 2) {
      const preview = previewWork(state, scenario, selected);
      if (preview.accepted && preview.patternId === patternId) {
        match = selected;
        return;
      }
    }
    if (selected.length === 4) return;
    for (let index = start; index < cards.length; index += 1) visit(index + 1, [...selected, cards[index].id]);
  }
  visit(0, []);
  return match;
}

class MemoryStorage implements SaveStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('Session balance policies', () => {
  it('uses only player-observable state when selecting a command', () => {
    const state = createRun({ ...setup(), scenario, mode: 'session' });
    const visible = { ...state, storyHistory: ['opening-resolved'] };
    Object.defineProperty(visible, 'runVariation', {
      get() { throw new Error('hidden runVariation was inspected'); },
    });
    expect(() => chooseCommand('district-advocate', visible, scenario)).not.toThrow();
  });

  it.each(POLICY_IDS)('%s completes bounded standard runs with exact resource and receipt audits', (policyId) => {
    const run = runPolicy(policyId, setup(17), scenario);
    expect(run.termination).toBe('complete');
    expect(run.rewardedOccurrenceIds.length).toBe(new Set(run.rewardedOccurrenceIds).size);
    expect(run.resourceEventTotals).toEqual(run.finalMinusInitialResources);
    expect(run.outreachOccurrenceIds.length).toBe(new Set(run.outreachOccurrenceIds).size);
    expect(run.packOccurrenceIds.length).toBe(new Set(run.packOccurrenceIds).size);
    expect(run.storyOccurrenceIds.length).toBe(new Set(run.storyOccurrenceIds).size);
    expect(run.commandCount).toBeLessThan(10_000);
  });

  it('distinguishes a learned but unused Tactic from one applied to completed work', () => {
    const learnedOnly = runPolicy('district-reward', setup(17), scenario);
    expect(learnedOnly.activatedTacticIds).toContain('tactic-negotiated-cost-sharing');
    expect(learnedOnly.usedTacticIds).toEqual([]);

    let state = createRun({ ...setup(1), scenario, mode: 'session' });
    const targetPatternId = 'pattern-tactic-costly-drafting';
    state = drivePolicyUntil(state, (candidate) =>
      candidate.unlockedSlotExpansions[targetPatternId]?.includes('expansion-negotiated-cost-sharing') === true
        && patternCardIds(candidate, targetPatternId) !== undefined, 'district-reward');
    const cards = patternCardIds(state, targetPatternId)!;
    state = apply(state, { type: 'SUBMIT_WORK', cardIds: cards });
    const completion = executeCommand(state, { type: 'FAST_FORWARD' }, { scenario });
    expect(completion.events).toContainEqual(expect.objectContaining({
      type: 'PATTERN_COMPLETED', patternId: targetPatternId,
    }));
    expect(completedTacticUseIds(state, completion.events, scenario)).toEqual([
      'tactic-negotiated-cost-sharing',
    ]);
  });

  it.each(['relaxed', 'brisk'] as const)('keeps %s pace fast-forward inside every boundary', (pace) => {
    const run = runPolicy('district-advocate', setup(29, pace), scenario);
    expect(run.termination).toBe('complete');
    expect(run.firstViolatedInvariant).toBeUndefined();
    expect(run.resourceEventTotals).toEqual(run.finalMinusInitialResources);
  });

  it('rejects repeated resolved outreach and keeps cross-revision rewards once-only and net costly', () => {
    let state = createRun({ ...setup(1), scenario, mode: 'session' });
    const initialResources = { ...state.resources };
    const oldOccurrence = 'demand-renter-stability:revision:0';
    state = drivePolicyUntil(state, (candidate) =>
      candidate.rewardedOccurrenceIds.includes(oldOccurrence) && candidate.activeWork.length === 0);
    expect(state.bill.revision).toBe(2);
    expect(state.rewardedOccurrenceIds.filter((id) => id === oldOccurrence)).toHaveLength(1);

    const beforeRepeatCapital = state.resources.politicalCapital;
    state = apply(state, {
      type: 'SUBMIT_WORK',
      cardIds: outreachCardIds(state, 'coalition-office-maxine-waters'),
    });
    state = apply(state, { type: 'FAST_FORWARD' });
    const pending = state.pendingDecisions.find((entry) => entry.status === 'pending')!;
    expect(pending.occurrenceId).toBe('demand-renter-stability:revision:2');
    state = apply(state, {
      type: 'RESOLVE_DECISION',
      decisionId: pending.id,
      choiceId: 'choice-accept-renter-stability',
      expectedBillRevision: pending.expectedBillRevision,
    });
    expect(state.resources.politicalCapital).toBe(beforeRepeatCapital - 1);
    expect(state.rewardedOccurrenceIds.filter((id) => id === oldOccurrence)).toHaveLength(1);
    expect(state.rewardedOccurrenceIds.filter((id) => id === pending.occurrenceId)).toHaveLength(1);

    const beforeDuplicate = state;
    const duplicate = executeCommand(state, {
      type: 'SUBMIT_WORK',
      cardIds: outreachCardIds(state, 'coalition-office-maxine-waters'),
    }, { scenario });
    expect(duplicate.events).toEqual([expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'duplicate-outreach' })]);
    expect(duplicate.state).toBe(beforeDuplicate);
    expect(duplicate.state.resources).toEqual(beforeDuplicate.resources);
    expect(duplicate.state.simulationMs).toBe(beforeDuplicate.simulationMs);
    expect(state.eventLog.filter((event) =>
      event.type === 'RESOURCE_CHANGED' && event.reason === `promise-fulfilled:${oldOccurrence}`)).toHaveLength(1);
    expectResourceAudit(state, initialResources);
  });

  it('rejects another attempt after an office has explicitly refused the current revision', () => {
    let state = createRun({ ...setup(1), scenario, mode: 'session' });
    const initialResources = { ...state.resources };
    state = drivePolicyUntil(state, (candidate) =>
      candidate.pendingDecisions.some((entry) => entry.status === 'pending'));
    const pending = state.pendingDecisions.find((entry) => entry.status === 'pending')!;
    const rejectChoiceId = pending.choiceIds.find((id) =>
      scenario.decisionChoices.find((choice) => choice.id === id)?.action === 'reject')!;
    state = apply(state, {
      type: 'RESOLVE_DECISION',
      decisionId: pending.id,
      choiceId: rejectChoiceId,
      expectedBillRevision: pending.expectedBillRevision,
    });
    expect(state.rewardedOccurrenceIds).not.toContain(pending.occurrenceId);

    const beforeDuplicate = state;
    const duplicate = executeCommand(state, {
      type: 'SUBMIT_WORK',
      cardIds: outreachCardIds(state, pending.officeDefinitionId),
    }, { scenario });
    expect(duplicate.events).toEqual([expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'duplicate-outreach' })]);
    expect(duplicate.state).toBe(beforeDuplicate);
    expect(duplicate.state.resources).toEqual(beforeDuplicate.resources);
    expect(duplicate.state.simulationMs).toBe(beforeDuplicate.simulationMs);
    expectResourceAudit(state, initialResources);
  });

  it('retains a terminal audit fault as a traced CLI failure', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'paper-majority-terminal-audit-'));
    const terminalFault: BalanceCommandExecutor = (state, command, context) => {
      const result = executeCommand(state, command, context);
      if (result.state.runStatus !== 'complete') return result;
      return {
        ...result,
        state: {
          ...result.state,
          resources: {
            ...result.state.resources,
            districtTrust: result.state.resources.districtTrust - 1,
          },
        },
      };
    };
    try {
      const exitCode = await runBalanceCli(
        ['--mode', 'session', '--seeds', '1', '--parties', 'democratic', '--pace', 'standard'],
        { scenario, outputDir, commandExecutor: terminalFault, log: () => undefined },
      );
      expect(exitCode).toBe(1);
      const report = JSON.parse(await readFile(join(outputDir, 'results.json'), 'utf8')) as {
        failures: Array<{
          termination: string;
          firstViolatedInvariant?: string;
          commandTrace: Array<{ command: GameCommand }>;
        }>;
      };
      expect(report.failures).toHaveLength(POLICY_IDS.length);
      for (const failure of report.failures) {
        expect(failure.termination).toBe('rejected');
        expect(failure.firstViolatedInvariant).toMatch(/^resource audit mismatch for districtTrust:/);
        expect(failure.commandTrace.at(-1)?.command.type).toBe('CONCLUDE_SESSION');
      }
      const traceIndex = JSON.parse(await readFile(join(outputDir, 'trace-index.json'), 'utf8')) as Array<{
        termination: string;
        firstViolatedInvariant?: string;
      }>;
      expect(traceIndex).toHaveLength(POLICY_IDS.length);
      expect(traceIndex.every((entry) =>
        entry.termination === 'rejected' && entry.firstViolatedInvariant?.includes('districtTrust'))).toBe(true);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects a stale coalition confirmation without charging or advancing time', () => {
    let state = createRun({ ...setup(5), scenario, mode: 'session' });
    state = apply(state, { type: 'DRAW_STORY_EVENT' });
    state = resolveStory(state);
    state = apply(state, {
      type: 'SUBMIT_WORK',
      cardIds: [cardId(state, 'staff-policy-aide'), cardId(state, 'evidence-rent-burden-report')],
    });
    state = apply(state, { type: 'FAST_FORWARD' });
    state = apply(state, {
      type: 'SUBMIT_WORK',
      cardIds: [
        cardId(state, 'staff-legislative-counsel'),
        cardId(state, 'evidence-rent-burden-report', 'summary'),
        cardId(state, 'policy-housing-choice-voucher'),
      ],
    });
    state = apply(state, { type: 'FAST_FORWARD' });
    state = apply(state, {
      type: 'SUBMIT_WORK',
      cardIds: [cardId(state, 'staff-policy-aide'), cardId(state, 'coalition-office-maxine-waters')],
    });
    state = apply(state, { type: 'FAST_FORWARD' });
    const pending = state.pendingDecisions.find((entry) => entry.status === 'pending')!;
    // Model a confirmation rendered for revision 0 after another canonical writer
    // has advanced the bill to revision 1. The command must carry its old revision.
    state = { ...state, bill: { ...state.bill, revision: state.bill.revision + 1 } };
    const before = state;
    const choiceId = pending.choiceIds.find((id) => scenario.decisionChoices.find((choice) => choice.id === id)?.action === 'accept')!;
    const result = executeCommand(state, {
      type: 'RESOLVE_DECISION',
      decisionId: pending.id,
      choiceId,
      expectedBillRevision: pending.expectedBillRevision,
    }, { scenario });
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'stale-decision' }));
    expect(result.state).toBe(before);
    expect(result.state.resources).toEqual(before.resources);
    expect(result.state.simulationMs).toBe(before.simulationMs);
  });

  it('refunds a cancelled Tactic study exactly once and grants no expansion', () => {
    let state = createRun({ ...setup(11), scenario, mode: 'session' });
    state = apply(state, { type: 'DRAW_STORY_EVENT' });
    state = resolveStory(state);
    state = apply(state, { type: 'ADVANCE_WEEK', confirmEarly: true, expectedWeek: 1 });
    state = apply(state, { type: 'ADVANCE_WEEK' });
    state = resolveStory(state);
    state = apply(state, { type: 'OPEN_PACK', packOccurrenceId: 'pack:week:2', categoryId: 'week-two-policy' });
    const initialAttention = state.resources.staffAttention;
    const staff = cardId(state, 'staff-policy-aide');
    const tactic = cardId(state, 'tactic-bipartisan-working-group');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      state = apply(state, { type: 'START_ASSIGNMENT', assignmentKind: 'study-tactic', staffCardId: staff, targetCardId: tactic });
      expect(state.resources.staffAttention).toBe(initialAttention - 1);
      const stackId = state.cards.find((card) => card.id === staff)!.stackId;
      state = apply(state, { type: 'SEPARATE_STACK', stackId, cardId: staff, x: 120 + attempt, y: 200 });
      expect(state.resources.staffAttention).toBe(initialAttention);
      expect(state.activeWork).toEqual([]);
    }
    expect(state.eventLog.some((event) => event.type === 'TACTIC_EXPANSION_ACTIVATED')).toBe(false);
    const totals = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, state.eventLog.reduce(
      (sum, event) => sum + (event.type === 'RESOURCE_CHANGED' ? event.changes[key] ?? 0 : 0), 0,
    )]));
    expect(totals.staffAttention).toBe(0);
  });

  it('keeps an impossible mandatory deadline as a reported loss instead of rerolling it', () => {
    const impossible = structuredClone(scenario);
    const obligation = impossible.obligationDefinitions.find((entry) => entry.id === 'obligation-renter-response')!;
    obligation.due = { week: 2, offsetMs: 1 };
    obligation.dueOptions = [{ week: 2, offsetMs: 1 }];
    const run = runPolicy('district-advocate', setup(1), impossible);
    expect(run.termination).toBe('complete');
    expect(run.outcome).toBe('not-ready');
    expect(run.missedObligationIds).toContain('obligation-renter-response:pack:week:2');
    expect(run.readinessGaps.overdueMandatoryIds).toContain('obligation-renter-response:pack:week:2');
  });

  it('round-trips a save with unresolved paid work without simulating offline progress', () => {
    let state = createRun({ ...setup(31), scenario, mode: 'session' });
    state = apply(state, {
      type: 'SUBMIT_WORK',
      cardIds: [cardId(state, 'staff-policy-aide'), cardId(state, 'evidence-rent-burden-report')],
    });
    const storage = new MemoryStorage();
    expect(saveCheckpoint(storage, state, scenario).kind).toBe('saved');
    const loaded = loadCheckpoint(storage, scenario);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') throw new Error('expected unresolved work save to load');
    expect(loaded.state.activeWork).toEqual(state.activeWork);
    expect(loaded.state.simulationMs).toBe(state.simulationMs);
    expect(loaded.state.resources).toEqual(state.resources);
    expect(loaded.state.paused).toBe(true);
  });
});
