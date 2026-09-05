import type { GameCommand } from '@/domain/commands';
import { buildMatchInputs, matchPattern } from '@/domain/recipes';
import { describeStudyOption } from '@/domain/selectors';
import { previewWork } from '@/domain/work';
import type { CardInstance, Resources, ScenarioDefinition, TermState } from '@/domain/types';

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

  const expansions = scenario.tacticExpansions.filter(
    (candidate) => candidate.tacticDefinitionId === tactic.definitionId,
  );
  if (expansions.length === 0) return plainStack;

  // Already learned: nothing left to study, so let it fall through and be refused
  // like any other combination that does not work.
  const alreadyActive = expansions.every((expansion) =>
    (state.unlockedSlotExpansions[expansion.targetPatternId] ?? []).includes(expansion.id),
  );
  if (alreadyActive) return plainStack;

  return {
    type: 'START_ASSIGNMENT',
    assignmentKind: 'study-tactic',
    staffCardId: staff.id,
    targetCardId: tactic.id,
  };
}

/**
 * Will this drop actually be accepted?
 *
 * Drives the valid-hover cue. A target that glows and then refuses the drop
 * teaches the player a rule the game does not have, so this asks every question
 * the engine will ask: are the cards free, does a pattern match, can the office
 * afford it, and — for a Tactic — is this staffer allowed to study it.
 *
 * Pure and in the domain layer so the desk cue, the keyboard panel and the tests
 * cannot drift apart.
 */
export function wouldDropBeAccepted(
  state: TermState,
  scenario: ScenarioDefinition,
  cardId: string,
  targetStackId: string,
): boolean {
  const stack = state.stacks.find((candidate) => candidate.id === targetStackId);
  if (!stack) return false;

  const members = [...stack.cardIds, cardId]
    .map((id) => state.cards.find((card) => card.id === id))
    .filter((card): card is CardInstance => card !== undefined);
  if (members.length !== stack.cardIds.length + 1) return false;
  if (members.some((card) => card.status !== 'idle')) return false;

  const intent = resolveDropIntent(state, scenario, cardId, targetStackId);
  if (intent?.type === 'START_ASSIGNMENT' && intent.assignmentKind === 'study-tactic') {
    return describeStudyOption(state, scenario, intent.staffCardId, intent.targetCardId).canStudy;
  }

  if (state.mode !== 'interaction-spike') {
    return previewWork(state, scenario, members.map((card) => card.id)).accepted;
  }

  const inputs = buildMatchInputs(members, scenario, state.player.party);
  const found = matchPattern(
    inputs,
    scenario.patterns,
    Object.values(state.unlockedSlotExpansions).flat(),
    scenario.tacticExpansions,
  );
  if (!found) return false;

  return (Object.entries(found.pattern.resourceCost) as [keyof Resources, number][]).every(
    ([key, amount]) => state.resources[key] >= amount,
  );
}
