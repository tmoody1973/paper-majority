import { describe, expect, it } from 'vitest';

import { previewDecision } from '@/domain/decisions';
import { executeCommand } from '@/domain/engine';
import { createRun } from '@/domain/initialState';
import type { CardInstance, PendingDecision, TermState } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

const services = { scenario: sessionScenario };

function withPending(demandId: string, revision = 0): TermState {
  const state = createRun({ ...sessionSetup, mode: 'session' });
  const demand = sessionScenario.demandDefinitions.find((candidate) => candidate.id === demandId)!;
  const pending: PendingDecision = {
    id: `decision:${demandId}:revision:${revision}`,
    sourceId: demandId,
    occurrenceId: `${demandId}:revision:${revision}`,
    officeDefinitionId: demand.officeDefinitionId,
    approachedBillRevision: revision,
    expectedBillRevision: revision,
    choiceIds: demand.choiceIds,
    status: 'pending',
  };
  return {
    ...state,
    paused: true,
    relationships: [],
    pendingDecisions: [pending],
    eventLog: [{
      type: 'DECISION_PRESENTED',
      decisionId: pending.id,
      sourceId: pending.sourceId,
      occurrenceId: pending.occurrenceId,
      choiceIds: pending.choiceIds,
    }],
  };
}

describe('previewDecision', () => {
  it('is pure and shows exact bill, resource, office, and value-conflict effects', () => {
    const state = withPending('demand-renter-protection');
    const before = structuredClone(state);
    const preview = previewDecision(state, sessionScenario, state.pendingDecisions[0].id, 'choice-accept-renter-protection');

    expect(preview).toMatchObject({
      accepted: true,
      affectedOfficeDefinitionIds: ['coalition-office-hillcrest'],
      nextProvisionIds: ['policy-zoning-incentive'],
      resourceDeltas: { politicalCapital: -1, policyIntegrity: -10 },
      expectedBillRevision: 0,
    });
    expect(preview.accepted && preview.incompatiblePromises).toContain('Tenant Stability');
    expect(state).toEqual(before);
    expect(state.rngCursor).toBe(before.rngCursor);
  });

  it('rejects a stale revision and missing counter prerequisites without changing state', () => {
    const pending = withPending('demand-renter-protection');
    const stale = { ...pending, bill: { ...pending.bill, revision: 1 } };
    expect(previewDecision(stale, sessionScenario, stale.pendingDecisions[0].id, 'choice-refuse-renter-protection')).toMatchObject({
      accepted: false,
      reason: 'stale-decision',
    });
    expect(previewDecision(pending, sessionScenario, pending.pendingDecisions[0].id, 'choice-counter-renter-protection')).toMatchObject({
      accepted: false,
      reason: 'missing-prerequisites',
    });
  });
});

describe('RESOLVE_DECISION', () => {
  it('resolves an acceptance exactly once and leaves player identity unchanged', () => {
    const state = withPending('demand-renter-protection');
    const command = {
      type: 'RESOLVE_DECISION' as const,
      decisionId: state.pendingDecisions[0].id,
      choiceId: 'choice-accept-renter-protection',
      expectedBillRevision: state.bill.revision,
    };
    const once = executeCommand(state, command, services);
    const twice = executeCommand(once.state, command, services);

    expect(once.state.player).toEqual(state.player);
    expect(once.state.bill.provisionIds).toEqual(['policy-zoning-incentive']);
    expect(once.state.relationships.find((entry) => entry.memberId === 'coalition-office-hillcrest')?.support).toBe('committed');
    expect(once.events.filter((event) => event.type === 'DECISION_RESOLVED')).toHaveLength(1);
    expect(twice.state).toBe(once.state);
    expect(twice.events).toEqual([expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'unknown-decision' })]);
  });

  it('records explicit refusal as an accepted decision plus declined opportunity', () => {
    const state = withPending('demand-renter-protection');
    const resolved = executeCommand(state, {
      type: 'RESOLVE_DECISION',
      decisionId: state.pendingDecisions[0].id,
      choiceId: 'choice-refuse-renter-protection',
      expectedBillRevision: 0,
    }, services);

    expect(resolved.events.map((event) => event.type)).toEqual([
      'DECISION_RESOLVED',
      'OPPORTUNITY_DECLINED',
    ]);
    expect(resolved.state.relationships[0]?.support).toBe('refused');
  });

  it('rejects an invalid or stale resolution atomically', () => {
    const state = withPending('demand-renter-protection');
    for (const command of [
      { type: 'RESOLVE_DECISION' as const, decisionId: state.pendingDecisions[0].id, choiceId: 'missing', expectedBillRevision: 0 },
      { type: 'RESOLVE_DECISION' as const, decisionId: state.pendingDecisions[0].id, choiceId: 'choice-refuse-renter-protection', expectedBillRevision: 1 },
    ]) {
      const result = executeCommand(state, command, services);
      expect(result.state).toBe(state);
      expect(result.state.eventLog).toBe(state.eventLog);
    }
  });

  it('accepts an opposing-party agreement without a party integrity penalty', () => {
    const state = withPending('demand-rural-supply');
    const result = executeCommand(state, {
      type: 'RESOLVE_DECISION',
      decisionId: state.pendingDecisions[0].id,
      choiceId: 'choice-accept-rural-supply',
      expectedBillRevision: 0,
    }, services);

    expect(result.state.player.party).toBe('democratic');
    expect(result.state.bill.provisionIds).toEqual(['policy-housing-choice-voucher']);
    expect(result.state.resources.policyIntegrity).toBe(76);
    expect(result.state.bill.provisionReceipts[0]).toMatchObject({
      origin: 'decision',
      sourceId: 'demand-rural-supply',
      sourceDefinitionIds: ['policy-housing-choice-voucher'],
      plainLanguage: 'Rental assistance policy used by the unit fixture.',
    });
    expect(result.state.relationships.find((entry) => entry.memberId === 'coalition-office-ridgeline')?.support).toBe('committed');
  });

  it('reserves exact counteroffer inputs and logs each nested work event once', () => {
    const base = withPending('demand-renter-protection');
    const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const prepared: CardInstance = {
      ...evidence,
      id: 'card-prepared-counter',
      stackId: 'stack-card-prepared-counter',
      form: 'prepared',
      origin: {
        explanationKey: 'result.evidence.office-concern-answered',
        inputDefinitionIds: [evidence.definitionId, 'coalition-office-hillcrest'],
        consumedDefinitionIds: [evidence.definitionId],
        authoredConcern: {
          concernId: 'demand-renter-protection',
          recipientOfficeDefinitionId: 'coalition-office-hillcrest',
        },
      },
    };
    const state = {
      ...base,
      cards: [...base.cards, prepared],
      stacks: [...base.stacks, { id: prepared.stackId, cardIds: [prepared.id] }],
    };
    const result = executeCommand(state, {
      type: 'RESOLVE_DECISION',
      decisionId: state.pendingDecisions[0].id,
      choiceId: 'choice-counter-renter-protection',
      expectedBillRevision: 0,
    }, services);

    expect(result.state.activeWork).toHaveLength(1);
    expect(result.state.activeWork[0]).toMatchObject({
      kind: 'pattern',
      patternId: 'pattern-counter-office-concern',
      decisionOrigin: {
        decisionId: state.pendingDecisions[0].id,
        choiceId: 'choice-counter-renter-protection',
        officeDefinitionId: 'coalition-office-hillcrest',
      },
    });
    expect(result.state.resources.staffAttention).toBe(2);
    expect(result.state.relationships.find((entry) => entry.memberId === 'coalition-office-hillcrest')?.support).toBe('conditional');
    for (const type of ['WORK_SUBMITTED', 'DECISION_RESOLVED', 'PROMISE_CHANGED'] as const) {
      expect(result.events.filter((event) => event.type === type)).toHaveLength(1);
      expect(result.state.eventLog.filter((event) => event.type === type)).toHaveLength(1);
    }

    const running = executeCommand(result.state, { type: 'SET_PAUSED', paused: false }, services);
    let finished = running;
    for (let index = 0; index < 30; index += 1) {
      finished = executeCommand(finished.state, { type: 'TICK', deltaMs: 1_000 }, services);
    }
    expect(finished.state.resources.staffAttention).toBe(3);
    expect(finished.state.relationships.find((entry) => entry.memberId === 'coalition-office-hillcrest')?.support).toBe('committed');
    expect(finished.state.eventLog.filter((event) =>
      event.type === 'PROMISE_CHANGED' && event.status === 'fulfilled',
    )).toHaveLength(1);
  });

  it('requires counter work and negative choice costs to be jointly affordable before applying rewards', () => {
    const base = withPending('demand-renter-protection');
    const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const prepared: CardInstance = {
      ...evidence,
      id: 'card-prepared-affordability',
      stackId: 'stack-card-prepared-affordability',
      form: 'prepared',
      origin: {
        explanationKey: 'result.evidence.office-concern-answered',
        inputDefinitionIds: [evidence.definitionId],
        consumedDefinitionIds: [],
        authoredConcern: {
          concernId: 'demand-renter-protection',
          recipientOfficeDefinitionId: 'coalition-office-hillcrest',
        },
      },
    };
    const scenario = structuredClone(sessionScenario);
    scenario.decisionChoices = scenario.decisionChoices.map((choice) =>
      choice.id === 'choice-counter-renter-protection'
        ? { ...choice, effects: [{ kind: 'resource', resource: 'staffAttention', delta: 2 }, ...choice.effects] }
        : choice,
    );
    const state: TermState = {
      ...base,
      resources: { ...base.resources, staffAttention: 0 },
      cards: [...base.cards, prepared],
      stacks: [...base.stacks, { id: prepared.stackId, cardIds: [prepared.id] }],
    };
    const before = structuredClone(state);
    const preview = previewDecision(state, scenario, state.pendingDecisions[0].id, 'choice-counter-renter-protection');
    expect(preview).toMatchObject({ accepted: false, reason: 'missing-prerequisites' });
    const result = executeCommand(state, {
      type: 'RESOLVE_DECISION',
      decisionId: state.pendingDecisions[0].id,
      choiceId: 'choice-counter-renter-protection',
      expectedBillRevision: 0,
    }, { scenario });
    expect(result.state).toBe(state);
    expect(result.state).toEqual(before);

    const combinedScenario = structuredClone(sessionScenario);
    combinedScenario.decisionChoices = combinedScenario.decisionChoices.map((choice) =>
      choice.id === 'choice-counter-renter-protection'
        ? { ...choice, effects: [{ kind: 'resource', resource: 'staffAttention', delta: -1 }, ...choice.effects] }
        : choice,
    );
    const oneAttention = { ...state, resources: { ...state.resources, staffAttention: 1 } };
    expect(previewDecision(oneAttention, combinedScenario, oneAttention.pendingDecisions[0].id, 'choice-counter-renter-protection')).toMatchObject({
      accepted: false,
      reason: 'insufficient-resources',
    });
  });

  it('shows support lost to a conflicting deal and regained by a later drafted bill edit without paying twice', () => {
    const ridgeline = withPending('demand-rural-supply');
    const first = executeCommand(ridgeline, {
      type: 'RESOLVE_DECISION',
      decisionId: ridgeline.pendingDecisions[0].id,
      choiceId: 'choice-accept-rural-supply',
      expectedBillRevision: 0,
    }, services);
    const hillcrestOccurrence = 'demand-renter-protection:revision:1';
    const hillcrestPending: PendingDecision = {
      id: `decision:${hillcrestOccurrence}`,
      sourceId: 'demand-renter-protection',
      occurrenceId: hillcrestOccurrence,
      officeDefinitionId: 'coalition-office-hillcrest',
      approachedBillRevision: 1,
      expectedBillRevision: 1,
      choiceIds: sessionScenario.demandDefinitions.find((demand) => demand.id === 'demand-renter-protection')!.choiceIds,
      status: 'pending',
    };
    const withSecond = { ...first.state, pendingDecisions: [...first.state.pendingDecisions, hillcrestPending] };
    const conflict = previewDecision(withSecond, sessionScenario, hillcrestPending.id, 'choice-accept-renter-protection');
    expect(conflict).toMatchObject({
      accepted: true,
      lostSupport: ['coalition-office-ridgeline'],
    });
    expect(conflict.accepted && conflict.incompatiblePromises).toContain('demand-rural-supply:revision:0');
    const second = executeCommand(withSecond, {
      type: 'RESOLVE_DECISION',
      decisionId: hillcrestPending.id,
      choiceId: 'choice-accept-renter-protection',
      expectedBillRevision: 1,
    }, services);
    expect(second.state.relationships.find((entry) => entry.memberId === 'coalition-office-ridgeline')?.support).toBe('conditional');
    expect(second.events).toContainEqual(expect.objectContaining({ type: 'PROMISE_CHANGED', status: 'broken' }));
    expect(second.state.resources.policyIntegrity).toBe(50);

    const raw = second.state.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')!;
    const drafted = {
      ...raw,
      form: 'drafted' as const,
      sourceDefinitionIds: ['evidence-rent-burden-report'],
    };
    const ready = { ...second.state, cards: second.state.cards.map((card) => card.id === raw.id ? drafted : card) };
    const regained = executeCommand(ready, { type: 'DOCKET_PROVISION', cardId: drafted.id }, services);
    expect(regained.state.relationships.find((entry) => entry.memberId === 'coalition-office-ridgeline')?.support).toBe('committed');
    expect(regained.events).toContainEqual(expect.objectContaining({ type: 'PROMISE_CHANGED', status: 'fulfilled' }));
    expect(regained.state.rewardedOccurrenceIds).toEqual(first.state.rewardedOccurrenceIds.concat(hillcrestOccurrence).sort());
  });
});

describe('outreach completion', () => {
  function finishOutreach(officeDefinitionId: string, revision = 0) {
    const scenario = structuredClone(sessionScenario);
    scenario.patterns = scenario.patterns.map((pattern) => pattern.id === 'pattern-coalition-outreach'
      ? { ...pattern, durationMs: 1 }
      : pattern);
    const base = createRun({ ...sessionSetup, scenario, mode: 'session' });
    const aide = base.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const office = base.cards.find((card) => card.definitionId === officeDefinitionId)!;
    const started = executeCommand(base, { type: 'SUBMIT_WORK', cardIds: [aide.id, office.id] }, { scenario });
    const changed = revision === 0 ? started.state : {
      ...started.state,
      bill: { ...started.state.bill, revision },
    };
    const running = executeCommand(changed, { type: 'SET_PAUSED', paused: false }, { scenario });
    return { scenario, result: executeCommand(running.state, { type: 'TICK', deltaMs: 1 }, { scenario }) };
  }

  it('presents and pauses one revision-bound decision for either party', () => {
    for (const officeId of ['coalition-office-hillcrest', 'coalition-office-ridgeline']) {
      const { scenario, result } = finishOutreach(officeId);
      expect(result.state.paused).toBe(true);
      expect(result.state.pendingDecisions.filter((decision) => decision.status === 'pending')).toHaveLength(1);
      expect(result.events.filter((event) => event.type === 'DECISION_PRESENTED')).toHaveLength(1);
      const resume = executeCommand(result.state, { type: 'SET_PAUSED', paused: false }, { scenario });
      expect(resume.state).toBe(result.state);
      expect(resume.events).toEqual([expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'pending-decision' })]);
      const office = scenario.cards.find((card) => card.id === officeId);
      expect(office?.kind).toBe('coalition');
    }
  });

  it('revalidates stale paid outreach against the current bill and blocks a duplicate reward or offer', () => {
    const { scenario, result } = finishOutreach('coalition-office-hillcrest', 1);
    const pending = result.state.pendingDecisions[0];
    expect(pending).toMatchObject({ approachedBillRevision: 0, expectedBillRevision: 1 });
    expect(previewDecision(result.state, scenario, pending.id, 'choice-refuse-renter-protection')).toMatchObject({ accepted: true });

    const aide = result.state.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const office = result.state.cards.find((card) => card.definitionId === 'coalition-office-hillcrest')!;
    const duplicate = executeCommand(result.state, { type: 'SUBMIT_WORK', cardIds: [aide.id, office.id] }, { scenario });
    expect(duplicate.state).toBe(result.state);
    expect(duplicate.events).toEqual([expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'duplicate-outreach' })]);
  });
});
