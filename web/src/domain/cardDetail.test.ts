import { describe, expect, it } from 'vitest';

import { createFixtureState, getFixtureScenario } from '@/content/fixtures/loadFixture';
import { describeCard } from '@/domain/cardDetail';
import type { TermState } from '@/domain/types';

const scenario = getFixtureScenario();
const fresh = createFixtureState('interaction-spike');

function instanceOf(state: TermState, definitionId: string): string {
  return state.cards.find((card) => card.definitionId === definitionId)!.id;
}

describe('describeCard', () => {
  it('names the card, its family and its information class', () => {
    const detail = describeCard(fresh, scenario, instanceOf(fresh, 'evidence-rent-burden-report'));

    expect(detail?.title).toBe('Rent Burden Report');
    expect(detail?.familyLabel).toBe('Evidence');
    expect(detail?.sourceLabel).toBe('Official record');
  });

  it('marks simulated cards so they are never read as fact', () => {
    const detail = describeCard(fresh, scenario, instanceOf(fresh, 'coalition-office-hillcrest'));

    expect(detail?.sourceLabel).toBe('Simulated');
    expect(detail?.simulatedNote).toMatch(/in this simulation/i);
  });

  it('gives official records no "in this simulation" caveat', () => {
    const detail = describeCard(fresh, scenario, instanceOf(fresh, 'evidence-rent-burden-report'));

    expect(detail?.simulatedNote).toBeUndefined();
  });

  it('reads as a ladder: the record, something built from it, something invented', () => {
    const official = describeCard(fresh, scenario, instanceOf(fresh, 'evidence-rent-burden-report'));
    const derived = describeCard(fresh, scenario, instanceOf(fresh, 'evidence-tenant-survey'));
    const simulated = describeCard(fresh, scenario, instanceOf(fresh, 'coalition-office-hillcrest'));

    expect(official?.sourceLabel).toBe('Official record');
    expect(derived?.sourceLabel).toBe('Based on records');
    expect(simulated?.sourceLabel).toBe('Simulated');
    // No label may be a phrase nobody says out loud.
    for (const label of [official, derived, simulated].map((d) => d!.sourceLabel)) {
      expect(label).not.toMatch(/context|provenance|derived/i);
    }
  });

  it('explains every information class, including the plain-sounding one', () => {
    const official = describeCard(fresh, scenario, instanceOf(fresh, 'evidence-rent-burden-report'));
    expect(official?.sourceExplainer).toMatch(/real public information/i);
  });

  it('explains a derived card as a calculation, not a fact', () => {
    const detail = describeCard(fresh, scenario, instanceOf(fresh, 'evidence-tenant-survey'));

    expect(detail?.sourceLabel).toBe('Based on records');
    expect(detail?.sourceExplainer).toMatch(/worked out|summar/i);
  });

  it('does not file the player\u2019s own bill under Institution', () => {
    const detail = describeCard(fresh, scenario, instanceOf(fresh, 'policy-working-bill'));

    // Institution means the machinery Congress works through — committees, the floor,
    // the calendar. A bill is the thing being pushed through it, not the machinery.
    expect(detail?.familyLabel).not.toBe('Institution');
    expect(detail?.familyLabel).toBe('Policy');
  });

  it('says plainly what the card is', () => {
    const detail = describeCard(fresh, scenario, instanceOf(fresh, 'policy-working-bill'));

    expect(detail?.plainLanguage).toBeTruthy();
    expect(detail!.plainLanguage!.length).toBeGreaterThan(20);
  });

  it('reveals no uses before the player has discovered any', () => {
    const detail = describeCard(fresh, scenario, instanceOf(fresh, 'staff-policy-aide'));

    expect(detail?.knownUses).toEqual([]);
    expect(detail?.noUsesYetNote).toMatch(/try/i);
  });

  it('lists a use only once its pattern is discovered', () => {
    const discovered: TermState = {
      ...fresh,
      discoveredPatternIds: ['pattern-evidence-summary'],
    };
    const detail = describeCard(discovered, scenario, instanceOf(discovered, 'staff-policy-aide'));

    expect(detail?.knownUses).toHaveLength(1);
    expect(detail?.knownUses[0]).toMatch(/Evidence Summary/);
  });

  it('never leaks a pattern the player has not discovered', () => {
    const discovered: TermState = {
      ...fresh,
      discoveredPatternIds: ['pattern-evidence-summary'],
    };
    const bill = describeCard(discovered, scenario, instanceOf(discovered, 'policy-working-bill'));

    // The outreach rule is undiscovered, so the bill must advertise nothing.
    expect(bill?.knownUses).toEqual([]);
  });

  it('shows the widened rule once a Tactic has expanded it', () => {
    const expanded: TermState = {
      ...fresh,
      discoveredPatternIds: ['pattern-coalition-outreach'],
      unlockedSlotExpansions: { 'pattern-coalition-outreach': ['expansion-bipartisan-outreach'] },
    };
    const office = describeCard(expanded, scenario, instanceOf(expanded, 'coalition-office-ridgeline'));

    expect(office?.knownUses.join(' ')).toMatch(/Outreach Result/);
  });

  it('admits when a card claims a real record but carries no citation', () => {
    // The spike ships no citations. A card that says "Official record" and
    // "Real public information, from a real source" while carrying an empty
    // citation list is making a claim the game cannot support.
    const report = describeCard(fresh, scenario, instanceOf(fresh, 'evidence-rent-burden-report'));

    expect(report?.sourceLabel).toBe('Official record');
    expect(report?.practicePlaceholderNote).toBeDefined();
    expect(report?.practicePlaceholderNote).toMatch(/no source/i);
    expect(report?.practicePlaceholderNote).toMatch(/practice/i);
  });

  it('does not call a simulated card a practice placeholder', () => {
    // Simulated content is already honest about what it is; it is not pretending
    // to be a document with a missing citation.
    const bill = describeCard(fresh, scenario, instanceOf(fresh, 'policy-working-bill'));

    expect(bill?.sourceLabel).toBe('Simulated');
    expect(bill?.practicePlaceholderNote).toBeUndefined();
  });

  it('says nothing about cost for a rule the office has not discovered', () => {
    // A cost the player cannot have seen yet is a leak of an undiscovered rule.
    const office = describeCard(fresh, scenario, instanceOf(fresh, 'coalition-office-hillcrest'));

    expect(office?.costs).toEqual([]);
  });

  it('charges a member office in political capital, not staffers', () => {
    // The bug: every member office read "Uses 1 staffer", but outreach spends
    // Political Capital and no Staff Attention at all.
    const discovered: TermState = {
      ...fresh,
      discoveredPatternIds: ['pattern-coalition-outreach'],
    };
    const office = describeCard(
      discovered,
      scenario,
      instanceOf(discovered, 'coalition-office-hillcrest'),
    );

    expect(office?.costs.map((cost) => cost.short)).toEqual(['Spends 1 political capital']);
    expect(office?.costs.map((cost) => cost.short).join(' ')).not.toMatch(/staffer/i);
    // And it says which kind of cost that is — the open question in decision 003.
    expect(office?.costs[0].long).toMatch(/does not come back/i);
  });

  it('ties up a staffer for work that holds one, and says they come back', () => {
    const discovered: TermState = {
      ...fresh,
      discoveredPatternIds: ['pattern-evidence-summary'],
    };
    const aide = describeCard(discovered, scenario, instanceOf(discovered, 'staff-policy-aide'));

    expect(aide?.costs.map((cost) => cost.short)).toEqual(['Ties up 1 staffer']);
    expect(aide?.costs[0].long).toMatch(/get them back/i);
  });

  it('shows lineage instead of the practice label on a card made in play', () => {
    // A card the player just manufactured is not "a document with a missing
    // citation" — its source is the input card. Decision 012 carve-out.
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
          origin: {
            explanationKey: 'result.summary.district-relevance',
            inputDefinitionIds: ['evidence-tenant-survey', 'staff-policy-aide'],
            consumedDefinitionIds: ['evidence-tenant-survey'],
          },
        },
      ],
      stacks: [...fresh.stacks, { id: 'stack-card-99', cardIds: ['card-99'] }],
    };

    const summary = describeCard(withSummary, scenario, 'card-99');

    expect(summary?.practicePlaceholderNote).toBeUndefined();
    expect(summary?.origin?.short).toBe('From: Tenant Survey');
    expect(summary?.origin?.long).toMatch(/Tenant Survey/);
    expect(summary?.origin?.long).toMatch(/Policy Aide/);
  });

  it('returns nothing for a card that is not on the desk', () => {
    expect(describeCard(fresh, scenario, 'no-such-card')).toBeUndefined();
  });
});
