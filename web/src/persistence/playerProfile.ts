import type { PlayerProfile, TermState } from '@/domain/types';
import type { SaveStorage } from '@/persistence/saveRepository';

export const PLAYER_PROFILE_KEY = 'congress-game.player-profile';

export type ProfileLoadResult =
  | { kind: 'loaded'; profile: PlayerProfile }
  | { kind: 'empty'; profile: PlayerProfile }
  | { kind: 'corrupt'; message: string }
  | { kind: 'storage-unavailable'; message: string };

export type ProfileSaveResult =
  | { kind: 'saved'; profile: PlayerProfile }
  | { kind: 'storage-unavailable'; profile: PlayerProfile; message: string };

export function emptyPlayerProfile(): PlayerProfile {
  return { schemaVersion: 1, lifetimeDiscoveredPatternIds: [] };
}

function normalize(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

/**
 * Carry explanation knowledge between Sessions without writing into the finished
 * run or granting resources, rules, Tactics, cards, or extra random draws.
 */
export function mergeLifetimeDiscoveries(
  profile: PlayerProfile,
  finishedState: TermState,
): PlayerProfile {
  return {
    schemaVersion: 1,
    lifetimeDiscoveredPatternIds: normalize([
      ...profile.lifetimeDiscoveredPatternIds,
      ...finishedState.discoveredPatternIds,
    ]),
  };
}

function parseProfile(raw: string): PlayerProfile | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['schemaVersion', 'lifetimeDiscoveredPatternIds'].includes(key))) return undefined;
  if (record.schemaVersion !== 1 || !Array.isArray(record.lifetimeDiscoveredPatternIds)
    || !record.lifetimeDiscoveredPatternIds.every((id) => typeof id === 'string')) return undefined;
  return { schemaVersion: 1, lifetimeDiscoveredPatternIds: normalize(record.lifetimeDiscoveredPatternIds) };
}

export function loadPlayerProfile(storage: SaveStorage): ProfileLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(PLAYER_PROFILE_KEY);
  } catch (error) {
    return { kind: 'storage-unavailable', message: `Player-profile storage is unavailable${error instanceof Error ? ` (${error.message})` : ''}.` };
  }
  if (raw === null) return { kind: 'empty', profile: emptyPlayerProfile() };
  const profile = parseProfile(raw);
  return profile
    ? { kind: 'loaded', profile }
    : { kind: 'corrupt', message: 'The player discovery archive is malformed; the stored value was left untouched.' };
}

export function savePlayerProfile(storage: SaveStorage, patternIds: readonly string[]): ProfileSaveResult {
  const loaded = loadPlayerProfile(storage);
  const existing = loaded.kind === 'loaded' || loaded.kind === 'empty'
    ? loaded.profile.lifetimeDiscoveredPatternIds
    : [];
  const profile: PlayerProfile = {
    schemaVersion: 1,
    lifetimeDiscoveredPatternIds: normalize([...existing, ...patternIds]),
  };
  if (loaded.kind === 'storage-unavailable') return { ...loaded, profile };
  if (loaded.kind === 'corrupt') {
    return { kind: 'storage-unavailable', profile, message: `${loaded.message} No discovery update was written.` };
  }
  try {
    storage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
    return { kind: 'saved', profile };
  } catch (error) {
    return {
      kind: 'storage-unavailable',
      profile,
      message: `Player-profile storage failed while saving${error instanceof Error ? ` (${error.message})` : ''}.`,
    };
  }
}
