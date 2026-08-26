'use client';

import type { CardDetail } from '@/domain/cardDetail';

/**
 * The explanation surface.
 *
 * The card face does recognition; this does explanation. It says what a card is and
 * where its content comes from — and it lists a use only when the player has already
 * discovered that rule, so it can never become a recipe book.
 */
export function CardInspector({
  detail,
  onClose,
}: {
  detail: CardDetail;
  onClose: () => void;
}) {
  const sourceKey = detail.sourceLabel.toLowerCase().split(' ')[0];

  return (
    <section className="inspector" aria-label={`About ${detail.title}`}>
      <header className="inspector__header">
        <div>
          <h2 className="inspector__title">{detail.title}</h2>
          <p className="inspector__meta">
            <span className="inspector__family">{detail.familyLabel}</span>
            <span className={`inspector__source inspector__source--${sourceKey}`}>
              {detail.sourceLabel}
            </span>
          </p>
        </div>
        <button type="button" onClick={onClose} data-testid="inspector-close" aria-label="Close">
          ×
        </button>
      </header>

      <p className="inspector__explainer" data-testid="inspector-source-explainer">
        {detail.sourceExplainer}
      </p>

      {/* Sits directly under the explainer on purpose: it qualifies the sentence
          above it, and a tester who reads "real public information" must not get
          to the end of the card believing it is sourced. */}
      {detail.practicePlaceholderNote && (
        <p className="inspector__note inspector__note--practice" data-testid="inspector-practice">
          {detail.practicePlaceholderNote}
        </p>
      )}

      {detail.plainLanguage && (
        <p className="inspector__plain" data-testid="inspector-plain">
          {detail.plainLanguage}
        </p>
      )}

      {detail.simulatedNote && (
        <p className="inspector__note inspector__note--simulated" data-testid="inspector-simulated">
          {detail.simulatedNote}
        </p>
      )}

      <div className="inspector__uses" data-testid="inspector-uses">
        <h3>What your office can do with it</h3>
        {detail.knownUses.length > 0 ? (
          <ul>
            {detail.knownUses.map((use) => (
              <li key={use}>{use}</li>
            ))}
          </ul>
        ) : (
          <p className="inspector__note">{detail.noUsesYetNote}</p>
        )}
      </div>

      {/* The long form, because this is where there is room to say which kind of
          cost it is. A staffer comes back; political capital does not. */}
      {detail.costs.map((cost) => (
        <p className="inspector__cost" key={cost.short} data-testid="inspector-cost">
          {cost.long}
        </p>
      ))}
    </section>
  );
}
