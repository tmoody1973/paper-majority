import { executeCommand, type EngineResult, type EngineServices } from '@/domain/engine';
import type { GameCommand } from '@/domain/commands';
import type { PlayerProfile, ScenarioDefinition, TermState } from '@/domain/types';
import {
  loadPlayerProfile,
  savePlayerProfile,
  emptyPlayerProfile,
} from '@/persistence/playerProfile';
import {
  loadCheckpoint,
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
  recover(storage: SaveStorage): LoadResult;
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

  const publish = (result: EngineResult) => {
    for (const listener of [...listeners]) listener(result);
  };

  const accepted = (result: EngineResult) => !result.events.some((event) => event.type === 'COMMAND_REJECTED');
  const checkpointWorthy = (result: EngineResult) => result.events.some((event) => {
    if (event.type === 'DECISION_PRESENTED'
      || event.type === 'DECISION_RESOLVED'
      || event.type === 'PROVISION_DOCKETED'
      || event.type === 'WEEK_RESOLVED'
      || event.type === 'SESSION_CONCLUDED') return true;
    if (event.type !== 'WORK_SUBMITTED') return false;
    const work = result.state.activeWork.find((candidate) => candidate.id === event.workId);
    return work !== undefined && Object.values(work.paidCost).some((amount) => (amount ?? 0) > 0);
  });

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
        }
        const discoveries = result.events.flatMap((event) => event.type === 'PATTERN_DISCOVERED' ? [event.patternId] : []);
        if (discoveries.length > 0) {
          const savedProfile = savePlayerProfile(storage, discoveries);
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
    recover(nextStorage) {
      const loaded = loadCheckpoint(nextStorage, scenario);
      // An unknown or mismatched save stays untouched until the player explicitly
      // resolves it in a future save-management flow.
      if (!['incompatible-version', 'wrong-snapshot', 'corrupt'].includes(loaded.kind)) {
        storage = nextStorage;
      }
      if (loaded.kind === 'loaded' || loaded.kind === 'recovered-previous') {
        state = loaded.state;
      }
      persistenceNotice = loaded.kind === 'recovered-previous'
        || loaded.kind === 'storage-unavailable'
        || loaded.kind === 'incompatible-version'
        || loaded.kind === 'wrong-snapshot'
        || loaded.kind === 'corrupt'
        ? loaded.message
        : undefined;
      const loadedProfile = loadPlayerProfile(nextStorage);
      if (loadedProfile.kind === 'loaded' || loadedProfile.kind === 'empty') {
        profile = loadedProfile.profile;
      } else if (!persistenceNotice) {
        persistenceNotice = loadedProfile.message;
      }
      // An empty first-run probe changes no canonical or presentational value.
      // Avoid forcing Phaser to resync its card views during initial input setup.
      const shouldPublish = loaded.kind !== 'empty'
        || loadedProfile.kind === 'corrupt'
        || loadedProfile.kind === 'storage-unavailable';
      if (shouldPublish) {
        if (loaded.kind !== 'loaded' && loaded.kind !== 'recovered-previous') state = { ...state };
        publish({ state, events: [] });
      }
      return loaded;
    },
    setReducedMotion(value) {
      if (state.settings.reducedMotion === value) return;
      state = { ...state, settings: { ...state.settings, reducedMotion: value } };
      const result: EngineResult = { state, events: [] };
      publish(result);
    },
  };
}
