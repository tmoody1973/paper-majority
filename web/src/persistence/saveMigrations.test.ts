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
import { getCandidateScenario } from '@/content/loadScenario';
import { drawStoryEvent } from '@/domain/storyDirector';
import { SESSION_READINESS_MILESTONE_ID } from '@/domain/objectives';
import { loadCheckpoint, SAVE_KEYS, saveCheckpoint, type SaveStorage } from '@/persistence/saveRepository';

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

  it('rejects replayable Story status, occurrence, and receipt tampering', () => {
    const scenario = getCandidateScenario();
    const base = createRun({ ...sessionSetup, scenario, mode: 'session' });
    const drawn = drawStoryEvent(base, scenario).state;
    const pending = drawn.pendingStoryDecisions[0];
    const story = scenario.storyEvents.find((event) => event.id === pending.storyEventId)!;
    const free = story.choices.find((choice) => Object.values(choice.cost).every((amount) => amount === 0))!;
    const resolved = executeCommand(drawn, {
      type: 'RESOLVE_STORY', decisionId: pending.id, choiceId: free.id,
    }, { scenario }).state;
    expect(validateAndMigrateSave(createSaveEnvelope(resolved, scenario), scenario).kind).toBe('valid');
    const replayable = {
      ...resolved,
      pendingStoryDecisions: resolved.pendingStoryDecisions.map((decision) => ({ ...decision, status: 'pending' as const })),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(replayable, scenario), scenario).kind).toBe('corrupt');
    const malformed = {
      ...resolved,
      pendingStoryDecisions: resolved.pendingStoryDecisions.map((decision) => ({ ...decision, occurrenceId: 'story:bad' })),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(malformed, scenario), scenario).kind).toBe('corrupt');
    const withoutDirectorHistory = {
      ...drawn,
      storyHistory: [],
      eventLog: drawn.eventLog.filter((event) => event.type !== 'EVENT_TRIGGERED'),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(withoutDirectorHistory, scenario), scenario).kind).toBe('corrupt');
  });

  it('rejects missing or duplicate pack receipts and invalid variation selections', () => {
    const scenario = getCandidateScenario();
    const base = { ...createRun({ ...sessionSetup, scenario, mode: 'session' }), week: 2 };
    const opened = executeCommand(base, {
      type: 'OPEN_PACK', packOccurrenceId: 'pack:week:2', categoryId: 'week-two-policy',
    }, { scenario }).state;
    expect(validateAndMigrateSave(createSaveEnvelope(opened, scenario), scenario).kind).toBe('valid');
    expect(validateAndMigrateSave(createSaveEnvelope({ ...opened, revealedPacks: [] }, scenario), scenario).kind).toBe('corrupt');
    const openedEvent = opened.eventLog.find((event) => event.type === 'PACK_OPENED')!;
    expect(validateAndMigrateSave(createSaveEnvelope({ ...opened, eventLog: [...opened.eventLog, openedEvent] }, scenario), scenario).kind).toBe('corrupt');
    const officeId = Object.keys(opened.runVariation.selectedDemandIdsByOffice)[0]!;
    const tampered = {
      ...opened,
      runVariation: {
        ...opened.runVariation,
        selectedDemandIdsByOffice: { ...opened.runVariation.selectedDemandIdsByOffice, [officeId]: 'demand-foreign' },
      },
    };
    expect(validateAndMigrateSave(createSaveEnvelope(tampered, scenario), scenario).kind).toBe('corrupt');
  });

  it('accepts a docket receipt after its drafted card is consumed and rejects receipt-event tampering', () => {
    const scenario = structuredClone(sessionScenario);
    scenario.patterns = scenario.patterns.map((pattern) => ({ ...pattern, durationMs: 1 }));
    let state = createRun({ ...sessionSetup, scenario, mode: 'session' });
    const aide = state.cards.find((card) => card.definitionId === 'staff-policy-aide')!;
    const evidence = state.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    state = executeCommand(state, {
      type: 'SUBMIT_WORK', cardIds: [aide.id, evidence.id],
    }, { scenario }).state;
    state = executeCommand(state, { type: 'FAST_FORWARD' }, { scenario }).state;
    const summary = state.cards.find((card) => card.definitionId === evidence.definitionId && card.form === 'summary')!;
    const counsel = state.cards.find((card) => card.definitionId === 'staff-legislative-counsel')!;
    const policy = state.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')!;
    state = executeCommand(state, {
      type: 'SUBMIT_WORK', cardIds: [counsel.id, summary.id, policy.id],
    }, { scenario }).state;
    state = executeCommand(state, { type: 'FAST_FORWARD' }, { scenario }).state;
    const drafted = state.cards.find((card) => card.definitionId === policy.definitionId && card.form === 'drafted')!;
    state = executeCommand(state, { type: 'DOCKET_PROVISION', cardId: drafted.id }, { scenario }).state;

    expect(state.cards.some((card) => card.id === drafted.id)).toBe(false);
    expect(validateAndMigrateSave(createSaveEnvelope(state, scenario), scenario).kind).toBe('valid');
    const tampered = {
      ...state,
      eventLog: state.eventLog.map((event) => event.type === 'PROVISION_DOCKETED'
        ? { ...event, cardId: 'card-not-the-draft' }
        : event),
    };
    expect(validateAndMigrateSave(createSaveEnvelope(tampered, scenario), scenario).kind).toBe('corrupt');
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

  it('round-trips a deeply derived finished record and rejects record tampering', () => {
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const boundary = {
      ...base,
      elapsedMs: base.weekLengthMs,
      simulationMs: base.weekLengthMs,
      weekPhase: 'boundary' as const,
      paused: true,
    };
    const finished = executeCommand(boundary, { type: 'CONCLUDE_SESSION' }, { scenario: sessionScenario }).state;
    const valid = validateAndMigrateSave(JSON.parse(JSON.stringify(createSaveEnvelope(finished, sessionScenario))), sessionScenario);
    expect(valid.kind).toBe('valid');
    if (valid.kind !== 'valid') throw new Error('expected finished record round trip');
    expect(valid.envelope.state.sessionRecord).toEqual(finished.sessionRecord);
    expect(valid.envelope.state.sessionRecord?.setup).toMatchObject({
      mode: 'session',
      rulesVersion: 2,
      snapshotId: sessionScenario.snapshotId,
      snapshotHash: scenarioSnapshotHash(sessionScenario),
    });

    const legacy = structuredClone(createSaveEnvelope(finished, sessionScenario)) as unknown as {
      rulesVersion: 2;
      snapshotHash: string;
      state: { sessionRecord: { setup: Record<string, unknown> } };
    };
    delete legacy.state.sessionRecord.setup.mode;
    delete legacy.state.sessionRecord.setup.rulesVersion;
    delete legacy.state.sessionRecord.setup.snapshotHash;
    const migratedLegacy = validateAndMigrateSave(legacy, sessionScenario);
    expect(migratedLegacy.kind).toBe('valid');
    if (migratedLegacy.kind !== 'valid') throw new Error('expected Task 9 record identity migration');
    expect(migratedLegacy.envelope.state.sessionRecord?.setup).toMatchObject({
      mode: 'session',
      rulesVersion: legacy.rulesVersion,
      snapshotHash: legacy.snapshotHash,
    });
    expect(legacy.state.sessionRecord.setup).not.toHaveProperty('mode');
    expect(legacy.state.sessionRecord.setup).not.toHaveProperty('rulesVersion');
    expect(legacy.state.sessionRecord.setup).not.toHaveProperty('snapshotHash');

    const legacyValues = new Map<string, string>([[SAVE_KEYS.current, JSON.stringify(legacy)]]);
    const legacyStorage: SaveStorage = {
      getItem: (key) => legacyValues.get(key) ?? null,
      setItem: (key, value) => { legacyValues.set(key, value); },
      removeItem: (key) => { legacyValues.delete(key); },
    };
    const loadedLegacy = loadCheckpoint(legacyStorage, sessionScenario);
    expect(loadedLegacy.kind).toBe('loaded');
    if (loadedLegacy.kind !== 'loaded') throw new Error('expected Task 9 finished checkpoint load');
    expect(loadedLegacy.state.sessionRecord?.setup).toMatchObject({
      mode: 'session',
      rulesVersion: legacy.rulesVersion,
      snapshotHash: legacy.snapshotHash,
    });

    for (const missing of ['mode', 'rulesVersion', 'snapshotHash'] as const) {
      const partial = structuredClone(createSaveEnvelope(finished, sessionScenario)) as unknown as {
        state: { sessionRecord: { setup: Record<string, unknown> } };
      };
      delete partial.state.sessionRecord.setup[missing];
      expect(validateAndMigrateSave(partial, sessionScenario)).toMatchObject({
        kind: 'corrupt',
        message: expect.stringMatching(/incomplete compatibility identity/i),
      });
    }

    for (const identityChange of [
      { rulesVersion: 1 },
      { snapshotHash: '0'.repeat(64) },
      { mode: 'term' },
    ]) {
      const inconsistent = structuredClone(createSaveEnvelope(finished, sessionScenario)) as unknown as {
        state: { sessionRecord: { setup: Record<string, unknown> } };
      };
      Object.assign(inconsistent.state.sessionRecord.setup, identityChange);
      expect(validateAndMigrateSave(inconsistent, sessionScenario).kind).toBe('corrupt');
    }

    const changedPresentation = {
      ...finished,
      settings: { ...finished.settings, reducedMotion: !finished.settings.reducedMotion },
    };
    const presentationRoundTrip = validateAndMigrateSave(createSaveEnvelope(changedPresentation, sessionScenario), sessionScenario);
    expect(presentationRoundTrip.kind).toBe('valid');
    if (presentationRoundTrip.kind !== 'valid') throw new Error('expected presentation-only change to remain valid');
    expect(presentationRoundTrip.envelope.state.sessionRecord).toEqual(finished.sessionRecord);

    const values = new Map<string, string>();
    const storage: SaveStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const savedPresentation = saveCheckpoint(storage, changedPresentation, sessionScenario);
    expect(savedPresentation.kind).toBe('saved');
    if (savedPresentation.kind !== 'saved') throw new Error('expected finished presentation checkpoint');
    expect(JSON.parse(savedPresentation.bytes).state.sessionRecord).toEqual(finished.sessionRecord);
    const reloadedPresentation = loadCheckpoint(storage, sessionScenario);
    expect(reloadedPresentation.kind).toBe('loaded');
    if (reloadedPresentation.kind !== 'loaded') throw new Error('expected finished presentation reload');
    expect(reloadedPresentation.state.sessionRecord).toEqual(finished.sessionRecord);

    const changed = structuredClone(createSaveEnvelope(finished, sessionScenario));
    (changed.state.sessionRecord!.gaps as { provisionGap: number }).provisionGap = 0;
    expect(validateAndMigrateSave(changed, sessionScenario).kind).toBe('corrupt');

    for (const malformedSettings of [
      { ...finished.sessionRecord!.setup.settings, reducedMotion: 'yes' },
      null,
      undefined,
    ]) {
      const malformed = structuredClone(createSaveEnvelope(finished, sessionScenario)) as unknown as {
        state: { sessionRecord: { setup: Record<string, unknown> } };
      };
      if (malformedSettings === undefined) {
        delete malformed.state.sessionRecord.setup.settings;
      } else {
        malformed.state.sessionRecord.setup.settings = malformedSettings;
      }
      expect(() => validateAndMigrateSave(malformed, sessionScenario)).not.toThrow();
      expect(validateAndMigrateSave(malformed, sessionScenario).kind).toBe('corrupt');
    }
  });

  it.each([0, 1])('saves and reloads a readiness milestone with actual gain %i', (appliedCapital) => {
    const values = new Map<string, string>();
    const storage: SaveStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const milestone = {
      ...base,
      resources: { ...base.resources, politicalCapital: appliedCapital === 0 ? 9 : base.resources.politicalCapital + 1 },
      rewardedOccurrenceIds: [SESSION_READINESS_MILESTONE_ID],
      eventLog: [
        { type: 'READINESS_MILESTONE_REWARDED' as const, rewardId: SESSION_READINESS_MILESTONE_ID, appliedCapital },
        ...(appliedCapital === 1 ? [{
          type: 'RESOURCE_CHANGED' as const,
          changes: { politicalCapital: 1 },
          reason: SESSION_READINESS_MILESTONE_ID,
        }] : []),
      ],
    };
    expect(saveCheckpoint(storage, milestone, sessionScenario).kind).toBe('saved');
    const loaded = loadCheckpoint(storage, sessionScenario);
    expect(loaded).toMatchObject({ kind: 'loaded', state: { rewardedOccurrenceIds: [SESSION_READINESS_MILESTONE_ID] } });
    if (loaded.kind !== 'loaded') throw new Error('expected milestone reload');
    expect(loaded.state.eventLog).toEqual(milestone.eventLog);
  });
});
