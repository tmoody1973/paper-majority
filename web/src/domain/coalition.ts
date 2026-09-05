import type { GameEvent } from '@/domain/events';
import { applyResourceDelta } from '@/domain/resources';
import type {
  DecisionChoiceDefinition,
  DemandConditionDefinition,
  RelationshipState,
  Resources,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';
import { demandForOffice } from '@/domain/variation';

export function positiveDecisionResourceEffects(
  choice: DecisionChoiceDefinition | undefined,
): Partial<Resources> {
  return choice?.effects.reduce((deltas, effect) => {
    if (effect.kind === 'resource' && effect.resource !== 'policyIntegrity' && effect.delta > 0) {
      deltas[effect.resource] = (deltas[effect.resource] ?? 0) + effect.delta;
    }
    return deltas;
  }, {} as Partial<Resources>) ?? {};
}

function definitionTags(state: TermState, scenario: ScenarioDefinition, provisionIds: string[]): Set<string> {
  return new Set(provisionIds.flatMap((provisionId) =>
    scenario.cards.find((card) => card.id === provisionId)?.tags ?? [],
  ));
}

export function relationshipConditionSatisfied(
  state: TermState,
  scenario: ScenarioDefinition,
  memberId: string,
  condition: DemandConditionDefinition,
  provisionIds = state.bill.provisionIds,
  expectedConcernId?: string,
): boolean {
  if (condition.kind === 'governing-value') return state.player.values.includes(condition.value);
  if (condition.kind === 'bill-has-tag') {
    return definitionTags(state, scenario, provisionIds).has(condition.tag);
  }
  return state.cards.some((card) => {
    if (card.location === 'archived' || card.status !== 'idle' || card.form !== 'prepared') return false;
    const definition = scenario.cards.find((candidate) => candidate.id === card.definitionId);
    if (!definition?.tags.includes(condition.tag)) return false;
    return card.origin?.authoredConcern?.recipientOfficeDefinitionId === memberId
      && (!expectedConcernId || card.origin.authoredConcern.concernId === expectedConcernId);
  });
}

/** Recompute simulated support while preserving immutable office records and promise identity. */
export function evaluateRelationships(
  state: TermState,
  scenario: ScenarioDefinition,
): RelationshipState[] {
  const previous = new Map(state.relationships.map((relationship) => [relationship.memberId, relationship]));
  return scenario.cards
    .filter((card) => card.kind === 'coalition')
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((office) => {
      const existing = previous.get(office.id);
      const demand = demandForOffice(state, scenario, office.id);
      if (!existing) {
        return {
          memberId: office.id,
          support: demand || office.tags.includes('housing-interest') ? 'interested' : 'unavailable',
          demandProvisionId: demand?.id,
          promiseOccurrenceIds: [],
          conditions: [],
          evaluatedRevision: state.bill.revision,
        };
      }
      if (existing.support === 'refused') {
        return { ...existing, evaluatedRevision: state.bill.revision };
      }
      if (existing.promiseOccurrenceIds.length === 0) {
        return {
          ...existing,
          support: demand || office.tags.includes('housing-interest') ? 'interested' : 'unavailable',
          evaluatedRevision: state.bill.revision,
        };
      }
      const fulfilled = existing.conditions.every((condition) =>
        relationshipConditionSatisfied(
          state,
          scenario,
          office.id,
          condition,
          state.bill.provisionIds,
          demand?.evidenceConcernId,
        ),
      );
      return {
        ...existing,
        support: fulfilled ? 'committed' : 'conditional',
        evaluatedRevision: state.bill.revision,
      };
    });
}

export function promiseChangeEvents(
  before: RelationshipState[],
  after: RelationshipState[],
): Extract<GameEvent, { type: 'PROMISE_CHANGED' }>[] {
  const prior = new Map(before.map((relationship) => [relationship.memberId, relationship]));
  const events: Extract<GameEvent, { type: 'PROMISE_CHANGED' }>[] = [];
  for (const relationship of after) {
    const previous = prior.get(relationship.memberId);
    for (const occurrenceId of relationship.promiseOccurrenceIds) {
      const wasPresent = previous?.promiseOccurrenceIds.includes(occurrenceId) ?? false;
      if (!wasPresent) {
        events.push({
          type: 'PROMISE_CHANGED',
          promiseOccurrenceId: occurrenceId,
          status: relationship.support === 'committed' ? 'fulfilled' : 'open',
        });
      } else if (previous?.support !== relationship.support) {
        if (relationship.support === 'committed') {
          events.push({ type: 'PROMISE_CHANGED', promiseOccurrenceId: occurrenceId, status: 'fulfilled' });
        } else if (previous?.support === 'committed') {
          events.push({ type: 'PROMISE_CHANGED', promiseOccurrenceId: occurrenceId, status: 'broken' });
        }
      }
    }
  }
  return events;
}

/**
 * The single promise-evaluation boundary used by decisions, work completion, bill
 * edits and (in Task 6) time transitions. A fulfillment occurrence enters the
 * reward ledger once, at the same transition that emits `fulfilled`.
 */
export function applyRelationshipEvaluation(
  state: TermState,
  scenario: ScenarioDefinition,
  before: RelationshipState[] = state.relationships,
  contextEvents: GameEvent[] = [],
): { state: TermState; events: GameEvent[] } {
  const relationships = evaluateRelationships(state, scenario);
  const promiseEvents = promiseChangeEvents(before, relationships);
  const rewarded = new Set(state.rewardedOccurrenceIds);
  let resources = state.resources;
  const events: GameEvent[] = [];
  const decisionEvents = [...state.eventLog, ...contextEvents].filter(
    (event) => event.type === 'DECISION_RESOLVED',
  );

  for (const event of promiseEvents) {
    events.push(event);
    if (event.status !== 'fulfilled' || rewarded.has(event.promiseOccurrenceId)) continue;
    rewarded.add(event.promiseOccurrenceId);
    const resolution = decisionEvents.find(
      (candidate) => candidate.type === 'DECISION_RESOLVED'
        && candidate.occurrenceId === event.promiseOccurrenceId,
    );
    const choice = resolution?.type === 'DECISION_RESOLVED'
      ? scenario.decisionChoices.find((candidate) => candidate.id === resolution.choiceId)
      : undefined;
    const requested = positiveDecisionResourceEffects(choice);
    const reward = applyResourceDelta(resources, requested);
    resources = reward.resources;
    if (Object.values(reward.applied).some((amount) => amount !== 0)) {
      events.push({
        type: 'RESOURCE_CHANGED',
        changes: reward.applied,
        reason: `promise-fulfilled:${event.promiseOccurrenceId}`,
      });
    }
  }

  return {
    state: {
      ...state,
      relationships,
      resources,
      rewardedOccurrenceIds: [...rewarded].sort(),
    },
    events,
  };
}
