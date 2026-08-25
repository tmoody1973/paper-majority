'use client';

import type { ScenarioDefinition, TermState } from '@/domain/types';

/**
 * Who the player is, in four lines.
 *
 * Without this the desk opens with no story at all, and "same party" — the rule the
 * whole spike turns on — has nothing to be relative to.
 *
 * Everything here is invented for the run and labelled as such. The spike's district
 * is fictional, so nothing in this panel may look like a sourced civic fact.
 */
export function OfficeBrief({
  state,
  scenario,
}: {
  state: TermState;
  scenario: ScenarioDefinition;
}) {
  const partyWord = state.player.party === 'democratic' ? 'Democratic' : 'Republican';
  const otherWord = state.player.party === 'democratic' ? 'Republican' : 'Democratic';
  const district = scenario.districts.find((entry) => entry.id === state.player.districtId);

  return (
    <section className="brief" aria-label="Your office">
      <header className="brief__header">
        <h2>Your office</h2>
        <span className="brief__source" data-testid="brief-source">
          ✦ Simulated
        </span>
      </header>

      <p className="brief__line">
        You are a <strong>freshman member of the House</strong>. This is your first term.
      </p>

      <p className="brief__line" data-testid="brief-party">
        You were elected as a <strong>{partyWord}</strong>. Offices that share your party are
        easier to approach; a <strong>{otherWord}</strong> office is from the other party, and
        needs a different approach.
      </p>

      <p className="brief__line" data-testid="brief-district">
        You represent <strong>{district?.title ?? state.player.districtId}</strong> — a
        fictional district invented for this practice run. No real place or person is
        represented here.
      </p>

      <p className="brief__line" data-testid="brief-values">
        You ran on two promises:{' '}
        <strong>{state.player.values[0]}</strong> and <strong>{state.player.values[1]}</strong>.
      </p>

      <p className="brief__goal" data-testid="brief-goal">
        Your job: build a <strong>housing bill</strong> and win enough support to move it —
        before your staff, your time and your district&rsquo;s patience run out.
      </p>
    </section>
  );
}
