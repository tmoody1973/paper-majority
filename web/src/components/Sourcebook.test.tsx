import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sourcebook } from '@/components/Sourcebook';
import { getCandidateScenario } from '@/content/loadScenario';

describe('Sourcebook', () => {
  it('separates official citations from simulated demand and candidate status', () => {
    render(<Sourcebook scenario={getCandidateScenario()} />);
    expect(screen.getByLabelText('Sourcebook')).toHaveTextContent(/official records/i);
    expect(screen.getByLabelText('Sourcebook')).toHaveTextContent(/simulations/i);
    expect(screen.getByTestId('sourcebook-GA-05')).toHaveTextContent('Official public source');
    expect(screen.getByTestId('sourcebook-constituency-urgent-renter-concern')).toHaveTextContent('Simulated for play');
    expect(screen.getByLabelText('Sourcebook')).toHaveTextContent(/candidate|review/i);
  });
});
