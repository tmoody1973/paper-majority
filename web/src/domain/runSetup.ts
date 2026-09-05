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
 * one opponent draw in buildInitialState, then complete staff-role trait pools,
 * multi-option office demand pools and multi-option deadline pools in stable ID order.
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
  const rng = createRng(input.seed);
  rng(); // opponent draw, already applied by buildInitialState
  let cursor = 1;
  const traitByStaff = new Map<string, string | undefined>();
  const staff = state.cards
    .filter((card) => input.scenario.cards.find((definition) => definition.id === card.definitionId)?.kind === 'staff')
    .sort((a, b) => a.definitionId.localeCompare(b.definitionId));
  for (const card of completeTraitCatalog ? staff : []) {
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

  const selectedDemandIdsByOffice = { ...state.runVariation.selectedDemandIdsByOffice };
  const officeIds = Array.from(new Set(input.scenario.demandDefinitions.map((demand) => demand.officeDefinitionId))).sort();
  for (const officeId of officeIds) {
    const pool = input.scenario.demandDefinitions
      .filter((demand) => demand.officeDefinitionId === officeId)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (pool.length > 1) {
      const selected = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;
      cursor += 1;
      selectedDemandIdsByOffice[officeId] = selected.id;
    }
  }

  const obligationDueByDefinitionId = { ...state.runVariation.obligationDueByDefinitionId };
  for (const definition of [...input.scenario.obligationDefinitions].sort((a, b) => a.id.localeCompare(b.id))) {
    const pool = [...(definition.dueOptions ?? [definition.due])]
      .sort((a, b) => a.week - b.week || a.offsetMs - b.offsetMs);
    if (pool.length > 1) {
      obligationDueByDefinitionId[definition.id] = { ...pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]! };
      cursor += 1;
    }
  }

  return {
    ...state,
    rngCursor: cursor,
    runVariation: { selectedDemandIdsByOffice, obligationDueByDefinitionId },
    relationships: state.relationships.map((relationship) => ({
      ...relationship,
      demandProvisionId: selectedDemandIdsByOffice[relationship.memberId],
    })),
    cards: state.cards.map((card) => {
      if (!traitByStaff.has(card.id)) return card;
      const staffTraitId = traitByStaff.get(card.id);
      return staffTraitId ? { ...card, staffTraitId } : card;
    }),
  };
}
