import { buildMatchInputs, matchPattern, type PatternMatch } from '@/domain/recipes';
import { validatePatternPreflight } from '@/domain/patternResolvers';
import type {
  ActiveWork,
  CardInstance,
  RecipePattern,
  Resources,
  ScenarioDefinition,
  TermState,
  WorkReservation,
} from '@/domain/types';

export const EFFECTIVE_RULE_VERSION = 'session-work-v1';

export type WorkPreview =
  | { accepted: false; reason: string }
  | {
      accepted: true;
      patternId: string;
      staffCardIds: string[];
      cost: Partial<Resources>;
      durationMs: number;
      consumedCardIds: string[];
      returnedCardIds: string[];
    };

export interface WorkPlan {
  preview: Extract<WorkPreview, { accepted: true }>;
  match: PatternMatch;
  effectivePattern: RecipePattern;
}

type RejectedWorkPreview = Extract<WorkPreview, { accepted: false }>;

export function activeExpansionIds(state: TermState): string[] {
  return Array.from(new Set(Object.values(state.unlockedSlotExpansions).flat())).sort();
}

function reject(reason: string): RejectedWorkPreview {
  return { accepted: false, reason };
}

function selectedCards(state: TermState, cardIds: string[]): CardInstance[] | undefined {
  const byId = new Map(state.cards.map((card) => [card.id, card]));
  const selected = cardIds.map((id) => byId.get(id));
  return selected.every((card): card is CardInstance => card !== undefined) ? selected : undefined;
}

function withStaffTraits(
  pattern: RecipePattern,
  staffCardIds: string[],
  state: TermState,
  scenario: ScenarioDefinition,
): RecipePattern {
  let duration = pattern.durationMs;
  const staffCards = staffCardIds
    .map((id) => state.cards.find((card) => card.id === id))
    .filter((card): card is CardInstance => card !== undefined);

  for (const trait of [...scenario.staffTraits].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!staffCards.some((card) =>
      card.staffTraitId === trait.id && trait.eligibleStaffDefinitionIds.includes(card.definitionId),
    )) continue;
    if (!pattern.slots.some((slot) => slot.requiredTags?.includes(trait.effect.taskTag))) continue;
    duration *= trait.effect.multiplier;
  }

  return { ...pattern, durationMs: Math.max(1, Math.round(duration)) };
}

/**
 * Build the exact plan that a Session submission would reserve right now.
 *
 * This is intentionally pure. Work Mat can call it on every render without
 * spending a resource; SUBMIT_WORK calls it again at the command boundary so a
 * stale preview can never reserve cards or staff.
 */
export function planWork(
  state: TermState,
  scenario: ScenarioDefinition,
  cardIds: string[],
): WorkPlan | RejectedWorkPreview {
  if (cardIds.length < 2 || cardIds.length > 4) {
    return reject('Choose two to four cards.');
  }
  if (new Set(cardIds).size !== cardIds.length) {
    return reject('Each input card can be used only once.');
  }

  const cards = selectedCards(state, cardIds);
  if (!cards) return reject('One of those cards is no longer on the desk.');
  if (cards.some((card) => card.location !== 'desk')) {
    return reject('Filed or archived cards must return to the desk before work begins.');
  }
  if (cards.some((card) => card.status === 'expired')) {
    return reject('An expired card cannot begin work.');
  }
  const alreadyReserved = new Set(state.activeWork.flatMap((work) => work.cardIds));
  if (cards.some((card) => card.status !== 'idle' || alreadyReserved.has(card.id))) {
    return reject('One of those cards is already working.');
  }

  const inputs = buildMatchInputs(cards, scenario, state.player.party);
  const match = matchPattern(
    inputs,
    scenario.patterns,
    activeExpansionIds(state),
    scenario.tacticExpansions,
    state.bill.stage,
  );
  if (!match) return reject('These cards do not form an available rule right now.');
  const preflightRejection = validatePatternPreflight(match, inputs);
  if (preflightRejection) return reject(preflightRejection);

  const staffCardIds = inputs
    .filter((input) => input.definition.kind === 'staff')
    .map((input) => input.instanceId)
    .sort();
  const effectivePattern = withStaffTraits(match.effectivePattern, staffCardIds, state, scenario);
  const attention = effectivePattern.resourceCost.staffAttention ?? 0;
  if (attention > 0 && staffCardIds.length < Math.ceil(attention)) {
    return reject('This work needs an eligible staff card for every staff slot it uses.');
  }

  const heldAttention = state.activeWork.reduce(
    (sum, work) => sum + (work.paidCost.staffAttention ?? 0),
    0,
  );
  if (heldAttention + attention > state.staffCapacity) {
    return reject('The office does not have enough staff capacity for that work.');
  }
  const affordable = (Object.entries(effectivePattern.resourceCost) as [keyof Resources, number][])
    .every(([resource, amount]) => state.resources[resource] >= amount);
  if (!affordable) return reject('The office does not have the capacity for that right now.');

  const returnedCardIds = match.assignments
    .filter((assignment) => match.effectiveSlots[assignment.slotIndex]?.consumed === false)
    .flatMap((assignment) => assignment.cardInstanceIds)
    .sort();
  const returned = new Set(returnedCardIds);
  const consumedCardIds = [...cardIds].filter((id) => !returned.has(id)).sort();
  if (staffCardIds.some((id) => consumedCardIds.includes(id))) {
    return reject('Session work must return every staff card when it finishes.');
  }

  return {
    preview: {
      accepted: true,
      patternId: match.pattern.id,
      staffCardIds,
      cost: { ...effectivePattern.resourceCost },
      durationMs: effectivePattern.durationMs,
      consumedCardIds,
      returnedCardIds,
    },
    match,
    effectivePattern,
  };
}

export function previewWork(
  state: TermState,
  scenario: ScenarioDefinition,
  cardIds: string[],
): WorkPreview {
  const plan = planWork(state, scenario, cardIds);
  return 'preview' in plan ? plan.preview : plan;
}

export function patternReservation(
  id: string,
  state: TermState,
  plan: WorkPlan,
  cardIds: string[],
): ActiveWork {
  const base: WorkReservation = {
    id,
    cardIds: [...cardIds].sort(),
    staffCardIds: [...plan.preview.staffCardIds],
    paidCost: { ...plan.preview.cost },
    completesAtSimulationMs: state.simulationMs + plan.preview.durationMs,
    billRevision: state.bill.revision,
    effectiveRuleVersion: EFFECTIVE_RULE_VERSION,
    consumedCardIds: [...plan.preview.consumedCardIds],
    returnedCardIds: [...plan.preview.returnedCardIds],
  };
  return {
    ...base,
    kind: 'pattern',
    patternId: plan.preview.patternId,
    effectivePattern: structuredClone(plan.effectivePattern),
  };
}

/** Remaining Session work time for cards and accessible controls. */
export function remainingWorkMs(state: TermState, cardId: string): number {
  const work = state.activeWork.find((candidate) => candidate.cardIds.includes(cardId));
  return work ? Math.max(0, work.completesAtSimulationMs - state.simulationMs) : 0;
}
