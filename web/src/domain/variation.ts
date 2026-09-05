import type { DemandDefinition, ObligationDefinition, ScenarioDefinition, TermState } from '@/domain/types';

export function demandForOffice(
  state: TermState,
  scenario: ScenarioDefinition,
  officeDefinitionId: string,
): DemandDefinition | undefined {
  const selectedId = state.runVariation.selectedDemandIdsByOffice[officeDefinitionId];
  if (selectedId) {
    const selected = scenario.demandDefinitions.find((demand) =>
      demand.id === selectedId && demand.officeDefinitionId === officeDefinitionId,
    );
    if (!selected) throw new Error(`Run variation selected an invalid demand for ${officeDefinitionId}`);
    return selected;
  }
  return scenario.demandDefinitions
    .filter((demand) => demand.officeDefinitionId === officeDefinitionId)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function dueForObligation(
  state: TermState,
  definition: ObligationDefinition,
) {
  return state.runVariation.obligationDueByDefinitionId[definition.id] ?? definition.due;
}
