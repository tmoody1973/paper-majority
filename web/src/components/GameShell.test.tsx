import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// The shell must render on the server and in a plain DOM test without Phaser ever
// being imported. Stubbing `next/dynamic` proves the boundary rather than assuming it.
vi.mock('next/dynamic', () => ({
  default: () => function StubbedCanvas() {
    return <div data-testid="game-canvas" aria-label="Congressional desk" />;
  },
}));

import { GameShell } from '@/components/GameShell';
import { createRun } from '@/domain/initialState';
import type { CardInstance, PendingDecision, TermState } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function pendingDocketState(): TermState {
  const state = createRun({ ...sessionSetup, mode: 'session' });
  const source = state.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')!;
  const drafted: CardInstance = {
    ...source,
    id: 'card-drafted-while-pending',
    stackId: 'stack-card-drafted-while-pending',
    form: 'drafted',
    policyDefinitionId: source.definitionId,
  };
  const occurrenceId = 'demand-renter-protection:revision:0';
  const pending: PendingDecision = {
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
  };
  return {
    ...state,
    paused: true,
    cards: [...state.cards.filter((card) => card.id !== source.id), drafted],
    stacks: [
      ...state.stacks.filter((stack) => !stack.cardIds.includes(source.id)),
      { id: drafted.stackId, cardIds: [drafted.id] },
    ],
    pendingDecisions: [pending],
  };
}

describe('GameShell', () => {
  it('publishes a replacement Session snapshot instead of retaining the old HUD', async () => {
    const first = createRun({ ...sessionSetup, mode: 'session' });
    const second = { ...createRun({ ...sessionSetup, mode: 'session' }), week: 4 };
    const view = render(<GameShell scenario={sessionScenario} initialState={first} />);
    expect(screen.getByText('1 of 6')).toBeInTheDocument();
    view.rerender(<GameShell scenario={sessionScenario} initialState={second} />);
    expect(await screen.findByText('4 of 6')).toBeInTheDocument();
  });
  it('renders the HUD', () => {
    render(<GameShell />);

    expect(screen.getByLabelText('Office status')).toBeInTheDocument();
    expect(screen.getByTestId('hud-staffAttention')).toHaveTextContent('3');
    expect(screen.getByTestId('hud-districtTrust')).toHaveTextContent('60');
  });

  it('renders a labelled game-canvas region', () => {
    render(<GameShell />);

    const region = screen.getByTestId('game-canvas-region');
    expect(region).toHaveAttribute('aria-label', 'Congressional desk');
  });

  it('imports without touching Phaser', async () => {
    // A top-level Phaser import would try to reach WebGL and throw here. Importing
    // the shell and rendering it must both stay clean in a plain DOM.
    await expect(import('@/components/GameShell')).resolves.toBeTruthy();
    expect(() => render(<GameShell />)).not.toThrow();
  });

  it('offers a keyboard equivalent for combining cards', () => {
    render(<GameShell />);

    expect(screen.getByLabelText('Keyboard card controls')).toBeInTheDocument();
    expect(screen.getByTestId('controls-combine')).toBeInTheDocument();
    expect(screen.getByTestId('controls-separate')).toBeInTheDocument();
    expect(screen.getByTestId('controls-study')).toBeInTheDocument();
  });

  it('starts paused and shows a pause control', () => {
    render(<GameShell />);

    expect(screen.getByTestId('hud-pause')).toHaveTextContent('Resume');
  });

  it('opens the Staff Handbook from the HUD', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<GameShell />);

    expect(screen.queryByLabelText('Staff Handbook')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('hud-handbook'));
    expect(screen.getByLabelText('Staff Handbook')).toBeInTheDocument();
    expect(screen.getByTestId('handbook-progress')).toHaveTextContent('0 of 3 rules found');
  });

  it('restores the real shell trigger and keeps a closed offer resolvable when a docket edit is blocked', async () => {
    const user = userEvent.setup();
    render(<GameShell scenario={sessionScenario} initialState={pendingDocketState()} />);

    const firstDialog = await screen.findByRole('dialog');
    expect(screen.getByTestId('decision-resolve-accept')).toHaveFocus();
    fireEvent(firstDialog, new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() => expect(screen.getByTestId('decision-trigger')).toHaveFocus());

    await user.selectOptions(screen.getByTestId('bill-docket-picker'), 'card-drafted-while-pending');
    await user.click(screen.getByTestId('bill-docket-add'));
    expect(screen.getByTestId('bill-docket-feedback')).toHaveTextContent(/resolve all pending coalition offers/i);
    expect(screen.getByTestId('bill-docket-revision')).toHaveTextContent('Revision 0');

    await user.click(screen.getByTestId('decision-trigger'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('decision-resolve-reject'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('decision-trigger')).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(screen.getByTestId('decision-trigger')).toHaveFocus());
  });
});
