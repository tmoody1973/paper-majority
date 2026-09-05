import type { EngineResult } from '@/domain/engine';
import type { GameEvent } from '@/domain/events';
import { obligationOccurrence } from '@/domain/obligations';
import { createRng } from '@/domain/rng';
import type {
  CardInstance,
  PackPoolDefinition,
  ScenarioDefinition,
  TermState,
  WeightedPackOption,
} from '@/domain/types';

function reject(state: TermState, message: string): EngineResult {
  return {
    state,
    events: [{ type: 'COMMAND_REJECTED', commandType: 'OPEN_PACK', reason: 'invalid-stage', message }],
  };
}
function rngAtCursor(state: TermState): () => number {
  const rng = createRng(state.seed);
  for (let index = 0; index < state.rngCursor; index += 1) rng();
  return rng;
}

function weightedDraw(options: WeightedPackOption[], roll: number): WeightedPackOption | undefined {
  const ordered = [...options].sort((a, b) => a.definitionId.localeCompare(b.definitionId));
  const total = ordered.reduce((sum, option) => sum + option.weight, 0);
  if (total <= 0) return undefined;
  let cursor = roll * total;
  for (const option of ordered) {
    cursor -= option.weight;
    if (cursor < 0) return option;
  }
  return ordered.at(-1);
}

function drawPool(pool: PackPoolDefinition, rng: () => number): { ids: string[]; draws: number } {
  const remaining = [...pool.options];
  const ids: string[] = [];
  let draws = 0;
  while (ids.length < pool.drawCount && remaining.length > 0) {
    const picked = weightedDraw(remaining, rng());
    draws += 1;
    if (!picked) break;
    ids.push(picked.definitionId);
    remaining.splice(remaining.findIndex((option) => option.definitionId === picked.definitionId), 1);
  }
  for (const fallback of pool.fallbackDefinitionIds) {
    if (ids.length >= pool.drawCount) break;
    if (!ids.includes(fallback)) ids.push(fallback);
  }
  return { ids, draws };
}

function cardInstance(definitionId: string, seq: number, index: number): CardInstance {
  const id = `card-${seq}`;
  return {
    id,
    definitionId,
    stackId: `stack-${id}`,
    x: 300 + (index % 4) * 180,
    y: 320 + Math.floor(index / 4) * 210,
    remainingMs: 0,
    status: 'idle',
    form: 'raw',
    location: 'desk',
    sourceDefinitionIds: [],
  };
}

/** Open one authored weekly category exactly once and freeze the reveal in state. */
export function openPack(
  state: TermState,
  scenario: ScenarioDefinition,
  packOccurrenceId: string,
  categoryId: string,
): EngineResult {
  const prior = state.revealedPacks.find((pack) => pack.packOccurrenceId === packOccurrenceId);
  if (prior) return { state, events: [] };
  const pack = scenario.weeklyPacks.find((candidate) => candidate.week === state.week);
  if (!pack || packOccurrenceId !== `pack:week:${pack.week}`) {
    return reject(state, 'That weekly opportunity pack is not available now.');
  }
  const pool = pack.pools.find((candidate) => candidate.id === categoryId);
  if (!pool) return reject(state, 'That pack category is not available.');

  const rng = rngAtCursor(state);
  const drawn = drawPool(pool, rng);
  const definitionIds = Array.from(new Set([
    ...pack.guaranteedDefinitionIds,
    ...drawn.ids,
  ]));
  if (definitionIds.some((id) => !scenario.cards.some((card) => card.id === id))) {
    return reject(state, 'That pack references unavailable content.');
  }

  const created = definitionIds.map((id, index) => cardInstance(id, state.cardSeq + index + 1, index));
  const obligationEvents: GameEvent[] = [];
  const obligations = scenario.obligationDefinitions
    .filter((definition) => definitionIds.includes(definition.sourceDefinitionId))
    .map((definition) => {
      const occurrence = obligationOccurrence(definition, packOccurrenceId);
      obligationEvents.push({
        type: 'OBLIGATION_CREATED',
        obligationId: occurrence.id,
        sourceId: definition.id,
        occurrenceId: packOccurrenceId,
      });
      return occurrence;
    });
  const packEvent: GameEvent = {
    type: 'PACK_OPENED',
    packOccurrenceId,
    categoryId,
    cardDefinitionIds: definitionIds,
  };
  const next: TermState = {
    ...state,
    rngCursor: state.rngCursor + drawn.draws,
    cardSeq: state.cardSeq + created.length,
    cards: [...state.cards, ...created.map((card) => {
      const definition = scenario.cards.find((candidate) => candidate.id === card.definitionId)!;
      return {
        ...card,
        sourceDefinitionIds: definition.kind === 'evidence' ? [definition.id] : [],
        policyDefinitionId: definition.kind === 'policy' ? definition.id : undefined,
      };
    })],
    stacks: [...state.stacks, ...created.map((card) => ({ id: card.stackId, cardIds: [card.id] }))],
    obligations: [
      ...state.obligations,
      ...obligations.filter((entry) => !state.obligations.some((priorEntry) => priorEntry.id === entry.id)),
    ],
    revealedPacks: [...state.revealedPacks, {
      packOccurrenceId,
      week: pack.week,
      categoryId,
      cardDefinitionIds: definitionIds,
    }],
  };
  const events = [packEvent, ...obligationEvents];
  return { state: { ...next, eventLog: [...next.eventLog, ...events] }, events };
}
