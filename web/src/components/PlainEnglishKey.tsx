'use client';

/**
 * What the words mean, always on screen.
 *
 * The design promises an interface a player can read "without requiring a civics
 * textbook or familiarity with legislative terminology". The card system uses real
 * congressional vocabulary on purpose — the point of the game is to leave players
 * more curious about how Congress works, and renaming everything to baby words would
 * throw that away.
 *
 * So: keep the real word, and put its meaning next to it, free, with no click.
 */

const FAMILIES: [string, string][] = [
  ['Staff', 'The people in your office who do the work.'],
  ['Policy', 'An idea that could go into your bill.'],
  ['Evidence', 'Facts or reports that back an idea up.'],
  ['Coalition', 'Other members of Congress, whose support your bill needs.'],
  ['Constituency', 'Groups of people back home that you represent.'],
  ['Institution', 'The machinery Congress works through — committees, the floor, the calendar.'],
  ['Political', 'News, attention and reputation.'],
  ['Tactic', 'A way of working your office can learn, which changes a rule.'],
];

const CLASSES: [string, string][] = [
  ['Official record', 'Real public information, from a real source.'],
  [
    'Based on records',
    'Someone worked this out or summarised it from real information. A summary, not a direct quote.',
  ],
  ['Simulated', 'Invented for your run. Not a claim about anyone real.'],
];

const BASE_METERS: [string, string][] = [
  ['Staff Attention', 'How many jobs your office can do at once. It comes back when a job ends.'],
  ['District Trust', 'How well the people back home think you are representing them.'],
  ['Bill Momentum', 'How much your bill is actually moving.'],
  ['Policy Integrity', 'How close your bill still is to what you promised.'],
  ['Staff Morale', 'How your staff are holding up.'],
];

function Glossary({ items, testId }: { items: [string, string][]; testId: string }) {
  return (
    <dl className="key__list" data-testid={testId}>
      {items.map(([word, meaning]) => (
        <div key={word} className="key__row">
          <dt>{word}</dt>
          <dd>{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PlainEnglishKey({ session = false }: { session?: boolean }) {
  const meters: [string, string][] = [
    BASE_METERS[0],
    ['Political Capital', session
      ? 'Goodwill you spend and can earn once from distinct commitments. A new week restores a floor of 1, up to the cap of 9.'
      : 'Favours and goodwill you can spend. Once spent, it is gone.'],
    ...BASE_METERS.slice(1),
  ];
  return (
    // Open by default. A meaning hidden behind a click is a meaning most players
    // never see.
    <details className="key" data-testid="key-panel" open>
      <summary className="key__summary">What the words mean</summary>

      <h3 className="key__heading">The colour band — what a card does</h3>
      <Glossary items={FAMILIES} testId="key-families" />

      <h3 className="key__heading">The small badge — where it came from</h3>
      <Glossary items={CLASSES} testId="key-classes" />

      <h3 className="key__heading">The numbers up top</h3>
      <Glossary items={meters} testId="key-meters" />
    </details>
  );
}
