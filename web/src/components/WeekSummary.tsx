'use client';

import { previewWeek } from '@/domain/week';
import { openObligations } from '@/domain/selectors';
import type { Resources, TermState } from '@/domain/types';
import type { GameSession } from '@/game/session';
import { OUTREACH_RECOVERY_PHRASE, readinessMilestonePhrase } from '@/content/i18n/en';
import { dueSimulationMs } from '@/domain/obligations';

const RESOURCE_LABELS: Record<keyof Resources, string> = {
  staffAttention: 'Staff Attention',
  politicalCapital: 'Political Capital',
  districtTrust: 'District Trust',
  billMomentum: 'Bill Momentum',
  policyIntegrity: 'Policy Integrity',
  staffMorale: 'Staff Morale',
};

export function WeekSummary({
  session,
  state,
  onResult,
}: {
  session: GameSession;
  state: TermState;
  onResult?: (message: string) => void;
}) {
  const scenario = session.getScenario();
  const preview = previewWeek(state, scenario);
  const due = openObligations(state)
    .filter((obligation) => obligation.due.week <= state.week)
    .sort((a, b) => dueSimulationMs(state, a) - dueSimulationMs(state, b))
    .slice(0, 3);
  const allCommitments = [...state.obligations].sort((a, b) =>
    dueSimulationMs(state, a) - dueSimulationMs(state, b) || a.id.localeCompare(b.id));
  const agenda = [
    {
      label: 'Choose the opening Story response',
      observed: state.eventLog.some((event) => event.type === 'STORY_DECISION_RESOLVED'),
    },
    {
      label: 'Start immediate staff work',
      observed: state.eventLog.some((event) => event.type === 'WORK_SUBMITTED'),
    },
    {
      label: 'Confirm a provision on the Bill Docket',
      observed: state.eventLog.some((event) => event.type === 'PROVISION_DOCKETED'),
    },
  ];
  const titleOf = (obligationId: string) => {
    const obligation = state.obligations.find((candidate) => candidate.id === obligationId);
    return scenario.obligationDefinitions.find((definition) => definition.id === obligation?.sourceId)?.title
      ?? obligationId;
  };
  const dispatch = (command: Parameters<GameSession['dispatch']>[0]) => {
    const result = session.dispatch(command);
    const rejection = result.events.find((event) => event.type === 'COMMAND_REJECTED');
    const milestone = result.events.find((event) => event.type === 'READINESS_MILESTONE_REWARDED');
    const recovered = result.events.some((event) => event.type === 'WORK_RECOVERED');
    onResult?.(rejection?.type === 'COMMAND_REJECTED'
      ? rejection.message
      : recovered
        ? OUTREACH_RECOVERY_PHRASE
        : milestone?.type === 'READINESS_MILESTONE_REWARDED'
        ? readinessMilestonePhrase(milestone.appliedCapital)
        : 'Office calendar updated.');
  };

  return (
    <section className="week-summary" aria-label="Weekly commitments" data-testid="week-summary">
      <div className="week-summary__header">
        <h2>{state.weekPhase === 'boundary' ? `Week ${state.week} review` : 'Deadlines'}</h2>
        <span>{state.weekPhase === 'boundary' ? 'Paused for review' : `${Math.ceil((state.weekLengthMs - state.elapsedMs) / 1000)}s left`}</span>
      </div>

      {state.week === 1 && (
        <section className="week-summary__agenda" aria-label="Week 1 agenda" data-testid="week-one-agenda">
          <h3>Week 1 agenda</h3>
          <ol>{agenda.map((item) => (
            <li key={item.label} data-observed={item.observed}>
              <span>{item.observed ? 'Confirmed' : 'Next'}</span> · {item.label}
            </li>
          ))}</ol>
        </section>
      )}

      {due.length > 0 ? (
        <ul className="week-summary__obligations" aria-label="Open obligations">
          {due.map((obligation) => {
            const definition = scenario.obligationDefinitions.find((item) => item.id === obligation.sourceId);
            const source = scenario.cards.find((card) => card.id === definition?.sourceDefinitionId);
            return (
              <li key={obligation.id}>
                <strong>{definition?.title ?? obligation.id}</strong>
                <span>
                  {obligation.mandatory ? 'Mandatory' : 'Optional'} · Reward +{obligation.rewardCapital} Political Capital ·{' '}
                  {obligation.mandatory
                    ? `Missed: -${obligation.trustPenalty} District Trust`
                    : 'No trust penalty if declined'}
                </span>
                <span>Due week {obligation.due.week}, {Math.ceil(obligation.due.offsetMs / 1000)}s</span>
                <span>Affects {source?.title ?? definition?.sourceDefinitionId ?? 'office commitment'}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="week-summary__empty">No open obligations due this week.</p>}

      <details className="week-summary__all" data-testid="all-commitments">
        <summary>All commitments and deadlines ({allCommitments.length})</summary>
        {allCommitments.length > 0 ? (
          <ul aria-label="All commitments and deadlines">
            {allCommitments.map((obligation) => {
              const definition = scenario.obligationDefinitions.find((item) => item.id === obligation.sourceId);
              const sourceCard = state.cards.find((card) => card.id === obligation.sourceCardInstanceId)
                ?? state.cards.find((card) => card.definitionId === definition?.sourceDefinitionId);
              return (
                <li key={obligation.id}>
                  <strong>{definition?.title ?? obligation.id}</strong>
                  <span>{obligation.status} · {obligation.mandatory ? 'Mandatory' : 'Optional'}</span>
                  <span>Due week {obligation.due.week}, {Math.ceil(obligation.due.offsetMs / 1000)}s</span>
                  <span>
                    Consequence: {obligation.mandatory ? `-${obligation.trustPenalty} District Trust if missed` : 'no trust penalty if declined'}; reward +{obligation.rewardCapital} Political Capital
                  </span>
                  <span>Source card: {sourceCard?.location ?? 'not currently held'}</span>
                </li>
              );
            })}
          </ul>
        ) : <p>No commitments have been created.</p>}
      </details>

      {state.weekPhase === 'boundary' && (
        <div className="week-summary__preview" data-testid="week-boundary-preview">
          <p>Review these effects before they are applied:</p>
          {preview.dueObligationIds.length > 0 && (
            <ul>{preview.dueObligationIds.map((id) => {
              const obligation = state.obligations.find((candidate) => candidate.id === id);
              return <li key={id}>{titleOf(id)} will be {obligation?.mandatory ? 'missed' : 'declined'}</li>;
            })}</ul>
          )}
          {Object.entries(preview.effects).length > 0 && (
            <ul>{Object.entries(preview.effects).map(([key, amount]) => (
              <li key={key}>{RESOURCE_LABELS[key as keyof Resources]} {amount > 0 ? '+' : ''}{amount}</li>
            ))}</ul>
          )}
          {preview.carryingWorkIds.length > 0 && (
            <p>Carrying work: {preview.carryingWorkIds.join(', ')}</p>
          )}
          {preview.dueObligationIds.length === 0
            && Object.keys(preview.effects).length === 0
            && preview.carryingWorkIds.length === 0
            && <p>No penalties or carrying work.</p>}
        </div>
      )}

      <div className="week-summary__controls">
        {state.weekPhase === 'active' ? (
          <>
            <button
              type="button"
              data-testid="week-fast-forward"
              disabled={state.runStatus === 'complete' || state.pendingDecisions.some((decision) => decision.status === 'pending') || state.pendingStoryDecisions.some((decision) => decision.status === 'pending')}
              onClick={() => dispatch({ type: 'FAST_FORWARD' })}
            >
              Fast-forward to next event
            </button>
            <button
              type="button"
              data-testid="week-end-early"
              disabled={state.runStatus === 'complete' || state.pendingDecisions.some((decision) => decision.status === 'pending') || state.pendingStoryDecisions.some((decision) => decision.status === 'pending')}
              onClick={() => dispatch({ type: 'ADVANCE_WEEK', confirmEarly: true, expectedWeek: state.week })}
            >
              End week early
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid="week-confirm"
            disabled={state.pendingDecisions.some((decision) => decision.status === 'pending')
              || state.pendingStoryDecisions.some((decision) => decision.status === 'pending')
              || (state.week === 6 && state.resolvedWeekIds.includes('week:6'))}
            onClick={() => dispatch({ type: 'ADVANCE_WEEK' })}
          >
            {state.week < 6 ? `Apply review and start week ${state.week + 1}` : 'Apply final week review'}
          </button>
        )}
        <button
          type="button"
          data-testid="session-conclude"
          disabled={state.runStatus === 'complete'
            || state.pendingDecisions.some((decision) => decision.status === 'pending')
            || state.pendingStoryDecisions.some((decision) => decision.status === 'pending')}
          onClick={() => dispatch({ type: 'CONCLUDE_SESSION' })}
        >
          {state.week < 6 ? `Conclude at Week ${state.week} boundary` : 'Conclude six-week Session'}
        </button>
      </div>
    </section>
  );
}
