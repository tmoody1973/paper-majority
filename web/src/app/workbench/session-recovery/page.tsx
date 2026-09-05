import { notFound } from 'next/navigation';

import { GameShell } from '@/components/GameShell';
import { createRun } from '@/domain/initialState';
import { obligationOccurrence } from '@/domain/obligations';
import type { CardInstance } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

/** A development-only first-week fixture for the Task 7 persistence proof. */
export default function SessionRecoveryWorkbenchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const scenario = structuredClone(sessionScenario);
  scenario.patterns = scenario.patterns.map((pattern) => ({
    ...pattern,
    durationMs: [
      'pattern-summarize-evidence',
      'pattern-draft-policy',
      'pattern-coalition-outreach',
    ].includes(pattern.id) ? 700 : pattern.durationMs,
  }));
  scenario.obligationDefinitions = scenario.obligationDefinitions.map((definition) => ({
    ...definition,
    due: { week: 1, offsetMs: 10_000 },
  }));
  const base = createRun({ ...sessionSetup, scenario, mode: 'session' });
  const source: CardInstance = {
    id: `card-${base.cardSeq + 1}`,
    definitionId: 'constituency-renter-concern',
    stackId: `stack-filed-${base.cardSeq + 1}`,
    x: 0,
    y: 0,
    remainingMs: 0,
    status: 'idle',
    form: 'raw',
    location: 'filed',
    sourceDefinitionIds: [],
  };
  const obligation = obligationOccurrence(scenario.obligationDefinitions[0], 'workbench-first-week');
  const initialState = {
    ...base,
    weekLengthMs: 10_000,
    cards: [...base.cards, source],
    cardSeq: base.cardSeq + 1,
    obligations: [obligation],
  };

  return <GameShell scenario={scenario} initialState={initialState} />;
}
