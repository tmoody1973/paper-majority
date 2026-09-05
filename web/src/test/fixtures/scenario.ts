import type {
  CardDefinition,
  RecipePattern,
  ScenarioDefinition,
  TacticExpansionDefinition,
} from '@/domain/types';

/**
 * A small hand-authored scenario used by domain tests.
 *
 * It is deliberately not the shipped housing snapshot. It exists to exercise the
 * engine contract: two interchangeable housing Evidence cards, one Evidence card
 * that must be rejected, a same-party and an opposing-party member office, and one
 * Tactic whose declared expansion widens a coalition slot.
 */

const CITATION = {
  title: 'Example public record',
  url: 'https://www.census.gov/programs-surveys/acs',
  retrievedAt: '2026-08-23',
};

const cards: CardDefinition[] = [
  {
    id: 'staff-policy-aide',
    title: 'Policy Aide',
    kind: 'staff',
    tags: ['policy-focused', 'housing'],
    sourceClass: 'simulated',
    citations: [],
    workload: 1,
    contextualSubtitle: 'Policy staff',
  },
  {
    id: 'staff-district-director',
    title: 'District Director',
    kind: 'staff',
    tags: ['district-focused'],
    sourceClass: 'simulated',
    citations: [],
    workload: 1,
    contextualSubtitle: 'District staff',
  },
  {
    id: 'evidence-rent-burden-report',
    title: 'Rent Burden Report',
    kind: 'evidence',
    tags: ['housing', 'renter-focused', 'committee-credibility'],
    sourceClass: 'official',
    citations: [CITATION],
    workload: 0,
    contextualSubtitle: 'Housing evidence',
  },
  {
    id: 'evidence-tenant-survey',
    title: 'Tenant Survey',
    kind: 'evidence',
    tags: ['housing', 'renter-focused', 'district-relevance'],
    sourceClass: 'derived',
    citations: [CITATION],
    workload: 0,
    contextualSubtitle: 'Housing evidence',
  },
  {
    id: 'evidence-transit-ridership-study',
    title: 'Transit Ridership Study',
    kind: 'evidence',
    // Deliberately carries no `housing` tag so the housing pattern must reject it.
    tags: ['transportation'],
    sourceClass: 'official',
    citations: [CITATION],
    workload: 0,
    contextualSubtitle: 'Transit evidence',
  },
  {
    id: 'policy-housing-choice-voucher',
    title: 'Housing Choice Voucher',
    kind: 'policy',
    tags: ['housing', 'renter-focused'],
    sourceClass: 'official',
    citations: [CITATION],
    workload: 1,
    contextualSubtitle: 'Renter policy',
    plainLanguage: 'Rental assistance policy used by the engine fixture.',
    valueEffects: { 'Tenant Stability': 1, 'Fair Access': 1 },
    committeeJurisdiction: 'Financial Services',
    precedentIds: [],
    editorialReviewDate: '2026-08-23',
  },
  {
    id: 'policy-working-bill',
    title: 'Working Bill',
    kind: 'policy',
    tags: ['working-bill', 'housing'],
    sourceClass: 'simulated',
    citations: [],
    workload: 0,
    contextualSubtitle: 'Your bill',
    plainLanguage: 'Legacy working-bill anchor used by interaction tests.',
    valueEffects: {},
    committeeJurisdiction: 'Legacy interaction fixture',
    precedentIds: [],
    editorialReviewDate: '2026-08-23',
  },
  {
    id: 'coalition-office-fifth-district',
    title: 'Member Office — Fifth District',
    kind: 'coalition',
    tags: ['housing-interest', 'committee-relevant'],
    sourceClass: 'official',
    citations: [CITATION],
    workload: 1,
    officialRecord: {
      provenance: 'official',
      officeTitle: 'Member Office — Fifth District',
      memberName: 'Fixture Member Five',
      party: 'democratic',
      stateCode: 'GA',
      district: '05',
      congress: 119,
      profileUrl: 'https://example.invalid/fifth-district',
    },
    contextualSubtitle: 'Member office',
  },
  {
    id: 'coalition-office-fourth-district',
    title: 'Member Office — Fourth District',
    kind: 'coalition',
    tags: ['housing-interest', 'rural-housing'],
    sourceClass: 'official',
    citations: [CITATION],
    workload: 1,
    officialRecord: {
      provenance: 'official',
      officeTitle: 'Member Office — Fourth District',
      memberName: 'Fixture Member Four',
      party: 'republican',
      stateCode: 'IA',
      district: '04',
      congress: 119,
      profileUrl: 'https://example.invalid/fourth-district',
    },
    contextualSubtitle: 'Member office',
  },
  {
    id: 'tactic-bipartisan-working-group',
    title: 'Bipartisan Working Group',
    kind: 'tactic',
    tags: ['coalition-expansion'],
    sourceClass: 'simulated',
    citations: [],
    workload: 1,
    contextualSubtitle: 'Reusable method',
  },
  {
    id: 'constituency-urgent-renter-concern',
    title: 'Urgent Renter Concern',
    kind: 'constituency',
    tags: ['district-concern', 'renter-focused'],
    sourceClass: 'simulated',
    citations: [],
    workload: 1,
    contextualSubtitle: 'District concern',
  },
  // Pattern outputs.
  {
    id: 'evidence-housing-summary',
    title: 'Evidence Summary',
    kind: 'evidence',
    tags: ['housing', 'evidence-summary'],
    sourceClass: 'derived',
    citations: [CITATION],
    workload: 0,
    contextualSubtitle: 'Housing evidence',
  },
  {
    id: 'policy-drafted-provision',
    title: 'Drafted Provision',
    kind: 'policy',
    tags: ['housing', 'renter-focused', 'drafted'],
    sourceClass: 'simulated',
    citations: [],
    workload: 0,
    contextualSubtitle: 'Bill provision',
    plainLanguage: 'Simulated drafted language used by the engine fixture.',
    valueEffects: {},
    committeeJurisdiction: 'Legacy interaction fixture',
    precedentIds: ['policy-housing-choice-voucher'],
    editorialReviewDate: '2026-08-23',
  },
  {
    id: 'coalition-outreach-result',
    title: 'Outreach Result',
    kind: 'coalition',
    tags: ['housing-interest', 'outreach-result'],
    sourceClass: 'simulated',
    citations: [],
    workload: 0,
    contextualSubtitle: 'Member response',
    officialRecord: {
      provenance: 'simulated-fixture',
      officeTitle: 'Outreach Result',
      memberName: 'Simulated response',
      party: 'democratic',
      stateCode: 'XX',
      district: '00',
      congress: 119,
      profileUrl: 'https://example.invalid/outreach-result',
    },
  },
  {
    id: 'evidence-staff-review-note',
    title: 'Staff Review Note',
    kind: 'evidence',
    tags: ['review-note'],
    sourceClass: 'simulated',
    citations: [],
    workload: 0,
    contextualSubtitle: 'Office note',
  },
];

const patterns: RecipePattern[] = [
  {
    // Deliberately declared BEFORE the more specific pattern so ranking, not
    // declaration order, has to decide the winner.
    id: 'pattern-staff-review-note',
    slots: [
      { kind: 'staff', quantity: 1, consumed: false },
      { kind: 'evidence', quantity: 1 },
    ],
    output: { mode: 'fixed', definitionId: 'evidence-staff-review-note' },
    durationMs: 4_000,
    resourceCost: { staffAttention: 1 },
    priority: 0,
    discoveryHint: 'Staff can look over almost any evidence.',
  },
  {
    id: 'pattern-evidence-summary',
    slots: [
      // Staff are assigned, never used up: the card comes back when the work ends.
      { kind: 'staff', requiredTags: ['policy-focused'], quantity: 1, consumed: false },
      { kind: 'evidence', requiredTags: ['housing'], quantity: 1 },
    ],
    output: {
      mode: 'derived',
      resolverId: 'summarize-evidence-v1',
      parameters: { outputDefinitionId: 'evidence-housing-summary' },
    },
    durationMs: 6_000,
    resourceCost: { staffAttention: 1 },
    priority: 10,
    discoveryHint: 'Housing Evidence works with a policy-focused Staff card.',
  },
  {
    id: 'pattern-drafted-provision',
    slots: [
      { kind: 'evidence', requiredTags: ['evidence-summary'], quantity: 1 },
      { kind: 'policy', requiredTags: ['housing', 'renter-focused'], quantity: 1 },
    ],
    output: {
      mode: 'derived',
      resolverId: 'draft-provision-v1',
      parameters: { outputDefinitionId: 'policy-drafted-provision' },
    },
    durationMs: 6_000,
    resourceCost: { staffAttention: 1 },
    priority: 10,
    discoveryHint: 'A summary can be turned into bill language with a renter-focused policy.',
  },
  {
    id: 'pattern-coalition-outreach',
    slots: [
      { kind: 'policy', requiredTags: ['working-bill'], quantity: 1, consumed: false },
      // An office is an institution, like the bill: one conversation must not
      // destroy it, and Task 9's relationship states need it to persist.
      { kind: 'coalition', anyTags: ['same-party'], quantity: 1, consumed: false },
    ],
    output: {
      mode: 'derived',
      resolverId: 'resolve-outreach-v1',
      parameters: { outputDefinitionId: 'coalition-outreach-result' },
    },
    durationMs: 6_000,
    resourceCost: { politicalCapital: 1 },
    priority: 10,
    discoveryHint: 'Your bill can be taken to a member office that shares your party.',
  },
];

const tacticExpansions: TacticExpansionDefinition[] = [
  {
    id: 'expansion-bipartisan-outreach',
    tacticDefinitionId: 'tactic-bipartisan-working-group',
    targetPatternId: 'pattern-coalition-outreach',
    effect: { kind: 'widen-slot', slotIndex: 1, addAnyTags: ['opposing-party'] },
    expansionNote:
      'Opposing-party member offices may now use this outreach rule. The base rule is unchanged.',
    studyCost: 1,
    studyDurationMs: 8_000,
    eligibleStaffTags: ['policy-focused'],
  },
];

export const testScenario: ScenarioDefinition = {
  schemaVersion: 2,
  snapshotId: 'test-fixture-2026-08-23',
  frozenAt: '2026-08-23T00:00:00.000Z',
  supportedModes: ['interaction-spike'],
  issue: { id: 'housing-affordability', title: 'Housing Affordability' },
  districts: [
    {
      id: 'GA-05',
      title: "Georgia's Fifth District",
      role: 'Urban district with substantial renter population',
      sourceYear: 2024,
      uncertaintyNote: 'Five-year estimates carry sampling error.',
      citations: [CITATION],
    },
    {
      id: 'IA-04',
      title: "Iowa's Fourth District",
      role: 'Rural agricultural district',
      sourceYear: 2024,
      uncertaintyNote: 'Five-year estimates carry sampling error.',
      citations: [CITATION],
    },
  ],
  cards,
  startingCardDefinitionIds: [
    'staff-policy-aide',
    'evidence-rent-burden-report',
    'policy-housing-choice-voucher',
  ],
  tagTaxonomy: [
    'policy-focused',
    'district-focused',
    'housing',
    'renter-focused',
    'committee-credibility',
    'district-relevance',
    'transportation',
    'working-bill',
    'housing-interest',
    'committee-relevant',
    'rural-housing',
    'coalition-expansion',
    'evidence-summary',
    'drafted',
    'outreach-result',
    'review-note',
    'district-concern',
  ],
  patterns,
  tacticExpansions,
  storyEvents: [],
  houseModel: {
    totalSeats: 435,
    curatedMemberSeats: 2,
    anonymousSeats: 433,
    sourceClass: 'simulated',
    baseline: { committed: 90, conditional: 60, undecided: 120, opposed: 165 },
  },
  weeklyPacks: [],
  obligationDefinitions: [],
  demandDefinitions: [],
  decisionChoices: [],
  modeObjectives: [],
  staffTraits: [],
};

export function findCardDefinition(id: string): CardDefinition {
  const definition = testScenario.cards.find((card) => card.id === id);
  if (!definition) throw new Error(`Test fixture has no card definition "${id}"`);
  return definition;
}
