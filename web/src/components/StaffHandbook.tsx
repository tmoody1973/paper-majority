'use client';

import type { HandbookEntry, HandbookState, HandbookView } from '@/domain/selectors';

/**
 * The Staff Handbook: an office training binder, not a spell book.
 *
 * Every state here is derived from `discoveredPatternIds` and
 * `unlockedSlotExpansions`. The label, the engine rule and the desk's valid-hover
 * cue always describe the same thing.
 */

const STATE_LABELS: Record<HandbookState, string> = {
  teased: 'Teased',
  discovered: 'Discovered',
  expanded: 'Expanded',
};

const STATE_BLURBS: Record<HandbookState, string> = {
  teased: 'Someone in the office has a hunch. Nobody has made it work yet.',
  discovered: 'Your office has done this. It works with any cards that fit.',
  expanded: 'A studied Tactic widened this rule. The original rule still works.',
};

function Silhouette() {
  return (
    <span className="handbook-silhouette" data-testid="handbook-silhouette" aria-hidden="true">
      <span className="handbook-silhouette__card" />
      <span className="handbook-silhouette__plus">+</span>
      <span className="handbook-silhouette__card" />
      <span className="handbook-silhouette__arrow">→</span>
      <span className="handbook-silhouette__card handbook-silhouette__card--unknown" />
    </span>
  );
}

function Entry({ entry }: { entry: HandbookEntry }) {
  const label = entry.remembered ? 'Remembered' : STATE_LABELS[entry.state];
  const blurb = entry.remembered
    ? 'Remembered from an earlier session. This explains the rule without changing this run.'
    : STATE_BLURBS[entry.state];
  return (
    <li className="handbook-entry" data-testid={`handbook-entry-${entry.patternId}`}>
      <p className="handbook-entry__state">
        <span className={`handbook-badge handbook-badge--${entry.state}`}>
          {label}
        </span>
        <span className="handbook-entry__blurb">{blurb}</span>
      </p>

      <p className="handbook-entry__hint">{entry.hint}</p>

      {entry.state === 'teased' ? (
        <p className="handbook-entry__unknown">
          <Silhouette />
          <span className="handbook-entry__unknown-text">
            Try it on the desk. A combination that does not work costs you nothing.
          </span>
        </p>
      ) : (
        <>
          <ol className="handbook-slots" data-testid="handbook-slots">
            {entry.slots?.map((slot, index) => (
              <li key={`${entry.patternId}-slot-${index}`} className="handbook-slot">
                <span className="handbook-slot__family">{slot.familyLabel}</span>
                {slot.requirements.length > 0 && (
                  <span className="handbook-slot__requirements">
                    {' '}
                    that is {slot.requirements.join(' and ')}
                  </span>
                )}
                {slot.addedByTactic.length > 0 && (
                  <span className="handbook-slot__added">
                    {' '}
                    — or now, {slot.addedByTactic.join(' or ')}
                  </span>
                )}
              </li>
            ))}
          </ol>

          {entry.outputTitle && (
            <p className="handbook-entry__output">
              Makes: <strong>{entry.outputTitle}</strong>
            </p>
          )}

          {entry.expansions.length > 0 && (
            <p className="handbook-entry__expansion" data-testid="handbook-expansion">
              <span className="handbook-entry__stamp">Rule changed</span>
              {entry.expansions.map((expansion) => (
                <span key={expansion.id}> {expansion.note}</span>
              ))}
            </p>
          )}

          {entry.successfulExamples.length > 0 && (
            <div className="handbook-entry__examples">
              <p className="handbook-entry__examples-title">Cards that have worked:</p>
              <ul>
                {entry.successfulExamples.map((example, index) => (
                  <li key={`${entry.patternId}-example-${index}`}>
                    {example.map((card) => card.title).join(' + ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export function StaffHandbook({ view }: { view: HandbookView }) {
  return (
    <section className="handbook" aria-label="Staff Handbook">
      <header className="handbook__header">
        <h2>Staff Handbook</h2>
        <p className="handbook__progress" data-testid="handbook-progress">
          {view.discoveredCount} of {view.totalCount} rules found
          {view.undiscoveredCount > 0 ? ` — ${view.undiscoveredCount} still to find` : ''}
        </p>

        {/* A Tactic is a way of working, not a recipe. Counted together, a binder
            with every recipe found read as finished while a Tactic was unlearned. */}
        {view.tacticsTotal > 0 && (
          <p className="handbook__progress" data-testid="handbook-tactics">
            {view.tacticsLearned} of {view.tacticsTotal} Tactics learned
          </p>
        )}
      </header>

      {view.tactics.length > 0 && (
        <ul className="handbook__tactics">
          {view.tactics.map((tactic) => (
            <li
              key={tactic.id}
              className={`handbook-tactic handbook-tactic--${tactic.learned ? 'learned' : 'unlearned'}`}
              data-testid={`handbook-tactic-${tactic.id}`}
            >
              <p className="handbook-tactic__title">
                <span className={`handbook-badge handbook-badge--${tactic.learned ? 'expanded' : 'teased'}`}>
                  {tactic.learned ? 'Learned' : 'Not yet studied'}
                </span>
                <strong>{tactic.title}</strong>
              </p>

              <p
                className="handbook-tactic__accepts"
                data-testid={`handbook-tactic-accepts-${tactic.id}`}
              >
                The {tactic.ruleLabel} rule currently works with:{' '}
                <strong>{tactic.currentlyAccepts.join(', ') || 'anything that fits'}</strong>
              </p>

              {tactic.wouldAdd.length > 0 && (
                <p className="handbook-tactic__would">
                  Studying it would also allow: <strong>{tactic.wouldAdd.join(', ')}</strong>. Stack
                  it with a {tactic.eligibleStaff.join(' or ')} staff card to study it.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <ul className="handbook__entries">
        {view.entries.map((entry) => (
          <Entry key={entry.patternId} entry={entry} />
        ))}
      </ul>
    </section>
  );
}
