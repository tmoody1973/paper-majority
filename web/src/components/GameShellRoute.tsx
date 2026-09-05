'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const setupTransition = useRef(0);

  useEffect(() => {
    let active = true;
    const expectedTransition = setupTransition.current;
    queueMicrotask(() => {
      if (active && setupTransition.current === expectedTransition) {
        setRecovery(session.probe(browserStorage()));
      }
    });
    return () => { active = false; };
  }, [session]);

  const onResume = () => {
    setupTransition.current += 1;
    const loaded = session.resume(browserStorage());
    if (loaded.kind === 'loaded' || loaded.kind === 'recovered-previous') {
      setStarted(true);
    }
  };
  const onStart = (choice: SessionSetupChoice) => {
    setupTransition.current += 1;
    session.startNew(createRun({ scenario, mode: 'session', ...choice }), browserStorage());
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
        currentSaveBytes={session.getCurrentSaveBytes()}
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
        setupTransition.current += 1;
        setRecovery(session.probe(browserStorage()));
        setStarted(false);
      }}
    />
  );
}
