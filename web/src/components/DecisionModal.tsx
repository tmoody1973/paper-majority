'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { previewDecision } from '@/domain/decisions';
import { nextPendingDecision } from '@/domain/selectors';
import type { Resources, TermState } from '@/domain/types';
import type { GameSession } from '@/game/session';

export interface DecisionModalProps {
  session: GameSession;
  state: TermState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  onResult?: (message: string) => void;
}

function titleOf(session: GameSession, definitionId: string): string {
  return session.getScenario().cards.find((card) => card.id === definitionId)?.title ?? definitionId;
}

function resourceName(resource: keyof Resources): string {
  return resource.replace(/([A-Z])/g, ' $1').toLowerCase();
}

export function DecisionModal({ session, state, open, onOpenChange, returnFocusRef, onResult }: DecisionModalProps) {
  const pending = nextPendingDecision(state);
  const scenario = session.getScenario();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !pending || !open) return;
    const returnFocusTarget = returnFocusRef.current;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLElement>('button[data-decision-choice]')?.focus();
    return () => {
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
      returnFocusTarget?.focus();
    };
  }, [open, pending, returnFocusRef]);

  if (!pending || !open) return null;
  const demand = scenario.demandDefinitions.find((candidate) => candidate.id === pending.sourceId);
  const office = scenario.cards.find((candidate) => candidate.id === pending.officeDefinitionId);

  return (
    <dialog
      ref={dialogRef}
      className="decision-modal"
      data-testid="decision-modal"
      aria-labelledby="decision-modal-title"
      aria-describedby="decision-modal-description"
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
    >
      <div className="decision-modal__paper">
        <header>
          <div>
            <span className="decision-modal__badge">Simulated negotiation</span>
            <h2 id="decision-modal-title">{office?.title ?? pending.officeDefinitionId}</h2>
          </div>
          <button type="button" aria-label="Close decision inspection" onClick={() => onOpenChange(false)}>Close</button>
        </header>
        <p id="decision-modal-description">{demand?.title ?? pending.sourceId}</p>
        {office?.kind === 'coalition' && (
          <p className="decision-modal__identity">
            Official record: {office.officialRecord.officeTitle}
            {office.officialRecord.party ? ` · ${office.officialRecord.party}` : ''}
          </p>
        )}
        <p>
          Offer for bill revision {pending.expectedBillRevision}
          {pending.approachedBillRevision !== pending.expectedBillRevision
            ? `, revalidated after outreach examined revision ${pending.approachedBillRevision}`
            : ''}.
        </p>

        <div className="decision-modal__choices">
          {pending.choiceIds.map((choiceId) => {
            const choice = scenario.decisionChoices.find((candidate) => candidate.id === choiceId);
            const preview = previewDecision(state, scenario, pending.id, choiceId);
            if (!choice) return null;
            const added = preview.accepted
              ? preview.nextProvisionIds.filter((id) => !state.bill.provisionIds.includes(id))
              : [];
            const removed = preview.accepted
              ? state.bill.provisionIds.filter((id) => !preview.nextProvisionIds.includes(id))
              : [];
            return (
              <section key={choiceId} className="decision-modal__choice" data-testid={`decision-choice-${choice.action}`}>
                <h3>{choice.label}</h3>
                {preview.accepted ? (
                  <ul>
                    <li>Affected offices: {preview.affectedOfficeDefinitionIds.map((id) => titleOf(session, id)).join(', ')}</li>
                    <li>Affected provisions: {[
                      ...added.map((id) => `add ${titleOf(session, id)}`),
                      ...removed.map((id) => `remove ${titleOf(session, id)}`),
                    ].join('; ') || 'none'}</li>
                    <li>Upfront costs: {(Object.entries(preview.upfrontCosts) as [keyof Resources, number][])
                      .filter(([, amount]) => amount !== 0)
                      .map(([resource, amount]) => `${resourceName(resource)} ${amount}`)
                      .join(', ') || 'none'}</li>
                    <li>Resources after immediate effects: {(Object.entries(preview.resourceDeltas) as [keyof Resources, number][])
                      .filter(([, amount]) => amount !== 0)
                      .map(([resource, amount]) => `${resourceName(resource)} ${amount > 0 ? '+' : ''}${amount}`)
                      .join(', ') || 'no change'}</li>
                    {(Object.entries(preview.deferredRewards) as [keyof Resources, number][]).some(([, amount]) => amount > 0) && (
                      <li>
                        Conditional fulfillment reward: up to{' '}
                        {(Object.entries(preview.deferredRewards) as [keyof Resources, number][])
                          .filter(([, amount]) => amount > 0)
                          .map(([resource, amount]) => `${resourceName(resource)} +${amount}`)
                          .join(', ')} when this promise is first fulfilled. Actual gain depends on the resource cap at fulfillment.
                      </li>
                    )}
                    <li>Support gained: {preview.gainedSupport.map((id) => titleOf(session, id)).join(', ') || 'none'}</li>
                    <li>Support lost: {preview.lostSupport.map((id) => titleOf(session, id)).join(', ') || 'none'}</li>
                    <li>Incompatible promises or values: {preview.incompatiblePromises.map((id) => {
                      const incompatibleDemand = scenario.demandDefinitions.find((candidate) =>
                        id === candidate.id || id.startsWith(`${candidate.id}:`),
                      );
                      if (!incompatibleDemand) return id;
                      return `${incompatibleDemand.title} (${titleOf(session, incompatibleDemand.officeDefinitionId)})`;
                    }).join(', ') || 'none'}</li>
                    {preview.requiredWork && (
                      <li>
                        Required work: {Math.ceil(preview.requiredWork.durationMs / 1000)}s with{' '}
                        {preview.requiredWork.cardIds.map((id) => titleOf(session, state.cards.find((card) => card.id === id)?.definitionId ?? id)).join(', ')}.
                        {' '}Consumes {preview.requiredWork.consumedCardIds.map((id) => titleOf(session, state.cards.find((card) => card.id === id)?.definitionId ?? id)).join(', ') || 'nothing'}.
                        {' '}Confirmation commits these resources and the work cannot be cancelled.
                      </li>
                    )}
                    {preview.newObligations.map((obligation) => (
                      <li key={obligation.id}>
                        New obligation: {scenario.obligationDefinitions.find((definition) => definition.id === obligation.sourceId)?.title ?? obligation.sourceId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p role="status">Unavailable: {preview.message}</p>
                )}
                <button
                  type="button"
                  data-decision-choice
                  data-testid={`decision-resolve-${choice.action}`}
                  disabled={!preview.accepted}
                  onClick={() => {
                    const result = session.dispatch({
                      type: 'RESOLVE_DECISION',
                      decisionId: pending.id,
                      choiceId,
                      expectedBillRevision: pending.expectedBillRevision,
                    });
                    const rejection = result.events.find((event) => event.type === 'COMMAND_REJECTED');
                    if (rejection?.type === 'COMMAND_REJECTED') {
                      onResult?.(rejection.message);
                      return;
                    }
                    onOpenChange(false);
                    onResult?.(`${choice.label} recorded.`);
                  }}
                >
                  {choice.label}
                </button>
              </section>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
