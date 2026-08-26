'use client';

import { useState } from 'react';

import { describeStudyOption } from '@/domain/selectors';
import type { TermState } from '@/domain/types';
import type { GameSession } from '@/game/session';

/**
 * The keyboard equivalent of every drag action.
 *
 * Dragging a card onto another is `card-work`; pulling one out of a stack is
 * `SEPARATE_STACK`; studying a Tactic is `study-tactic`. All three dispatch the same
 * commands the desk does, so the two input paths can never diverge.
 */
export function AccessibleCardControls({
  session,
  state,
  onInspect,
}: {
  session: GameSession;
  state: TermState;
  /** Keyboard equivalent of hovering a card: choosing one explains it. */
  onInspect?: (cardId: string) => void;
}) {
  const scenario = session.getScenario();
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');

  const definitionOf = (definitionId: string) =>
    scenario.cards.find((card) => card.id === definitionId);

  const titleOf = (definitionId: string) => {
    const definition = definitionOf(definitionId);
    if (!definition) return definitionId;
    // Party is part of a member office's identity, so it belongs in the spoken name.
    const party = definition.officeParty
      ? ` (${definition.officeParty === 'democratic' ? 'Democratic' : 'Republican'})`
      : '';
    return `${definition.title}${party}`;
  };

  const label = (cardId: string) => {
    const card = state.cards.find((candidate) => candidate.id === cardId);
    if (!card) return cardId;
    const status =
      card.status === 'working'
        ? ' — working'
        : card.status === 'expired'
          ? ' — missed'
          : card.remainingMs > 0
            ? ` — due in ${Math.ceil(card.remainingMs / 1000)}s`
            : '';
    return `${titleOf(card.definitionId)}${status}`;
  };

  const stackIdOf = (cardId: string) =>
    state.cards.find((card) => card.id === cardId)?.stackId ?? '';

  // "Wrong staffer" tells a player they were wrong without telling them what right
  // looks like. This says who can study the Tactic and who is free to do it.
  const study =
    sourceId && targetId
      ? describeStudyOption(state, scenario, sourceId, targetId)
      : { isTactic: false, canStudy: false };

  return (
    <section className="controls" aria-label="Keyboard card controls">
      <h2>Move cards without the mouse</h2>

      <label className="controls__field">
        <span>Card</span>
        <select
          data-testid="controls-source"
          value={sourceId}
          onChange={(event) => {
            setSourceId(event.target.value);
            if (event.target.value) onInspect?.(event.target.value);
          }}
        >
          <option value="">Choose a card</option>
          {state.cards.map((card) => (
            <option key={card.id} value={card.id}>
              {label(card.id)}
            </option>
          ))}
        </select>
      </label>

      <label className="controls__field">
        <span>Put it with</span>
        <select
          data-testid="controls-target"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="">Choose a card</option>
          {state.cards
            .filter((card) => card.id !== sourceId)
            .map((card) => (
              <option key={card.id} value={card.id}>
                {label(card.id)}
              </option>
            ))}
        </select>
      </label>

      <div className="controls__buttons">
        <button
          type="button"
          data-testid="controls-combine"
          disabled={!sourceId || !targetId}
          onClick={() =>
            session.dispatch({
              type: 'START_ASSIGNMENT',
              assignmentKind: 'card-work',
              staffCardId: sourceId,
              targetCardId: targetId,
            })
          }
        >
          Put together
        </button>

        <button
          type="button"
          data-testid="controls-study"
          disabled={!study.canStudy}
          onClick={() =>
            session.dispatch({
              type: 'START_ASSIGNMENT',
              assignmentKind: 'study-tactic',
              staffCardId: sourceId,
              targetCardId: targetId,
            })
          }
        >
          Study Tactic
        </button>

        <button
          type="button"
          data-testid="controls-separate"
          disabled={!sourceId}
          onClick={() =>
            session.dispatch({
              type: 'SEPARATE_STACK',
              stackId: stackIdOf(sourceId),
              cardId: sourceId,
              x: 200,
              y: 760,
            })
          }
        >
          Take it back out
        </button>
      </div>

      {study.isTactic && study.blockedReason && (
        <p className="controls__note controls__note--study" data-testid="controls-study-note">
          {study.blockedReason}
        </p>
      )}

      <p className="controls__note">
        A combination that does not work costs you nothing. Try things.
      </p>
    </section>
  );
}
