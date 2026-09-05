import type { StackState, TermState } from '@/domain/types';

/**
 * Stack geometry, kept pure.
 *
 * A fanned stack offsets each card by exactly the readable header height, so the
 * family band, family label and title of every card stay visible.
 */
export const STACK_FAN_OFFSET_Y = 34;

export interface StackLayout {
  stackId: string;
  cardIds: string[];
  x: number;
  y: number;
  height: number;
  active: boolean;
}

export function layoutStacks(state: TermState, cardHeight: number): StackLayout[] {
  return state.stacks.flatMap((stack: StackState) => {
    const cardIds = stack.cardIds.filter((id) =>
      state.cards.find((card) => card.id === id)?.location === 'desk',
    );
    if (cardIds.length === 0) return [];
    const anchor = state.cards.find((card) => card.id === cardIds[0]);
    return {
      stackId: stack.id,
      cardIds,
      x: anchor?.x ?? 0,
      y: anchor?.y ?? 0,
      height: cardHeight + (cardIds.length - 1) * STACK_FAN_OFFSET_Y,
      active: Boolean(stack.activeActionId),
    };
  });
}
