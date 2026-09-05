import { notFound } from 'next/navigation';

import { GameShell } from '@/components/GameShell';
import { createRun } from '@/domain/initialState';
import type { CardInstance } from '@/domain/types';
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
  const baseState = createRun({ ...sessionSetup, scenario, mode: 'session' });
  const tactic: CardInstance = {
    id: 'card-workbench-tactic',
    definitionId: 'tactic-bipartisan-working-group',
    stackId: 'stack-workbench-tactic',
    x: 920,
    y: 610,
    remainingMs: 0,
    status: 'idle',
    form: 'raw',
    location: 'desk',
    sourceDefinitionIds: [],
  };
  const concern: CardInstance = {
    id: 'card-workbench-renter-concern',
    definitionId: 'constituency-renter-concern',
    stackId: 'stack-workbench-renter-concern',
    x: 1_020,
    y: 360,
    remainingMs: 0,
    status: 'idle',
    form: 'raw',
    location: 'desk',
    sourceDefinitionIds: [],
  };
  const initialState = {
    ...baseState,
    cards: [...baseState.cards, tactic, concern],
    stacks: [
      ...baseState.stacks,
      { id: tactic.stackId, cardIds: [tactic.id] },
      { id: concern.stackId, cardIds: [concern.id] },
    ],
  };

  return <GameShell scenario={scenario} initialState={initialState} recoverOnMount={false} />;
}
