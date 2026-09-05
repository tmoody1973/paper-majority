import { describe, expect, it } from 'vitest';

import { createRun } from '@/domain/initialState';
import { createGameSession } from '@/game/session';
import { loadCheckpoint, SAVE_KEYS, saveCheckpoint, type SaveStorage } from '@/persistence/saveRepository';
import { PLAYER_PROFILE_KEY } from '@/persistence/playerProfile';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';
import { getCandidateScenario } from '@/content/loadScenario';

class SessionStorage implements SaveStorage {
  values = new Map<string, string>();
  failCurrentWrite = false;
  failNextCurrentRead = false;
  failReplacedWrite = false;
  failPreviousRemove = false;
  getItem(key: string) {
    if (this.failNextCurrentRead && key === SAVE_KEYS.current) {
      this.failNextCurrentRead = false;
      throw new Error('one-shot read failure');
    }
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failCurrentWrite && key === SAVE_KEYS.current) throw new Error('quota');
    if (this.failReplacedWrite && key === SAVE_KEYS.replaced) throw new Error('archive denied');
    this.values.set(key, value);
  }
  removeItem(key: string) {
    if (this.failPreviousRemove && key === SAVE_KEYS.previousWeek) throw new Error('fallback clear denied');
    this.values.delete(key);
  }
}

function idsForWork(state: ReturnType<typeof createRun>) {
  return [
    state.cards.find((card) => card.definitionId === 'staff-policy-aide')!.id,
    state.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!.id,
  ];
}

describe('GameSession persistence owner', () => {
  it('autosaves paid accepted work and profile knowledge, but skips cosmetic moves', () => {
    const initial = createRun({ ...sessionSetup, mode: 'session' });
    const session = createGameSession(initial, sessionScenario);
    const storage = new SessionStorage();
    expect(session.recover(storage).kind).toBe('empty');
    const first = initial.cards[0];
    session.dispatch({ type: 'MOVE_CARD', cardId: first.id, x: first.x + 1, y: first.y });
    expect(storage.values.has(SAVE_KEYS.current)).toBe(false);

    const result = session.dispatch({ type: 'SUBMIT_WORK', cardIds: idsForWork(session.getState()) });
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'WORK_SUBMITTED' }));
    expect(loadCheckpoint(storage, sessionScenario).kind).toBe('loaded');
    expect(session.getPlayerProfile().lifetimeDiscoveredPatternIds).toEqual(['pattern-summarize-evidence']);
  });

  it('keeps an accepted paid command in memory and surfaces a failed save', () => {
    const initial = createRun({ ...sessionSetup, mode: 'session' });
    const session = createGameSession(initial, sessionScenario);
    const storage = new SessionStorage();
    session.recover(storage);
    storage.failCurrentWrite = true;
    const result = session.dispatch({ type: 'SUBMIT_WORK', cardIds: idsForWork(initial) });
    expect(result.state.activeWork).toHaveLength(1);
    expect(session.getState()).toBe(result.state);
    expect(session.getState().resources.staffAttention).toBe(2);
    expect(session.getPersistenceNotice()).toMatch(/storage failed/i);
  });

  it('recovers into the same owner paused and preserves explicit settings', () => {
    const storage = new SessionStorage();
    const initial = {
      ...createRun({ ...sessionSetup, mode: 'session', settings: { reducedMotion: true } }),
      paused: false,
    };
    const writer = createGameSession(initial, sessionScenario);
    writer.recover(storage);
    writer.dispatch({ type: 'SUBMIT_WORK', cardIds: idsForWork(initial) });

    const reader = createGameSession(createRun({ ...sessionSetup, mode: 'session' }), sessionScenario);
    expect(reader.recover(storage).kind).toBe('loaded');
    expect(reader.getState().paused).toBe(true);
    expect(reader.getState().settings.reducedMotion).toBe(true);
    expect(reader.getState().activeWork[0].decisionOrigin).toBeUndefined();
  });

  it('does not bind a writer after a one-shot unreadable checkpoint', () => {
    const storage = new SessionStorage();
    const fresh = createRun({ ...sessionSetup, mode: 'session' });
    const session = createGameSession(fresh, sessionScenario);
    expect(session.recover(storage).kind).toBe('empty');

    const saved = createRun({ ...sessionSetup, mode: 'session' });
    expect(saveCheckpoint(storage, saved, sessionScenario).kind).toBe('saved');
    const before = new Map(storage.values);
    storage.failNextCurrentRead = true;

    expect(session.recover(storage).kind).toBe('storage-unavailable');
    const accepted = session.dispatch({ type: 'SUBMIT_WORK', cardIds: idsForWork(fresh) });
    expect(accepted.state.activeWork).toHaveLength(1);
    expect(storage.values).toEqual(before);
  });

  it('revokes an existing writer when a later probe cannot validate storage', () => {
    const storage = new SessionStorage();
    const initial = createRun({ ...sessionSetup, mode: 'session' });
    expect(saveCheckpoint(storage, initial, sessionScenario).kind).toBe('saved');
    const session = createGameSession(createRun({ ...sessionSetup, mode: 'session', seed: 7 }), sessionScenario);
    expect(session.resume(storage).kind).toBe('loaded');
    const before = new Map(storage.values);
    storage.failNextCurrentRead = true;
    expect(session.probe(storage).kind).toBe('storage-unavailable');
    expect(session.getState().seed).toBe(initial.seed);
    expect(session.getPersistenceNotice()).toMatch(/left unchanged/i);
    session.dispatch({ type: 'SUBMIT_WORK', cardIds: idsForWork(session.getState()) });
    expect(storage.values).toEqual(before);
  });

  it('makes Resume and Start New explicit writer transitions and preserves replaced bytes', () => {
    const storage = new SessionStorage();
    storage.values.set(PLAYER_PROFILE_KEY, JSON.stringify({ schemaVersion: 1, lifetimeDiscoveredPatternIds: ['pattern-summarize-evidence'] }));
    const saved = createRun({ ...sessionSetup, mode: 'session', seed: 41 });
    expect(saveCheckpoint(storage, saved, sessionScenario).kind).toBe('saved');
    const priorBytes = storage.values.get(SAVE_KEYS.current);

    const chosen = createRun({ ...sessionSetup, mode: 'session', seed: 99 });
    const session = createGameSession(chosen, sessionScenario);
    expect(session.probe(storage)).toMatchObject({ kind: 'loaded', state: { seed: 41 } });
    expect(session.getState().seed).toBe(99);
    expect(session.startNew(chosen, storage).kind).toBe('started');
    expect(session.getState().seed).toBe(99);
    expect(storage.values.get(SAVE_KEYS.replaced)).toBe(priorBytes);
    expect(session.getPreservedSaveBytes()).toBe(priorBytes);
    expect(session.getPlayerProfile().lifetimeDiscoveredPatternIds).toEqual(['pattern-summarize-evidence']);
    expect(JSON.parse(storage.values.get(PLAYER_PROFILE_KEY)!)).toEqual({ schemaVersion: 1, lifetimeDiscoveredPatternIds: ['pattern-summarize-evidence'] });
    expect(loadCheckpoint(storage, sessionScenario)).toMatchObject({ kind: 'loaded', state: { seed: 99 } });

    const reader = createGameSession(createRun({ ...sessionSetup, mode: 'session', seed: 7 }), sessionScenario);
    expect(reader.resume(storage)).toMatchObject({ kind: 'loaded', state: { seed: 99 } });
    expect(reader.getState().seed).toBe(99);
  });

  it('preserves corrupt bytes for export before intentionally replacing them', () => {
    const storage = new SessionStorage();
    const corruptBytes = '{"broken checkpoint"';
    storage.values.set(SAVE_KEYS.current, corruptBytes);
    const chosen = createRun({ ...sessionSetup, mode: 'session', seed: 99 });
    const session = createGameSession(chosen, sessionScenario);
    expect(session.probe(storage).kind).toBe('corrupt');
    expect(session.getCurrentSaveBytes()).toBe(corruptBytes);
    expect(session.getPreservedSaveBytes()).toBeUndefined();
    expect(session.startNew(chosen, storage).kind).toBe('started');
    expect(storage.values.get(SAVE_KEYS.replaced)).toBe(corruptBytes);
    expect(session.getPreservedSaveBytes()).toBe(corruptBytes);
    expect(loadCheckpoint(storage, sessionScenario)).toMatchObject({ kind: 'loaded', state: { seed: 99 } });
  });

  it('keeps prior and current exports distinct across New, reload, and Resume', () => {
    const storage = new SessionStorage();
    const runA = createRun({ ...sessionSetup, mode: 'session', seed: 41 });
    expect(saveCheckpoint(storage, runA, sessionScenario).kind).toBe('saved');
    const bytesA = storage.values.get(SAVE_KEYS.current)!;
    const writer = createGameSession(runA, sessionScenario);
    const runB = createRun({ ...sessionSetup, mode: 'session', seed: 99 });
    expect(writer.startNew(runB, storage).kind).toBe('started');
    const bytesB = storage.values.get(SAVE_KEYS.current)!;
    expect(bytesB).not.toBe(bytesA);

    const reader = createGameSession(createRun({ ...sessionSetup, mode: 'session', seed: 7 }), sessionScenario);
    expect(reader.probe(storage)).toMatchObject({ kind: 'loaded', state: { seed: 99 } });
    expect(reader.getPreservedSaveBytes()).toBe(bytesA);
    expect(reader.getCurrentSaveBytes()).toBe(bytesB);
    expect(reader.resume(storage)).toMatchObject({ kind: 'loaded', state: { seed: 99 } });
    expect(reader.getPreservedSaveBytes()).toBe(bytesA);
    expect(reader.getCurrentSaveBytes()).toBe(bytesB);
  });

  it('cannot recover the previous run after New establishes a different seed', () => {
    const storage = new SessionStorage();
    const runA = createRun({ ...sessionSetup, mode: 'session', seed: 41 });
    expect(saveCheckpoint(storage, runA, sessionScenario).kind).toBe('saved');
    storage.values.set(SAVE_KEYS.previousWeek, storage.values.get(SAVE_KEYS.current)!);
    const writer = createGameSession(runA, sessionScenario);
    const runB = createRun({ ...sessionSetup, mode: 'session', seed: 99 });
    expect(writer.startNew(runB, storage).kind).toBe('started');
    expect(storage.values.has(SAVE_KEYS.previousWeek)).toBe(false);
    storage.values.set(SAVE_KEYS.current, '{corrupt B');

    const chosen = createRun({ ...sessionSetup, mode: 'session', seed: 7 });
    const reader = createGameSession(chosen, sessionScenario);
    expect(reader.resume(storage).kind).toBe('corrupt');
    expect(reader.getState().seed).toBe(7);
    expect(reader.getState().seed).not.toBe(41);
  });

  it('does not overwrite the prior run when fallback separation fails', () => {
    const storage = new SessionStorage();
    const runA = createRun({ ...sessionSetup, mode: 'session', seed: 41 });
    expect(saveCheckpoint(storage, runA, sessionScenario).kind).toBe('saved');
    const bytesA = storage.values.get(SAVE_KEYS.current)!;
    storage.values.set(SAVE_KEYS.previousWeek, bytesA);
    storage.failPreviousRemove = true;
    const runB = createRun({ ...sessionSetup, mode: 'session', seed: 99 });
    const session = createGameSession(runB, sessionScenario);
    expect(session.startNew(runB, storage).kind).toBe('storage-unavailable');
    expect(session.getState().seed).toBe(99);
    expect(storage.values.get(SAVE_KEYS.current)).toBe(bytesA);
  });

  it('initializes the opening Story before New is checkpointed and never draws on Resume', () => {
    const scenario = getCandidateScenario();
    const storage = new SessionStorage();
    const fresh = createRun({ ...sessionSetup, scenario, mode: 'session', seed: 41 });
    const writer = createGameSession(fresh, scenario);
    expect(writer.startNew(fresh, storage).kind).toBe('started');
    const opened = writer.getState();
    expect(opened.storyHistory).toHaveLength(1);
    const openingHistory = [...opened.storyHistory];

    const reader = createGameSession(createRun({ ...sessionSetup, scenario, mode: 'session', seed: 7 }), scenario);
    expect(reader.resume(storage).kind).toBe('loaded');
    expect(reader.getState().storyHistory).toEqual(openingHistory);

    const emptyStorage = new SessionStorage();
    const emptyHistory = createRun({ ...sessionSetup, scenario, mode: 'session', seed: 99 });
    expect(saveCheckpoint(emptyStorage, emptyHistory, scenario).kind).toBe('saved');
    const emptyReader = createGameSession(createRun({ ...sessionSetup, scenario, mode: 'session', seed: 7 }), scenario);
    expect(emptyReader.resume(emptyStorage).kind).toBe('loaded');
    expect(emptyReader.getState().storyHistory).toEqual([]);
    expect(emptyReader.getState().pendingStoryDecisions).toEqual([]);
  });

  it('keeps the chosen run authoritative and unbound when its initial save cannot be promoted', () => {
    const storage = new SessionStorage();
    storage.failCurrentWrite = true;
    const chosen = createRun({ ...sessionSetup, mode: 'session', seed: 99 });
    const session = createGameSession(chosen, sessionScenario);
    expect(session.startNew(chosen, storage).kind).toBe('storage-unavailable');
    expect(session.getState().seed).toBe(99);
    storage.failCurrentWrite = false;
    session.dispatch({ type: 'SUBMIT_WORK', cardIds: idsForWork(chosen) });
    expect(storage.values.has(SAVE_KEYS.current)).toBe(false);
  });

  it('keeps the chosen new state authoritative when prior-save preservation fails', () => {
    const storage = new SessionStorage();
    expect(saveCheckpoint(storage, createRun({ ...sessionSetup, mode: 'session', seed: 41 }), sessionScenario).kind).toBe('saved');
    const priorBytes = storage.values.get(SAVE_KEYS.current);
    storage.failReplacedWrite = true;
    const chosen = createRun({ ...sessionSetup, mode: 'session', seed: 99 });
    const session = createGameSession(chosen, sessionScenario);
    expect(session.startNew(chosen, storage).kind).toBe('storage-unavailable');
    expect(session.getState().seed).toBe(99);
    expect(storage.values.get(SAVE_KEYS.current)).toBe(priorBytes);
    session.dispatch({ type: 'SUBMIT_WORK', cardIds: idsForWork(chosen) });
    expect(storage.values.get(SAVE_KEYS.current)).toBe(priorBytes);
  });
});
