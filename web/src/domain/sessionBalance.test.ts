import { describe, expect, it } from 'vitest';

import { getCandidateScenario } from '@/content/loadScenario';
import { executeCommand } from '@/domain/engine';
import { DEFAULT_RUN_SETTINGS } from '@/domain/initialState';
import { createRun } from '@/domain/runSetup';
import type { GameCommand } from '@/domain/commands';
import type { Resources, ScenarioDefinition, TermState } from '@/domain/types';
import { loadCheckpoint, saveCheckpoint, type SaveStorage } from '@/persistence/saveRepository';
import { chooseCommand, POLICY_IDS } from '@/../scripts/balance/policies';
import { RESOURCE_KEYS, runPolicy, type BalanceSetup } from '@/../scripts/balance/metrics';

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

  it.each(['relaxed', 'brisk'] as const)('keeps %s pace fast-forward inside every boundary', (pace) => {
    const run = runPolicy('district-advocate', setup(29, pace), scenario);
    expect(run.termination).toBe('complete');
    expect(run.firstViolatedInvariant).toBeUndefined();
    expect(run.resourceEventTotals).toEqual(run.finalMinusInitialResources);
  });

  it('does not farm repeat outreach or reward receipts across bill revisions', () => {
    const run = runPolicy('coalition-broker', setup(73), scenario);
    expect(run.termination).toBe('complete');
    expect(run.outreachOccurrenceIds.length).toBe(new Set(run.outreachOccurrenceIds).size);
    expect(run.rewardedOccurrenceIds.length).toBe(new Set(run.rewardedOccurrenceIds).size);
    expect(run.outreachOccurrenceIds.length).toBeLessThanOrEqual(4);
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
