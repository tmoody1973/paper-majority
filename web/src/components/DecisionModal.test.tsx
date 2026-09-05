import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DecisionModal } from '@/components/DecisionModal';
import { createRun } from '@/domain/initialState';
import type { CardInstance, TermState } from '@/domain/types';
import { createGameSession, type GameSession } from '@/game/session';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function pendingState(): TermState {
  const state = createRun({ ...sessionSetup, mode: 'session' });
  const occurrenceId = 'demand-renter-protection:revision:0';
  return {
    ...state,
    paused: true,
    pendingDecisions: [{
      id: `decision:${occurrenceId}`,
      sourceId: 'demand-renter-protection',
      occurrenceId,
      officeDefinitionId: 'coalition-office-hillcrest',
      approachedBillRevision: 0,
      expectedBillRevision: 0,
      choiceIds: [
        'choice-accept-renter-protection',
        'choice-refuse-renter-protection',
        'choice-counter-renter-protection',
      ],
      status: 'pending',
    }],
  };
}

function Harness({ session, onResult = vi.fn() }: { session: GameSession; onResult?: (message: string) => void }) {
  const [state, setState] = useState(session.getState());
  useEffect(() => session.subscribe((result) => setState(result.state)), [session]);
  const pendingId = state.pendingDecisions.find((decision) => decision.status === 'pending')?.id;
  return (
    <>
      <button type="button" autoFocus data-testid="decision-trigger">Outreach status</button>
      {pendingId && <DecisionModal key={pendingId} session={session} state={state} onResult={onResult} />}
    </>
  );
}

describe('DecisionModal', () => {
  it('opens a native labelled dialog with explicit effects and choices', () => {
    const session = createGameSession(pendingState(), sessionScenario);
    render(<Harness session={session} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAccessibleName('Hillcrest Member Office');
    expect(dialog).toHaveTextContent('Simulated negotiation');
    expect(dialog).toHaveTextContent('add Zoning Incentive');
    expect(dialog).toHaveTextContent('Tenant Stability');
    expect(screen.getByTestId('decision-resolve-accept')).toHaveAccessibleName('Accept the supply provision');
    expect(screen.getByTestId('decision-resolve-reject')).toHaveAccessibleName('Refuse the demand');
    expect(screen.getByTestId('decision-resolve-counter')).toBeDisabled();
    expect(screen.getByTestId('decision-resolve-accept')).toHaveFocus();
  });

  it('lets Escape close inspection without resolving and restores focus', async () => {
    const session = createGameSession(pendingState(), sessionScenario);
    render(<Harness session={session} />);
    const dialog = screen.getByRole('dialog');

    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));

    expect(await screen.findByTestId('decision-review')).toBeInTheDocument();
    expect(session.getState().pendingDecisions[0]?.status).toBe('pending');
    expect(session.getState().eventLog.filter((event) => event.type === 'DECISION_RESOLVED')).toHaveLength(0);
    await waitFor(() => expect(screen.getByTestId('decision-trigger')).toHaveFocus());
  });

  it('records explicit refusal through the real button and returns focus', async () => {
    const session = createGameSession(pendingState(), sessionScenario);
    const onResult = vi.fn();
    render(<Harness session={session} onResult={onResult} />);

    await userEvent.setup().click(screen.getByTestId('decision-resolve-reject'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(session.getState().pendingDecisions[0]?.status).toBe('resolved');
    expect(session.getState().eventLog.map((event) => event.type)).toEqual([
      'DECISION_RESOLVED',
      'OPPORTUNITY_DECLINED',
    ]);
    expect(onResult).toHaveBeenCalledWith('Refuse the demand recorded.');
    await waitFor(() => expect(screen.getByTestId('decision-trigger')).toHaveFocus());
  });

  it('starts a counter with the exact prepared evidence and staff shown in preview', async () => {
    const base = pendingState();
    const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
    const prepared: CardInstance = {
      ...evidence,
      id: 'card-prepared-counter',
      stackId: 'stack-card-prepared-counter',
      form: 'prepared',
      origin: {
        explanationKey: 'result.evidence.office-concern-answered',
        inputDefinitionIds: [evidence.definitionId, 'coalition-office-hillcrest'],
        consumedDefinitionIds: [evidence.definitionId],
        authoredConcern: {
          concernId: 'demand-renter-protection',
          recipientOfficeDefinitionId: 'coalition-office-hillcrest',
        },
      },
    };
    const state = {
      ...base,
      cards: [...base.cards, prepared],
      stacks: [...base.stacks, { id: prepared.stackId, cardIds: [prepared.id] }],
    };
    const session = createGameSession(state, sessionScenario);
    render(<Harness session={session} />);

    const counter = screen.getByTestId('decision-choice-counter');
    expect(counter).toHaveTextContent('District Director');
    expect(counter).toHaveTextContent('Rent Burden Report');
    await userEvent.setup().click(screen.getByTestId('decision-resolve-counter'));

    expect(session.getState().activeWork[0]?.decisionOrigin?.choiceId).toBe('choice-counter-renter-protection');
    expect(session.getState().eventLog.filter((event) => event.type === 'WORK_SUBMITTED')).toHaveLength(1);
    expect(session.getState().eventLog.filter((event) => event.type === 'DECISION_RESOLVED')).toHaveLength(1);
  });
});
