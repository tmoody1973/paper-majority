'use client';

import { useState } from 'react';

import { previewWork, remainingWorkMs } from '@/domain/work';
import type { TermState } from '@/domain/types';
import type { GameSession } from '@/game/session';

export interface WorkMatProps {
  session: GameSession;
  state: TermState;
  selectedCardIds: string[];
  onSelectedCardIdsChange: (ids: string[]) => void;
  onResult?: (message: string) => void;
}

export function WorkMat({
  session,
  state,
  selectedCardIds,
  onSelectedCardIdsChange,
  onResult,
}: WorkMatProps) {
  const scenario = session.getScenario();
  const [candidateId, setCandidateId] = useState('');
  const selectedIds = [...selectedCardIds];
  const preview = previewWork(state, scenario, selectedIds);
  const available = state.cards.filter(
    (card) => card.location === 'desk' && card.status === 'idle' && !selectedIds.includes(card.id),
  );
  const titleOf = (cardId: string) => {
    const instance = state.cards.find((card) => card.id === cardId);
    const definition = scenario.cards.find((card) => card.id === instance?.definitionId);
    const form = instance && instance.form !== 'raw' ? ` — ${instance.form}` : '';
    return `${definition?.title ?? cardId}${form}`;
  };
  const availabilityOf = (cardId: string) => {
    const card = state.cards.find((candidate) => candidate.id === cardId);
    if (!card) return 'unavailable';
    if (card.location !== 'desk') return card.location;
    return card.status === 'idle' ? undefined : card.status;
  };
  const resourceLabel = (resource: string) => resource.replace(/([A-Z])/g, ' $1').toLowerCase();
  const resultLabel = () => {
    if (!preview.accepted) return '';
    const output = preview.output;
    if (output.kind === 'office-decision') {
      const office = scenario.cards.find((card) => card.id === output.officeDefinitionId);
      return `Office decision — ${office?.title ?? output.officeDefinitionId}`;
    }
    const definition = scenario.cards.find((card) => card.id === output.definitionId);
    const title = definition?.title ?? output.definitionId;
    return `${title}${output.form && output.form !== 'raw' ? ` — ${output.form}` : ''}`;

  };

  const stage = (cardId: string) => {
    if (!cardId || selectedIds.includes(cardId) || selectedIds.length >= 4) return;
    onSelectedCardIdsChange([...selectedIds, cardId]);
    setCandidateId('');
  };

  return (
    <section className="work-mat" aria-label="Work Mat">
      <h2>Work Mat</h2>
      <p className="work-mat__help">Stage 2–4 cards. Nothing is reserved until you choose Begin Work.</p>

      <div className="work-mat__picker">
        <label>
          <span>Desk card</span>
          <select
            data-testid="work-mat-picker"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
          >
            <option value="">Choose a card</option>
            {available.map((card) => <option key={card.id} value={card.id}>{titleOf(card.id)}</option>)}
          </select>
        </label>
        <button
          type="button"
          data-testid="work-mat-stage"
          disabled={!candidateId || selectedIds.length >= 4}
          onClick={() => stage(candidateId)}
        >
          Stage card
        </button>
      </div>

      <ul className="work-mat__cards" aria-label="Staged cards">
        {selectedIds.map((id) => (
          <li key={id} data-testid={`work-mat-ghost-${id}`}>
            <span>{titleOf(id)}{availabilityOf(id) ? ` — ${availabilityOf(id)}` : ''}</span>
            <button
              type="button"
              aria-label={`Remove ${titleOf(id)}`}
              onClick={() => onSelectedCardIdsChange(selectedIds.filter((cardId) => cardId !== id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <p className={`work-mat__preview ${preview.accepted ? 'work-mat__preview--ready' : ''}`} aria-live="polite" data-testid="work-mat-preview">
        {preview.accepted
          ? `Ready: ${resultLabel()} in ${Math.ceil(preview.durationMs / 1000)}s. Cost: ${
              (Object.entries(preview.cost) as [string, number][])
                .filter(([, amount]) => amount > 0)
                .map(([resource, amount]) => `${amount} ${resourceLabel(resource)}`)
                .join(', ') || 'none'
            }. Assigned: ${preview.staffCardIds.map(titleOf).join(', ') || 'none'}. Consumes: ${preview.consumedCardIds.map(titleOf).join(', ') || 'none'}. Returns: ${preview.returnedCardIds.map(titleOf).join(', ') || 'none'}.`
          : preview.reason}
      </p>
      <button
        type="button"
        data-testid="work-mat-begin"
        disabled={!preview.accepted}
        onClick={() => {
          const result = session.dispatch({ type: 'SUBMIT_WORK', cardIds: selectedIds });
          const rejection = result.events.find((event) => event.type === 'COMMAND_REJECTED');
          if (rejection?.type === 'COMMAND_REJECTED') {
            onResult?.(rejection.message);
            return;
          }
          onSelectedCardIdsChange([]);
          onResult?.('Work begun.');
        }}
      >
        Begin Work
      </button>

      {state.activeWork.length > 0 && (
        <ul className="work-mat__active" aria-label="Active work">
          {state.activeWork.map((work) => (
            <li key={work.id} data-testid={`work-mat-active-${work.id}`}>
              <span>{work.kind === 'study'
                ? 'Studying tactic'
                : work.decisionOrigin ? 'Counteroffer in progress' : 'Work in progress'} · {Math.ceil(remainingWorkMs(state, work.cardIds[0]) / 1000)}s</span>
              <button
                type="button"
                data-testid={`work-mat-cancel-${work.id}`}
                disabled={Boolean(work.decisionOrigin)}
                onClick={() => {
                  if (work.decisionOrigin) return;
                  const card = state.cards.find((candidate) => candidate.id === work.cardIds[0]);
                  if (!card) return;
                  const result = session.dispatch({ type: 'SEPARATE_STACK', stackId: card.stackId, cardId: card.id, x: card.x, y: card.y });
                  const rejection = result.events.find((event) => event.type === 'COMMAND_REJECTED');
                  onResult?.(rejection?.type === 'COMMAND_REJECTED'
                    ? rejection.message
                    : 'Work cancelled. Staff attention returned.');
                }}
              >
                {work.decisionOrigin ? 'Confirmed — cannot cancel' : 'Cancel'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
