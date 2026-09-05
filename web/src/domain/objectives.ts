import { dueSimulationMs } from '@/domain/obligations';
import type { TermState } from '@/domain/types';

export const SESSION_READINESS_MILESTONE_ID = 'milestone:session-readiness-prepared';

export interface SessionReadiness {
  ready: boolean;
  provisionGap: number;
  supportGap: number;
  overdueMandatoryIds: string[];
}

/** The authoritative six-week readiness objective. It is an assessment, not a vote forecast. */
export function sessionReadiness(state: TermState): SessionReadiness {
  const provisionCount = new Set(state.bill.provisionIds).size;
  const committedOfficeCount = new Set(
    state.relationships
      .filter((relationship) => relationship.support === 'committed')
      .map((relationship) => relationship.memberId),
  ).size;
  const overdueMandatoryIds = state.obligations
    .filter((obligation) => obligation.mandatory && (
      obligation.status === 'missed'
      || (obligation.status === 'open' && dueSimulationMs(state, obligation) <= state.simulationMs)
    ))
    .map((obligation) => obligation.id)
    .sort();
  const provisionGap = Math.max(0, 2 - provisionCount);
  const supportGap = Math.max(0, 2 - committedOfficeCount);
  return {
    ready: provisionGap === 0 && supportGap === 0 && overdueMandatoryIds.length === 0,
    provisionGap,
    supportGap,
    overdueMandatoryIds,
  };
}
