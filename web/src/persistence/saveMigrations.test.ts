import { describe, expect, it } from 'vitest';

import { createRun } from '@/domain/initialState';
import { executeCommand } from '@/domain/engine';
import type { CardInstance, TermState } from '@/domain/types';
import { canonicalJson, canonicalSha256, sha256Hex } from '@/persistence/canonicalHash';
import {
  createSaveEnvelope,
  scenarioSnapshotHash,
  validateAndMigrateSave,
} from '@/persistence/saveMigrations';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

describe('canonical scenario identity', () => {
  it('sorts object keys, preserves array order and uses real SHA-256', () => {
    expect(canonicalJson({ z: [2, 1], a: { d: true, c: 'x' } })).toBe('{"a":{"c":"x","d":true},"z":[2,1]}');
    expect(canonicalSha256({ b: 2, a: 1 })).toBe(canonicalSha256({ a: 1, b: 2 }));
    expect(canonicalSha256({ a: [1, 2] })).not.toBe(canonicalSha256({ a: [2, 1] }));
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('save migrations', () => {
  const activeState = () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const aide = state.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const evidence = state.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    return executeCommand(state, { type: 'SUBMIT_WORK', cardIds: [aide.id, evidence.id] }, { scenario: sessionScenario }).state;
  };

  const carriedAcrossStudy = (): TermState => {
    let state = createRun({ ...sessionSetup, mode: 'session' });
    const evidence = state.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const summary: CardInstance = {
      ...evidence,
      id: 'card-summary-captured-rule',
      stackId: 'stack-card-summary-captured-rule',
      form: 'summary',
      sourceDefinitionIds: [evidence.definitionId],
    };
    const tactic: CardInstance = {
      id: 'card-tactic-captured-rule',
      definitionId: 'tactic-bipartisan-working-group',
      stackId: 'stack-card-tactic-captured-rule',
      x: 700,
      y: 300,
      remainingMs: 0,
      status: 'idle',
      form: 'raw',
      location: 'desk',
      sourceDefinitionIds: [],
    };
    state = {
      ...state,
      paused: false,
      cards: [...state.cards, summary, tactic],
      stacks: [
        ...state.stacks,
        { id: summary.stackId, cardIds: [summary.id] },
        { id: tactic.stackId, cardIds: [tactic.id] },
      ],
    };
    const counsel = state.cards.find((card) => card.definitionId === 'staff-legislative-counsel')!;
    const policy = state.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')!;
    state = executeCommand(state, {
      type: 'SUBMIT_WORK',
      cardIds: [counsel.id, summary.id, policy.id],
    }, { scenario: sessionScenario }).state;
    const aide = state.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    state = executeCommand(state, {
      type: 'START_ASSIGNMENT',
      assignmentKind: 'study-tactic',
      staffCardId: aide.id,
      targetCardId: tactic.id,
    }, { scenario: sessionScenario }).state;
    for (let second = 0; second < 20; second += 1) {
      state = executeCommand(state, { type: 'TICK', deltaMs: 1_000 }, { scenario: sessionScenario }).state;
    }
    return state;
  };

  it('rejects unknown save and rules versions without guessing', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const envelope = createSaveEnvelope(state, sessionScenario);
    expect(validateAndMigrateSave({ ...envelope, saveSchemaVersion: 99 }, sessionScenario)).toMatchObject({ kind: 'incompatible-version' });
    expect(validateAndMigrateSave({ ...envelope, rulesVersion: 99 }, sessionScenario)).toMatchObject({ kind: 'incompatible-version' });
  });

  it('rejects a wrong snapshot id or canonical content hash', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const envelope = createSaveEnvelope(state, sessionScenario);
    expect(validateAndMigrateSave({ ...envelope, snapshotId: 'other' }, sessionScenario)).toMatchObject({ kind: 'wrong-snapshot' });
    expect(validateAndMigrateSave({ ...envelope, snapshotHash: '0'.repeat(64) }, sessionScenario)).toMatchObject({ kind: 'wrong-snapshot' });
    expect(envelope.snapshotHash).toBe(scenarioSnapshotHash(sessionScenario));
  });

  it('strictly rejects malformed state and broken active-work references', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const envelope = createSaveEnvelope(state, sessionScenario);
    expect(validateAndMigrateSave({ ...envelope, surprise: true }, sessionScenario)).toMatchObject({ kind: 'corrupt' });
    expect(validateAndMigrateSave({ ...envelope, state: { ...state, week: 9 } }, sessionScenario)).toMatchObject({ kind: 'corrupt' });
    expect(validateAndMigrateSave({
      ...envelope,
      state: { ...state, activeWork: [{ id: 'work-broken', kind: 'pattern', cardIds: ['missing'] }] },
    }, sessionScenario)).toMatchObject({ kind: 'corrupt' });
  });

  it.each([
    ['null provision receipt', (state: ReturnType<typeof createRun>) => ({ ...state, bill: { ...state.bill, provisionReceipts: [null] } })],
    ['null relationship condition', (state: ReturnType<typeof createRun>) => ({
      ...state,
      relationships: state.relationships.map((relationship, index) => index === 0 ? { ...relationship, conditions: [null] } : relationship),
    })],
    ['malformed resource event', (state: ReturnType<typeof createRun>) => ({
      ...state,
      eventLog: [{ type: 'RESOURCE_CHANGED', changes: { staffAttention: 'free' }, reason: 'tampered' }],
    })],
    ['unknown completion pattern', (state: ReturnType<typeof createRun>) => ({
      ...state,
      eventLog: [{ type: 'PATTERN_COMPLETED', workId: 'work-1', patternId: 'pattern-foreign' }],
    })],
    ['unknown decision choice event', (state: ReturnType<typeof createRun>) => ({
      ...state,
      eventLog: [{ type: 'DECISION_RESOLVED', decisionId: 'decision:x', choiceId: 'choice-foreign', occurrenceId: 'x' }],
    })],
  ])('rejects exact nested-domain violation: %s', (_label, mutate) => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const result = validateAndMigrateSave(createSaveEnvelope(mutate(state) as never, sessionScenario), sessionScenario);
    expect(result.kind).toBe('corrupt');
  });

  it.each([
    ['null effective pattern', (state: ReturnType<typeof activeState>) => ({
      ...state,
      activeWork: state.activeWork.map((work) => ({ ...work, effectivePattern: null })),
    })],
    ['negative held cost', (state: ReturnType<typeof activeState>) => ({
      ...state,
      activeWork: state.activeWork.map((work) => ({ ...work, paidCost: { staffAttention: -1 } })),
    })],
    ['foreign pattern id', (state: ReturnType<typeof activeState>) => ({
      ...state,
      activeWork: state.activeWork.map((work) => ({ ...work, patternId: 'pattern-foreign' })),
    })],
    ['overlapping duplicate reservation', (state: ReturnType<typeof activeState>) => ({
      ...state,
      activeWork: [...state.activeWork, { ...state.activeWork[0], id: 'work-foreign' }],
    })],
  ])('rejects unsafe reservation graph: %s', (_label, mutate) => {
    const state = activeState();
    const result = validateAndMigrateSave(createSaveEnvelope(mutate(state) as never, sessionScenario), sessionScenario);
    expect(result.kind).toBe('corrupt');
  });

  it.each([
    ['resource cost', (pattern: Record<string, unknown>) => ({ ...pattern, resourceCost: { staffAttention: 2 } })],
    ['duration', (pattern: Record<string, unknown>) => ({ ...pattern, durationMs: 20_001 })],
    ['slots', (pattern: Record<string, unknown>) => ({
      ...pattern,
      slots: (pattern.slots as Record<string, unknown>[]).map((slot, index) => index === 0 ? { ...slot, consumed: true } : slot),
    })],
    ['resolver parameters', (pattern: Record<string, unknown>) => ({
      ...pattern,
      output: { ...(pattern.output as Record<string, unknown>), parameters: { preserveInputDefinition: false } },
    })],
  ])('rejects a schema-valid effective-pattern change to %s', (_label, tamper) => {
    const state = activeState();
    const changed = {
      ...state,
      activeWork: state.activeWork.map((work) => work.kind === 'pattern'
        ? { ...work, effectivePattern: tamper(work.effectivePattern as unknown as Record<string, unknown>) }
        : work),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(changed as TermState, sessionScenario), sessionScenario).kind).toBe('corrupt');
  });

  it('loads a captured pre-unlock rule after a later tactic study finishes', () => {
    const carried = carriedAcrossStudy();
    expect(carried.unlockedSlotExpansions['pattern-draft-policy']).toEqual(['expansion-bipartisan-outreach']);
    const draft = carried.activeWork.find((work) => work.kind === 'pattern');
    expect(draft).toMatchObject({ effectiveExpansionIds: [], effectivePattern: { durationMs: 40_000 } });
    expect(validateAndMigrateSave(createSaveEnvelope(carried, sessionScenario), sessionScenario).kind).toBe('valid');

    const oldV2 = {
      ...carried,
      activeWork: carried.activeWork.map((work) => {
        if (work.kind !== 'pattern') return work;
        const legacyWork = { ...work };
        delete legacyWork.effectiveExpansionIds;
        return legacyWork;
      }),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(oldV2 as TermState, sessionScenario), sessionScenario).kind).toBe('valid');
  });

  it.each([
    ['locked provenance', ['expansion-bipartisan-outreach']],
    ['foreign provenance', ['expansion-foreign']],
  ])('rejects %s on a captured rule', (_label, effectiveExpansionIds) => {
    const state = activeState();
    const changed = {
      ...state,
      activeWork: state.activeWork.map((work) => work.kind === 'pattern' ? { ...work, effectiveExpansionIds } : work),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(changed, sessionScenario), sessionScenario).kind).toBe('corrupt');
  });

  it('rejects duplicate captured provenance even when the expansion is unlocked', () => {
    const state = carriedAcrossStudy();
    const changed = {
      ...state,
      activeWork: state.activeWork.map((work) => work.kind === 'pattern'
        ? { ...work, effectiveExpansionIds: ['expansion-bipartisan-outreach', 'expansion-bipartisan-outreach'] }
        : work),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(changed, sessionScenario), sessionScenario).kind).toBe('corrupt');
  });

  it('adapts only safe empty v1 fields into a validated v2 state', () => {
    const safeScenario = { ...sessionScenario, obligationDefinitions: [] };
    const state = createRun({ ...sessionSetup, scenario: safeScenario, mode: 'session' });
    const legacyState = { ...state, schemaVersion: 1 as const } as Record<string, unknown>;
    for (const key of ['activeWork', 'obligations', 'pendingDecisions', 'rewardedOccurrenceIds', 'resolvedWeekIds', 'runStatus']) {
      delete legacyState[key];
    }
    const migrated = validateAndMigrateSave({
      saveSchemaVersion: 1,
      rulesVersion: 1,
      snapshotId: safeScenario.snapshotId,
      snapshotHash: scenarioSnapshotHash(safeScenario),
      state: legacyState,
    }, safeScenario);
    expect(migrated.kind).toBe('valid');
    if (migrated.kind !== 'valid') throw new Error('expected supported migration');
    expect(migrated.envelope.state).toMatchObject({
      schemaVersion: 2,
      activeWork: [],
      obligations: [],
      pendingDecisions: [],
      rewardedOccurrenceIds: [],
      resolvedWeekIds: [],
      runStatus: 'active',
    });
  });

  it('rejects missing v1 obligations when authored obligations make emptiness unknowable', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const legacyState = { ...state, schemaVersion: 1 as const } as Record<string, unknown>;
    delete legacyState.obligations;
    const result = validateAndMigrateSave({
      saveSchemaVersion: 1,
      rulesVersion: 1,
      snapshotId: sessionScenario.snapshotId,
      snapshotHash: scenarioSnapshotHash(sessionScenario),
      state: legacyState,
    }, sessionScenario);
    expect(result.kind).toBe('corrupt');
  });

  it('does not erase unknown in-flight v1 work', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const cards = state.cards.map((card, index) => index === 0 ? { ...card, status: 'working' as const } : card);
    const legacyState = { ...state, schemaVersion: 1 as const, cards } as Record<string, unknown>;
    delete legacyState.activeWork;
    const result = validateAndMigrateSave({
      saveSchemaVersion: 1,
      rulesVersion: 1,
      snapshotId: sessionScenario.snapshotId,
      snapshotHash: scenarioSnapshotHash(sessionScenario),
      state: legacyState,
    }, sessionScenario);
    expect(result).toMatchObject({ kind: 'corrupt' });
  });

  it.each(['obligations', 'pendingDecisions'] as const)('does not default missing v1 %s when occurrence evidence exists', (missing) => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const legacyState = {
      ...state,
      schemaVersion: 1 as const,
      relationships: state.relationships.map((relationship, index) => index === 0
        ? { ...relationship, demandOccurrenceId: 'demand-renter-protection:revision:0' }
        : relationship),
    } as Record<string, unknown>;
    delete legacyState[missing];
    const result = validateAndMigrateSave({
      saveSchemaVersion: 1,
      rulesVersion: 1,
      snapshotId: sessionScenario.snapshotId,
      snapshotHash: scenarioSnapshotHash(sessionScenario),
      state: legacyState,
    }, sessionScenario);
    expect(result.kind).toBe('corrupt');
  });
});
