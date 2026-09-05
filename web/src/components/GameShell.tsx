'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { AccessibleCardControls } from '@/components/AccessibleCardControls';
import { BillDocket } from '@/components/BillDocket';
import { CardInspector } from '@/components/CardInspector';
import { DecisionModal } from '@/components/DecisionModal';
import { Hud } from '@/components/Hud';
import { OfficeBrief } from '@/components/OfficeBrief';
import { PlainEnglishKey } from '@/components/PlainEnglishKey';
import { StaffHandbook } from '@/components/StaffHandbook';
import { WorkMat } from '@/components/WorkMat';
import { WeekSummary } from '@/components/WeekSummary';
import { createFixtureState, getFixtureScenario, type FixtureId } from '@/content/fixtures/loadFixture';
import { describeCard } from '@/domain/cardDetail';
import { buildHandbook, nextPendingDecision } from '@/domain/selectors';
import type { ScenarioDefinition, TermState } from '@/domain/types';
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
  scenario?: ScenarioDefinition;
  initialState?: TermState;
}

export function GameShell({ fixture = 'interaction-spike', scenario: providedScenario, initialState }: GameShellProps) {
  const scenario = useMemo(() => providedScenario ?? getFixtureScenario(), [providedScenario]);
  const session = useMemo<GameSession>(
    () => createGameSession(initialState ?? createFixtureState(fixture), scenario),
    [fixture, initialState, scenario],
  );

  const subscribe = useCallback(
    (listener: () => void) => session.subscribe(() => listener()),
    [session],
  );
  const state = useSyncExternalStore(subscribe, session.getState, session.getState);
  const [lastResult, setLastResult] = useState<string>('');
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>();
  const [hoveredCardId, setHoveredCardId] = useState<string | undefined>();
  const [workMatCardIds, setWorkMatCardIds] = useState<string[]>([]);
  const [dismissedDecisionId, setDismissedDecisionId] = useState<string | undefined>();
  const decisionTriggerRef = useRef<HTMLButtonElement>(null);

  // Recover first. A saved reduced-motion choice is canonical setup and must not
  // be silently rewritten by the operating-system preference during hydration.
  useEffect(() => {
    if (session.getState().mode === 'interaction-spike') {
      if (typeof window.matchMedia === 'function') {
        session.setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
      return;
    }
    let recovery: ReturnType<GameSession['recover']>;
    try {
      recovery = session.recover(window.localStorage);
    } catch (error) {
      // Accessing localStorage itself can be denied before it can satisfy the
      // SaveStorage interface. Keep the authored in-memory run intact.
      const denied = () => { throw error; };
      recovery = session.recover({ getItem: denied, setItem: denied, removeItem: denied });
    }
    if (recovery.kind !== 'empty' || initialState !== undefined || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    session.setReducedMotion(query.matches);
  }, [initialState, session]);

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
  const onSelect = useCallback((cardId: string) => {
    setSelectedCardId(cardId);
    if (session.getState().mode === 'interaction-spike') return;
    setWorkMatCardIds((ids) => ids.includes(cardId)
      ? ids.filter((id) => id !== cardId)
      : ids.length < 4 ? [...ids, cardId] : ids);
  }, [session]);
  const onHover = useCallback((cardId: string | undefined) => setHoveredCardId(cardId), []);
  const onInspect = useCallback((cardId: string) => setSelectedCardId(cardId), []);

  // A tap pins a card open; hovering only previews. A card consumed by a
  // transformation simply stops resolving, and the panel falls back.
  const shownCardId = selectedCardId ?? hoveredCardId;
  const detail = shownCardId ? describeCard(state, scenario, shownCardId) : undefined;

  const handbook = useMemo(() => buildHandbook(state, scenario), [state, scenario]);
  const validWorkMatCardIds = workMatCardIds.filter((id) =>
    state.cards.some((card) => card.id === id && card.location === 'desk'),
  );
  const pendingDecision = nextPendingDecision(state);
  const decisionOpen = Boolean(pendingDecision && dismissedDecisionId !== pendingDecision.id);
  const persistenceNotice = session.getPersistenceNotice();

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
      <div className="shell__actions">
        <button
          ref={decisionTriggerRef}
          type="button"
          data-testid="decision-trigger"
          aria-haspopup="dialog"
          aria-disabled={!pendingDecision}
          onClick={() => {
            if (pendingDecision) setDismissedDecisionId(undefined);
          }}
        >
          {pendingDecision ? 'Review pending coalition decision' : 'No pending coalition decisions'}
        </button>
      </div>
      {persistenceNotice && (
        <p className="shell__save-warning" data-testid="session-save-warning" role="status">
          {persistenceNotice}
        </p>
      )}
      {pendingDecision && (
        <DecisionModal
          key={pendingDecision.id}
          session={session}
          state={state}
          open={decisionOpen}
          onOpenChange={(open) => setDismissedDecisionId(open ? undefined : pendingDecision.id)}
          returnFocusRef={decisionTriggerRef}
          onResult={onResult}
        />
      )}

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
          {state.mode !== 'interaction-spike' && (
            <>
              <WeekSummary session={session} state={state} onResult={onResult} />
              <BillDocket session={session} state={state} onResult={onResult} />
              <WorkMat
                session={session}
                state={state}
                selectedCardIds={validWorkMatCardIds}
                onSelectedCardIdsChange={setWorkMatCardIds}
                onResult={onResult}
              />
            </>
          )}
          {detail ? (
            <CardInspector detail={detail} onClose={() => setSelectedCardId(undefined)} />
          ) : (
            <OfficeBrief state={state} scenario={scenario} />
          )}
          {handbookOpen ? (
            <StaffHandbook view={handbook} />
          ) : (
            <AccessibleCardControls session={session} state={state} onInspect={onInspect} />
          )}
          <PlainEnglishKey />
        </aside>
      </div>
    </main>
  );
}
