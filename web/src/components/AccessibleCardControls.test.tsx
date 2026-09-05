import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AccessibleCardControls } from '@/components/AccessibleCardControls';
import { createFixtureState, getFixtureScenario } from '@/content/fixtures/loadFixture';
import { createRun } from '@/domain/initialState';
import { obligationOccurrence } from '@/domain/obligations';
import { createGameSession, type GameSession } from '@/game/session';
import type { TermState } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

/**
 * The keyboard panel is the accessible equivalent of the drag, so it has to refuse
 * the same things the desk refuses — and say why, which the desk cannot.
 */
function setup() {
  const session = createGameSession(
    createFixtureState('interaction-spike'),
    getFixtureScenario(),
  );
  const state = session.getState();
  const idOf = (definitionId: string) =>
    state.cards.find((card) => card.definitionId === definitionId)!.id;
  return { session, state, idOf };
}

async function choose(testId: string, value: string) {
  await userEvent.selectOptions(screen.getByTestId(testId), value);
}

function renderPanel(session: GameSession, state: TermState) {
  return render(<AccessibleCardControls session={session} state={state} />);
}

describe('AccessibleCardControls', () => {
  it('keeps Study Tactic disabled for a pair that is not a Tactic study', async () => {
    const { session, state, idOf } = setup();
    renderPanel(session, state);

    await choose('controls-source', idOf('staff-policy-aide'));
    await choose('controls-target', idOf('evidence-rent-burden-report'));

    // Staff + Evidence is ordinary work, not studying.
    expect(screen.getByTestId('controls-study')).toBeDisabled();
    expect(screen.getByTestId('controls-combine')).toBeEnabled();
  });

  it('enables Study Tactic for an eligible staffer and a Tactic', async () => {
    const { session, state, idOf } = setup();
    renderPanel(session, state);

    await choose('controls-source', idOf('staff-policy-aide'));
    await choose('controls-target', idOf('tactic-bipartisan-working-group'));

    expect(screen.getByTestId('controls-study')).toBeEnabled();
  });

  it('says who can study a Tactic instead of only refusing the wrong staffer', async () => {
    const { session, state, idOf } = setup();
    renderPanel(session, state);

    await choose('controls-source', idOf('policy-working-bill'));
    await choose('controls-target', idOf('tactic-bipartisan-working-group'));

    expect(screen.getByTestId('controls-study')).toBeDisabled();
    const note = screen.getByTestId('controls-study-note');
    expect(note).toHaveTextContent(/policy-focused/i);
    expect(note).toHaveTextContent(/Policy Aide/i);
  });

  it('explains a staffer who is already working rather than silently refusing', async () => {
    const { session, idOf } = setup();
    const aide = idOf('staff-policy-aide');
    const report = idOf('evidence-rent-burden-report');
    const tactic = idOf('tactic-bipartisan-working-group');

    session.dispatch({
      type: 'STACK_CARD',
      cardId: aide,
      targetStackId: session.getState().cards.find((card) => card.id === report)!.stackId,
    });

    renderPanel(session, session.getState());
    await choose('controls-source', aide);
    await choose('controls-target', tactic);

    expect(screen.getByTestId('controls-study')).toBeDisabled();
    expect(screen.getByTestId('controls-study-note')).toHaveTextContent(/already working/i);
  });

  it('states the six-slot cabinet and returns a filed card to the desk', async () => {
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const source = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const state = {
      ...base,
      cards: base.cards.map((card) => card.id === source.id ? { ...card, location: 'filed' as const } : card),
      obligations: [obligationOccurrence(sessionScenario.obligationDefinitions[0])],
    };
    const session = createGameSession(state, sessionScenario);
    renderPanel(session, state);

    expect(screen.getByText(/Six filing slots/)).toBeInTheDocument();
    expect(screen.getByTestId('filing-count')).toHaveTextContent('1 of 6');
    await userEvent.click(screen.getByRole('button', { name: 'Return to desk' }));
    expect(session.getState().cards.find((card) => card.id === source.id)?.location).toBe('desk');
  });
});
