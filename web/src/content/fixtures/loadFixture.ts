import spike from '@/content/fixtures/interaction-spike.json';
import { upgradeLegacyScenario } from '@/content/schema';
import { createInitialState } from '@/domain/initialState';
import { z } from 'zod';
import type {
  CardInstance,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

export type FixtureId = 'interaction-spike';

const fixtureSchema = z.strictObject({
  fixtureId: z.literal('interaction-spike'),
  note: z.string(),
  seed: z.number().int(),
  player: z.strictObject({
    districtId: z.string(),
    party: z.enum(['democratic', 'republican']),
    values: z.tuple([
      z.enum([
        'Fiscal Stewardship',
        'Local Control',
        'Market Competition',
        'Public Investment',
        'Tenant Stability',
        'Housing Supply',
        'Environmental Resilience',
        'Fair Access',
      ]),
      z.enum([
        'Fiscal Stewardship',
        'Local Control',
        'Market Competition',
        'Public Investment',
        'Tenant Stability',
        'Housing Supply',
        'Environmental Resilience',
        'Fair Access',
      ]),
    ]),
  }),
  resources: z.strictObject({
    staffAttention: z.number().finite(),
    politicalCapital: z.number().finite(),
    districtTrust: z.number().finite(),
    billMomentum: z.number().finite(),
    policyIntegrity: z.number().finite(),
    staffMorale: z.number().finite(),
  }),
  startingDefinitionIds: z.array(z.string()),
  desk: z.array(z.strictObject({
    definitionId: z.string(),
    x: z.number().finite(),
    y: z.number().finite(),
    remainingMs: z.number().finite().optional(),
  })),
  relationships: z.array(z.strictObject({
    memberId: z.string(),
    support: z.enum(['interested', 'conditional', 'committed']),
    demandProvisionId: z.string().optional(),
  })),
  scenario: z.unknown(),
  camera: z.strictObject({
    zoom: z.number().finite(),
    scrollX: z.number().finite(),
    scrollY: z.number().finite(),
  }),
});

const FIXTURE = fixtureSchema.parse(spike);
const FIXTURE_SCENARIO = upgradeLegacyScenario(FIXTURE.scenario);

export function getFixtureScenario(): ScenarioDefinition {
  return FIXTURE_SCENARIO;
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
    scenario: FIXTURE_SCENARIO,
    seed: FIXTURE.seed,
    districtId: FIXTURE.player.districtId,
    party: FIXTURE.player.party,
    values: FIXTURE.player.values,
  });

  const cards: CardInstance[] = FIXTURE.desk.map((entry, index) => ({
    id: `card-${index + 1}`,
    definitionId: entry.definitionId,
    stackId: `stack-${index + 1}`,
    x: entry.x,
    y: entry.y,
    remainingMs: entry.remainingMs ?? 0,
    status: 'idle',
    form: 'raw',
    location: 'desk',
    sourceDefinitionIds:
      FIXTURE_SCENARIO.cards.find((card) => card.id === entry.definitionId)?.kind === 'evidence'
        ? [entry.definitionId]
        : [],
    policyDefinitionId:
      FIXTURE_SCENARIO.cards.find((card) => card.id === entry.definitionId)?.kind === 'policy'
        ? entry.definitionId
        : undefined,
  }));

  return {
    ...base,
    cards,
    cardSeq: cards.length,
    stacks: cards.map((card) => ({ id: card.stackId, cardIds: [card.id] })),
    resources: { ...FIXTURE.resources },
    relationships: FIXTURE.relationships.map((relationship) => ({
      ...relationship,
      promiseOccurrenceIds: [],
      conditions: [],
      evaluatedRevision: 0,
    })),
  };
}
