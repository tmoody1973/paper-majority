import spike from '@/content/fixtures/interaction-spike.json';
import { createInitialState } from '@/domain/initialState';
import type {
  CardInstance,
  GoverningValue,
  Party,
  RelationshipState,
  Resources,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

export type FixtureId = 'interaction-spike';

interface DeskEntry {
  definitionId: string;
  x: number;
  y: number;
  remainingMs?: number;
}

interface SpikeFixture {
  fixtureId: string;
  note: string;
  seed: number;
  player: { districtId: string; party: string; values: string[] };
  resources: Resources;
  startingDefinitionIds: string[];
  desk: DeskEntry[];
  relationships: RelationshipState[];
  scenario: ScenarioDefinition;
}

const FIXTURE = spike as unknown as SpikeFixture;

export function getFixtureScenario(): ScenarioDefinition {
  return FIXTURE.scenario;
}

/** The eight pattern-bearing definitions the fun-first gate counts. */
export function getStartingDefinitionIds(): string[] {
  return FIXTURE.startingDefinitionIds;
}

/**
 * Build the opening desk for the interaction spike.
 *
 * Deterministic: the same fixture and seed always produce the same instance ids,
 * positions and event order, which is what the replay check in the E2E suite relies on.
 */
export function createFixtureState(fixtureId: FixtureId): TermState {
  if (fixtureId !== 'interaction-spike') {
    throw new Error(`Unknown fixture "${fixtureId}"`);
  }

  const base = createInitialState({
    scenario: FIXTURE.scenario,
    seed: FIXTURE.seed,
    districtId: FIXTURE.player.districtId,
    party: FIXTURE.player.party as Party,
    values: FIXTURE.player.values as [GoverningValue, GoverningValue],
  });

  const cards: CardInstance[] = FIXTURE.desk.map((entry, index) => ({
    id: `card-${index + 1}`,
    definitionId: entry.definitionId,
    stackId: `stack-${index + 1}`,
    x: entry.x,
    y: entry.y,
    remainingMs: entry.remainingMs ?? 0,
    status: 'idle',
  }));

  return {
    ...base,
    cards,
    cardSeq: cards.length,
    stacks: cards.map((card) => ({ id: card.stackId, cardIds: [card.id] })),
    resources: { ...FIXTURE.resources },
    relationships: FIXTURE.relationships,
  };
}
