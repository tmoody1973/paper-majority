'use client';

import { useEffect, useRef } from 'react';

import type { TermState } from '@/domain/types';
import type { GameSession } from '@/game/session';

export function StoryDecisionModal({ session, state, onResult }: {
  session: GameSession;
  state: TermState;
  onResult?: (message: string) => void;
}) {
  const pending = state.pendingStoryDecisions.find((decision) => decision.status === 'pending');
  const event = pending && session.getScenario().storyEvents.find((entry) => entry.id === pending.storyEventId);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !pending) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLElement>('button')?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [pending]);

  if (!pending || !event) return null;
  return (
    <dialog ref={dialogRef} className="decision-modal" aria-labelledby="story-decision-title" data-testid="story-decision-modal">
      <div className="decision-modal__paper">
        <header>
          <div>
            <span className="decision-modal__badge">Simulated Story event</span>
            <h2 id="story-decision-title">{event.title}</h2>
          </div>
        </header>
        <p>{event.body}</p>
        <p>Why now: {event.whyRules.join(' ')}</p>
        <div className="decision-modal__choices">
          {event.choices.map((choice) => (
            <section key={choice.id} className="decision-modal__choice">
              <h3>{choice.label}</h3>
              <p>
                Cost: {Object.entries(choice.cost).map(([key, value]) => `${key} ${value}`).join(', ') || 'none'}.
                {' '}Effect: {Object.entries(choice.effects).map(([key, value]) => `${key} ${Number(value) >= 0 ? '+' : ''}${value}`).join(', ') || 'none'}.
              </p>
              <button
                type="button"
                onClick={() => {
                  const result = session.dispatch({ type: 'RESOLVE_STORY', decisionId: pending.id, choiceId: choice.id });
                  const rejection = result.events.find((entry) => entry.type === 'COMMAND_REJECTED');
                  onResult?.(rejection?.type === 'COMMAND_REJECTED' ? rejection.message : `${choice.label} recorded.`);
                }}
              >
                {choice.label}
              </button>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
