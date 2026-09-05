import type { InitialStateInput } from '@/domain/initialState';
import type { CardDefinition, ScenarioDefinition } from '@/domain/types';

const SOURCE = {
  title: 'Housing source fixture',
  url: 'https://www.census.gov/programs-surveys/acs',
  retrievedAt: '2026-09-04',
};

const POLICY_SOURCE = {
  title: 'Housing policy source fixture',
  url: 'https://www.hud.gov/housing-choice-vouchers',
  retrievedAt: '2026-09-04',
};

const base = (id: string, title: string, kind: CardDefinition['kind'], tags: string[]) => ({
  id,
  title,
  kind,
  tags,
  sourceClass: 'simulated' as const,
  citations: [],
  workload: kind === 'staff' ? 1 : 0,
});

export const sessionScenario: ScenarioDefinition = {
  schemaVersion: 2,
  snapshotId: 'session-unit-2026-09-04',
  frozenAt: '2026-09-04T00:00:00.000Z',
  supportedModes: ['session'],
  issue: { id: 'housing-affordability', title: 'Housing Affordability' },
  districts: [
    {
      id: 'GA-05',
      title: "Georgia's Fifth District",
      role: 'Unit-test district',
      sourceYear: 2024,
      uncertaintyNote: 'Fixture data only.',
      citations: [SOURCE],
    },
  ],
  cards: [
    { ...base('staff-policy-aide', 'Policy Aide', 'staff', ['policy-focused']) },
    { ...base('staff-legislative-counsel', 'Legislative Counsel', 'staff', ['drafting']) },
    { ...base('staff-district-director', 'District Director', 'staff', ['district-focused']) },
    {
      ...base('evidence-rent-burden-report', 'Rent Burden Report', 'evidence', [
        'housing',
        'renter-focused',
        'committee-relevant',
        'district-relevant',
      ]),
      sourceClass: 'official',
      citations: [SOURCE],
    },
    {
      ...base('policy-housing-choice-voucher', 'Housing Choice Voucher', 'policy', [
        'housing',
        'renter-focused',
      ]),
      sourceClass: 'official',
      citations: [POLICY_SOURCE],
      plainLanguage: 'Rental assistance policy used by the unit fixture.',
      valueEffects: { 'Tenant Stability': 1, 'Fair Access': 1 },
      committeeJurisdiction: 'Financial Services',
      precedentIds: ['precedent-housing-choice-voucher'],
      editorialReviewDate: '2026-09-04',
    },
    {
      ...base('policy-zoning-incentive', 'Zoning Incentive', 'policy', ['housing', 'supply']),
      sourceClass: 'official',
      citations: [SOURCE],
      plainLanguage: 'A housing supply policy used as drafting precedent.',
      valueEffects: { 'Housing Supply': 1, 'Local Control': -1 },
      committeeJurisdiction: 'Financial Services',
      precedentIds: [],
      editorialReviewDate: '2026-09-04',
    },
    {
      ...base('coalition-office-hillcrest', 'Hillcrest Member Office', 'coalition', [
        'housing-interest',
        'committee-relevant',
      ]),
      officialRecord: {
        provenance: 'simulated-fixture',
        officeTitle: 'Hillcrest Member Office',
        memberName: 'Avery Hill',
        party: 'democratic',
        stateCode: 'XX',
        district: '01',
        congress: 119,
        profileUrl: 'https://example.invalid/hillcrest',
      },
    },
    {
      ...base('coalition-office-ridgeline', 'Ridgeline Member Office', 'coalition', [
        'housing-interest',
        'rural-housing',
      ]),
      officialRecord: {
        provenance: 'simulated-fixture',
        officeTitle: 'Ridgeline Member Office',
        memberName: 'Riley Ridge',
        party: 'republican',
        stateCode: 'XX',
        district: '02',
        congress: 119,
        profileUrl: 'https://example.invalid/ridgeline',
      },
    },
    {
      ...base('constituency-renter-concern', 'Renter Concern', 'constituency', [
        'district-concern',
      ]),
    },
    {
      ...base('tactic-bipartisan-working-group', 'Bipartisan Working Group', 'tactic', [
        'coalition-expansion',
      ]),
    },
  ] as CardDefinition[],
  startingCardDefinitionIds: [
    'staff-policy-aide',
    'staff-legislative-counsel',
    'staff-district-director',
    'evidence-rent-burden-report',
    'policy-housing-choice-voucher',
  ],
  tagTaxonomy: [
    'policy-focused',
    'drafting',
    'district-focused',
    'housing',
    'renter-focused',
    'committee-relevant',
    'district-relevant',
    'supply',
    'housing-interest',
    'rural-housing',
    'district-concern',
    'coalition-expansion',
    'evidence-summary',
    'drafted',
    'prepared',
  ],
  patterns: [
    {
      id: 'pattern-summarize-evidence',
      slots: [
        { kind: 'staff', requiredTags: ['policy-focused'], quantity: 1, consumed: false },
        { kind: 'evidence', requiredTags: ['housing'], forms: ['raw'], quantity: 1 },
      ],
      output: { mode: 'derived', resolverId: 'summarize-evidence-v1' },
      durationMs: 20_000,
      resourceCost: { staffAttention: 1 },
      priority: 10,
      discoveryHint: 'Policy staff can summarize raw housing evidence.',
    },
    {
      id: 'pattern-draft-policy',
      slots: [
        { kind: 'staff', requiredTags: ['drafting'], quantity: 1, consumed: false },
        { kind: 'evidence', forms: ['summary'], quantity: 1 },
        { kind: 'policy', forms: ['raw'], quantity: 1 },
      ],
      output: { mode: 'derived', resolverId: 'draft-provision-v1' },
      durationMs: 40_000,
      resourceCost: { staffAttention: 1 },
      priority: 10,
      discoveryHint: 'Counsel turns a policy and a summary into proposed language.',
    },
  ],
  tacticExpansions: [
    {
      id: 'expansion-bipartisan-outreach',
      tacticDefinitionId: 'tactic-bipartisan-working-group',
      targetPatternId: 'pattern-draft-policy',
      effect: { kind: 'duration-multiplier', multiplier: 0.8 },
      expansionNote: 'Drafting takes less time after coordination.',
      studyCost: 1,
      studyDurationMs: 20_000,
      eligibleStaffTags: ['policy-focused'],
    },
  ],
  storyEvents: [],
  houseModel: {
    totalSeats: 435,
    curatedMemberSeats: 2,
    anonymousSeats: 433,
    sourceClass: 'simulated',
    baseline: { committed: 90, conditional: 60, undecided: 120, opposed: 165 },
  },
  weeklyPacks: [
    {
      week: 2,
      guaranteedDefinitionIds: ['constituency-renter-concern'],
      pools: [],
    },
  ],
  obligationDefinitions: [
    {
      id: 'obligation-answer-renters',
      title: 'Answer renter concern',
      sourceDefinitionId: 'constituency-renter-concern',
      due: { week: 2, offsetMs: 60_000 },
      mandatory: true,
      rewardCapital: 1,
      trustPenalty: 5,
      fulfillment: { kind: 'prepared-evidence-tag', tag: 'district-relevant' },
    },
  ],
  demandDefinitions: [
    {
      id: 'demand-renter-protection',
      title: 'Include renter protection',
      officeDefinitionId: 'coalition-office-hillcrest',
      condition: { kind: 'bill-has-tag', tag: 'renter-focused' },
      choiceIds: ['choice-accept-demand', 'choice-refuse-demand'],
    },
  ],
  decisionChoices: [
    {
      id: 'choice-accept-demand',
      label: 'Accept',
      action: 'accept',
      requirements: [],
      effects: [{ kind: 'relationship-support', support: 'conditional' }],
    },
    {
      id: 'choice-refuse-demand',
      label: 'Refuse',
      action: 'reject',
      requirements: [],
      effects: [{ kind: 'relationship-support', support: 'refused' }],
    },
  ],
  modeObjectives: [
    {
      id: 'objective-session-readiness',
      mode: 'session',
      kind: 'readiness',
      minProvisionCount: 2,
      minCommittedOfficeCount: 2,
      requireNoOverdueMandatory: true,
    },
  ],
  staffTraits: [
    {
      id: 'trait-policy-reader',
      title: 'Policy Reader',
      eligibleStaffDefinitionIds: ['staff-policy-aide'],
      effect: { kind: 'duration-multiplier', taskTag: 'policy-focused', multiplier: 0.8 },
    },
  ],
};

export const sessionSetup: InitialStateInput = {
  scenario: sessionScenario,
  seed: 417,
  districtId: 'GA-05',
  party: 'democratic',
  values: ['Tenant Stability', 'Fair Access'],
};
