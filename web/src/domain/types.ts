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
export type SupportState = 'interested' | 'conditional' | 'committed';
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

export interface CardDefinition {
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
  /**
   * Official public-record party of a real member office. Only Coalition cards carry it,
   * and the engine reads it solely to compute the `same-party` / `opposing-party` tags.
   */
  officeParty?: Party;
}

export interface CardInstance {
  id: string;
  definitionId: string;
  stackId: string;
  x: number;
  y: number;
  remainingMs: number;
  status: 'idle' | 'working' | 'resolved' | 'expired';
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
  };
}

export interface StackState {
  id: string;
  cardIds: string[];
  activeActionId?: string;
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
  stage: ProcedureStage;
  outcome: LegislativeOutcome;
}

export interface RelationshipState {
  memberId: string;
  support: SupportState;
  demandProvisionId?: string;
}

export interface TermState {
  schemaVersion: 1;
  snapshotId: string;
  seed: number;
  rngCursor: number;
  week: number;
  elapsedMs: number;
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
  | 'resolve-outreach-v1'
  | 'strengthen-provision-v1';

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
  effects: Partial<Resources>;
  electionEffect?: number;
  electionEffectExplanation?: string;
}

export interface StoryEventDefinition {
  id: string;
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
  cardDefinitionIds: string[];
}

export interface ScenarioDefinition {
  schemaVersion: 1;
  snapshotId: string;
  frozenAt: string;
  issue: { id: 'housing-affordability'; title: string };
  districts: DistrictDefinition[];
  cards: CardDefinition[];
  startingCardDefinitionIds: [string, string, string];
  tagTaxonomy: string[];
  patterns: RecipePattern[];
  tacticExpansions: TacticExpansionDefinition[];
  storyEvents: StoryEventDefinition[];
  houseModel: HouseModelDefinition;
  weeklyPacks: WeeklyPackDefinition[];
}
