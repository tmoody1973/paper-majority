'use client';

import { useState } from 'react';

import { DEFAULT_RUN_SETTINGS } from '@/domain/initialState';
import type { GoverningValue, Party, RunSettings, ScenarioDefinition } from '@/domain/types';

const VALUES: GoverningValue[] = [
  'Fiscal Stewardship', 'Local Control', 'Market Competition', 'Public Investment',
  'Tenant Stability', 'Housing Supply', 'Environmental Resilience', 'Fair Access',
];

export interface SessionSetupChoice {
  districtId: string;
  party: Party;
  values: [GoverningValue, GoverningValue];
  seed: number;
  settings: RunSettings;
}

export function SessionSetup({
  scenario,
  canResume,
  recoveryMessage,
  preservedSaveBytes,
  onResume,
  onStart,
}: {
  scenario: ScenarioDefinition;
  canResume: boolean;
  recoveryMessage?: string;
  preservedSaveBytes?: string;
  onResume: () => void;
  onStart: (choice: SessionSetupChoice) => void;
}) {
  const [districtId, setDistrictId] = useState(scenario.districts[0]?.id ?? '');
  const [party, setParty] = useState<Party>('democratic');
  const [firstValue, setFirstValue] = useState<GoverningValue>('Housing Supply');
  const [secondValue, setSecondValue] = useState<GoverningValue>('Tenant Stability');
  const [seed, setSeed] = useState(20260905);
  const [pace, setPace] = useState<RunSettings['pace']>('standard');
  const [guidance, setGuidance] = useState<RunSettings['guidance']>('standard');
  const [termStyle, setTermStyle] = useState<RunSettings['termStyle']>('regular-order');
  const distinct = firstValue !== secondValue;
  const exportHref = preservedSaveBytes
    ? `data:application/json;charset=utf-8,${encodeURIComponent(preservedSaveBytes)}`
    : undefined;

  return (
    <main className="session-setup" aria-labelledby="session-setup-title">
      <section className="session-setup__panel">
        <p className="session-setup__eyebrow">Paper Majority · Housing Session</p>
        <h1 id="session-setup-title">Build a six-week housing package</h1>
        <p>Prepare at least two distinct provisions, earn commitments from two offices, and meet every mandatory deadline.</p>
        {scenario.contentStatus?.status === 'candidate' && (
          <p className="shell__save-warning" role="status">{scenario.contentStatus.notice}</p>
        )}
        {recoveryMessage && <p className="shell__save-warning" role="status">{recoveryMessage}</p>}
        {canResume && (
          <div className="session-setup__resume">
            <button type="button" data-testid="session-resume" onClick={onResume}>Resume saved Session</button>
            <span>Your saved run will open paused.</span>
          </div>
        )}
        {exportHref && (
          <a href={exportHref} download="paper-majority-preserved-save.json" data-testid="export-preserved-save">
            Export preserved checkpoint
          </a>
        )}

        <form onSubmit={(event) => {
          event.preventDefault();
          if (!distinct) return;
          onStart({
            districtId,
            party,
            values: [firstValue, secondValue],
            seed,
            settings: { ...DEFAULT_RUN_SETTINGS, pace, guidance, termStyle },
          });
        }}>
          <label>District
            <select data-testid="session-district" value={districtId} onChange={(event) => setDistrictId(event.target.value)}>
              {scenario.districts.map((district) => <option key={district.id} value={district.id}>{district.title} ({district.id})</option>)}
            </select>
          </label>
          <label>Party
            <select value={party} onChange={(event) => setParty(event.target.value as Party)}>
              <option value="democratic">Democratic</option>
              <option value="republican">Republican</option>
            </select>
          </label>
          <label>First governing value
            <select value={firstValue} onChange={(event) => setFirstValue(event.target.value as GoverningValue)}>
              {VALUES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>Second governing value
            <select value={secondValue} onChange={(event) => setSecondValue(event.target.value as GoverningValue)}>
              {VALUES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          {!distinct && <p role="alert">Choose two distinct governing values.</p>}
          <label>Seed
            <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
          </label>
          <label>Pace
            <select value={pace} onChange={(event) => setPace(event.target.value as RunSettings['pace'])}>
              <option value="relaxed">Relaxed · 150 seconds</option>
              <option value="standard">Standard · 105 seconds</option>
              <option value="brisk">Brisk · 75 seconds</option>
            </select>
          </label>
          <label>Guidance
            <select value={guidance} onChange={(event) => setGuidance(event.target.value as RunSettings['guidance'])}>
              <option value="guided">Guided</option><option value="standard">Standard</option><option value="expert">Expert</option>
            </select>
          </label>
          <label>Session style
            <select value={termStyle} onChange={(event) => setTermStyle(event.target.value as RunSettings['termStyle'])}>
              <option value="regular-order">Regular order</option><option value="district-pulse">District pulse</option><option value="breaking-cycle">Breaking cycle</option>
            </select>
          </label>
          <label>Mode
            <select value="session" disabled><option value="session">Session · six weeks</option><option value="term">Term · unavailable</option></select>
          </label>
          <button type="submit" data-testid="session-start-new" disabled={!distinct || !districtId}>Start new Session</button>
        </form>
      </section>
    </main>
  );
}
