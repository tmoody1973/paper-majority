import type { GameEvent } from '@/domain/events';

type Listener = (events: GameEvent[]) => void;

/**
 * A tiny fan-out used by Phaser to react to engine events without importing React,
 * and by React to react to engine events without importing Phaser.
 */
export function createGameEventBus() {
  const listeners = new Set<Listener>();

  return {
    emit(events: GameEvent[]): void {
      if (events.length === 0) return;
      for (const listener of [...listeners]) listener(events);
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear(): void {
      listeners.clear();
    },
  };
}

export type GameEventBus = ReturnType<typeof createGameEventBus>;
