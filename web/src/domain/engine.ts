import type { GameCommand, GameCommandType } from '@/domain/commands';
import type { GameEvent, RejectionReason } from '@/domain/events';
import { resolvePatternOutput } from '@/domain/patternResolvers';
import { buildMatchInputs, matchPattern } from '@/domain/recipes';
import type {
  CardInstance,
  RecipePattern,
  Resources,
  ScenarioDefinition,
  StackState,
  TacticExpansionDefinition,
  TermState,
} from '@/domain/types';

export interface EngineServices {
  scenario: ScenarioDefinition;
}

export interface EngineResult {
  state: TermState;
  events: GameEvent[];
}

/** A TICK may never jump further than this, however long the browser was asleep. */
const MAX_TICK_MS = 1_000;

/**
 * A Study Tactic assignment is stored in the existing `activeActionId` field with a
 * reserved prefix, so it travels through saves and replays like any other action and
 * needs no parallel assignment table.
 */
const STUDY_PREFIX = 'study:';

export function studyActionId(expansionId: string): string {
  return `${STUDY_PREFIX}${expansionId}`;
}

export function parseStudyActionId(actionId: string | undefined): string | undefined {
  if (!actionId?.startsWith(STUDY_PREFIX)) return undefined;
  return actionId.slice(STUDY_PREFIX.length);
}

// ---------------------------------------------------------------------------
// Result helpers. A rejection returns the ORIGINAL state object: no resource,
// no elapsed time, no discovery and no expansion may change on a failed attempt.
// ---------------------------------------------------------------------------

function rejectCommand(
  state: TermState,
  commandType: GameCommandType,
  reason: RejectionReason,
  message: string,
): EngineResult {
  return { state, events: [{ type: 'COMMAND_REJECTED', commandType, reason, message }] };
}

function rejectStack(
  state: TermState,
  cardIds: string[],
  targetStackId: string | undefined,
  reason: RejectionReason,
  message: string,
): EngineResult {
  return { state, events: [{ type: 'STACK_REJECTED', cardIds, targetStackId, reason, message }] };
}

function accept(state: TermState, next: TermState, events: GameEvent[]): EngineResult {
  return { state: { ...next, eventLog: [...next.eventLog, ...events] }, events };
}

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function findCard(state: TermState, cardId: string): CardInstance | undefined {
  return state.cards.find((card) => card.id === cardId);
}

function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return (Object.entries(cost) as [keyof Resources, number][]).every(
    ([key, amount]) => resources[key] >= amount,
  );
}

function payCost(resources: Resources, cost: Partial<Resources>): Resources {
  const next = { ...resources };
  for (const [key, amount] of Object.entries(cost) as [keyof Resources, number][]) {
    next[key] -= amount;
  }
  return next;
}

/** Move one card into a target stack, dropping any stack that is left empty. */
function mergeIntoStack(
  stacks: StackState[],
  cardId: string,
  targetStackId: string,
): StackState[] {
  return stacks
    .map((stack) => {
      if (stack.id === targetStackId) {
        return stack.cardIds.includes(cardId)
          ? stack
          : { ...stack, cardIds: [...stack.cardIds, cardId] };
      }
      if (stack.cardIds.includes(cardId)) {
        return { ...stack, cardIds: stack.cardIds.filter((id) => id !== cardId) };
      }
      return stack;
    })
    .filter((stack) => stack.cardIds.length > 0);
}

function activeExpansionIds(state: TermState): string[] {
  return Object.values(state.unlockedSlotExpansions).flat();
}

function findExpansion(
  scenario: ScenarioDefinition,
  expansionId: string,
): TacticExpansionDefinition | undefined {
  return scenario.tacticExpansions.find((expansion) => expansion.id === expansionId);
}

function isExpansionActive(state: TermState, expansion: TacticExpansionDefinition): boolean {
  return (state.unlockedSlotExpansions[expansion.targetPatternId] ?? []).includes(expansion.id);
}

/**
 * The single pure activation helper.
 *
 * Both `ACTIVATE_TACTIC` and a completed Study Tactic assignment route through this
 * function, so the two paths can never drift apart.
 */
export function applyTacticExpansion(
  state: TermState,
  expansion: TacticExpansionDefinition,
  tacticCardId: string,
): { state: TermState; event: GameEvent } {
  const existing = state.unlockedSlotExpansions[expansion.targetPatternId] ?? [];
  const tacticStackId = findCard(state, tacticCardId)?.stackId;

  return {
    state: {
      ...state,
      cards: state.cards
        .filter((card) => card.id !== tacticCardId)
        .map((card) =>
          card.stackId === tacticStackId ? { ...card, status: 'idle', remainingMs: 0 } : card,
        ),
      stacks: state.stacks
        .map((stack) =>
          stack.id === tacticStackId
            ? {
                ...stack,
                cardIds: stack.cardIds.filter((id) => id !== tacticCardId),
                activeActionId: undefined,
              }
            : stack,
        )
        .filter((stack) => stack.cardIds.length > 0),
      unlockedSlotExpansions: {
        ...state.unlockedSlotExpansions,
        [expansion.targetPatternId]: [...existing, expansion.id],
      },
    },
    event: {
      type: 'TACTIC_EXPANSION_ACTIVATED',
      expansionId: expansion.id,
      tacticDefinitionId: expansion.tacticDefinitionId,
      targetPatternId: expansion.targetPatternId,
    },
  };
}

/**
 * Clamp resources to their approved ranges.
 *
 * Staff Attention and Political Capital are small counters; the four percentage
 * meters live on a 0–100 scale.
 */
function clampResources(resources: Resources): Resources {
  const bound = (value: number, low: number, high: number) =>
    Math.min(high, Math.max(low, value));

  return {
    staffAttention: bound(resources.staffAttention, 0, 9),
    politicalCapital: bound(resources.politicalCapital, 0, 9),
    districtTrust: bound(resources.districtTrust, 0, 100),
    billMomentum: bound(resources.billMomentum, 0, 100),
    policyIntegrity: bound(resources.policyIntegrity, 0, 100),
    staffMorale: bound(resources.staffMorale, 0, 100),
  };
}

function addEffects(resources: Resources, effects: Partial<Resources>): Resources {
  const next = { ...resources };
  for (const [key, amount] of Object.entries(effects) as [keyof Resources, number][]) {
    next[key] += amount;
  }
  return clampResources(next);
}

/**
 * Finish one action whose cards have all reached zero.
 *
 * Staff Attention is a concurrency limit rather than a currency, so whatever the
 * action held is released here. Political Capital and the percentage meters are
 * real spends and are not returned.
 */
function completeAction(
  state: TermState,
  stackId: string,
  services: EngineServices,
): { state: TermState; events: GameEvent[] } {
  const stack = state.stacks.find((candidate) => candidate.id === stackId);
  if (!stack?.activeActionId) return { state, events: [] };

  const memberCards = stack.cardIds
    .map((id) => findCard(state, id))
    .filter((card): card is CardInstance => card !== undefined);

  const studyExpansionId = parseStudyActionId(stack.activeActionId);

  if (studyExpansionId) {
    const expansion = findExpansion(services.scenario, studyExpansionId);
    const tacticCard = memberCards.find(
      (card) => card.definitionId === expansion?.tacticDefinitionId,
    );
    if (!expansion || !tacticCard) return { state, events: [] };

    const released: Partial<Resources> = { staffAttention: expansion.studyCost };
    const applied = applyTacticExpansion(
      { ...state, resources: addEffects(state.resources, released) },
      expansion,
      tacticCard.id,
    );

    return {
      state: applied.state,
      events: [
        { type: 'RESOURCE_CHANGED', changes: released, reason: `study-complete:${expansion.id}` },
        applied.event,
      ],
    };
  }

  const pattern = services.scenario.patterns.find(
    (candidate) => candidate.id === stack.activeActionId,
  );
  if (!pattern) return { state, events: [] };

  const inputs = buildMatchInputs(memberCards, services.scenario, state.player.party);
  const found = matchPattern(
    inputs,
    [pattern],
    activeExpansionIds(state),
    services.scenario.tacticExpansions,
  );
  if (!found) return { state, events: [] };

  const resolved = resolvePatternOutput(found, inputs);
  const anchor = memberCards[0];
  const seq = state.cardSeq + 1;
  const producedId = `card-${seq}`;
  const producedStackId = `stack-${producedId}`;

  const released: Partial<Resources> = pattern.resourceCost.staffAttention
    ? { staffAttention: pattern.resourceCost.staffAttention }
    : {};
  const changes = { ...resolved.effects };
  for (const [key, amount] of Object.entries(released) as [keyof Resources, number][]) {
    changes[key] = (changes[key] ?? 0) + amount;
  }

  const consumedIds = memberCards.map((card) => card.id);
  const next: TermState = {
    ...state,
    cardSeq: seq,
    resources: addEffects(state.resources, changes),
    cards: [
      ...state.cards.filter((card) => !consumedIds.includes(card.id)),
      {
        id: producedId,
        definitionId: resolved.definitionId,
        stackId: producedStackId,
        x: anchor.x,
        y: anchor.y,
        remainingMs: 0,
        status: 'idle',
      },
    ],
    stacks: [
      ...state.stacks.filter((candidate) => candidate.id !== stackId),
      { id: producedStackId, cardIds: [producedId] },
    ],
  };

  return {
    state: next,
    events: [
      {
        type: 'CARD_TRANSFORMED',
        stackId,
        consumedCardIds: consumedIds,
        producedCardIds: [producedId],
        outputDefinitionId: resolved.definitionId,
        explanationKey: resolved.explanationKey,
      },
      { type: 'RESOURCE_CHANGED', changes, reason: `pattern-complete:${pattern.id}` },
    ],
  };
}

/**
 * Start an accepted pattern: pay the validated cost, put the inputs to work and
 * record the discovery exactly once. The transformation itself completes later,
 * on TICK.
 */
function startPattern(
  state: TermState,
  pattern: RecipePattern,
  targetStackId: string,
  memberCardIds: string[],
): EngineResult {
  const alreadyDiscovered = state.discoveredPatternIds.includes(pattern.id);
  const events: GameEvent[] = [
    {
      type: 'STACK_ACCEPTED',
      stackId: targetStackId,
      cardIds: memberCardIds,
      definitionIds: memberCardIds
        .map((id) => state.cards.find((card) => card.id === id)?.definitionId ?? id)
        .sort(),
      patternId: pattern.id,
    },
  ];

  if (Object.keys(pattern.resourceCost).length > 0) {
    events.push({
      type: 'RESOURCE_CHANGED',
      changes: pattern.resourceCost,
      reason: `pattern:${pattern.id}`,
    });
  }
  if (!alreadyDiscovered) {
    events.push({ type: 'PATTERN_DISCOVERED', patternId: pattern.id });
  }
  events.push({
    type: 'ACTION_STARTED',
    stackId: targetStackId,
    durationMs: pattern.durationMs,
    patternId: pattern.id,
  });

  const next: TermState = {
    ...state,
    resources: payCost(state.resources, pattern.resourceCost),
    cards: state.cards.map((card) =>
      memberCardIds.includes(card.id)
        ? { ...card, stackId: targetStackId, status: 'working', remainingMs: pattern.durationMs }
        : card,
    ),
    stacks: state.stacks.map((stack) =>
      stack.id === targetStackId ? { ...stack, activeActionId: pattern.id } : stack,
    ),
    discoveredPatternIds: alreadyDiscovered
      ? state.discoveredPatternIds
      : [...state.discoveredPatternIds, pattern.id],
  };

  return accept(state, next, events);
}

/**
 * The shared combine path used by both dragging a card onto a stack and the
 * keyboard-accessible `card-work` assignment.
 */
function combine(
  state: TermState,
  services: EngineServices,
  commandType: GameCommandType,
  cardId: string,
  targetStackId: string,
): EngineResult {
  const moving = findCard(state, cardId);
  if (!moving) {
    return rejectCommand(state, commandType, 'unknown-card', 'That card is no longer on the desk.');
  }

  const targetStack = state.stacks.find((stack) => stack.id === targetStackId);
  if (!targetStack) {
    return rejectCommand(state, commandType, 'unknown-stack', 'That spot is no longer there.');
  }
  if (targetStack.cardIds.includes(cardId)) {
    return rejectCommand(
      state,
      commandType,
      'malformed-command',
      'That card is already in this stack.',
    );
  }

  const memberCardIds = [...targetStack.cardIds, cardId];
  const members = memberCardIds
    .map((id) => findCard(state, id))
    .filter((card): card is CardInstance => card !== undefined);

  if (members.some((card) => card.status === 'expired')) {
    return rejectStack(state, memberCardIds, targetStackId, 'card-expired', 'That card has expired.');
  }
  if (members.some((card) => card.status === 'working')) {
    return rejectStack(state, memberCardIds, targetStackId, 'card-busy', 'That work is still under way.');
  }

  const inputs = buildMatchInputs(members, services.scenario, state.player.party);
  const found = matchPattern(
    inputs,
    services.scenario.patterns,
    activeExpansionIds(state),
    services.scenario.tacticExpansions,
  );

  if (!found) {
    // Free experimentation: nothing is spent and nothing is remembered.
    return rejectStack(
      state,
      memberCardIds,
      targetStackId,
      'no-matching-pattern',
      'These cards do not work together yet.',
    );
  }

  if (!canAfford(state.resources, found.pattern.resourceCost)) {
    return rejectStack(
      state,
      memberCardIds,
      targetStackId,
      'insufficient-resources',
      'The office does not have the capacity for that right now.',
    );
  }

  const withMerge: TermState = { ...state, stacks: mergeIntoStack(state.stacks, cardId, targetStackId) };
  return startPattern(withMerge, found.pattern, targetStackId, memberCardIds);
}

function startStudyTactic(
  state: TermState,
  services: EngineServices,
  staffCardId: string,
  tacticCardId: string,
): EngineResult {
  const staff = findCard(state, staffCardId);
  const tactic = findCard(state, tacticCardId);
  if (!staff || !tactic) {
    return rejectCommand(state, 'START_ASSIGNMENT', 'unknown-card', 'That card is no longer on the desk.');
  }

  const expansion = services.scenario.tacticExpansions.find(
    (candidate) => candidate.tacticDefinitionId === tactic.definitionId,
  );
  if (!expansion) {
    return rejectCommand(
      state,
      'START_ASSIGNMENT',
      'unknown-tactic-expansion',
      'That card is not a Tactic your office can study.',
    );
  }

  const staffDefinition = services.scenario.cards.find((card) => card.id === staff.definitionId);
  const eligible =
    staffDefinition?.kind === 'staff' &&
    expansion.eligibleStaffTags.some((tag) => staffDefinition.tags.includes(tag));
  if (!eligible) {
    return rejectCommand(
      state,
      'START_ASSIGNMENT',
      'ineligible-staff',
      'This staffer is not the right person to study that Tactic.',
    );
  }

  if (isExpansionActive(state, expansion)) {
    return rejectCommand(
      state,
      'START_ASSIGNMENT',
      'tactic-already-active',
      'Your office has already learned that.',
    );
  }

  const cost: Partial<Resources> = { staffAttention: expansion.studyCost };
  if (!canAfford(state.resources, cost)) {
    return rejectCommand(
      state,
      'START_ASSIGNMENT',
      'insufficient-resources',
      'No staffer is free to take that on right now.',
    );
  }

  const targetStackId = tactic.stackId;
  const memberCardIds = [tacticCardId, staffCardId];
  const events: GameEvent[] = [
    {
      type: 'STACK_ACCEPTED',
      stackId: targetStackId,
      cardIds: memberCardIds,
      definitionIds: [tactic.definitionId, staff.definitionId].sort(),
    },
    { type: 'RESOURCE_CHANGED', changes: cost, reason: `study:${expansion.id}` },
    {
      type: 'ACTION_STARTED',
      stackId: targetStackId,
      durationMs: expansion.studyDurationMs,
      assignmentKind: 'study-tactic',
    },
  ];

  const next: TermState = {
    ...state,
    resources: payCost(state.resources, cost),
    cards: state.cards.map((card) =>
      memberCardIds.includes(card.id)
        ? {
            ...card,
            stackId: targetStackId,
            status: 'working',
            remainingMs: expansion.studyDurationMs,
          }
        : card,
    ),
    stacks: mergeIntoStack(state.stacks, staffCardId, targetStackId).map((stack) =>
      stack.id === targetStackId ? { ...stack, activeActionId: studyActionId(expansion.id) } : stack,
    ),
  };

  return accept(state, next, events);
}

// ---------------------------------------------------------------------------
// The command boundary
// ---------------------------------------------------------------------------

export function executeCommand(
  state: TermState,
  command: GameCommand,
  services: EngineServices,
): EngineResult {
  switch (command.type) {
    case 'STACK_CARD':
      return combine(state, services, 'STACK_CARD', command.cardId, command.targetStackId);

    case 'SEPARATE_STACK': {
      const card = findCard(state, command.cardId);
      const stack = state.stacks.find((candidate) => candidate.id === command.stackId);
      if (!card || !stack || !stack.cardIds.includes(command.cardId)) {
        return rejectCommand(state, command.type, 'unknown-card', 'That card is not in this stack.');
      }
      // Pulling a card out of a running assignment cancels that assignment and
      // returns every participant to idle. The cost already paid is not refunded;
      // the office did start the work.
      const cancelling = Boolean(stack.activeActionId);
      const participants = new Set(stack.cardIds);

      const newStackId = `stack-${command.cardId}`;
      const next: TermState = {
        ...state,
        cards: state.cards.map((candidate) => {
          if (candidate.id === command.cardId) {
            return {
              ...candidate,
              stackId: newStackId,
              x: command.x,
              y: command.y,
              status: cancelling ? ('idle' as const) : candidate.status,
              remainingMs: cancelling ? 0 : candidate.remainingMs,
            };
          }
          if (cancelling && participants.has(candidate.id)) {
            return { ...candidate, status: 'idle' as const, remainingMs: 0 };
          }
          return candidate;
        }),
        stacks: [
          ...state.stacks
            .map((candidate) =>
              candidate.id === command.stackId
                ? {
                    ...candidate,
                    cardIds: candidate.cardIds.filter((id) => id !== command.cardId),
                    activeActionId: undefined,
                  }
                : candidate,
            )
            .filter((candidate) => candidate.cardIds.length > 0),
          { id: newStackId, cardIds: [command.cardId] },
        ],
      };

      return accept(state, next, [
        { type: 'CARD_MOVED', cardId: command.cardId, x: command.x, y: command.y },
      ]);
    }

    case 'MOVE_CARD': {
      const card = findCard(state, command.cardId);
      if (!card) {
        return rejectCommand(state, command.type, 'unknown-card', 'That card is no longer on the desk.');
      }

      // Deliberately permitted while paused: planning is not a timed activity.
      const next: TermState = {
        ...state,
        cards: state.cards.map((candidate) =>
          candidate.id === command.cardId
            ? { ...candidate, x: command.x, y: command.y }
            : candidate,
        ),
      };

      return accept(state, next, [
        { type: 'CARD_MOVED', cardId: command.cardId, x: command.x, y: command.y },
      ]);
    }

    case 'START_ASSIGNMENT': {
      if (command.assignmentKind === 'study-tactic') {
        return startStudyTactic(state, services, command.staffCardId, command.targetCardId);
      }
      const target = findCard(state, command.targetCardId);
      if (!target) {
        return rejectCommand(state, command.type, 'unknown-card', 'That card is no longer on the desk.');
      }
      return combine(state, services, 'START_ASSIGNMENT', command.staffCardId, target.stackId);
    }

    case 'ACTIVATE_TACTIC': {
      const tactic = findCard(state, command.tacticCardId);
      if (!tactic) {
        return rejectCommand(state, command.type, 'unknown-card', 'That Tactic is no longer on the desk.');
      }

      const expansion = findExpansion(services.scenario, command.expansionId);
      if (!expansion || expansion.tacticDefinitionId !== tactic.definitionId) {
        return rejectCommand(
          state,
          command.type,
          'unknown-tactic-expansion',
          'That Tactic does not change this rule.',
        );
      }

      const targetPattern = services.scenario.patterns.find(
        (pattern) => pattern.id === expansion.targetPatternId,
      );
      if (!targetPattern) {
        return rejectCommand(
          state,
          command.type,
          'unknown-pattern',
          'That Tactic points at a rule this office does not use.',
        );
      }
      if (
        expansion.effect.kind === 'widen-slot' &&
        !targetPattern.slots[expansion.effect.slotIndex]
      ) {
        return rejectCommand(
          state,
          command.type,
          'unknown-tactic-expansion',
          'That Tactic points at a step this rule does not have.',
        );
      }
      if (isExpansionActive(state, expansion)) {
        return rejectCommand(
          state,
          command.type,
          'tactic-already-active',
          'Your office has already learned that.',
        );
      }

      const applied = applyTacticExpansion(state, expansion, command.tacticCardId);
      return accept(state, applied.state, [applied.event]);
    }

    case 'TICK': {
      if (state.paused) return { state, events: [] };

      const delta = Math.min(MAX_TICK_MS, Math.max(0, Math.trunc(command.deltaMs)));
      if (delta === 0) return { state, events: [] };

      let next: TermState = {
        ...state,
        elapsedMs: state.elapsedMs + delta,
        cards: state.cards.map((card) => {
          if (card.remainingMs <= 0) return card;
          const remainingMs = Math.max(0, card.remainingMs - delta);
          // A working card is running an assignment and completes below. A card
          // that is merely time-sensitive — a district concern with a deadline —
          // expires instead.
          if (card.status === 'working') return { ...card, remainingMs };
          return remainingMs === 0
            ? { ...card, remainingMs, status: 'expired' as const }
            : { ...card, remainingMs };
        }),
      };

      // Finish ready actions in stable card-id order so a replay always resolves
      // them the same way.
      const ready = next.stacks
        .filter(
          (stack) =>
            stack.activeActionId &&
            stack.cardIds.every((id) => {
              const card = findCard(next, id);
              return card?.status === 'working' && card.remainingMs === 0;
            }),
        )
        .map((stack) => ({ stack, key: [...stack.cardIds].sort()[0] ?? stack.id }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

      const events: GameEvent[] = [];
      for (const { stack } of ready) {
        const completed = completeAction(next, stack.id, services);
        next = completed.state;
        events.push(...completed.events);
      }

      if (events.length === 0) return { state: next, events: [] };
      return { state: { ...next, eventLog: [...next.eventLog, ...events] }, events };
    }

    case 'SET_PAUSED': {
      if (state.paused === command.paused) return { state, events: [] };
      return accept(state, { ...state, paused: command.paused }, [
        { type: 'PAUSE_CHANGED', paused: command.paused },
      ]);
    }

    default:
      // Real commands that later tasks implement. Rejecting them honestly beats
      // pretending they succeeded.
      return rejectCommand(
        state,
        command.type,
        'unsupported-command',
        'That is not part of this build yet.',
      );
  }
}
