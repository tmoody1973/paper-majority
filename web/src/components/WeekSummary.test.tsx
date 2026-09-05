import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { WeekSummary } from '@/components/WeekSummary';
import { createRun } from '@/domain/initialState';
import { obligationOccurrence } from '@/domain/obligations';
import { createGameSession } from '@/game/session';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

describe('WeekSummary', () => {
  it('shows due source, preview effects and carrying work before applying a boundary', () => {
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const state = {
      ...base,
      week: 2,
      weekPhase: 'boundary' as const,
      elapsedMs: base.weekLengthMs,
      simulationMs: base.weekLengthMs * 2,
      obligations: [obligationOccurrence(sessionScenario.obligationDefinitions[0])],
      activeWork: [{
        id: 'work-carrying', kind: 'study' as const, cardIds: [], staffCardIds: [], paidCost: {},
        completesAtSimulationMs: base.weekLengthMs * 2 + 2_000, effectiveRuleVersion: 'test',
        consumedCardIds: [], returnedCardIds: [], expansionIds: [], effectiveExpansions: [],
      }],
    };
    const session = createGameSession(state, sessionScenario);
    render(<WeekSummary session={session} state={state} />);
    expect(screen.getByText('Answer renter concern')).toBeInTheDocument();
    expect(screen.getByText(/Affects Renter Concern/)).toBeInTheDocument();
    expect(screen.getByTestId('week-boundary-preview')).toHaveTextContent('District Trust -5');
    expect(screen.getByTestId('week-boundary-preview')).toHaveTextContent('work-carrying');
  });

  it('advances a reviewed boundary with the visible control', async () => {
    const user = userEvent.setup();
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const state = { ...base, weekPhase: 'boundary' as const, elapsedMs: base.weekLengthMs };
    const session = createGameSession(state, sessionScenario);
    const { rerender } = render(<WeekSummary session={session} state={state} />);
    await user.click(screen.getByTestId('week-confirm'));
    rerender(<WeekSummary session={session} state={session.getState()} />);
    expect(session.getState().week).toBe(2);
    expect(screen.getByRole('heading', { name: 'Deadlines' })).toBeInTheDocument();
  });
});
