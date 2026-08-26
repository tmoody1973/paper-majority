import { describe, expect, it } from 'vitest';

import { createFixtureState, getFixtureScenario } from '@/content/fixtures/loadFixture';
import { resolveDropIntent, wouldDropBeAccepted } from '@/domain/dropIntent';
import type { TermState } from '@/domain/types';

const scenario = getFixtureScenario();
const state = createFixtureState('interaction-spike');

function cardId(definitionId: string, skip = 0): string {
  const card = state.cards.filter((c) => c.definitionId === definitionId)[skip];
  if (!card) throw new Error(`no ${definitionId}`);
  return card.id;
}

function stackOf(definitionId: string): string {
  return state.cards.find((c) => c.definitionId === definitionId)!.stackId;
}

describe('resolveDropIntent', () => {
  it('turns Staff dropped on a Tactic into a Study Tactic assignment', () => {
    const intent = resolveDropIntent(
      state,
      scenario,
      cardId('staff-policy-aide'),
      stackOf('tactic-bipartisan-working-group'),
    );

    expect(intent).toEqual({
      type: 'START_ASSIGNMENT',
      assignmentKind: 'study-tactic',
      staffCardId: cardId('staff-policy-aide'),
      targetCardId: cardId('tactic-bipartisan-working-group'),
    });
  });

  it('works in the other direction too — Tactic dropped on Staff', () => {
    const intent = resolveDropIntent(
      state,
      scenario,
      cardId('tactic-bipartisan-working-group'),
      stackOf('staff-policy-aide'),
    );

    expect(intent).toEqual({
      type: 'START_ASSIGNMENT',
      assignmentKind: 'study-tactic',
      staffCardId: cardId('staff-policy-aide'),
      targetCardId: cardId('tactic-bipartisan-working-group'),
    });
  });

  it('leaves an ordinary pattern drop as a plain stack', () => {
    const intent = resolveDropIntent(
      state,
      scenario,
      cardId('staff-policy-aide'),
      stackOf('evidence-rent-burden-report'),
    );

    expect(intent).toEqual({
      type: 'STACK_CARD',
      cardId: cardId('staff-policy-aide'),
      targetStackId: stackOf('evidence-rent-burden-report'),
    });
  });

  it('does not treat a Tactic with no declared expansion as studiable', () => {
    const noExpansions = { ...scenario, tacticExpansions: [] };
    const intent = resolveDropIntent(
      state,
      noExpansions,
      cardId('staff-policy-aide'),
      stackOf('tactic-bipartisan-working-group'),
    );

    expect(intent?.type).toBe('STACK_CARD');
  });

  it('does not study a Tactic whose rule the office already learned', () => {
    const learned: TermState = {
      ...state,
      unlockedSlotExpansions: { 'pattern-coalition-outreach': ['expansion-bipartisan-outreach'] },
    };
    const intent = resolveDropIntent(
      learned,
      scenario,
      cardId('staff-policy-aide'),
      stackOf('tactic-bipartisan-working-group'),
    );

    expect(intent?.type).toBe('STACK_CARD');
  });

  it('returns nothing for an unknown card or stack', () => {
    expect(resolveDropIntent(state, scenario, 'nope', stackOf('staff-policy-aide'))).toBeUndefined();
    expect(resolveDropIntent(state, scenario, cardId('staff-policy-aide'), 'nope')).toBeUndefined();
  });
});

describe('wouldDropBeAccepted', () => {
  it('is true for a stack the office can match and afford', () => {
    expect(
      wouldDropBeAccepted(
        state,
        scenario,
        cardId('staff-policy-aide'),
        stackOf('evidence-rent-burden-report'),
      ),
    ).toBe(true);
  });

  it('is false when the rule matches but the office cannot afford it', () => {
    // A target that glows green and then refuses the drop teaches the wrong rule.
    const broke: TermState = { ...state, resources: { ...state.resources, staffAttention: 0 } };

    expect(
      wouldDropBeAccepted(
        broke,
        scenario,
        cardId('staff-policy-aide'),
        stackOf('evidence-rent-burden-report'),
      ),
    ).toBe(false);
  });

  it('is false for a Tactic the chosen card is not eligible to study', () => {
    expect(
      wouldDropBeAccepted(
        state,
        scenario,
        cardId('policy-working-bill'),
        stackOf('tactic-bipartisan-working-group'),
      ),
    ).toBe(false);
  });

  it('is true for an eligible staffer dropped on a Tactic', () => {
    expect(
      wouldDropBeAccepted(
        state,
        scenario,
        cardId('staff-policy-aide'),
        stackOf('tactic-bipartisan-working-group'),
      ),
    ).toBe(true);
  });
});
