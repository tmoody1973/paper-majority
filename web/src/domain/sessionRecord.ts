import { sessionReadiness } from '@/domain/objectives';
import type {
  GameEvent,
} from '@/domain/events';
import type { ScenarioDefinition, SessionRecord, TermState } from '@/domain/types';

function eventIdentity(event: GameEvent, index: number): string {
  if ('occurrenceId' in event && typeof event.occurrenceId === 'string') {
    return `${event.type}:${event.occurrenceId}:${index + 1}`;
  }
  if ('obligationId' in event && typeof event.obligationId === 'string') {
    return `${event.type}:${event.obligationId}:${index + 1}`;
  }
  if (event.type === 'WEEK_RESOLVED') return `${event.type}:week:${event.week}:${index + 1}`;
  if (event.type === 'RESOURCE_CHANGED') return `${event.type}:${event.reason}:${index + 1}`;
  return `${event.type}:${index + 1}`;
}

const CAUSE_TYPES = new Set<GameEvent['type']>([
  'PROVISION_DOCKETED', 'PROVISION_NEGOTIATED', 'DECISION_RESOLVED', 'STORY_DECISION_RESOLVED',
  'PROMISE_CHANGED', 'OPPORTUNITY_DECLINED', 'OBLIGATION_STATUS_CHANGED', 'RESOURCE_CHANGED',
  'WEEK_RESOLVED', 'READINESS_MILESTONE_REWARDED',
]);

/** Build a detached, serializable explanation of the run's actual state and causes. */
export function buildSessionRecord(state: TermState, scenario: ScenarioDefinition): SessionRecord {
  void scenario;
  const readiness = sessionReadiness(state);
  const promiseEvents = state.eventLog.filter((event) => event.type === 'PROMISE_CHANGED');
  const promises = state.relationships.flatMap((relationship) =>
    relationship.promiseOccurrenceIds.map((occurrenceId) => {
      const status = [...promiseEvents].reverse().find((event) => event.promiseOccurrenceId === occurrenceId)?.status
        ?? (relationship.support === 'committed' ? 'fulfilled' : 'open');
      return {
        occurrenceId,
        officeDefinitionId: relationship.memberId,
        status,
        conditions: structuredClone(relationship.conditions),
      };
    }),
  ).sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId));
  const declinedOpportunities = state.eventLog.flatMap((event) => event.type === 'OPPORTUNITY_DECLINED'
    ? [{ occurrenceId: event.occurrenceId, sourceId: event.sourceId }]
    : []);
  const integrityContributions = state.eventLog.flatMap((event, index) =>
    event.type === 'RESOURCE_CHANGED' && (event.changes.policyIntegrity ?? 0) !== 0
      ? [{ id: eventIdentity(event, index), reason: event.reason, appliedDelta: event.changes.policyIntegrity! }]
      : [],
  );

  return structuredClone({
    id: `session:${state.snapshotId}:${state.seed}:${state.simulationMs}`,
    outcome: readiness.ready ? 'ready' : 'not-ready',
    completedAtSimulationMs: state.simulationMs,
    setup: {
      snapshotId: state.snapshotId,
      seed: state.seed,
      districtId: state.player.districtId,
      party: state.player.party,
      values: [state.player.values[0], state.player.values[1]],
      settings: { ...state.settings },
    },
    objective: {
      provisionCount: new Set(state.bill.provisionIds).size,
      committedOfficeCount: new Set(state.relationships
        .filter((relationship) => relationship.support === 'committed')
        .map((relationship) => relationship.memberId)).size,
      requiredProvisionCount: 2,
      requiredCommittedOfficeCount: 2,
    },
    gaps: {
      provisionGap: readiness.provisionGap,
      supportGap: readiness.supportGap,
      overdueMandatoryIds: [...readiness.overdueMandatoryIds],
    },
    bill: {
      revision: state.bill.revision,
      provisionIds: [...state.bill.provisionIds],
      provisionReceipts: structuredClone(state.bill.provisionReceipts),
    },
    integrity: {
      finalScore: state.resources.policyIntegrity,
      contributions: integrityContributions,
      explanation: 'Each line is the actual applied change. Policy Integrity is capped from 0 to 100, so nominal authored effects can exceed the displayed total.',
    },
    promises,
    obligations: structuredClone(state.obligations),
    declinedOpportunities,
    causeEventIds: state.eventLog.flatMap((event, index) => CAUSE_TYPES.has(event.type)
      ? [eventIdentity(event, index)]
      : []),
  } satisfies SessionRecord);
}
