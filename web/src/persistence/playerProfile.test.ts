import { describe, expect, it } from 'vitest';

import {
  emptyPlayerProfile,
  loadPlayerProfile,
  mergeLifetimeDiscoveries,
  PLAYER_PROFILE_KEY,
  savePlayerProfile,
} from '@/persistence/playerProfile';
import type { SaveStorage } from '@/persistence/saveRepository';
import { createRun } from '@/domain/runSetup';
import { sessionSetup } from '@/test/fixtures/session';

function storage(initial?: string): SaveStorage & { value: string | null; fail?: 'get' | 'set' } {
  return {
    value: initial ?? null,
    getItem() {
      if (this.fail === 'get') throw new Error('read denied');
      return this.value;
    },
    setItem(key, value) {
      expect(key).toBe(PLAYER_PROFILE_KEY);
      if (this.fail === 'set') throw new Error('write denied');
      this.value = value;
    },
    removeItem() {},
  };
}

describe('player profile discovery archive', () => {
  it('stores sorted deduplicated knowledge without numeric state', () => {
    const local = storage(JSON.stringify({ schemaVersion: 1, lifetimeDiscoveredPatternIds: ['pattern-z', 'pattern-a'] }));
    const saved = savePlayerProfile(local, ['pattern-b', 'pattern-a']);
    expect(saved).toEqual({
      kind: 'saved',
      profile: { schemaVersion: 1, lifetimeDiscoveredPatternIds: ['pattern-a', 'pattern-b', 'pattern-z'] },
    });
    expect(loadPlayerProfile(local)).toEqual({ kind: 'loaded', profile: saved.profile });
  });

  it.each(['get', 'set'] as const)('reports a throwing %s and retains the known bytes', (operation) => {
    const raw = JSON.stringify({ schemaVersion: 1, lifetimeDiscoveredPatternIds: ['pattern-a'] });
    const local = storage(raw);
    local.fail = operation;
    expect(savePlayerProfile(local, ['pattern-b']).kind).toBe('storage-unavailable');
    expect(local.value).toBe(raw);
  });

  it('does not overwrite a malformed profile', () => {
    const local = storage('{bad');
    expect(savePlayerProfile(local, ['pattern-a']).kind).toBe('storage-unavailable');
    expect(local.value).toBe('{bad');
  });

  it('purely merges sorted lifetime discoveries without changing run rules or numbers', () => {
    const finished = {
      ...createRun({ ...sessionSetup, mode: 'session' }),
      discoveredPatternIds: ['pattern-z', 'pattern-a'],
    };
    const before = structuredClone(finished);
    const merged = mergeLifetimeDiscoveries({
      schemaVersion: 1,
      lifetimeDiscoveredPatternIds: ['pattern-b', 'pattern-a'],
    }, finished);
    expect(merged.lifetimeDiscoveredPatternIds).toEqual(['pattern-a', 'pattern-b', 'pattern-z']);
    expect(finished).toEqual(before);
    expect(finished.resources).toEqual(before.resources);
    expect(finished.unlockedSlotExpansions).toEqual(before.unlockedSlotExpansions);
    expect(finished.rngCursor).toBe(before.rngCursor);
    expect(mergeLifetimeDiscoveries(emptyPlayerProfile(), finished).schemaVersion).toBe(1);
  });
});
