import type { GameCommand } from '@/domain/commands';
import { computeEffectiveTags, effectiveRule } from '@/domain/recipes';
import { previewDecision } from '@/domain/decisions';
import { activeExpansionIds, previewWork } from '@/domain/work';
import type {
  CardDefinition,
  CardInstance,
  RecipePattern,
  RecipeSlot,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

export type PolicyId =
  | 'district-advocate'
  | 'committee-specialist'
  | 'coalition-broker'
  | 'greedy-same-party'
  | 'district-reward';

export const POLICY_IDS: readonly PolicyId[] = [
  'district-advocate',
  'committee-specialist',
  'coalition-broker',
  'greedy-same-party',
  'district-reward',
];

const STAFF_ORDER: Record<PolicyId, readonly string[]> = {
  'district-advocate': ['staff-district-director', 'staff-policy-aide', 'staff-legislative-counsel'],
  'committee-specialist': ['staff-legislative-counsel', 'staff-policy-aide', 'staff-district-director'],
  'coalition-broker': ['staff-policy-aide', 'staff-district-director', 'staff-legislative-counsel'],
  'greedy-same-party': ['staff-policy-aide', 'staff-legislative-counsel', 'staff-district-director'],
  'district-reward': ['staff-district-director', 'staff-legislative-counsel', 'staff-policy-aide'],
};

const TACTIC_BY_POLICY: Partial<Record<PolicyId, string>> = {
  'district-advocate': 'tactic-targeted-data-briefing',
  'committee-specialist': 'tactic-early-committee-consultation',
  'coalition-broker': 'tactic-bipartisan-working-group',
  'district-reward': 'tactic-negotiated-cost-sharing',
};

function definitionOf(scenario: ScenarioDefinition, card: CardInstance): CardDefinition | undefined {
  return scenario.cards.find((definition) => definition.id === card.definitionId);
}

function availableCards(state: TermState): CardInstance[] {
  const reserved = new Set(state.activeWork.flatMap((work) => work.cardIds));
  return state.cards.filter((card) =>
    card.location === 'desk' && card.status === 'idle' && !reserved.has(card.id));
}

function slotAccepts(
  slot: RecipeSlot,
  card: CardInstance,
  definition: CardDefinition,
  state: TermState,
): boolean {
  const tags = computeEffectiveTags(definition, state.player.party);
  if (slot.kind && definition.kind !== slot.kind) return false;
  if (slot.forms && !slot.forms.includes(card.form)) return false;
  if (slot.requiredTags?.some((tag) => !tags.includes(tag))) return false;
  if (slot.anyTags && !slot.anyTags.some((tag) => tags.includes(tag))) return false;
  if (slot.sourceClasses && !slot.sourceClasses.includes(definition.sourceClass)) return false;
  if (slot.originExplanationKeys
    && !slot.originExplanationKeys.includes(card.origin?.explanationKey ?? '')) return false;
  return true;
}

function candidateCardIds(
  state: TermState,
  scenario: ScenarioDefinition,
  pattern: RecipePattern,
  requiredCardId?: string,
): string[][] {
  const expanded = effectiveRule(pattern, activeExpansionIds(state), scenario.tacticExpansions).pattern;
  const units = expanded.slots.flatMap((slot) => Array.from({ length: slot.quantity }, () => slot));
  const available = availableCards(state).sort((a, b) => a.id.localeCompare(b.id));
  const results: string[][] = [];

  function visit(index: number, selected: CardInstance[]): void {
    if (index === units.length) {
      if (requiredCardId && !selected.some((card) => card.id === requiredCardId)) return;
      const ids = selected.map((card) => card.id).sort();
      const preview = previewWork(state, scenario, ids);
      if (preview.accepted && preview.patternId === pattern.id) results.push(ids);
      return;
    }
    const slot = units[index];
    for (const card of available) {
      if (selected.some((entry) => entry.id === card.id)) continue;
      const definition = definitionOf(scenario, card);
      if (!definition || !slotAccepts(slot, card, definition, state)) continue;
      visit(index + 1, [...selected, card]);
    }
  }

  visit(0, []);
  return Array.from(new Map(results.map((ids) => [ids.join('|'), ids])).values());
}

function staffRank(policyId: PolicyId, state: TermState, scenario: ScenarioDefinition, ids: string[]): number {
  const order = STAFF_ORDER[policyId];
  const staff = ids
    .map((id) => state.cards.find((card) => card.id === id))
    .map((card) => card && definitionOf(scenario, card))
    .find((definition) => definition?.kind === 'staff');
  const index = staff ? order.indexOf(staff.id) : -1;
  return index < 0 ? order.length : index;
}

function findWork(
  policyId: PolicyId,
  state: TermState,
  scenario: ScenarioDefinition,
  patternId: string,
  requiredCardId?: string,
): GameCommand | undefined {
  const pattern = scenario.patterns.find((entry) => entry.id === patternId);
  if (!pattern) return undefined;
  const candidates = candidateCardIds(state, scenario, pattern, requiredCardId)
    .sort((a, b) => staffRank(policyId, state, scenario, a) - staffRank(policyId, state, scenario, b)
      || a.join('|').localeCompare(b.join('|')));
  return candidates[0] ? { type: 'SUBMIT_WORK', cardIds: candidates[0] } : undefined;
}

function storyChoice(policyId: PolicyId, state: TermState, scenario: ScenarioDefinition): GameCommand | undefined {
  const pending = state.pendingStoryDecisions.find((decision) => decision.status === 'pending');
  if (!pending) return undefined;
  const event = scenario.storyEvents.find((entry) => entry.id === pending.storyEventId);
  if (!event) return undefined;
  const affordable = event.choices.filter((choice) => Object.entries(choice.cost).every(
    ([resource, amount]) => state.resources[resource as keyof typeof state.resources] >= amount,
  ));
  const score = (choice: (typeof event.choices)[number]) => {
    const net = (resource: keyof typeof state.resources) =>
      (choice.effects[resource] ?? 0) - (choice.cost[resource] ?? 0);
    if (policyId === 'district-advocate' || policyId === 'district-reward') {
      return net('districtTrust') * 10 + net('politicalCapital') * 4 + net('staffMorale');
    }
    if (policyId === 'committee-specialist') {
      return net('billMomentum') * 10 + net('policyIntegrity') * 4 + net('staffMorale');
    }
    if (policyId === 'coalition-broker') {
      return net('politicalCapital') * 20 + net('staffMorale') * 6 + net('billMomentum') * 4 + net('districtTrust');
    }
    return -Object.values(choice.cost).reduce((sum, amount) => sum + amount, 0);
  };
  const choice = affordable.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0]
    ?? event.choices[0];
  return choice ? { type: 'RESOLVE_STORY', decisionId: pending.id, choiceId: choice.id } : undefined;
}

function coalitionChoice(policyId: PolicyId, state: TermState, scenario: ScenarioDefinition): GameCommand | undefined {
  const pending = state.pendingDecisions.find((decision) => decision.status === 'pending');
  if (!pending) return undefined;
  const authored = pending.choiceIds
    .map((id) => scenario.decisionChoices.find((choice) => choice.id === id))
    .filter((choice): choice is NonNullable<typeof choice> => choice !== undefined);
  const preference = policyId === 'district-advocate' || policyId === 'district-reward'
      ? ['counter', 'accept', 'reject'] as const
      : ['accept', 'counter', 'reject'] as const;
  for (const action of preference) {
    for (const choice of authored.filter((entry) => entry.action === action)) {
      const preview = previewDecision(state, scenario, pending.id, choice.id);
      if (preview.accepted) {
        return {
          type: 'RESOLVE_DECISION',
          decisionId: pending.id,
          choiceId: choice.id,
          expectedBillRevision: pending.expectedBillRevision,
        };
      }
    }
  }
  return undefined;
}

function currentPack(state: TermState, scenario: ScenarioDefinition): GameCommand | undefined {
  const pack = scenario.weeklyPacks.find((entry) => entry.week === state.week);
  if (!pack || state.revealedPacks.some((entry) => entry.packOccurrenceId === `pack:week:${state.week}`)) {
    return undefined;
  }
  const category = pack.pools[0];
  return category
    ? { type: 'OPEN_PACK', packOccurrenceId: `pack:week:${state.week}`, categoryId: category.id }
    : undefined;
}

function mandatoryWork(policyId: PolicyId, state: TermState, scenario: ScenarioDefinition): GameCommand | undefined {
  const activeCards = new Set(state.activeWork.flatMap((work) => work.cardIds));
  const mandatory = state.obligations
    .filter((obligation) => obligation.mandatory && obligation.status === 'open')
    .filter((obligation) => !obligation.sourceCardInstanceId || !activeCards.has(obligation.sourceCardInstanceId))
    .sort((a, b) => a.due.week - b.due.week || a.due.offsetMs - b.due.offsetMs || a.id.localeCompare(b.id));
  for (const obligation of mandatory) {
    const definition = scenario.obligationDefinitions.find((entry) => entry.id === obligation.sourceId);
    if (definition?.fulfillment.kind !== 'completed-pattern') continue;
    const source = obligation.sourceCardInstanceId
      ?? state.cards.find((card) => card.definitionId === definition.sourceDefinitionId)?.id;
    if (!source) continue;
    const work = findWork(policyId, state, scenario, definition.fulfillment.patternId, source);
    if (work) return work;
  }
  return undefined;
}

function summaryDemand(state: TermState, scenario: ScenarioDefinition): number {
  const activeMandatorySources = new Set(state.activeWork
    .filter((work) => work.kind === 'pattern' && work.patternId === 'pattern-earn-district-endorsement')
    .flatMap((work) => work.cardIds));
  const mandatory = state.obligations.filter((obligation) =>
    obligation.mandatory
    && obligation.status === 'open'
    && (!obligation.sourceCardInstanceId || !activeMandatorySources.has(obligation.sourceCardInstanceId))).length;
  const provisionGap = Math.max(0, 2 - new Set(state.bill.provisionIds).size);
  const available = availableCards(state).filter((card) => {
    const definition = definitionOf(scenario, card);
    return definition?.kind === 'evidence' && card.form === 'summary';
  }).length;
  const inProgress = state.activeWork.filter((work) =>
    work.kind === 'pattern' && work.patternId === 'pattern-summarize-evidence').length;
  return mandatory + provisionGap - available - inProgress;
}

function policyMatchScore(
  policyId: PolicyId,
  state: TermState,
  scenario: ScenarioDefinition,
  draftedCardId: string,
): number {
  const card = state.cards.find((entry) => entry.id === draftedCardId);
  const policyIdForCard = card?.policyDefinitionId ?? card?.definitionId;
  const policy = scenario.cards.find((entry) => entry.id === policyIdForCard);
  if (policy?.kind !== 'policy') return 0;
  const promiseMatches = state.relationships.filter((relationship) =>
    relationship.support !== 'committed'
    && relationship.conditions.some((condition) => condition.kind === 'bill-has-tag' && policy.tags.includes(condition.tag))).length;
  const valueScore = state.player.values.reduce((sum, value) => sum + (policy.valueEffects[value] ?? 0), 0);
  const districtScore = policy.tags.some((tag) => ['renter-focused', 'fair-access', 'rural-housing', 'tribal-housing'].includes(tag)) ? 1 : 0;
  return promiseMatches * 100
    + (policyId === 'district-advocate' || policyId === 'district-reward' ? districtScore * 10 : 0)
    + (policyId === 'greedy-same-party' ? valueScore * 10 : valueScore);
}

function draftWork(policyId: PolicyId, state: TermState, scenario: ScenarioDefinition): GameCommand | undefined {
  if (new Set(state.bill.provisionIds).size >= 2 || state.week < 3) return undefined;
  const candidates = candidateCardIds(
    state,
    scenario,
    scenario.patterns.find((entry) => entry.id === 'pattern-draft-policy')!,
  ).sort((a, b) => {
    const draftedA = a.find((id) => definitionOf(scenario, state.cards.find((card) => card.id === id)!)?.kind === 'policy')!;
    const draftedB = b.find((id) => definitionOf(scenario, state.cards.find((card) => card.id === id)!)?.kind === 'policy')!;
    return policyMatchScore(policyId, state, scenario, draftedB) - policyMatchScore(policyId, state, scenario, draftedA)
      || staffRank(policyId, state, scenario, a) - staffRank(policyId, state, scenario, b)
      || a.join('|').localeCompare(b.join('|'));
  });
  return candidates[0] ? { type: 'SUBMIT_WORK', cardIds: candidates[0] } : undefined;
}

function outreachWork(policyId: PolicyId, state: TermState, scenario: ScenarioDefinition): GameCommand | undefined {
  // A player cannot know the cost/reward of a still-running office response. Wait
  // for the revealed choice before committing the next unit of Political Capital.
  if (state.activeWork.some((work) =>
    work.kind === 'pattern' && work.patternId === 'pattern-shared-interest-outreach')) return undefined;
  if (state.resources.politicalCapital < 2) return undefined;
  const interested = new Set(state.relationships
    .filter((relationship) => relationship.support === 'interested')
    .map((relationship) => relationship.memberId));
  const pattern = scenario.patterns.find((entry) => entry.id === 'pattern-shared-interest-outreach');
  if (!pattern) return undefined;
  const candidates = candidateCardIds(state, scenario, pattern).filter((ids) => ids.some((id) => {
    const card = state.cards.find((entry) => entry.id === id);
    return card ? interested.has(card.definitionId) : false;
  }));
  candidates.sort((a, b) => {
    const officeParty = (ids: string[]) => {
      const office = ids.map((id) => state.cards.find((card) => card.id === id))
        .map((card) => card && definitionOf(scenario, card))
        .find((definition) => definition?.kind === 'coalition');
      return office?.kind === 'coalition' ? office.officialRecord.party : undefined;
    };
    const preferred = policyId === 'greedy-same-party' || policyId === 'coalition-broker';
    const sameA = officeParty(a) === state.player.party ? 0 : 1;
    const sameB = officeParty(b) === state.player.party ? 0 : 1;
    return (preferred ? sameA - sameB : 0)
      || staffRank(policyId, state, scenario, a) - staffRank(policyId, state, scenario, b)
      || a.join('|').localeCompare(b.join('|'));
  });
  return candidates[0] ? { type: 'SUBMIT_WORK', cardIds: candidates[0] } : undefined;
}

function tacticWork(policyId: PolicyId, state: TermState, scenario: ScenarioDefinition): GameCommand | undefined {
  const tacticDefinitionId = TACTIC_BY_POLICY[policyId];
  if (!tacticDefinitionId || state.week < 2) return undefined;
  const tactic = availableCards(state).find((card) => card.definitionId === tacticDefinitionId);
  if (!tactic) return undefined;
  const expansion = scenario.tacticExpansions.find((entry) => entry.tacticDefinitionId === tacticDefinitionId);
  if (!expansion || (state.unlockedSlotExpansions[expansion.targetPatternId] ?? []).includes(expansion.id)) return undefined;
  const staff = availableCards(state)
    .filter((card) => definitionOf(scenario, card)?.kind === 'staff')
    .sort((a, b) => staffRank(policyId, state, scenario, [a.id]) - staffRank(policyId, state, scenario, [b.id]) || a.id.localeCompare(b.id))[0];
  return staff ? {
    type: 'START_ASSIGNMENT',
    assignmentKind: 'study-tactic',
    staffCardId: staff.id,
    targetCardId: tactic.id,
  } : undefined;
}

/**
 * A player-equivalent policy boundary. It reads visible cards, revealed packs,
 * pending choices, commitments, resources and authored public rules. It never
 * reads runVariation, rngCursor, unopened pack contents or future Story draws.
 */
export function chooseCommand(
  policyId: PolicyId,
  state: TermState,
  scenario: ScenarioDefinition,
): GameCommand {
  if (state.runStatus === 'complete') return { type: 'CONCLUDE_SESSION' };
  if (state.storyHistory.length === 0) return { type: 'DRAW_STORY_EVENT' };
  const story = storyChoice(policyId, state, scenario);
  if (story) return story;
  const decision = coalitionChoice(policyId, state, scenario);
  if (decision) return decision;
  const pack = currentPack(state, scenario);
  if (pack) return pack;
  if (state.weekPhase === 'boundary') {
    return state.week === 6
      ? { type: 'CONCLUDE_SESSION' }
      : { type: 'ADVANCE_WEEK' };
  }

  const mandatory = mandatoryWork(policyId, state, scenario);
  if (mandatory) return mandatory;

  const drafted = availableCards(state)
    .filter((card) => card.form === 'drafted' && card.policyDefinitionId)
    .sort((a, b) => policyMatchScore(policyId, state, scenario, b.id) - policyMatchScore(policyId, state, scenario, a.id)
      || a.id.localeCompare(b.id))[0];
  if (drafted && !state.bill.provisionIds.includes(drafted.policyDefinitionId!)) {
    return { type: 'DOCKET_PROVISION', cardId: drafted.id };
  }

  if (summaryDemand(state, scenario) > 0) {
    const summary = findWork(policyId, state, scenario, 'pattern-summarize-evidence');
    if (summary) return summary;
  }

  const draft = draftWork(policyId, state, scenario);
  if (draft) return draft;

  const outreach = outreachWork(policyId, state, scenario);
  if (outreach) return outreach;

  const tactic = tacticWork(policyId, state, scenario);
  if (tactic) return tactic;

  return { type: 'FAST_FORWARD' };
}
