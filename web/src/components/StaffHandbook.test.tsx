import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StaffHandbook } from '@/components/StaffHandbook';
import { createFixtureState, getFixtureScenario } from '@/content/fixtures/loadFixture';
import { buildHandbook } from '@/domain/selectors';
import type { TermState } from '@/domain/types';

const scenario = getFixtureScenario();

function view(state: TermState) {
  return buildHandbook(state, scenario);
}

function entryFor(patternId: string) {
  return screen.getByTestId(`handbook-entry-${patternId}`);
}

describe('StaffHandbook', () => {
  it('shows every rule as Teased before anything is discovered', () => {
    render(<StaffHandbook view={view(createFixtureState('interaction-spike'))} />);

    const entry = entryFor('pattern-evidence-summary');
    expect(within(entry).getByText('Teased')).toBeInTheDocument();
    expect(
      within(entry).getByText('Housing evidence works with a policy-focused staff card.'),
    ).toBeInTheDocument();
    expect(within(entry).getByTestId('handbook-silhouette')).toBeInTheDocument();
  });

  it('hides the output and the slots while a rule is only Teased', () => {
    render(<StaffHandbook view={view(createFixtureState('interaction-spike'))} />);

    const entry = entryFor('pattern-evidence-summary');
    expect(within(entry).queryByTestId('handbook-slots')).not.toBeInTheDocument();
    expect(within(entry).queryByText(/Evidence Summary/)).not.toBeInTheDocument();
  });

  it('counts the rules still to find', () => {
    render(<StaffHandbook view={view(createFixtureState('interaction-spike'))} />);

    expect(screen.getByTestId('handbook-progress')).toHaveTextContent('0 of 3 rules found');
  });

  it('shows slots, output and a worked example once a rule is Discovered', () => {
    const base = createFixtureState('interaction-spike');
    const discovered: TermState = {
      ...base,
      discoveredPatternIds: ['pattern-evidence-summary'],
      eventLog: [
        {
          type: 'STACK_ACCEPTED',
          stackId: 'stack-1',
          cardIds: ['card-1', 'card-3'],
          definitionIds: ['evidence-rent-burden-report', 'staff-policy-aide'],
          patternId: 'pattern-evidence-summary',
        },
      ],
    };

    render(<StaffHandbook view={view(discovered)} />);
    const entry = entryFor('pattern-evidence-summary');

    expect(within(entry).getByText('Discovered')).toBeInTheDocument();
    expect(within(entry).getByTestId('handbook-slots')).toBeInTheDocument();
    expect(within(entry).getByText(/Evidence Summary/)).toBeInTheDocument();
    expect(within(entry).getByText(/Rent Burden Report/)).toBeInTheDocument();
    expect(within(entry).getByText(/Policy Aide/)).toBeInTheDocument();
  });

  it('does not reveal the other undiscovered rules when one is Discovered', () => {
    const base = createFixtureState('interaction-spike');
    const discovered: TermState = { ...base, discoveredPatternIds: ['pattern-evidence-summary'] };

    render(<StaffHandbook view={view(discovered)} />);

    expect(within(entryFor('pattern-coalition-outreach')).getByText('Teased')).toBeInTheDocument();
    expect(
      within(entryFor('pattern-coalition-outreach')).queryByTestId('handbook-slots'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('handbook-progress')).toHaveTextContent('1 of 3 rules found');
  });

  it('keeps the base rule and annotates the change when a rule becomes Expanded', () => {
    const base = createFixtureState('interaction-spike');
    const expanded: TermState = {
      ...base,
      discoveredPatternIds: ['pattern-coalition-outreach'],
      unlockedSlotExpansions: { 'pattern-coalition-outreach': ['expansion-bipartisan-outreach'] },
    };

    render(<StaffHandbook view={view(expanded)} />);
    const entry = entryFor('pattern-coalition-outreach');

    expect(within(entry).getByText('Expanded')).toBeInTheDocument();
    // The base rule survives, visibly.
    expect(within(entry).getByText(/shares your party/)).toBeInTheDocument();
    // And the widened alternative is called out as a change, not folded in silently.
    const change = within(entry).getByTestId('handbook-expansion');
    expect(change).toHaveTextContent(/Opposing-party member offices now count/);
    expect(within(entry).getByText(/from the other party/)).toBeInTheDocument();
  });

  it('reads its three states without relying on colour', () => {
    const base = createFixtureState('interaction-spike');
    const expanded: TermState = {
      ...base,
      discoveredPatternIds: ['pattern-evidence-summary', 'pattern-coalition-outreach'],
      unlockedSlotExpansions: { 'pattern-coalition-outreach': ['expansion-bipartisan-outreach'] },
    };

    render(<StaffHandbook view={view(expanded)} />);

    expect(screen.getByText('Teased')).toBeInTheDocument();
    expect(screen.getByText('Discovered')).toBeInTheDocument();
    expect(screen.getByText('Expanded')).toBeInTheDocument();
  });
});
