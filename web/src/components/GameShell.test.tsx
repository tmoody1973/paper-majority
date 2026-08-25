import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The shell must render on the server and in a plain DOM test without Phaser ever
// being imported. Stubbing `next/dynamic` proves the boundary rather than assuming it.
vi.mock('next/dynamic', () => ({
  default: () => function StubbedCanvas() {
    return <div data-testid="game-canvas" aria-label="Congressional desk" />;
  },
}));

import { GameShell } from '@/components/GameShell';

describe('GameShell', () => {
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
});
