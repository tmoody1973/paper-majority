import type { GameCommand, GameCommandType } from '@/domain/commands';
import { previewBillChange, previewDocketProvision } from '@/domain/bill';
import { applyRelationshipEvaluation, evaluateRelationships } from '@/domain/coalition';
import { findRequiredDecisionWorkPlan, planDecisionUpfrontResources, previewDecision } from '@/domain/decisions';
import type { GameEvent, RejectionReason } from '@/domain/events';
import { resolveWorkOutput, resolvePatternOutput } from '@/domain/patternResolvers';
import { openPack } from '@/domain/packs';
import { buildMatchInputs, matchPattern, type MatchInput, type PatternMatch } from '@/domain/recipes';
import { applyResourceDelta } from '@/domain/resources';
import { drawStoryEvent, resolveStoryEvent } from '@/domain/storyDirector';
import { expireObligations, fulfillObligations } from '@/domain/obligations';
import { SESSION_READINESS_MILESTONE_ID, sessionReadiness } from '@/domain/objectives';
import { buildSessionRecord } from '@/domain/sessionRecord';
import { describeTag } from '@/domain/selectors';
import { nextStopDelta, resolveWeek } from '@/domain/week';
import { EFFECTIVE_RULE_VERSION, patternReservation, planWork, sessionCompletionRejection } from '@/domain/work';
import { demandForOffice } from '@/domain/variation';
import type {
  CardInstance,
  ActiveWork,
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
const FILING_SLOTS = 6;

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

function runIsComplete(state: TermState): boolean {
  return state.runStatus === 'complete';
}

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function findCard(state: TermState, cardId: string): CardInstance | undefined {
  return state.cards.find((card) => card.id === cardId);
}

function sourceDefinitionIdsFor(
  cards: CardInstance[],
  scenario: ScenarioDefinition,
): string[] {
  return cards
    .flatMap((card) => {
      if (card.sourceDefinitionIds.length > 0) return card.sourceDefinitionIds;
      return scenario.cards.find((definition) => definition.id === card.definitionId)?.kind === 'evidence'
        ? [card.definitionId]
        : [];
    })
    .filter((id, index, all) => all.indexOf(id) === index)
    .sort();
}

function authoredConcernFor(
  cards: CardInstance[],
  scenario: ScenarioDefinition,
) {
  const references = cards.flatMap((card) => {
    if (card.origin?.authoredConcern) return [card.origin.authoredConcern];
    const definition = scenario.cards.find((candidate) => candidate.id === card.definitionId);
    return definition?.kind === 'constituency' && definition.authoredConcern
      ? [definition.authoredConcern]
      : [];
  }).sort((a, b) => a.concernId.localeCompare(b.concernId));
  const first = references[0];
  return first ? { ...first } : undefined;
}

function outputSourceFor(
  resolved: ReturnType<typeof resolvePatternOutput>,
  match: PatternMatch,
  cards: CardInstance[],
) {
  if (resolved.outputSlotIndex === undefined) return {};
  const assignment = match.assignments.find((candidate) => candidate.slotIndex === resolved.outputSlotIndex);
  const sourceCardId = assignment?.cardInstanceIds[0];
  const source = cards.find((card) => card.id === sourceCardId);
  if (!source) throw new Error(`Resolver output slot ${resolved.outputSlotIndex} has no source card`);
  return {
    outputSlotIndex: resolved.outputSlotIndex,
    outputSourceCardId: source.id,
    outputSourceDefinitionId: source.definitionId,
    outputSourceForm: source.form,
  };
}

function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return (Object.entries(cost) as [keyof Resources, number][]).every(
    ([key, amount]) => resources[key] >= amount,
  );
}

function spend(resources: Resources, cost: Partial<Resources>) {
  return applyResourceDelta(
    resources,
    Object.fromEntries(Object.entries(cost).map(([key, amount]) => [key, -amount])) as Partial<Resources>,
  );
}

function paidFromApplied(applied: Partial<Resources>): Partial<Resources> {
  return Object.fromEntries(
    Object.entries(applied).map(([key, amount]) => [key, -amount]),
  ) as Partial<Resources>;
}

function hasActualResourceChange(changes: Partial<Resources>): boolean {
  return Object.values(changes).some((amount) => amount !== 0);
}

function nextWorkId(state: TermState): string {
  const submitted = state.eventLog.filter((event) => event.type === 'WORK_SUBMITTED').length;
  return `work-${submitted + 1}`;
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

function sessionRejection(
  state: TermState,
  commandType: GameCommandType,
  cardIds: string[],
  reason: string,
  targetStackId?: string,
): EngineResult {
  const code: RejectionReason = /expired/i.test(reason)
    ? 'card-expired'
    : /already working/i.test(reason)
      ? 'card-busy'
      : /capacity|staff slot/i.test(reason)
        ? 'insufficient-resources'
        : /no longer|desk/i.test(reason)
          ? 'unknown-card'
          : 'no-matching-pattern';
  return commandType === 'STACK_CARD'
    ? rejectStack(state, cardIds, targetStackId, code, reason)
    : rejectCommand(state, commandType, code, reason);
}

function startSessionPattern(
  state: TermState,
  services: EngineServices,
  commandType: GameCommandType,
  cardIds: string[],
  targetStackId?: string,
): EngineResult {
  const planned = planWork(state, services.scenario, cardIds);
  if (!('preview' in planned)) {
    return sessionRejection(state, commandType, cardIds, planned.reason, targetStackId);
  }

  if (
    planned.effectivePattern.output.mode === 'derived'
    && planned.effectivePattern.output.resolverId === 'resolve-outreach-v1'
  ) {
    const office = cardIds
      .map((id) => findCard(state, id))
      .find((card) => services.scenario.cards.find((definition) => definition.id === card?.definitionId)?.kind === 'coalition');
    const demand = office ? demandForOffice(state, services.scenario, office.definitionId) : undefined;
    if (!office || !demand) {
      return rejectCommand(state, commandType, 'no-matching-pattern', 'That office has no authored offer in this scenario.');
    }
    const occurrenceId = `${demand.id}:revision:${state.bill.revision}`;
    const alreadyApproached = state.pendingDecisions.some((decision) => decision.occurrenceId === occurrenceId)
      || state.eventLog.some((event) => event.type === 'DECISION_PRESENTED' && event.occurrenceId === occurrenceId);
    if (alreadyApproached) {
      return rejectCommand(state, commandType, 'duplicate-outreach', 'This office has already answered outreach on the current bill revision.');
    }
  }

  const workId = nextWorkId(state);
  const charged = spend(state.resources, planned.preview.cost);
  const paidCost = paidFromApplied(charged.applied);
  const reservation = {
    ...patternReservation(workId, state, planned, cardIds),
    paidCost,
  };
  const alreadyDiscovered = state.discoveredPatternIds.includes(planned.preview.patternId);
  const stackId = targetStackId ?? findCard(state, cardIds[0])?.stackId ?? `work-${workId}`;
  const definitionIds = cardIds
    .map((id) => findCard(state, id)?.definitionId ?? id)
    .sort();
  const events: GameEvent[] = [
    {
      type: 'STACK_ACCEPTED',
      stackId,
      cardIds: [...cardIds],
      definitionIds,
      patternId: planned.preview.patternId,
    },
    {
      type: 'WORK_SUBMITTED',
      workId,
      cardIds: [...reservation.cardIds],
      completesAtSimulationMs: reservation.completesAtSimulationMs,
    },
  ];
  if (hasActualResourceChange(charged.applied)) {
    events.push({
      type: 'RESOURCE_CHANGED',
      changes: charged.applied,
      reason: `pattern:${planned.preview.patternId}`,
    });
  }
  if (!alreadyDiscovered) events.push({ type: 'PATTERN_DISCOVERED', patternId: planned.preview.patternId });
  events.push({
    type: 'ACTION_STARTED',
    stackId,
    durationMs: planned.preview.durationMs,
    patternId: planned.preview.patternId,
    assignmentKind: 'card-work',
  });

  const stacked = cardIds.reduce(
    (stacks, cardId) => mergeIntoStack(stacks, cardId, stackId),
    state.stacks,
  );
  return accept(
    state,
    {
      ...state,
      resources: charged.resources,
      cards: state.cards.map((card) =>
        cardIds.includes(card.id)
          ? { ...card, stackId, status: 'working', remainingMs: 0 }
          : card,
      ),
      stacks: stacked,
      activeWork: [...state.activeWork, reservation],
      discoveredPatternIds: alreadyDiscovered
        ? state.discoveredPatternIds
        : [...state.discoveredPatternIds, planned.preview.patternId],
    },
    events,
  );
}

function cancelSessionWork(
  state: TermState,
  work: ActiveWork,
  separatedCardId: string,
  x: number,
  y: number,
): EngineResult {
  if (work.decisionOrigin) {
    return rejectCommand(
      state,
      'SEPARATE_STACK',
      'pending-decision',
      'Confirmed counteroffer work cannot be cancelled.',
    );
  }
  const attention = work.paidCost.staffAttention ?? 0;
  const released = attention > 0
    ? applyResourceDelta(state.resources, { staffAttention: attention })
    : { resources: state.resources, applied: {} as Partial<Resources> };
  const events: GameEvent[] = [];
  if (hasActualResourceChange(released.applied)) {
    events.push({ type: 'RESOURCE_CHANGED', changes: released.applied, reason: `cancel:${work.id}` });
  }
  const currentStack = state.stacks.find((stack) => stack.cardIds.includes(separatedCardId));
  const newStackId = `stack-${separatedCardId}`;
  const stacks = currentStack && currentStack.cardIds.length > 1
    ? [
        ...state.stacks
          .map((stack) => stack.id === currentStack.id
            ? { ...stack, cardIds: stack.cardIds.filter((id) => id !== separatedCardId) }
            : stack),
        { id: newStackId, cardIds: [separatedCardId] },
      ]
    : state.stacks;
  return accept(
    state,
    {
      ...state,
      resources: released.resources,
      activeWork: state.activeWork.filter((candidate) => candidate.id !== work.id),
      cards: state.cards.map((card) =>
        card.id === separatedCardId
          ? { ...card, stackId: newStackId, x, y, status: 'idle', remainingMs: 0 }
          : work.cardIds.includes(card.id)
            ? { ...card, status: 'idle', remainingMs: 0 }
            : card,
      ),
      stacks,
    },
    events,
  );
}

function startSessionStudy(
  state: TermState,
  services: EngineServices,
  staffCardId: string,
  tacticCardId: string,
): EngineResult {
  const staff = findCard(state, staffCardId);
  const tactic = findCard(state, tacticCardId);
  if (!staff || !tactic || staff.location !== 'desk' || tactic.location !== 'desk') {
    return rejectCommand(state, 'START_ASSIGNMENT', 'unknown-card', 'That card is no longer on the desk.');
  }
  if (staff.status !== 'idle' || tactic.status !== 'idle' || state.activeWork.some((work) => work.cardIds.includes(staffCardId) || work.cardIds.includes(tacticCardId))) {
    return rejectCommand(state, 'START_ASSIGNMENT', 'card-busy', 'That work is still under way.');
  }

  const expansions = services.scenario.tacticExpansions
    .filter((candidate) => candidate.tacticDefinitionId === tactic.definitionId)
    .filter((candidate) => !isExpansionActive(state, candidate))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (expansions.length === 0) {
    return rejectCommand(state, 'START_ASSIGNMENT', 'tactic-already-active', 'Your office has already learned that.');
  }
  const staffDefinition = services.scenario.cards.find((card) => card.id === staff.definitionId);
  const eligible = staffDefinition?.kind === 'staff' && expansions.every((expansion) =>
    expansion.eligibleStaffTags.some((tag) => staffDefinition.tags.includes(tag)),
  );
  if (!eligible) {
    return rejectCommand(state, 'START_ASSIGNMENT', 'ineligible-staff', 'This staffer is not the right person to study that Tactic.');
  }

  const studyCost = Math.max(0, ...expansions.map((expansion) => expansion.studyCost));
  const durationMs = Math.max(1, ...expansions.map((expansion) => expansion.studyDurationMs));
  const timingRejection = sessionCompletionRejection(state, durationMs);
  if (timingRejection) return rejectCommand(state, 'START_ASSIGNMENT', 'invalid-stage', timingRejection);
  const cost: Partial<Resources> = { staffAttention: studyCost };
  const heldAttention = state.activeWork.reduce(
    (sum, work) => sum + (work.paidCost.staffAttention ?? 0),
    0,
  );
  if (heldAttention + studyCost > state.staffCapacity) {
    return rejectCommand(state, 'START_ASSIGNMENT', 'insufficient-resources', 'The office does not have enough staff capacity for that study.');
  }
  if (!canAfford(state.resources, cost)) {
    return rejectCommand(state, 'START_ASSIGNMENT', 'insufficient-resources', 'No staffer is free to take that on right now.');
  }

  const workId = nextWorkId(state);
  const charged = spend(state.resources, cost);
  const reservation: ActiveWork = {
    id: workId,
    kind: 'study',
    cardIds: [staffCardId, tacticCardId].sort(),
    staffCardIds: [staffCardId],
    paidCost: paidFromApplied(charged.applied),
    completesAtSimulationMs: state.simulationMs + durationMs,
    effectiveRuleVersion: EFFECTIVE_RULE_VERSION,
    consumedCardIds: [tacticCardId],
    returnedCardIds: [staffCardId],
    expansionIds: expansions.map((expansion) => expansion.id),
    effectiveExpansions: structuredClone(expansions),
  };
  const events: GameEvent[] = [
    {
      type: 'STACK_ACCEPTED',
      stackId: tactic.stackId,
      cardIds: [tacticCardId, staffCardId],
      definitionIds: [tactic.definitionId, staff.definitionId].sort(),
    },
    {
      type: 'WORK_SUBMITTED',
      workId,
      cardIds: [...reservation.cardIds],
      completesAtSimulationMs: reservation.completesAtSimulationMs,
    },
    { type: 'ACTION_STARTED', stackId: tactic.stackId, durationMs, assignmentKind: 'study-tactic' },
  ];
  if (hasActualResourceChange(charged.applied)) {
    events.splice(2, 0, {
      type: 'RESOURCE_CHANGED',
      changes: charged.applied,
      reason: `study:${reservation.expansionIds.join('+')}`,
    });
  }
  return accept(
    state,
    {
      ...state,
      resources: charged.resources,
      cards: state.cards.map((card) =>
        reservation.cardIds.includes(card.id)
          ? { ...card, stackId: tactic.stackId, status: 'working', remainingMs: 0 }
          : card,
      ),
      stacks: mergeIntoStack(state.stacks, staffCardId, tactic.stackId),
      activeWork: [...state.activeWork, reservation],
    },
    events,
  );
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
                paidCost: undefined,
              }
            : stack,
        )
        .filter((stack) => stack.cardIds.length > 0),
      unlockedSlotExpansions: {
        ...state.unlockedSlotExpansions,
        [expansion.targetPatternId]: Array.from(new Set([...existing, expansion.id])).sort(),
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
 * Would an unstudied Tactic have made this exact stack work?
 *
 * Re-runs the same match with every expansion switched on. If the stack becomes
 * valid, the difference is a Tactic the office has not studied, and that is worth
 * telling the player. Returns the sentence to show, or undefined when nothing the
 * office could learn would help.
 *
 * `describeTag` is shared with the Staff Handbook on purpose: the refusal, the
 * binder and the engine constraint must always use the same words for the same
 * rule.
 */
function blockingTactic(
  inputs: MatchInput[],
  state: TermState,
  services: EngineServices,
): string | undefined {
  const everyExpansion = services.scenario.tacticExpansions.map((expansion) => expansion.id);
  const active = activeExpansionIds(state);
  if (everyExpansion.length === active.length) return undefined;

  const wouldMatch = matchPattern(
    inputs,
    services.scenario.patterns,
    everyExpansion,
    services.scenario.tacticExpansions,
  );
  if (!wouldMatch) return undefined;

  const expansion = services.scenario.tacticExpansions.find(
    (candidate) =>
      !active.includes(candidate.id) && candidate.targetPatternId === wouldMatch.pattern.id,
  );
  if (!expansion || expansion.effect.kind !== 'widen-slot') return undefined;

  const allows = [
    ...(expansion.effect.addAnyTags ?? []).map(describeTag),
    ...(expansion.effect.addSourceClasses ?? []),
  ];
  const tacticTitle =
    services.scenario.cards.find((card) => card.id === expansion.tacticDefinitionId)?.title ??
    'a Tactic';

  const allowance = allows.length > 0 ? ` accept a card ${allows.join(' or ')}` : ' allow this';
  return `Not yet. Studying ${tacticTitle} would let this rule${allowance}. Nothing was spent.`;
}

/**
 * What an in-flight assignment is currently holding.
 *
 * Staff Attention is a concurrency limit, not a wallet, so it is held for the life
 * of an assignment and must come back whether that assignment finishes or is
 * cancelled (decision 002). Political Capital and the percentage meters are real
 * spends and are never returned by this function.
 */
function heldAttention(
  stack: StackState,
  services: EngineServices,
): Partial<Resources> {
  const paidAttention = stack.paidCost?.staffAttention;
  if (stack.paidCost) {
    return paidAttention && paidAttention > 0 ? { staffAttention: paidAttention } : {};
  }

  const { activeActionId } = stack;
  if (!activeActionId) return {};

  const studyExpansionId = parseStudyActionId(activeActionId);
  if (studyExpansionId) {
    const expansion = findExpansion(services.scenario, studyExpansionId);
    return expansion ? { staffAttention: expansion.studyCost } : {};
  }

  const pattern = services.scenario.patterns.find((candidate) => candidate.id === activeActionId);
  return pattern?.resourceCost.staffAttention
    ? { staffAttention: pattern.resourceCost.staffAttention }
    : {};
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

    const released = heldAttention(stack, services);
    const release = applyResourceDelta(state.resources, released);
    const applied = applyTacticExpansion(
      { ...state, resources: release.resources },
      expansion,
      tacticCard.id,
    );

    return {
      state: applied.state,
      events: [
        {
          type: 'RESOURCE_CHANGED',
          changes: release.applied,
          reason: `study-complete:${expansion.id}`,
        },
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
  const outputSource = outputSourceFor(resolved, found, memberCards);
  const anchor = memberCards[0];
  const seq = state.cardSeq + 1;
  const producedId = `card-${seq}`;
  const producedStackId = `stack-${producedId}`;

  const released = heldAttention(stack, services);
  const requested = { ...resolved.effects };
  for (const [key, amount] of Object.entries(released) as [keyof Resources, number][]) {
    requested[key] = (requested[key] ?? 0) + amount;
  }
  const change = applyResourceDelta(state.resources, requested);

  // A catalyst slot takes part in the rule but is not used up. The Working Bill is
  // the obvious one: approaching a member office must not destroy your bill.
  const survivingIds = new Set(
    found.assignments
      .filter((assignment) => found.pattern.slots[assignment.slotIndex]?.consumed === false)
      .flatMap((assignment) => assignment.cardInstanceIds),
  );
  const consumedIds = memberCards
    .map((card) => card.id)
    .filter((id) => !survivingIds.has(id));
  const authoredConcern = authoredConcernFor(memberCards, services.scenario);

  const survivors = memberCards
    .filter((card) => survivingIds.has(card.id))
    .map((card, index) => ({
      ...card,
      status: 'idle' as const,
      remainingMs: 0,
      stackId: `stack-${card.id}`,
      // Set the returned card down beside the result rather than under it.
      x: anchor.x - 210 * (index + 1),
      y: anchor.y,
    }));

  const next: TermState = {
    ...state,
    cardSeq: seq,
    resources: change.resources,
    cards: [
      ...state.cards.filter(
        (card) => !consumedIds.includes(card.id) && !survivingIds.has(card.id),
      ),
      ...survivors,
      {
        id: producedId,
        definitionId: resolved.definitionId,
        stackId: producedStackId,
        x: anchor.x,
        y: anchor.y,
        remainingMs: 0,
        status: 'idle',
        form: resolved.form ?? 'raw',
        location: 'desk',
        sourceDefinitionIds: sourceDefinitionIdsFor(memberCards, services.scenario),
        policyDefinitionId:
          services.scenario.cards.find((definition) => definition.id === resolved.definitionId)?.kind ===
          'policy'
            ? resolved.definitionId
            : memberCards.find((card) => card.policyDefinitionId)?.policyDefinitionId,
        // The transformation knows exactly what went in; keep it, sorted, so two
        // outputs of the same definition from different sources stay tellable
        // apart and replay stays deterministic.
        origin: {
          explanationKey: resolved.explanationKey,
          inputDefinitionIds: memberCards.map((card) => card.definitionId).sort(),
          consumedDefinitionIds: memberCards
            .filter((card) => consumedIds.includes(card.id))
            .map((card) => card.definitionId)
            .sort(),
          authoredConcern: authoredConcernFor(memberCards, services.scenario),
        },
      },
    ],
    stacks: [
      ...state.stacks.filter((candidate) => candidate.id !== stackId),
      ...survivors.map((card) => ({ id: card.stackId, cardIds: [card.id] })),
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
        returnedCardIds: survivors.map((card) => card.id),
        outputDefinitionId: resolved.definitionId,
        outputForm: resolved.form ?? 'raw',
        producerPatternId: pattern.id,
        ...outputSource,
        inputDefinitionIds: memberCards.map((card) => card.definitionId).sort(),
        consumedDefinitionIds: memberCards.filter((card) => consumedIds.includes(card.id))
          .map((card) => card.definitionId).sort(),
        authoredConcernId: authoredConcern?.concernId,
        authoredConcernOfficeDefinitionId: authoredConcern?.recipientOfficeDefinitionId,
        explanationKey: resolved.explanationKey,
      },
      {
        type: 'RESOURCE_CHANGED',
        changes: change.applied,
        reason: `pattern-complete:${pattern.id}`,
      },
    ],
  };
}

/** Older valid saves may contain overlapping approaches accepted before reservation protection. */
function recoverUnavailableOutreach(state: TermState, work: ActiveWork): EngineResult {
  const refund = applyResourceDelta(state.resources, work.paidCost);
  const events: GameEvent[] = [{
    type: 'WORK_RECOVERED', workId: work.id, cardIds: [...work.cardIds],
    reason: 'office-offer-unavailable', refundedCost: refund.applied,
  }];
  if (hasActualResourceChange(refund.applied)) events.push({
    type: 'RESOURCE_CHANGED', changes: refund.applied, reason: `recover:${work.id}`,
  });
  // Return the actual pile unchanged in identity, form, provenance and position.
  // Timeline appends these events once; this helper must not call accept().
  return { state: {
    ...state, resources: refund.resources,
    activeWork: state.activeWork.filter((candidate) => candidate.id !== work.id),
    cards: state.cards.map((card) => work.cardIds.includes(card.id)
      ? { ...card, status: 'idle', remainingMs: 0 } : card),
    stacks: state.stacks.map((stack) => work.cardIds.some((id) => stack.cardIds.includes(id))
      ? { ...stack, activeActionId: undefined, paidCost: undefined } : stack),
  }, events };
}

function completeSessionWork(
  state: TermState,
  work: ActiveWork,
  services: EngineServices,
): { state: TermState; events: GameEvent[] } {
  const attention = work.paidCost.staffAttention ?? 0;
  const release = attention > 0
    ? applyResourceDelta(state.resources, { staffAttention: attention })
    : { resources: state.resources, applied: {} as Partial<Resources> };

  if (work.kind === 'study') {
    const tacticId = work.consumedCardIds[0];
    const unlocked = { ...state.unlockedSlotExpansions };
    const activationEvents: GameEvent[] = [];
    for (const expansion of [...work.effectiveExpansions].sort((a, b) => a.id.localeCompare(b.id))) {
      unlocked[expansion.targetPatternId] = Array.from(
        new Set([...(unlocked[expansion.targetPatternId] ?? []), expansion.id]),
      ).sort();
      activationEvents.push({
        type: 'TACTIC_EXPANSION_ACTIVATED',
        expansionId: expansion.id,
        tacticDefinitionId: expansion.tacticDefinitionId,
        targetPatternId: expansion.targetPatternId,
      });
    }
    const nextCards = state.cards
      .filter((card) => card.id !== tacticId)
      .map((card) => work.returnedCardIds.includes(card.id)
        ? { ...card, status: 'idle' as const, remainingMs: 0 }
        : card);
    const nextStacks = state.stacks
      .map((stack) => ({ ...stack, cardIds: stack.cardIds.filter((id) => id !== tacticId) }))
      .filter((stack) => stack.cardIds.length > 0);
    const events: GameEvent[] = [];
    if (hasActualResourceChange(release.applied)) {
      events.push({ type: 'RESOURCE_CHANGED', changes: release.applied, reason: `study-complete:${work.id}` });
    }
    events.push(...activationEvents);
    return {
      state: {
        ...state,
        resources: release.resources,
        cards: nextCards,
        stacks: nextStacks,
        activeWork: state.activeWork.filter((candidate) => candidate.id !== work.id),
        unlockedSlotExpansions: unlocked,
      },
      events,
    };
  }

  const memberCards = work.cardIds
    .map((id) => findCard(state, id))
    .filter((card): card is CardInstance => card !== undefined);
  const inputs = buildMatchInputs(memberCards, services.scenario, state.player.party);
  const found = matchPattern(inputs, [work.effectivePattern], [], []);
  if (!found) return { state, events: [] };
  const plannedOutput = resolveWorkOutput(found, inputs, state.mode);

  if (plannedOutput.kind === 'office-decision') {
    const office = memberCards.find((card) => card.definitionId === plannedOutput.officeDefinitionId);
    const demand = office ? demandForOffice(state, services.scenario, office.definitionId) : undefined;
    const occurrenceId = demand ? `${demand.id}:revision:${state.bill.revision}` : undefined;
    const alreadyPresented = occurrenceId && (
      state.pendingDecisions.some((decision) => decision.occurrenceId === occurrenceId)
      || state.eventLog.some((event) => event.type === 'DECISION_PRESENTED' && event.occurrenceId === occurrenceId)
    );
    if (alreadyPresented) return recoverUnavailableOutreach(state, work);
    const pending = demand && office && occurrenceId ? {
      id: `decision:${occurrenceId}`,
      sourceId: demand.id,
      occurrenceId,
      officeDefinitionId: office.definitionId,
      approachedBillRevision: work.billRevision ?? state.bill.revision,
      expectedBillRevision: state.bill.revision,
      choiceIds: [...demand.choiceIds],
      status: 'pending' as const,
    } : undefined;
    const authoredConcern = authoredConcernFor(memberCards, services.scenario);
    const preparationSlot = work.effectivePattern.output.mode === 'derived'
      ? work.effectivePattern.output.parameters?.preparationSlot : undefined;
    const artifactId = typeof preparationSlot === 'number'
      ? found.assignments.find((assignment) => assignment.slotIndex === preparationSlot)?.cardInstanceIds[0]
      : undefined;
    const delivery = pending && demand?.evidenceConcernId && artifactId ? {
      artifactCardId: artifactId, officeDefinitionId: pending.officeDefinitionId,
      demandId: demand.id, concernId: demand.evidenceConcernId, billRevision: state.bill.revision,
    } : undefined;

    const events: GameEvent[] = [{
      type: 'PATTERN_COMPLETED',
      delivery,
      workId: work.id,
      patternId: work.patternId,
      inputCardIds: memberCards.map((card) => card.id).sort(),
      inputDefinitionIds: memberCards.map((card) => card.definitionId).sort(),
      consumedDefinitionIds: memberCards
        .filter((card) => work.consumedCardIds.includes(card.id))
        .map((card) => card.definitionId)
        .sort(),
      authoredConcernId: authoredConcern?.concernId,
    }];
    events.unshift({
      type: 'CARD_TRANSFORMED',
      stackId: memberCards[0]?.stackId ?? `stack-${work.id}`,
      consumedCardIds: [...work.consumedCardIds],
      producedCardIds: [],
      returnedCardIds: [...work.returnedCardIds],
      outputDefinitionId: String(work.effectivePattern.output.mode === 'derived' ? work.effectivePattern.output.parameters?.outputDefinitionId ?? office?.definitionId : office?.definitionId),
      explanationKey: pending ? 'result.outreach.offer-presented' : 'result.outreach.inspected',
    });
    if (hasActualResourceChange(release.applied)) {
      events.push({ type: 'RESOURCE_CHANGED', changes: release.applied, reason: `pattern-complete:${work.patternId}` });
    }
    if (pending) {
      events.push({
        type: 'DECISION_PRESENTED',
        decisionId: pending.id,
        sourceId: pending.sourceId,
        occurrenceId: pending.occurrenceId,
        choiceIds: [...pending.choiceIds],
      });
    }
    const next = {
      ...state,
      paused: pending ? true : state.paused,
      resources: release.resources,
      cards: state.cards
        .filter((card) => !work.consumedCardIds.includes(card.id))
        .map((card) => work.returnedCardIds.includes(card.id)
          ? { ...card, status: 'idle' as const, remainingMs: 0 }
          : card),
      stacks: state.stacks
        .map((stack) => work.cardIds.some((id) => stack.cardIds.includes(id))
          ? {
              ...stack,
              cardIds: stack.cardIds.filter((id) => !work.consumedCardIds.includes(id)),
              activeActionId: undefined,
              paidCost: undefined,
            }
          : stack)
        .filter((stack) => stack.cardIds.length > 0),
      activeWork: state.activeWork.filter((candidate) => candidate.id !== work.id),
      pendingDecisions: pending ? [...state.pendingDecisions, pending] : state.pendingDecisions,
    };
    const evaluated = applyRelationshipEvaluation(next, services.scenario, state.relationships, events);
    return { state: evaluated.state, events: [...events, ...evaluated.events] };
  }

  const resolved = plannedOutput;
  const outputSource = outputSourceFor(resolved, found, memberCards);
  const anchor = memberCards[0];
  if (!anchor) return { state, events: [] };
  const seq = state.cardSeq + 1;
  const producedId = `card-${seq}`;
  const producedStackId = `stack-${producedId}`;
  const requested = { ...resolved.effects };
  if (attention > 0) requested.staffAttention = (requested.staffAttention ?? 0) + attention;
  const change = applyResourceDelta(state.resources, requested);
  const consumed = new Set(work.consumedCardIds);
  const returned = new Set(work.returnedCardIds);
  const survivors = memberCards
    .filter((card) => returned.has(card.id))
    .map((card) => ({ ...card, status: 'idle' as const, remainingMs: 0 }));
  const outputDefinition = services.scenario.cards.find((entry) => entry.id === resolved.definitionId);
  const produced: CardInstance = {
    id: producedId,
    definitionId: resolved.definitionId,
    stackId: producedStackId,
    x: anchor.x,
    y: anchor.y,
    remainingMs: 0,
    status: 'idle',
    form: resolved.form ?? 'raw',
    location: 'desk',
    sourceDefinitionIds: sourceDefinitionIdsFor(memberCards, services.scenario),
    policyDefinitionId: outputDefinition?.kind === 'policy'
      ? resolved.definitionId
      : memberCards.find((card) => card.policyDefinitionId)?.policyDefinitionId,
    origin: {
      explanationKey: resolved.explanationKey,
      inputDefinitionIds: memberCards.map((card) => card.definitionId).sort(),
      consumedDefinitionIds: memberCards
        .filter((card) => consumed.has(card.id))
        .map((card) => card.definitionId)
        .sort(),
      authoredConcern: authoredConcernFor(memberCards, services.scenario),
    },
  };
  const cards = [
    ...state.cards.filter((card) => !consumed.has(card.id) && !returned.has(card.id)),
    ...survivors,
    produced,
  ];
  const stacks = [
    ...state.stacks
      .map((stack) => ({ ...stack, cardIds: stack.cardIds.filter((id) => !consumed.has(id)) }))
      .filter((stack) => stack.cardIds.length > 0),
    { id: producedStackId, cardIds: [producedId] },
  ];

  const completedState: TermState = {
      ...state,
      cardSeq: seq,
      resources: change.resources,
      cards,
      stacks,
      activeWork: state.activeWork.filter((candidate) => candidate.id !== work.id),
  };
  const events: GameEvent[] = [
      {
        type: 'CARD_TRANSFORMED',
        stackId: anchor.stackId,
        consumedCardIds: [...work.consumedCardIds],
        producedCardIds: [producedId],
        returnedCardIds: [...work.returnedCardIds],
        outputDefinitionId: resolved.definitionId,
        outputForm: resolved.form ?? 'raw',
        producerPatternId: work.patternId,
        ...outputSource,
        inputDefinitionIds: memberCards.map((card) => card.definitionId).sort(),
        consumedDefinitionIds: memberCards.filter((card) => consumed.has(card.id))
          .map((card) => card.definitionId).sort(),
        authoredConcernId: authoredConcernFor(memberCards, services.scenario)?.concernId,
        authoredConcernOfficeDefinitionId: authoredConcernFor(memberCards, services.scenario)?.recipientOfficeDefinitionId,
        explanationKey: resolved.explanationKey,
      },
      {
        type: 'PATTERN_COMPLETED',
        workId: work.id,
        patternId: work.patternId,
        inputCardIds: memberCards.map((card) => card.id).sort(),
        inputDefinitionIds: memberCards.map((card) => card.definitionId).sort(),
        consumedDefinitionIds: memberCards
          .filter((card) => consumed.has(card.id))
          .map((card) => card.definitionId)
          .sort(),
        authoredConcernId: authoredConcernFor(memberCards, services.scenario)?.concernId,
      },
  ];
  if (hasActualResourceChange(change.applied)) {
    events.splice(1, 0, {
      type: 'RESOURCE_CHANGED',
      changes: change.applied,
      reason: `pattern-complete:${work.patternId}`,
    });
  }
  const evaluated = applyRelationshipEvaluation(completedState, services.scenario, state.relationships, events);
  return { state: evaluated.state, events: [...events, ...evaluated.events] };
}

function appendEvents(state: TermState, events: GameEvent[]): TermState {
  return events.length === 0 ? state : { ...state, eventLog: [...state.eventLog, ...events] };
}

function applyReadinessMilestone(before: TermState, next: TermState): EngineResult {
  if (
    before.mode !== 'session'
    || sessionReadiness(before).ready
    || !sessionReadiness(next).ready
    || next.rewardedOccurrenceIds.includes(SESSION_READINESS_MILESTONE_ID)
  ) return { state: next, events: [] };

  const reward = applyResourceDelta(next.resources, { politicalCapital: 1 });
  const milestoneEvent: GameEvent = {
    type: 'READINESS_MILESTONE_REWARDED',
    rewardId: SESSION_READINESS_MILESTONE_ID,
    appliedCapital: reward.applied.politicalCapital ?? 0,
  };
  const events: GameEvent[] = [milestoneEvent];
  if ((reward.applied.politicalCapital ?? 0) !== 0) {
    events.push({
      type: 'RESOURCE_CHANGED',
      changes: reward.applied,
      reason: SESSION_READINESS_MILESTONE_ID,
    });
  }
  return {
    state: {
      ...next,
      resources: reward.resources,
      rewardedOccurrenceIds: [...next.rewardedOccurrenceIds, SESSION_READINESS_MILESTONE_ID].sort(),
      eventLog: [...next.eventLog, ...events],
    },
    events,
  };
}

/**
 * Move Session time through canonical stops. Work at a timestamp is completed as
 * one deterministic batch before obligations at that same timestamp are settled.
 */
function advanceSessionTimeline(
  state: TermState,
  services: EngineServices,
  requestedMs: number,
  stopAfterFirstMeaningfulStop: boolean,
): EngineResult {
  let next = state;
  const allEvents: GameEvent[] = [];
  let remaining = Math.max(0, Math.trunc(requestedMs));

  while (remaining > 0 && next.weekPhase === 'active' && next.runStatus === 'active') {
    const beforeStop = next;
    const step = Math.min(remaining, nextStopDelta(next, services.scenario));
    if (step > 0) {
      next = {
        ...next,
        simulationMs: next.simulationMs + step,
        elapsedMs: Math.min(next.weekLengthMs, next.elapsedMs + step),
      };
      remaining -= step;
    }

    // Complete every ready reservation before observing a decision raised by any
    // member of the batch. Otherwise sort order could turn an on-time peer into a miss.
    const ready = next.activeWork
      .filter((work) => work.completesAtSimulationMs <= next.simulationMs)
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const work of ready) {
      const completed = completeSessionWork(next, work, services);
      next = appendEvents(completed.state, completed.events);
      allEvents.push(...completed.events);
    }

    const fulfilled = fulfillObligations(next, services.scenario);
    next = appendEvents(fulfilled.state, fulfilled.events);
    allEvents.push(...fulfilled.events);

    let expiredEventCount = 0;
    if (next.elapsedMs >= next.weekLengthMs) {
      next = { ...next, elapsedMs: next.weekLengthMs, weekPhase: 'boundary', paused: true };
    } else {
      const expired = expireObligations(next, next.simulationMs);
      next = appendEvents(expired.state, expired.events);
      allEvents.push(...expired.events);
      expiredEventCount = expired.events.length;
    }

    // Readiness is observed only after the whole canonical stop: every
    // simultaneous completion, fulfillment, and same-time deadline consequence.
    // Longer commands therefore award exactly as the equivalent Fast-forward
    // sequence does, even if a later stop makes the run not-ready again.
    const readiness = applyReadinessMilestone(beforeStop, next);
    next = readiness.state;
    allEvents.push(...readiness.events);

    if (
      next.pendingDecisions.some((decision) => decision.status === 'pending')
      || next.weekPhase === 'boundary'
      || (stopAfterFirstMeaningfulStop
        && (ready.length > 0 || fulfilled.events.length > 0 || expiredEventCount > 0))
    ) break;

    // A zero delta means a current-time stop was just handled. If it produced no
    // state change there is no safe progress to make in this command.
    if (step === 0 && ready.length === 0 && fulfilled.events.length === 0) break;
  }

  return { state: next, events: allEvents };
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
  const requested = Object.fromEntries(
    Object.entries(pattern.resourceCost).map(([key, amount]) => [key, -amount]),
  ) as Partial<Resources>;
  const change = applyResourceDelta(state.resources, requested);
  const paidCost = Object.fromEntries(
    Object.entries(change.applied).map(([key, amount]) => [key, -amount]),
  ) as Partial<Resources>;
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
      changes: change.applied,
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
    resources: change.resources,
    cards: state.cards.map((card) =>
      memberCardIds.includes(card.id)
        ? { ...card, stackId: targetStackId, status: 'working', remainingMs: pattern.durationMs }
        : card,
    ),
    stacks: state.stacks.map((stack) =>
      stack.id === targetStackId ? { ...stack, activeActionId: pattern.id, paidCost } : stack,
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

  if (state.mode !== 'interaction-spike') {
    return startSessionPattern(
      state,
      services,
      commandType,
      [...targetStack.cardIds, cardId],
      targetStackId,
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
    // A refusal that only says "these do not go together" gives the player nothing
    // to reason about. If an unstudied Tactic would have made this exact stack
    // work, say which one and what it would allow — the way forward, not the
    // recipe. Still free, still nothing remembered.
    const blocked = blockingTactic(inputs, state, services);
    if (blocked) {
      return rejectStack(state, memberCardIds, targetStackId, 'needs-tactic', blocked);
    }

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

  // The same guard `combine` applies to every other assignment. Without it a
  // working staffer could walk out of their own job, which left that job running
  // on a stack that could never satisfy its pattern again.
  if (staff.status !== 'idle' || tactic.status !== 'idle') {
    return rejectCommand(state, 'START_ASSIGNMENT', 'card-busy', 'That work is still under way.');
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
  const requested = Object.fromEntries(
    Object.entries(cost).map(([key, amount]) => [key, -amount]),
  ) as Partial<Resources>;
  const change = applyResourceDelta(state.resources, requested);
  const paidCost = Object.fromEntries(
    Object.entries(change.applied).map(([key, amount]) => [key, -amount]),
  ) as Partial<Resources>;
  const events: GameEvent[] = [
    {
      type: 'STACK_ACCEPTED',
      stackId: targetStackId,
      cardIds: memberCardIds,
      definitionIds: [tactic.definitionId, staff.definitionId].sort(),
    },
    { type: 'RESOURCE_CHANGED', changes: change.applied, reason: `study:${expansion.id}` },
    {
      type: 'ACTION_STARTED',
      stackId: targetStackId,
      durationMs: expansion.studyDurationMs,
      assignmentKind: 'study-tactic',
    },
  ];

  const next: TermState = {
    ...state,
    resources: change.resources,
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
      stack.id === targetStackId
        ? { ...stack, activeActionId: studyActionId(expansion.id), paidCost }
        : stack,
    ),
  };

  return accept(state, next, events);
}

// ---------------------------------------------------------------------------
// The command boundary
// ---------------------------------------------------------------------------

function executeCommandCore(
  state: TermState,
  command: GameCommand,
  services: EngineServices,
): EngineResult {
  if (runIsComplete(state)) {
    return rejectCommand(state, command.type, 'run-complete', 'This Session is complete. Start a new Session to keep playing.');
  }
  switch (command.type) {
    case 'STACK_CARD':
      return combine(state, services, 'STACK_CARD', command.cardId, command.targetStackId);

    case 'SEPARATE_STACK': {
      const card = findCard(state, command.cardId);
      const stack = state.stacks.find((candidate) => candidate.id === command.stackId);
      if (!card || !stack || !stack.cardIds.includes(command.cardId)) {
        return rejectCommand(state, command.type, 'unknown-card', 'That card is not in this stack.');
      }
      if (state.mode !== 'interaction-spike') {
        const work = state.activeWork.find((candidate) => candidate.cardIds.includes(command.cardId));
        if (work) return cancelSessionWork(state, work, command.cardId, command.x, command.y);
      }
      // Pulling a card out of a running assignment cancels that assignment and
      // returns every participant to idle. The cost already paid is not refunded;
      // the office did start the work.
      const cancelling = Boolean(stack.activeActionId);
      const participants = new Set(stack.cardIds);

      // The office stops the work but gets its staffer back. Without this, three
      // careless drags left the desk with zero attention and no way to start
      // anything again.
      const released = cancelling ? heldAttention(stack, services) : {};
      const refunding = Object.keys(released).length > 0;
      const refund = applyResourceDelta(state.resources, released);

      const newStackId = `stack-${command.cardId}`;
      const next: TermState = {
        ...state,
        resources: refunding ? refund.resources : state.resources,
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
                    paidCost: undefined,
                  }
                : candidate,
            )
            .filter((candidate) => candidate.cardIds.length > 0),
          { id: newStackId, cardIds: [command.cardId] },
        ],
      };

      const separationEvents: GameEvent[] = [];
      if (refunding) {
        separationEvents.push({
          type: 'RESOURCE_CHANGED',
          changes: refund.applied,
          reason: `cancel:${stack.activeActionId}`,
        });
      }
      separationEvents.push({
        type: 'CARD_MOVED',
        cardId: command.cardId,
        x: command.x,
        y: command.y,
      });

      return accept(state, next, separationEvents);
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
      if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending Story choice before starting work.');
      }
      if (command.assignmentKind === 'study-tactic') {
        if (state.mode !== 'interaction-spike') {
          return startSessionStudy(state, services, command.staffCardId, command.targetCardId);
        }
        return startStudyTactic(state, services, command.staffCardId, command.targetCardId);
      }
      const target = findCard(state, command.targetCardId);
      if (!target) {
        return rejectCommand(state, command.type, 'unknown-card', 'That card is no longer on the desk.');
      }
      return combine(state, services, 'START_ASSIGNMENT', command.staffCardId, target.stackId);
    }

    case 'SUBMIT_WORK':
      if (state.mode === 'interaction-spike') {
        return rejectCommand(state, command.type, 'unsupported-command', 'The Work Mat is available in Session mode.');
      }
      if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending Story choice before starting work.');
      }
      return startSessionPattern(state, services, command.type, command.cardIds);

    case 'DOCKET_PROVISION': {
      if (state.mode === 'interaction-spike') {
        return rejectCommand(state, command.type, 'unsupported-command', 'The Bill Docket is available in Session mode.');
      }
      if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending Story choice before editing the bill.');
      }
      const preview = previewDocketProvision(state, services.scenario, command.cardId);
      if (!preview.accepted) {
        return rejectCommand(state, command.type, preview.reason, preview.message);
      }
      const drafted = findCard(state, command.cardId)!;
      const integrityChange = applyResourceDelta(state.resources, {
        policyIntegrity: preview.bill.integrity - state.resources.policyIntegrity,
      });
      const next: TermState = {
        ...state,
        resources: integrityChange.resources,
        cards: state.cards.filter((card) => card.id !== command.cardId),
        stacks: state.stacks
          .map((stack) => ({
            ...stack,
            cardIds: stack.cardIds.filter((cardId) => cardId !== command.cardId),
          }))
          .filter((stack) => stack.cardIds.length > 0),
        bill: {
          ...state.bill,
          provisionIds: [...state.bill.provisionIds, preview.provisionId],
          provisionReceipts: [
            ...state.bill.provisionReceipts,
            {
              origin: 'draft',
              provisionId: preview.provisionId,
              draftedCardId: command.cardId,
              sourceDefinitionIds: preview.sourceDefinitionIds,
              docketedAtRevision: preview.nextRevision,
              plainLanguage: preview.plainLanguage,
              form: preview.form,
              sourceClass: preview.sourceClass,
            },
          ],
          revision: preview.nextRevision,
        },
      };
      const events: GameEvent[] = [
        {
          type: 'CARD_TRANSFORMED',
          stackId: drafted.stackId,
          consumedCardIds: [command.cardId],
          producedCardIds: [],
          returnedCardIds: [],
          outputDefinitionId: preview.provisionId,
          explanationKey: 'result.provision.docketed',
        },
      ];
      if ((integrityChange.applied.policyIntegrity ?? 0) !== 0) {
        events.push({
          type: 'RESOURCE_CHANGED',
          changes: integrityChange.applied,
          reason: `bill-revision:${preview.nextRevision}`,
        });
      }
      events.push({
        type: 'PROVISION_DOCKETED',
        cardId: command.cardId,
        provisionId: preview.provisionId,
        revision: preview.nextRevision,
      });
      const evaluated = applyRelationshipEvaluation(next, services.scenario, state.relationships, events);
      const fulfillment = fulfillObligations(evaluated.state, services.scenario, [...events, ...evaluated.events]);
      return accept(state, fulfillment.state, [...events, ...evaluated.events, ...fulfillment.events]);
    }

    case 'RESOLVE_DECISION': {
      const pending = state.pendingDecisions.find(
        (decision) => decision.id === command.decisionId && decision.status === 'pending',
      );
      if (!pending) {
        return rejectCommand(state, command.type, 'unknown-decision', 'That offer is no longer pending.');
      }
      if (
        command.expectedBillRevision !== pending.expectedBillRevision
        || command.expectedBillRevision !== state.bill.revision
      ) {
        return rejectCommand(state, command.type, 'stale-decision', 'The bill changed after this offer was presented.');
      }
      const preview = previewDecision(state, services.scenario, command.decisionId, command.choiceId);
      if (!preview.accepted) {
        const reason: RejectionReason = preview.reason === 'missing-prerequisites'
          ? 'no-matching-pattern'
          : preview.reason;
        return rejectCommand(state, command.type, reason, preview.message);
      }
      const choice = services.scenario.decisionChoices.find((candidate) => candidate.id === command.choiceId)!;
      const billPreview = previewBillChange(state, services.scenario, preview.nextProvisionIds);
      const resourcePlan = planDecisionUpfrontResources(
        state.resources,
        choice,
        preview.requiredWork?.cost ?? {},
        billPreview.integrity,
      );
      if (!resourcePlan.accepted) {
        return rejectCommand(state, command.type, 'insufficient-resources', 'The choice and its required work exceed current resources.');
      }
      let workEvents: GameEvent[] = [];
      let next = state;
      if (preview.requiredWork) {
        const required = findRequiredDecisionWorkPlan(
          state,
          services.scenario,
          command.decisionId,
          command.choiceId,
        );
        if (!required) {
          return rejectCommand(state, command.type, 'no-matching-pattern', 'The required counteroffer work is no longer available.');
        }
        const started = startSessionPattern(
          state,
          services,
          command.type,
          required.cardIds,
        );
        if (started.events.some((event) => event.type === 'COMMAND_REJECTED')) return started;
        workEvents = started.events;
        const priorWorkIds = new Set(state.activeWork.map((work) => work.id));
        next = {
          ...started.state,
          activeWork: started.state.activeWork.map((work) => priorWorkIds.has(work.id) ? work : {
            ...work,
            decisionOrigin: {
              decisionId: command.decisionId,
              choiceId: command.choiceId,
              occurrenceId: pending.occurrenceId,
              officeDefinitionId: pending.officeDefinitionId,
            },
          }),
        };
      }

      const oldProvisionIds = new Set(state.bill.provisionIds);
      const nextProvisionIds = [...preview.nextProvisionIds];
      const nextProvisionSet = new Set(nextProvisionIds);
      const billChanged = nextProvisionIds.length !== state.bill.provisionIds.length
        || nextProvisionIds.some((id, index) => id !== state.bill.provisionIds[index]);
      const nextRevision = state.bill.revision + (billChanged ? 1 : 0);
      const retainedReceipts = state.bill.provisionReceipts.filter((receipt) => nextProvisionSet.has(receipt.provisionId));
      const addedReceipts = nextProvisionIds
        .filter((provisionId) => !oldProvisionIds.has(provisionId))
        .flatMap((provisionId) => {
          const policy = services.scenario.cards.find((card) => card.id === provisionId);
          if (policy?.kind !== 'policy') return [];
          return [{
            origin: 'decision' as const,
            decisionId: command.decisionId,
            sourceId: pending.sourceId,
            occurrenceId: pending.occurrenceId,
            provisionId,
            sourceDefinitionIds: [provisionId],
            docketedAtRevision: nextRevision,
            plainLanguage: policy.plainLanguage,
            form: 'drafted' as const,
            sourceClass: 'simulated' as const,
          }];
        });
      const resourceChange = {
        resources: resourcePlan.resources,
        applied: resourcePlan.decisionApplied,
      };
      const nextBill = {
        ...next.bill,
        provisionIds: nextProvisionIds,
        provisionReceipts: [...retainedReceipts, ...addedReceipts],
        revision: nextRevision,
      };
      const withResolution: TermState = {
        ...next,
        resources: resourceChange.resources,
        bill: nextBill,
        obligations: [
          ...next.obligations,
          ...preview.newObligations.filter((obligation) =>
            !next.obligations.some((existing) => existing.id === obligation.id),
          ),
        ],
        pendingDecisions: next.pendingDecisions.map((decision) =>
          decision.id === command.decisionId ? { ...decision, status: 'resolved' as const } : decision,
        ),
        relationships: preview.nextRelationships,
      };
      const decisionEvents: GameEvent[] = [{
        type: 'DECISION_RESOLVED',
        decisionId: command.decisionId,
        choiceId: command.choiceId,
        occurrenceId: pending.occurrenceId,
      }];
      if (choice.action === 'reject') {
        decisionEvents.push({
          type: 'OPPORTUNITY_DECLINED',
          occurrenceId: pending.occurrenceId,
          sourceId: pending.sourceId,
        });
      }
      if (Object.values(resourceChange.applied).some((amount) => amount !== 0)) {
        decisionEvents.push({
          type: 'RESOURCE_CHANGED',
          changes: resourceChange.applied,
          reason: `decision:${pending.occurrenceId}`,
        });
      }
      if (billChanged) {
        for (const provisionId of state.bill.provisionIds.filter((id) => !nextProvisionSet.has(id))) {
          decisionEvents.push({ type: 'PROVISION_NEGOTIATED', decisionId: command.decisionId, occurrenceId: pending.occurrenceId, provisionId, change: 'removed', revision: nextRevision });
        }
        for (const provisionId of nextProvisionIds.filter((id) => !oldProvisionIds.has(id))) {
          decisionEvents.push({ type: 'PROVISION_NEGOTIATED', decisionId: command.decisionId, occurrenceId: pending.occurrenceId, provisionId, change: 'added', revision: nextRevision });
        }
      }
      const evaluated = applyRelationshipEvaluation(
        withResolution,
        services.scenario,
        evaluateRelationships(state, services.scenario),
        decisionEvents,
      );
      const allDecisionEvents = [...decisionEvents, ...evaluated.events];
      const fulfillment = fulfillObligations(evaluated.state, services.scenario, allDecisionEvents);
      const finalDecisionEvents = [...allDecisionEvents, ...fulfillment.events];
      if (workEvents.length === 0) return accept(state, fulfillment.state, finalDecisionEvents);
      return {
        state: { ...fulfillment.state, eventLog: [...fulfillment.state.eventLog, ...finalDecisionEvents] },
        events: [...workEvents, ...finalDecisionEvents],
      };
    }

    case 'ACTIVATE_TACTIC': {
      if (state.mode === 'session') {
        return rejectCommand(state, command.type, 'unsupported-command', 'Session Tactics must complete a timed study assignment.');
      }
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

    case 'OPEN_PACK':
      if (state.mode === 'interaction-spike') {
        return rejectCommand(state, command.type, 'unsupported-command', 'Opportunity packs are available in Session mode.');
      }
      return openPack(state, services.scenario, command.packOccurrenceId, command.categoryId);

    case 'DRAW_STORY_EVENT':
      if (state.mode === 'interaction-spike') {
        return rejectCommand(state, command.type, 'unsupported-command', 'Story events are available in Session mode.');
      }
      return drawStoryEvent(state, services.scenario);

    case 'RESOLVE_STORY':
      if (state.mode === 'interaction-spike') {
        return rejectCommand(state, command.type, 'unsupported-command', 'Story events are available in Session mode.');
      }
      return resolveStoryEvent(state, services.scenario, command.decisionId, command.choiceId);

    case 'FILE_CARD':
    case 'UNFILE_CARD':
    case 'ARCHIVE_CARD': {
      if (state.mode === 'interaction-spike') {
        return rejectCommand(state, command.type, 'unsupported-command', 'The filing cabinet is available in Session mode.');
      }
      const card = findCard(state, command.cardId);
      if (!card) return rejectCommand(state, command.type, 'unknown-card', 'That card is no longer in the office.');
      if (state.activeWork.some((work) => work.cardIds.includes(command.cardId))) {
        return rejectCommand(state, command.type, 'card-busy', 'Active work must finish before this card can be filed.');
      }
      const location = command.type === 'FILE_CARD'
        ? 'filed' as const
        : command.type === 'ARCHIVE_CARD'
          ? 'archived' as const
          : 'desk' as const;
      if (card.location === location) return { state, events: [] };
      if (command.type === 'FILE_CARD') {
        const filedCount = state.cards.filter((candidate) => candidate.location === 'filed').length;
        if (filedCount >= FILING_SLOTS) {
          return rejectCommand(state, command.type, 'invalid-stage', 'The six filing slots are full.');
        }
      }
      if (command.type === 'UNFILE_CARD' && card.location !== 'filed') {
        return rejectCommand(state, command.type, 'invalid-stage', 'Only filed cards can return to the desk.');
      }
      const locationEvent: GameEvent = { type: 'CARD_LOCATION_CHANGED', cardId: card.id, location };
      const changed: TermState = {
        ...state,
        cards: state.cards.map((candidate) => candidate.id === card.id
          ? { ...candidate, location }
          : candidate),
      };
      const evaluated = applyRelationshipEvaluation(
        changed,
        services.scenario,
        state.relationships,
        [locationEvent],
      );
      return accept(state, evaluated.state, [locationEvent, ...evaluated.events]);
    }

    case 'FAST_FORWARD': {
      if (state.mode === 'interaction-spike') {
        return rejectCommand(state, command.type, 'unsupported-command', 'Fast-forward is available in Session mode.');
      }
      if (state.runStatus === 'complete') {
        return rejectCommand(state, command.type, 'run-complete', 'This Session is complete.');
      }
      if (state.weekPhase === 'boundary') {
        return rejectCommand(state, command.type, 'invalid-stage', 'Review the week before starting the next one.');
      }
      if (state.pendingDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending decision before advancing time.');
      }
      if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending Story choice before advancing time.');
      }
      return advanceSessionTimeline(
        state,
        services,
        Math.max(0, state.weekLengthMs - state.elapsedMs),
        true,
      );
    }

    case 'CONCLUDE_SESSION': {
      if (state.mode !== 'session') {
        return rejectCommand(state, command.type, 'unsupported-command', 'Session conclusions are available in Session mode.');
      }
      if (state.pendingDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending coalition decision before concluding the Session.');
      }
      if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending Story choice before concluding the Session.');
      }

      const timeline = state.weekPhase === 'active'
        ? advanceSessionTimeline(state, services, Math.max(0, state.weekLengthMs - state.elapsedMs), false)
        : { state, events: [] };
      if (timeline.state.pendingDecisions.some((decision) => decision.status === 'pending')
        || timeline.state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return timeline;
      }
      if (timeline.state.weekPhase !== 'boundary') return timeline;
      if (timeline.state.activeWork.length > 0) {
        const rejection = rejectCommand(timeline.state, command.type, 'card-busy', 'Finish or cancel all reserved work before concluding the Session.');
        return { state: timeline.state, events: [...timeline.events, ...rejection.events] };
      }

      const alreadySettled = timeline.state.resolvedWeekIds.includes(`week:${timeline.state.week}`);
      const settlement = alreadySettled
        ? { state: timeline.state, events: [] }
        : resolveWeek(timeline.state, services.scenario, { advanceToNextWeek: false });
      const conclusion: GameEvent = {
        type: 'SESSION_CONCLUDED',
        outcome: sessionReadiness(settlement.state).ready ? 'ready' : 'not-ready',
      };
      const complete = accept(settlement.state, {
        ...settlement.state,
        paused: true,
        runStatus: 'complete',
      }, [conclusion]);
      const withRecord: TermState = {
        ...complete.state,
        sessionRecord: buildSessionRecord(complete.state, services.scenario),
      };
      return {
        state: withRecord,
        events: [...timeline.events, ...settlement.events, ...complete.events],
      };
    }

    case 'ADVANCE_WEEK': {
      if (state.mode === 'interaction-spike') {
        return rejectCommand(state, command.type, 'unsupported-command', 'Weekly review is available in Session mode.');
      }
      if (state.runStatus === 'complete') {
        return rejectCommand(state, command.type, 'run-complete', 'This Session is complete.');
      }
      if (command.confirmEarly) {
        if (command.expectedWeek === undefined || command.expectedWeek !== state.week || state.weekPhase !== 'active') {
          return rejectCommand(state, command.type, 'stale-decision', 'That week-ending request is no longer current.');
        }
        if (state.pendingDecisions.some((decision) => decision.status === 'pending')) {
          return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending decision before ending the week.');
        }
        if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
          return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending Story choice before ending the week.');
        }
        return advanceSessionTimeline(
          state,
          services,
          Math.max(0, state.weekLengthMs - state.elapsedMs),
          false,
        );
      }
      if (state.weekPhase !== 'boundary') {
        return rejectCommand(state, command.type, 'clock-not-expired', 'The week is still active.');
      }
      if (state.pendingDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending decision before starting the next week.');
      }
      if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending Story choice before starting the next week.');
      }
      if (state.week === 6 && state.resolvedWeekIds.includes('week:6')) {
        return rejectCommand(state, command.type, 'invalid-stage', 'The sixth week is ready for Session conclusion.');
      }
      {
        const resolved = resolveWeek(state, services.scenario);
        if (resolved.state.weekPhase !== 'active' || resolved.state.week === state.week) return resolved;
        const story = drawStoryEvent(resolved.state, services.scenario);
        return { state: story.state, events: [...resolved.events, ...story.events] };
      }
    }

    case 'TICK': {
      if (state.paused) return { state, events: [] };
      if (state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return { state, events: [] };
      }

      const delta = Math.min(MAX_TICK_MS, Math.max(0, Math.trunc(command.deltaMs)));
      if (delta === 0) return { state, events: [] };

      if (state.mode !== 'interaction-spike') {
        if (state.weekPhase === 'boundary') return { state, events: [] };
        return advanceSessionTimeline(state, services, delta, false);
      }

      let next: TermState = {
        ...state,
        simulationMs: state.simulationMs + delta,
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
      if (!command.paused && state.weekPhase === 'boundary') {
        return rejectCommand(state, command.type, 'invalid-stage', 'Review the week before resuming the calendar.');
      }
      if (!command.paused && state.runStatus === 'complete') {
        return rejectCommand(state, command.type, 'run-complete', 'This Session is complete.');
      }
      if (!command.paused && state.pendingDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending coalition decision before resuming time.');
      }
      if (!command.paused && state.pendingStoryDecisions.some((decision) => decision.status === 'pending')) {
        return rejectCommand(state, command.type, 'pending-decision', 'Resolve the pending Story choice before resuming time.');
      }
      if (state.paused === command.paused) return { state, events: [] };
      return accept(state, { ...state, paused: command.paused }, [
        { type: 'PAUSE_CHANGED', paused: command.paused },
      ]);
    }

    case 'ACCEPT_AMENDMENT': {
      const matches = state.pendingDecisions.flatMap((decision) => {
        if (decision.status !== 'pending' || decision.officeDefinitionId !== command.memberId) return [];
        return decision.choiceIds.flatMap((choiceId) => {
          const choice = services.scenario.decisionChoices.find((candidate) => candidate.id === choiceId);
          return choice?.action === 'accept' && choice.effects.some(
            (effect) => effect.kind === 'bill-add-provision' && effect.provisionId === command.provisionId,
          ) ? [{ decision, choiceId }] : [];
        });
      });
      if (matches.length !== 1) {
        return rejectCommand(state, command.type, 'malformed-command', 'That amendment does not identify one exact pending offer.');
      }
      return executeCommandCore(state, {
        type: 'RESOLVE_DECISION',
        decisionId: matches[0].decision.id,
        choiceId: matches[0].choiceId,
        expectedBillRevision: matches[0].decision.expectedBillRevision,
      }, services);
    }

    case 'REJECT_AMENDMENT': {
      const matches = state.pendingDecisions.flatMap((decision) => {
        if (decision.status !== 'pending' || decision.officeDefinitionId !== command.memberId) return [];
        return decision.choiceIds.flatMap((choiceId) => {
          const choice = services.scenario.decisionChoices.find((candidate) => candidate.id === choiceId);
          return choice?.action === 'reject' ? [{ decision, choiceId }] : [];
        });
      });
      if (matches.length !== 1) {
        return rejectCommand(state, command.type, 'malformed-command', 'That refusal does not identify one exact pending offer.');
      }
      return executeCommandCore(state, {
        type: 'RESOLVE_DECISION',
        decisionId: matches[0].decision.id,
        choiceId: matches[0].choiceId,
        expectedBillRevision: matches[0].decision.expectedBillRevision,
      }, services);
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

const READINESS_MUTATIONS = new Set<GameCommand['type']>([
  'DOCKET_PROVISION', 'RESOLVE_DECISION', 'RESOLVE_STORY', 'TICK', 'FAST_FORWARD',
  'ADVANCE_WEEK', 'CONCLUDE_SESSION',
]);

/** Public command boundary, including the one-time readiness preparation receipt. */
export function executeCommand(
  state: TermState,
  command: GameCommand,
  services: EngineServices,
): EngineResult {
  const result = executeCommandCore(state, command, services);
  if (
    state.mode !== 'session'
    || !READINESS_MUTATIONS.has(command.type)
    || result.events.some((event) => event.type === 'COMMAND_REJECTED')
  ) return result;

  const rewarded = applyReadinessMilestone(state, result.state);
  let rewardedState = rewarded.state;
  if (rewardedState.runStatus === 'complete') {
    rewardedState = {
      ...rewardedState,
      sessionRecord: buildSessionRecord(rewardedState, services.scenario),
    };
  }
  return {
    state: rewardedState,
    events: [...result.events, ...rewarded.events],
  };
}
