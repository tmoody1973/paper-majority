'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { GameShell } from '@/components/GameShell';
import { SessionSetup, type SessionSetupChoice } from '@/components/SessionSetup';
import { getCandidateScenario } from '@/content/loadScenario';
import { createRun } from '@/domain/runSetup';
import { createGameSession } from '@/game/session';
import type { LoadResult, SaveStorage } from '@/persistence/saveRepository';

function browserStorage(): SaveStorage {
  try {
    return window.localStorage;
  } catch (error) {
    const denied = () => { throw error; };
    return { getItem: denied, setItem: denied, removeItem: denied };
  }
}

/**
 * Reads `?fixture=` and hands the shell a fixture id.
 *
 * `useSearchParams` needs a Suspense boundary above it in the App Router, which
 * `page.tsx` provides.
 */
export function GameShellRoute() {
  const params = useSearchParams();
  const requested = params.get('fixture');
  const legacyFixture = requested === 'interaction-spike' || requested === 'desk-foundation';

  if (legacyFixture) return <GameShell key={requested} fixture="interaction-spike" />;
  return <NormalSession />;
}

function NormalSession() {
  const scenario = useMemo(() => getCandidateScenario(), []);
  const initial = useMemo(() => createRun({
    scenario,
    mode: 'session',
    seed: 20260905,
    districtId: scenario.districts[0]!.id,
    party: 'democratic',
    values: ['Housing Supply', 'Tenant Stability'],
  }), [scenario]);
  const session = useMemo(() => createGameSession(initial, scenario), [initial, scenario]);
  const [started, setStarted] = useState(false);
  const [recovery, setRecovery] = useState<LoadResult>();

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setRecovery(session.probe(browserStorage()));
    });
    return () => { active = false; };
  }, [session]);

  const dispatchOpeningStory = () => {
    if (session.getState().storyHistory.length === 0 && session.getState().runStatus === 'active') {
      session.dispatch({ type: 'DRAW_STORY_EVENT' });
    }
  };
  const onResume = () => {
    const loaded = session.resume(browserStorage());
    if (loaded.kind === 'loaded' || loaded.kind === 'recovered-previous') {
      dispatchOpeningStory();
      setStarted(true);
    }
  };
  const onStart = (choice: SessionSetupChoice) => {
    session.startNew(createRun({ scenario, mode: 'session', ...choice }), browserStorage());
    dispatchOpeningStory();
    setStarted(true);
  };

  if (!started) {
    const canResume = recovery?.kind === 'loaded' || recovery?.kind === 'recovered-previous';
    const recoveryMessage = recovery && !['loaded', 'empty'].includes(recovery.kind)
      ? recovery.message
      : undefined;
    return (
      <SessionSetup
        scenario={scenario}
        canResume={canResume}
        recoveryMessage={recoveryMessage}
        preservedSaveBytes={session.getPreservedSaveBytes()}
        onResume={onResume}
        onStart={onStart}
      />
    );
  }

  return (
    <GameShell
      scenario={scenario}
      session={session}
      onRestart={() => {
        setRecovery(session.probe(browserStorage()));
        setStarted(false);
      }}
    />
  );
}
