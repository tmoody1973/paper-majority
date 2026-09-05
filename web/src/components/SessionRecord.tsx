'use client';

import type { SessionRecord as SessionRecordValue } from '@/domain/types';

function conditionLabel(condition: SessionRecordValue['promises'][number]['conditions'][number]): string {
  if (condition.kind === 'governing-value') return `governing value: ${condition.value}`;
  if (condition.kind === 'prepared-evidence-tag') return `prepared evidence: ${condition.tag}`;
  return `bill includes: ${condition.tag}`;
}

export function SessionRecord({ record, onRestart, preservedSaveBytes }: {
  record: SessionRecordValue;
  onRestart?: () => void;
  preservedSaveBytes?: string;
}) {
  const recordHref = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(record, null, 2))}`;
  const priorHref = preservedSaveBytes
    ? `data:application/json;charset=utf-8,${encodeURIComponent(preservedSaveBytes)}`
    : undefined;
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
      <div className="session-record__actions">
        <a href={recordHref} download={`paper-majority-${record.id.replaceAll(':', '-')}.json`} data-testid="session-record-export">Export this record</a>
        {priorHref && <a href={priorHref} download="paper-majority-preserved-save.json">Export prior checkpoint</a>}
        {onRestart && <button type="button" data-testid="session-restart" onClick={onRestart}>Set up another Session</button>}
      </div>
    </section>
  );
}
