import type { ScenarioDefinition, TermState } from '@/domain/types';
import { canonicalSha256 } from '@/persistence/canonicalHash';

export const CURRENT_SAVE_SCHEMA_VERSION = 2 as const;
export const CURRENT_RULES_VERSION = 2 as const;

export interface SaveEnvelopeV2 {
  saveSchemaVersion: 2;
  rulesVersion: 2;
  snapshotId: string;
  snapshotHash: string;
  state: TermState;
}

export type SaveValidationFailure =
  | { kind: 'incompatible-version'; message: string }
  | { kind: 'wrong-snapshot'; message: string }
  | { kind: 'corrupt'; message: string };

export type SaveValidationResult =
  | { kind: 'valid'; envelope: SaveEnvelopeV2 }
  | SaveValidationFailure;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function jsonSafe(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonSafe);
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => entry === undefined || jsonSafe(entry));
}

function hasOnlyKeys(value: RecordValue, allowed: readonly string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(value).every((key) => set.has(key));
}

const RESOURCE_KEYS = [
  'staffAttention',
  'politicalCapital',
  'districtTrust',
  'billMomentum',
  'policyIntegrity',
  'staffMorale',
] as const;

function validResources(value: unknown, partial = false): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, RESOURCE_KEYS)) return false;
  return RESOURCE_KEYS.every((key) => partial ? value[key] === undefined || isFiniteNumber(value[key]) : isFiniteNumber(value[key]));
}

function validSettings(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['pace', 'guidance', 'termStyle', 'voteInformation', 'policyComplexity', 'locale', 'reducedMotion'])) return false;
  return ['relaxed', 'standard', 'brisk'].includes(value.pace as string)
    && ['guided', 'standard', 'expert'].includes(value.guidance as string)
    && ['regular-order', 'district-pulse', 'breaking-cycle'].includes(value.termStyle as string)
    && ['broad', 'detailed'].includes(value.voteInformation as string)
    && ['essential', 'advanced'].includes(value.policyComplexity as string)
    && ['en', 'es'].includes(value.locale as string)
    && typeof value.reducedMotion === 'boolean';
}

function validCard(value: unknown, scenario: ScenarioDefinition): value is TermState['cards'][number] {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id', 'definitionId', 'stackId', 'x', 'y', 'remainingMs', 'status', 'form', 'location',
    'sourceDefinitionIds', 'policyDefinitionId', 'staffTraitId', 'origin',
  ])) return false;
  if (typeof value.id !== 'string' || typeof value.definitionId !== 'string' || typeof value.stackId !== 'string') return false;
  if (!scenario.cards.some((card) => card.id === value.definitionId)) return false;
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isFiniteNumber(value.remainingMs) || value.remainingMs < 0) return false;
  if (!['idle', 'working', 'resolved', 'expired'].includes(value.status as string)) return false;
  if (!['raw', 'summary', 'drafted', 'prepared'].includes(value.form as string)) return false;
  if (!['desk', 'filed', 'archived'].includes(value.location as string)) return false;
  if (!strings(value.sourceDefinitionIds) || !value.sourceDefinitionIds.every((id) => scenario.cards.some((card) => card.id === id))) return false;
  if (value.policyDefinitionId !== undefined && (typeof value.policyDefinitionId !== 'string' || !scenario.cards.some((card) => card.id === value.policyDefinitionId && card.kind === 'policy'))) return false;
  if (value.staffTraitId !== undefined && (typeof value.staffTraitId !== 'string' || !scenario.staffTraits.some((trait) => trait.id === value.staffTraitId))) return false;
  return value.origin === undefined || (isRecord(value.origin)
    && hasOnlyKeys(value.origin, ['explanationKey', 'inputDefinitionIds', 'consumedDefinitionIds', 'authoredConcern'])
    && typeof value.origin.explanationKey === 'string'
    && strings(value.origin.inputDefinitionIds)
    && strings(value.origin.consumedDefinitionIds)
    && (value.origin.authoredConcern === undefined || jsonSafe(value.origin.authoredConcern)));
}

const EVENT_KEYS: Record<string, readonly string[]> = {
  STACK_ACCEPTED: ['type', 'stackId', 'cardIds', 'definitionIds', 'patternId'],
  STACK_REJECTED: ['type', 'cardIds', 'targetStackId', 'reason', 'message'],
  CARD_MOVED: ['type', 'cardId', 'x', 'y'],
  ACTION_STARTED: ['type', 'stackId', 'durationMs', 'patternId', 'assignmentKind'],
  CARD_TRANSFORMED: ['type', 'stackId', 'consumedCardIds', 'producedCardIds', 'returnedCardIds', 'outputDefinitionId', 'explanationKey'],
  PATTERN_DISCOVERED: ['type', 'patternId'],
  TACTIC_EXPANSION_ACTIVATED: ['type', 'expansionId', 'tacticDefinitionId', 'targetPatternId'],
  RESOURCE_CHANGED: ['type', 'changes', 'reason'],
  ELECTION_EFFECT_ADDED: ['type', 'effect'],
  ELECTION_OUTLOOK_UPDATED: ['type', 'forecast'],
  PAUSE_CHANGED: ['type', 'paused'],
  EVENT_TRIGGERED: ['type', 'storyEventId', 'whyRules'],
  WEEK_RESOLVED: ['type', 'week', 'summary'],
  OBLIGATION_STATUS_CHANGED: ['type', 'obligationId', 'status'],
  WORK_SUBMITTED: ['type', 'workId', 'cardIds', 'completesAtSimulationMs'],
  PATTERN_COMPLETED: ['type', 'workId', 'patternId'],
  PROVISION_DOCKETED: ['type', 'cardId', 'provisionId', 'revision'],
  PROVISION_NEGOTIATED: ['type', 'decisionId', 'occurrenceId', 'provisionId', 'change', 'revision'],
  DECISION_PRESENTED: ['type', 'decisionId', 'sourceId', 'occurrenceId', 'choiceIds'],
  DECISION_RESOLVED: ['type', 'decisionId', 'choiceId', 'occurrenceId'],
  PROMISE_CHANGED: ['type', 'promiseOccurrenceId', 'status'],
  OPPORTUNITY_DECLINED: ['type', 'occurrenceId', 'sourceId'],
  PACK_OPENED: ['type', 'packOccurrenceId', 'categoryId', 'cardDefinitionIds'],
  CARD_LOCATION_CHANGED: ['type', 'cardId', 'location'],
  SESSION_CONCLUDED: ['type', 'outcome'],
  VOTE_RESOLVED: ['type', 'stage', 'passed', 'tally'],
  REELECTION_RESOLVED: ['type', 'result'],
  COMMAND_REJECTED: ['type', 'commandType', 'reason', 'message'],
};

const OPTIONAL_EVENT_FIELDS = new Set(['patternId', 'assignmentKind', 'targetStackId']);
const EVENT_STRING_ARRAY_FIELDS = new Set([
  'cardIds', 'definitionIds', 'consumedCardIds', 'producedCardIds', 'returnedCardIds',
  'whyRules', 'summary', 'choiceIds', 'cardDefinitionIds',
]);
const EVENT_NUMBER_FIELDS = new Set(['x', 'y', 'durationMs', 'week', 'completesAtSimulationMs', 'revision']);
const EVENT_OBJECT_FIELDS = new Set(['changes', 'effect', 'forecast', 'tally', 'result']);

function validEvent(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  const keys = EVENT_KEYS[value.type];
  if (!keys || !hasOnlyKeys(value, keys)) return false;
  for (const key of keys) {
    if (key === 'type' || OPTIONAL_EVENT_FIELDS.has(key) && value[key] === undefined) continue;
    const field = value[key];
    if (EVENT_STRING_ARRAY_FIELDS.has(key)) {
      if (!strings(field)) return false;
    } else if (EVENT_NUMBER_FIELDS.has(key)) {
      if (!isFiniteNumber(field)) return false;
    } else if (EVENT_OBJECT_FIELDS.has(key)) {
      if (!isRecord(field) || !jsonSafe(field)) return false;
    } else if (key === 'paused' || key === 'passed') {
      if (typeof field !== 'boolean') return false;
    } else if (typeof field !== 'string') {
      return false;
    }
  }
  return true;
}

function validState(input: unknown, scenario: ScenarioDefinition): input is TermState {
  if (!isRecord(input) || !hasOnlyKeys(input, [
    'schemaVersion', 'mode', 'snapshotId', 'seed', 'rngCursor', 'week', 'simulationMs', 'elapsedMs',
    'weekPhase', 'weekLengthMs', 'paused', 'settings', 'player', 'cards', 'cardSeq', 'stacks', 'resources',
    'bill', 'relationships', 'staffCapacity', 'activeWork', 'obligations', 'pendingDecisions',
    'rewardedOccurrenceIds', 'resolvedWeekIds', 'runStatus', 'sessionRecord', 'discoveredPatternIds',
    'unlockedSlotExpansions', 'electionEffects', 'storyHistory', 'objectives', 'eventLog',
  ])) return false;
  if (input.schemaVersion !== 2 || input.snapshotId !== scenario.snapshotId) return false;
  if (!scenario.supportedModes.includes(input.mode as TermState['mode'])) return false;
  if (!isInteger(input.seed) || !isInteger(input.rngCursor, 0) || !isInteger(input.week, 1, 6)) return false;
  if (!isInteger(input.simulationMs, 0) || !isInteger(input.elapsedMs, 0) || !isInteger(input.weekLengthMs, 1)) return false;
  if ((input.elapsedMs as number) > (input.weekLengthMs as number)) return false;
  if (!['active', 'boundary'].includes(input.weekPhase as string) || typeof input.paused !== 'boolean') return false;
  if (!validSettings(input.settings) || !isInteger(input.cardSeq, 0) || !validResources(input.resources)) return false;

  const player = input.player;
  if (!isRecord(player) || !hasOnlyKeys(player, ['districtId', 'party', 'values', 'election'])
    || typeof player.districtId !== 'string' || !scenario.districts.some((district) => district.id === player.districtId)
    || !['democratic', 'republican'].includes(player.party as string)
    || !Array.isArray(player.values) || player.values.length !== 2 || !player.values.every((value) => typeof value === 'string')
    || player.values[0] === player.values[1]
    || !isRecord(player.election) || !['weak', 'moderate', 'strong'].includes(player.election.opponentStrength as string)
    || player.election.revealedWeek !== 1) return false;

  if (!Array.isArray(input.cards) || !input.cards.every((card) => validCard(card, scenario))) return false;
  const cards = input.cards as TermState['cards'];
  if (!unique(cards.map((card) => card.id))) return false;
  const cardIds = new Set(cards.map((card) => card.id));
  if (!Array.isArray(input.stacks) || !input.stacks.every((stack) => isRecord(stack)
    && hasOnlyKeys(stack, ['id', 'cardIds', 'activeActionId', 'paidCost'])
    && typeof stack.id === 'string' && strings(stack.cardIds) && unique(stack.cardIds)
    && stack.cardIds.every((id) => cardIds.has(id))
    && (stack.activeActionId === undefined || typeof stack.activeActionId === 'string')
    && (stack.paidCost === undefined || validResources(stack.paidCost, true)))) return false;
  const stacks = input.stacks as TermState['stacks'];
  if (!unique(stacks.map((stack) => stack.id))) return false;
  if (!unique(stacks.flatMap((stack) => stack.cardIds))) return false;
  const stacksById = new Map(stacks.map((stack) => [stack.id, stack]));
  if (cards.some((card) => card.location === 'desk' && !stacksById.get(card.stackId)?.cardIds.includes(card.id))) return false;

  const bill = input.bill;
  if (!isRecord(bill) || !hasOnlyKeys(bill, ['issueId', 'title', 'provisionIds', 'provisionReceipts', 'stage', 'outcome', 'revision'])
    || bill.issueId !== scenario.issue.id || typeof bill.title !== 'string' || !strings(bill.provisionIds)
    || !bill.provisionIds.every((id) => scenario.cards.some((card) => card.id === id && card.kind === 'policy'))
    || !Array.isArray(bill.provisionReceipts) || !bill.provisionReceipts.every(jsonSafe)
    || !['draft', 'committee', 'house', 'senate', 'resolution', 'election', 'complete'].includes(bill.stage as string)
    || !['active', 'enacted', 'failed-committee', 'failed-house', 'failed-senate', 'absorbed-into-package'].includes(bill.outcome as string)
    || !isInteger(bill.revision, 0)) return false;

  if (!Array.isArray(input.relationships) || !input.relationships.every((relationship) => isRecord(relationship)
    && hasOnlyKeys(relationship, ['memberId', 'support', 'demandProvisionId', 'demandOccurrenceId', 'promiseOccurrenceIds', 'conditions', 'evaluatedRevision'])
    && typeof relationship.memberId === 'string' && scenario.cards.some((card) => card.id === relationship.memberId && card.kind === 'coalition')
    && ['unavailable', 'interested', 'conditional', 'committed', 'refused'].includes(relationship.support as string)
    && (relationship.demandProvisionId === undefined || typeof relationship.demandProvisionId === 'string')
    && (relationship.demandOccurrenceId === undefined || typeof relationship.demandOccurrenceId === 'string')
    && strings(relationship.promiseOccurrenceIds) && Array.isArray(relationship.conditions) && relationship.conditions.every(jsonSafe)
    && isInteger(relationship.evaluatedRevision, 0))) return false;
  if (!isInteger(input.staffCapacity, 0)) return false;

  if (!Array.isArray(input.activeWork) || !input.activeWork.every((work) => isRecord(work)
    && hasOnlyKeys(work, ['id', 'kind', 'patternId', 'effectivePattern', 'expansionIds', 'effectiveExpansions', 'cardIds', 'staffCardIds', 'paidCost', 'completesAtSimulationMs', 'billRevision', 'effectiveRuleVersion', 'consumedCardIds', 'returnedCardIds', 'decisionOrigin'])
    && typeof work.id === 'string' && ['pattern', 'study'].includes(work.kind as string)
    && strings(work.cardIds) && work.cardIds.every((id) => cardIds.has(id))
    && strings(work.staffCardIds) && work.staffCardIds.every((id) => cardIds.has(id))
    && validResources(work.paidCost, true) && isInteger(work.completesAtSimulationMs, 0)
    && (work.billRevision === undefined || isInteger(work.billRevision, 0))
    && typeof work.effectiveRuleVersion === 'string' && strings(work.consumedCardIds) && strings(work.returnedCardIds)
    && (work.kind === 'pattern'
      ? typeof work.patternId === 'string' && jsonSafe(work.effectivePattern)
      : strings(work.expansionIds) && Array.isArray(work.effectiveExpansions) && work.effectiveExpansions.every(jsonSafe))
    && (work.decisionOrigin === undefined || jsonSafe(work.decisionOrigin)))) return false;
  const work = input.activeWork as TermState['activeWork'];
  if (!unique(work.map((entry) => entry.id))) return false;
  if (work.some((entry) => entry.cardIds.some((id) => cards.find((card) => card.id === id)?.status !== 'working'))) return false;
  if (work.some((entry) => entry.staffCardIds.some((id) => {
    const card = cards.find((candidate) => candidate.id === id);
    return scenario.cards.find((definition) => definition.id === card?.definitionId)?.kind !== 'staff';
  }))) return false;
  if (work.some((entry) => [...entry.consumedCardIds, ...entry.returnedCardIds].some((id) => !entry.cardIds.includes(id)))) return false;

  if (!Array.isArray(input.obligations) || !input.obligations.every((obligation) => isRecord(obligation)
    && hasOnlyKeys(obligation, ['id', 'sourceId', 'due', 'mandatory', 'status', 'rewardCapital', 'trustPenalty'])
    && typeof obligation.id === 'string' && typeof obligation.sourceId === 'string'
    && scenario.obligationDefinitions.some((definition) => definition.id === obligation.sourceId)
    && isRecord(obligation.due) && hasOnlyKeys(obligation.due, ['week', 'offsetMs'])
    && isInteger(obligation.due.week, 1, 6) && isInteger(obligation.due.offsetMs, 0)
    && typeof obligation.mandatory === 'boolean' && ['open', 'fulfilled', 'missed', 'declined'].includes(obligation.status as string)
    && isFiniteNumber(obligation.rewardCapital) && isFiniteNumber(obligation.trustPenalty))) return false;

  if (!Array.isArray(input.pendingDecisions) || !input.pendingDecisions.every((decision) => isRecord(decision)
    && hasOnlyKeys(decision, ['id', 'sourceId', 'occurrenceId', 'officeDefinitionId', 'approachedBillRevision', 'expectedBillRevision', 'choiceIds', 'status'])
    && typeof decision.id === 'string' && typeof decision.sourceId === 'string' && typeof decision.occurrenceId === 'string'
    && scenario.demandDefinitions.some((demand) => demand.id === decision.sourceId)
    && typeof decision.officeDefinitionId === 'string' && scenario.cards.some((card) => card.id === decision.officeDefinitionId && card.kind === 'coalition')
    && isInteger(decision.approachedBillRevision, 0) && isInteger(decision.expectedBillRevision, 0)
    && strings(decision.choiceIds) && decision.choiceIds.every((id) => scenario.decisionChoices.some((choice) => choice.id === id))
    && ['pending', 'resolved'].includes(decision.status as string))) return false;

  for (const key of ['rewardedOccurrenceIds', 'resolvedWeekIds', 'discoveredPatternIds', 'storyHistory', 'objectives'] as const) {
    if (!strings(input[key]) || !unique(input[key])) return false;
  }
  if (!(input.discoveredPatternIds as string[]).every((id) => scenario.patterns.some((pattern) => pattern.id === id))) return false;
  if (!isRecord(input.unlockedSlotExpansions) || !Object.values(input.unlockedSlotExpansions).every(strings)) return false;
  if (!Array.isArray(input.electionEffects) || !input.electionEffects.every(jsonSafe)) return false;
  if (!Array.isArray(input.eventLog) || !input.eventLog.every(validEvent)) return false;
  if (!['active', 'complete'].includes(input.runStatus as string)) return false;
  if (input.sessionRecord !== undefined && !jsonSafe(input.sessionRecord)) return false;
  if (input.weekPhase === 'boundary' && input.paused !== true) return false;
  return true;
}

function adaptV1State(value: unknown): unknown {
  if (!isRecord(value) || value.schemaVersion !== 1) return value;
  const noWorkingCards = Array.isArray(value.cards)
    && value.cards.every((card) => !isRecord(card) || card.status !== 'working');
  if (!noWorkingCards && value.activeWork === undefined) return value;
  return {
    ...value,
    schemaVersion: 2,
    activeWork: value.activeWork ?? [],
    obligations: value.obligations ?? [],
    pendingDecisions: value.pendingDecisions ?? [],
    rewardedOccurrenceIds: value.rewardedOccurrenceIds ?? [],
    resolvedWeekIds: value.resolvedWeekIds ?? [],
    runStatus: value.runStatus ?? 'active',
  };
}

export function scenarioSnapshotHash(scenario: ScenarioDefinition): string {
  return canonicalSha256(scenario);
}

export function createSaveEnvelope(state: TermState, scenario: ScenarioDefinition): SaveEnvelopeV2 {
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    rulesVersion: CURRENT_RULES_VERSION,
    snapshotId: scenario.snapshotId,
    snapshotHash: scenarioSnapshotHash(scenario),
    state,
  };
}

export function validateAndMigrateSave(input: unknown, scenario: ScenarioDefinition): SaveValidationResult {
  if (!isRecord(input) || !hasOnlyKeys(input, ['saveSchemaVersion', 'rulesVersion', 'snapshotId', 'snapshotHash', 'state'])) {
    return { kind: 'corrupt', message: 'The saved checkpoint has an invalid document shape.' };
  }
  if (input.saveSchemaVersion !== 1 && input.saveSchemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
    return { kind: 'incompatible-version', message: `This checkpoint uses unsupported save schema version ${String(input.saveSchemaVersion)}.` };
  }
  if (input.rulesVersion !== 1 && input.rulesVersion !== CURRENT_RULES_VERSION) {
    return { kind: 'incompatible-version', message: `This checkpoint uses unsupported rules version ${String(input.rulesVersion)}.` };
  }
  if (input.saveSchemaVersion !== input.rulesVersion) {
    return { kind: 'incompatible-version', message: 'The checkpoint combines incompatible save-schema and rules versions.' };
  }
  const expectedHash = scenarioSnapshotHash(scenario);
  if (input.snapshotId !== scenario.snapshotId || input.snapshotHash !== expectedHash) {
    return { kind: 'wrong-snapshot', message: 'This checkpoint belongs to a different content snapshot.' };
  }
  const state = input.saveSchemaVersion === 1 ? adaptV1State(input.state) : input.state;
  if (!validState(state, scenario)) {
    return { kind: 'corrupt', message: 'The checkpoint state is malformed or has broken canonical references.' };
  }
  return { kind: 'valid', envelope: createSaveEnvelope(state, scenario) };
}
