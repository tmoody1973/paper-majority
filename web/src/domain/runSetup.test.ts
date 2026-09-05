import { describe, expect, it } from 'vitest';

import { getCandidateScenario } from '@/content/loadScenario';
import { createRun } from '@/domain/runSetup';
import { eligibleStoryEvents } from '@/domain/storyDirector';
import type { GoverningValue } from '@/domain/types';

describe('Session run setup', () => {
  const scenario = getCandidateScenario();
  const sessionSetup = {
    scenario,
    districtId: 'GA-05',
    party: 'democratic' as const,
    values: ['Tenant Stability', 'Housing Supply'] as [GoverningValue, GoverningValue],
  };

  it('is identical for an identical snapshot, setup, and seed', () => {
    const a = createRun({ ...sessionSetup, mode: 'session', seed: 417 });
    const b = createRun({ ...sessionSetup, mode: 'session', seed: 417 });
    expect(a).toEqual(b);
    expect(eligibleStoryEvents(a, scenario).map((event) => event.id)).toEqual(
      eligibleStoryEvents(b, scenario).map((event) => event.id),
    );
    expect(a.rngCursor).toBe(12);
  });

  it('guarantees three roles, raw policy/evidence, and trait-or-generalist setup', () => {
    const run = createRun({ ...sessionSetup, mode: 'session', seed: 9 });
    const definitions = run.cards.map((card) => scenario.cards.find((entry) => entry.id === card.definitionId));
    expect(definitions.filter((entry) => entry?.kind === 'staff')).toHaveLength(3);
    expect(definitions.some((entry) => entry?.kind === 'policy')).toBe(true);
    expect(definitions.some((entry) => entry?.kind === 'evidence')).toBe(true);
    for (const staff of run.cards.filter((card) => definitions.find((entry) => entry?.id === card.definitionId)?.kind === 'staff')) {
      if (!staff.staffTraitId) continue;
      expect(scenario.staffTraits.find((trait) => trait.id === staff.staffTraitId)?.eligibleStaffDefinitionIds)
        .toContain(staff.definitionId);
    }
  });

  it('varies authored traits by seed while keeping the role supply fixed', () => {
    const traitIds = (seed: number) => createRun({ ...sessionSetup, mode: 'session', seed }).cards
      .filter((card) => card.definitionId.startsWith('staff-'))
      .sort((a, b) => a.definitionId.localeCompare(b.definitionId))
      .map((card) => card.staffTraitId ?? 'generalist');
    expect(traitIds(2)).not.toEqual(traitIds(9));
    expect(traitIds(2)).toHaveLength(3);
    expect(traitIds(9)).toHaveLength(3);
  });

  it('persists bounded demand and deadline draws that vary by seed', () => {
    const a = createRun({ ...sessionSetup, mode: 'session', seed: 2 });
    const b = createRun({ ...sessionSetup, mode: 'session', seed: 9 });
    expect(a.runVariation).not.toEqual(b.runVariation);
    for (const [officeId, demandId] of Object.entries(a.runVariation.selectedDemandIdsByOffice)) {
      expect(scenario.demandDefinitions).toContainEqual(expect.objectContaining({ id: demandId, officeDefinitionId: officeId }));
      expect(a.relationships.find((relationship) => relationship.memberId === officeId)?.demandProvisionId).toBe(demandId);
    }
    for (const [definitionId, due] of Object.entries(a.runVariation.obligationDueByDefinitionId)) {
      const definition = scenario.obligationDefinitions.find((entry) => entry.id === definitionId)!;
      expect(definition.dueOptions).toContainEqual(due);
    }
  });
});
