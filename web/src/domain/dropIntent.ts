import type { GameCommand } from '@/domain/commands';
import type { CardInstance, ScenarioDefinition, TermState } from '@/domain/types';

/**
 * What does dropping this card on that stack mean?
 *
 * Most drops are a plain stack. Dropping eligible Staff on an unstudied Tactic is a
 * Study Tactic assignment instead — the physical gesture the design calls for, rather
 * than a button that bypasses it.
 *
 * This lives in the pure layer so the mouse, the keyboard panel and the tests all
 * reach the same decision. Phaser must not carry rules of its own.
 */
export function resolveDropIntent(
  state: TermState,
  scenario: ScenarioDefinition,
  cardId: string,
  targetStackId: string,
): GameCommand | undefined {
  const moving = state.cards.find((card) => card.id === cardId);
  const targetStack = state.stacks.find((stack) => stack.id === targetStackId);
  if (!moving || !targetStack || targetStack.cardIds.includes(cardId)) return undefined;

  const plainStack: GameCommand = { type: 'STACK_CARD', cardId, targetStackId };

  // Studying is a two-card gesture: one Staff, one Tactic. Anything else is a stack.
  if (targetStack.cardIds.length !== 1) return plainStack;

  const other = state.cards.find((card) => card.id === targetStack.cardIds[0]);
  if (!other) return plainStack;

  const kindOf = (card: CardInstance) =>
    scenario.cards.find((definition) => definition.id === card.definitionId)?.kind;

  const pair = [moving, other];
  const staff = pair.find((card) => kindOf(card) === 'staff');
  const tactic = pair.find((card) => kindOf(card) === 'tactic');
  if (!staff || !tactic) return plainStack;

  const expansion = scenario.tacticExpansions.find(
    (candidate) => candidate.tacticDefinitionId === tactic.definitionId,
  );
  if (!expansion) return plainStack;

  // Already learned: nothing left to study, so let it fall through and be refused
  // like any other combination that does not work.
  const alreadyActive = (state.unlockedSlotExpansions[expansion.targetPatternId] ?? []).includes(
    expansion.id,
  );
  if (alreadyActive) return plainStack;

  return {
    type: 'START_ASSIGNMENT',
    assignmentKind: 'study-tactic',
    staffCardId: staff.id,
    targetCardId: tactic.id,
  };
}
