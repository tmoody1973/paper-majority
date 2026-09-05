import { describe, expect, it } from 'vitest';

import { evaluateRelationships } from '@/domain/coalition';
import { createRun } from '@/domain/initialState';
import type { CardInstance, RelationshipState, TermState } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function stateWithRelationship(relationship: RelationshipState): TermState {
  const state = createRun({ ...sessionSetup, mode: 'session' });
  return { ...state, relationships: [relationship] };
}

describe('evaluateRelationships', () => {
  it('starts authored offices as interested and leaves public party identity untouched', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const evaluated = evaluateRelationships(state, sessionScenario);

    expect(evaluated.map(({ memberId, support }) => ({ memberId, support }))).toEqual([
      { memberId: 'coalition-office-hillcrest', support: 'interested' },
      { memberId: 'coalition-office-ridgeline', support: 'interested' },
    ]);
    expect(sessionScenario.cards.find((card) => card.id === 'coalition-office-ridgeline')).toMatchObject({
      officialRecord: { party: 'republican' },
    });
  });

  it('keeps an accepted promise conditional, commits it when exact recipient evidence exists, and can lose and regain support', () => {
    const occurrenceId = 'demand-renter-protection:revision:0';
    const relationship: RelationshipState = {
      memberId: 'coalition-office-hillcrest',
      support: 'conditional',
      demandProvisionId: 'demand-renter-protection',
      demandOccurrenceId: occurrenceId,
      promiseOccurrenceIds: [occurrenceId],
      conditions: [{ kind: 'prepared-evidence-tag', tag: 'committee-relevant' }],
      evaluatedRevision: 0,
    };
    const base = stateWithRelationship(relationship);
    expect(evaluateRelationships(base, sessionScenario)[0]?.support).toBe('conditional');

    const source = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const prepared: CardInstance = {
      ...source,
      id: 'card-prepared-hillcrest',
      stackId: 'stack-card-prepared-hillcrest',
      form: 'prepared',
      origin: {
        explanationKey: 'result.evidence.office-concern-answered',
        inputDefinitionIds: [source.definitionId],
        consumedDefinitionIds: [],
        authoredConcern: {
          concernId: 'demand-renter-protection',
          recipientOfficeDefinitionId: 'coalition-office-hillcrest',
        },
      },
    };
    const fulfilled = {
      ...base,
      cards: [...base.cards, prepared],
      stacks: [...base.stacks, { id: prepared.stackId, cardIds: [prepared.id] }],
    };
    expect(evaluateRelationships(fulfilled, sessionScenario)[0]?.support).toBe('committed');

    const lost = { ...fulfilled, cards: fulfilled.cards.filter((card) => card.id !== prepared.id) };
    expect(evaluateRelationships(lost, sessionScenario)[0]?.support).toBe('conditional');
    expect(evaluateRelationships(fulfilled, sessionScenario)[0]?.support).toBe('committed');
  });

  it('does not let generic prepared evidence satisfy another office promise', () => {
    const occurrenceId = 'demand-rural-supply:revision:0';
    const relationship: RelationshipState = {
      memberId: 'coalition-office-ridgeline',
      support: 'conditional',
      demandProvisionId: 'demand-rural-supply',
      demandOccurrenceId: occurrenceId,
      promiseOccurrenceIds: [occurrenceId],
      conditions: [{ kind: 'prepared-evidence-tag', tag: 'committee-relevant' }],
      evaluatedRevision: 0,
    };
    const base = stateWithRelationship(relationship);
    const source = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const preparedForHillcrest: CardInstance = {
      ...source,
      id: 'card-prepared-hillcrest',
      form: 'prepared',
      origin: {
        explanationKey: 'result.evidence.office-concern-answered',
        inputDefinitionIds: [source.definitionId],
        consumedDefinitionIds: [],
        authoredConcern: {
          concernId: 'demand-renter-protection',
          recipientOfficeDefinitionId: 'coalition-office-hillcrest',
        },
      },
    };

    expect(evaluateRelationships({ ...base, cards: [...base.cards, preparedForHillcrest] }, sessionScenario)
      .find((entry) => entry.memberId === 'coalition-office-ridgeline')?.support).toBe('conditional');
  });

  it('does not let the same office use evidence prepared for a different authored concern', () => {
    const occurrenceId = 'demand-renter-protection:revision:0';
    const base = stateWithRelationship({
      memberId: 'coalition-office-hillcrest',
      support: 'conditional',
      demandProvisionId: 'demand-renter-protection',
      demandOccurrenceId: occurrenceId,
      promiseOccurrenceIds: [occurrenceId],
      conditions: [{ kind: 'prepared-evidence-tag', tag: 'committee-relevant' }],
      evaluatedRevision: 0,
    });
    const source = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const wrongConcern: CardInstance = {
      ...source,
      id: 'card-prepared-wrong-concern',
      form: 'prepared',
      origin: {
        explanationKey: 'result.evidence.office-concern-answered',
        inputDefinitionIds: [source.definitionId],
        consumedDefinitionIds: [],
        authoredConcern: {
          concernId: 'demand-rural-supply',
          recipientOfficeDefinitionId: 'coalition-office-hillcrest',
        },
      },
    };

    expect(evaluateRelationships({ ...base, cards: [...base.cards, wrongConcern] }, sessionScenario)[0]?.support)
      .toBe('conditional');
  });
});
