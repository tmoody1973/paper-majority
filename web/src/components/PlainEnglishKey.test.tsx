import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlainEnglishKey } from '@/components/PlainEnglishKey';

describe('PlainEnglishKey', () => {
  it('is open without anyone having to click it', () => {
    render(<PlainEnglishKey />);

    expect(screen.getByTestId('key-panel')).toHaveAttribute('open');
  });

  it('explains all eight card families in plain words', () => {
    render(<PlainEnglishKey />);
    const families = screen.getByTestId('key-families');

    for (const word of [
      'Staff',
      'Policy',
      'Evidence',
      'Coalition',
      'Constituency',
      'Institution',
      'Political',
      'Tactic',
    ]) {
      expect(within(families).getByText(word)).toBeInTheDocument();
    }
  });

  it('keeps the real word and adds the meaning, rather than replacing it', () => {
    render(<PlainEnglishKey />);
    const families = screen.getByTestId('key-families');

    expect(within(families).getByText('Constituency')).toBeInTheDocument();
    expect(families).toHaveTextContent(/people back home/i);
  });

  it('explains the three information classes', () => {
    render(<PlainEnglishKey />);
    const classes = screen.getByTestId('key-classes');

    expect(within(classes).getByText('Official record')).toBeInTheDocument();
    expect(within(classes).getByText('Based on records')).toBeInTheDocument();
    expect(within(classes).getByText('Simulated')).toBeInTheDocument();
  });

  it('translates the phrase nobody has ever said out loud', () => {
    render(<PlainEnglishKey />);

    // The old label was "Derived context" — our own coinage, which taught nobody anything.
    expect(screen.getByTestId('key-classes')).toHaveTextContent(/worked out|summaris/i);
  });

  it('says plainly that simulated content is not about anyone real', () => {
    render(<PlainEnglishKey />);

    expect(screen.getByTestId('key-classes')).toHaveTextContent(/not a claim about anyone real/i);
  });

  it('explains the six numbers in the top bar', () => {
    render(<PlainEnglishKey />);
    const meters = screen.getByTestId('key-meters');

    for (const word of [
      'Staff Attention',
      'Political Capital',
      'District Trust',
      'Bill Momentum',
      'Policy Integrity',
      'Staff Morale',
    ]) {
      expect(within(meters).getByText(word)).toBeInTheDocument();
    }
    expect(meters).toHaveTextContent(/at once/i);
  });
});
