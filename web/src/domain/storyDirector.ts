import type { EngineResult } from '@/domain/engine';
import type { GameEvent } from '@/domain/events';
import { applyResourceDelta } from '@/domain/resources';
import { createRng } from '@/domain/rng';
import type { ScenarioDefinition, StoryCondition, StoryEventDefinition, TermState } from '@/domain/types';

function satisfies(state: TermState, condition: StoryCondition): boolean {
  switch (condition.kind) {
    case 'metric': {
      const value = state.resources[condition.metric];
      if (condition.op === 'lt') return value < condition.value;
      if (condition.op === 'lte') return value <= condition.value;
      if (condition.op === 'gte') return value >= condition.value;
      return value > condition.value;
    }
    case 'week': return state.week >= condition.min && state.week <= condition.max;
    case 'stage': return condition.anyOf.includes(state.bill.stage);
    case 'hasProvision': return state.bill.provisionIds.includes(condition.provisionId);
    case 'relationshipCount': {
      const count = state.relationships.filter((relationship) => relationship.support === condition.support).length;
      return condition.op === 'gte' ? count >= condition.value : count < condition.value;
    }
  }
}
function triggeredEvents(state: TermState): Array<{ definition: string; week: number }> {
  return state.eventLog.flatMap((event) => {
    if (event.type !== 'EVENT_TRIGGERED') return [];
    const match = event.occurrenceId.match(/:week:(\d+):/);
    return [{ definition: event.storyEventId, week: Number(match?.[1] ?? state.week) }];
  });
}

function pressureRun(state: TermState, scenario: ScenarioDefinition): StoryEventDefinition[] {
  const byId = new Map(scenario.storyEvents.map((event) => [event.id, event]));
  const history = state.eventLog
    .filter((event) => event.type === 'EVENT_TRIGGERED')
    .map((event) => byId.get(event.storyEventId))
    .filter((event): event is StoryEventDefinition => event !== undefined);
  const run: StoryEventDefinition[] = [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const event = history[index];
    if (event.class !== 'pressure' && event.class !== 'consequence') break;
    run.unshift(event);
  }
  return run;
}

/** Eligibility applies conditions, cooldowns, forced recovery and pressure-category repetition in order. */
export function eligibleStoryEvents(
  state: TermState,
  scenario: ScenarioDefinition,
): StoryEventDefinition[] {
  const history = triggeredEvents(state);
  const pressure = pressureRun(state, scenario);
  const lastPressure = pressure.at(-1);
  let candidates = scenario.storyEvents.filter((event) =>
    state.week >= event.minWeek
      && state.week <= event.maxWeek
      && event.conditions.every((condition) => satisfies(state, condition)),
  );
  candidates = candidates.filter((event) => {
    const last = [...history].reverse().find((entry) => entry.definition === event.id);
    return !last || state.week - last.week > event.cooldownWeeks;
  });
  if (pressure.length >= 2) {
    const recoveries = candidates.filter((event) => event.class === 'recovery');
    const fallback = scenario.storyEvents.filter((event) =>
      event.class === 'recovery' && event.conditions.length === 0 && state.week >= event.minWeek && state.week <= event.maxWeek,
    );
    candidates = recoveries.length > 0 ? recoveries : fallback;
  } else if (lastPressure?.pressureCategory) {
    candidates = candidates.filter((event) =>
      event.class !== 'pressure' && event.class !== 'consequence'
        || event.pressureCategory !== lastPressure.pressureCategory,
    );
  }
  return [...candidates].sort((a, b) => a.id.localeCompare(b.id));
}

function adjustedWeight(state: TermState, event: StoryEventDefinition): number {
  if (state.settings.termStyle === 'district-pulse' && event.pressureCategory === 'district') {
    return event.weight * 2;
  }
  if (state.settings.termStyle === 'breaking-cycle'
    && (event.pressureCategory === 'media' || event.class === 'consequence')) {
    return event.weight * 2;
  }
  return event.weight;
}

function rngAtCursor(state: TermState): () => number {
  const rng = createRng(state.seed);
  for (let index = 0; index < state.rngCursor; index += 1) rng();
  return rng;
}

/** Draw once from stable candidate-ID order and freeze a pending occurrence. */
export function drawStoryEvent(state: TermState, scenario: ScenarioDefinition): EngineResult {
  if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
    return { state, events: [] };
  }
  const candidates = eligibleStoryEvents(state, scenario);
  if (candidates.length === 0) return { state, events: [] };
  const rng = rngAtCursor(state);
  const roll = rng();
  const total = candidates.reduce((sum, event) => sum + adjustedWeight(state, event), 0);
  let cursor = roll * total;
  let selected = candidates.at(-1)!;
  for (const event of candidates) {
    cursor -= adjustedWeight(state, event);
    if (cursor < 0) {
      selected = event;
      break;
    }
  }
  const ordinal = state.eventLog.filter((event) => event.type === 'EVENT_TRIGGERED').length + 1;
  const occurrenceId = `${selected.id}:week:${state.week}:draw:${ordinal}`;
  const decisionId = `story-decision:${occurrenceId}`;
  const pending = {
    id: decisionId,
    storyEventId: selected.id,
    occurrenceId,
    choiceIds: selected.choices.map((choice) => choice.id),
    status: 'pending' as const,
  };
  const events: GameEvent[] = [
    { type: 'EVENT_TRIGGERED', storyEventId: selected.id, occurrenceId, whyRules: [...selected.whyRules] },
    { type: 'STORY_DECISION_PRESENTED', decisionId, storyEventId: selected.id, occurrenceId, choiceIds: [...pending.choiceIds] },
  ];
  const next: TermState = {
    ...state,
    rngCursor: state.rngCursor + 1,
    paused: true,
    storyHistory: [...state.storyHistory, occurrenceId],
    pendingStoryDecisions: [...state.pendingStoryDecisions, pending],
  };
  return { state: { ...next, eventLog: [...next.eventLog, ...events] }, events };
}

export function resolveStoryEvent(
  state: TermState,
  scenario: ScenarioDefinition,
  decisionId: string,
  choiceId: string,
): EngineResult {
  const pending = state.pendingStoryDecisions.find((entry) => entry.id === decisionId && entry.status === 'pending');
  const event = pending && scenario.storyEvents.find((entry) => entry.id === pending.storyEventId);
  const choice = event?.choices.find((entry) => entry.id === choiceId);
  if (!pending || !event || !choice || !pending.choiceIds.includes(choiceId)) {
    return { state, events: [{ type: 'COMMAND_REJECTED', commandType: 'RESOLVE_STORY', reason: 'unknown-choice', message: 'That Story choice is no longer available.' }] };
  }
  const affordable = (Object.entries(choice.cost) as [keyof typeof state.resources, number][])
    .every(([resource, amount]) => state.resources[resource] >= amount);
  if (!affordable) {
    return { state, events: [{ type: 'COMMAND_REJECTED', commandType: 'RESOLVE_STORY', reason: 'insufficient-resources', message: 'The office cannot pay that Story choice cost.' }] };
  }
  const requested = Object.fromEntries(
    Object.keys(state.resources).map((resource) => {
      const key = resource as keyof typeof state.resources;
      return [key, (choice.effects[key] ?? 0) - (choice.cost[key] ?? 0)];
    }),
  );
  const changed = applyResourceDelta(state.resources, requested);
  const events: GameEvent[] = [{
    type: 'STORY_DECISION_RESOLVED',
    decisionId,
    storyEventId: event.id,
    choiceId,
    occurrenceId: pending.occurrenceId,
  }];
  if (Object.values(changed.applied).some((amount) => amount !== 0)) {
    events.push({ type: 'RESOURCE_CHANGED', changes: changed.applied, reason: `story:${pending.occurrenceId}` });
  }
  const next: TermState = {
    ...state,
    resources: changed.resources,
    pendingStoryDecisions: state.pendingStoryDecisions.map((entry) =>
      entry.id === decisionId ? { ...entry, status: 'resolved' as const } : entry,
    ),
  };
  return { state: { ...next, eventLog: [...next.eventLog, ...events] }, events };
}
