'use client';

import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

import type { GameSession } from '@/game/session';

export interface GameCanvasProps {
  session: GameSession;
  onResult: (phrase: string) => void;
  onSelect: (cardId: string) => void;
}

/**
 * The only place Phaser is constructed.
 *
 * Phaser is imported lazily inside the effect so the module never runs during
 * server rendering or in a jsdom unit test, and the game is destroyed on unmount so
 * a fast-refresh cycle cannot leave two canvases fighting for the same parent.
 */
export default function GameCanvas({ session, onResult, onSelect }: GameCanvasProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    let game: Phaser.Game | undefined;
    let cancelled = false;

    void (async () => {
      const { createGame } = await import('@/game/createGame');
      if (cancelled || !parentRef.current) return;
      game = createGame(parentRef.current, { session, onResult, onSelect });
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
      game = undefined;
    };
  }, [session, onResult, onSelect]);

  return (
    <div
      ref={parentRef}
      data-testid="game-canvas"
      aria-label="Congressional desk"
      className="game-canvas"
    />
  );
}
