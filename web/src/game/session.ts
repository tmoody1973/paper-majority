import { executeCommand, type EngineResult, type EngineServices } from '@/domain/engine';
import type { GameCommand } from '@/domain/commands';
import type { ScenarioDefinition, TermState } from '@/domain/types';

export interface GameSession {
  getState(): TermState;
  getScenario(): ScenarioDefinition;
  dispatch(command: GameCommand): EngineResult;
  subscribe(listener: (result: EngineResult) => void): () => void;
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

  return {
    getState: () => state,
    getScenario: () => scenario,
    dispatch(command) {
      const result = executeCommand(state, command, services);
      state = result.state;
      for (const listener of [...listeners]) listener(result);
      return result;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setReducedMotion(value) {
      if (state.settings.reducedMotion === value) return;
      state = { ...state, settings: { ...state.settings, reducedMotion: value } };
      const result: EngineResult = { state, events: [] };
      for (const listener of [...listeners]) listener(result);
    },
  };
}
