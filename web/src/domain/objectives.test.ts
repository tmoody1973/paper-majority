import { describe, expect, it } from 'vitest';

import { executeCommand } from '@/domain/engine';
import { SESSION_READINESS_MILESTONE_ID, sessionReadiness } from '@/domain/objectives';
import { createRun } from '@/domain/runSetup';
import type { BillProvisionReceipt, TermState } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function provision(id: string, revision: number): BillProvisionReceipt {
  return {
    origin: 'draft', provisionId: id, draftedCardId: `draft-${id}`,
    sourceDefinitionIds: [], docketedAtRevision: revision,
    plainLanguage: id, form: 'drafted', sourceClass: 'simulated',
  };
}

function readyState(): TermState {
  const state = createRun({ ...sessionSetup, mode: 'session' });
  const ids = sessionScenario.cards.filter((card) => card.kind === 'policy').slice(0, 2).map((card) => card.id);
  return {
    ...state,
    bill: { ...state.bill, provisionIds: ids, provisionReceipts: ids.map(provision), revision: 2 },
    relationships: state.relationships.map((relationship, index) => index < 2
      ? { ...relationship, support: 'committed' as const, promiseOccurrenceIds: [`promise:test:${index}`], conditions: [] }
      : relationship),
  };
}

describe('sessionReadiness', () => {
  it('reports partial gaps and only overdue mandatory occurrences', () => {
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const state = {
      ...base,
      simulationMs: 1_000,
      obligations: [
        { id: 'mandatory:missed', sourceId: 'obligation-answer-renters', due: { week: 1, offsetMs: 900 }, mandatory: true, status: 'missed' as const, rewardCapital: 1, trustPenalty: 5 },
        { id: 'optional:declined', sourceId: 'obligation-answer-renters', due: { week: 1, offsetMs: 900 }, mandatory: false, status: 'declined' as const, rewardCapital: 1, trustPenalty: 0 },
      ],
    };
    expect(sessionReadiness(state)).toEqual({
      ready: false, provisionGap: 2, supportGap: 2, overdueMandatoryIds: ['mandatory:missed'],
    });
  });

  it('awards the preparation milestone once, caps its actual delta, and never repays after readiness is lost', () => {
    const almost = readyState();
    almost.relationships[1] = { ...almost.relationships[1], support: 'interested' };
    const transition = executeCommand(almost, {
      type: 'RESOLVE_STORY', decisionId: 'missing', choiceId: 'missing',
    }, { scenario: sessionScenario });
    expect(transition.state).toBe(almost);

    const ready = readyState();
    const lastPolicy = ready.bill.provisionIds[1];
    const notReady = {
      ...ready,
      bill: { ...ready.bill, provisionIds: ready.bill.provisionIds.slice(0, 1), provisionReceipts: ready.bill.provisionReceipts.slice(0, 1), revision: 1 },
      resources: { ...ready.resources, politicalCapital: 9 },
      cards: [...ready.cards, {
        ...ready.cards.find((card) => sessionScenario.cards.find((definition) => definition.id === card.definitionId)?.kind === 'policy')!,
        id: 'draft-ready', stackId: 'stack-draft-ready', form: 'drafted' as const,
        definitionId: lastPolicy,
        policyDefinitionId: lastPolicy,
      }],
      stacks: [...ready.stacks, { id: 'stack-draft-ready', cardIds: ['draft-ready'] }],
    };
    const awarded = executeCommand(notReady, { type: 'DOCKET_PROVISION', cardId: 'draft-ready' }, { scenario: sessionScenario });
    expect(awarded.state.rewardedOccurrenceIds).toContain(SESSION_READINESS_MILESTONE_ID);
    expect(awarded.state.resources.politicalCapital).toBe(9);
    expect(awarded.events).not.toContainEqual(expect.objectContaining({ reason: SESSION_READINESS_MILESTONE_ID }));

    const lost = { ...awarded.state, relationships: awarded.state.relationships.map((relationship, index) => index === 0 ? { ...relationship, support: 'refused' as const } : relationship) };
    const regained = { ...lost, relationships: awarded.state.relationships };
    const replay = executeCommand(regained, { type: 'SET_PAUSED', paused: false }, { scenario: sessionScenario });
    expect(replay.state.rewardedOccurrenceIds.filter((id) => id === SESSION_READINESS_MILESTONE_ID)).toHaveLength(1);
  });

  it('awards at the first settled timeline stop even when a later stop misses a mandatory deadline', () => {
    const scenario = structuredClone(sessionScenario);
    scenario.patterns = scenario.patterns.map((pattern) => pattern.id === 'pattern-summarize-evidence'
      ? { ...pattern, durationMs: 1_000 }
      : pattern);
    const nearlyReady = readyState();
    const aide = nearlyReady.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const evidence = nearlyReady.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const started = executeCommand(nearlyReady, {
      type: 'SUBMIT_WORK', cardIds: [aide.id, evidence.id],
    }, { scenario }).state;
    const beforeTimeline: TermState = {
      ...started,
      weekLengthMs: 4_000,
      relationships: started.relationships.map((relationship, index) => index === 1
        ? {
            ...relationship,
            support: 'conditional' as const,
            conditions: [{ kind: 'governing-value' as const, value: started.player.values[0] }],
          }
        : relationship),
      obligations: [{
        id: 'mandatory:later-miss',
        sourceId: 'obligation-answer-renters',
        due: { week: 1, offsetMs: 2_000 },
        mandatory: true,
        status: 'open' as const,
        rewardCapital: 1,
        trustPenalty: 5,
      }],
    };
    expect(sessionReadiness(beforeTimeline).ready).toBe(false);

    const oneCommand = executeCommand(beforeTimeline, {
      type: 'ADVANCE_WEEK', confirmEarly: true, expectedWeek: 1,
    }, { scenario });
    expect(sessionReadiness(oneCommand.state).ready).toBe(false);
    expect(oneCommand.state.obligations[0].status).toBe('missed');
    expect(oneCommand.state.rewardedOccurrenceIds).toContain(SESSION_READINESS_MILESTONE_ID);
    expect(oneCommand.events.filter((event) => event.type === 'READINESS_MILESTONE_REWARDED')).toHaveLength(1);

    const firstStop = executeCommand(beforeTimeline, { type: 'FAST_FORWARD' }, { scenario });
    expect(sessionReadiness(firstStop.state).ready).toBe(true);
    expect(firstStop.events.filter((event) => event.type === 'READINESS_MILESTONE_REWARDED')).toHaveLength(1);
    const secondStop = executeCommand(firstStop.state, { type: 'FAST_FORWARD' }, { scenario });
    expect(sessionReadiness(secondStop.state).ready).toBe(false);
    const equivalent = executeCommand(secondStop.state, {
      type: 'ADVANCE_WEEK', confirmEarly: true, expectedWeek: 1,
    }, { scenario });
    expect(equivalent.state.resources.politicalCapital).toBe(oneCommand.state.resources.politicalCapital);
    expect(equivalent.state.rewardedOccurrenceIds).toEqual(oneCommand.state.rewardedOccurrenceIds);
    expect(equivalent.state.eventLog.filter((event) => event.type === 'READINESS_MILESTONE_REWARDED'))
      .toEqual(oneCommand.state.eventLog.filter((event) => event.type === 'READINESS_MILESTONE_REWARDED'));

    const concluded = executeCommand(beforeTimeline, { type: 'CONCLUDE_SESSION' }, { scenario });
    expect(concluded.state.runStatus).toBe('complete');
    expect(concluded.state.sessionRecord?.outcome).toBe('not-ready');
    expect(concluded.state.rewardedOccurrenceIds).toContain(SESSION_READINESS_MILESTONE_ID);
    expect(concluded.events.filter((event) => event.type === 'READINESS_MILESTONE_REWARDED')).toHaveLength(1);
  });
});
