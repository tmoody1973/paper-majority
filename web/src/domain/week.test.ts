import { describe, expect, it } from 'vitest';

import { executeCommand } from '@/domain/engine';
import { createRun } from '@/domain/initialState';
import { obligationOccurrence } from '@/domain/obligations';
import { nextStopDelta, previewWeek, resolveWeek } from '@/domain/week';
import type { ActiveWork, TermState } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function run(): TermState {
  return createRun({ ...sessionSetup, mode: 'session' });
}

describe('week boundaries', () => {
  it('previews penalties and carrying work without applying either', () => {
    const base = run();
    const work: ActiveWork = {
      id: 'work-carry',
      kind: 'study',
      cardIds: [],
      staffCardIds: [],
      paidCost: {},
      completesAtSimulationMs: base.weekLengthMs * 2 + 5_000,
      effectiveRuleVersion: 'test',
      consumedCardIds: [],
      returnedCardIds: [],
      expansionIds: [],
      effectiveExpansions: [],
    };
    const state = {
      ...base,
      week: 2,
      simulationMs: base.weekLengthMs,
      resources: { ...base.resources, districtTrust: 3 },
      activeWork: [work],
      obligations: [{ ...obligationOccurrence(sessionScenario.obligationDefinitions[0]), trustPenalty: 5 }],
    };
    const preview = previewWeek(state, sessionScenario);
    expect(preview.effects).toEqual({ districtTrust: -3 });
    expect(preview.carryingWorkIds).toEqual(['work-carry']);
    expect(state.resources.districtTrust).toBe(3);
  });

  it('resolves a boundary once, preserves absolute finishes and applies the new-week floor', () => {
    const base = run();
    const finish = base.weekLengthMs + 5_000;
    const state = {
      ...base,
      weekPhase: 'boundary' as const,
      simulationMs: base.weekLengthMs,
      elapsedMs: base.weekLengthMs,
      resources: { ...base.resources, politicalCapital: 0 },
      activeWork: [{
        id: 'work-carry', kind: 'study' as const, cardIds: [], staffCardIds: [], paidCost: {},
        completesAtSimulationMs: finish, effectiveRuleVersion: 'test', consumedCardIds: [], returnedCardIds: [],
        expansionIds: [], effectiveExpansions: [],
      }],
    };
    const first = resolveWeek(state, sessionScenario);
    expect(first.state.week).toBe(2);
    expect(first.state.resources.politicalCapital).toBe(1);
    expect(first.state.activeWork[0].completesAtSimulationMs).toBe(finish);
    const second = resolveWeek(structuredClone(first.state), sessionScenario);
    expect(second.state.week).toBe(2);
    expect(second.events).toEqual([]);
  });

  it('records a fulfilled boundary obligation exactly once across a cloned state', () => {
    const base = run();
    const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const obligation = obligationOccurrence(sessionScenario.obligationDefinitions[0], 'boundary-receipt');
    const state = {
      ...base,
      week: 2,
      weekPhase: 'boundary' as const,
      elapsedMs: base.weekLengthMs,
      simulationMs: base.weekLengthMs * 2,
      cards: base.cards.map((card) => card.id === evidence.id
        ? { ...card, form: 'prepared' as const, location: 'filed' as const }
        : card),
      obligations: [obligation],
    };
    const result = executeCommand(state, { type: 'ADVANCE_WEEK' }, { scenario: sessionScenario });
    expect(result.state.week).toBe(3);
    expect(result.state.rewardedOccurrenceIds.filter((id) => id === obligation.id)).toHaveLength(1);
    const replay = executeCommand(structuredClone(result.state), { type: 'ADVANCE_WEEK' }, { scenario: sessionScenario });
    expect(replay.state.rewardedOccurrenceIds.filter((id) => id === obligation.id)).toHaveLength(1);
  });

  it('chooses the exact earlier work or deadline stop and otherwise caps at one second', () => {
    const base = run();
    const due = {
      ...obligationOccurrence(sessionScenario.obligationDefinitions[0]),
      due: { week: 1, offsetMs: 700 },
    };
    expect(nextStopDelta({ ...base, obligations: [due] }, sessionScenario)).toBe(700);
    expect(nextStopDelta({ ...base, obligations: [] }, sessionScenario)).toBe(1_000);
  });

  it('keeps ordinary advance boundary-only and makes repeated early intent idempotent', () => {
    const base = { ...run(), paused: false };
    const rejected = executeCommand(base, { type: 'ADVANCE_WEEK' }, { scenario: sessionScenario });
    expect(rejected.state).toBe(base);
    const early = executeCommand(base, {
      type: 'ADVANCE_WEEK', confirmEarly: true, expectedWeek: 1,
    }, { scenario: sessionScenario });
    expect(early.state.weekPhase).toBe('boundary');
    expect(early.state.week).toBe(1);
    const repeated = executeCommand(early.state, {
      type: 'ADVANCE_WEEK', confirmEarly: true, expectedWeek: 1,
    }, { scenario: sessionScenario });
    expect(repeated.state).toBe(early.state);
    const advanced = executeCommand(early.state, { type: 'ADVANCE_WEEK' }, { scenario: sessionScenario });
    expect(advanced.state.week).toBe(2);
    const duplicateBoundary = executeCommand(advanced.state, { type: 'ADVANCE_WEEK' }, { scenario: sessionScenario });
    expect(duplicateBoundary.state).toBe(advanced.state);
  });

  it('interrupts confirmed early advancement when work presents a decision', () => {
    const base = run();
    const aide = base.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const office = base.cards.find((card) => card.definitionId === 'coalition-office-hillcrest')!;
    const started = executeCommand(base, {
      type: 'SUBMIT_WORK', cardIds: [aide.id, office.id],
    }, { scenario: sessionScenario });
    const result = executeCommand(started.state, {
      type: 'ADVANCE_WEEK', confirmEarly: true, expectedWeek: 1,
    }, { scenario: sessionScenario });
    expect(result.state.simulationMs).toBe(25_000);
    expect(result.state.week).toBe(1);
    expect(result.state.weekPhase).toBe('active');
    expect(result.state.pendingDecisions.some((decision) => decision.status === 'pending')).toBe(true);
  });

  it('completes work exactly at its deadline before expiring the obligation', () => {
    const scenario = structuredClone(sessionScenario);
    scenario.obligationDefinitions.push({
      id: 'obligation-summary',
      title: 'Finish the housing summary',
      sourceDefinitionId: 'evidence-rent-burden-report',
      due: { week: 1, offsetMs: 1_000 },
      mandatory: true,
      rewardCapital: 1,
      trustPenalty: 8,
      fulfillment: { kind: 'completed-pattern', patternId: 'pattern-summarize-evidence' },
    });
    const base = { ...createRun({ ...sessionSetup, scenario, mode: 'session' }), paused: false };
    const staff = base.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const started = executeCommand(base, {
      type: 'SUBMIT_WORK', cardIds: [staff.id, evidence.id],
    }, { scenario });
    const state = {
      ...started.state,
      paused: false,
      activeWork: started.state.activeWork.map((work) => ({ ...work, completesAtSimulationMs: 1_000 })),
      obligations: [{
        id: 'obligation-summary:test', sourceId: 'obligation-summary', due: { week: 1, offsetMs: 1_000 },
        mandatory: true, status: 'open' as const, rewardCapital: 1, trustPenalty: 8,
      }],
    };
    const result = executeCommand(state, { type: 'TICK', deltaMs: 1_000 }, { scenario });
    expect(result.state.obligations[0].status).toBe('fulfilled');
    expect(result.state.resources.districtTrust).toBe(base.resources.districtTrust);
  });

  it('finishes a whole same-timestamp batch before a decision pauses deadline handling', () => {
    const scenario = structuredClone(sessionScenario);
    const base = createRun({ ...sessionSetup, scenario, mode: 'session' });
    const policyAide = base.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const districtDirector = base.cards.find((card) => card.definitionId === 'staff-district-director')!;
    const office = base.cards.find((card) => card.definitionId === 'coalition-office-hillcrest')!;
    const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const summary = {
      ...evidence,
      id: 'card-summary-for-batch',
      stackId: 'stack-summary-for-batch',
      form: 'summary' as const,
    };
    const supplied = {
      ...base,
      weekLengthMs: 1_000,
      cards: [...base.cards, summary],
      stacks: [...base.stacks, { id: summary.stackId, cardIds: [summary.id] }],
    };
    const outreach = executeCommand(supplied, {
      type: 'SUBMIT_WORK', cardIds: [policyAide.id, office.id],
    }, { scenario });
    const prepared = executeCommand(outreach.state, {
      type: 'SUBMIT_WORK', cardIds: [districtDirector.id, summary.id],
    }, { scenario });
    const state = {
      ...prepared.state,
      paused: false,
      activeWork: prepared.state.activeWork.map((work) => ({ ...work, completesAtSimulationMs: 1_000 })),
      obligations: [{
        id: 'obligation-answer-renters:batch',
        sourceId: 'obligation-answer-renters',
        due: { week: 1, offsetMs: 1_000 },
        mandatory: true,
        status: 'open' as const,
        rewardCapital: 1,
        trustPenalty: 5,
      }],
    };
    const result = executeCommand(state, { type: 'TICK', deltaMs: 1_000 }, { scenario });
    expect(result.state.pendingDecisions.filter((decision) => decision.status === 'pending')).toHaveLength(1);
    expect(result.state.activeWork).toHaveLength(0);
    expect(result.state.obligations[0].status).toBe('fulfilled');
    expect(result.state.weekPhase).toBe('boundary');
    expect(result.state.resources.staffAttention).toBe(3);

    const blocked = executeCommand(result.state, { type: 'ADVANCE_WEEK' }, { scenario });
    expect(blocked.state).toBe(result.state);
    expect(blocked.state.eventLog).toBe(result.state.eventLog);
    expect(blocked.events).toEqual([expect.objectContaining({ reason: 'pending-decision' })]);
    expect(resolveWeek(result.state, scenario)).toEqual({ state: result.state, events: [] });

    const pending = result.state.pendingDecisions.find((decision) => decision.status === 'pending')!;
    const resolved = executeCommand(result.state, {
      type: 'RESOLVE_DECISION',
      decisionId: pending.id,
      choiceId: 'choice-refuse-renter-protection',
      expectedBillRevision: pending.expectedBillRevision,
    }, { scenario });
    const advanced = executeCommand(resolved.state, { type: 'ADVANCE_WEEK' }, { scenario });
    expect(advanced.state.week).toBe(2);
  });

  it('emits one unconditional completion receipt for zero-cost outreach without a pattern resource event', () => {
    const scenario = structuredClone(sessionScenario);
    scenario.patterns = scenario.patterns.map((pattern) => pattern.id === 'pattern-coalition-outreach'
      ? { ...pattern, durationMs: 1_000, resourceCost: {} }
      : pattern);
    scenario.obligationDefinitions[0] = {
      ...scenario.obligationDefinitions[0],
      due: { week: 1, offsetMs: 2_000 },
      fulfillment: { kind: 'completed-pattern', patternId: 'pattern-coalition-outreach' },
    };
    const base = { ...createRun({ ...sessionSetup, scenario, mode: 'session' }), paused: false };
    const aide = base.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const office = base.cards.find((card) => card.definitionId === 'coalition-office-hillcrest')!;
    const started = executeCommand({
      ...base,
      obligations: [obligationOccurrence(scenario.obligationDefinitions[0], 'zero-cost')],
    }, { type: 'SUBMIT_WORK', cardIds: [aide.id, office.id] }, { scenario });
    expect(started.events.filter((event) => event.type === 'RESOURCE_CHANGED')).toHaveLength(0);
    const completed = executeCommand(started.state, { type: 'TICK', deltaMs: 1_000 }, { scenario });
    expect(completed.events.filter((event) => event.type === 'PATTERN_COMPLETED')).toEqual([expect.objectContaining({
      type: 'PATTERN_COMPLETED',
      workId: 'work-1',
      patternId: 'pattern-coalition-outreach',
    })]);
    expect(completed.events.filter((event) =>
      event.type === 'RESOURCE_CHANGED' && event.reason.startsWith('pattern-complete:'),
    )).toHaveLength(0);
    expect(completed.events.filter((event) => event.type === 'RESOURCE_CHANGED')).toEqual([
      expect.objectContaining({ reason: 'obligation-fulfilled:obligation-answer-renters:zero-cost' }),
    ]);
    expect(completed.state.obligations[0].status).toBe('fulfilled');
  });

  it('fast-forward uses the same completion transition as bounded ticks', () => {
    const base = run();
    const staff = base.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const started = executeCommand(base, {
      type: 'SUBMIT_WORK', cardIds: [staff.id, evidence.id],
    }, { scenario: sessionScenario }).state;
    let ticked = { ...started, paused: false };
    for (let index = 0; index < 20; index += 1) {
      ticked = executeCommand(ticked, { type: 'TICK', deltaMs: 1_000 }, { scenario: sessionScenario }).state;
    }
    const forwarded = executeCommand(
      { ...started, paused: false },
      { type: 'FAST_FORWARD' },
      { scenario: sessionScenario },
    ).state;
    expect(forwarded.simulationMs).toBe(ticked.simulationMs);
    expect(forwarded.activeWork).toEqual(ticked.activeWork);
    expect(forwarded.cards).toEqual(ticked.cards);
  });

  it('never creates week seven', () => {
    const base = run();
    const state = {
      ...base,
      week: 6,
      simulationMs: base.weekLengthMs * 6,
      elapsedMs: base.weekLengthMs,
      weekPhase: 'boundary' as const,
    };
    const resolved = executeCommand(state, { type: 'ADVANCE_WEEK' }, { scenario: sessionScenario });
    expect(resolved.state.week).toBe(6);
    expect(resolved.state.resolvedWeekIds).toContain('week:6');
  });

  it('keeps a boundary canonically paused while still allowing card movement', () => {
    const base = run();
    const card = base.cards[0];
    const boundary = { ...base, weekPhase: 'boundary' as const, paused: true, elapsedMs: base.weekLengthMs };
    const resume = executeCommand(boundary, { type: 'SET_PAUSED', paused: false }, { scenario: sessionScenario });
    expect(resume.state).toBe(boundary);
    const moved = executeCommand(boundary, { type: 'MOVE_CARD', cardId: card.id, x: 123, y: 456 }, { scenario: sessionScenario });
    expect(moved.state.cards.find((candidate) => candidate.id === card.id)).toMatchObject({ x: 123, y: 456 });
  });

  it('charges at most ten morale for desk overflow and uses the larger week-six capacity', () => {
    const base = run();
    const makeCards = (count: number) => Array.from({ length: count }, (_, index) => ({
      ...base.cards[0], id: `overflow-${index}`, stackId: `overflow-stack-${index}`,
    }));
    const crowded = {
      ...base,
      weekPhase: 'boundary' as const,
      elapsedMs: base.weekLengthMs,
      cards: makeCards(30),
    };
    expect(resolveWeek(crowded, sessionScenario).state.resources.staffMorale).toBe(60);
    const sixth = {
      ...crowded,
      week: 6,
      simulationMs: base.weekLengthMs * 6,
      cards: makeCards(23),
    };
    expect(resolveWeek(sixth, sessionScenario).state.resources.staffMorale).toBe(69);
  });
});
