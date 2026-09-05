import type { GameCommand } from '@/domain/commands';
import { executeCommand } from '@/domain/engine';
import type { GameEvent } from '@/domain/events';
import { buildMatchInputs, matchPattern } from '@/domain/recipes';
import { createRun } from '@/domain/runSetup';
import { sessionReadiness, type SessionReadiness } from '@/domain/objectives';
import { effectiveWorkRule } from '@/domain/work';
import type { GoverningValue, Party, Resources, RunSettings, ScenarioDefinition, TermState } from '@/domain/types';
import { canonicalSha256 } from '@/persistence/canonicalHash';
import { chooseCommand, type PolicyId } from '@/../scripts/balance/policies';

export type BalanceCommandExecutor = typeof executeCommand;

export const COMMAND_BOUND = 10_000;
export const RESOURCE_KEYS = [
  'staffAttention',
  'politicalCapital',
  'districtTrust',
  'billMomentum',
  'policyIntegrity',
  'staffMorale',
] as const satisfies readonly (keyof Resources)[];

export interface BalanceSetup {
  seed: number;
  districtId: string;
  party: Party;
  values: [GoverningValue, GoverningValue];
  settings: RunSettings;
}

export interface BalanceTraceEntry {
  index: number;
  command: GameCommand;
  accepted: boolean;
  eventTypes: string[];
  week: number;
  simulationMs: number;
}

export interface BalanceRun {
  policyId: PolicyId;
  setup: BalanceSetup;
  termination: 'complete' | 'command-bound-exhausted' | 'rejected' | 'stuck';
  outcome?: 'ready' | 'not-ready';
  readinessGaps: SessionReadiness;
  resourceMinima: Resources;
  finalResources: Resources;
  earnedPoliticalCapital: number;
  spentPoliticalCapital: number;
  fulfilledObligationIds: string[];
  missedObligationIds: string[];
  acceptedChoices: string[];
  rejectedChoices: string[];
  activatedTacticIds: string[];
  usedTacticIds: string[];
  idleSimulationMs: number;
  commandCount: number;
  commandTraceHash: string;
  commandTrace: BalanceTraceEntry[];
  rewardedOccurrenceIds: string[];
  outreachOccurrenceIds: string[];
  packOccurrenceIds: string[];
  storyOccurrenceIds: string[];
  completedPatternIds: string[];
  commandTypeCounts: Record<string, number>;
  resourceEventTotals: Resources;
  finalMinusInitialResources: Resources;
  firstViolatedInvariant?: string;
}

function zeroResources(): Resources {
  return {
    staffAttention: 0,
    politicalCapital: 0,
    districtTrust: 0,
    billMomentum: 0,
    policyIntegrity: 0,
    staffMorale: 0,
  };
}

function resourceTotals(events: readonly GameEvent[]): Resources {
  const totals = zeroResources();
  for (const event of events) {
    if (event.type !== 'RESOURCE_CHANGED') continue;
    for (const key of RESOURCE_KEYS) totals[key] += event.changes[key] ?? 0;
  }
  return totals;
}

function resourceDifference(initial: Resources, final: Resources): Resources {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, final[key] - initial[key]])) as unknown as Resources;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => seen.has(value) || !seen.add(value));
}

function firstAuditFailure(state: TermState, initialResources: Resources): string | undefined {
  const totals = resourceTotals(state.eventLog);
  const actual = resourceDifference(initialResources, state.resources);
  const resource = RESOURCE_KEYS.find((key) => totals[key] !== actual[key]);
  if (resource) return `resource audit mismatch for ${resource}: events ${totals[resource]}, state ${actual[resource]}`;
  const duplicateReward = duplicates(state.rewardedOccurrenceIds)[0];
  if (duplicateReward) return `duplicate reward receipt ${duplicateReward}`;
  const packIds = state.eventLog.flatMap((event) => event.type === 'PACK_OPENED' ? [event.packOccurrenceId] : []);
  const duplicatePack = duplicates(packIds)[0];
  if (duplicatePack) return `duplicate pack receipt ${duplicatePack}`;
  const storyIds = state.eventLog.flatMap((event) => event.type === 'EVENT_TRIGGERED' ? [event.occurrenceId] : []);
  const duplicateStory = duplicates(storyIds)[0];
  if (duplicateStory) return `duplicate Story receipt ${duplicateStory}`;
  const obligationIds = state.eventLog.flatMap((event) => event.type === 'OBLIGATION_CREATED' ? [event.obligationId] : []);
  const duplicateObligation = duplicates(obligationIds)[0];
  if (duplicateObligation) return `duplicate obligation receipt ${duplicateObligation}`;
  if (state.elapsedMs > state.weekLengthMs) return `week clock overshot by ${state.elapsedMs - state.weekLengthMs}ms`;
  if (state.runStatus === 'complete' && state.activeWork.length > 0) return 'completed save retains unresolved work';
  return undefined;
}

function sameResources(a: Resources, b: Resources): boolean {
  return RESOURCE_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Report a learned Tactic as used only when a completed reservation actually
 * depended on its captured rule change. Merely unlocking a targeted rule does
 * not count as use.
 */
export function completedTacticUseIds(
  before: TermState,
  events: readonly GameEvent[],
  scenario: ScenarioDefinition,
): string[] {
  const tacticIds = new Set<string>();
  for (const event of events) {
    if (event.type !== 'PATTERN_COMPLETED') continue;
    const work = before.activeWork.find((candidate) =>
      candidate.kind === 'pattern' && candidate.id === event.workId);
    if (!work || work.kind !== 'pattern') continue;
    const authoredPattern = scenario.patterns.find((pattern) => pattern.id === work.patternId);
    if (!authoredPattern) continue;
    const basePattern = effectiveWorkRule(
      authoredPattern,
      [],
      work.staffCardIds,
      before,
      scenario,
    ).effectivePattern;
    for (const expansionId of work.effectiveExpansionIds ?? []) {
      const expansion = scenario.tacticExpansions.find((candidate) => candidate.id === expansionId);
      if (!expansion) continue;
      let used = false;
      if (expansion.effect.kind === 'resource-cost') {
        used = work.effectivePattern.resourceCost[expansion.effect.resource]
          !== basePattern.resourceCost[expansion.effect.resource];
      } else if (expansion.effect.kind === 'duration-multiplier') {
        used = work.effectivePattern.durationMs !== basePattern.durationMs;
      } else if (expansion.effect.kind === 'procedure-eligibility') {
        used = before.bill.stage === expansion.effect.stage
          && !(basePattern.eligibleStages ?? []).includes(expansion.effect.stage)
          && (work.effectivePattern.eligibleStages ?? []).includes(expansion.effect.stage);
      } else if (expansion.effect.kind === 'widen-slot') {
        const cards = work.cardIds
          .map((id) => before.cards.find((card) => card.id === id))
          .filter((card): card is NonNullable<typeof card> => card !== undefined);
        const baseMatch = cards.length === work.cardIds.length
          ? matchPattern(
              buildMatchInputs(cards, scenario, before.player.party),
              [authoredPattern],
              [],
              scenario.tacticExpansions,
              before.bill.stage,
            )
          : undefined;
        used = !baseMatch;
      }
      if (used) tacticIds.add(expansion.tacticDefinitionId);
    }
  }
  return [...tacticIds].sort();
}

export function runPolicy(
  policyId: PolicyId,
  setup: BalanceSetup,
  scenario: ScenarioDefinition,
  commandExecutor: BalanceCommandExecutor = executeCommand,
): BalanceRun {
  let state = createRun({ ...setup, scenario, mode: 'session' });
  const initialResources = { ...state.resources };
  const minima = { ...initialResources };
  const trace: BalanceTraceEntry[] = [];
  let termination: BalanceRun['termination'] = 'command-bound-exhausted';
  let firstViolatedInvariant: string | undefined;
  let idleSimulationMs = 0;
  const usedTacticIds = new Set<string>();

  for (let index = 0; index < COMMAND_BOUND; index += 1) {
    if (state.runStatus === 'complete') {
      termination = 'complete';
      break;
    }
    const command = chooseCommand(policyId, state, scenario);
    const before = state;
    const result = commandExecutor(state, command, { scenario });
    for (const tacticId of completedTacticUseIds(before, result.events, scenario)) usedTacticIds.add(tacticId);
    const rejection = result.events.find((event) => event.type === 'COMMAND_REJECTED');
    const accepted = !rejection;
    state = result.state;
    if (command.type === 'FAST_FORWARD' && before.activeWork.length === 0) {
      idleSimulationMs += Math.max(0, state.simulationMs - before.simulationMs);
    }
    for (const key of RESOURCE_KEYS) minima[key] = Math.min(minima[key], state.resources[key]);
    trace.push({
      index: index + 1,
      command,
      accepted,
      eventTypes: result.events.map((event) => event.type),
      week: state.week,
      simulationMs: state.simulationMs,
    });
    firstViolatedInvariant ??= firstAuditFailure(state, initialResources);
    if (firstViolatedInvariant) {
      termination = 'rejected';
      break;
    }
    if (rejection?.type === 'COMMAND_REJECTED') {
      termination = 'rejected';
      firstViolatedInvariant = `${command.type} rejected: ${rejection.reason} — ${rejection.message}`;
      break;
    }
    if (state === before || (
      state.week === before.week
      && state.simulationMs === before.simulationMs
      && state.eventLog.length === before.eventLog.length
      && sameResources(state.resources, before.resources)
    )) {
      termination = 'stuck';
      firstViolatedInvariant = `${command.type} made no observable progress`;
      break;
    }
  }
  if (!firstViolatedInvariant && state.runStatus === 'complete') termination = 'complete';

  const totals = resourceTotals(state.eventLog);
  const differences = resourceDifference(initialResources, state.resources);
  const choiceIds = state.eventLog.flatMap((event) =>
    event.type === 'DECISION_RESOLVED' || event.type === 'STORY_DECISION_RESOLVED' ? [event.choiceId] : []);
  const rejected = choiceIds.filter((choiceId) => {
    const coalition = scenario.decisionChoices.find((choice) => choice.id === choiceId);
    if (coalition) return coalition.action === 'reject';
    const story = scenario.storyEvents.flatMap((event) => event.choices).find((choice) => choice.id === choiceId);
    return Boolean(story && /decline|defer|accept the (?:stall|friction|consequence)/i.test(story.label));
  });
  const politicalEvents = state.eventLog
    .filter((event): event is Extract<GameEvent, { type: 'RESOURCE_CHANGED' }> => event.type === 'RESOURCE_CHANGED')
    .map((event) => event.changes.politicalCapital ?? 0);

  return {
    policyId,
    setup,
    termination,
    outcome: state.sessionRecord?.outcome,
    readinessGaps: sessionReadiness(state),
    resourceMinima: minima,
    finalResources: { ...state.resources },
    earnedPoliticalCapital: politicalEvents.filter((delta) => delta > 0).reduce((sum, delta) => sum + delta, 0),
    spentPoliticalCapital: -politicalEvents.filter((delta) => delta < 0).reduce((sum, delta) => sum + delta, 0),
    fulfilledObligationIds: state.obligations.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.id).sort(),
    missedObligationIds: state.obligations.filter((entry) => entry.status === 'missed').map((entry) => entry.id).sort(),
    acceptedChoices: choiceIds.filter((choiceId) => !rejected.includes(choiceId)),
    rejectedChoices: rejected,
    activatedTacticIds: state.eventLog.flatMap((event) =>
      event.type === 'TACTIC_EXPANSION_ACTIVATED' ? [event.tacticDefinitionId] : []),
    usedTacticIds: [...usedTacticIds],
    idleSimulationMs,
    commandCount: trace.length,
    commandTraceHash: canonicalSha256(trace.map((entry) => entry.command)),
    commandTrace: trace,
    rewardedOccurrenceIds: [...state.rewardedOccurrenceIds],
    outreachOccurrenceIds: state.eventLog.flatMap((event) => event.type === 'DECISION_PRESENTED' ? [event.occurrenceId] : []),
    packOccurrenceIds: state.eventLog.flatMap((event) => event.type === 'PACK_OPENED' ? [event.packOccurrenceId] : []),
    storyOccurrenceIds: state.eventLog.flatMap((event) => event.type === 'EVENT_TRIGGERED' ? [event.occurrenceId] : []),
    completedPatternIds: state.eventLog.flatMap((event) => event.type === 'PATTERN_COMPLETED' ? [event.patternId] : []),
    commandTypeCounts: Object.fromEntries(Array.from(new Set(trace.map((entry) => entry.command.type))).sort().map((type) => [
      type,
      trace.filter((entry) => entry.command.type === type).length,
    ])),
    resourceEventTotals: totals,
    finalMinusInitialResources: differences,
    firstViolatedInvariant,
  };
}
