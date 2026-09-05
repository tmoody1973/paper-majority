import type { EngineResult } from '@/domain/engine';
import type { GameEvent } from '@/domain/events';
import { applyRelationshipEvaluation } from '@/domain/coalition';
import {
  dueSimulationMs,
  expireObligations,
  fulfillObligations,
  obligationPenaltyPreview,
} from '@/domain/obligations';
import { applyResourceDelta } from '@/domain/resources';
import type { Resources, ScenarioDefinition, TermState } from '@/domain/types';

const MAX_STEP_MS = 1_000;

export function weekBoundarySimulationMs(state: TermState): number {
  return state.simulationMs + Math.max(0, state.weekLengthMs - state.elapsedMs);
}

export function nextStopDelta(state: TermState, scenario: ScenarioDefinition): number {
  void scenario;
  if (state.weekPhase === 'boundary' || state.runStatus === 'complete') return 0;
  const boundary = Math.max(0, state.weekLengthMs - state.elapsedMs);
  const work = state.activeWork
    .map((reservation) => Math.max(0, reservation.completesAtSimulationMs - state.simulationMs));
  const deadlines = state.obligations
    .filter((obligation) => obligation.status === 'open')
    .map((obligation) => Math.max(0, dueSimulationMs(state, obligation) - state.simulationMs));
  return Math.min(MAX_STEP_MS, boundary, ...work, ...deadlines);
}

function clutterPenalty(state: TermState): number {
  const capacity = state.week === 6 ? 22 : 18;
  const deskCount = state.cards.filter((card) => card.location === 'desk').length;
  return Math.min(10, Math.max(0, deskCount - capacity));
}

export function previewWeek(
  state: TermState,
  scenario: ScenarioDefinition,
): { dueObligationIds: string[]; effects: Partial<Resources>; carryingWorkIds: string[] } {
  const boundaryMs = weekBoundarySimulationMs(state);
  const obligations = obligationPenaltyPreview(state, scenario, boundaryMs);
  const requested: Partial<Resources> = {
    ...obligations.effects,
    staffMorale: -clutterPenalty(state),
  };
  const applied = applyResourceDelta(state.resources, requested).applied;
  return {
    dueObligationIds: obligations.dueObligationIds,
    effects: Object.fromEntries(Object.entries(applied).filter(([, amount]) => amount !== 0)),
    carryingWorkIds: state.activeWork
      .filter((work) => work.completesAtSimulationMs > boundaryMs)
      .map((work) => work.id)
      .sort(),
  };
}

export function resolveWeek(
  state: TermState,
  scenario: ScenarioDefinition,
  options: { advanceToNextWeek?: boolean } = {},
): EngineResult {
  const resolutionId = `week:${state.week}`;
  if (
    state.weekPhase !== 'boundary'
    || state.resolvedWeekIds.includes(resolutionId)
    || state.pendingDecisions.some((decision) => decision.status === 'pending')
    || state.pendingStoryDecisions.some((decision) => decision.status === 'pending')
  ) {
    return { state, events: [] };
  }

  const events: GameEvent[] = [];
  const relationships = applyRelationshipEvaluation(state, scenario, state.relationships);
  let next = relationships.state;
  events.push(...relationships.events);
  const fulfilled = fulfillObligations(next, scenario);
  next = fulfilled.state;
  events.push(...fulfilled.events);
  const expired = expireObligations(next, weekBoundarySimulationMs(next));
  next = expired.state;
  events.push(...expired.events);

  const morale = applyResourceDelta(next.resources, { staffMorale: -clutterPenalty(next) });
  next = { ...next, resources: morale.resources };
  if ((morale.applied.staffMorale ?? 0) !== 0) {
    events.push({ type: 'RESOURCE_CHANGED', changes: morale.applied, reason: `desk-capacity:${resolutionId}` });
  }

  const resolvedWeekIds = [...next.resolvedWeekIds, resolutionId].sort();
  const summary = events.flatMap((event) => {
    if (event.type === 'OBLIGATION_STATUS_CHANGED') return [`${event.obligationId}: ${event.status}`];
    if (event.type === 'RESOURCE_CHANGED') return [event.reason];
    return [];
  });
  events.push({ type: 'WEEK_RESOLVED', week: state.week, summary });

  if (state.week < 6 && options.advanceToNextWeek !== false) {
    const capital = applyResourceDelta(next.resources, {
      politicalCapital: Math.max(0, 1 - next.resources.politicalCapital),
    });
    next = {
      ...next,
      week: state.week + 1,
      elapsedMs: 0,
      weekPhase: 'active',
      paused: true,
      resources: capital.resources,
      resolvedWeekIds,
    };
    if ((capital.applied.politicalCapital ?? 0) !== 0) {
      events.push({
        type: 'RESOURCE_CHANGED',
        changes: capital.applied,
        reason: `new-week-floor:${next.week}`,
      });
    }
  } else {
    next = { ...next, paused: true, resolvedWeekIds };
  }

  return {
    state: { ...next, eventLog: [...next.eventLog, ...events] },
    events,
  };
}
