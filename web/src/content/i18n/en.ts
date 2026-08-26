/**
 * One-line result phrases.
 *
 * The gate requires a player to understand a success or failure from the card
 * transformation, the motion and one short phrase — without opening an inspector
 * or the Sourcebook. These are those phrases.
 */
export const RESULT_PHRASES: Record<string, string> = {
  'result.summary.committee-credibility':
    'Your aide turned the official report into a summary a committee will take seriously.',
  'result.summary.district-relevance':
    'Your aide turned local survey answers into a summary that speaks for the district.',
  'result.provision.drafted': 'That summary is now bill language.',
  'result.provision.strengthened': 'The provision holds up better now.',
  'result.outreach.support': 'The office is on board, in this simulation.',
  'result.outreach.counteroffer':
    'The office will help — in this simulation — if you take their amendment.',
};

export const REJECTION_PHRASES: Record<string, string> = {
  'no-matching-pattern': 'Those two do not go together. Nothing was spent.',
  'insufficient-resources': 'Nobody in the office is free for that right now.',
  'card-busy': 'That work is still under way.',
  'card-expired': 'That one ran out of time.',
  'ineligible-staff': 'That is not the right staffer for this.',
  'tactic-already-active': 'Your office already learned that.',
};

export const STUDY_PHRASES = {
  started: 'Your aide is studying the Tactic.',
  completed: 'Rule changed. Check the Staff Handbook.',
};

export function resultPhrase(explanationKey: string): string {
  return RESULT_PHRASES[explanationKey] ?? 'Something new is on the desk.';
}

export function rejectionPhrase(reason: string, message?: string): string {
  // Naming the Tactic that would unblock a stack can only be worked out where the
  // rules live, so for that one reason the engine's sentence is the copy. Every
  // other refusal reads from the table above.
  if (reason === 'needs-tactic' && message) return message;
  return REJECTION_PHRASES[reason] ?? 'That did not work. Nothing was spent.';
}
