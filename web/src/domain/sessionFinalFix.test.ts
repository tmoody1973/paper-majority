import { describe, expect, it } from 'vitest';
import { getCandidateScenario } from '@/content/loadScenario';
import { createFixtureState, getFixtureScenario } from '@/content/fixtures/loadFixture';
import { parseScenario } from '@/content/schema';
import { executeCommand } from '@/domain/engine';
import { createRun } from '@/domain/runSetup';
import { DEFAULT_RUN_SETTINGS } from '@/domain/initialState';
import { previewDecision } from '@/domain/decisions';
import { evaluateRelationships } from '@/domain/coalition';
import { matchesPatternOutputReceipt } from '@/domain/patternResolvers';
import { previewWork } from '@/domain/work';
import type { GameCommand } from '@/domain/commands';
import type { TermState } from '@/domain/types';
import { chooseCommand, type PolicyId } from '@/../scripts/balance/policies';
import { completedTacticUseIds } from '@/../scripts/balance/metrics';
import { createSaveEnvelope, scenarioSnapshotHash, validateAndMigrateSave } from '@/persistence/saveMigrations';
import { createChallengeSetup, decodeChallenge, encodeChallenge } from '@/persistence/challengeCode';

const scenario = getCandidateScenario();
const setup = { seed: 1, districtId: 'GA-05', party: 'democratic' as const, values: ['Tenant Stability', 'Housing Supply'] as ['Tenant Stability', 'Housing Supply'], settings: DEFAULT_RUN_SETTINGS, mode: 'session' as const };
const opening = (candidate = scenario) => createRun({ ...setup, scenario: candidate });
const apply = (state: TermState, command: GameCommand, candidate = scenario) => {
  const result = executeCommand(state, command, { scenario: candidate });
  expect(result.events.find((event) => event.type === 'COMMAND_REJECTED')).toBeUndefined();
  return result.state;
};
function until(predicate: (state: TermState) => boolean, policy: PolicyId = 'greedy-same-party', state = opening()) {
  for (let i = 0; i < 180 && !predicate(state) && state.runStatus !== 'complete'; i++) state = apply(state, chooseCommand(policy, state, scenario));
  expect(predicate(state)).toBe(true);
  return state;
}
const validSave = (state: TermState, candidate = scenario) => expect(validateAndMigrateSave(createSaveEnvelope(state, candidate), candidate).kind).toBe('valid');

it.each(['idle', 'studying'] as const)('rejects direct Session Tactic activation while %s without changing any state and studies once normally', (status) => {
  let state = until((state) => state.week === 2 && state.activeWork.length === 0 && state.cards.some((card) => card.definitionId === 'tactic-bipartisan-working-group'));
  const tactic = state.cards.find((card) => card.definitionId === 'tactic-bipartisan-working-group')!;
  const staff = state.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
  const study: GameCommand = { type: 'START_ASSIGNMENT', assignmentKind: 'study-tactic', staffCardId: staff.id, targetCardId: tactic.id };
  if (status === 'studying') state = apply(state, study);
  const before = JSON.stringify(state);
  const result = executeCommand(state, { type: 'ACTIVATE_TACTIC', tacticCardId: tactic.id, expansionId: 'expansion-bipartisan-working-group' }, { scenario });
  expect(result.state).toBe(state);
  expect(JSON.stringify(result.state)).toBe(before);
  expect(result.events).toEqual([expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'unsupported-command' })]);
  validSave(result.state);
  if (status === 'idle') state = apply(state, study);
  state = apply(state, { type: 'FAST_FORWARD' });
  expect(state.activeWork).toHaveLength(0);
  expect(state.eventLog.filter((event) => event.type === 'TACTIC_EXPANSION_ACTIVATED' && event.expansionId === 'expansion-bipartisan-working-group')).toHaveLength(1);
  validSave(state);
  state = apply(state, { type: 'FAST_FORWARD' });
  expect(state.eventLog.filter((event) => event.type === 'TACTIC_EXPANSION_ACTIVATED' && event.expansionId === 'expansion-bipartisan-working-group')).toHaveLength(1);
});

it('preserves explicit legacy direct Tactic activation', () => {
  const legacy = getFixtureScenario();
  const state = createFixtureState('interaction-spike');
  const expansion = legacy.tacticExpansions[0];
  const tactic = state.cards.find((card) => card.definitionId === expansion.tacticDefinitionId)!;
  const result = executeCommand(state, { type: 'ACTIVATE_TACTIC', tacticCardId: tactic.id, expansionId: expansion.id }, { scenario: legacy });
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'TACTIC_EXPANSION_ACTIVATED' }));
});

describe('frozen Session summary relevance', () => {
  it.each([
    ['district', ['district-relevant', 'drafting-relevant'], { districtTrust: 3 }, 'result.summary.district-relevance'],
    ['dual', ['district-relevant', 'committee-relevant'], { billMomentum: 3 }, 'result.summary.committee-credibility'],
    ['neutral', ['drafting-relevant'], {}, 'result.summary.no-context-bonus'],
  ] as const)('%s relevance controls real completion and authenticates its explanation', (_name, tags, effects, explanationKey) => {
    for (const sourceClass of ['official', 'derived'] as const) {
      const candidate = structuredClone(scenario);
      const evidence = candidate.cards.find((card) => card.id === 'evidence-housing-condition-report')!;
      evidence.tags = [...tags]; evidence.sourceClass = sourceClass;
      candidate.startingCardDefinitionIds = candidate.startingCardDefinitionIds.map((id) => id === 'evidence-rent-burden-report' ? evidence.id : id);
      let state = opening(candidate);
      const ids = state.cards.filter((card) => card.definitionId === evidence.id || card.definitionId === 'staff-policy-aide').map((card) => card.id);
      const preview = previewWork(state, candidate, ids);
      expect(preview).toMatchObject({ accepted: true, output: { kind: 'card', definitionId: evidence.id, form: 'summary', effects, explanationKey } });
      const initial = state.resources;
      state = apply(state, { type: 'SUBMIT_WORK', cardIds: ids }, candidate);
      state = apply(state, { type: 'FAST_FORWARD' }, candidate);
      expect(state.resources.billMomentum - initial.billMomentum).toBe('billMomentum' in effects ? effects.billMomentum : 0);
      expect(state.resources.districtTrust - initial.districtTrust).toBe('districtTrust' in effects ? effects.districtTrust : 0);
      validSave(state, candidate);
      const transform = state.eventLog.find((event) => event.type === 'CARD_TRANSFORMED')!;
      if (transform.type !== 'CARD_TRANSFORMED') throw Error('missing transform');
      const pattern = candidate.patterns.find((pattern) => pattern.id === 'pattern-summarize-evidence')!;
      const claim = { definitionId: evidence.id, form: 'summary' as const, explanationKey, outputSlotIndex: 1, outputSourceDefinitionId: evidence.id, outputSourceForm: 'raw' as const };
      expect(matchesPatternOutputReceipt(pattern, candidate, claim)).toBe(true);
      expect(matchesPatternOutputReceipt(pattern, candidate, { ...claim, explanationKey: explanationKey === 'result.summary.committee-credibility' ? 'result.summary.district-relevance' : 'result.summary.committee-credibility' })).toBe(false);
    }
  });

  it('requires the explicit Session policy and rejects historical candidate save/challenge identity', () => {
    const old = structuredClone(scenario);
    const pattern = old.patterns.find((pattern) => pattern.id === 'pattern-summarize-evidence')!;
    if (pattern.output.mode !== 'derived') throw Error('expected derived');
    delete pattern.output.parameters!.relevancePolicy;
    expect(() => parseScenario(old)).toThrow(/relevance policy/);
    expect(scenarioSnapshotHash(old)).not.toBe(scenarioSnapshotHash(scenario));
    const oldHash = 'ff90f497eaf2efc4c4e18877ff360f824f2ffe2391badbb44900d6301f0a13e4';
    const envelope = { ...createSaveEnvelope(opening(), scenario), snapshotHash: oldHash };
    const bytes = JSON.stringify(envelope);
    expect(validateAndMigrateSave(envelope, scenario).kind).toBe('wrong-snapshot');
    expect(JSON.stringify(envelope)).toBe(bytes);
    const challenge = { ...createChallengeSetup(setup, scenario), snapshotHash: oldHash };
    expect(decodeChallenge(encodeChallenge(challenge), scenario)).toMatchObject({ ok: false, reason: expect.stringMatching(/not available/) });
  });
});

it.each([
  ['district-advocate', 'pattern-earn-district-endorsement'],
  ['committee-specialist', 'pattern-tactic-early-preparation'],
  ['committee-specialist', 'pattern-review-bill-preparation'],
  ['greedy-same-party', 'pattern-shared-interest-outreach'],
] as const)('previews the actual %s / %s completion product', (policy, patternId) => {
  let state = opening();
  let preview: ReturnType<typeof previewWork> | undefined;
  let workId: string | undefined;
  let checked = false;
  for (let i = 0; i < 180 && !checked; i++) {
    const command = chooseCommand(policy, state, scenario);
    if (command.type === 'SUBMIT_WORK') {
      const candidate = previewWork(state, scenario, command.cardIds);
      if (candidate.accepted && candidate.patternId === patternId) preview = candidate;
    }
    state = apply(state, command);
    workId ??= state.activeWork.find((work) => work.kind === 'pattern' && work.patternId === patternId)?.id;
    if (!workId || !preview?.accepted || !state.eventLog.some((event) => event.type === 'PATTERN_COMPLETED' && event.workId === workId)) continue;
    if (preview.output.kind === 'office-decision') {
      expect(state.pendingDecisions).toContainEqual(expect.objectContaining({ officeDefinitionId: preview.output.officeDefinitionId, status: 'pending' }));
      expect(state.eventLog.filter((event) => event.type === 'CARD_TRANSFORMED').at(-1)).toMatchObject({ producedCardIds: [] });
    } else {
      const output = preview.output;
      expect(state.cards).toContainEqual(expect.objectContaining({ definitionId: output.definitionId, form: output.form, origin: expect.objectContaining({ explanationKey: output.explanationKey }) }));
    }
    checked = true; validSave(state);
  }
  expect(checked).toBe(true);
});

it('previews the exact basic response Constituency rather than evidence', () => {
  let state = until((state) => state.week === 2 && state.activeWork.length === 0 && state.cards.some((card) => card.definitionId === 'constituency-urgent-renter-concern' && card.form === 'raw'));
  const ids = state.cards.filter((card) => card.definitionId === 'staff-policy-aide' || card.definitionId === 'constituency-urgent-renter-concern').map((card) => card.id);
  expect(previewWork(state, scenario, ids)).toMatchObject({ accepted: true, output: { kind: 'card', definitionId: 'constituency-urgent-renter-concern', form: 'prepared' } });
  state = apply(state, { type: 'SUBMIT_WORK', cardIds: ids }); state = apply(state, { type: 'FAST_FORWARD' });
  expect(state.cards).toContainEqual(expect.objectContaining({ definitionId: 'constituency-urgent-renter-concern', form: 'prepared', origin: expect.objectContaining({ explanationKey: 'result.constituency.response-prepared' }) }));
  validSave(state);
});

it.each(['district-advocate', 'committee-specialist'] as const)('%s delivers meaningful preparation with immediate support and strict consumed-artifact receipts', (policy) => {
  const state = until((state) => state.pendingDecisions.some((pending) => pending.status === 'pending'
    && pending.choiceIds.some((id) => id.startsWith(`choice-preparation-${policy === 'district-advocate' ? 'district' : 'committee'}`) && previewDecision(state, scenario, pending.id, id).accepted)), policy);
  const pending = state.pendingDecisions.find((pending) => pending.status === 'pending')!;
  const choiceId = pending.choiceIds.find((id) => id.startsWith(`choice-preparation-${policy === 'district-advocate' ? 'district' : 'committee'}`) && previewDecision(state, scenario, pending.id, id).accepted)!;
  const completion = state.eventLog.find((event) => event.type === 'PATTERN_COMPLETED' && event.delivery?.demandId === pending.sourceId)!;
  if (completion.type !== 'PATTERN_COMPLETED' || !completion.delivery) throw Error('missing delivery');
  expect(state.cards.some((card) => card.id === completion.delivery!.artifactCardId)).toBe(false);
  validSave(state);
  const decoded = validateAndMigrateSave(JSON.parse(JSON.stringify(createSaveEnvelope(state, scenario))), scenario);
  expect(decoded.kind).toBe('valid');
  const preview = previewDecision(state, scenario, pending.id, choiceId);
  expect(preview).toMatchObject({ accepted: true, gainedSupport: [pending.officeDefinitionId], upfrontCosts: { politicalCapital: 2 }, resourceDeltas: { politicalCapital: -1 } });
  const command: GameCommand = { type: 'RESOLVE_DECISION', decisionId: pending.id, choiceId, expectedBillRevision: state.bill.revision };
  const after = apply(state, command);
  const milestone = after.eventLog.slice(state.eventLog.length).filter((event) => event.type === 'READINESS_MILESTONE_REWARDED');
  expect(milestone).toEqual(policy === 'committee-specialist' ? [expect.objectContaining({ appliedCapital: 1 })] : []);
  expect(after.resources.politicalCapital).toBe(state.resources.politicalCapital - 1 + (policy === 'committee-specialist' ? 1 : 0));
  expect(after.resources.staffAttention).toBe(state.resources.staffAttention);
  expect(after.relationships.find((relationship) => relationship.memberId === pending.officeDefinitionId)?.support).toBe('committed');
  expect(after.eventLog.slice(state.eventLog.length).filter((event) => event.type === 'RESOURCE_CHANGED' && event.reason === `promise-fulfilled:${pending.occurrenceId}`)).toEqual([expect.objectContaining({ changes: { politicalCapital: 1 } })]);
  expect(after.rewardedOccurrenceIds.filter((id) => id === pending.occurrenceId)).toHaveLength(1);
  validSave(after);
  expect(executeCommand(after, command, { scenario }).state).toBe(after);
  const next = { ...after, bill: { ...after.bill, revision: after.bill.revision + 1 } };
  expect(evaluateRelationships(next, scenario).find((relationship) => relationship.memberId === pending.officeDefinitionId)?.support).toBe('conditional');
  for (const change of [
    { officeDefinitionId: pending.officeDefinitionId === 'coalition-office-mike-flood' ? 'coalition-office-maxine-waters' : 'coalition-office-mike-flood' },
    { concernId: completion.delivery.concernId === 'demand-permitting-path' ? 'demand-renter-stability' : 'demand-permitting-path' },
    { billRevision: state.bill.revision + 1 }, { artifactCardId: state.cards.find((card) => card.definitionId === 'staff-policy-aide')!.id },
  ]) {
    const forged = structuredClone(state);
    const event = forged.eventLog.find((event) => event.type === 'PATTERN_COMPLETED' && event.workId === completion.workId)!;
    if (event.type !== 'PATTERN_COMPLETED') throw Error('missing completion');
    event.delivery = { ...event.delivery!, ...change };
    expect(previewDecision(forged, scenario, pending.id, choiceId)).toMatchObject({ accepted: false });
    expect(validateAndMigrateSave(createSaveEnvelope(forged, scenario), scenario).kind).toBe('corrupt');
  }
  const fakeProducer = structuredClone(state);
  const producer = fakeProducer.eventLog.find((event) => event.type === 'CARD_TRANSFORMED' && event.producedCardIds.includes(completion.delivery!.artifactCardId))!;
  if (producer.type !== 'CARD_TRANSFORMED') throw Error('missing producer');
  producer.explanationKey = 'result.constituency.response-prepared';
  producer.producerPatternId = 'pattern-basic-district-response';
  expect(previewDecision(fakeProducer, scenario, pending.id, choiceId)).toMatchObject({ accepted: false });
  expect(validateAndMigrateSave(createSaveEnvelope(fakeProducer, scenario), scenario).kind).toBe('corrupt');
  const missing = { ...state, eventLog: state.eventLog.filter((event) => event !== completion) };
  expect(previewDecision(missing, scenario, pending.id, choiceId)).toMatchObject({ accepted: false });
  const replayed = { ...state, eventLog: [...state.eventLog, completion] };
  expect(validateAndMigrateSave(createSaveEnvelope(replayed, scenario), scenario).kind).toBe('corrupt');
});

it('coalition broker uses learned widening for a completed compatible office commitment', () => {
  let state = opening(); let used = false; let recipient: string | undefined;
  for (let i = 0; i < 180 && state.runStatus !== 'complete'; i++) {
    const command = chooseCommand('coalition-broker', state, scenario);
    const result = executeCommand(state, command, { scenario });
    expect(result.events.some((event) => event.type === 'COMMAND_REJECTED')).toBe(false);
    if (completedTacticUseIds(state, result.events, scenario).includes('tactic-bipartisan-working-group')) {
      used = true;
      recipient = result.state.pendingDecisions.find((pending) => pending.status === 'pending')?.officeDefinitionId;
    }
    state = result.state;
  }
  expect(used).toBe(true); expect(recipient).toBeDefined();
  expect(state.relationships.find((relationship) => relationship.memberId === recipient)?.support).toBe('committed');
  expect(state.sessionRecord?.outcome).toBe('ready');
  validSave(state);
});
