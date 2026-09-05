import { COMPUTED_TAGS, type ScenarioDefinition, type TermState } from '@/domain/types';
import { EFFECTIVE_RULE_VERSION, effectiveWorkRule } from '@/domain/work';
import {
  recipePatternSchema,
  relationshipConditionSchema,
  resourceCostSchema,
  tacticExpansionSchema,
} from '@/content/schema';
import { canonicalJson, canonicalSha256 } from '@/persistence/canonicalHash';
import { matchesPatternOutputReceipt } from '@/domain/patternResolvers';
import { SESSION_READINESS_MILESTONE_ID } from '@/domain/objectives';
import { buildSessionRecord } from '@/domain/sessionRecord';

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
const GOVERNING_VALUES = [
  'Fiscal Stewardship', 'Local Control', 'Market Competition', 'Public Investment',
  'Tenant Stability', 'Housing Supply', 'Environmental Resilience', 'Fair Access',
] as const;

function validResources(value: unknown, partial = false): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, RESOURCE_KEYS)) return false;
  return RESOURCE_KEYS.every((key) => {
    if (partial && value[key] === undefined) return true;
    return isFiniteNumber(value[key]);
  });
}

function validResourceTotals(value: unknown): boolean {
  if (!validResources(value)) return false;
  const resources = value as TermState['resources'];
  return resources.staffAttention >= 0 && resources.staffAttention <= 9
    && resources.politicalCapital >= 0 && resources.politicalCapital <= 9
    && ['districtTrust', 'billMomentum', 'policyIntegrity', 'staffMorale'].every((key) =>
      resources[key as keyof typeof resources] >= 0 && resources[key as keyof typeof resources] <= 100);
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

function validAuthoredConcern(value: unknown, scenario: ScenarioDefinition): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['concernId', 'recipientOfficeDefinitionId'])
    && typeof value.concernId === 'string'
    && scenario.demandDefinitions.some((demand) => demand.id === value.concernId)
    && typeof value.recipientOfficeDefinitionId === 'string'
    && scenario.cards.some((card) => card.id === value.recipientOfficeDefinitionId && card.kind === 'coalition');
}

function validCard(value: unknown, scenario: ScenarioDefinition): value is TermState['cards'][number] {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id', 'definitionId', 'stackId', 'x', 'y', 'remainingMs', 'status', 'form', 'location',
    'sourceDefinitionIds', 'policyDefinitionId', 'staffTraitId', 'origin',
  ])) return false;
  if (typeof value.id !== 'string' || typeof value.definitionId !== 'string' || typeof value.stackId !== 'string') return false;
  const definition = scenario.cards.find((card) => card.id === value.definitionId);
  if (!definition) return false;
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isFiniteNumber(value.remainingMs) || value.remainingMs < 0) return false;
  if (!['idle', 'working', 'resolved', 'expired'].includes(value.status as string)) return false;
  if (!['raw', 'summary', 'drafted', 'prepared'].includes(value.form as string)) return false;
  if (value.form === 'summary' && definition.kind !== 'evidence') return false;
  if (value.form === 'drafted' && definition.kind !== 'policy') return false;
  if (value.form === 'prepared' && !['evidence', 'constituency', 'institution', 'political'].includes(definition.kind)) return false;
  if (!['desk', 'filed', 'archived'].includes(value.location as string)) return false;
  if (!strings(value.sourceDefinitionIds) || !value.sourceDefinitionIds.every((id) => scenario.cards.some((card) => card.id === id))) return false;
  if (value.policyDefinitionId !== undefined && (typeof value.policyDefinitionId !== 'string' || !scenario.cards.some((card) => card.id === value.policyDefinitionId && card.kind === 'policy'))) return false;
  if (value.staffTraitId !== undefined && (typeof value.staffTraitId !== 'string' || !scenario.staffTraits.some((trait) => trait.id === value.staffTraitId))) return false;
  return value.origin === undefined || (isRecord(value.origin)
    && hasOnlyKeys(value.origin, ['explanationKey', 'inputDefinitionIds', 'consumedDefinitionIds', 'authoredConcern'])
    && typeof value.origin.explanationKey === 'string'
    && strings(value.origin.inputDefinitionIds)
    && value.origin.inputDefinitionIds.every((id) => scenario.cards.some((card) => card.id === id))
    && strings(value.origin.consumedDefinitionIds)
    && value.origin.consumedDefinitionIds.every((id) => scenario.cards.some((card) => card.id === id))
    && (value.origin.authoredConcern === undefined || validAuthoredConcern(value.origin.authoredConcern, scenario)));
}

const EVENT_KEYS: Record<string, readonly string[]> = {
  STACK_ACCEPTED: ['type', 'stackId', 'cardIds', 'definitionIds', 'patternId'],
  STACK_REJECTED: ['type', 'cardIds', 'targetStackId', 'reason', 'message'],
  CARD_MOVED: ['type', 'cardId', 'x', 'y'],
  ACTION_STARTED: ['type', 'stackId', 'durationMs', 'patternId', 'assignmentKind'],
  CARD_TRANSFORMED: ['type', 'stackId', 'consumedCardIds', 'producedCardIds', 'returnedCardIds', 'outputDefinitionId',
    'outputForm', 'producerPatternId', 'outputSlotIndex', 'outputSourceCardId', 'outputSourceDefinitionId',
    'outputSourceForm', 'inputDefinitionIds', 'consumedDefinitionIds', 'authoredConcernId',
    'authoredConcernOfficeDefinitionId', 'explanationKey'],
  PATTERN_DISCOVERED: ['type', 'patternId'],
  TACTIC_EXPANSION_ACTIVATED: ['type', 'expansionId', 'tacticDefinitionId', 'targetPatternId'],
  RESOURCE_CHANGED: ['type', 'changes', 'reason'],
  ELECTION_EFFECT_ADDED: ['type', 'effect'],
  ELECTION_OUTLOOK_UPDATED: ['type', 'forecast'],
  PAUSE_CHANGED: ['type', 'paused'],
  EVENT_TRIGGERED: ['type', 'storyEventId', 'occurrenceId', 'whyRules'],
  STORY_DECISION_PRESENTED: ['type', 'decisionId', 'storyEventId', 'occurrenceId', 'choiceIds'],
  STORY_DECISION_RESOLVED: ['type', 'decisionId', 'storyEventId', 'choiceId', 'occurrenceId'],
  WEEK_RESOLVED: ['type', 'week', 'summary'],
  OBLIGATION_STATUS_CHANGED: ['type', 'obligationId', 'status'],
  OBLIGATION_CREATED: ['type', 'obligationId', 'sourceId', 'occurrenceId', 'sourceCardInstanceId'],
  WORK_SUBMITTED: ['type', 'workId', 'cardIds', 'completesAtSimulationMs'],
  PATTERN_COMPLETED: ['type', 'workId', 'patternId', 'inputCardIds', 'inputDefinitionIds', 'consumedDefinitionIds', 'authoredConcernId'],
  PROVISION_DOCKETED: ['type', 'cardId', 'provisionId', 'revision'],
  PROVISION_NEGOTIATED: ['type', 'decisionId', 'occurrenceId', 'provisionId', 'change', 'revision'],
  DECISION_PRESENTED: ['type', 'decisionId', 'sourceId', 'occurrenceId', 'choiceIds'],
  DECISION_RESOLVED: ['type', 'decisionId', 'choiceId', 'occurrenceId'],
  PROMISE_CHANGED: ['type', 'promiseOccurrenceId', 'status'],
  OPPORTUNITY_DECLINED: ['type', 'occurrenceId', 'sourceId'],
  PACK_OPENED: ['type', 'packOccurrenceId', 'categoryId', 'cardDefinitionIds'],
  CARD_LOCATION_CHANGED: ['type', 'cardId', 'location'],
  READINESS_MILESTONE_REWARDED: ['type', 'rewardId', 'appliedCapital'],
  SESSION_CONCLUDED: ['type', 'outcome'],
  VOTE_RESOLVED: ['type', 'stage', 'passed', 'tally'],
  REELECTION_RESOLVED: ['type', 'result'],
  COMMAND_REJECTED: ['type', 'commandType', 'reason', 'message'],
};

const OPTIONAL_EVENT_FIELDS = new Set([
  'patternId', 'assignmentKind', 'targetStackId', 'sourceCardInstanceId', 'inputCardIds',
  'inputDefinitionIds', 'consumedDefinitionIds', 'authoredConcernId', 'outputForm', 'producerPatternId',
  'authoredConcernOfficeDefinitionId', 'outputSlotIndex', 'outputSourceCardId', 'outputSourceDefinitionId',
  'outputSourceForm',
]);
const EVENT_STRING_ARRAY_FIELDS = new Set([
  'cardIds', 'definitionIds', 'consumedCardIds', 'producedCardIds', 'returnedCardIds',
  'whyRules', 'summary', 'choiceIds', 'cardDefinitionIds', 'inputCardIds', 'inputDefinitionIds',
  'consumedDefinitionIds',
]);
const EVENT_NUMBER_FIELDS = new Set(['x', 'y', 'durationMs', 'week', 'completesAtSimulationMs', 'revision', 'outputSlotIndex', 'appliedCapital']);
const EVENT_OBJECT_FIELDS = new Set(['changes', 'effect', 'forecast', 'tally', 'result']);

function validElectionEffect(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['id', 'week', 'label', 'contribution', 'explanation', 'sourceClass'])
    && typeof value.id === 'string' && isInteger(value.week, 1, 6)
    && typeof value.label === 'string' && isFiniteNumber(value.contribution)
    && typeof value.explanation === 'string' && value.sourceClass === 'simulated';
}

function validElectionLine(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['id', 'label', 'contribution', 'runningTotal', 'explanation', 'sourceClass'])
    && typeof value.id === 'string' && typeof value.label === 'string'
    && isFiniteNumber(value.contribution) && isFiniteNumber(value.runningTotal)
    && typeof value.explanation === 'string' && value.sourceClass === 'simulated';
}

function validForecast(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['low', 'high', 'status', 'breakdown', 'label'])
    && isFiniteNumber(value.low) && isFiniteNumber(value.high)
    && ['favored', 'toss-up', 'trailing'].includes(value.status as string)
    && Array.isArray(value.breakdown) && value.breakdown.every(validElectionLine)
    && value.label === 'Simulated outlook — not polling';
}

function validReelectionResult(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['simulatedVoteShare', 'outcome', 'breakdown'])
    && isFiniteNumber(value.simulatedVoteShare)
    && ['won', 'lost'].includes(value.outcome as string)
    && Array.isArray(value.breakdown) && value.breakdown.every(validElectionLine);
}

function validTally(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['committed', 'conditional', 'undecided', 'opposed'])
    && ['committed', 'conditional', 'undecided', 'opposed'].every((key) => isInteger(value[key], 0));
}

const REJECTION_REASONS = [
  'unknown-card', 'unknown-stack', 'card-expired', 'card-busy', 'no-matching-pattern',
  'needs-tactic', 'insufficient-resources', 'tactic-already-active', 'unknown-tactic-expansion',
  'unknown-pattern', 'ineligible-staff', 'malformed-command', 'invalid-stage', 'clock-not-expired',
  'stale-decision', 'unknown-decision', 'unknown-choice', 'duplicate-outreach', 'pending-decision',
  'duplicate-provision', 'invalid-card-form', 'run-complete', 'unsupported-command',
];

function validTransformProducerClaim(value: RecordValue, scenario: ScenarioDefinition): boolean {
  const pattern = scenario.patterns.find((candidate) => candidate.id === value.producerPatternId);
  if (!pattern) return false;
  return matchesPatternOutputReceipt(pattern, scenario, {
    definitionId: value.outputDefinitionId as string,
    form: value.outputForm as TermState['cards'][number]['form'],
    explanationKey: value.explanationKey as string,
    outputSlotIndex: value.outputSlotIndex as number | undefined,
    outputSourceDefinitionId: value.outputSourceDefinitionId as string | undefined,
    outputSourceForm: value.outputSourceForm as TermState['cards'][number]['form'] | undefined,
  });
}

function validEvent(value: unknown, scenario: ScenarioDefinition): boolean {
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
  switch (value.type) {
    case 'STACK_ACCEPTED':
      return (value.definitionIds as string[]).every((id) => scenario.cards.some((card) => card.id === id))
        && (value.patternId === undefined || scenario.patterns.some((pattern) => pattern.id === value.patternId));
    case 'STACK_REJECTED':
      return REJECTION_REASONS.includes(value.reason as string);
    case 'ACTION_STARTED':
      return (value.durationMs as number) >= 0
        && (value.patternId === undefined || scenario.patterns.some((pattern) => pattern.id === value.patternId))
        && (value.assignmentKind === undefined || ['card-work', 'study-tactic'].includes(value.assignmentKind as string));
    case 'CARD_TRANSFORMED':
      if (!scenario.cards.some((card) => card.id === value.outputDefinitionId)) return false;
      if ((value.producedCardIds as string[]).length === 0) return true;
      if (!['raw', 'summary', 'drafted', 'prepared'].includes(value.outputForm as string)
        || typeof value.producerPatternId !== 'string'
        || !strings(value.inputDefinitionIds) || !strings(value.consumedDefinitionIds)) return false;
      if (!(value.inputDefinitionIds as string[]).every((id) => scenario.cards.some((card) => card.id === id))
        || !(value.consumedDefinitionIds as string[]).every((id) => scenario.cards.some((card) => card.id === id))) return false;
      const sourceFields = [value.outputSlotIndex, value.outputSourceCardId, value.outputSourceDefinitionId, value.outputSourceForm];
      if (sourceFields.some((field) => field !== undefined)) {
        if (!isInteger(value.outputSlotIndex, 0)
          || typeof value.outputSourceCardId !== 'string'
          || typeof value.outputSourceDefinitionId !== 'string'
          || !['raw', 'summary', 'drafted', 'prepared'].includes(value.outputSourceForm as string)
          || ![...(value.consumedCardIds as string[]), ...(value.returnedCardIds as string[])].includes(value.outputSourceCardId)
          || !(value.inputDefinitionIds as string[]).includes(value.outputSourceDefinitionId)) return false;
      }
      if ((value.authoredConcernId === undefined) !== (value.authoredConcernOfficeDefinitionId === undefined)) return false;
      const authoredConcernId = value.authoredConcernId;
      if (authoredConcernId !== undefined && !scenario.cards.some((card) => card.kind === 'constituency'
        && card.authoredConcern?.concernId === authoredConcernId
        && card.authoredConcern?.recipientOfficeDefinitionId === value.authoredConcernOfficeDefinitionId)) return false;
      return validTransformProducerClaim(value, scenario);
    case 'PATTERN_DISCOVERED':
    case 'PATTERN_COMPLETED':
      return scenario.patterns.some((pattern) => pattern.id === value.patternId)
        && (value.inputDefinitionIds === undefined || (value.inputDefinitionIds as string[])
          .every((id) => scenario.cards.some((card) => card.id === id)))
        && (value.consumedDefinitionIds === undefined || (value.consumedDefinitionIds as string[])
          .every((id) => scenario.cards.some((card) => card.id === id)))
        && (value.authoredConcernId === undefined || scenario.demandDefinitions.some((demand) => demand.id === value.authoredConcernId));
    case 'TACTIC_EXPANSION_ACTIVATED':
      return scenario.tacticExpansions.some((expansion) => expansion.id === value.expansionId
        && expansion.tacticDefinitionId === value.tacticDefinitionId
        && expansion.targetPatternId === value.targetPatternId);
    case 'RESOURCE_CHANGED':
      return validResources(value.changes, true);
    case 'ELECTION_EFFECT_ADDED':
      return validElectionEffect(value.effect);
    case 'ELECTION_OUTLOOK_UPDATED':
      return validForecast(value.forecast);
    case 'WEEK_RESOLVED':
      return isInteger(value.week, 1, 6);
    case 'EVENT_TRIGGERED':
      return scenario.storyEvents.some((event) => event.id === value.storyEventId);
    case 'STORY_DECISION_PRESENTED': {
      const event = scenario.storyEvents.find((entry) => entry.id === value.storyEventId);
      return Boolean(event) && (value.choiceIds as string[]).every((id) => event?.choices.some((choice) => choice.id === id));
    }
    case 'STORY_DECISION_RESOLVED':
      return scenario.storyEvents.some((event) => event.id === value.storyEventId
        && event.choices.some((choice) => choice.id === value.choiceId));
    case 'OBLIGATION_STATUS_CHANGED':
      return ['fulfilled', 'missed', 'declined'].includes(value.status as string);
    case 'OBLIGATION_CREATED':
      return scenario.obligationDefinitions.some((definition) => definition.id === value.sourceId)
        && value.obligationId === `${value.sourceId}:${value.occurrenceId}`;
    case 'WORK_SUBMITTED':
      return isInteger(value.completesAtSimulationMs, 0);
    case 'PROVISION_DOCKETED':
    case 'PROVISION_NEGOTIATED':
      return scenario.cards.some((card) => card.id === value.provisionId && card.kind === 'policy')
        && (value.type !== 'PROVISION_NEGOTIATED' || ['added', 'removed'].includes(value.change as string));
    case 'DECISION_PRESENTED':
      return scenario.demandDefinitions.some((demand) => demand.id === value.sourceId)
        && (value.choiceIds as string[]).every((id) => scenario.decisionChoices.some((choice) => choice.id === id));
    case 'DECISION_RESOLVED':
      return scenario.decisionChoices.some((choice) => choice.id === value.choiceId);
    case 'PROMISE_CHANGED':
      return ['open', 'fulfilled', 'broken'].includes(value.status as string);
    case 'PACK_OPENED':
      return scenario.weeklyPacks.some((pack) => pack.pools.some((pool) => pool.id === value.categoryId))
        && (value.cardDefinitionIds as string[]).every((id) => scenario.cards.some((card) => card.id === id));
    case 'CARD_LOCATION_CHANGED':
      return ['desk', 'filed', 'archived'].includes(value.location as string);
    case 'READINESS_MILESTONE_REWARDED':
      return value.rewardId === SESSION_READINESS_MILESTONE_ID
        && isInteger(value.appliedCapital, 0, 1);
    case 'SESSION_CONCLUDED':
      return ['ready', 'not-ready'].includes(value.outcome as string);
    case 'VOTE_RESOLVED':
      return ['draft', 'committee', 'house', 'senate', 'resolution', 'election', 'complete'].includes(value.stage as string)
        && validTally(value.tally);
    case 'REELECTION_RESOLVED':
      return validReelectionResult(value.result);
    case 'COMMAND_REJECTED':
      return REJECTION_REASONS.includes(value.reason as string);
    default:
      return true;
  }
}

function validRelationshipCondition(value: unknown, scenario: ScenarioDefinition): boolean {
  const parsed = relationshipConditionSchema.safeParse(value);
  if (!parsed.success) return false;
  const condition = parsed.data;
  if (condition.kind === 'governing-value') return true;
  return scenario.tagTaxonomy.includes(condition.tag);
}

function validProvisionReceipt(value: unknown, scenario: ScenarioDefinition): boolean {
  if (!isRecord(value) || !['draft', 'decision'].includes(value.origin as string)) return false;
  const common = ['origin', 'provisionId', 'sourceDefinitionIds', 'docketedAtRevision', 'plainLanguage', 'form', 'sourceClass'];
  const allowed = value.origin === 'draft'
    ? [...common, 'draftedCardId']
    : [...common, 'decisionId', 'sourceId', 'occurrenceId'];
  if (!hasOnlyKeys(value, allowed)
    || typeof value.provisionId !== 'string'
    || !scenario.cards.some((card) => card.id === value.provisionId && card.kind === 'policy')
    || !strings(value.sourceDefinitionIds)
    || !value.sourceDefinitionIds.every((id) => scenario.cards.some((card) => card.id === id))
    || !isInteger(value.docketedAtRevision, 1)
    || typeof value.plainLanguage !== 'string'
    || value.form !== 'drafted'
    || value.sourceClass !== 'simulated') return false;
  if (value.origin === 'draft') return typeof value.draftedCardId === 'string';
  return typeof value.decisionId === 'string'
    && typeof value.sourceId === 'string'
    && scenario.demandDefinitions.some((demand) => demand.id === value.sourceId)
    && typeof value.occurrenceId === 'string';
}

function validDecisionOrigin(value: unknown, scenario: ScenarioDefinition): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['decisionId', 'choiceId', 'occurrenceId', 'officeDefinitionId'])
    && typeof value.decisionId === 'string'
    && typeof value.choiceId === 'string'
    && scenario.decisionChoices.some((choice) => choice.id === value.choiceId && choice.action === 'counter')
    && typeof value.occurrenceId === 'string'
    && typeof value.officeDefinitionId === 'string'
    && scenario.cards.some((card) => card.id === value.officeDefinitionId && card.kind === 'coalition');
}

const MAX_LEGACY_CAPTURED_EXPANSIONS = 8;

function validEffectivePatternShape(value: unknown, patternId: string, scenario: ScenarioDefinition): boolean {
  const parsed = recipePatternSchema.safeParse(value);
  if (!parsed.success || parsed.data.id !== patternId) return false;
  const knownTags = new Set([...scenario.tagTaxonomy, ...COMPUTED_TAGS]);
  if (parsed.data.slots.some((slot) =>
    [...(slot.requiredTags ?? []), ...(slot.anyTags ?? [])].some((tag) => !knownTags.has(tag)))) return false;
  const output = parsed.data.output;
  if (output.mode === 'fixed') {
    return scenario.cards.some((card) => card.id === output.definitionId);
  }
  const outputId = output.parameters?.outputDefinitionId;
  return outputId === undefined
    || typeof outputId === 'string' && scenario.cards.some((card) => card.id === outputId);
}

function exactEffectivePattern(
  persisted: unknown,
  patternId: string,
  expansionIds: string[],
  staffCardIds: string[],
  state: TermState,
  scenario: ScenarioDefinition,
): boolean {
  const authored = scenario.patterns.find((pattern) => pattern.id === patternId);
  if (!authored) return false;
  const rebuilt = effectiveWorkRule(authored, expansionIds, staffCardIds, state, scenario);
  return rebuilt.appliedExpansionIds.length === expansionIds.length
    && rebuilt.appliedExpansionIds.every((id) => expansionIds.includes(id))
    && canonicalJson(rebuilt.effectivePattern) === canonicalJson(persisted);
}

function someExpansionSubset(
  ids: string[],
  accepts: (subset: string[]) => boolean,
  index = 0,
  chosen: string[] = [],
): boolean {
  if (index === ids.length) return accepts(chosen);
  if (someExpansionSubset(ids, accepts, index + 1, chosen)) return true;
  return someExpansionSubset(ids, accepts, index + 1, [...chosen, ids[index]]);
}

function validCapturedEffectivePattern(
  work: RecordValue,
  state: TermState,
  scenario: ScenarioDefinition,
): boolean {
  if (typeof work.patternId !== 'string'
    || !validEffectivePatternShape(work.effectivePattern, work.patternId, scenario)
    || !strings(work.staffCardIds)) return false;
  const patternId = work.patternId;
  const staffCardIds = work.staffCardIds;
  const currentlyUnlocked = state.unlockedSlotExpansions[patternId] ?? [];
  const authoredIds = new Set(scenario.tacticExpansions
    .filter((expansion) => expansion.targetPatternId === patternId)
    .map((expansion) => expansion.id));
  if (work.effectiveExpansionIds !== undefined) {
    if (!strings(work.effectiveExpansionIds) || !unique(work.effectiveExpansionIds)
      || !work.effectiveExpansionIds.every((id) => authoredIds.has(id) && currentlyUnlocked.includes(id))) return false;
    return exactEffectivePattern(
      work.effectivePattern,
      patternId,
      work.effectiveExpansionIds,
      staffCardIds,
      state,
      scenario,
    );
  }

  // Saves emitted before captured provenance was added can still be proven safe
  // against the finite set of authored expansions already unlocked in that run.
  const legacyCandidates = currentlyUnlocked.filter((id) => authoredIds.has(id)).sort();
  if (legacyCandidates.length > MAX_LEGACY_CAPTURED_EXPANSIONS) return false;
  return someExpansionSubset(legacyCandidates, (subset) => exactEffectivePattern(
    work.effectivePattern,
    patternId,
    subset,
    staffCardIds,
    state,
    scenario,
  ));
}

function validSessionRecord(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, [
      'id', 'outcome', 'completedAtSimulationMs', 'setup', 'objective', 'gaps', 'bill',
      'integrity', 'promises', 'obligations', 'declinedOpportunities', 'causeEventIds',
    ])
    && typeof value.id === 'string'
    && ['ready', 'not-ready'].includes(value.outcome as string)
    && isInteger(value.completedAtSimulationMs, 0)
    && isRecord(value.setup) && isRecord(value.objective) && isRecord(value.gaps)
    && isRecord(value.bill) && isRecord(value.integrity)
    && Array.isArray(value.promises) && Array.isArray(value.obligations)
    && Array.isArray(value.declinedOpportunities) && strings(value.causeEventIds)
    && jsonSafe(value);
}

const WORK_COMMON_KEYS = [
  'id', 'kind', 'cardIds', 'staffCardIds', 'paidCost', 'completesAtSimulationMs',
  'billRevision', 'effectiveRuleVersion', 'consumedCardIds', 'returnedCardIds', 'decisionOrigin',
] as const;

function validActiveWorkKeys(value: RecordValue): boolean {
  if (value.kind === 'pattern') {
    return hasOnlyKeys(value, [...WORK_COMMON_KEYS, 'patternId', 'effectivePattern', 'effectiveExpansionIds']);
  }
  if (value.kind === 'study') {
    return hasOnlyKeys(value, [...WORK_COMMON_KEYS, 'expansionIds', 'effectiveExpansions']);
  }
  return false;
}

function validState(input: unknown, scenario: ScenarioDefinition): input is TermState {
  if (!isRecord(input) || !hasOnlyKeys(input, [
    'schemaVersion', 'mode', 'snapshotId', 'seed', 'rngCursor', 'week', 'simulationMs', 'elapsedMs',
    'weekPhase', 'weekLengthMs', 'paused', 'settings', 'player', 'cards', 'cardSeq', 'stacks', 'resources',
    'bill', 'relationships', 'staffCapacity', 'activeWork', 'obligations', 'pendingDecisions',
    'pendingStoryDecisions', 'revealedPacks',
    'runVariation',
    'rewardedOccurrenceIds', 'resolvedWeekIds', 'runStatus', 'sessionRecord', 'discoveredPatternIds',
    'unlockedSlotExpansions', 'electionEffects', 'storyHistory', 'objectives', 'eventLog',
  ])) return false;
  if (input.schemaVersion !== 2 || input.snapshotId !== scenario.snapshotId) return false;
  if (!scenario.supportedModes.includes(input.mode as TermState['mode'])) return false;
  if (!isInteger(input.seed) || !isInteger(input.rngCursor, 0) || !isInteger(input.week, 1, 6)) return false;
  if (!isInteger(input.simulationMs, 0) || !isInteger(input.elapsedMs, 0) || !isInteger(input.weekLengthMs, 1)) return false;
  if ((input.elapsedMs as number) > (input.weekLengthMs as number)) return false;
  if (!['active', 'boundary'].includes(input.weekPhase as string) || typeof input.paused !== 'boolean') return false;
  if (!validSettings(input.settings) || !isInteger(input.cardSeq, 0) || !validResourceTotals(input.resources)) return false;

  if (!isRecord(input.runVariation)
    || !hasOnlyKeys(input.runVariation, ['selectedDemandIdsByOffice', 'obligationDueByDefinitionId'])
    || !isRecord(input.runVariation.selectedDemandIdsByOffice)
    || !isRecord(input.runVariation.obligationDueByDefinitionId)) return false;
  const demandPools = new Map<string, string[]>();
  for (const demand of scenario.demandDefinitions) {
    demandPools.set(demand.officeDefinitionId, [...(demandPools.get(demand.officeDefinitionId) ?? []), demand.id]);
  }
  const selectedDemandIds = input.runVariation.selectedDemandIdsByOffice;
  if (canonicalJson(Object.keys(selectedDemandIds).sort()) !== canonicalJson([...demandPools.keys()].sort())
    || [...demandPools].some(([officeId, ids]) => typeof selectedDemandIds[officeId] !== 'string'
      || !ids.includes(selectedDemandIds[officeId] as string))) return false;
  const dueSelections = input.runVariation.obligationDueByDefinitionId;
  if (canonicalJson(Object.keys(dueSelections).sort())
    !== canonicalJson(scenario.obligationDefinitions.map((definition) => definition.id).sort())) return false;
  for (const definition of scenario.obligationDefinitions) {
    const due = dueSelections[definition.id];
    if (!isRecord(due) || !hasOnlyKeys(due, ['week', 'offsetMs'])
      || !(definition.dueOptions ?? [definition.due]).some((option) =>
        option.week === due.week && option.offsetMs === due.offsetMs)) return false;
  }

  const player = input.player;
  if (!isRecord(player) || !hasOnlyKeys(player, ['districtId', 'party', 'values', 'election'])
    || typeof player.districtId !== 'string' || !scenario.districts.some((district) => district.id === player.districtId)
    || !['democratic', 'republican'].includes(player.party as string)
    || !Array.isArray(player.values) || player.values.length !== 2
    || !player.values.every((value) => GOVERNING_VALUES.includes(value as (typeof GOVERNING_VALUES)[number]))
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
    && (stack.paidCost === undefined || resourceCostSchema.safeParse(stack.paidCost).success))) return false;
  const stacks = input.stacks as TermState['stacks'];
  if (!unique(stacks.map((stack) => stack.id))) return false;
  if (!unique(stacks.flatMap((stack) => stack.cardIds))) return false;
  const stacksById = new Map(stacks.map((stack) => [stack.id, stack]));
  if (cards.some((card) => card.location === 'desk' && !stacksById.get(card.stackId)?.cardIds.includes(card.id))) return false;

  const bill = input.bill;
  if (!isRecord(bill) || !hasOnlyKeys(bill, ['issueId', 'title', 'provisionIds', 'provisionReceipts', 'stage', 'outcome', 'revision'])
    || bill.issueId !== scenario.issue.id || bill.title !== scenario.issue.title || !strings(bill.provisionIds)
    || !bill.provisionIds.every((id) => scenario.cards.some((card) => card.id === id && card.kind === 'policy'))
    || !Array.isArray(bill.provisionReceipts) || !bill.provisionReceipts.every((receipt) => validProvisionReceipt(receipt, scenario))
    || !['draft', 'committee', 'house', 'senate', 'resolution', 'election', 'complete'].includes(bill.stage as string)
    || !['active', 'enacted', 'failed-committee', 'failed-house', 'failed-senate', 'absorbed-into-package'].includes(bill.outcome as string)
    || !isInteger(bill.revision, 0)) return false;
  const provisionIds = bill.provisionIds as string[];
  const receipts = bill.provisionReceipts as TermState['bill']['provisionReceipts'];
  if (!unique(provisionIds) || !unique(receipts.map((receipt) => receipt.provisionId))) return false;
  if (receipts.length !== provisionIds.length || receipts.some((receipt) => !provisionIds.includes(receipt.provisionId))) return false;
  if (receipts.some((receipt) => receipt.docketedAtRevision > (bill.revision as number))) return false;

  if (!Array.isArray(input.relationships) || !input.relationships.every((relationship) => isRecord(relationship)
    && hasOnlyKeys(relationship, ['memberId', 'support', 'demandProvisionId', 'demandOccurrenceId', 'promiseOccurrenceIds', 'conditions', 'evaluatedRevision'])
    && typeof relationship.memberId === 'string' && scenario.cards.some((card) => card.id === relationship.memberId && card.kind === 'coalition')
    && ['unavailable', 'interested', 'conditional', 'committed', 'refused'].includes(relationship.support as string)
    && (relationship.demandProvisionId === undefined || (typeof relationship.demandProvisionId === 'string'
      && scenario.demandDefinitions.some((demand) => demand.id === relationship.demandProvisionId && demand.officeDefinitionId === relationship.memberId)))
    && (relationship.demandOccurrenceId === undefined || typeof relationship.demandOccurrenceId === 'string')
    && strings(relationship.promiseOccurrenceIds) && unique(relationship.promiseOccurrenceIds)
    && Array.isArray(relationship.conditions) && relationship.conditions.every((condition) => validRelationshipCondition(condition, scenario))
    && isInteger(relationship.evaluatedRevision, 0))) return false;
  const relationships = input.relationships as TermState['relationships'];
  if (!unique(relationships.map((relationship) => relationship.memberId))) return false;
  if (relationships.some((relationship) => relationship.demandProvisionId
    !== selectedDemandIds[relationship.memberId])) return false;
  if (relationships.some((relationship) => relationship.evaluatedRevision > (bill.revision as number))) return false;
  if (!isInteger(input.staffCapacity, 0)) return false;
  if (!isRecord(input.unlockedSlotExpansions) || !Object.entries(input.unlockedSlotExpansions).every(([patternId, expansionIds]) =>
    scenario.patterns.some((pattern) => pattern.id === patternId)
      && strings(expansionIds)
      && unique(expansionIds)
      && expansionIds.every((id) => scenario.tacticExpansions.some((expansion) => expansion.id === id && expansion.targetPatternId === patternId)))) return false;

  if (!Array.isArray(input.activeWork) || !input.activeWork.every((work) => isRecord(work)
    && validActiveWorkKeys(work)
    && typeof work.id === 'string' && ['pattern', 'study'].includes(work.kind as string)
    && strings(work.cardIds) && work.cardIds.every((id) => cardIds.has(id))
    && strings(work.staffCardIds) && work.staffCardIds.every((id) => cardIds.has(id))
    && resourceCostSchema.safeParse(work.paidCost).success && isInteger(work.completesAtSimulationMs, input.simulationMs as number)
    && (work.billRevision === undefined || isInteger(work.billRevision, 0))
    && work.effectiveRuleVersion === EFFECTIVE_RULE_VERSION && strings(work.consumedCardIds) && strings(work.returnedCardIds)
    && (work.kind === 'pattern'
      ? typeof work.patternId === 'string'
        && scenario.patterns.some((pattern) => pattern.id === work.patternId)
        && validCapturedEffectivePattern(work, input as unknown as TermState, scenario)
      : strings(work.expansionIds) && unique(work.expansionIds)
        && work.expansionIds.every((id) => scenario.tacticExpansions.some((expansion) => expansion.id === id))
        && Array.isArray(work.effectiveExpansions)
        && work.effectiveExpansions.length === work.expansionIds.length
        && work.effectiveExpansions.every((expansion) => tacticExpansionSchema.safeParse(expansion).success)
        && work.effectiveExpansions.every((expansion) => isRecord(expansion)
          && (work.expansionIds as string[]).includes(expansion.id as string)
          && scenario.tacticExpansions.some((authored) => authored.id === expansion.id
            && canonicalJson(authored) === canonicalJson(expansion))))
    && (work.decisionOrigin === undefined || validDecisionOrigin(work.decisionOrigin, scenario)))) return false;
  const work = input.activeWork as TermState['activeWork'];
  if (!unique(work.map((entry) => entry.id))) return false;
  if (!unique(work.flatMap((entry) => entry.cardIds))) return false;
  if (work.some((entry) => !unique(entry.cardIds)
    || !unique(entry.staffCardIds)
    || !unique(entry.consumedCardIds)
    || !unique(entry.returnedCardIds)
    || entry.staffCardIds.some((id) => !entry.cardIds.includes(id))
    || entry.consumedCardIds.some((id) => entry.returnedCardIds.includes(id))
    || new Set([...entry.consumedCardIds, ...entry.returnedCardIds]).size !== entry.cardIds.length)) return false;
  if (work.some((entry) => entry.cardIds.some((id) => cards.find((card) => card.id === id)?.status !== 'working'))) return false;
  if (cards.some((card) => card.status === 'working' && !work.some((entry) => entry.cardIds.includes(card.id)))) return false;
  if (work.some((entry) => new Set(entry.cardIds.map((id) => cards.find((card) => card.id === id)?.stackId)).size !== 1)) return false;
  if (work.some((entry) => entry.staffCardIds.some((id) => {
    const card = cards.find((candidate) => candidate.id === id);
    return scenario.cards.find((definition) => definition.id === card?.definitionId)?.kind !== 'staff';
  }))) return false;
  if (work.some((entry) => entry.billRevision !== undefined && entry.billRevision > (bill.revision as number))) return false;
  if (work.some((entry) => [...entry.consumedCardIds, ...entry.returnedCardIds].some((id) => !entry.cardIds.includes(id)))) return false;

  if (!Array.isArray(input.obligations) || !input.obligations.every((obligation) => isRecord(obligation)
    && hasOnlyKeys(obligation, ['id', 'sourceId', 'sourceCardInstanceId', 'due', 'mandatory', 'status', 'rewardCapital', 'trustPenalty'])
    && typeof obligation.id === 'string' && typeof obligation.sourceId === 'string'
    && scenario.obligationDefinitions.some((definition) => definition.id === obligation.sourceId
      && (definition.dueOptions ?? [definition.due]).some((due) =>
        due.week === (obligation.due as RecordValue)?.week && due.offsetMs === (obligation.due as RecordValue)?.offsetMs)
      && definition.mandatory === obligation.mandatory
      && definition.rewardCapital === obligation.rewardCapital
      && definition.trustPenalty === obligation.trustPenalty)
    && isRecord(obligation.due) && hasOnlyKeys(obligation.due, ['week', 'offsetMs'])
    && (obligation.sourceCardInstanceId === undefined || typeof obligation.sourceCardInstanceId === 'string')
    && isInteger(obligation.due.week, 1, 6) && isInteger(obligation.due.offsetMs, 0)
    && typeof obligation.mandatory === 'boolean' && ['open', 'fulfilled', 'missed', 'declined'].includes(obligation.status as string)
    && isFiniteNumber(obligation.rewardCapital) && isFiniteNumber(obligation.trustPenalty))) return false;
  const obligations = input.obligations as TermState['obligations'];
  if (!unique(obligations.map((obligation) => obligation.id))) return false;
  if (obligations.some((obligation) => {
    const selected = dueSelections[obligation.sourceId];
    return !isRecord(selected) || selected.week !== obligation.due.week || selected.offsetMs !== obligation.due.offsetMs;
  })) return false;

  if (!Array.isArray(input.pendingDecisions) || !input.pendingDecisions.every((decision) => isRecord(decision)
    && hasOnlyKeys(decision, ['id', 'sourceId', 'occurrenceId', 'officeDefinitionId', 'approachedBillRevision', 'expectedBillRevision', 'choiceIds', 'status'])
    && typeof decision.id === 'string' && typeof decision.sourceId === 'string' && typeof decision.occurrenceId === 'string'
    && scenario.demandDefinitions.some((demand) => demand.id === decision.sourceId
      && demand.officeDefinitionId === decision.officeDefinitionId
      && strings(decision.choiceIds)
      && decision.choiceIds.length === demand.choiceIds.length
      && decision.choiceIds.every((id, index) => id === demand.choiceIds[index]))
    && selectedDemandIds[decision.officeDefinitionId as string] === decision.sourceId
    && typeof decision.officeDefinitionId === 'string' && scenario.cards.some((card) => card.id === decision.officeDefinitionId && card.kind === 'coalition')
    && isInteger(decision.approachedBillRevision, 0) && isInteger(decision.expectedBillRevision, 0)
    && strings(decision.choiceIds) && decision.choiceIds.every((id) => scenario.decisionChoices.some((choice) => choice.id === id))
    && ['pending', 'resolved'].includes(decision.status as string))) return false;
  const decisions = input.pendingDecisions as TermState['pendingDecisions'];
  if (!unique(decisions.map((decision) => decision.id)) || !unique(decisions.map((decision) => decision.occurrenceId))) return false;
  if (decisions.some((decision) => decision.status === 'pending' && decision.expectedBillRevision !== bill.revision)) return false;
  if (!Array.isArray(input.pendingStoryDecisions) || !input.pendingStoryDecisions.every((decision) => {
    if (!isRecord(decision) || !hasOnlyKeys(decision, ['id', 'storyEventId', 'occurrenceId', 'choiceIds', 'status'])
      || typeof decision.id !== 'string' || typeof decision.storyEventId !== 'string'
      || typeof decision.occurrenceId !== 'string' || !strings(decision.choiceIds)
      || !['pending', 'resolved'].includes(decision.status as string)) return false;
    const choiceIds = decision.choiceIds;
    return scenario.storyEvents.some((event) => event.id === decision.storyEventId
      && choiceIds.length === event.choices.length
      && choiceIds.every((id, index) => id === event.choices[index]?.id));
  })) return false;
  const storyDecisions = input.pendingStoryDecisions as TermState['pendingStoryDecisions'];
  if (!unique(storyDecisions.map((decision) => decision.id))
    || !unique(storyDecisions.map((decision) => decision.occurrenceId))) return false;
  if (!Array.isArray(input.revealedPacks) || !input.revealedPacks.every((pack) => isRecord(pack)
    && hasOnlyKeys(pack, ['packOccurrenceId', 'week', 'categoryId', 'cardDefinitionIds'])
    && typeof pack.packOccurrenceId === 'string' && isInteger(pack.week, 1, 6)
    && typeof pack.categoryId === 'string' && strings(pack.cardDefinitionIds)
    && scenario.weeklyPacks.some((definition) => definition.week === pack.week
      && definition.pools.some((pool) => pool.id === pack.categoryId))
    && pack.cardDefinitionIds.every((id) => scenario.cards.some((card) => card.id === id)))) return false;
  const packs = input.revealedPacks as TermState['revealedPacks'];
  if (!unique(packs.map((pack) => pack.packOccurrenceId))) return false;
  if (work.some((entry) => entry.decisionOrigin && !decisions.some((decision) =>
    decision.id === entry.decisionOrigin?.decisionId
      && decision.occurrenceId === entry.decisionOrigin.occurrenceId
      && decision.officeDefinitionId === entry.decisionOrigin.officeDefinitionId
      && decision.status === 'resolved'))) return false;
  if (work.some((entry) => entry.decisionOrigin && (
    entry.kind !== 'pattern'
      || scenario.decisionChoices.find((choice) => choice.id === entry.decisionOrigin?.choiceId)?.requiredWorkPatternId !== entry.patternId
  ))) return false;
  if (!Array.isArray(input.eventLog) || !input.eventLog.every((event) => validEvent(event, scenario))) return false;
  const eventLog = input.eventLog as TermState['eventLog'];
  if (receipts.some((receipt) => receipt.origin === 'draft'
    ? eventLog.filter((event) => event.type === 'CARD_TRANSFORMED'
      && event.producedCardIds.includes(receipt.draftedCardId)
      && event.outputForm === receipt.form
      && event.outputDefinitionId === receipt.provisionId).length !== 1
      || eventLog.filter((event) => event.type === 'PROVISION_DOCKETED'
        && event.cardId === receipt.draftedCardId
        && event.provisionId === receipt.provisionId
        && event.revision === receipt.docketedAtRevision).length !== 1
    : !decisions.some((decision) => decision.id === receipt.decisionId
      && decision.sourceId === receipt.sourceId
      && decision.occurrenceId === receipt.occurrenceId
      && decision.status === 'resolved'))) return false;

  for (const key of ['rewardedOccurrenceIds', 'resolvedWeekIds', 'discoveredPatternIds', 'storyHistory', 'objectives'] as const) {
    if (!strings(input[key]) || !unique(input[key])) return false;
  }
  if (!(input.discoveredPatternIds as string[]).every((id) => scenario.patterns.some((pattern) => pattern.id === id))) return false;
  if (!(input.objectives as string[]).every((id) => scenario.modeObjectives.some((objective) => objective.id === id))) return false;
  if (!Array.isArray(input.electionEffects) || !input.electionEffects.every(validElectionEffect)) return false;
  if (!unique((input.electionEffects as TermState['electionEffects']).map((effect) => effect.id))) return false;
  const transforms = eventLog.filter((event) => event.type === 'CARD_TRANSFORMED');
  const producedIds = transforms.flatMap((event) => event.producedCardIds);
  if (!unique(producedIds)) return false;
  for (const [eventIndex, transform] of transforms.entries()) {
    for (const producedId of transform.producedCardIds) {
      const live = (input.cards as TermState['cards']).filter((card) => card.id === producedId);
      const laterConsumption = transforms.slice(eventIndex + 1)
        .filter((candidate) => candidate.consumedCardIds.includes(producedId));
      if (live.length + laterConsumption.length !== 1) return false;
      if (live.length === 1 && !live[0]?.origin) return false;
    }
  }
  for (const card of input.cards as TermState['cards']) {
    if (!card.origin) continue;
    const matches = transforms.filter((event) => event.producedCardIds.includes(card.id)
      && event.outputDefinitionId === card.definitionId
      && event.outputForm === card.form
      && event.explanationKey === card.origin?.explanationKey
      && canonicalJson(event.inputDefinitionIds) === canonicalJson(card.origin?.inputDefinitionIds)
      && canonicalJson(event.consumedDefinitionIds) === canonicalJson(card.origin?.consumedDefinitionIds)
      && event.authoredConcernId === card.origin?.authoredConcern?.concernId
      && event.authoredConcernOfficeDefinitionId === card.origin?.authoredConcern?.recipientOfficeDefinitionId);
    if (matches.length !== 1) return false;
  }
  const presentedStories = eventLog.filter((event) => event.type === 'STORY_DECISION_PRESENTED');
  const resolvedStories = eventLog.filter((event) => event.type === 'STORY_DECISION_RESOLVED');
  const triggeredStories = eventLog.filter((event) => event.type === 'EVENT_TRIGGERED');
  const storyHistory = input.storyHistory as string[];
  if (presentedStories.length !== storyDecisions.length
    || resolvedStories.length !== storyDecisions.filter((d) => d.status === 'resolved').length
    || triggeredStories.length !== storyDecisions.length
    || storyHistory.length !== storyDecisions.length) return false;
  for (const [index, decision] of storyDecisions.entries()) {
    const trigger = triggeredStories[index];
    if (decision.id !== `story-decision:${decision.occurrenceId}`
      || decision.occurrenceId !== `${decision.storyEventId}:${decision.occurrenceId.slice(decision.storyEventId.length + 1)}`
      || !new RegExp(`^${decision.storyEventId}:week:[1-6]:draw:${index + 1}$`).test(decision.occurrenceId)
      || storyHistory[index] !== decision.occurrenceId
      || trigger?.storyEventId !== decision.storyEventId
      || trigger.occurrenceId !== decision.occurrenceId) return false;
    const presented = presentedStories.filter((event) => event.decisionId === decision.id
      && event.storyEventId === decision.storyEventId && event.occurrenceId === decision.occurrenceId
      && canonicalJson(event.choiceIds) === canonicalJson(decision.choiceIds));
    const resolved = resolvedStories.filter((event) => event.decisionId === decision.id
      && event.storyEventId === decision.storyEventId && event.occurrenceId === decision.occurrenceId);
    if (presented.length !== 1 || resolved.length !== (decision.status === 'resolved' ? 1 : 0)) return false;
  }
  const packEvents = eventLog.filter((event) => event.type === 'PACK_OPENED');
  if (packEvents.length !== packs.length) return false;
  for (const pack of packs) {
    if (pack.packOccurrenceId !== `pack:week:${pack.week}` || packEvents.filter((event) =>
      event.packOccurrenceId === pack.packOccurrenceId && event.categoryId === pack.categoryId
      && canonicalJson(event.cardDefinitionIds) === canonicalJson(pack.cardDefinitionIds)).length !== 1) return false;
  }
  const createdEvents = eventLog.filter((event) => event.type === 'OBLIGATION_CREATED');
  for (const obligation of input.obligations as TermState['obligations']) {
    const sourceDefinition = scenario.obligationDefinitions.find((definition) => definition.id === obligation.sourceId);
    if (sourceDefinition?.fulfillment.kind === 'completed-pattern' && sourceDefinition.fulfillment.requireSourceCardOccurrence) {
      const occurrences = createdEvents.filter((event) => event.obligationId === obligation.id
        && event.sourceId === obligation.sourceId && event.sourceCardInstanceId === obligation.sourceCardInstanceId);
      if (!obligation.sourceCardInstanceId || occurrences.length !== 1) return false;
    }
  }
  if (createdEvents.some((event) => !(input.obligations as TermState['obligations']).some((obligation) =>
    obligation.id === event.obligationId && obligation.sourceId === event.sourceId
      && obligation.sourceCardInstanceId === event.sourceCardInstanceId))) return false;
  if (!['active', 'complete'].includes(input.runStatus as string)) return false;
  const milestoneEvents = eventLog.filter((event) => event.type === 'READINESS_MILESTONE_REWARDED');
  const hasMilestoneReceipt = (input.rewardedOccurrenceIds as string[]).includes(SESSION_READINESS_MILESTONE_ID);
  if (milestoneEvents.length !== (hasMilestoneReceipt ? 1 : 0)) return false;
  if (milestoneEvents[0]) {
    const applied = milestoneEvents[0].appliedCapital;
    const resourceEvents = eventLog.filter((event) => event.type === 'RESOURCE_CHANGED')
      .filter((event) => event.reason === SESSION_READINESS_MILESTONE_ID);
    if (resourceEvents.length !== (applied === 0 ? 0 : 1)) return false;
    if (applied !== 0 && resourceEvents[0]?.changes.politicalCapital !== applied) return false;
  }
  const conclusionEvents = eventLog.filter((event) => event.type === 'SESSION_CONCLUDED');
  if (input.runStatus === 'active' && (input.sessionRecord !== undefined || conclusionEvents.length !== 0)) return false;
  if (input.runStatus === 'complete') {
    if (!validSessionRecord(input.sessionRecord) || conclusionEvents.length !== 1) return false;
    const record = input.sessionRecord as TermState['sessionRecord'];
    const stateForRecord = {
      ...input,
      settings: {
        ...(input.settings as TermState['settings']),
        // Reduced motion remains mutable presentation after an ending. Its
        // captured value belongs to the frozen record and is not reconstructed
        // from the current presentation preference.
        reducedMotion: record!.setup.settings.reducedMotion,
      },
    } as unknown as TermState;
    const rebuilt = buildSessionRecord(stateForRecord, scenario);
    if (canonicalJson(input.sessionRecord) !== canonicalJson(rebuilt)
      || conclusionEvents[0]?.outcome !== rebuilt.outcome) return false;
  }
  if (input.weekPhase === 'boundary' && input.paused !== true) return false;
  return true;
}

function adaptV1State(value: unknown, scenario: ScenarioDefinition): unknown {
  if (!isRecord(value) || value.schemaVersion !== 1) return value;
  const events = Array.isArray(value.eventLog) ? value.eventLog.filter(isRecord) : [];
  const relationships = Array.isArray(value.relationships) ? value.relationships.filter(isRecord) : [];
  const cards = Array.isArray(value.cards) ? value.cards.filter(isRecord) : [];
  const stacks = Array.isArray(value.stacks) ? value.stacks.filter(isRecord) : [];
  const decisionEvidence = events.some((event) => [
    'DECISION_PRESENTED', 'DECISION_RESOLVED', 'PROMISE_CHANGED', 'OBLIGATION_STATUS_CHANGED',
  ].includes(event.type as string))
    || relationships.some((relationship) => relationship.demandOccurrenceId !== undefined
      || Array.isArray(relationship.promiseOccurrenceIds) && relationship.promiseOccurrenceIds.length > 0)
    || isRecord(value.bill) && Array.isArray(value.bill.provisionReceipts)
      && value.bill.provisionReceipts.some((receipt) => isRecord(receipt) && receipt.origin === 'decision');
  const rewardEvidence = decisionEvidence
    || Array.isArray(value.obligations) && value.obligations.length > 0
    || events.some((event) => event.type === 'RESOURCE_CHANGED'
      && typeof event.reason === 'string'
      && (event.reason.startsWith('obligation-fulfilled:') || event.reason.startsWith('promise-fulfilled:')));
  const weekEvidence = value.week !== 1 || value.weekPhase !== 'active'
    || events.some((event) => event.type === 'WEEK_RESOLVED');
  const completedEvidence = value.sessionRecord !== undefined
    || value.runStatus === 'complete'
    || isRecord(value.bill) && (value.bill.stage === 'complete' || value.bill.outcome !== 'active');

  if (value.activeWork === undefined && (
    cards.some((card) => card.status === 'working')
      || stacks.some((stack) => stack.activeActionId !== undefined || stack.paidCost !== undefined)
  )) return value;
  if (value.obligations === undefined
    && (scenario.obligationDefinitions.length > 0 || decisionEvidence)) return value;
  if (value.pendingDecisions === undefined && decisionEvidence) return value;
  if (value.rewardedOccurrenceIds === undefined && rewardEvidence) return value;
  if (value.resolvedWeekIds === undefined && weekEvidence) return value;
  if (value.runStatus === undefined && completedEvidence) return value;
  return {
    ...value,
    schemaVersion: 2,
    activeWork: value.activeWork ?? [],
    obligations: value.obligations ?? [],
    pendingDecisions: value.pendingDecisions ?? [],
    pendingStoryDecisions: value.pendingStoryDecisions ?? [],
    revealedPacks: value.revealedPacks ?? [],
    runVariation: value.runVariation ?? {
      selectedDemandIdsByOffice: Object.fromEntries(Array.from(new Set(scenario.demandDefinitions.map((demand) => demand.officeDefinitionId))).sort()
        .map((officeId) => [officeId, scenario.demandDefinitions.filter((demand) => demand.officeDefinitionId === officeId)
          .sort((a, b) => a.id.localeCompare(b.id))[0]?.id])),
      obligationDueByDefinitionId: Object.fromEntries(scenario.obligationDefinitions.map((definition) => [definition.id, definition.due])),
    },
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
  const state = input.saveSchemaVersion === 1 ? adaptV1State(input.state, scenario) : input.state;
  if (!validState(state, scenario)) {
    return { kind: 'corrupt', message: 'The checkpoint state is malformed or has broken canonical references.' };
  }
  return { kind: 'valid', envelope: createSaveEnvelope(state, scenario) };
}
