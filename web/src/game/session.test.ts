import { describe, expect, it } from 'vitest';

import { createRun } from '@/domain/initialState';
import { createGameSession } from '@/game/session';
import { loadCheckpoint, SAVE_KEYS, saveCheckpoint, type SaveStorage } from '@/persistence/saveRepository';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

class SessionStorage implements SaveStorage {
  values = new Map<string, string>();
  failCurrentWrite = false;
  failNextCurrentRead = false;
  getItem(key: string) {
    if (this.failNextCurrentRead && key === SAVE_KEYS.current) {
      this.failNextCurrentRead = false;
      throw new Error('one-shot read failure');
    }
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failCurrentWrite && key === SAVE_KEYS.current) throw new Error('quota');
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
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
});
