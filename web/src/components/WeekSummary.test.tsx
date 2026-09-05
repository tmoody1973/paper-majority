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
    expect(screen.getAllByText('Answer renter concern')).toHaveLength(2);
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

  it('labels an optional deadline and previews a decline without a trust penalty', () => {
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const optional = {
      ...obligationOccurrence(sessionScenario.obligationDefinitions[0], 'optional'),
      mandatory: false,
      rewardCapital: 2,
      trustPenalty: 7,
    };
    const state = {
      ...base,
      week: 2,
      weekPhase: 'boundary' as const,
      elapsedMs: base.weekLengthMs,
      simulationMs: base.weekLengthMs * 2,
      obligations: [optional],
    };
    render(<WeekSummary session={createGameSession(state, sessionScenario)} state={state} />);
    expect(screen.getByText(/Optional · Reward \+2 Political Capital/)).toHaveTextContent('No trust penalty if declined');
    expect(screen.getByTestId('week-boundary-preview')).toHaveTextContent('will be declined');
    expect(screen.getByTestId('week-boundary-preview')).not.toHaveTextContent('District Trust');
  });

  it('observes the Week 1 agenda from events, limits prominent pressures, and keeps every commitment accessible', () => {
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const definition = sessionScenario.obligationDefinitions[0];
    const filedSource = base.cards[0]!;
    const obligations = Array.from({ length: 5 }, (_, index) => ({
      ...obligationOccurrence(definition, `complete-view-${index}`, index === 4
        ? { sourceCardInstanceId: filedSource.id }
        : undefined),
      due: { week: index === 4 ? 3 : 1, offsetMs: 10_000 + index },
      mandatory: index !== 4,
      status: index === 4 ? 'fulfilled' as const : 'open' as const,
    }));
    const state = {
      ...base,
      cards: base.cards.map((card) => card.id === filedSource.id
        ? { ...card, location: 'filed' as const }
        : card),
      obligations,
      eventLog: [
        ...base.eventLog,
        { type: 'STORY_DECISION_RESOLVED' as const, decisionId: 'story:1', storyEventId: 'story-1', choiceId: 'choice-1', occurrenceId: 'story-1:week:1:draw:1' },
        { type: 'WORK_SUBMITTED' as const, workId: 'work-1', cardIds: [], completesAtSimulationMs: 1 },
        { type: 'PROVISION_DOCKETED' as const, cardId: 'draft-1', provisionId: 'policy-housing-choice-voucher', revision: 1 },
      ],
    };
    render(<WeekSummary session={createGameSession(state, sessionScenario)} state={state} />);

    expect(screen.getByRole('list', { name: 'Open obligations' }).children).toHaveLength(3);
    expect(screen.getByTestId('week-one-agenda').querySelectorAll('[data-observed="true"]')).toHaveLength(3);
    const complete = screen.getByTestId('all-commitments');
    expect(complete).toHaveTextContent('All commitments and deadlines (5)');
    expect(screen.getByRole('list', { name: 'All commitments and deadlines' }).children).toHaveLength(5);
    expect(complete).toHaveTextContent('fulfilled · Optional');
    expect(complete).toHaveTextContent('Due week 3');
    expect(complete).toHaveTextContent('Source card: filed');
    expect(complete).toHaveTextContent('no trust penalty if declined');
  });
});
