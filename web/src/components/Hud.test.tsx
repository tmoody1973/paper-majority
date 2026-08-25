import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Hud } from '@/components/Hud';
import { createFixtureState } from '@/content/fixtures/loadFixture';
import type { TermState } from '@/domain/types';

const noop = () => undefined;

function renderHud(state: TermState, lastResult?: string) {
  return render(
    <Hud
      state={state}
      lastResult={lastResult}
      handbookOpen={false}
      onTogglePause={noop}
      onToggleHandbook={noop}
      onToggleReducedMotion={noop}
    />,
  );
}

const base = createFixtureState('interaction-spike');

function withWorkingCard(state: TermState): TermState {
  return {
    ...state,
    cards: state.cards.map((card, index) =>
      index === 0 ? { ...card, status: 'working' as const, remainingMs: 6000 } : card,
    ),
  };
}

describe('Hud paused nudge', () => {
  it('says nothing extra when the desk is paused and idle', () => {
    renderHud({ ...base, paused: true });

    expect(screen.queryByTestId('hud-paused-nudge')).not.toBeInTheDocument();
    expect(screen.getByTestId('hud-result')).toBeEmptyDOMElement();
  });

  it('tells the player to resume when work is frozen by the pause', () => {
    renderHud(withWorkingCard({ ...base, paused: true }));

    const nudge = screen.getByTestId('hud-paused-nudge');
    expect(nudge).toHaveTextContent('Paused — press Resume to let the work happen.');
    expect(screen.getByTestId('hud-result')).toHaveTextContent(
      'Paused — press Resume to let the work happen.',
    );
  });

  it('drops the nudge once the clock is running', () => {
    renderHud(withWorkingCard({ ...base, paused: false }));

    expect(screen.queryByTestId('hud-paused-nudge')).not.toBeInTheDocument();
  });

  it('prefers the nudge over a stale result phrase, then restores it', () => {
    const { unmount } = renderHud(withWorkingCard({ ...base, paused: true }), 'Old news.');
    expect(screen.getByTestId('hud-result')).toHaveTextContent(/press Resume/);
    expect(screen.getByTestId('hud-result')).not.toHaveTextContent('Old news.');
    unmount();

    renderHud({ ...base, paused: true }, 'Old news.');
    expect(screen.getByTestId('hud-result')).toHaveTextContent('Old news.');
  });

  it('stays a polite live region so it is announced without stealing focus', () => {
    renderHud(withWorkingCard({ ...base, paused: true }));

    const result = screen.getByTestId('hud-result');
    expect(result).toHaveAttribute('aria-live', 'polite');
    expect(result).toHaveAttribute('role', 'status');
  });
});
