'use client';

import { useState } from 'react';

import { previewBillChange, previewDocketProvision } from '@/domain/bill';
import type { ScenarioDefinition, TermState } from '@/domain/types';
import type { GameSession } from '@/game/session';

export interface BillDocketProps {
  session: GameSession;
  state: TermState;
  onResult?: (message: string) => void;
}

function titleOf(scenario: ScenarioDefinition, definitionId: string): string {
  return scenario.cards.find((card) => card.id === definitionId)?.title ?? definitionId;
}

function nextRequirement(state: TermState, scenario: ScenarioDefinition): string {
  const objective = scenario.modeObjectives.find((candidate) => candidate.mode === state.mode);
  if (!objective) return 'Next: keep building the bill.';

  const provisionGap = Math.max(0, objective.minProvisionCount - state.bill.provisionIds.length);
  if (provisionGap > 0) {
    return `Next: add ${provisionGap} more provision${provisionGap === 1 ? '' : 's'} to the bill.`;
  }
  const committed = state.relationships.filter((relationship) => relationship.support === 'committed').length;
  const supportGap = Math.max(0, objective.minCommittedOfficeCount - committed);
  if (supportGap > 0) {
    return `Next: secure ${supportGap} more committed office${supportGap === 1 ? '' : 's'}.`;
  }
  if (objective.requireNoOverdueMandatory && state.obligations.some(
    (obligation) => obligation.mandatory && obligation.status === 'missed',
  )) {
    return 'Next: resolve the remaining mandatory obligation.';
  }
  return 'Readiness requirements met.';
}

export function BillDocket({ session, state, onResult }: BillDocketProps) {
  const scenario = session.getScenario();
  const [candidateId, setCandidateId] = useState('');
  const [feedback, setFeedback] = useState('Drop a drafted provision here or use Add to Bill.');
  const drafted = state.cards.filter(
    (card) => card.location === 'desk' && card.status === 'idle' && card.form === 'drafted',
  );
  const preview = previewBillChange(state, scenario, state.bill.provisionIds);
  const candidate = drafted.find((card) => card.id === candidateId);
  const candidatePolicyId = candidate?.policyDefinitionId ?? candidate?.definitionId;
  const candidatePolicy = scenario.cards.find((card) => card.id === candidatePolicyId);
  const candidatePreview = candidateId
    ? previewDocketProvision(state, scenario, candidateId)
    : undefined;
  const candidateContributions = candidatePreview?.accepted
    ? candidatePreview.bill.contributions.filter(
        (contribution) => contribution.provisionId === candidatePreview.provisionId,
      )
    : [];

  const add = () => {
    if (!candidateId) return;
    const result = session.dispatch({ type: 'DOCKET_PROVISION', cardId: candidateId });
    const rejection = result.events.find((event) => event.type === 'COMMAND_REJECTED');
    if (rejection?.type === 'COMMAND_REJECTED') {
      setFeedback(rejection.message);
      onResult?.(rejection.message);
      return;
    }
    const docketed = result.events.find((event) => event.type === 'PROVISION_DOCKETED');
    if (docketed?.type === 'PROVISION_DOCKETED') {
      const message = `${titleOf(scenario, docketed.provisionId)} added to the bill.`;
      setCandidateId('');
      setFeedback(message);
      onResult?.(message);
    }
  };

  return (
    <section className="bill-docket" aria-label="Bill Docket" data-testid="bill-docket">
      <header className="bill-docket__header">
        <h2>Bill Docket</h2>
        <span data-testid="bill-docket-revision">Revision {state.bill.revision}</span>
      </header>
      <p className="bill-docket__values" data-testid="bill-docket-values">
        Governing values: {state.player.values.join(' · ')}
      </p>
      <p className="bill-docket__integrity" data-testid="bill-docket-integrity">
        Policy Integrity <strong>{preview.integrity}</strong>
      </p>

      {state.bill.provisionIds.length === 0 ? (
        <p className="bill-docket__empty">No provisions docketed yet.</p>
      ) : (
        <ol className="bill-docket__provisions">
          {state.bill.provisionIds.map((provisionId) => {
            const receipt = state.bill.provisionReceipts.find((candidate) => candidate.provisionId === provisionId);
            const contributions = preview.contributions.filter((entry) => entry.provisionId === provisionId);
            return (
              <li key={provisionId} data-testid={`bill-docket-provision-${provisionId}`}>
                <strong>{titleOf(scenario, provisionId)}</strong>
                <span className="bill-docket__provision-class">Drafted · Simulated</span>
                <span>{receipt?.plainLanguage ?? 'No plain-language provision content recorded'}</span>
                <span>
                  Source context: {receipt?.sourceDefinitionIds.length
                    ? receipt.sourceDefinitionIds.map((id) => titleOf(scenario, id)).join(', ')
                    : 'No evidence source recorded'}
                </span>
                <span>
                  {contributions.length
                    ? contributions.map((entry) => `${entry.value} ${entry.delta > 0 ? '+' : ''}${entry.delta}`).join(' · ')
                    : 'Neutral for selected values'}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="bill-docket__action">
        <label>
          <span>Drafted provision</span>
          <select
            data-testid="bill-docket-picker"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
          >
            <option value="">Choose a draft</option>
            {drafted.map((card) => (
              <option key={card.id} value={card.id}>
                {titleOf(scenario, card.policyDefinitionId ?? card.definitionId)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" data-testid="bill-docket-add" disabled={!candidateId} onClick={add}>
          Add to Bill
        </button>
      </div>
      {candidate && candidatePolicy?.kind === 'policy' && (
        <div className="bill-docket__candidate" data-testid="bill-docket-candidate-preview">
          <strong>{candidatePolicy.title}</strong>
          <p>{candidatePolicy.plainLanguage}</p>
          <p>
            Source context: {candidate.sourceDefinitionIds.length
              ? candidate.sourceDefinitionIds.map((id) => titleOf(scenario, id)).join(', ')
              : 'No evidence source recorded'}
          </p>
          {candidatePreview?.accepted ? (
            <p>
              Projected Policy Integrity {candidatePreview.bill.integrity}.{' '}
              {candidateContributions.length
                ? candidateContributions.map(
                    (contribution) => `${contribution.value} ${contribution.delta > 0 ? '+' : ''}${contribution.delta}`,
                  ).join(' · ')
                : 'Neutral for selected values.'}
            </p>
          ) : (
            <p>{candidatePreview?.message}</p>
          )}
        </div>
      )}
      <p className="bill-docket__feedback" aria-live="polite" data-testid="bill-docket-feedback">{feedback}</p>
      <p className="bill-docket__next" data-testid="bill-docket-next">{nextRequirement(state, scenario)}</p>
    </section>
  );
}
