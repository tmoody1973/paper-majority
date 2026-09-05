import { buildInitialState, type InitialStateInput } from '@/domain/initialState';
import { createRng } from '@/domain/rng';
import type { RunMode, ScenarioDefinition, TermState } from '@/domain/types';

function validateSessionSupply(scenario: ScenarioDefinition): void {
  const starting = scenario.startingCardDefinitionIds.map((id) =>
    scenario.cards.find((card) => card.id === id),
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
  if (!scenario.patterns.some((pattern) =>
    pattern.output.mode === 'derived' && pattern.output.resolverId === 'summarize-evidence-v1'
  ) || !scenario.patterns.some((pattern) =>
    pattern.output.mode === 'derived' && pattern.output.resolverId === 'draft-provision-v1'
  )) {
    throw new Error('Session setup requires a baseline summarize-and-draft path');
  }
}

/**
 * Canonical run construction. Setup draws are declared and stable:
 * one opponent draw in buildInitialState, then one trait draw per staff role in
 * stable definition-id order. A generalist result is represented by no trait ID.
 */
export function createRun(input: InitialStateInput & { mode: RunMode }): TermState {
  if (!input.scenario.supportedModes.includes(input.mode)) {
    throw new Error(`Scenario does not support mode "${input.mode}"`);
  }
  if (input.mode === 'session') {
    if (input.scenario.tacticExpansions.some((expansion) => expansion.effect.kind === 'output-strength')) {
      throw new Error('Session mode does not support output-strength Tactic effects');
    }
    validateSessionSupply(input.scenario);
  }

  const state = buildInitialState(input, 2, input.mode);
  if (input.mode !== 'session') return state;

  const startingStaffDefinitionIds = state.cards
    .filter((card) => input.scenario.cards.find((definition) => definition.id === card.definitionId)?.kind === 'staff')
    .map((card) => card.definitionId);
  const completeTraitCatalog = startingStaffDefinitionIds.every((definitionId) =>
    input.scenario.staffTraits.some((trait) => trait.eligibleStaffDefinitionIds.includes(definitionId)),
  );
  // Narrow unit fixtures may intentionally omit role pools. Such fixtures retain
  // their historical one-draw setup rather than receiving a partial variation.
  if (!completeTraitCatalog) return state;

  const rng = createRng(input.seed);
  rng(); // opponent draw, already applied by buildInitialState
  let cursor = 1;
  const traitByStaff = new Map<string, string | undefined>();
  const staff = state.cards
    .filter((card) => input.scenario.cards.find((definition) => definition.id === card.definitionId)?.kind === 'staff')
    .sort((a, b) => a.definitionId.localeCompare(b.definitionId));
  for (const card of staff) {
    const roll = rng();
    cursor += 1;
    const eligible = input.scenario.staffTraits
      .filter((trait) => trait.eligibleStaffDefinitionIds.includes(card.definitionId))
      .sort((a, b) => a.id.localeCompare(b.id));
    const selected = eligible.length > 0 && roll < 0.75
      ? eligible[Math.min(eligible.length - 1, Math.floor(roll * eligible.length))]?.id
      : undefined;
    traitByStaff.set(card.id, selected);
  }

  return {
    ...state,
    rngCursor: cursor,
    cards: state.cards.map((card) => {
      if (!traitByStaff.has(card.id)) return card;
      const staffTraitId = traitByStaff.get(card.id);
      return staffTraitId ? { ...card, staffTraitId } : card;
    }),
  };
}
