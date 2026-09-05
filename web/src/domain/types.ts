import type { GameEvent } from '@/domain/events';

export type CardKind =
  | 'staff'
  | 'policy'
  | 'evidence'
  | 'coalition'
  | 'constituency'
  | 'institution'
  | 'political'
  | 'tactic';
export type SourceClass = 'official' | 'derived' | 'simulated';
export type RunMode = 'interaction-spike' | 'session' | 'term';
export type InstanceForm = 'raw' | 'summary' | 'drafted' | 'prepared';
export type CardLocation = 'desk' | 'filed' | 'archived';
export type Party = 'democratic' | 'republican';
export type GoverningValue =
  | 'Fiscal Stewardship'
  | 'Local Control'
  | 'Market Competition'
  | 'Public Investment'
  | 'Tenant Stability'
  | 'Housing Supply'
  | 'Environmental Resilience'
  | 'Fair Access';
export type ProcedureStage =
  | 'draft'
  | 'committee'
  | 'house'
  | 'senate'
  | 'resolution'
  | 'election'
  | 'complete';
export type SupportState = 'unavailable' | 'interested' | 'conditional' | 'committed' | 'refused';
export type LegislativeOutcome =
  | 'active'
  | 'enacted'
  | 'failed-committee'
  | 'failed-house'
  | 'failed-senate'
  | 'absorbed-into-package';
export type OpponentStrength = 'weak' | 'moderate' | 'strong';

/**
 * Relational tags are computed by a pure selector from the player's party and an
 * office's official party field. They are never authored on published content.
 */
export const COMPUTED_TAGS = ['same-party', 'opposing-party'] as const;
export type ComputedTag = (typeof COMPUTED_TAGS)[number];

export interface ElectionEnvironment {
  opponentStrength: OpponentStrength;
  revealedWeek: 1;
}

export interface ElectionEffectEntry {
  id: string;
  week: number;
  label: string;
  contribution: number;
  explanation: string;
  sourceClass: 'simulated';
}

export interface ElectionLineItem {
  id: string;
  label: string;
  contribution: number;
  runningTotal: number;
  explanation: string;
  sourceClass: 'simulated';
}

export interface ElectionForecast {
  low: number;
  high: number;
  status: 'favored' | 'toss-up' | 'trailing';
  breakdown: ElectionLineItem[];
  label: 'Simulated outlook — not polling';
}

export interface ReelectionResult {
  simulatedVoteShare: number;
  outcome: 'won' | 'lost';
  breakdown: ElectionLineItem[];
}

export interface RunSettings {
  pace: 'relaxed' | 'standard' | 'brisk';
  guidance: 'guided' | 'standard' | 'expert';
  termStyle: 'regular-order' | 'district-pulse' | 'breaking-cycle';
  voteInformation: 'broad' | 'detailed';
  policyComplexity: 'essential' | 'advanced';
  locale: 'en' | 'es';
  reducedMotion: boolean;
}

export interface Citation {
  title: string;
  url: string;
  retrievedAt: string;
  publishedAt?: string;
}

export interface CardDefinitionBase {
  id: string;
  title: string;
  kind: CardKind;
  tags: string[];
  sourceClass: SourceClass;
  citations: Citation[];
  workload: number;
  /** Short player-language subtitle that surfaces a match-relevant tag on the card face. */
  contextualSubtitle?: string;
  /**
   * One plain sentence saying what this card is, for the inspector.
   *
   * It describes the thing, never the rules — what a card combines with is discovery
   * state and belongs to the Staff Handbook.
   */
  plainLanguage?: string;
}

export interface StaffCardDefinition extends CardDefinitionBase {
  kind: 'staff';
}

export interface PolicyCardDefinition extends CardDefinitionBase {
  kind: 'policy';
  plainLanguage: string;
  valueEffects: Partial<Record<GoverningValue, -1 | 0 | 1>>;
  committeeJurisdiction: string;
  precedentIds: string[];
  editorialReviewDate: string;
}

export interface EvidenceCardDefinition extends CardDefinitionBase {
  kind: 'evidence';
  /** Authored research roles; these describe legitimate uses, never a quality score. */
  roleTags?: string[];
  validForms?: Array<'raw' | 'summary' | 'prepared'>;
  transformations?: Array<'summarize' | 'office-response' | 'district-packet' | 'committee-packet'>;
  /** Stable source-map IDs retained through every derived form. */
  underlyingSourceIds?: string[];
  /** Player-facing destinations where this finite evidence copy may be spent. */
  sinks?: Array<'drafting' | 'office-concern' | 'district-preparation' | 'committee-preparation'>;
}

interface CoalitionRecordBase {
  officeTitle: string;
  memberName: string;
  stateCode: string;
  district: string;
  congress: number;
  profileUrl: string;
}

export type CoalitionOfficialRecord =
  | (CoalitionRecordBase & { provenance: 'official'; party: Party })
  | (CoalitionRecordBase & { provenance: 'simulated-fixture'; party?: Party });

export interface CoalitionCardDefinition extends CardDefinitionBase {
  kind: 'coalition';
  /** Immutable public facts only. Simulated support and demands live in run state/content. */
  officialRecord: CoalitionOfficialRecord;
  /** Authored game behavior kept structurally separate from the cited public record. */
  simulation?: {
    interestTags: string[];
  };
}

export interface AuthoredConcernReference {
  /** The authored demand/concern this card represents. */
  concernId: string;
  /** The specific office whose authored concern is being answered. */
  recipientOfficeDefinitionId: string;
}

export interface ConstituencyCardDefinition extends CardDefinitionBase {
  kind: 'constituency';
  authoredConcern?: AuthoredConcernReference;
}

export interface OtherCardDefinition extends CardDefinitionBase {
  kind: Exclude<CardKind, 'staff' | 'policy' | 'evidence' | 'coalition' | 'constituency'>;
}

export type CardDefinition =
  | StaffCardDefinition
  | PolicyCardDefinition
  | EvidenceCardDefinition
  | CoalitionCardDefinition
  | ConstituencyCardDefinition
  | OtherCardDefinition;

export interface CardInstance {
  id: string;
  definitionId: string;
  stackId: string;
  x: number;
  y: number;
  remainingMs: number;
  status: 'idle' | 'working' | 'resolved' | 'expired';
  form: InstanceForm;
  location: CardLocation;
  /** Definition IDs of the evidence records retained through derived forms. */
  sourceDefinitionIds: string[];
  /** The underlying authored policy retained through drafted/prepared forms. */
  policyDefinitionId?: string;
  /** One setup-assigned trait. Absent means this staffer is a generalist. */
  staffTraitId?: string;
  /**
   * Where a card produced in play came from: the resolver's explanation and the
   * definition IDs of every input, with the consumed ones singled out. Authored
   * starting cards have no origin. This is what lets two Evidence Summaries from
   * different sources look different, and what replaces the "practice card"
   * label on cards the player manufactured themselves.
   */
  origin?: {
    explanationKey: string;
    inputDefinitionIds: string[];
    consumedDefinitionIds: string[];
    authoredConcern?: AuthoredConcernReference;
  };
}

export interface StackState {
  id: string;
  cardIds: string[];
  activeActionId?: string;
  /** The actual positive resource amounts paid when the current action began. */
  paidCost?: Partial<Resources>;
}

export interface Resources {
  staffAttention: number;
  politicalCapital: number;
  districtTrust: number;
  billMomentum: number;
  policyIntegrity: number;
  staffMorale: number;
}

export interface BillState {
  issueId: 'housing-affordability';
  title: string;
  provisionIds: string[];
  /** Durable provenance retained after the drafted card is consumed by the Docket. */
  provisionReceipts: BillProvisionReceipt[];
  stage: ProcedureStage;
  outcome: LegislativeOutcome;
  revision: number;
}

interface BillProvisionReceiptBase {
  provisionId: string;
  sourceDefinitionIds: string[];
  docketedAtRevision: number;
  plainLanguage: string;
  form: 'drafted';
  sourceClass: 'simulated';
}

/** Negotiated language keeps its real decision provenance instead of inventing a draft card. */
export type BillProvisionReceipt = BillProvisionReceiptBase & (
  | { origin: 'draft'; draftedCardId: string }
  | {
      origin: 'decision';
      decisionId: string;
      sourceId: string;
      occurrenceId: string;
    }
);

export type RelationshipCondition =
  | { kind: 'bill-has-tag'; tag: string }
  | { kind: 'prepared-evidence-tag'; tag: string }
  | { kind: 'governing-value'; value: GoverningValue };

export interface RelationshipState {
  memberId: string;
  support: SupportState;
  demandProvisionId?: string;
  demandOccurrenceId?: string;
  promiseOccurrenceIds: string[];
  conditions: RelationshipCondition[];
  evaluatedRevision: number;
}

export interface DueTime {
  week: number;
  offsetMs: number;
}

export interface WorkReservation {
  id: string;
  cardIds: string[];
  staffCardIds: string[];
  paidCost: Partial<Resources>;
  completesAtSimulationMs: number;
  billRevision?: number;
  effectiveRuleVersion: string;
  consumedCardIds: string[];
  returnedCardIds: string[];
  /** Present only when a resolved counteroffer reserved this canonical work item. */
  decisionOrigin?: {
    decisionId: string;
    choiceId: string;
    occurrenceId: string;
    officeDefinitionId: string;
  };
}

export type ActiveWork = WorkReservation &
  (
    | {
        kind: 'pattern';
        patternId: string;
        effectivePattern: RecipePattern;
        /** Expansion ids captured when this immutable effective rule was reserved. */
        effectiveExpansionIds?: string[];
      }
    | {
        kind: 'study';
        expansionIds: string[];
        effectiveExpansions: TacticExpansionDefinition[];
      }
  );

export interface Obligation {
  id: string;
  sourceId: string;
  /** Exact card occurrence that activated a pack-sourced obligation. */
  sourceCardInstanceId?: string;
  due: DueTime;
  mandatory: boolean;
  status: 'open' | 'fulfilled' | 'missed' | 'declined';
  rewardCapital: number;
  trustPenalty: number;
}

export interface PendingDecision {
  id: string;
  sourceId: string;
  occurrenceId: string;
  officeDefinitionId: string;
  /** Revision actually examined by outreach, retained if completion revalidated later. */
  approachedBillRevision: number;
  expectedBillRevision: number;
  choiceIds: string[];
  status: 'pending' | 'resolved';
}

export interface PendingStoryDecision {
  id: string;
  storyEventId: string;
  occurrenceId: string;
  choiceIds: string[];
  status: 'pending' | 'resolved';
}

export interface RevealedPack {
  packOccurrenceId: string;
  week: number;
  categoryId: string;
  cardDefinitionIds: string[];
}

export interface RunVariation {
  /** One authored demand selected for each office that has a demand pool. */
  selectedDemandIdsByOffice: Record<string, string>;
  /** One authored deadline selected for each obligation definition. */
  obligationDueByDefinitionId: Record<string, DueTime>;
}

export interface SessionRecord {
  readonly id: string;
  readonly outcome: 'ready' | 'not-ready';
  readonly completedAtSimulationMs: number;
  readonly setup: Readonly<{
    snapshotId: string;
    seed: number;
    districtId: string;
    party: Party;
    values: readonly [GoverningValue, GoverningValue];
    settings: Readonly<RunSettings>;
  }>;
  readonly objective: Readonly<{
    provisionCount: number;
    committedOfficeCount: number;
    requiredProvisionCount: 2;
    requiredCommittedOfficeCount: 2;
  }>;
  readonly gaps: Readonly<{
    provisionGap: number;
    supportGap: number;
    overdueMandatoryIds: readonly string[];
  }>;
  readonly bill: Readonly<{
    revision: number;
    provisionIds: readonly string[];
    provisionReceipts: readonly BillProvisionReceipt[];
  }>;
  readonly integrity: Readonly<{
    finalScore: number;
    contributions: readonly Readonly<{
      id: string;
      reason: string;
      appliedDelta: number;
    }>[];
    explanation: string;
  }>;
  readonly promises: readonly Readonly<{
    occurrenceId: string;
    officeDefinitionId: string;
    status: 'open' | 'fulfilled' | 'broken';
    conditions: readonly RelationshipCondition[];
  }>[];
  readonly obligations: readonly Readonly<Obligation>[];
  readonly declinedOpportunities: readonly Readonly<{
    occurrenceId: string;
    sourceId: string;
  }>[];
  readonly causeEventIds: readonly string[];
}

export interface TermState {
  /** `createRun` emits 2; 1 remains only for the explicit spike compatibility entry point. */
  schemaVersion: 1 | 2;
  mode: RunMode;
  snapshotId: string;
  seed: number;
  rngCursor: number;
  week: number;
  /** Monotonic run time; unlike elapsedMs it never resets at a week boundary. */
  simulationMs: number;
  elapsedMs: number;
  weekPhase: 'active' | 'boundary';
  weekLengthMs: number;
  paused: boolean;
  settings: RunSettings;
  player: {
    districtId: string;
    party: Party;
    values: [GoverningValue, GoverningValue];
    election: ElectionEnvironment;
  };
  cards: CardInstance[];
  /** Monotonic counter behind produced card instance ids. Never decreases. */
  cardSeq: number;
  stacks: StackState[];
  resources: Resources;
  bill: BillState;
  relationships: RelationshipState[];
  staffCapacity: number;
  activeWork: ActiveWork[];
  obligations: Obligation[];
  pendingDecisions: PendingDecision[];
  pendingStoryDecisions: PendingStoryDecision[];
  revealedPacks: RevealedPack[];
  runVariation: RunVariation;
  rewardedOccurrenceIds: string[];
  resolvedWeekIds: string[];
  runStatus: 'active' | 'complete';
  sessionRecord?: SessionRecord;
  discoveredPatternIds: string[];
  unlockedSlotExpansions: Record<string, string[]>;
  electionEffects: ElectionEffectEntry[];
  storyHistory: string[];
  objectives: string[];
  eventLog: GameEvent[];
}

export interface RecipeSlot {
  kind?: CardKind;
  requiredTags?: string[];
  anyTags?: string[];
  sourceClasses?: SourceClass[];
  forms?: InstanceForm[];
  /** Restrict a derived artifact to one or more real producer receipts. */
  originExplanationKeys?: string[];
  quantity: 1 | 2 | 3;
  /**
   * Whether this slot's cards are used up. Defaults to true.
   *
   * A catalyst slot (`false`) takes part in the rule and comes back to the desk when
   * the work finishes. The Working Bill is the obvious one: approaching a member
   * office must not destroy your bill.
   */
  consumed?: boolean;
}

export type DerivedResolverId =
  | 'summarize-evidence-v1'
  | 'draft-provision-v1'
  | 'answer-office-concern-v1'
  | 'prepare-evidence-packet-v1'
  | 'resolve-outreach-v1'
  | 'strengthen-provision-v1'
  | 'prepare-district-response-v1'
  | 'prepare-committee-packet-v1'
  | 'prepare-district-endorsement-v1'
  | 'prepare-political-asset-v1'
  | 'review-provision-v1';

export type RecipeOutput =
  | { mode: 'fixed'; definitionId: string }
  | {
      mode: 'derived';
      resolverId: DerivedResolverId;
      parameters?: Record<string, string | number | boolean>;
    };

export interface RecipePattern {
  id: string;
  slots: RecipeSlot[];
  /** Procedure stages where this rule may run. Omitted means every stage. */
  eligibleStages?: ProcedureStage[];
  output: RecipeOutput;
  durationMs: number;
  resourceCost: Partial<Resources>;
  priority: number;
  discoveryHint: string;
}

export type TacticExpansionEffect =
  | { kind: 'widen-slot'; slotIndex: number; addAnyTags?: string[]; addSourceClasses?: SourceClass[] }
  | { kind: 'resource-cost'; resource: keyof Resources; delta: number }
  | { kind: 'duration-multiplier'; multiplier: number }
  | { kind: 'output-strength'; delta: number }
  | { kind: 'procedure-eligibility'; stage: ProcedureStage };

/** Effects accepted by version-2 Session content. Output strength has no Session resolver yet. */
export type SessionTacticExpansionEffect = Exclude<TacticExpansionEffect, { kind: 'output-strength' }>;

export interface TacticExpansionDefinition {
  id: string;
  tacticDefinitionId: string;
  targetPatternId: string;
  effect: TacticExpansionEffect;
  /** Player-facing sentence describing exactly what the activated rule now allows. */
  expansionNote: string;
  /** Staff Attention spent by the Study Tactic assignment. */
  studyCost: number;
  /** How long the Study Tactic assignment takes. */
  studyDurationMs: number;
  /** Tags a Staff card must carry to be eligible to study this Tactic. */
  eligibleStaffTags: string[];
}

export interface PlayerProfile {
  schemaVersion: 1;
  lifetimeDiscoveredPatternIds: string[];
}

export type StoryCondition =
  | { kind: 'metric'; metric: keyof Resources; op: 'lt' | 'lte' | 'gte' | 'gt'; value: number }
  | { kind: 'week'; min: number; max: number }
  | { kind: 'stage'; anyOf: ProcedureStage[] }
  | { kind: 'hasProvision'; provisionId: string }
  | { kind: 'relationshipCount'; support: SupportState; op: 'gte' | 'lt'; value: number };

export interface StoryChoiceDefinition {
  id: string;
  label: string;
  cost: Partial<Resources>;
  effects: Partial<Resources>;
  electionEffect?: number;
  electionEffectExplanation?: string;
}

export interface StoryEventDefinition {
  id: string;
  title: string;
  body: string;
  class: 'opportunity' | 'pressure' | 'consequence' | 'recovery';
  pressureCategory?: 'district' | 'staff' | 'media' | 'coalition' | 'procedure';
  minWeek: number;
  maxWeek: number;
  cooldownWeeks: number;
  weight: number;
  conditions: StoryCondition[];
  choices: StoryChoiceDefinition[];
  whyRules: string[];
}

export interface DistrictDefinition {
  id: string;
  title: string;
  role: string;
  sourceYear: number;
  uncertaintyNote: string;
  citations: Citation[];
}

export interface HouseModelDefinition {
  totalSeats: 435;
  curatedMemberSeats: number;
  anonymousSeats: number;
  sourceClass: 'simulated';
  baseline: { committed: number; conditional: number; undecided: number; opposed: number };
}

export interface WeeklyPackDefinition {
  week: number;
  guaranteedDefinitionIds: string[];
  pools: PackPoolDefinition[];
}

export interface WeightedPackOption {
  definitionId: string;
  weight: number;
}

export interface PackPoolDefinition {
  id: string;
  title: string;
  drawCount: 1 | 2 | 3;
  options: WeightedPackOption[];
  fallbackDefinitionIds: string[];
}

export type ObligationFulfillmentDefinition =
  | { kind: 'docketed-policy-tag'; tag: string }
  | { kind: 'prepared-evidence-tag'; tag: string }
  | {
      kind: 'completed-pattern';
      patternId: string;
      sourceDefinitionId?: string;
      concernId?: string;
      requireSourceCardOccurrence?: boolean;
    };

export interface ObligationDefinition {
  id: string;
  title: string;
  sourceDefinitionId: string;
  due: DueTime;
  dueOptions?: DueTime[];
  mandatory: boolean;
  rewardCapital: number;
  trustPenalty: number;
  fulfillment: ObligationFulfillmentDefinition;
}

export type DemandConditionDefinition =
  | { kind: 'bill-has-tag'; tag: string }
  | { kind: 'prepared-evidence-tag'; tag: string }
  | { kind: 'governing-value'; value: GoverningValue };

export interface DemandDefinition {
  id: string;
  title: string;
  officeDefinitionId: string;
  /** Same-office authored concern that can substantiate this demand's counteroffer. */
  evidenceConcernId?: string;
  condition: DemandConditionDefinition;
  choiceIds: string[];
}

export type DecisionChoiceEffect =
  | { kind: 'resource'; resource: keyof Resources; delta: number }
  | { kind: 'create-obligation'; obligationDefinitionId: string }
  | { kind: 'relationship-support'; support: SupportState }
  | { kind: 'promise-condition'; condition: DemandConditionDefinition }
  | { kind: 'bill-add-provision'; provisionId: string }
  | { kind: 'bill-remove-provision'; provisionId: string };

export interface DecisionChoiceDefinition {
  id: string;
  label: string;
  action: 'accept' | 'reject' | 'counter';
  requirements: DemandConditionDefinition[];
  effects: DecisionChoiceEffect[];
  /** A counteroffer reserves the exact currently eligible inputs for this authored pattern. */
  requiredWorkPatternId?: string;
}

export interface ModeObjectiveDefinition {
  id: string;
  mode: 'session' | 'term';
  kind: 'readiness';
  minProvisionCount: number;
  minCommittedOfficeCount: number;
  requireNoOverdueMandatory: boolean;
}

export interface StaffTraitDefinition {
  id: string;
  title: string;
  eligibleStaffDefinitionIds: string[];
  effect: {
    kind: 'duration-multiplier';
    taskTag: string;
    multiplier: number;
  };
}

export interface ScenarioDefinition {
  schemaVersion: 2;
  snapshotId: string;
  frozenAt: string;
  contentStatus?: {
    status: 'candidate' | 'reviewed';
    humanReviewPending: boolean;
    notice: string;
  };
  supportedModes: RunMode[];
  issue: { id: 'housing-affordability'; title: string };
  districts: DistrictDefinition[];
  cards: CardDefinition[];
  /** Runtime schema guarantees at least one entry. */
  startingCardDefinitionIds: string[];
  tagTaxonomy: string[];
  patterns: RecipePattern[];
  tacticExpansions: TacticExpansionDefinition[];
  storyEvents: StoryEventDefinition[];
  houseModel: HouseModelDefinition;
  weeklyPacks: WeeklyPackDefinition[];
  obligationDefinitions: ObligationDefinition[];
  demandDefinitions: DemandDefinition[];
  decisionChoices: DecisionChoiceDefinition[];
  modeObjectives: ModeObjectiveDefinition[];
  staffTraits: StaffTraitDefinition[];
}
