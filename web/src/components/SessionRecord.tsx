'use client';

import { useState } from 'react';

import type { ScenarioDefinition, SessionRecord as SessionRecordValue } from '@/domain/types';
import { challengeSetupFromRecord, encodeChallenge } from '@/persistence/challengeCode';

function conditionLabel(condition: SessionRecordValue['promises'][number]['conditions'][number]): string {
  if (condition.kind === 'governing-value') return `governing value: ${condition.value}`;
  if (condition.kind === 'delivered-preparation') return `delivered preparation: ${condition.tag}${condition.requiresReviewedProvision ? ' with reviewed language' : ''}`;
  if (condition.kind === 'prepared-evidence-tag') return `prepared evidence: ${condition.tag}`;
  return `bill includes: ${condition.tag}`;
}

export function SessionRecord({ record, scenario, nextExperiments = [], onRestart, preservedSaveBytes, currentSaveBytes }: {
  record: SessionRecordValue;
  scenario: ScenarioDefinition;
  nextExperiments?: readonly string[];
  onRestart?: () => void;
  preservedSaveBytes?: string;
  currentSaveBytes?: string;
}) {
  const [copyNotice, setCopyNotice] = useState<string>();
  const recordText = JSON.stringify(record, null, 2);
  const recordHref = `data:application/json;charset=utf-8,${encodeURIComponent(recordText)}`;
  const priorHref = preservedSaveBytes
    ? `data:application/json;charset=utf-8,${encodeURIComponent(preservedSaveBytes)}`
    : undefined;
  const currentHref = currentSaveBytes
    ? `data:application/json;charset=utf-8,${encodeURIComponent(currentSaveBytes)}`
    : undefined;
  const copy = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(success);
    } catch {
      setCopyNotice('The text could not be copied. Browser clipboard access may be unavailable.');
    }
  };
  const challengeCode = encodeChallenge(challengeSetupFromRecord(record, scenario));
  return (
    <section className="session-record" aria-label="Session record" data-testid="session-record">
      <p className="session-record__eyebrow">Immutable Session record</p>
      <h1>{record.outcome === 'ready' ? 'Ready to move forward' : 'Not ready yet'}</h1>
      <p>This is a readiness assessment based on the six-week simulation. It is not a vote prediction.</p>
      <dl>
        <div><dt>Provisions</dt><dd>{record.objective.provisionCount} of {record.objective.requiredProvisionCount}</dd></div>
        <div><dt>Committed offices</dt><dd>{record.objective.committedOfficeCount} of {record.objective.requiredCommittedOfficeCount}</dd></div>
        <div><dt>Overdue mandatory commitments</dt><dd>{record.gaps.overdueMandatoryIds.length}</dd></div>
        <div><dt>Policy Integrity</dt><dd>{record.integrity.finalScore}/100</dd></div>
      </dl>
      {record.outcome === 'not-ready' && (
        <p data-testid="session-record-gaps">Still needed: {record.gaps.provisionGap} provision(s), {record.gaps.supportGap} office commitment(s){record.gaps.overdueMandatoryIds.length ? `, and ${record.gaps.overdueMandatoryIds.length} overdue mandatory commitment(s)` : ''}.</p>
      )}
      <h2>Bill and commitments</h2>
      <ul>{record.bill.provisionReceipts.map((receipt) => <li key={`${receipt.provisionId}:${receipt.docketedAtRevision}`}>{receipt.plainLanguage}</li>)}</ul>
      <h3>Coalition promises</h3>
      {record.promises.length > 0 ? <ul>{record.promises.map((promise) => (
        <li key={promise.occurrenceId}>
          {promise.officeDefinitionId}: {promise.status}
          {promise.conditions.length > 0 ? ` · ${promise.conditions.map(conditionLabel).join(', ')}` : ''}
        </li>
      ))}</ul> : <p>No coalition promises were recorded.</p>}
      <h3>Deadlines and obligations</h3>
      {record.obligations.length > 0 ? <ul>{record.obligations.map((obligation) => (
        <li key={obligation.id}>
          {obligation.sourceId}: {obligation.status} · Week {obligation.due.week}, {Math.ceil(obligation.due.offsetMs / 1_000)}s · {obligation.mandatory ? 'mandatory' : 'optional'}
        </li>
      ))}</ul> : <p>No obligations were recorded.</p>}
      <h3>Declined opportunities</h3>
      {record.declinedOpportunities.length > 0
        ? <ul>{record.declinedOpportunities.map((decline) => <li key={decline.occurrenceId}>{decline.sourceId}</li>)}</ul>
        : <p>No optional opportunities were declined.</p>}
      <h3>Policy Integrity changes</h3>
      {record.integrity.contributions.length > 0 ? <ul>{record.integrity.contributions.map((contribution) => (
        <li key={contribution.id}>{contribution.reason}: {contribution.appliedDelta > 0 ? '+' : ''}{contribution.appliedDelta}</li>
      ))}</ul> : <p>No Policy Integrity changes were applied.</p>}
      <p>{record.integrity.explanation}</p>
      <h2>Possible next experiments</h2>
      <p>These ideas come from this ending&apos;s recorded gaps and unused available tools. They do not guarantee a different outcome.</p>
      {nextExperiments.length > 0
        ? <ul data-testid="session-next-experiments">{nextExperiments.map((experiment) => <li key={experiment}>{experiment}</li>)}</ul>
        : <p data-testid="session-next-experiments">No unused available Tactic or readiness gap was recorded.</p>}
      <div className="session-record__actions">
        <button type="button" data-testid="session-copy-challenge" onClick={() => void copy(challengeCode, 'Challenge copied locally. It shares the frozen setup only, not an authenticated score.')}>Copy Challenge</button>
        <button type="button" data-testid="session-copy-record" onClick={() => void copy(recordText, 'Record copied locally. It is a record of this ending, not an authenticated score.')}>Copy Record</button>
        <a href={recordHref} download={`paper-majority-${record.id.replaceAll(':', '-')}.json`} data-testid="session-record-export">Export this record</a>
        {priorHref && <a href={priorHref} download="paper-majority-preserved-save.json" data-testid="session-prior-save-export">Export prior replaced checkpoint</a>}
        {currentHref && <a href={currentHref} download="paper-majority-current-save.json" data-testid="session-current-save-export">Export current checkpoint</a>}
        {onRestart && <button type="button" data-testid="session-restart" onClick={onRestart}>Set up another Session</button>}
      </div>
      <p>A challenge shares the frozen setup. A record shares the recorded ending. Neither is proof of an authenticated score, and neither is uploaded.</p>
      {copyNotice && <p role="status" data-testid="session-copy-notice">{copyNotice}</p>}
    </section>
  );
}
