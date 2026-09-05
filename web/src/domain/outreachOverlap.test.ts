import { describe, expect, it } from 'vitest';
import fixture from '@/test/fixtures/outreachOverlap.json';
import { getCandidateScenario } from '@/content/loadScenario';
import { createRun } from '@/domain/runSetup';
import { executeCommand } from '@/domain/engine';
import { previewWork, OUTREACH_RESERVATION_REJECTION } from '@/domain/work';
import { createSaveEnvelope, validateAndMigrateSave } from '@/persistence/saveMigrations';
import type { GameCommand } from '@/domain/commands';
import type { TermState } from '@/domain/types';
const scenario = getCandidateScenario();
const commands = fixture.commands as GameCommand[];
function valid(state: TermState) {
  const saved = JSON.parse(JSON.stringify(createSaveEnvelope(state, scenario)));
  expect(validateAndMigrateSave(saved, scenario).kind).toBe('valid');
}
function apply(state: TermState, command: GameCommand) {
  const result = executeCommand(state, command, { scenario });
  expect(result.events.some((event) => event.type === 'COMMAND_REJECTED')).toBe(false);
  valid(result.state);
  return result.state;
}
function beforeOverlap() {
  let state = createRun({ scenario, mode: 'session', seed: 1, party: 'democratic', districtId: 'GA-05', values: ['Tenant Stability', 'Housing Supply'] });
  for (const command of commands.slice(0, -5)) state = apply(state, command);
  return state;
}
const ordinary = ['card-1', 'card-35'];
const prepared = ['card-2', 'card-7', 'card-17'];
const secondPrepared = ['card-1', 'card-35', 'card-29'];
function rejected(state: TermState, cardIds: string[]) {
  const bytes = JSON.stringify(state);
  expect(previewWork(state, scenario, cardIds)).toEqual({ accepted: false, reason: OUTREACH_RESERVATION_REJECTION });
  const result = executeCommand(state, { type: 'SUBMIT_WORK', cardIds }, { scenario });
  expect(result.state).toBe(state);
  expect(JSON.stringify(result.state)).toBe(bytes);
  expect(result.events).toEqual([expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'card-busy', message: OUTREACH_RESERVATION_REJECTION })]);
  valid(result.state);
}
describe('office definition reservation', () => {
  it.each([[ordinary, prepared], [prepared, ordinary], [prepared, secondPrepared]])('reserves either outreach route across duplicate office instances', (first, second) => {
    let state = beforeOverlap();
    expect(previewWork(state, scenario, first).accepted).toBe(true);
    expect(previewWork(state, scenario, second).accepted).toBe(true);
    state = apply(state, { type: 'SUBMIT_WORK', cardIds: first });
    rejected(state, second);
    const staff = state.cards.find((card) => card.id === first[0])!;
    state = apply(state, { type: 'SEPARATE_STACK', cardId: staff.id, stackId: staff.stackId, x: staff.x, y: staff.y });
    expect(previewWork(state, scenario, second).accepted).toBe(true);
    state = apply(state, { type: 'SUBMIT_WORK', cardIds: second });
    state = apply(state, { type: 'FAST_FORWARD' });
    expect(state.pendingDecisions.filter((decision) => decision.status === 'pending')).toHaveLength(1);
  });

  it('keeps the definition reserved when another staffer revises the bill during outreach', () => {
    let state = beforeOverlap();
    state = apply(state, { type: 'SUBMIT_WORK', cardIds: ['card-2', 'card-4', 'card-32'] });
    state = apply(state, { type: 'SET_PAUSED', paused: false });
    for (let i = 0; i < 10; i++) state = apply(state, { type: 'TICK', deltaMs: 1000 });
    state = apply(state, { type: 'SUBMIT_WORK', cardIds: ordinary });
    state = apply(state, { type: 'FAST_FORWARD' });
    const draft = state.cards.find((card) => card.form === 'drafted')!;
    state = apply(state, { type: 'DOCKET_PROVISION', cardId: draft.id });
    expect(state.bill.revision).toBe(1);
    rejected(state, ['card-3', 'card-7', 'card-17']);
    state = apply(state, { type: 'FAST_FORWARD' });
    expect(state.pendingDecisions.at(-1)).toMatchObject({ approachedBillRevision: 0, expectedBillRevision: 1 });
  });
});

it('loads the original valid overlapping envelope, preserves its packet, and refunds the later work once', () => {
  const loaded = validateAndMigrateSave(fixture.acceptedEnvelope, scenario);
  expect(loaded.kind).toBe('valid');
  if (loaded.kind !== 'valid') throw Error('archived accepted envelope rejected');
  let state = loaded.envelope.state;
  const work = state.activeWork.find((work) => work.id === 'work-9')!;
  const packet = state.cards.find((card) => card.id === 'card-17')!;
  for (const command of commands.slice(-3)) state = apply(state, command);
  expect(state.activeWork).toHaveLength(0);
  expect(state.cards.find((card) => card.id === packet.id)).toEqual({ ...packet, status: 'idle', remainingMs: 0 });
  expect(state.eventLog.filter((event) => event.type === 'WORK_RECOVERED')).toEqual([{
    type: 'WORK_RECOVERED', workId: work.id, cardIds: work.cardIds, reason: 'office-offer-unavailable', refundedCost: work.paidCost,
  }]);
  expect(state.eventLog.filter((event) => event.type === 'RESOURCE_CHANGED' && event.reason === `recover:${work.id}`)).toEqual([expect.objectContaining({ changes: work.paidCost })]);
  expect(state.eventLog.some((event) => event.type === 'PATTERN_COMPLETED' && event.workId === work.id)).toBe(false);
  expect(state.pendingDecisions).toHaveLength(1);
  expect(state.relationships.find((relationship) => relationship.memberId === 'coalition-office-maxine-waters')?.support).toBe('refused');
  const beforeResources = state.resources;
  state = apply(state, { type: 'FAST_FORWARD' });
  expect(state.resources.staffAttention).toBe(beforeResources.staffAttention);
  expect(state.eventLog.filter((event) => event.type === 'WORK_RECOVERED')).toHaveLength(1);
  for (const alteration of ['duplicate', 'missing', 'refund', 'inputs', 'reason'] as const) {
    const forged = structuredClone(state);
    const receipt = forged.eventLog.find((event) => event.type === 'WORK_RECOVERED')!;
    if (receipt.type !== 'WORK_RECOVERED') throw Error('missing recovery');
    if (alteration === 'duplicate') forged.eventLog.push(receipt);
    if (alteration === 'missing') forged.eventLog = forged.eventLog.filter((event) => event !== receipt);
    if (alteration === 'refund') receipt.refundedCost.staffAttention = 8;
    if (alteration === 'inputs') receipt.cardIds = ['card-1'];
    if (alteration === 'reason') Object.assign(receipt, { reason: 'fabricated' });
    expect(validateAndMigrateSave(createSaveEnvelope(forged, scenario), scenario).kind).toBe('corrupt');
  }
});

function finishHistoricalOverlap(state: TermState) {
  for (let i = 0; i < 10 && (state.activeWork.length || state.pendingDecisions.some((decision) => decision.status === 'pending')); i++) {
    const pending = state.pendingDecisions.find((decision) => decision.status === 'pending');
    state = apply(state, pending ? { type: 'RESOLVE_DECISION', decisionId: pending.id,
      choiceId: pending.choiceIds.find((id) => id.startsWith('choice-refuse'))!, expectedBillRevision: pending.expectedBillRevision,
    } : { type: 'FAST_FORWARD' });
  }
  expect(state.activeWork).toHaveLength(0);
  return state;
}

it.each(fixture.historicalVariants)('safely settles archived old-engine schedule: $name', ({ envelope }) => {
  const loaded = validateAndMigrateSave(envelope, scenario);
  expect(loaded.kind).toBe('valid');
  if (loaded.kind !== 'valid') throw Error('invalid historical fixture');
  const initial = loaded.envelope.state;
  const order = [...initial.activeWork].sort((a, b) => a.completesAtSimulationMs - b.completesAtSimulationMs || a.id.localeCompare(b.id));
  const later = order[1];
  const inputs = initial.cards.filter((card) => later.cardIds.includes(card.id));
  const after = finishHistoricalOverlap(initial);
  expect(after.eventLog.filter((event) => event.type === 'WORK_RECOVERED')).toEqual([{
    type: 'WORK_RECOVERED', workId: later.id, cardIds: later.cardIds, reason: 'office-offer-unavailable', refundedCost: later.paidCost,
  }]);
  for (const input of inputs) expect(after.cards.find((card) => card.id === input.id)).toEqual({ ...input, status: 'idle', remainingMs: 0 });
  expect(after.eventLog.filter((event) => event.type === 'PATTERN_COMPLETED' && event.workId === later.id)).toHaveLength(0);
  expect(after.eventLog.filter((event) => event.type === 'DECISION_PRESENTED')).toHaveLength(1);
  expect(after.rewardedOccurrenceIds).toEqual(initial.rewardedOccurrenceIds);
  valid(apply(after, { type: 'CONCLUDE_SESSION' }));
});

it('caps a captured political-capital refund and authenticates the actual applied delta', () => {
  const source = fixture.historicalVariants.find((entry) => entry.name === 'paid-coordination-recovery')!;
  const loaded = validateAndMigrateSave(source.envelope, scenario);
  if (loaded.kind !== 'valid') throw Error('invalid historical fixture');
  // Controlled cap fixture, distinct from the retained canonical failure: the
  // resources and actual ledger delta move together before recovery is processed.
  const initial = structuredClone(loaded.envelope.state);
  initial.eventLog.push({ type: 'RESOURCE_CHANGED', changes: { politicalCapital: 9 - initial.resources.politicalCapital }, reason: 'test-resource-cap' });
  initial.resources.politicalCapital = 9;
  valid(initial);
  const after = finishHistoricalOverlap(initial);
  expect(after.resources.politicalCapital).toBe(9);
  expect(after.eventLog.filter((event) => event.type === 'WORK_RECOVERED')).toEqual([
    expect.objectContaining({ refundedCost: { staffAttention: 1, politicalCapital: 0 } }),
  ]);
  valid(after);
});
