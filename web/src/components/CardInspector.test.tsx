import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CardInspector } from '@/components/CardInspector';
import { createFixtureState, getFixtureScenario } from '@/content/fixtures/loadFixture';
import { describeCard } from '@/domain/cardDetail';
import type { TermState } from '@/domain/types';

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
});
