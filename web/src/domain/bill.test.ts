import { describe, expect, it } from 'vitest';

import { computePolicyIntegrity, previewBillChange } from '@/domain/bill';
import { executeCommand } from '@/domain/engine';
import { createRun } from '@/domain/initialState';
import type { CardInstance, ScenarioDefinition, TermState } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

const services = { scenario: sessionScenario };

function withShortWork(): ScenarioDefinition {
  return {
    ...sessionScenario,
    patterns: sessionScenario.patterns.map((pattern) => ({ ...pattern, durationMs: 1 })),
  };
}

function summaryState(scenario: ScenarioDefinition = sessionScenario): TermState {
  const state = createRun({ ...sessionSetup, scenario, mode: 'session' });
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.definitionId === 'evidence-rent-burden-report'
        ? {
            ...card,
            form: 'summary' as const,
            sourceDefinitionIds: ['evidence-rent-burden-report'],
            origin: {
              explanationKey: 'result.summary.committee-credibility',
              inputDefinitionIds: ['evidence-rent-burden-report', 'staff-policy-aide'],
              consumedDefinitionIds: ['evidence-rent-burden-report'],
            },
          }
        : card,
    ),
  };
}

function idOf(state: TermState, definitionId: string): string {
  const card = state.cards.find((candidate) => candidate.definitionId === definitionId);
  if (!card) throw new Error(`Missing fixture card ${definitionId}`);
  return card.id;
}

function addCard(state: TermState, card: CardInstance): TermState {
  return {
    ...state,
    cards: [...state.cards, card],
    stacks: [...state.stacks, { id: card.stackId, cardIds: [card.id] }],
  };
}

describe('bill value scoring', () => {
  it('recomputes selected-value contributions from authored policy content', () => {
    expect(
      computePolicyIntegrity(
        ['policy-housing-choice-voucher'],
        ['Tenant Stability', 'Fair Access'],
        sessionScenario,
      ),
    ).toBe(76);
    expect(
      computePolicyIntegrity(
        ['policy-housing-choice-voucher', 'policy-housing-choice-voucher'],
        ['Tenant Stability', 'Fair Access'],
        sessionScenario,
      ),
    ).toBe(76);
    expect(
      computePolicyIntegrity(
        ['policy-zoning-incentive'],
        ['Housing Supply', 'Local Control'],
        sessionScenario,
      ),
    ).toBe(58);

    const state = createRun({ ...sessionSetup, mode: 'session' });
    expect(
      previewBillChange(state, sessionScenario, ['policy-housing-choice-voucher']),
    ).toEqual({
      integrity: 76,
      contributions: [
        { provisionId: 'policy-housing-choice-voucher', value: 'Tenant Stability', delta: 8 },
        { provisionId: 'policy-housing-choice-voucher', value: 'Fair Access', delta: 8 },
      ],
    });
  });
});

describe('DOCKET_PROVISION', () => {
  it('does not change the bill when drafting starts, then consumes one sourced draft exactly once', () => {
    const scenario = withShortWork();
    const run = summaryState(scenario);
    const counsel = idOf(run, 'staff-legislative-counsel');
    const summary = idOf(run, 'evidence-rent-burden-report');
    const policy = idOf(run, 'policy-housing-choice-voucher');

    const started = executeCommand(run, { type: 'SUBMIT_WORK', cardIds: [counsel, summary, policy] }, { scenario });
    expect(started.state.bill).toEqual(run.bill);

    const running = executeCommand(started.state, { type: 'SET_PAUSED', paused: false }, { scenario });
    const finished = executeCommand(running.state, { type: 'TICK', deltaMs: 1 }, { scenario });
    const drafted = finished.state.cards.find(
      (card) => card.definitionId === 'policy-housing-choice-voucher' && card.form === 'drafted',
    );
    expect(drafted?.policyDefinitionId).toBe('policy-housing-choice-voucher');
    expect(drafted?.sourceDefinitionIds).toEqual(['evidence-rent-burden-report']);
    expect(finished.state.bill).toEqual(run.bill);

    const first = executeCommand(
      finished.state,
      { type: 'DOCKET_PROVISION', cardId: drafted!.id },
      { scenario },
    );
    const second = executeCommand(
      first.state,
      { type: 'DOCKET_PROVISION', cardId: drafted!.id },
      { scenario },
    );

    expect(second.state).toEqual(first.state);
    expect(first.state.bill.revision).toBe(finished.state.bill.revision + 1);
    expect(first.state.bill.provisionIds).toEqual(['policy-housing-choice-voucher']);
    expect(first.state.bill.provisionReceipts).toEqual([
      {
        provisionId: 'policy-housing-choice-voucher',
        draftedCardId: drafted!.id,
        sourceDefinitionIds: ['evidence-rent-burden-report'],
        docketedAtRevision: 1,
        plainLanguage: 'Rental assistance policy used by the unit fixture.',
        form: 'drafted',
        sourceClass: 'simulated',
      },
    ]);
    expect(first.state.cards.some((card) => card.id === drafted!.id)).toBe(false);
    expect(first.state.resources.policyIntegrity).toBe(76);
    expect(first.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'RESOURCE_CHANGED',
        changes: { policyIntegrity: 16 },
        reason: 'bill-revision:1',
      }),
      expect.objectContaining({
        type: 'PROVISION_DOCKETED',
        cardId: drafted!.id,
        provisionId: 'policy-housing-choice-voucher',
        revision: 1,
      }),
    ]));
  });

  it('rejects a second drafted instance of the same policy without changing state or spending it', () => {
    const base = summaryState();
    const rawPolicy = base.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')!;
    const firstDraft: CardInstance = {
      ...rawPolicy,
      id: 'card-draft-first',
      stackId: 'stack-card-draft-first',
      form: 'drafted',
      sourceDefinitionIds: ['evidence-rent-burden-report'],
      policyDefinitionId: rawPolicy.definitionId,
    };
    const secondDraft: CardInstance = {
      ...firstDraft,
      id: 'card-draft-second',
      stackId: 'stack-card-draft-second',
    };
    const ready = addCard(addCard(base, firstDraft), secondDraft);
    const docketed = executeCommand(ready, { type: 'DOCKET_PROVISION', cardId: firstDraft.id }, services);
    const duplicate = executeCommand(docketed.state, { type: 'DOCKET_PROVISION', cardId: secondDraft.id }, services);

    expect(duplicate.state).toBe(docketed.state);
    expect(duplicate.events).toEqual([
      expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'duplicate-provision' }),
    ]);
    expect(duplicate.state.cards.some((card) => card.id === secondDraft.id)).toBe(true);
  });
});

describe('competing summary evidence uses', () => {
  it('rejects a mismatched concern recipient without reserving cards or spending attention', () => {
    let state = summaryState();
    state = addCard(state, {
      id: 'card-coalition-office-ridgeline',
      definitionId: 'coalition-office-ridgeline',
      stackId: 'stack-card-coalition-office-ridgeline',
      x: 900,
      y: 300,
      remainingMs: 0,
      status: 'idle',
      form: 'raw',
      location: 'desk',
      sourceDefinitionIds: [],
    });
    state = addCard(state, {
      id: 'card-constituency-renter-concern',
      definitionId: 'constituency-renter-concern',
      stackId: 'stack-card-constituency-renter-concern',
      x: 960,
      y: 340,
      remainingMs: 0,
      status: 'idle',
      form: 'raw',
      location: 'desk',
      sourceDefinitionIds: [],
    });
    const inputs = [
      idOf(state, 'staff-district-director'),
      idOf(state, 'evidence-rent-burden-report'),
      idOf(state, 'coalition-office-ridgeline'),
      idOf(state, 'constituency-renter-concern'),
    ];
    const originalResources = state.resources;
    const originalEventLog = state.eventLog;

    const rejected = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: inputs }, services);

    expect(rejected.state).toBe(state);
    expect(rejected.state.resources).toBe(originalResources);
    expect(rejected.state.eventLog).toBe(originalEventLog);
    expect(rejected.state.activeWork).toEqual([]);
    expect(rejected.state.cards.every((card) => card.status === 'idle')).toBe(true);
    expect(rejected.events).toEqual([
      expect.objectContaining({
        type: 'COMMAND_REJECTED',
        reason: 'no-matching-pattern',
        message: 'That authored concern belongs to a different recipient office.',
      }),
    ]);
  });

  it.each([
    {
      patternId: 'pattern-answer-office-concern',
      extraDefinitionId: 'coalition-office-hillcrest',
      concernDefinitionId: 'constituency-renter-concern',
      expectedReceipt: 'result.evidence.office-concern-answered',
    },
    {
      patternId: 'pattern-prepare-evidence-packet',
      extraDefinitionId: undefined,
      concernDefinitionId: undefined,
      expectedReceipt: 'result.evidence.district-packet-prepared',
    },
  ])('reserves, consumes, and records $patternId without changing later-task support', ({ extraDefinitionId, concernDefinitionId, expectedReceipt }) => {
    const scenario = withShortWork();
    let state = summaryState(scenario);
    if (extraDefinitionId) {
      state = addCard(state, {
        id: `card-${extraDefinitionId}`,
        definitionId: extraDefinitionId,
        stackId: `stack-card-${extraDefinitionId}`,
        x: 900,
        y: 300,
        remainingMs: 0,
        status: 'idle',
        form: 'raw',
        location: 'desk',
        sourceDefinitionIds: [],
      });
    }
    if (concernDefinitionId) {
      state = addCard(state, {
        id: `card-${concernDefinitionId}`,
        definitionId: concernDefinitionId,
        stackId: `stack-card-${concernDefinitionId}`,
        x: 960,
        y: 340,
        remainingMs: 0,
        status: 'idle',
        form: 'raw',
        location: 'desk',
        sourceDefinitionIds: [],
      });
    }
    const summary = idOf(state, 'evidence-rent-burden-report');
    const inputs = [idOf(state, 'staff-district-director'), summary];
    if (extraDefinitionId) inputs.push(idOf(state, extraDefinitionId));
    if (concernDefinitionId) inputs.push(idOf(state, concernDefinitionId));

    const started = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: inputs }, { scenario });
    expect(started.state.activeWork[0]?.consumedCardIds).toContain(summary);
    const repeated = executeCommand(started.state, { type: 'SUBMIT_WORK', cardIds: inputs }, { scenario });
    expect(repeated.state).toBe(started.state);

    const running = executeCommand(started.state, { type: 'SET_PAUSED', paused: false }, { scenario });
    const finished = executeCommand(running.state, { type: 'TICK', deltaMs: 1 }, { scenario });
    const prepared = finished.state.cards.find(
      (card) => card.definitionId === 'evidence-rent-burden-report' && card.form === 'prepared',
    );
    expect(prepared?.sourceDefinitionIds).toEqual(['evidence-rent-burden-report']);
    expect(prepared?.origin?.explanationKey).toBe(expectedReceipt);
    if (concernDefinitionId) {
      expect(prepared?.origin?.authoredConcern).toEqual({
        concernId: 'demand-renter-protection',
        recipientOfficeDefinitionId: 'coalition-office-hillcrest',
      });
      expect(prepared?.origin?.inputDefinitionIds).toContain(concernDefinitionId);
      expect(finished.state.cards.some((card) => card.definitionId === concernDefinitionId)).toBe(false);
    }
    expect(finished.state.cards.some((card) => card.id === summary)).toBe(false);
    expect(finished.state.relationships).toEqual(state.relationships);
    expect(finished.state.bill).toEqual(state.bill);
  });
});
