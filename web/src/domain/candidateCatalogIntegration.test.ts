import { describe, expect, it } from 'vitest';

import { getCandidateScenario } from '@/content/loadScenario';
import { executeCommand } from '@/domain/engine';
import { matchesPatternOutputReceipt, resolvePatternOutput } from '@/domain/patternResolvers';
import { buildMatchInputs, matchPattern } from '@/domain/recipes';
import { createRun } from '@/domain/runSetup';
import type { TermState } from '@/domain/types';
import { createSaveEnvelope, validateAndMigrateSave } from '@/persistence/saveMigrations';

const scenario = getCandidateScenario();

function run(): TermState {
  return createRun({
    scenario,
    districtId: 'GA-05',
    party: 'democratic',
    values: ['Tenant Stability', 'Housing Supply'],
    mode: 'session',
    seed: 417,
  });
}

function cardId(state: TermState, definitionId: string, form: TermState['cards'][number]['form'] = 'raw') {
  const card = state.cards.find((entry) => entry.definitionId === definitionId && entry.form === form && entry.status === 'idle');
  if (!card) throw new Error(`Missing ${definitionId}@${form}`);
  return card.id;
}

function finishWork(state: TermState, ids: string[]): TermState {
  const submitted = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: ids }, { scenario });
  expect(submitted.events).toContainEqual(expect.objectContaining({ type: 'WORK_SUBMITTED' }));
  let next = executeCommand(submitted.state, { type: 'SET_PAUSED', paused: false }, { scenario }).state;
  for (let step = 0; step < 60 && next.activeWork.length > 0; step += 1) {
    next = executeCommand(next, { type: 'TICK', deltaMs: 1_000 }, { scenario }).state;
  }
  expect(next.activeWork).toHaveLength(0);
  return next;
}

function openWeek(state: TermState, week: number, categoryId: string): TermState {
  const staged = { ...state, week, paused: true };
  const opened = executeCommand(staged, {
    type: 'OPEN_PACK', packOccurrenceId: `pack:week:${week}`, categoryId,
  }, { scenario });
  expect(opened.events).toContainEqual(expect.objectContaining({ type: 'PACK_OPENED' }));
  return opened.state;
}

describe('candidate producer-to-consumer commands', () => {
  it.each([
    { patternId: 'pattern-draft-policy', supplyId: 'evidence-rent-burden-report', supplyForm: 'summary' as const },
    { patternId: 'pattern-tactic-costly-drafting', supplyId: 'political-media-attention', supplyForm: 'raw' as const },
  ])('drafts real Policy language and round-trips $patternId', ({ patternId, supplyId, supplyForm }) => {
    let state = run();
    if (supplyForm === 'summary') {
      state = finishWork(state, [cardId(state, 'staff-policy-aide'), cardId(state, supplyId)]);
    } else {
      // Initialize this optional supply at its authored pack week; this is not a six-week playthrough.
      state = openWeek(state, 6, 'week-six-office');
    }
    const policyId = 'policy-housing-choice-voucher';
    const policyCardId = cardId(state, policyId);
    const supplyCardId = cardId(state, supplyId, supplyForm);
    const staffCardId = cardId(state, 'staff-legislative-counsel');
    // Deliberately differ from slot order: identity must come from the matched assignment.
    const ids = [supplyCardId, staffCardId, policyCardId];
    const inputs = buildMatchInputs(ids.map((id) => state.cards.find((card) => card.id === id)!), scenario, state.player.party);
    const match = matchPattern(inputs, scenario.patterns, Object.values(state.unlockedSlotExpansions).flat(), scenario.tacticExpansions)!;
    expect(match.pattern.id).toBe(patternId);
    expect(resolvePatternOutput(match, inputs)).toEqual({
      definitionId: policyId,
      form: 'drafted',
      outputSlotIndex: 1,
      effects: { billMomentum: 2 },
      explanationKey: 'result.provision.drafted',
    });
    state = finishWork(state, ids);
    const drafted = state.cards.find((card) => card.definitionId === policyId && card.form === 'drafted')!;
    expect(drafted).toMatchObject({
      policyDefinitionId: policyId,
      sourceDefinitionIds: supplyForm === 'summary' ? [supplyId] : [],
      origin: {
        explanationKey: 'result.provision.drafted',
        inputDefinitionIds: [policyId, supplyId, 'staff-legislative-counsel'].sort(),
        consumedDefinitionIds: [policyId, supplyId].sort(),
      },
    });
    const receipt = state.eventLog.find((event) => event.type === 'CARD_TRANSFORMED'
      && event.producedCardIds.includes(drafted.id));
    expect(receipt).toMatchObject({
      producerPatternId: patternId,
      outputDefinitionId: policyId,
      outputForm: 'drafted',
      outputSlotIndex: 1,
      outputSourceCardId: policyCardId,
      outputSourceDefinitionId: policyId,
      outputSourceForm: 'raw',
      consumedCardIds: expect.arrayContaining([policyCardId, supplyCardId]),
      returnedCardIds: [staffCardId],
    });
    expect(matchesPatternOutputReceipt(match.pattern, scenario, {
      definitionId: drafted.definitionId,
      form: drafted.form,
      explanationKey: drafted.origin!.explanationKey,
      outputSlotIndex: 1,
      outputSourceDefinitionId: policyId,
      outputSourceForm: 'raw',
    })).toBe(true);
    const roundTrip = validateAndMigrateSave(JSON.parse(JSON.stringify(createSaveEnvelope(state, scenario))), scenario);
    expect(roundTrip.kind).toBe('valid');
    if (roundTrip.kind !== 'valid') throw new Error('Production draft must reload');
    expect(roundTrip.envelope.state).toEqual(state);

    // Even a coordinated live-card/receipt rewrite cannot restore the old wrong-family output.
    const wrongSlot = {
      ...state,
      cards: state.cards.map((card) => card.id === drafted.id ? { ...card, definitionId: supplyId } : card),
      eventLog: state.eventLog.map((event) => event === receipt ? {
        ...event,
        outputDefinitionId: supplyId,
        outputSlotIndex: 2,
        outputSourceCardId: supplyCardId,
        outputSourceDefinitionId: supplyId,
        outputSourceForm: supplyForm,
      } : event),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(wrongSlot, scenario), scenario).kind).toBe('corrupt');
  });

  it('fulfills the seeded Waters fair-access counter with its authored renter concern', () => {
    let state = run();
    expect(state.runVariation.selectedDemandIdsByOffice['coalition-office-maxine-waters']).toBe('demand-fair-access');
    state = executeCommand(state, {
      type: 'ADVANCE_WEEK', confirmEarly: true, expectedWeek: 1,
    }, { scenario }).state;
    state = executeCommand(state, { type: 'ADVANCE_WEEK' }, { scenario }).state;
    expect(state.week).toBe(2);
    const storyDecision = state.pendingStoryDecisions.find((decision) => decision.status === 'pending')!;
    const story = scenario.storyEvents.find((event) => event.id === storyDecision.storyEventId)!;
    const freeChoice = story.choices.find((choice) => Object.values(choice.cost).every((amount) => amount === 0))!;
    state = executeCommand(state, {
      type: 'RESOLVE_STORY', decisionId: storyDecision.id, choiceId: freeChoice.id,
    }, { scenario }).state;
    state = executeCommand(state, {
      type: 'OPEN_PACK', packOccurrenceId: 'pack:week:2', categoryId: 'week-two-policy',
    }, { scenario }).state;
    state = finishWork(state, [cardId(state, 'staff-policy-aide'), cardId(state, 'evidence-rent-burden-report')]);
    state = finishWork(state, [cardId(state, 'staff-district-director'), cardId(state, 'coalition-office-maxine-waters')]);
    const decision = state.pendingDecisions.find((entry) => entry.status === 'pending')!;
    expect(decision.sourceId).toBe('demand-fair-access');
    const renterConcernId = cardId(state, 'constituency-urgent-renter-concern');
    const wrongConcern = {
      ...state,
      cards: state.cards.map((card) => card.id === renterConcernId
        ? { ...card, definitionId: 'constituency-local-builders-roundtable' }
        : card),
    };
    const rejected = executeCommand(wrongConcern, {
      type: 'RESOLVE_DECISION',
      decisionId: decision.id,
      choiceId: 'choice-counter-renter-stability',
      expectedBillRevision: decision.expectedBillRevision,
    }, { scenario });
    expect(rejected.state).toBe(wrongConcern);
    expect(rejected.events).toContainEqual(expect.objectContaining({
      type: 'COMMAND_REJECTED', reason: 'no-matching-pattern',
    }));
    const accepted = executeCommand(state, {
      type: 'RESOLVE_DECISION',
      decisionId: decision.id,
      choiceId: 'choice-counter-renter-stability',
      expectedBillRevision: decision.expectedBillRevision,
    }, { scenario });
    expect(accepted.events).toContainEqual(expect.objectContaining({ type: 'WORK_SUBMITTED' }));
    state = executeCommand(accepted.state, { type: 'SET_PAUSED', paused: false }, { scenario }).state;
    for (let step = 0; step < 60 && state.activeWork.length > 0; step += 1) {
      state = executeCommand(state, { type: 'TICK', deltaMs: 1_000 }, { scenario }).state;
    }
    expect(state.activeWork).toHaveLength(0);
    expect(state.cards).toContainEqual(expect.objectContaining({
      form: 'prepared',
      origin: expect.objectContaining({
        explanationKey: 'result.evidence.office-concern-answered',
        authoredConcern: {
          concernId: 'demand-renter-stability',
          recipientOfficeDefinitionId: 'coalition-office-maxine-waters',
        },
      }),
    }));
    expect(state.relationships.find((entry) => entry.memberId === 'coalition-office-maxine-waters')?.support).toBe('committed');
  });

  it('does not fulfill the renter occurrence with the unrelated builders card', () => {
    let state = openWeek(run(), 2, 'week-two-policy');
    state = openWeek(state, 3, 'week-three-evidence');
    state = finishWork(state, [cardId(state, 'staff-policy-aide'), cardId(state, 'evidence-rent-burden-report')]);
    state = finishWork(state, [
      cardId(state, 'staff-district-director'),
      cardId(state, 'constituency-local-builders-roundtable'),
      cardId(state, 'evidence-rent-burden-report', 'summary'),
    ]);
    expect(state.obligations.find((entry) => entry.sourceId === 'obligation-builder-response')?.status).toBe('fulfilled');
    expect(state.obligations.find((entry) => entry.sourceId === 'obligation-renter-response')?.status).toBe('open');
  });

  it('keeps a basic response useful while reserving negotiation for the evidence-earned endorsement', () => {
    let state = openWeek(run(), 2, 'week-two-policy');
    state = finishWork(state, [
      cardId(state, 'staff-policy-aide'),
      cardId(state, 'evidence-rent-burden-report'),
    ]);
    const summaryId = cardId(state, 'evidence-rent-burden-report', 'summary');
    const concernDefinitionId = 'constituency-urgent-renter-concern';
    const rawConcernId = cardId(state, concernDefinitionId);
    state = finishWork(state, [cardId(state, 'staff-district-director'), rawConcernId]);
    expect(state.cards).toContainEqual(expect.objectContaining({ id: rawConcernId, form: 'raw' }));
    const basicId = state.cards.find((card) => card.definitionId === concernDefinitionId
      && card.form === 'prepared' && card.origin?.explanationKey === 'result.constituency.response-prepared')!.id;
    expect(validateAndMigrateSave(createSaveEnvelope(state, scenario), scenario).kind).toBe('valid');
    const missingOrigin = {
      ...state,
      cards: state.cards.map((card) => card.id === basicId ? { ...card, origin: undefined } : card),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(missingOrigin, scenario), scenario).kind).toBe('corrupt');
    const relabeled = {
      ...state,
      cards: state.cards.map((card) => card.id === basicId
        ? { ...card, origin: { ...card.origin!, explanationKey: 'result.constituency.endorsement-earned' } }
        : card),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(relabeled, scenario), scenario).kind).toBe('corrupt');
    const forgedOriginAndReceipt = {
      ...relabeled,
      eventLog: relabeled.eventLog.map((event) => event.type === 'CARD_TRANSFORMED'
        && event.producedCardIds.includes(basicId)
        ? { ...event, explanationKey: 'result.constituency.endorsement-earned' }
        : event),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(forgedOriginAndReceipt, scenario), scenario).kind).toBe('corrupt');
    const wrongOutputIdentity = {
      ...state,
      cards: state.cards.map((card) => card.id === basicId
        ? { ...card, definitionId: 'staff-policy-aide' }
        : card),
      eventLog: state.eventLog.map((event) => event.type === 'CARD_TRANSFORMED'
        && event.producedCardIds.includes(basicId)
        ? { ...event, outputDefinitionId: 'staff-policy-aide' }
        : event),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(wrongOutputIdentity, scenario), scenario).kind).toBe('corrupt');
    const basicAttempt = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: [
      cardId(state, 'staff-district-director'), cardId(state, 'coalition-office-mike-flood'), basicId,
    ] }, { scenario });
    expect(basicAttempt.events).toContainEqual(expect.objectContaining({ type: 'COMMAND_REJECTED' }));

    state = finishWork(state, [cardId(state, 'staff-district-director'), rawConcernId, summaryId]);
    const endorsementId = state.cards.find((card) => card.definitionId === concernDefinitionId
      && card.form === 'prepared' && card.origin?.explanationKey === 'result.constituency.endorsement-earned')!.id;
    expect(validateAndMigrateSave(createSaveEnvelope(state, scenario), scenario).kind).toBe('valid');
    const downstream = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: [
      cardId(state, 'staff-district-director'), cardId(state, 'coalition-office-maxine-waters'), endorsementId,
    ] }, { scenario });
    expect(downstream.events).toContainEqual(expect.objectContaining({ type: 'WORK_SUBMITTED' }));
  });

  it('prepares an Institution from the correct slot and accepts it downstream', () => {
    let state = openWeek(run(), 3, 'week-three-evidence');
    state = { ...state, bill: { ...state.bill, stage: 'committee' } };
    const evidenceInputId = cardId(state, 'evidence-rent-burden-report');
    state = finishWork(state, [
      cardId(state, 'staff-policy-aide'),
      evidenceInputId,
      cardId(state, 'institution-committee-hearing'),
    ]);
    const packet = state.cards.find((card) => card.definitionId === 'institution-committee-hearing'
      && card.form === 'prepared' && card.origin?.explanationKey === 'result.institution.committee-packet-prepared');
    expect(packet).toBeDefined();
    expect(validateAndMigrateSave(createSaveEnvelope(state, scenario), scenario).kind).toBe('valid');
    const wrongSlotOutput = {
      ...state,
      cards: state.cards.map((card) => card.id === packet!.id
        ? { ...card, definitionId: 'evidence-rent-burden-report' }
        : card),
      eventLog: state.eventLog.map((event) => event.type === 'CARD_TRANSFORMED'
        && event.producedCardIds.includes(packet!.id)
        ? {
            ...event,
            outputDefinitionId: 'evidence-rent-burden-report',
            outputSourceCardId: evidenceInputId,
            outputSourceDefinitionId: 'evidence-rent-burden-report',
          }
        : event),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(wrongSlotOutput, scenario), scenario).kind).toBe('corrupt');
    const downstream = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: [
      cardId(state, 'staff-policy-aide'), cardId(state, 'coalition-office-mike-flood'), packet!.id,
    ] }, { scenario });
    expect(downstream.events).toContainEqual(expect.objectContaining({ type: 'WORK_SUBMITTED' }));
  });

  it('prepares a simulated Political asset and accepts it downstream', () => {
    let state = openWeek(run(), 6, 'week-six-office');
    state = finishWork(state, [cardId(state, 'staff-policy-aide'), cardId(state, 'political-media-attention')]);
    const asset = state.cards.find((card) => card.definitionId === 'political-media-attention'
      && card.form === 'prepared' && card.origin?.explanationKey === 'result.political.asset-prepared');
    expect(asset).toBeDefined();
    const downstream = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: [
      cardId(state, 'staff-policy-aide'), cardId(state, 'coalition-office-mike-flood'), asset!.id,
    ] }, { scenario });
    expect(downstream.events).toContainEqual(expect.objectContaining({ type: 'WORK_SUBMITTED' }));
  });
});
