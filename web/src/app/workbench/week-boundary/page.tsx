import { notFound } from 'next/navigation';

import { GameShell } from '@/components/GameShell';
import { createRun } from '@/domain/initialState';
import { obligationOccurrence } from '@/domain/obligations';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

export default function WeekBoundaryWorkbenchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const scenario = structuredClone(sessionScenario);
  scenario.patterns = scenario.patterns.map((pattern) => ({
    ...pattern,
    durationMs: pattern.id === 'pattern-summarize-evidence'
      ? 1_200
      : pattern.id === 'pattern-coalition-outreach' ? 6_000 : pattern.durationMs,
  }));
  scenario.obligationDefinitions = scenario.obligationDefinitions.map((definition) => ({
    ...definition,
    due: { week: 1, offsetMs: 6_000 },
  }));
  const base = createRun({ ...sessionSetup, scenario, mode: 'session' });
  const obligation = obligationOccurrence(scenario.obligationDefinitions[0], 'workbench');
  return (
    <GameShell
      scenario={scenario}
      initialState={{ ...base, weekLengthMs: 6_000, obligations: [obligation] }}
    />
  );
}
