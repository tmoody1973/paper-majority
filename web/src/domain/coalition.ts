import type { GameEvent } from '@/domain/events';
import type {
  DemandConditionDefinition,
  RelationshipState,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

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
): boolean {
  if (condition.kind === 'governing-value') return state.player.values.includes(condition.value);
  if (condition.kind === 'bill-has-tag') {
    return definitionTags(state, scenario, provisionIds).has(condition.tag);
  }
  return state.cards.some((card) => {
    if (card.location === 'archived' || card.status !== 'idle' || card.form !== 'prepared') return false;
    const definition = scenario.cards.find((candidate) => candidate.id === card.definitionId);
    if (!definition?.tags.includes(condition.tag)) return false;
    return card.origin?.authoredConcern?.recipientOfficeDefinitionId === memberId;
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
      const demand = scenario.demandDefinitions.find((candidate) => candidate.officeDefinitionId === office.id);
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
        relationshipConditionSatisfied(state, scenario, office.id, condition),
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
): GameEvent[] {
  const prior = new Map(before.map((relationship) => [relationship.memberId, relationship]));
  const events: GameEvent[] = [];
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
