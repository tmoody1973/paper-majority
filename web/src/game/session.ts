import { executeCommand, type EngineResult, type EngineServices } from '@/domain/engine';
import type { GameCommand } from '@/domain/commands';
import type { PlayerProfile, ScenarioDefinition, TermState } from '@/domain/types';
import {
  loadPlayerProfile,
  mergeLifetimeDiscoveries,
  savePlayerProfile,
  emptyPlayerProfile,
} from '@/persistence/playerProfile';
import {
  loadCheckpoint,
  SAVE_KEYS,
  saveCheckpoint,
  type LoadResult,
  type SaveStorage,
} from '@/persistence/saveRepository';

export interface GameSession {
  getState(): TermState;
  getScenario(): ScenarioDefinition;
  getPlayerProfile(): PlayerProfile;
  getPersistenceNotice(): string | undefined;
  dispatch(command: GameCommand): EngineResult;
  subscribe(listener: (result: EngineResult) => void): () => void;
  probe(storage: SaveStorage): LoadResult;
  resume(storage: SaveStorage): LoadResult;
  recover(storage: SaveStorage): LoadResult;
  startNew(nextState: TermState, storage: SaveStorage): { kind: 'started' | 'storage-unavailable'; message: string };
  getPreservedSaveBytes(): string | undefined;
  getCurrentSaveBytes(): string | undefined;
  /**
   * Reduced motion is presentation, not a rule: it changes no outcome and draws no
   * randomness. It lives on the session so React and Phaser read one value.
   */
  setReducedMotion(value: boolean): void;
}

/**
 * The single owner of authoritative state.
 *
 * React and Phaser share one instance and both go through `dispatch`. Nothing else
 * in the application is allowed to replace `TermState`.
 */
export function createGameSession(
  initialState: TermState,
  scenario: ScenarioDefinition,
): GameSession {
  let state = initialState;
  const services: EngineServices = { scenario };
  const listeners = new Set<(result: EngineResult) => void>();
  let storage: SaveStorage | undefined;
  let profile = emptyPlayerProfile();
  let persistenceNotice: string | undefined;
  let preservedSaveBytes: string | undefined;
  let currentSaveBytes: string | undefined;

  const publish = (result: EngineResult) => {
    for (const listener of [...listeners]) listener(result);
  };

  const accepted = (result: EngineResult) => !result.events.some((event) => event.type === 'COMMAND_REJECTED');
  const checkpointWorthy = (result: EngineResult) => result.events.some((event) => {
    if (event.type === 'DECISION_PRESENTED'
      || event.type === 'DECISION_RESOLVED'
      || event.type === 'STORY_DECISION_PRESENTED'
      || event.type === 'STORY_DECISION_RESOLVED'
      || event.type === 'PACK_OPENED'
      || event.type === 'READINESS_MILESTONE_REWARDED'
      || event.type === 'PROVISION_DOCKETED'
      || event.type === 'WEEK_RESOLVED'
      || event.type === 'SESSION_CONCLUDED') return true;
    if (event.type !== 'WORK_SUBMITTED') return false;
    const work = result.state.activeWork.find((candidate) => candidate.id === event.workId);
    return work !== undefined && Object.values(work.paidCost).some((amount) => (amount ?? 0) > 0);
  });

  const loadProfile = (nextStorage: SaveStorage) => {
    const loadedProfile = loadPlayerProfile(nextStorage);
    if (loadedProfile.kind === 'loaded' || loadedProfile.kind === 'empty') {
      profile = loadedProfile.profile;
    } else if (!persistenceNotice) {
      persistenceNotice = loadedProfile.message;
    }
    return loadedProfile;
  };

  const inspectStoredBytes = (nextStorage: SaveStorage):
    | { current: string | undefined; replaced: string | undefined }
    | { error: string } => {
    try {
      return {
        current: nextStorage.getItem(SAVE_KEYS.current) ?? undefined,
        replaced: nextStorage.getItem(SAVE_KEYS.replaced) ?? undefined,
      };
    } catch (error) {
      const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
      return { error: `Browser storage failed while reading Session checkpoints${detail}. The in-memory Session was left unchanged.` };
    }
  };

  const resume = (nextStorage: SaveStorage): LoadResult => {
    storage = undefined;
    const inspected = inspectStoredBytes(nextStorage);
    if ('error' in inspected) {
      persistenceNotice = inspected.error;
      publish({ state: { ...state }, events: [] });
      return { kind: 'storage-unavailable', message: inspected.error };
    }
    const loaded = loadCheckpoint(nextStorage, scenario);
    if (loaded.kind === 'loaded' || loaded.kind === 'recovered-previous' || loaded.kind === 'empty') {
      storage = nextStorage;
    }
    if (loaded.kind === 'loaded' || loaded.kind === 'recovered-previous') state = loaded.state;
    currentSaveBytes = inspected.current;
    preservedSaveBytes = inspected.replaced;
    persistenceNotice = loaded.kind === 'recovered-previous'
      || loaded.kind === 'storage-unavailable'
      || loaded.kind === 'incompatible-version'
      || loaded.kind === 'wrong-snapshot'
      || loaded.kind === 'corrupt'
      ? loaded.message
      : undefined;
    const loadedProfile = loadProfile(nextStorage);
    const shouldPublish = loaded.kind !== 'empty'
      || loadedProfile.kind === 'corrupt'
      || loadedProfile.kind === 'storage-unavailable';
    if (shouldPublish) {
      if (loaded.kind !== 'loaded' && loaded.kind !== 'recovered-previous') state = { ...state };
      publish({ state, events: [] });
    }
    return loaded;
  };

  return {
    getState: () => state,
    getScenario: () => scenario,
    getPlayerProfile: () => profile,
    getPersistenceNotice: () => persistenceNotice,
    dispatch(command) {
      // Time commands and pointer commands share this single ordered boundary.
      // In particular, a recovered snapshot cannot have a second browser timer
      // racing the canonical weekly transition.
      const result = executeCommand(state, command, services);
      state = result.state;
      if (storage && accepted(result)) {
        if (checkpointWorthy(result)) {
          const saved = saveCheckpoint(storage, state, scenario);
          persistenceNotice = saved.kind === 'saved' ? undefined : saved.message;
          if (saved.kind === 'saved') currentSaveBytes = saved.bytes;
        }
        const discoveries = result.events.flatMap((event) => event.type === 'PATTERN_DISCOVERED' ? [event.patternId] : []);
        if (discoveries.length > 0) {
          const savedProfile = savePlayerProfile(storage, discoveries);
          profile = savedProfile.profile;
          if (savedProfile.kind === 'storage-unavailable') persistenceNotice = savedProfile.message;
        }
        if (result.events.some((event) => event.type === 'SESSION_CONCLUDED')) {
          const merged = mergeLifetimeDiscoveries(profile, state);
          const savedProfile = savePlayerProfile(storage, merged.lifetimeDiscoveredPatternIds);
          profile = savedProfile.profile;
          if (savedProfile.kind === 'storage-unavailable') persistenceNotice = savedProfile.message;
        }
      }
      publish(result);
      return result;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    probe(nextStorage) {
      storage = undefined;
      const inspected = inspectStoredBytes(nextStorage);
      if ('error' in inspected) {
        persistenceNotice = inspected.error;
        publish({ state: { ...state }, events: [] });
        return { kind: 'storage-unavailable', message: inspected.error };
      }
      const result = loadCheckpoint(nextStorage, scenario);
      currentSaveBytes = inspected.current;
      preservedSaveBytes = inspected.replaced;
      persistenceNotice = ['recovered-previous', 'storage-unavailable', 'incompatible-version', 'wrong-snapshot', 'corrupt'].includes(result.kind)
        ? result.message
        : undefined;
      return result;
    },
    resume,
    recover(nextStorage) {
      return resume(nextStorage);
    },
    startNew(nextState, nextStorage) {
      storage = undefined;
      const opening = nextState.mode === 'session'
        && nextState.runStatus === 'active'
        && nextState.storyHistory.length === 0
        ? executeCommand(nextState, { type: 'DRAW_STORY_EVENT' }, services)
        : { state: nextState, events: [] };
      state = opening.state;
      persistenceNotice = undefined;
      loadProfile(nextStorage);
      try {
        const current = nextStorage.getItem(SAVE_KEYS.current);
        if (current !== null) {
          preservedSaveBytes = current;
          nextStorage.setItem(SAVE_KEYS.replaced, current);
        }
        nextStorage.removeItem(SAVE_KEYS.previousWeek);
        if (nextStorage.getItem(SAVE_KEYS.previousWeek) !== null) {
          throw new Error('the prior-run fallback could not be cleared');
        }
      } catch (error) {
        const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
        persistenceNotice = `The new Session is active, but the prior checkpoint and its recovery fallback could not be safely separated${detail}. The current checkpoint was not overwritten; keep this tab open.`;
        publish({ state, events: opening.events });
        return { kind: 'storage-unavailable', message: persistenceNotice };
      }
      const saved = saveCheckpoint(nextStorage, state, scenario);
      if (saved.kind === 'saved') {
        storage = nextStorage;
        currentSaveBytes = saved.bytes;
        persistenceNotice = preservedSaveBytes
          ? 'New Session started. The prior checkpoint remains available for local export.'
          : undefined;
        publish({ state, events: opening.events });
        return { kind: 'started', message: 'New Session started.' };
      }
      persistenceNotice = saved.message;
      publish({ state, events: opening.events });
      return { kind: 'storage-unavailable', message: saved.message };
    },
    getPreservedSaveBytes() {
      return preservedSaveBytes;
    },
    getCurrentSaveBytes() {
      return currentSaveBytes;
    },
    setReducedMotion(value) {
      if (state.settings.reducedMotion === value) return;
      state = { ...state, settings: { ...state.settings, reducedMotion: value } };
      const result: EngineResult = { state, events: [] };
      publish(result);
    },
  };
}
