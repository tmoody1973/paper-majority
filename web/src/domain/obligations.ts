import type { GameEvent } from '@/domain/events';
import { applyResourceDelta } from '@/domain/resources';
import type {
  Obligation,
  ObligationDefinition,
  Resources,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

export function obligationOccurrence(
  definition: ObligationDefinition,
  occurrenceId = `week:${definition.due.week}`,
): Obligation {
  return {
    id: `${definition.id}:${occurrenceId}`,
    sourceId: definition.id,
    due: { ...definition.due },
    mandatory: definition.mandatory,
    status: 'open',
    rewardCapital: definition.rewardCapital,
    trustPenalty: definition.trustPenalty,
  };
}

export function dueSimulationMs(state: TermState, obligation: Obligation): number {
  return (obligation.due.week - 1) * state.weekLengthMs + obligation.due.offsetMs;
}

function definitionFor(
  scenario: ScenarioDefinition,
  obligation: Obligation,
): ObligationDefinition | undefined {
  return scenario.obligationDefinitions.find((definition) => definition.id === obligation.sourceId);
}

function creationEventIndex(events: GameEvent[], obligation: Obligation): number {
  const occurrence = obligation.id.slice(`${obligation.sourceId}:`.length);
  return events.findIndex((event) =>
    event.type === 'DECISION_RESOLVED' && event.occurrenceId === occurrence,
  );
}

export function obligationIsFulfilled(
  state: TermState,
  scenario: ScenarioDefinition,
  obligation: Obligation,
  contextEvents: GameEvent[] = [],
): boolean {
  const definition = definitionFor(scenario, obligation);
  if (!definition) return false;
  const fulfillment = definition.fulfillment;
  if (fulfillment.kind === 'docketed-policy-tag') {
    return state.bill.provisionIds.some((id) =>
      scenario.cards.find((card) => card.id === id)?.tags.includes(fulfillment.tag),
    );
  }
  if (fulfillment.kind === 'prepared-evidence-tag') {
    return state.cards.some((card) => {
      if (card.form !== 'prepared' || card.status !== 'idle' || card.location === 'archived') return false;
      return scenario.cards.find((definition) => definition.id === card.definitionId)
        ?.tags.includes(fulfillment.tag) ?? false;
    });
  }

  const completed = [...state.eventLog, ...contextEvents];
  const createdAt = creationEventIndex(completed, obligation);
  return completed.some((event, index) =>
    index > createdAt
      && event.type === 'PATTERN_COMPLETED'
      && event.patternId === fulfillment.patternId,
  );
}

export function fulfillObligations(
  state: TermState,
  scenario: ScenarioDefinition,
  contextEvents: GameEvent[] = [],
): { state: TermState; events: GameEvent[] } {
  const fulfilled = state.obligations
    .filter((obligation) => obligation.status === 'open')
    .filter((obligation) => obligationIsFulfilled(state, scenario, obligation, contextEvents))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (fulfilled.length === 0) return { state, events: [] };

  const rewarded = new Set(state.rewardedOccurrenceIds);
  let resources = state.resources;
  const events: GameEvent[] = [];
  for (const obligation of fulfilled) {
    events.push({
      type: 'OBLIGATION_STATUS_CHANGED',
      obligationId: obligation.id,
      status: 'fulfilled',
    });
    if (rewarded.has(obligation.id)) continue;
    rewarded.add(obligation.id);
    const reward = applyResourceDelta(resources, { politicalCapital: obligation.rewardCapital });
    resources = reward.resources;
    if ((reward.applied.politicalCapital ?? 0) !== 0) {
      events.push({
        type: 'RESOURCE_CHANGED',
        changes: reward.applied,
        reason: `obligation-fulfilled:${obligation.id}`,
      });
    }
  }

  return {
    state: {
      ...state,
      resources,
      obligations: state.obligations.map((obligation) =>
        fulfilled.some((candidate) => candidate.id === obligation.id)
          ? { ...obligation, status: 'fulfilled' as const }
          : obligation,
      ),
      rewardedOccurrenceIds: [...rewarded].sort(),
    },
    events,
  };
}

export function expireObligations(
  state: TermState,
  throughSimulationMs: number,
): { state: TermState; events: GameEvent[] } {
  const expired = state.obligations
    .filter((obligation) => obligation.status === 'open')
    .filter((obligation) => dueSimulationMs(state, obligation) <= throughSimulationMs)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (expired.length === 0) return { state, events: [] };

  const requestedTrust = -expired.reduce(
    (sum, obligation) => sum + (obligation.mandatory ? obligation.trustPenalty : 0),
    0,
  );
  const change = applyResourceDelta(state.resources, { districtTrust: requestedTrust });
  const events: GameEvent[] = expired.map((obligation) => ({
    type: 'OBLIGATION_STATUS_CHANGED',
    obligationId: obligation.id,
    status: obligation.mandatory ? 'missed' : 'declined',
  }));
  if ((change.applied.districtTrust ?? 0) !== 0) {
    events.push({
      type: 'RESOURCE_CHANGED',
      changes: change.applied,
      reason: `obligations-due:${expired.map((obligation) => obligation.id).join(',')}`,
    });
  }
  return {
    state: {
      ...state,
      resources: change.resources,
      obligations: state.obligations.map((obligation) => {
        const due = expired.find((candidate) => candidate.id === obligation.id);
        return due
          ? { ...obligation, status: due.mandatory ? 'missed' as const : 'declined' as const }
          : obligation;
      }),
    },
    events,
  };
}

export function obligationPenaltyPreview(
  state: TermState,
  scenario: ScenarioDefinition,
  throughSimulationMs: number,
): { dueObligationIds: string[]; effects: Partial<Resources> } {
  const due = state.obligations
    .filter((obligation) => obligation.status === 'open')
    .filter((obligation) => dueSimulationMs(state, obligation) <= throughSimulationMs)
    .filter((obligation) => !obligationIsFulfilled(state, scenario, obligation))
    .sort((a, b) => a.id.localeCompare(b.id));
  const preview = applyResourceDelta(state.resources, {
    districtTrust: -due.reduce(
      (sum, obligation) => sum + (obligation.mandatory ? obligation.trustPenalty : 0),
      0,
    ),
  });
  return { dueObligationIds: due.map((obligation) => obligation.id), effects: preview.applied };
}
