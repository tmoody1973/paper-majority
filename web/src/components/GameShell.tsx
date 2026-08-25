'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AccessibleCardControls } from '@/components/AccessibleCardControls';
import { CardInspector } from '@/components/CardInspector';
import { Hud } from '@/components/Hud';
import { OfficeBrief } from '@/components/OfficeBrief';
import { PlainEnglishKey } from '@/components/PlainEnglishKey';
import { StaffHandbook } from '@/components/StaffHandbook';
import { createFixtureState, getFixtureScenario, type FixtureId } from '@/content/fixtures/loadFixture';
import { describeCard } from '@/domain/cardDetail';
import { buildHandbook } from '@/domain/selectors';
import type { TermState } from '@/domain/types';
import { createGameSession, type GameSession } from '@/game/session';

// Phaser only exists in the browser. `ssr: false` is legal here because this file
// is a Client Component.
const GameCanvas = dynamic(() => import('@/game/GameCanvas'), {
  ssr: false,
  loading: () => <p className="game-canvas__loading">Setting out the desk…</p>,
});

declare global {
  interface Window {
    __congressGameTestApi?: {
      getState: () => TermState;
      dispatch: GameSession['dispatch'];
      getCardRect: (cardId: string) => { x: number; y: number; width: number; height: number } | undefined;
      getZoom: () => number;
    };
  }
}

export interface GameShellProps {
  fixture?: FixtureId;
}

export function GameShell({ fixture = 'interaction-spike' }: GameShellProps) {
  const scenario = useMemo(() => getFixtureScenario(), []);
  const session = useMemo<GameSession>(
    () => createGameSession(createFixtureState(fixture), scenario),
    [fixture, scenario],
  );

  const [state, setState] = useState<TermState>(() => session.getState());
  const [lastResult, setLastResult] = useState<string>('');
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>();
  const [hoveredCardId, setHoveredCardId] = useState<string | undefined>();

  useEffect(() => session.subscribe((result) => setState(result.state)), [session]);

  // Honour the operating-system preference before the player touches anything.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    session.setReducedMotion(query.matches);
  }, [session]);

  // A development-only read/dispatch adapter for the E2E suite. It goes through the
  // same session as every other caller, so it is not a second mutation path.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    window.__congressGameTestApi = {
      getState: () => session.getState(),
      dispatch: (command) => session.dispatch(command),
      getCardRect: (cardId) => {
        const card = session.getState().cards.find((candidate) => candidate.id === cardId);
        if (!card) return undefined;
        return { x: card.x, y: card.y, width: 180, height: 252 };
      },
      getZoom: () =>
        (window as unknown as { __congressGameCamera?: { getZoom: () => number } })
          .__congressGameCamera?.getZoom() ?? 1,
    };
    return () => {
      delete window.__congressGameTestApi;
    };
  }, [session]);

  const onResult = useCallback((phrase: string) => setLastResult(phrase), []);
  const onSelect = useCallback((cardId: string) => setSelectedCardId(cardId), []);
  const onHover = useCallback((cardId: string | undefined) => setHoveredCardId(cardId), []);

  // A tap pins a card open; hovering only previews. A card consumed by a
  // transformation simply stops resolving, and the panel falls back.
  const shownCardId = selectedCardId ?? hoveredCardId;
  const detail = shownCardId ? describeCard(state, scenario, shownCardId) : undefined;

  const handbook = useMemo(() => buildHandbook(state, scenario), [state, scenario]);

  return (
    <main className="shell">
      <Hud
        state={state}
        lastResult={lastResult}
        handbookOpen={handbookOpen}
        onTogglePause={() => session.dispatch({ type: 'SET_PAUSED', paused: !state.paused })}
        onToggleHandbook={() => setHandbookOpen((open) => !open)}
        onToggleReducedMotion={() => session.setReducedMotion(!state.settings.reducedMotion)}
      />

      <div className="shell__body">
        <section
          className="shell__desk"
          data-testid="game-canvas-region"
          aria-label="Congressional desk"
        >
          <GameCanvas
            session={session}
            onResult={onResult}
            onSelect={onSelect}
            onHover={onHover}
          />
        </section>

        <aside className="shell__side">
          {detail ? (
            <CardInspector detail={detail} onClose={() => setSelectedCardId(undefined)} />
          ) : (
            <OfficeBrief state={state} scenario={scenario} />
          )}
          {handbookOpen ? (
            <StaffHandbook view={handbook} />
          ) : (
            <AccessibleCardControls session={session} state={state} onInspect={onSelect} />
          )}
          <PlainEnglishKey />
        </aside>
      </div>
    </main>
  );
}
