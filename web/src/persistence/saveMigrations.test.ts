import { describe, expect, it } from 'vitest';

import { createRun } from '@/domain/initialState';
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

  it('adapts only safe empty v1 fields into a validated v2 state', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const legacyState = { ...state, schemaVersion: 1 as const } as Record<string, unknown>;
    for (const key of ['activeWork', 'obligations', 'pendingDecisions', 'rewardedOccurrenceIds', 'resolvedWeekIds', 'runStatus']) {
      delete legacyState[key];
    }
    const migrated = validateAndMigrateSave({
      saveSchemaVersion: 1,
      rulesVersion: 1,
      snapshotId: sessionScenario.snapshotId,
      snapshotHash: scenarioSnapshotHash(sessionScenario),
      state: legacyState,
    }, sessionScenario);
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
});
