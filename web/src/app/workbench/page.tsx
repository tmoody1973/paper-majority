import { notFound } from 'next/navigation';

import { GameShell } from '@/components/GameShell';
import { createRun } from '@/domain/initialState';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

export default function SessionWorkbenchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const scenario = structuredClone(sessionScenario);
  scenario.patterns = scenario.patterns.map((pattern) => ({
    ...pattern,
    durationMs: pattern.id === 'pattern-summarize-evidence' ? 1_200 : 1_800,
  }));
  scenario.tacticExpansions = scenario.tacticExpansions.map((expansion) => ({
    ...expansion,
    studyDurationMs: 1_200,
  }));
  const initialState = createRun({ ...sessionSetup, scenario, mode: 'session' });

  return <GameShell scenario={scenario} initialState={initialState} />;
}
