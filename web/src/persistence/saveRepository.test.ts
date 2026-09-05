import { describe, expect, it } from 'vitest';

import { getCandidateScenario } from '@/content/loadScenario';
import { executeCommand } from '@/domain/engine';
import { createRun } from '@/domain/initialState';
import { obligationOccurrence } from '@/domain/obligations';
import { openPack } from '@/domain/packs';
import { drawStoryEvent } from '@/domain/storyDirector';
import type { PendingDecision, TermState } from '@/domain/types';
import { createSaveEnvelope } from '@/persistence/saveMigrations';
import {
  loadCheckpoint,
  SAVE_KEYS,
  saveCheckpoint,
  type SaveStorage,
} from '@/persistence/saveRepository';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

class MemoryStorage implements SaveStorage {
  readonly values = new Map<string, string>();
  operations: string[] = [];
  failAt?: string;

  getItem(key: string): string | null {
    const operation = `get:${key}`;
    this.operations.push(operation);
    if (operation === this.failAt) throw new Error(operation);
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const operation = `set:${key}`;
    this.operations.push(operation);
    if (operation === this.failAt) throw new Error(operation);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    const operation = `remove:${key}`;
    this.operations.push(operation);
    if (operation === this.failAt) throw new Error(operation);
    this.values.delete(key);
  }
}

function richState(paused = true): TermState {
  let state = createRun({ ...sessionSetup, mode: 'session' });
  const aide = state.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
  const evidence = state.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
  state = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: [aide.id, evidence.id] }, { scenario: sessionScenario }).state;
  const filed = state.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')!;
  state = executeCommand(state, { type: 'FILE_CARD', cardId: filed.id }, { scenario: sessionScenario }).state;
  const demand = sessionScenario.demandDefinitions[0];
  const occurrenceId = `${demand.id}:revision:${state.bill.revision}`;
  const pending: PendingDecision = {
    id: `decision:${occurrenceId}`,
    sourceId: demand.id,
    occurrenceId,
    officeDefinitionId: demand.officeDefinitionId,
    approachedBillRevision: state.bill.revision,
    expectedBillRevision: state.bill.revision,
    choiceIds: [...demand.choiceIds],
    status: 'pending',
  };
  return {
    ...state,
    paused,
    pendingDecisions: [pending],
    obligations: [obligationOccurrence(sessionScenario.obligationDefinitions[0], occurrenceId)],
    rewardedOccurrenceIds: ['promise:already-rewarded'],
    resolvedWeekIds: ['week:0'],
    eventLog: [...state.eventLog, { type: 'PATTERN_COMPLETED', workId: 'work-prior', patternId: 'pattern-summarize-evidence' }],
  };
}

describe('save checkpoint round trips', () => {
  it('preserves a pending Story, revealed pack, paid work, ledgers, and RNG exactly', () => {
    const scenario = getCandidateScenario();
    const storage = new MemoryStorage();
    let before = createRun({
      scenario,
      districtId: 'GA-05',
      party: 'democratic',
      values: ['Tenant Stability', 'Housing Supply'],
      mode: 'session',
      seed: 417,
    });
    const staff = before.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const evidence = before.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    before = executeCommand(before, {
      type: 'SUBMIT_WORK',
      cardIds: [staff.id, evidence.id],
    }, { scenario }).state;
    before = { ...before, week: 2 };
    before = openPack(before, scenario, 'pack:week:2', 'week-two-policy').state;
    before = drawStoryEvent(before, scenario).state;

    expect(before.pendingStoryDecisions.some((decision) => decision.status === 'pending')).toBe(true);
    expect(before.revealedPacks).toHaveLength(1);
    expect(before.activeWork[0].paidCost.staffAttention).toBe(1);
    expect(saveCheckpoint(storage, before, scenario).kind).toBe('saved');
    const loaded = loadCheckpoint(storage, scenario);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') throw new Error('expected validated candidate state');
    expect(loaded.state).toEqual(before);
  });

  it('preserves pending decisions, paid jobs, filed obligations, ledgers and absolute time', () => {
    const storage = new MemoryStorage();
    const before = richState();
    const saved = saveCheckpoint(storage, before, sessionScenario);
    expect(saved.kind).toBe('saved');
    const loaded = loadCheckpoint(storage, sessionScenario);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') throw new Error('expected validated state');
    expect(loaded.state).toEqual(before);
    expect(loaded.state.activeWork[0].paidCost.staffAttention).toBe(1);
    expect(loaded.state.activeWork[0].completesAtSimulationMs).toBe(before.activeWork[0].completesAtSimulationMs);
    expect(loaded.state.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')?.location).toBe('filed');
    expect(loaded.state.eventLog).toContainEqual({ type: 'PATTERN_COMPLETED', workId: 'work-prior', patternId: 'pattern-summarize-evidence' });
  });

  it('restores paused without applying offline progress or rewards', () => {
    const storage = new MemoryStorage();
    const before = richState(false);
    saveCheckpoint(storage, before, sessionScenario);
    const loaded = loadCheckpoint(storage, sessionScenario);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') throw new Error('expected validated state');
    expect(loaded.state.paused).toBe(true);
    expect(loaded.state.simulationMs).toBe(before.simulationMs);
    expect(loaded.state.activeWork).toEqual(before.activeWork);
    expect(loaded.state.resources).toEqual(before.resources);
    expect(loaded.state.rewardedOccurrenceIds).toEqual(before.rewardedOccurrenceIds);
  });

  it('round trips a non-cancellable decision-origin counter reservation', () => {
    const storage = new MemoryStorage();
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const demand = sessionScenario.demandDefinitions[0];
    const occurrenceId = `${demand.id}:revision:0`;
    const pending: PendingDecision = {
      id: `decision:${occurrenceId}`,
      sourceId: demand.id,
      occurrenceId,
      officeDefinitionId: demand.officeDefinitionId,
      approachedBillRevision: 0,
      expectedBillRevision: 0,
      choiceIds: [...demand.choiceIds],
      status: 'pending',
    };
    const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const prepared = {
      ...evidence,
      id: 'card-prepared-counter-save',
      stackId: 'stack-card-prepared-counter-save',
      form: 'prepared' as const,
      origin: {
        explanationKey: 'result.evidence.office-concern-answered',
        inputDefinitionIds: [evidence.definitionId, demand.officeDefinitionId],
        consumedDefinitionIds: [evidence.definitionId],
        authoredConcern: { concernId: demand.id, recipientOfficeDefinitionId: demand.officeDefinitionId },
      },
    };
    const ready = {
      ...base,
      cards: [...base.cards, prepared],
      stacks: [...base.stacks, { id: prepared.stackId, cardIds: [prepared.id] }],
      pendingDecisions: [pending],
      eventLog: [{
        type: 'CARD_TRANSFORMED' as const,
        stackId: evidence.stackId,
        consumedCardIds: [evidence.id],
        producedCardIds: [prepared.id],
        returnedCardIds: [],
        outputDefinitionId: prepared.definitionId,
        outputForm: 'prepared' as const,
        producerPatternId: 'pattern-answer-office-concern',
        inputDefinitionIds: prepared.origin.inputDefinitionIds,
        consumedDefinitionIds: prepared.origin.consumedDefinitionIds,
        authoredConcernId: demand.id,
        authoredConcernOfficeDefinitionId: demand.officeDefinitionId,
        explanationKey: prepared.origin.explanationKey,
      }, {
        type: 'DECISION_PRESENTED' as const,
        decisionId: pending.id,
        sourceId: pending.sourceId,
        occurrenceId: pending.occurrenceId,
        choiceIds: pending.choiceIds,
      }],
    };
    const counter = executeCommand(ready, {
      type: 'RESOLVE_DECISION',
      decisionId: pending.id,
      choiceId: 'choice-counter-renter-protection',
      expectedBillRevision: 0,
    }, { scenario: sessionScenario }).state;
    expect(saveCheckpoint(storage, counter, sessionScenario).kind).toBe('saved');
    const loaded = loadCheckpoint(storage, sessionScenario);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') throw new Error('expected counter');
    expect(loaded.state.activeWork[0].decisionOrigin).toEqual(counter.activeWork[0].decisionOrigin);
  });

  it('rotates current only after a newly completed week', () => {
    const storage = new MemoryStorage();
    const first = richState();
    expect(saveCheckpoint(storage, first, sessionScenario).kind).toBe('saved');
    const firstRaw = storage.values.get(SAVE_KEYS.current);
    const revised = {
      ...first,
      bill: { ...first.bill, revision: 1 },
      pendingDecisions: first.pendingDecisions.map((decision) => ({
        ...decision,
        approachedBillRevision: 1,
        expectedBillRevision: 1,
      })),
    };
    expect(saveCheckpoint(storage, revised, sessionScenario).kind).toBe('saved');
    expect(storage.values.has(SAVE_KEYS.previousWeek)).toBe(false);
    const completed = { ...first, resolvedWeekIds: [...first.resolvedWeekIds, 'week:1'], week: 2 };
    expect(saveCheckpoint(storage, completed, sessionScenario).kind).toBe('saved');
    expect(storage.values.get(SAVE_KEYS.previousWeek)).not.toBe(firstRaw);
    expect(JSON.parse(storage.values.get(SAVE_KEYS.previousWeek)!).state.bill.revision).toBe(1);
  });

  it('recovers a validated previous checkpoint when current is corrupt', () => {
    const storage = new MemoryStorage();
    const previous = richState();
    storage.values.set(SAVE_KEYS.previousWeek, JSON.stringify(createSaveEnvelope(previous, sessionScenario)));
    storage.values.set(SAVE_KEYS.current, '{bad json');
    const loaded = loadCheckpoint(storage, sessionScenario);
    expect(loaded.kind).toBe('recovered-previous');
    if (loaded.kind !== 'recovered-previous') throw new Error('expected previous');
    expect(loaded.state).toEqual(previous);
    expect(storage.values.get(SAVE_KEYS.current)).toBe('{bad json');
  });

  it.each([
    ['unsupported version', (envelope: ReturnType<typeof createSaveEnvelope>) => ({ ...envelope, rulesVersion: 77 })],
    ['wrong snapshot', (envelope: ReturnType<typeof createSaveEnvelope>) => ({ ...envelope, snapshotHash: 'bad' })],
    ['malformed data', (envelope: ReturnType<typeof createSaveEnvelope>) => ({ ...envelope, state: { ...envelope.state, elapsedMs: -1 } })],
  ])('reports %s and leaves stored bytes untouched', (_label, change) => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(change(createSaveEnvelope(richState(), sessionScenario)));
    storage.values.set(SAVE_KEYS.current, raw);
    const loaded = loadCheckpoint(storage, sessionScenario);
    expect(['incompatible-version', 'wrong-snapshot', 'corrupt']).toContain(loaded.kind);
    expect(storage.values.get(SAVE_KEYS.current)).toBe(raw);
  });
});

describe('storage interruption safety', () => {
  const saveOperations = [
    `set:${SAVE_KEYS.candidate}`,
    `get:${SAVE_KEYS.candidate}`,
    `get:${SAVE_KEYS.current}`,
    `set:${SAVE_KEYS.previousWeek}`,
    `set:${SAVE_KEYS.current}`,
    `remove:${SAVE_KEYS.candidate}`,
  ];

  it.each(saveOperations)('retains a valid checkpoint when %s throws', (operation) => {
    const storage = new MemoryStorage();
    const old = richState();
    expect(saveCheckpoint(storage, old, sessionScenario).kind).toBe('saved');
    const oldRaw = storage.values.get(SAVE_KEYS.current)!;
    const next = { ...old, week: 2, resolvedWeekIds: [...old.resolvedWeekIds, 'week:1'] };
    storage.failAt = operation;
    const result = saveCheckpoint(storage, next, sessionScenario);
    expect(result.kind).toBe('storage-unavailable');
    const current = storage.values.get(SAVE_KEYS.current);
    const previous = storage.values.get(SAVE_KEYS.previousWeek);
    expect([current, previous]).toContain(oldRaw);
    if (operation === `remove:${SAVE_KEYS.candidate}`) {
      expect(result.message).toMatch(/checkpoint was saved.*staging copy/i);
      expect(loadCheckpoint(Object.assign(storage, { failAt: undefined }), sessionScenario).kind).toBe('loaded');
    }
  });

  it.each([`get:${SAVE_KEYS.current}`, `get:${SAVE_KEYS.previousWeek}`])('reports a throwing load read at %s without cleanup', (operation) => {
    const storage = new MemoryStorage();
    storage.values.set(SAVE_KEYS.current, operation.endsWith(SAVE_KEYS.current) ? '{}' : '{broken');
    storage.values.set(SAVE_KEYS.previousWeek, JSON.stringify(createSaveEnvelope(richState(), sessionScenario)));
    storage.failAt = operation;
    const before = new Map(storage.values);
    expect(loadCheckpoint(storage, sessionScenario).kind).toBe('storage-unavailable');
    expect(storage.values).toEqual(before);
  });

  it('rejects bytes changed between candidate write and validation', () => {
    const storage = new MemoryStorage();
    const originalGet = storage.getItem.bind(storage);
    storage.getItem = (key) => key === SAVE_KEYS.candidate ? '{"changed":true}' : originalGet(key);
    expect(saveCheckpoint(storage, richState(), sessionScenario).kind).toBe('corrupt');
    expect(storage.values.has(SAVE_KEYS.current)).toBe(false);
  });
});
