'use client';

import type { ScenarioDefinition, SourceClass } from '@/domain/types';

const LABELS: Record<SourceClass, string> = {
  official: 'Official public source',
  derived: 'Derived context',
  simulated: 'Simulated for play',
};

export function Sourcebook({ scenario }: { scenario: ScenarioDefinition }) {
  const sourced = [
    ...scenario.districts.map((district) => ({ id: district.id, title: district.title, sourceClass: 'official' as const, citations: district.citations, note: district.uncertaintyNote })),
    ...scenario.cards.map((card) => ({ id: card.id, title: card.title, sourceClass: card.sourceClass, citations: card.citations, note: card.plainLanguage })),
  ];
  return (
    <section className="sourcebook" aria-label="Sourcebook">
      <h2>Sourcebook</h2>
      <p>Official records identify programs, offices, committees, and public datasets. Player priorities, demand timing, support, and outcomes are simulations.</p>
      {scenario.contentStatus && <p><strong>Catalog status:</strong> {scenario.contentStatus.notice}</p>}
      <ul>
        {sourced.map((entry) => (
          <li key={entry.id} data-testid={`sourcebook-${entry.id}`}>
            <strong>{entry.title}</strong> · <span>{LABELS[entry.sourceClass]}</span>
            {entry.note && <p>{entry.note}</p>}
            {entry.citations.length > 0 ? (
              <ul>{entry.citations.map((citation) => <li key={citation.url}><a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a> · retrieved {citation.retrievedAt}</li>)}</ul>
            ) : <p>No public-source claim is attached to this simulated item.</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
