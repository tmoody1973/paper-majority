import { describe, expect, it } from 'vitest';

import {
  expireObligations,
  fulfillObligations,
  obligationOccurrence,
} from '@/domain/obligations';
import { executeCommand } from '@/domain/engine';
import { createRun } from '@/domain/initialState';
import type { CardInstance, ScenarioDefinition } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function run(scenario: ScenarioDefinition = sessionScenario) {
  return createRun({ ...sessionSetup, scenario, mode: 'session' });
}

describe('obligations', () => {
  it('creates stable occurrence ids from authored definitions and occurrence identity', () => {
    const definition = sessionScenario.obligationDefinitions[0];
    expect(obligationOccurrence(definition, 'offer:17')).toEqual(expect.objectContaining({
      id: 'obligation-answer-renters:offer:17',
      sourceId: 'obligation-answer-renters',
      due: { week: 2, offsetMs: 60_000 },
      status: 'open',
    }));
  });

  it('fulfills filed prepared evidence and rewards once after cloning', () => {
    const definition = sessionScenario.obligationDefinitions[0];
    const base = run();
    const source = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const prepared: CardInstance = {
      ...source,
      id: 'prepared-filed',
      form: 'prepared',
      location: 'filed',
    };
    const state = {
      ...base,
      resources: { ...base.resources, politicalCapital: 3 },
      cards: [...base.cards, prepared],
      obligations: [obligationOccurrence(definition)],
    };
    const first = fulfillObligations(state, sessionScenario);
    expect(first.state.resources.politicalCapital).toBe(4);
    expect(first.state.rewardedOccurrenceIds).toContain(first.state.obligations[0].id);
    const replay = fulfillObligations(structuredClone(first.state), sessionScenario);
    expect(replay.state.resources.politicalCapital).toBe(4);
    expect(replay.events).toEqual([]);
  });

  it('requires prepared evidence to be idle before it can fulfill an obligation', () => {
    const base = run();
    const source = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const staff = base.cards.find((card) => card.definitionId === 'staff-district-director')!;
    const office = base.cards.find((card) => card.definitionId === 'coalition-office-hillcrest')!;
    const prepared: CardInstance = {
      ...source,
      id: 'prepared-reserved',
      stackId: 'stack-prepared-reserved',
      form: 'prepared',
    };
    const obligation = obligationOccurrence(sessionScenario.obligationDefinitions[0], 'reserved');
    const supplied = {
      ...base,
      cards: [...base.cards, prepared],
      stacks: [...base.stacks, { id: prepared.stackId, cardIds: [prepared.id] }],
    };
    const started = executeCommand(supplied, {
      type: 'SUBMIT_WORK',
      cardIds: [staff.id, prepared.id, office.id],
    }, { scenario: sessionScenario });
    const reserved = { ...started.state, obligations: [obligation] };
    expect(reserved.cards.find((card) => card.id === prepared.id)?.status).toBe('working');
    expect(fulfillObligations(reserved, sessionScenario).state.obligations[0].status).toBe('open');

    const ready = {
      ...reserved,
      paused: false,
      activeWork: reserved.activeWork.map((work) => ({ ...work, completesAtSimulationMs: 1_000 })),
    };
    const completed = executeCommand(ready, { type: 'TICK', deltaMs: 1_000 }, { scenario: sessionScenario });
    expect(completed.state.obligations[0].status).toBe('fulfilled');
    expect(completed.state.cards.some((card) => card.form === 'prepared' && card.status === 'idle')).toBe(true);
  });

  it('applies actual capped penalties and does not settle twice', () => {
    const base = run();
    const obligation = {
      ...obligationOccurrence(sessionScenario.obligationDefinitions[0]),
      due: { week: 1, offsetMs: 500 },
    };
    const state = {
      ...base,
      resources: { ...base.resources, districtTrust: 3 },
      obligations: [{ ...obligation, trustPenalty: 5 }],
    };
    const first = expireObligations(state, 500);
    expect(first.state.resources.districtTrust).toBe(0);
    expect(first.events).toContainEqual(expect.objectContaining({
      type: 'RESOURCE_CHANGED',
      changes: { districtTrust: -3 },
    }));
    expect(expireObligations(first.state, 500).events).toEqual([]);
  });

  it('keeps mandatory history after filing or archiving and rejects active-work filing', () => {
    const base = run();
    const card = base.cards[0];
    const withObligation = { ...base, obligations: [obligationOccurrence(sessionScenario.obligationDefinitions[0])] };
    const filed = executeCommand(withObligation, { type: 'FILE_CARD', cardId: card.id }, { scenario: sessionScenario });
    expect(filed.state.cards.find((candidate) => candidate.id === card.id)?.location).toBe('filed');
    expect(filed.state.obligations).toEqual(withObligation.obligations);
    const archived = executeCommand(filed.state, { type: 'ARCHIVE_CARD', cardId: card.id }, { scenario: sessionScenario });
    expect(archived.state.cards.find((candidate) => candidate.id === card.id)?.location).toBe('archived');
    expect(archived.state.obligations).toEqual(withObligation.obligations);

    const busy = {
      ...base,
      activeWork: [{
        id: 'busy', kind: 'study' as const, cardIds: [card.id], staffCardIds: [card.id], paidCost: { staffAttention: 1 },
        completesAtSimulationMs: 2_000, effectiveRuleVersion: 'test', consumedCardIds: [], returnedCardIds: [card.id],
        expansionIds: [], effectiveExpansions: [],
      }],
    };
    const rejected = executeCommand(busy, { type: 'FILE_CARD', cardId: card.id }, { scenario: sessionScenario });
    expect(rejected.state).toBe(busy);
    expect(rejected.events[0]).toEqual(expect.objectContaining({ reason: 'card-busy' }));
  });

  it('enforces exactly six filing slots', () => {
    const base = run();
    const expanded = {
      ...base,
      cards: Array.from({ length: 7 }, (_, index) => ({
        ...base.cards[0], id: `filing-${index}`, stackId: `filing-stack-${index}`,
        location: index < 6 ? 'filed' as const : 'desk' as const,
      })),
    };
    const rejected = executeCommand(expanded, { type: 'FILE_CARD', cardId: 'filing-6' }, { scenario: sessionScenario });
    expect(rejected.state).toBe(expanded);
    expect(rejected.events[0]).toEqual(expect.objectContaining({ message: expect.stringMatching(/six filing slots/i) }));
  });

  it('does not use completed work from before a decision-created occurrence', () => {
    const scenario = structuredClone(sessionScenario);
    scenario.obligationDefinitions[0] = {
      ...scenario.obligationDefinitions[0],
      fulfillment: { kind: 'completed-pattern', patternId: 'pattern-summarize-evidence' },
    };
    const occurrence = 'demand-renter-protection:revision:0';
    const obligation = obligationOccurrence(scenario.obligationDefinitions[0], occurrence);
    const state = {
      ...run(scenario),
      obligations: [obligation],
      eventLog: [{
        type: 'PATTERN_COMPLETED' as const,
        workId: 'old-work',
        patternId: 'pattern-summarize-evidence',
      }],
    };
    const context = [{
      type: 'DECISION_RESOLVED' as const,
      decisionId: `decision:${occurrence}`,
      choiceId: 'choice-counter-renter-protection',
      occurrenceId: occurrence,
    }];
    expect(fulfillObligations(state, scenario, context).state.obligations[0].status).toBe('open');
  });
});
