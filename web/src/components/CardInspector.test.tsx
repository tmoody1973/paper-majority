import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CardInspector } from '@/components/CardInspector';
import { createFixtureState, getFixtureScenario } from '@/content/fixtures/loadFixture';
import { describeCard } from '@/domain/cardDetail';
import type { TermState } from '@/domain/types';
import { createRun } from '@/domain/initialState';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

const scenario = getFixtureScenario();
const fresh = createFixtureState('interaction-spike');

function detailFor(state: TermState, definitionId: string) {
  const card = state.cards.find((c) => c.definitionId === definitionId)!;
  return describeCard(state, scenario, card.id)!;
}

describe('CardInspector', () => {
  it('says what the card is in plain language', () => {
    render(<CardInspector detail={detailFor(fresh, 'policy-working-bill')} onClose={vi.fn()} />);

    expect(screen.getByTestId('inspector-plain')).toHaveTextContent(/bill you are building/i);
  });

  it('qualifies an "official" card that carries no citation', () => {
    render(
      <CardInspector detail={detailFor(fresh, 'evidence-rent-burden-report')} onClose={vi.fn()} />,
    );

    // The explainer above it says "Real public information, from a real source."
    // A reader must not reach the end of the card still believing it is sourced.
    expect(screen.getByTestId('inspector-source-explainer')).toHaveTextContent(/real source/i);
    expect(screen.getByTestId('inspector-practice')).toHaveTextContent(/no source is on file/i);
  });

  it('traces a card made in play to its inputs instead of the practice label', () => {
    const withSummary: TermState = {
      ...fresh,
      cards: [
        ...fresh.cards,
        {
          id: 'card-99',
          definitionId: 'evidence-housing-summary',
          stackId: 'stack-card-99',
          x: 500,
          y: 500,
          remainingMs: 0,
          status: 'idle' as const,
          form: 'raw',
          location: 'desk',
          sourceDefinitionIds: ['evidence-tenant-survey'],
          origin: {
            explanationKey: 'result.summary.district-relevance',
            inputDefinitionIds: ['evidence-tenant-survey', 'staff-policy-aide'],
            consumedDefinitionIds: ['evidence-tenant-survey'],
          },
        },
      ],
      stacks: [...fresh.stacks, { id: 'stack-card-99', cardIds: ['card-99'] }],
    };
    const detail = describeCard(withSummary, scenario, 'card-99')!;
    render(<CardInspector detail={detail} onClose={vi.fn()} />);

    expect(screen.queryByTestId('inspector-practice')).not.toBeInTheDocument();
    expect(screen.getByTestId('inspector-origin')).toHaveTextContent(
      /made this from: .*Tenant Survey/i,
    );
  });

  it('leaves a simulated card alone — it is already honest about what it is', () => {
    render(<CardInspector detail={detailFor(fresh, 'policy-working-bill')} onClose={vi.fn()} />);

    expect(screen.queryByTestId('inspector-practice')).not.toBeInTheDocument();
  });

  it('shows family and information class as separate labels', () => {
    render(<CardInspector detail={detailFor(fresh, 'evidence-rent-burden-report')} onClose={vi.fn()} />);

    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('Official record')).toBeInTheDocument();
  });

  it('marks simulated content so it is never read as a claim about anyone real', () => {
    render(<CardInspector detail={detailFor(fresh, 'coalition-office-hillcrest')} onClose={vi.fn()} />);

    expect(screen.getByTestId('inspector-simulated')).toHaveTextContent(/in this simulation/i);
  });

  it('says a derived card was worked out, not quoted', () => {
    render(<CardInspector detail={detailFor(fresh, 'evidence-tenant-survey')} onClose={vi.fn()} />);

    expect(screen.getByTestId('inspector-source-explainer')).toHaveTextContent(/worked out/i);
  });

  it('explains the information class on every card, not only the odd ones', () => {
    render(<CardInspector detail={detailFor(fresh, 'evidence-rent-burden-report')} onClose={vi.fn()} />);

    expect(screen.getByTestId('inspector-source-explainer')).toHaveTextContent(
      /real public information/i,
    );
  });

  it('offers no uses before discovery, and invites experimenting instead', () => {
    render(<CardInspector detail={detailFor(fresh, 'staff-policy-aide')} onClose={vi.fn()} />);

    const uses = screen.getByTestId('inspector-uses');
    expect(uses).toHaveTextContent(/not found a use/i);
    expect(uses).toHaveTextContent(/costs you nothing/i);
    expect(uses.querySelector('li')).toBeNull();
  });

  it('lists a use once its rule is discovered', () => {
    const discovered: TermState = { ...fresh, discoveredPatternIds: ['pattern-evidence-summary'] };
    render(<CardInspector detail={detailFor(discovered, 'staff-policy-aide')} onClose={vi.fn()} />);

    expect(screen.getByTestId('inspector-uses')).toHaveTextContent(/Evidence Summary/);
  });

  it('closes', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onClose = vi.fn();
    render(<CardInspector detail={detailFor(fresh, 'staff-policy-aide')} onClose={onClose} />);

    await userEvent.setup().click(screen.getByTestId('inspector-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows drafted language as simulated with its selected-value contributions', () => {
    const run = createRun({ ...sessionSetup, mode: 'session' });
    const policy = run.cards.find((card) => card.definitionId === 'policy-housing-choice-voucher')!;
    const drafted: TermState = {
      ...run,
      cards: run.cards.map((card) => card.id === policy.id
        ? {
            ...card,
            form: 'drafted' as const,
            sourceDefinitionIds: ['evidence-rent-burden-report'],
            origin: {
              explanationKey: 'result.provision.drafted',
              inputDefinitionIds: [
                'staff-legislative-counsel',
                'evidence-rent-burden-report',
                'policy-housing-choice-voucher',
              ],
              consumedDefinitionIds: [
                'evidence-rent-burden-report',
                'policy-housing-choice-voucher',
              ],
            },
          }
        : card),
    };

    render(
      <CardInspector
        detail={describeCard(drafted, sessionScenario, policy.id)!}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Drafted Housing Choice Voucher' })).toBeInTheDocument();
    expect(screen.getByText('Simulated')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-values')).toHaveTextContent('Tenant Stability +8');
    expect(screen.getByTestId('inspector-values')).toHaveTextContent('Fair Access +8');
    expect(screen.getByTestId('inspector-origin')).toHaveTextContent('Rent Burden Report');
  });
});
