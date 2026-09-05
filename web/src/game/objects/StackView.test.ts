import { describe, expect, it } from 'vitest';

import { createRun } from '@/domain/initialState';
import { layoutStacks } from '@/game/objects/StackView';
import { sessionSetup } from '@/test/fixtures/session';

describe('layoutStacks', () => {
  it('excludes filed and archived cards without deleting their canonical stack history', () => {
    const base = createRun({ ...sessionSetup, mode: 'session' });
    const hidden = new Set([base.cards[0].id, base.cards[1].id]);
    const state = {
      ...base,
      cards: base.cards.map((card, index) => hidden.has(card.id)
        ? { ...card, location: index === 0 ? 'filed' as const : 'archived' as const }
        : card),
    };
    const layouts = layoutStacks(state, 252);
    expect(layouts.flatMap((stack) => stack.cardIds)).not.toEqual(expect.arrayContaining([...hidden]));
    expect(state.stacks.flatMap((stack) => stack.cardIds)).toEqual(expect.arrayContaining([...hidden]));
  });
});
