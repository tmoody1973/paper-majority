import { expect, it } from 'vitest';
import { getCandidateScenario } from '@/content/loadScenario';
import { executeCommand } from '@/domain/engine';
import { createRun } from '@/domain/runSetup';
import { DEFAULT_RUN_SETTINGS } from '@/domain/initialState';
import { previewWork, SESSION_COMPLETION_REJECTION } from '@/domain/work';
import { previewDecision } from '@/domain/decisions';
import { describeStudyOption } from '@/domain/selectors';
import { createSaveEnvelope, validateAndMigrateSave } from '@/persistence/saveMigrations';
import { chooseCommand } from '@/../scripts/balance/policies';
import type { GameCommand } from '@/domain/commands';
import type { TermState } from '@/domain/types';

const scenario = getCandidateScenario();
const run = (seed = 1) => createRun({ scenario, seed, districtId: 'GA-05', party: 'democratic', values: ['Tenant Stability', 'Housing Supply'], settings: { ...DEFAULT_RUN_SETTINGS, pace: 'brisk' }, mode: 'session' });
function apply(state: TermState, command: GameCommand) {
  const result = executeCommand(state, command, { scenario });
  expect(result.events.find((event) => event.type === 'COMMAND_REJECTED')).toBeUndefined();
  return result.state;
}
const card = (state: TermState, definitionId: string) => state.cards.find((card) => card.definitionId === definitionId && card.location === 'desk' && card.status === 'idle')!.id;
const save = (state: TermState) => expect(validateAndMigrateSave(createSaveEnvelope(state, scenario), scenario).kind).toBe('valid');
function tickTo(state: TermState, elapsedMs: number) {
  state = apply(state, { type: 'SET_PAUSED', paused: false });
  while (state.elapsedMs < elapsedMs) state = apply(state, { type: 'TICK', deltaMs: Math.min(1_000, elapsedMs - state.elapsedMs) });
  return apply(state, { type: 'SET_PAUSED', paused: true });
}
function enterWeek(state: TermState, week: number) {
  for (let i = 0; i < 100; i++) {
    if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
      state = apply(state, chooseCommand('coalition-broker', state, scenario));
    } else if (scenario.weeklyPacks.some((pack) => pack.week === state.week) && !state.revealedPacks.some((pack) => pack.week === state.week)) {
      const category = scenario.weeklyPacks.find((pack) => pack.week === state.week)!.pools[0];
      state = apply(state, { type: 'OPEN_PACK', packOccurrenceId: `pack:week:${state.week}`, categoryId: category.id });
    } else if (state.week === week) return state;
    else state = apply(state, state.weekPhase === 'boundary' ? { type: 'ADVANCE_WEEK' } : { type: 'FAST_FORWARD' });
  }
  throw Error('week not reached');
}
function unchangedRejection(state: TermState, command: GameCommand) {
  const bytes = JSON.stringify(state);
  const result = executeCommand(state, command, { scenario });
  expect(result.state).toBe(state);
  expect(JSON.stringify(result.state)).toBe(bytes);
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'COMMAND_REJECTED', message: SESSION_COMPLETION_REJECTION }));
  save(result.state);
}

it('rejects near-end direct work and study through their public previews without charging or changing a canonical save', () => {
  let state = enterWeek(run(), 6);
  state = tickTo(state, state.weekLengthMs - 1_000);
  const staff = card(state, 'staff-policy-aide');
  const evidence = card(state, 'evidence-rent-burden-report');
  const tactic = card(state, 'tactic-bipartisan-working-group');
  expect(previewWork(state, scenario, [staff, evidence])).toEqual({ accepted: false, reason: SESSION_COMPLETION_REJECTION });
  unchangedRejection(state, { type: 'SUBMIT_WORK', cardIds: [staff, evidence] });
  expect(describeStudyOption(state, scenario, staff, tactic)).toMatchObject({ canStudy: false, blockedReason: SESSION_COMPLETION_REJECTION });
  unchangedRejection(state, { type: 'START_ASSIGNMENT', assignmentKind: 'study-tactic', staffCardId: staff, targetCardId: tactic });
  state = apply(state, { type: 'CONCLUDE_SESSION' });
  expect(state.runStatus).toBe('complete');
  expect(state.activeWork).toHaveLength(0);
  save(state);
});

it.each(['work', 'study'] as const)('completes %s exactly at the final boundary before settling a valid ending', (kind) => {
  let state = enterWeek(run(), 6);
  const staff = card(state, 'staff-policy-aide');
  const target = card(state, kind === 'work' ? 'evidence-rent-burden-report' : 'tactic-bipartisan-working-group');
  const preview = previewWork(state, scenario, [staff, target]);
  const duration = kind === 'work' && preview.accepted ? preview.durationMs : Math.max(...scenario.tacticExpansions.filter((entry) => entry.tacticDefinitionId === 'tactic-bipartisan-working-group').map((entry) => entry.studyDurationMs));
  state = tickTo(state, state.weekLengthMs - duration);
  state = apply(state, kind === 'work' ? { type: 'SUBMIT_WORK', cardIds: [staff, target] } : { type: 'START_ASSIGNMENT', assignmentKind: 'study-tactic', staffCardId: staff, targetCardId: target });
  expect(state.activeWork[0].completesAtSimulationMs).toBe(state.weekLengthMs * 6);
  save(state);
  state = apply(state, { type: 'CONCLUDE_SESSION' });
  expect(state.activeWork).toHaveLength(0);
  expect(state.runStatus).toBe('complete');
  save(state);
});

it('carries ordinary work across an earlier week but prevents an early conclusion from orphaning its reservation', () => {
  let state = enterWeek(run(), 1);
  state = tickTo(state, state.weekLengthMs - 1_000);
  const ids = [card(state, 'staff-policy-aide'), card(state, 'evidence-rent-burden-report')];
  state = apply(state, { type: 'SUBMIT_WORK', cardIds: ids });
  const result = executeCommand(state, { type: 'CONCLUDE_SESSION' }, { scenario });
  expect(result.state.runStatus).toBe('active');
  expect(result.state.activeWork).toHaveLength(1);
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'COMMAND_REJECTED', reason: 'card-busy' }));
  save(result.state);
  state = enterWeek(result.state, 2);
  state = apply(state, { type: 'FAST_FORWARD' });
  expect(state.activeWork).toHaveLength(0);
  save(state);
});

it('rejects a canonical near-end counter through shared preflight without charging its choice or work', () => {
  let state = enterWeek(run(2), 2);
  const staff = card(state, 'staff-policy-aide');
  state = apply(state, { type: 'START_ASSIGNMENT', assignmentKind: 'study-tactic', staffCardId: staff, targetCardId: card(state, 'tactic-bipartisan-working-group') });
  state = apply(state, { type: 'FAST_FORWARD' });
  state = apply(state, { type: 'SUBMIT_WORK', cardIds: [staff, card(state, 'evidence-rent-burden-report')] });
  state = apply(state, { type: 'FAST_FORWARD' });
  state = enterWeek(state, 6);
  const political = state.cards.find((entry) => entry.form === 'raw' && scenario.cards.find((definition) => definition.id === entry.definitionId)?.kind === 'political')!;
  state = apply(state, { type: 'SUBMIT_WORK', cardIds: [staff, political.id] });
  state = apply(state, { type: 'FAST_FORWARD' });
  // Brisk pace leaves the authored Tribal concern live at this late counter boundary.
  const office = card(state, 'coalition-office-emanuel-cleaver');
  const asset = state.cards.find((entry) => entry.form === 'prepared' && entry.origin?.explanationKey === 'result.political.asset-prepared')!;
  const outreach = previewWork(state, scenario, [staff, office, asset.id]);
  expect(outreach.accepted).toBe(true);
  if (!outreach.accepted) return;
  state = tickTo(state, 30_000);
  state = apply(state, { type: 'SUBMIT_WORK', cardIds: [staff, office, asset.id] });
  state = apply(state, { type: 'FAST_FORWARD' });
  while (state.activeWork.length > 0) state = apply(state, { type: 'FAST_FORWARD' });
  const pending = state.pendingDecisions.find((decision) => decision.status === 'pending')!;
  const choiceId = 'choice-counter-tribal-consultation';
  const command: GameCommand = { type: 'RESOLVE_DECISION', decisionId: pending.id, choiceId, expectedBillRevision: pending.expectedBillRevision };
  save(state);
  const preview = previewDecision(state, scenario, pending.id, choiceId);
  expect(preview).toMatchObject({ accepted: false, message: SESSION_COMPLETION_REJECTION });
  unchangedRejection(state, command);
  state = apply(state, { ...command, choiceId: 'choice-refuse-tribal-consultation' });
  state = apply(state, { type: 'CONCLUDE_SESSION' });
  expect(state.runStatus).toBe('complete');
  expect(state.activeWork).toHaveLength(0);
  save(state);
});
