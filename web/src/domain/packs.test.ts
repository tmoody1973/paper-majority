import { describe, expect, it } from 'vitest';

import { getCandidateScenario } from '@/content/loadScenario';
import { executeCommand } from '@/domain/engine';
import { openPack } from '@/domain/packs';
import { createRun } from '@/domain/runSetup';
import { createSaveEnvelope, validateAndMigrateSave } from '@/persistence/saveMigrations';

describe('weekly opportunity packs', () => {
  const scenario = getCandidateScenario();
  const makeState = () => ({
    ...createRun({
      scenario,
      districtId: 'GA-05',
      party: 'democratic',
      values: ['Tenant Stability', 'Housing Supply'],
      mode: 'session',
      seed: 417,
    }),
    week: 2,
  });

  it('freezes the reveal and RNG cursor by occurrence identity', () => {
    const a = openPack(makeState(), scenario, 'pack:week:2', 'week-two-policy');
    const b = openPack(makeState(), scenario, 'pack:week:2', 'week-two-policy');
    expect(a.state.revealedPacks).toEqual(b.state.revealedPacks);
    expect(a.state.rngCursor).toBe(b.state.rngCursor);
    const reopened = openPack(a.state, scenario, 'pack:week:2', 'week-two-policy');
    expect(reopened.state).toBe(a.state);
    expect(reopened.events).toEqual([]);
  });

  it('survives rearrangement and strict save/reload with obligations and receipts intact', () => {
    const opened = openPack(makeState(), scenario, 'pack:week:2', 'week-two-policy');
    const moved = executeCommand(opened.state, { type: 'MOVE_CARD', cardId: opened.state.cards[0].id, x: 19, y: 23 }, { scenario });
    const validation = validateAndMigrateSave(createSaveEnvelope(moved.state, scenario), scenario);
    expect(validation.kind).toBe('valid');
    if (validation.kind !== 'valid') return;
    expect(validation.envelope.state.revealedPacks).toEqual(opened.state.revealedPacks);
    expect(validation.envelope.state.rngCursor).toBe(opened.state.rngCursor);
    expect(validation.envelope.state.eventLog).toContainEqual(expect.objectContaining({
      type: 'OBLIGATION_CREATED', occurrenceId: 'pack:week:2',
    }));
  });
});
