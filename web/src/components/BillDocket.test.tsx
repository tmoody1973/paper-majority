import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BillDocket } from '@/components/BillDocket';
import { createRun } from '@/domain/initialState';
import type { CardInstance, TermState } from '@/domain/types';
import { createGameSession, type GameSession } from '@/game/session';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function draftedState(): TermState {
  const state = createRun({ ...sessionSetup, mode: 'session' });
  const policy = state.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')!;
  const drafted: CardInstance = {
    ...policy,
    id: 'card-drafted-voucher',
    stackId: 'stack-card-drafted-voucher',
    form: 'drafted',
    sourceDefinitionIds: ['evidence-rent-burden-report'],
    policyDefinitionId: policy.definitionId,
  };
  return {
    ...state,
    cards: [...state.cards.filter((card) => card.id !== policy.id), drafted],
    stacks: [
      ...state.stacks.filter((stack) => !stack.cardIds.includes(policy.id)),
      { id: drafted.stackId, cardIds: [drafted.id] },
    ],
  };
}

function Harness({ session, onResult = vi.fn() }: { session: GameSession; onResult?: (message: string) => void }) {
  const [state, setState] = useState(session.getState());
  useEffect(() => session.subscribe((result) => setState(result.state)), [session]);
  return <BillDocket session={session} state={state} onResult={onResult} />;
}

describe('BillDocket', () => {
  it('adds a drafted provision by keyboard and shows contents, source, values, and next requirement', async () => {
    const session = createGameSession(draftedState(), sessionScenario);
    render(<Harness session={session} />);

    expect(screen.getByRole('heading', { name: 'Bill Docket' })).toBeInTheDocument();
    expect(screen.getByTestId('bill-docket-values')).toHaveTextContent('Tenant Stability');
    expect(screen.getByTestId('bill-docket-values')).toHaveTextContent('Fair Access');
    expect(screen.getByTestId('bill-docket-next')).toHaveTextContent(/add 2 more provisions/i);

    await userEvent.setup().selectOptions(screen.getByTestId('bill-docket-picker'), 'card-drafted-voucher');
    const candidate = screen.getByTestId('bill-docket-candidate-preview');
    expect(candidate).toHaveTextContent('Rental assistance policy used by the unit fixture.');
    expect(candidate).toHaveTextContent('Source context: Rent Burden Report');
    expect(candidate).toHaveTextContent('Projected Policy Integrity 76');
    expect(candidate).toHaveTextContent('Tenant Stability +8');
    expect(candidate).toHaveTextContent('Fair Access +8');
    const add = screen.getByTestId('bill-docket-add');
    add.focus();
    await userEvent.setup().keyboard('{Enter}');

    expect(session.getState().bill.provisionIds).toEqual(['policy-housing-choice-voucher']);
    expect(screen.getByTestId('bill-docket-revision')).toHaveTextContent('Revision 1');
    expect(screen.getByTestId('bill-docket-provision-policy-housing-choice-voucher')).toHaveTextContent('Housing Choice Voucher');
    expect(screen.getByTestId('bill-docket-provision-policy-housing-choice-voucher')).toHaveTextContent('Rental assistance policy used by the unit fixture.');
    expect(screen.getByTestId('bill-docket-provision-policy-housing-choice-voucher')).toHaveTextContent('Drafted');
    expect(screen.getByTestId('bill-docket-provision-policy-housing-choice-voucher')).toHaveTextContent('Simulated');
    expect(screen.getByTestId('bill-docket-provision-policy-housing-choice-voucher')).toHaveTextContent('Rent Burden Report');
    expect(screen.getByTestId('bill-docket-provision-policy-housing-choice-voucher')).toHaveTextContent('Tenant Stability +8');
    expect(screen.getByTestId('bill-docket-integrity')).toHaveTextContent('76');
    expect(screen.getByTestId('bill-docket-next')).toHaveTextContent(/add 1 more provision/i);
  });

  it('explains a rejected duplicate and leaves the drafted instance available', async () => {
    const ready = draftedState();
    const state: TermState = {
      ...ready,
      resources: { ...ready.resources, policyIntegrity: 76 },
      bill: {
        ...ready.bill,
        provisionIds: ['policy-housing-choice-voucher'],
        revision: 1,
        provisionReceipts: [{
          provisionId: 'policy-housing-choice-voucher',
          draftedCardId: 'old-card',
          sourceDefinitionIds: ['evidence-rent-burden-report'],
          docketedAtRevision: 1,
          plainLanguage: 'Rental assistance policy used by the unit fixture.',
          form: 'drafted',
          sourceClass: 'simulated',
        }],
      },
    };
    const session = createGameSession(state, sessionScenario);
    const onResult = vi.fn();
    render(<Harness session={session} onResult={onResult} />);

    await userEvent.setup().selectOptions(screen.getByTestId('bill-docket-picker'), 'card-drafted-voucher');
    await userEvent.setup().click(screen.getByTestId('bill-docket-add'));

    expect(screen.getByTestId('bill-docket-feedback')).toHaveTextContent(/already in the bill/i);
    expect(onResult).toHaveBeenCalledWith(expect.stringMatching(/already in the bill/i));
    expect(session.getState()).toBe(state);
    expect(session.getState().cards.some((card) => card.id === 'card-drafted-voucher')).toBe(true);
  });
});
