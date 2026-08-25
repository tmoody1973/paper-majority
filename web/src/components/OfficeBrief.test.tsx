import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OfficeBrief } from '@/components/OfficeBrief';
import { createFixtureState, getFixtureScenario } from '@/content/fixtures/loadFixture';

const scenario = getFixtureScenario();
const state = createFixtureState('interaction-spike');

describe('OfficeBrief', () => {
  it('says who the player is and what they want', () => {
    render(<OfficeBrief state={state} scenario={scenario} />);

    expect(screen.getByText(/freshman member of the House/i)).toBeInTheDocument();
    expect(screen.getByTestId('brief-goal')).toHaveTextContent(/housing bill/i);
  });

  it('names the party in words, not just a letter', () => {
    render(<OfficeBrief state={state} scenario={scenario} />);

    expect(screen.getByTestId('brief-party')).toHaveTextContent('Democratic');
  });

  it('explains why party matters, since the rules turn on it', () => {
    render(<OfficeBrief state={state} scenario={scenario} />);

    expect(screen.getByTestId('brief-party')).toHaveTextContent(/same party|other party/i);
  });

  it('shows both governing values', () => {
    render(<OfficeBrief state={state} scenario={scenario} />);

    expect(screen.getByTestId('brief-values')).toHaveTextContent('Tenant Stability');
    expect(screen.getByTestId('brief-values')).toHaveTextContent('Fair Access');
  });

  it('labels the whole brief as simulated', () => {
    render(<OfficeBrief state={state} scenario={scenario} />);

    expect(screen.getByTestId('brief-source')).toHaveTextContent(/simulated/i);
  });

  it('says plainly that the district is invented, and cites nothing', () => {
    render(<OfficeBrief state={state} scenario={scenario} />);

    const district = screen.getByTestId('brief-district');
    expect(district).toHaveTextContent('Practice District');
    expect(district).toHaveTextContent(/fictional/i);
    // No citation may be implied where no source exists.
    expect(district.querySelector('a')).toBeNull();
  });
});
