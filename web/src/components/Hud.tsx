'use client';

import type { Resources, TermState } from '@/domain/types';

const RESOURCE_LABELS: { key: keyof Resources; label: string; max?: number }[] = [
  { key: 'staffAttention', label: 'Staff Attention' },
  { key: 'politicalCapital', label: 'Political Capital' },
  { key: 'districtTrust', label: 'District Trust', max: 100 },
  { key: 'billMomentum', label: 'Bill Momentum', max: 100 },
  { key: 'policyIntegrity', label: 'Policy Integrity', max: 100 },
  { key: 'staffMorale', label: 'Staff Morale', max: 100 },
];

export interface HudProps {
  state: TermState;
  lastResult?: string;
  onTogglePause: () => void;
  onToggleHandbook: () => void;
  handbookOpen: boolean;
  onToggleReducedMotion: () => void;
}

export function Hud({
  state,
  lastResult,
  onTogglePause,
  onToggleHandbook,
  handbookOpen,
  onToggleReducedMotion,
}: HudProps) {
  const workIsFrozen = state.paused && state.cards.some((card) => card.status === 'working');
  const pausedNudge = workIsFrozen ? 'Paused — press Resume to let the work happen.' : undefined;

  return (
    <header className="hud" aria-label="Office status">
      <div className="hud__row">
        <p className="hud__week">
          <span className="hud__week-label">Legislative week</span>
          <strong>{state.week}</strong>
        </p>

        <ul className="hud__resources">
          {RESOURCE_LABELS.map(({ key, label, max }) => (
            <li key={key} className="hud__resource" data-testid={`hud-${key}`}>
              <span className="hud__resource-label">{label}</span>
              <span className="hud__resource-value">
                {state.resources[key]}
                {max ? <span className="hud__resource-max">/{max}</span> : null}
              </span>
            </li>
          ))}
        </ul>

        <div className="hud__controls">
          <button type="button" onClick={onTogglePause} data-testid="hud-pause">
            {state.paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={onToggleHandbook}
            data-testid="hud-handbook"
            aria-expanded={handbookOpen}
          >
            {handbookOpen ? 'Close Handbook' : 'Staff Handbook'}
          </button>
          <button
            type="button"
            onClick={onToggleReducedMotion}
            data-testid="hud-reduced-motion"
            aria-pressed={state.settings.reducedMotion}
          >
            Reduced motion: {state.settings.reducedMotion ? 'on' : 'off'}
          </button>
        </div>
      </div>

      {/* The one-line result phrase. Announced politely so a screen-reader user
          learns the outcome without movement.

          A paused desk still accepts stacking, so a player can start a job and watch
          its progress bar sit still forever. When that happens, say so here — it
          outranks whatever the last result was. */}
      <p className="hud__result" data-testid="hud-result" role="status" aria-live="polite">
        {pausedNudge ? (
          <span className="hud__result--nudge" data-testid="hud-paused-nudge">
            {pausedNudge}
          </span>
        ) : (
          (lastResult ?? '')
        )}
      </p>
    </header>
  );
}
