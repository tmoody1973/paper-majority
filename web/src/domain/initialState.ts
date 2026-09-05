import { createRng, drawOpponentStrength } from '@/domain/rng';
import type {
  GoverningValue,
  Party,
  Resources,
  RunMode,
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

function openingPosition(index: number): { x: number; y: number } {
  return OPENING_CARD_POSITIONS[index] ?? {
    x: 320 + (index % 3) * 200,
    y: 360 + Math.floor(index / 3) * 250,
  };
}

export interface InitialStateInput {
  scenario: ScenarioDefinition;
  seed: number;
  districtId: string;
  party: Party;
  values: [GoverningValue, GoverningValue];
  settings?: Partial<RunSettings>;
}

function buildInitialState(
  input: InitialStateInput,
  schemaVersion: 1 | 2,
  mode: RunMode,
): TermState {
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

  const cards = scenario.startingCardDefinitionIds.map((definitionId, index) => {
    const definition = scenario.cards.find((card) => card.id === definitionId)!;
    const position = openingPosition(index);
    return {
      id: `card-${index + 1}`,
      definitionId,
      stackId: `stack-${index + 1}`,
      x: position.x,
      y: position.y,
      remainingMs: 0,
      status: 'idle' as const,
      form: 'raw' as const,
      location: 'desk' as const,
      sourceDefinitionIds: definition.kind === 'evidence' ? [definition.id] : [],
      policyDefinitionId: definition.kind === 'policy' ? definition.id : undefined,
    };
  });

  const stacks = cards.map((card) => ({ id: card.stackId, cardIds: [card.id] }));

  return {
    schemaVersion,
    mode,
    snapshotId: scenario.snapshotId,
    seed,
    rngCursor: 1,
    week: 1,
    simulationMs: 0,
    elapsedMs: 0,
    weekPhase: 'active',
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
      provisionReceipts: [],
      stage: 'draft',
      outcome: 'active',
      revision: 0,
    },
    relationships: [],
    staffCapacity: 3,
    activeWork: [],
    obligations: [],
    pendingDecisions: [],
    rewardedOccurrenceIds: [],
    resolvedWeekIds: [],
    runStatus: 'active',
    discoveredPatternIds: [],
    unlockedSlotExpansions: {},
    electionEffects: [],
    storyHistory: [],
    objectives: [],
    eventLog: [],
  };
}

/**
 * Legacy interaction entry point. It keeps the historical schema marker and RNG
 * draw while constructing the same complete state shape used by the v2 engine.
 */
export function createInitialState(input: InitialStateInput): TermState {
  return buildInitialState(input, 1, 'interaction-spike');
}

/** Canonical version-2 run constructor. */
export function createRun(input: InitialStateInput & { mode: RunMode }): TermState {
  if (!input.scenario.supportedModes.includes(input.mode)) {
    throw new Error(`Scenario does not support mode "${input.mode}"`);
  }

  if (input.mode === 'session') {
    if (
      input.scenario.tacticExpansions.some(
        (expansion) => expansion.effect.kind === 'output-strength',
      )
    ) {
      throw new Error('Session mode does not support output-strength Tactic effects');
    }
    const starting = input.scenario.startingCardDefinitionIds.map((id) =>
      input.scenario.cards.find((card) => card.id === id),
    );
    const staffIds = starting
      .filter((card) => card?.kind === 'staff')
      .map((card) => card!.id);
    if (staffIds.length !== 3 || new Set(staffIds).size !== 3) {
      throw new Error('Session setup requires three distinct starting staff roles');
    }
    if (!starting.some((card) => card?.kind === 'evidence')) {
      throw new Error('Session setup requires baseline Evidence');
    }
    if (!starting.some((card) => card?.kind === 'policy')) {
      throw new Error('Session setup requires a starting Policy');
    }
  }

  return buildInitialState(input, 2, input.mode);
}
