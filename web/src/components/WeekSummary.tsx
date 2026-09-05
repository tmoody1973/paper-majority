'use client';

import { previewWeek } from '@/domain/week';
import { openObligations } from '@/domain/selectors';
import type { Resources, TermState } from '@/domain/types';
import type { GameSession } from '@/game/session';

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
  const titleOf = (obligationId: string) => {
    const obligation = state.obligations.find((candidate) => candidate.id === obligationId);
    return scenario.obligationDefinitions.find((definition) => definition.id === obligation?.sourceId)?.title
      ?? obligationId;
  };
  const dispatch = (command: Parameters<GameSession['dispatch']>[0]) => {
    const result = session.dispatch(command);
    const rejection = result.events.find((event) => event.type === 'COMMAND_REJECTED');
    onResult?.(rejection?.type === 'COMMAND_REJECTED' ? rejection.message : 'Office calendar updated.');
  };

  return (
    <section className="week-summary" aria-label="Weekly commitments" data-testid="week-summary">
      <div className="week-summary__header">
        <h2>{state.weekPhase === 'boundary' ? `Week ${state.week} review` : 'Deadlines'}</h2>
        <span>{state.weekPhase === 'boundary' ? 'Paused for review' : `${Math.ceil((state.weekLengthMs - state.elapsedMs) / 1000)}s left`}</span>
      </div>

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
              disabled={state.runStatus === 'complete' || state.pendingDecisions.some((decision) => decision.status === 'pending')}
              onClick={() => dispatch({ type: 'FAST_FORWARD' })}
            >
              Fast-forward to next event
            </button>
            <button
              type="button"
              data-testid="week-end-early"
              disabled={state.runStatus === 'complete' || state.pendingDecisions.some((decision) => decision.status === 'pending')}
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
              || (state.week === 6 && state.resolvedWeekIds.includes('week:6'))}
            onClick={() => dispatch({ type: 'ADVANCE_WEEK' })}
          >
            {state.week < 6 ? `Apply review and start week ${state.week + 1}` : 'Apply final week review'}
          </button>
        )}
      </div>
    </section>
  );
}
