import { describe, expect, it } from 'vitest';

import { getCandidateScenario } from '@/content/loadScenario';
import { createRun } from '@/domain/runSetup';
import { drawStoryEvent, eligibleStoryEvents, resolveStoryEvent } from '@/domain/storyDirector';
import { executeCommand } from '@/domain/engine';

describe('Story Director', () => {
  const scenario = getCandidateScenario();
  const makeState = () => createRun({
    scenario,
    districtId: 'GA-05',
    party: 'democratic',
    values: ['Tenant Stability', 'Housing Supply'],
    mode: 'session',
    seed: 417,
  });

  it('draws one deterministic occurrence and consumes RNG only on the draw', () => {
    const a = drawStoryEvent(makeState(), scenario);
    const b = drawStoryEvent(makeState(), scenario);
    expect(a.state.pendingStoryDecisions).toEqual(b.state.pendingStoryDecisions);
    expect(a.state.rngCursor).toBe(makeState().rngCursor + 1);
    expect(drawStoryEvent(a.state, scenario).state).toBe(a.state);
  });

  it('applies an affordable choice once and rejects duplicate resolution', () => {
    const drawn = drawStoryEvent(makeState(), scenario);
    const pending = drawn.state.pendingStoryDecisions[0];
    const event = scenario.storyEvents.find((entry) => entry.id === pending.storyEventId)!;
    const choice = event.choices.find((entry) => Object.values(entry.cost).every((amount) => (amount ?? 0) === 0))!;
    const resolved = resolveStoryEvent(drawn.state, scenario, pending.id, choice.id);
    expect(resolved.state.pendingStoryDecisions[0].status).toBe('resolved');
    expect(resolveStoryEvent(resolved.state, scenario, pending.id, choice.id).state).toBe(resolved.state);
  });

  it('keeps an unavailable paid choice pending and exposes a zero-cost fallback', () => {
    const drawn = drawStoryEvent(makeState(), scenario);
    const pending = drawn.state.pendingStoryDecisions[0];
    const event = scenario.storyEvents.find((entry) => entry.id === pending.storyEventId)!;
    const paid = event.choices.find((choice) => Object.values(choice.cost).some((amount) => (amount ?? 0) > 0))!;
    const fallback = event.choices.find((choice) => Object.values(choice.cost).every((amount) => (amount ?? 0) === 0));
    expect(fallback).toBeDefined();
    const empty = {
      ...drawn.state,
      resources: {
        staffAttention: 0,
        politicalCapital: 0,
        districtTrust: 0,
        billMomentum: 0,
        policyIntegrity: 0,
        staffMorale: 0,
      },
    };
    const rejected = resolveStoryEvent(empty, scenario, pending.id, paid.id);
    expect(rejected.state).toBe(empty);
    expect(rejected.events).toContainEqual(expect.objectContaining({
      type: 'COMMAND_REJECTED', reason: 'insufficient-resources',
    }));
    const resolved = resolveStoryEvent(empty, scenario, pending.id, fallback!.id);
    expect(resolved.state.pendingStoryDecisions[0].status).toBe('resolved');
  });

  it('blocks resume and ticks while a Story decision is pending', () => {
    const drawn = drawStoryEvent(makeState(), scenario).state;
    const resumed = executeCommand(drawn, { type: 'SET_PAUSED', paused: false }, { scenario });
    expect(resumed.state).toBe(drawn);
    expect(resumed.events).toContainEqual(expect.objectContaining({ reason: 'pending-decision' }));
    const tampered = { ...drawn, paused: false };
    expect(executeCommand(tampered, { type: 'TICK', deltaMs: 100 }, { scenario }).state).toBe(tampered);
  });

  it('authors an always-affordable resolution for every Story event', () => {
    for (const event of scenario.storyEvents) {
      expect(event.choices.some((choice) => Object.values(choice.cost).every((amount) => amount === 0))).toBe(true);
    }
  });

  it('forces recovery after two pressure/consequence occurrences and avoids a repeated pressure category', () => {
    const base = makeState();
    const pressured = {
      ...base,
      week: 3,
      eventLog: [
        ...base.eventLog,
        { type: 'EVENT_TRIGGERED' as const, storyEventId: 'story-pressure-renter-calls', occurrenceId: 'story-pressure-renter-calls:week:2:draw:1', whyRules: ['test'] },
        { type: 'EVENT_TRIGGERED' as const, storyEventId: 'story-consequence-stalled-bill', occurrenceId: 'story-consequence-stalled-bill:week:3:draw:2', whyRules: ['test'] },
      ],
    };
    expect(eligibleStoryEvents(pressured, scenario).every((event) => event.class === 'recovery')).toBe(true);
    const once = { ...base, week: 3, eventLog: [
      ...base.eventLog,
      { type: 'EVENT_TRIGGERED' as const, storyEventId: 'story-pressure-renter-calls', occurrenceId: 'story-pressure-renter-calls:week:3:draw:1', whyRules: ['test'] },
    ] };
    expect(eligibleStoryEvents(once, scenario).filter((event) => event.class === 'pressure' || event.class === 'consequence'))
      .not.toContainEqual(expect.objectContaining({ pressureCategory: 'district' }));
  });
});
