import { describe, expect, it } from 'vitest';

import { executeCommand } from '@/domain/engine';
import { buildNextExperiments, buildSessionRecord } from '@/domain/sessionRecord';
import { createRun } from '@/domain/runSetup';
import type { TermState } from '@/domain/types';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';
import { scenarioSnapshotHash } from '@/persistence/sessionIdentity';

function boundary(): TermState {
  const state = createRun({ ...sessionSetup, mode: 'session' });
  return {
    ...state,
    elapsedMs: state.weekLengthMs,
    simulationMs: state.weekLengthMs,
    weekPhase: 'boundary',
    paused: true,
  };
}

describe('Session record and conclusion', () => {
  it('records an honest early not-ready result and never adds next-week income', () => {
    const state = boundary();
    const result = executeCommand(state, { type: 'CONCLUDE_SESSION' }, { scenario: sessionScenario });
    expect(result.state.runStatus).toBe('complete');
    expect(result.state.week).toBe(1);
    expect(result.state.sessionRecord?.outcome).toBe('not-ready');
    expect(result.state.sessionRecord?.gaps.provisionGap).toBe(2);
    expect('voteShare' in result.state.sessionRecord!).toBe(false);
    expect(result.state.eventLog).toContainEqual(expect.objectContaining({ type: 'WEEK_RESOLVED', week: 1 }));
  });

  it('blocks both kinds of pending choice and freezes every gameplay command after conclusion', () => {
    const coalition = { ...boundary(), pendingDecisions: [{
      id: 'decision:test', sourceId: 'demand-renter-protection', occurrenceId: 'test',
      officeDefinitionId: 'coalition-office-hillcrest', approachedBillRevision: 0,
      expectedBillRevision: 0, choiceIds: [], status: 'pending' as const,
    }] };
    expect(executeCommand(coalition, { type: 'CONCLUDE_SESSION' }, { scenario: sessionScenario }).state).toBe(coalition);
    const story = { ...boundary(), pendingStoryDecisions: [{ id: 'story:test', storyEventId: 'story-recovery-briefing', occurrenceId: 'test', choiceIds: [], status: 'pending' as const }] };
    expect(executeCommand(story, { type: 'CONCLUDE_SESSION' }, { scenario: sessionScenario }).state).toBe(story);

    const complete = executeCommand(boundary(), { type: 'CONCLUDE_SESSION' }, { scenario: sessionScenario }).state;
    const frozen = executeCommand(complete, { type: 'MOVE_CARD', cardId: complete.cards[0].id, x: 99, y: 99 }, { scenario: sessionScenario });
    expect(frozen.state).toBe(complete);
    expect(frozen.events).toEqual([expect.objectContaining({ reason: 'run-complete' })]);
  });

  it('deeply detaches setup, receipts, obligations, conditions and causes', () => {
    const state = boundary();
    const record = buildSessionRecord(state, sessionScenario);
    state.player.values[0] = 'Fair Access';
    state.settings.pace = 'relaxed';
    state.eventLog.push({ type: 'WEEK_RESOLVED', week: 1, summary: [] });
    expect(record.setup.values).toEqual(sessionSetup.values);
    expect(record.setup.settings.pace).toBe('standard');
    expect(record.setup).toMatchObject({
      mode: 'session',
      rulesVersion: 2,
      snapshotId: sessionScenario.snapshotId,
      snapshotHash: scenarioSnapshotHash(sessionScenario),
    });
    expect(record.causeEventIds).toEqual([]);
  });

  it('freezes possibilities from actual ending gaps and available untried Tactics', () => {
    const state = boundary();
    state.cards.push({
      id: 'card-tactic',
      definitionId: 'tactic-bipartisan-working-group',
      stackId: 'stack-tactic',
      x: 100,
      y: 100,
      remainingMs: 0,
      status: 'idle',
      form: 'raw',
      location: 'desk',
      sourceDefinitionIds: [],
    });
    const suggestions = buildNextExperiments(state, sessionScenario);
    expect(suggestions).toEqual(expect.arrayContaining([
      expect.stringMatching(/2 more distinct provisions.*recorded in this ending/i),
      expect.stringMatching(/2 more office commitments.*recorded in this ending/i),
      expect.stringMatching(/try studying Bipartisan Working Group.*may let you test/i),
    ]));
    expect(suggestions.join(' ')).not.toMatch(/will (win|succeed|make)/i);
    expect(buildNextExperiments(state, sessionScenario)).toEqual(suggestions);
  });
});
