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
});
