import { describe, expect, it } from 'vitest';

import { executeCommand, type EngineServices } from '@/domain/engine';
import { createInitialState } from '@/domain/initialState';
import type { GameCommand } from '@/domain/commands';
import type { GameEvent } from '@/domain/events';
import type { TermState } from '@/domain/types';
import { testScenario } from '@/test/fixtures/scenario';

const services: EngineServices = { scenario: testScenario };

function makeState(definitionIds: string[], overrides: Partial<TermState> = {}): TermState {
  const base = createInitialState({
    scenario: testScenario,
    seed: 412,
    districtId: 'GA-05',
    party: 'democratic',
    values: ['Tenant Stability', 'Fair Access'],
  });

  const cards = definitionIds.map((definitionId, index) => ({
    id: `card-${index + 1}`,
    definitionId,
    stackId: `stack-${index + 1}`,
    x: 100 * (index + 1),
    y: 300,
    remainingMs: 0,
    status: 'idle' as const,
  }));

  return {
    ...base,
    cards,
    stacks: cards.map((card) => ({ id: card.stackId, cardIds: [card.id] })),
    ...overrides,
  };
}

function run(state: TermState, ...commands: GameCommand[]) {
  let current = state;
  const events: GameEvent[] = [];
  for (const command of commands) {
    const result = executeCommand(current, command, services);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

function typesOf(events: GameEvent[]): string[] {
  return events.map((event) => event.type);
}

function expectOneStackPerCard(state: TermState) {
  for (const card of state.cards) {
    const owners = state.stacks.filter((stack) => stack.cardIds.includes(card.id));
    expect(owners).toHaveLength(1);
    expect(card.stackId).toBe(owners[0].id);
  }
  const stacked = state.stacks.flatMap((stack) => stack.cardIds);
  expect(new Set(stacked).size).toBe(stacked.length);
}

describe('STACK_CARD', () => {
  const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
  const stackCommand: GameCommand = { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' };

  it('accepts a valid stack and starts the timed action', () => {
    const { state, events } = run(start, stackCommand);

    expect(typesOf(events)).toContain('STACK_ACCEPTED');
    expect(typesOf(events)).toContain('ACTION_STARTED');
    expect(state.stacks).toHaveLength(1);
    expect(state.stacks[0].cardIds).toHaveLength(2);
    expect(state.stacks[0].activeActionId).toBe('pattern-evidence-summary');
    expect(state.cards.every((card) => card.status === 'working')).toBe(true);
    expectOneStackPerCard(state);
  });

  it('deducts only the validated cost', () => {
    const { state } = run(start, stackCommand);

    expect(state.resources.staffAttention).toBe(start.resources.staffAttention - 1);
    expect(state.resources.politicalCapital).toBe(start.resources.politicalCapital);
    expect(state.resources.districtTrust).toBe(start.resources.districtTrust);
  });

  it('records the discovery exactly once and emits PATTERN_DISCOVERED only on first use', () => {
    const first = run(start, stackCommand);

    expect(first.state.discoveredPatternIds).toEqual(['pattern-evidence-summary']);
    expect(typesOf(first.events).filter((t) => t === 'PATTERN_DISCOVERED')).toHaveLength(1);

    // A second, independent stack of the same pattern must not duplicate either.
    const second = makeState(['staff-policy-aide', 'evidence-tenant-survey'], {
      discoveredPatternIds: ['pattern-evidence-summary'],
    });
    const reuse = run(second, stackCommand);

    expect(reuse.state.discoveredPatternIds).toEqual(['pattern-evidence-summary']);
    expect(typesOf(reuse.events)).not.toContain('PATTERN_DISCOVERED');
    expect(typesOf(reuse.events)).toContain('STACK_ACCEPTED');
  });

  it('accepts both housing Evidence cards through the same pattern', () => {
    const withSurvey = makeState(['staff-policy-aide', 'evidence-tenant-survey']);
    const { state } = run(withSurvey, stackCommand);

    expect(state.stacks[0].activeActionId).toBe('pattern-evidence-summary');
  });

  describe('rejection is free', () => {
    const noMatch = makeState(['policy-housing-choice-voucher', 'coalition-office-fifth-district']);
    const attempt: GameCommand = { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' };

    it('emits STACK_REJECTED with a machine reason and a player message', () => {
      const { events } = run(noMatch, attempt);
      const rejection = events.find((event) => event.type === 'STACK_REJECTED');

      expect(rejection).toBeDefined();
      if (rejection?.type !== 'STACK_REJECTED') throw new Error('expected STACK_REJECTED');
      expect(rejection.reason).toBe('no-matching-pattern');
      expect(rejection.message.length).toBeGreaterThan(0);
    });

    it('leaves the state deeply equal', () => {
      const before = structuredClone(noMatch);
      const { state } = run(noMatch, attempt);

      expect(state).toEqual(before);
      expect(state.resources).toEqual(before.resources);
      expect(state.elapsedMs).toBe(before.elapsedMs);
      expect(state.discoveredPatternIds).toEqual(before.discoveredPatternIds);
      expect(state.unlockedSlotExpansions).toEqual(before.unlockedSlotExpansions);
      expect(state.eventLog).toEqual(before.eventLog);
    });
  });

  it('rejects rather than charging when a cost cannot be paid', () => {
    const broke = makeState(['staff-policy-aide', 'evidence-rent-burden-report'], {
      resources: {
        staffAttention: 0,
        politicalCapital: 3,
        districtTrust: 60,
        billMomentum: 10,
        policyIntegrity: 60,
        staffMorale: 70,
      },
    });
    const before = structuredClone(broke);
    const { state, events } = run(broke, stackCommand);
    const rejection = events.find((event) => event.type === 'STACK_REJECTED');

    if (rejection?.type !== 'STACK_REJECTED') throw new Error('expected STACK_REJECTED');
    expect(rejection.reason).toBe('insufficient-resources');
    expect(state).toEqual(before);
  });

  it('rejects a malformed command without touching state', () => {
    const before = structuredClone(start);
    const { state, events } = run(start, {
      type: 'STACK_CARD',
      cardId: 'card-does-not-exist',
      targetStackId: 'stack-2',
    });
    const rejection = events.find((event) => event.type === 'COMMAND_REJECTED');

    if (rejection?.type !== 'COMMAND_REJECTED') throw new Error('expected COMMAND_REJECTED');
    expect(rejection.reason).toBe('unknown-card');
    expect(rejection.message.length).toBeGreaterThan(0);
    expect(state).toEqual(before);
  });

  it('does not mutate the state it was given', () => {
    const before = structuredClone(start);
    run(start, stackCommand);

    expect(start).toEqual(before);
  });
});

describe('SEPARATE_STACK and MOVE_CARD', () => {
  it('separates a card while preserving every card id', () => {
    const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const separated = run(stacked.state, {
      type: 'SEPARATE_STACK',
      stackId: 'stack-2',
      cardId: 'card-1',
      x: 40,
      y: 50,
    });

    expect(separated.state.cards.map((card) => card.id).sort()).toEqual(['card-1', 'card-2']);
    expect(separated.state.stacks).toHaveLength(2);
    expectOneStackPerCard(separated.state);
  });

  it('moves a card while paused and changes only its coordinates', () => {
    const start = makeState(['staff-policy-aide']);
    expect(start.paused).toBe(true);

    const { state, events } = run(start, { type: 'MOVE_CARD', cardId: 'card-1', x: 12, y: 34 });

    expect(typesOf(events)).toContain('CARD_MOVED');
    expect(state.cards[0].x).toBe(12);
    expect(state.cards[0].y).toBe(34);
    expect(state.elapsedMs).toBe(start.elapsedMs);
    expect(state.resources).toEqual(start.resources);
  });
});

describe('ACTIVATE_TACTIC', () => {
  const start = makeState([
    'institution-working-bill',
    'coalition-office-fourth-district',
    'tactic-bipartisan-working-group',
  ]);
  const activate: GameCommand = {
    type: 'ACTIVATE_TACTIC',
    tacticCardId: 'card-3',
    expansionId: 'expansion-bipartisan-outreach',
  };

  it('records the expansion under its target pattern and consumes the Tactic', () => {
    const { state, events } = run(start, activate);

    expect(typesOf(events)).toContain('TACTIC_EXPANSION_ACTIVATED');
    expect(state.unlockedSlotExpansions).toEqual({
      'pattern-coalition-outreach': ['expansion-bipartisan-outreach'],
    });
    expect(state.cards.some((card) => card.definitionId === 'tactic-bipartisan-working-group')).toBe(
      false,
    );
    expectOneStackPerCard(state);
  });

  it('makes the previously rejected opposing-party stack valid for the rest of the term', () => {
    const outreach: GameCommand = {
      type: 'STACK_CARD',
      cardId: 'card-1',
      targetStackId: 'stack-2',
    };

    const before = run(start, outreach);
    expect(typesOf(before.events)).toContain('STACK_REJECTED');

    const after = run(start, activate, outreach);
    expect(typesOf(after.events)).toContain('STACK_ACCEPTED');
    expect(after.state.stacks.find((s) => s.activeActionId)?.activeActionId).toBe(
      'pattern-coalition-outreach',
    );
  });

  it('consumes the Tactic card, so it cannot be activated again', () => {
    const once = run(start, activate);
    const twice = executeCommand(once.state, activate, services);
    const rejection = twice.events.find((event) => event.type === 'COMMAND_REJECTED');

    if (rejection?.type !== 'COMMAND_REJECTED') throw new Error('expected COMMAND_REJECTED');
    expect(rejection.reason).toBe('unknown-card');
    expect(twice.state).toEqual(once.state);
  });

  it('refuses a second copy of the same Tactic once the rule is already widened', () => {
    const twoCopies = makeState([
      'institution-working-bill',
      'coalition-office-fourth-district',
      'tactic-bipartisan-working-group',
      'tactic-bipartisan-working-group',
    ]);
    const once = run(twoCopies, activate);
    const twice = executeCommand(
      once.state,
      { type: 'ACTIVATE_TACTIC', tacticCardId: 'card-4', expansionId: 'expansion-bipartisan-outreach' },
      services,
    );
    const rejection = twice.events.find((event) => event.type === 'COMMAND_REJECTED');

    if (rejection?.type !== 'COMMAND_REJECTED') throw new Error('expected COMMAND_REJECTED');
    expect(rejection.reason).toBe('tactic-already-active');
    expect(twice.state).toEqual(once.state);
  });

  it('adds no new pattern and no unlock flag to the catalog', () => {
    const { state } = run(start, activate);

    expect(testScenario.patterns).toHaveLength(4);
    expect(JSON.stringify(testScenario)).not.toContain('requiresUnlock');
    expect(state.discoveredPatternIds).toEqual([]);
  });

  it('never widens a rule by removing a required constraint', () => {
    const { state } = run(start, activate);
    const outreachPattern = testScenario.patterns.find((p) => p.id === 'pattern-coalition-outreach');

    // The bill slot still demands the working-bill tag after the expansion.
    expect(outreachPattern?.slots[0].requiredTags).toEqual(['working-bill']);

    const missingBill = makeState(['policy-housing-choice-voucher', 'coalition-office-fourth-district'], {
      unlockedSlotExpansions: state.unlockedSlotExpansions,
    });
    const attempt = run(missingBill, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });

    expect(typesOf(attempt.events)).toContain('STACK_REJECTED');
  });
});

describe('START_ASSIGNMENT', () => {
  const start = makeState([
    'staff-policy-aide',
    'tactic-bipartisan-working-group',
    'institution-working-bill',
    'coalition-office-fourth-district',
  ]);
  const study: GameCommand = {
    type: 'START_ASSIGNMENT',
    assignmentKind: 'study-tactic',
    staffCardId: 'card-1',
    targetCardId: 'card-2',
  };

  it('spends the declared Staff Attention and begins a timed study', () => {
    const { state, events } = run(start, study);
    const started = events.find((event) => event.type === 'ACTION_STARTED');

    if (started?.type !== 'ACTION_STARTED') throw new Error('expected ACTION_STARTED');
    expect(started.assignmentKind).toBe('study-tactic');
    expect(started.durationMs).toBe(8_000);
    expect(state.resources.staffAttention).toBe(start.resources.staffAttention - 1);
    expect(state.cards[0].status).toBe('working');
    expect(state.cards[1].status).toBe('working');
    expectOneStackPerCard(state);
  });

  it('does not activate the expansion until the study completes', () => {
    const { state } = run(start, study);

    expect(state.unlockedSlotExpansions).toEqual({});
  });

  it('refuses ineligible Staff without charging anything', () => {
    const wrongStaff = makeState(['staff-district-director', 'tactic-bipartisan-working-group']);
    const before = structuredClone(wrongStaff);
    const { state, events } = run(wrongStaff, {
      type: 'START_ASSIGNMENT',
      assignmentKind: 'study-tactic',
      staffCardId: 'card-1',
      targetCardId: 'card-2',
    });
    const rejection = events.find((event) => event.type === 'COMMAND_REJECTED');

    if (rejection?.type !== 'COMMAND_REJECTED') throw new Error('expected COMMAND_REJECTED');
    expect(rejection.reason).toBe('ineligible-staff');
    expect(state).toEqual(before);
  });

  it('offers card-work as the keyboard equivalent of dragging one card onto another', () => {
    const desk = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const { state, events } = run(desk, {
      type: 'START_ASSIGNMENT',
      assignmentKind: 'card-work',
      staffCardId: 'card-1',
      targetCardId: 'card-2',
    });

    expect(typesOf(events)).toContain('STACK_ACCEPTED');
    expect(state.stacks.find((s) => s.activeActionId)?.activeActionId).toBe(
      'pattern-evidence-summary',
    );
  });
});

describe('TICK and SET_PAUSED', () => {
  it('advances elapsed time only while unpaused', () => {
    const start = makeState(['staff-policy-aide']);

    const whilePaused = run(start, { type: 'TICK', deltaMs: 500 });
    expect(whilePaused.state.elapsedMs).toBe(0);

    const running = run(start, { type: 'SET_PAUSED', paused: false }, { type: 'TICK', deltaMs: 500 });
    expect(running.state.elapsedMs).toBe(500);
  });

  it('clamps an out-of-range delta', () => {
    const start = makeState(['staff-policy-aide']);
    const running = run(
      start,
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', deltaMs: 99_999 },
      { type: 'TICK', deltaMs: -50 },
    );

    expect(running.state.elapsedMs).toBe(1_000);
  });

  it('counts an active assignment down toward completion', () => {
    const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const stacked = run(
      start,
      { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', deltaMs: 1_000 },
    );

    expect(stacked.state.cards.every((card) => card.remainingMs === 5_000)).toBe(true);
  });

  it('announces a pause change', () => {
    const start = makeState(['staff-policy-aide']);
    const { events } = run(start, { type: 'SET_PAUSED', paused: false });

    expect(typesOf(events)).toContain('PAUSE_CHANGED');
  });
});
