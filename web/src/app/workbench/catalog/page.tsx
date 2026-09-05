import { notFound } from 'next/navigation';

import { GameShell } from '@/components/GameShell';
import { getCandidateScenario } from '@/content/loadScenario';
import { createRun } from '@/domain/runSetup';
import { drawStoryEvent } from '@/domain/storyDirector';

export default function CandidateCatalogWorkbenchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const scenario = getCandidateScenario();
  const run = createRun({
    scenario,
    districtId: 'GA-05',
    party: 'democratic',
    values: ['Tenant Stability', 'Housing Supply'],
    mode: 'session',
    seed: 417,
  });
  const initialState = drawStoryEvent({ ...run, week: 2 }, scenario).state;
  return <GameShell scenario={scenario} initialState={initialState} />;
}
