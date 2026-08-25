import { createRng, drawOpponentStrength } from '@/domain/rng';
import type {
  GoverningValue,
  Party,
  Resources,
  RunSettings,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

export const WEEK_LENGTH_MS: Record<RunSettings['pace'], number> = {
  relaxed: 150_000,
  standard: 105_000,
  brisk: 75_000,
};

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  pace: 'standard',
  guidance: 'standard',
  termStyle: 'regular-order',
  voteInformation: 'broad',
  policyComplexity: 'essential',
  locale: 'en',
  reducedMotion: false,
};

export const OPENING_RESOURCES: Resources = {
  staffAttention: 3,
  politicalCapital: 3,
  districtTrust: 60,
  billMomentum: 10,
  policyIntegrity: 60,
  staffMorale: 70,
};

/** Where the three opening cards are dealt on the desk. */
const OPENING_CARD_POSITIONS = [
  { x: 320, y: 360 },
  { x: 520, y: 360 },
  { x: 720, y: 360 },
];

export interface InitialStateInput {
  scenario: ScenarioDefinition;
  seed: number;
  districtId: string;
  party: Party;
  values: [GoverningValue, GoverningValue];
  settings?: Partial<RunSettings>;
}

export function createInitialState(input: InitialStateInput): TermState {
  const { scenario, seed, districtId, party, values } = input;

  if (!scenario.districts.some((district) => district.id === districtId)) {
    throw new Error(`Unknown district: ${districtId}`);
  }
  if (values[0] === values[1]) {
    throw new Error(`Governing values must differ; received "${values[0]}" twice`);
  }

  for (const definitionId of scenario.startingCardDefinitionIds) {
    if (!scenario.cards.some((card) => card.id === definitionId)) {
      throw new Error(`Unknown starting card definition: ${definitionId}`);
    }
  }

  // The opponent is drawn once, here, and never again. The cursor records that the
  // seeded stream has advanced exactly one step so replays stay aligned.
  const rng = createRng(seed);
  const opponentStrength = drawOpponentStrength(rng());

  const settings: RunSettings = { ...DEFAULT_RUN_SETTINGS, ...input.settings };

  const cards = scenario.startingCardDefinitionIds.map((definitionId, index) => ({
    id: `card-${index + 1}`,
    definitionId,
    stackId: `stack-${index + 1}`,
    x: OPENING_CARD_POSITIONS[index].x,
    y: OPENING_CARD_POSITIONS[index].y,
    remainingMs: 0,
    status: 'idle' as const,
  }));

  const stacks = cards.map((card) => ({ id: card.stackId, cardIds: [card.id] }));

  return {
    schemaVersion: 1,
    snapshotId: scenario.snapshotId,
    seed,
    rngCursor: 1,
    week: 1,
    elapsedMs: 0,
    weekLengthMs: WEEK_LENGTH_MS[settings.pace],
    paused: true,
    settings,
    player: {
      districtId,
      party,
      values: [values[0], values[1]],
      election: { opponentStrength, revealedWeek: 1 },
    },
    cards,
    cardSeq: cards.length,
    stacks,
    resources: { ...OPENING_RESOURCES },
    bill: {
      issueId: scenario.issue.id,
      title: scenario.issue.title,
      provisionIds: [],
      stage: 'draft',
      outcome: 'active',
    },
    relationships: [],
    discoveredPatternIds: [],
    unlockedSlotExpansions: {},
    electionEffects: [],
    storyHistory: [],
    objectives: [],
    eventLog: [],
  };
}
