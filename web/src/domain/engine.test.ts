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

describe('TICK completes an action', () => {
  function runToCompletion(state: TermState, ms: number) {
    const commands: GameCommand[] = [{ type: 'SET_PAUSED', paused: false }];
    for (let elapsed = 0; elapsed < ms; elapsed += 1_000) {
      commands.push({ type: 'TICK', deltaMs: 1_000 });
    }
    return run(state, ...commands);
  }

  it('transforms the inputs into the resolved output exactly once', () => {
    const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const done = runToCompletion(stacked.state, 6_000);

    const transformed = done.events.filter((event) => event.type === 'CARD_TRANSFORMED');
    expect(transformed).toHaveLength(1);
    if (transformed[0].type !== 'CARD_TRANSFORMED') throw new Error('expected CARD_TRANSFORMED');
    expect(transformed[0].outputDefinitionId).toBe('evidence-housing-summary');

    expect(done.state.cards).toHaveLength(1);
    expect(done.state.cards[0].definitionId).toBe('evidence-housing-summary');
    expect(done.state.cards[0].status).toBe('idle');
    expectOneStackPerCard(done.state);
  });

  it('removes only the consumed inputs and leaves bystanders alone', () => {
    const start = makeState([
      'staff-policy-aide',
      'evidence-rent-burden-report',
      'policy-housing-choice-voucher',
    ]);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const done = runToCompletion(stacked.state, 6_000);

    expect(done.state.cards.map((card) => card.definitionId).sort()).toEqual([
      'evidence-housing-summary',
      'policy-housing-choice-voucher',
    ]);
  });

  it('gives the official report and the local survey different resource results', () => {
    const withReport = runToCompletion(
      run(makeState(['staff-policy-aide', 'evidence-rent-burden-report']), {
        type: 'STACK_CARD',
        cardId: 'card-1',
        targetStackId: 'stack-2',
      }).state,
      6_000,
    );
    const withSurvey = runToCompletion(
      run(makeState(['staff-policy-aide', 'evidence-tenant-survey']), {
        type: 'STACK_CARD',
        cardId: 'card-1',
        targetStackId: 'stack-2',
      }).state,
      6_000,
    );

    expect(withReport.state.resources.billMomentum).toBeGreaterThan(
      withSurvey.state.resources.billMomentum,
    );
    expect(withSurvey.state.resources.districtTrust).toBeGreaterThan(
      withReport.state.resources.districtTrust,
    );
  });

  it('returns the held Staff Attention when the assignment finishes', () => {
    const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    expect(stacked.state.resources.staffAttention).toBe(2);

    const done = runToCompletion(stacked.state, 6_000);
    expect(done.state.resources.staffAttention).toBe(3);
  });

  it('records the discovery once even after the transformation completes', () => {
    const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const done = runToCompletion(stacked.state, 6_000);

    expect(done.state.discoveredPatternIds).toEqual(['pattern-evidence-summary']);
    expect(done.events.filter((e) => e.type === 'PATTERN_DISCOVERED')).toHaveLength(0);
  });

  it('activates the same expansion as ACTIVATE_TACTIC when a study completes', () => {
    const start = makeState([
      'staff-policy-aide',
      'tactic-bipartisan-working-group',
      'institution-working-bill',
      'coalition-office-fourth-district',
    ]);
    const studying = run(start, {
      type: 'START_ASSIGNMENT',
      assignmentKind: 'study-tactic',
      staffCardId: 'card-1',
      targetCardId: 'card-2',
    });
    const done = runToCompletion(studying.state, 8_000);

    expect(typesOf(done.events)).toContain('TACTIC_EXPANSION_ACTIVATED');
    expect(done.state.unlockedSlotExpansions).toEqual({
      'pattern-coalition-outreach': ['expansion-bipartisan-outreach'],
    });
    // No fourth pattern and no parallel unlock system appeared.
    expect(testScenario.patterns).toHaveLength(4);
    expect(done.state.discoveredPatternIds).toEqual([]);

    // The Staff card comes back, and the previously rejected stack now works.
    const aide = done.state.cards.find((card) => card.definitionId === 'staff-policy-aide');
    expect(aide?.status).toBe('idle');
    expect(done.state.resources.staffAttention).toBe(3);

    const outreach = run(done.state, {
      type: 'STACK_CARD',
      cardId: 'card-3',
      targetStackId: 'stack-4',
    });
    expect(typesOf(outreach.events)).toContain('STACK_ACCEPTED');
  });

  it('completes nothing while the clock is paused', () => {
    const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const held = run(stacked.state, { type: 'TICK', deltaMs: 1_000 }, { type: 'TICK', deltaMs: 1_000 });

    expect(typesOf(held.events)).not.toContain('CARD_TRANSFORMED');
    expect(held.state.cards).toHaveLength(2);
  });

  it('is replay-identical for the same seed and command sequence', () => {
    const commands: GameCommand[] = [
      { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' },
      { type: 'SET_PAUSED', paused: false },
      ...Array.from({ length: 6 }, () => ({ type: 'TICK', deltaMs: 1_000 }) as GameCommand),
    ];

    const a = run(makeState(['staff-policy-aide', 'evidence-rent-burden-report']), ...commands);
    const b = run(makeState(['staff-policy-aide', 'evidence-rent-burden-report']), ...commands);

    expect(b.state).toEqual(a.state);
    expect(typesOf(b.events)).toEqual(typesOf(a.events));
  });
});

describe('time-sensitive cards', () => {
  it('counts a deadline card down and expires it without touching the meters', () => {
    const start = makeState(['constituency-urgent-renter-concern']);
    const withDeadline: TermState = {
      ...start,
      cards: start.cards.map((card) => ({ ...card, remainingMs: 2_000 })),
    };

    const midway = run(withDeadline, { type: 'SET_PAUSED', paused: false }, { type: 'TICK', deltaMs: 1_000 });
    expect(midway.state.cards[0].remainingMs).toBe(1_000);
    expect(midway.state.cards[0].status).toBe('idle');

    const done = run(midway.state, { type: 'TICK', deltaMs: 1_000 });
    expect(done.state.cards[0].status).toBe('expired');
    expect(done.state.resources).toEqual(start.resources);
  });

  it('refuses to stack an expired card', () => {
    const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const expired: TermState = {
      ...start,
      cards: start.cards.map((card) =>
        card.id === 'card-2' ? { ...card, status: 'expired' as const } : card,
      ),
    };
    const { events } = run(expired, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const rejection = events.find((event) => event.type === 'STACK_REJECTED');

    if (rejection?.type !== 'STACK_REJECTED') throw new Error('expected STACK_REJECTED');
    expect(rejection.reason).toBe('card-expired');
  });
});

describe('catalyst inputs survive their pattern', () => {
  function runToCompletion(state: TermState, ms: number) {
    const commands: GameCommand[] = [{ type: 'SET_PAUSED', paused: false }];
    for (let elapsed = 0; elapsed < ms; elapsed += 1_000) {
      commands.push({ type: 'TICK', deltaMs: 1_000 });
    }
    return run(state, ...commands);
  }

  it('keeps the Working Bill on the desk after outreach completes', () => {
    const start = makeState(['institution-working-bill', 'coalition-office-fifth-district']);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const done = runToCompletion(stacked.state, 6_000);

    const definitions = done.state.cards.map((card) => card.definitionId).sort();
    expect(definitions).toEqual(['coalition-outreach-result', 'institution-working-bill']);
    expectOneStackPerCard(done.state);
  });

  it('returns the surviving bill to idle in a stack of its own', () => {
    const start = makeState(['institution-working-bill', 'coalition-office-fifth-district']);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const done = runToCompletion(stacked.state, 6_000);

    const bill = done.state.cards.find((c) => c.definitionId === 'institution-working-bill')!;
    expect(bill.status).toBe('idle');
    expect(bill.remainingMs).toBe(0);
    expect(done.state.stacks.find((s) => s.id === bill.stackId)?.cardIds).toEqual([bill.id]);
  });

  it('lets one bill reach a second office, which is the whole point', () => {
    const start = makeState([
      'institution-working-bill',
      'coalition-office-fifth-district',
      'coalition-office-fourth-district',
      'tactic-bipartisan-working-group',
    ]);

    const first = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const afterFirst = runToCompletion(first.state, 6_000);
    const bill = afterFirst.state.cards.find((c) => c.definitionId === 'institution-working-bill')!;
    const opposing = afterFirst.state.cards.find(
      (c) => c.definitionId === 'coalition-office-fourth-district',
    )!;

    // Still refused before the Tactic, and still free.
    const refused = run(afterFirst.state, {
      type: 'STACK_CARD',
      cardId: bill.id,
      targetStackId: opposing.stackId,
    });
    expect(typesOf(refused.events)).toContain('STACK_REJECTED');

    // After the expansion the same bill reaches the second office.
    const tactic = afterFirst.state.cards.find(
      (c) => c.definitionId === 'tactic-bipartisan-working-group',
    )!;
    const activated = run(afterFirst.state, {
      type: 'ACTIVATE_TACTIC',
      tacticCardId: tactic.id,
      expansionId: 'expansion-bipartisan-outreach',
    });
    const retry = run(activated.state, {
      type: 'STACK_CARD',
      cardId: bill.id,
      targetStackId: opposing.stackId,
    });
    expect(typesOf(retry.events)).toContain('STACK_ACCEPTED');
  });

  it('still consumes the inputs of an ordinary pattern', () => {
    const start = makeState(['staff-policy-aide', 'evidence-rent-burden-report']);
    const stacked = run(start, { type: 'STACK_CARD', cardId: 'card-1', targetStackId: 'stack-2' });
    const done = runToCompletion(stacked.state, 6_000);

    expect(done.state.cards.map((c) => c.definitionId)).toEqual(['evidence-housing-summary']);
  });
});
