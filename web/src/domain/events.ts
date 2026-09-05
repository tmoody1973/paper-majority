import type {
  ElectionEffectEntry,
  ElectionForecast,
  ProcedureStage,
  ReelectionResult,
  Resources,
} from '@/domain/types';

/**
 * Stable, machine-readable rejection codes.
 *
 * These are part of the engine contract: presentation layers may switch on them,
 * but they are never shown to a player. The player sees `message` instead.
 */
export type RejectionReason =
  | 'unknown-card'
  | 'unknown-stack'
  | 'card-expired'
  | 'card-busy'
  | 'no-matching-pattern'
  /** No rule matches yet, but an unstudied Tactic would make this exact stack work. */
  | 'needs-tactic'
  | 'insufficient-resources'
  | 'tactic-already-active'
  | 'unknown-tactic-expansion'
  | 'unknown-pattern'
  | 'ineligible-staff'
  | 'malformed-command'
  | 'invalid-stage'
  | 'clock-not-expired'
  | 'stale-decision'
  | 'unknown-decision'
  | 'unknown-choice'
  | 'duplicate-outreach'
  | 'pending-decision'
  | 'duplicate-provision'
  | 'invalid-card-form'
  | 'run-complete'
  /** A real command that this build does not serve yet. Never a content or player error. */
  | 'unsupported-command';

export interface VoteTally {
  committed: number;
  conditional: number;
  undecided: number;
  opposed: number;
}

export type GameEvent =
  | {
      type: 'STACK_ACCEPTED';
      stackId: string;
      cardIds: string[];
      /** Definition ids of the accepted inputs, so the Handbook can show real examples. */
      definitionIds: string[];
      patternId?: string;
    }
  | {
      type: 'STACK_REJECTED';
      cardIds: string[];
      targetStackId?: string;
      reason: RejectionReason;
      message: string;
    }
  | { type: 'CARD_MOVED'; cardId: string; x: number; y: number }
  | {
      type: 'ACTION_STARTED';
      stackId: string;
      durationMs: number;
      patternId?: string;
      assignmentKind?: 'card-work' | 'study-tactic';
    }
  | {
      type: 'CARD_TRANSFORMED';
      stackId: string;
      consumedCardIds: string[];
      producedCardIds: string[];
      /**
       * Catalyst inputs that took part and came back — a staffer, your working
       * bill. Named separately so the desk can show the return rather than leaving
       * the player to notice a card reappearing.
       */
      returnedCardIds: string[];
      outputDefinitionId: string;
      explanationKey: string;
    }
  | { type: 'PATTERN_DISCOVERED'; patternId: string }
  | {
      type: 'TACTIC_EXPANSION_ACTIVATED';
      expansionId: string;
      tacticDefinitionId: string;
      targetPatternId: string;
    }
  | {
      type: 'RESOURCE_CHANGED';
      /** Signed differences actually applied after resource bounds are enforced. */
      changes: Partial<Resources>;
      reason: string;
    }
  | { type: 'ELECTION_EFFECT_ADDED'; effect: ElectionEffectEntry }
  | { type: 'ELECTION_OUTLOOK_UPDATED'; forecast: ElectionForecast }
  | { type: 'PAUSE_CHANGED'; paused: boolean }
  | { type: 'EVENT_TRIGGERED'; storyEventId: string; whyRules: string[] }
  | { type: 'WEEK_RESOLVED'; week: number; summary: string[] }
  | { type: 'WORK_SUBMITTED'; workId: string; cardIds: string[]; completesAtSimulationMs: number }
  | { type: 'PROVISION_DOCKETED'; cardId: string; provisionId: string; revision: number }
  | { type: 'PROVISION_NEGOTIATED'; decisionId: string; occurrenceId: string; provisionId: string; change: 'added' | 'removed'; revision: number }
  | { type: 'DECISION_PRESENTED'; decisionId: string; sourceId: string; occurrenceId: string; choiceIds: string[] }
  | { type: 'DECISION_RESOLVED'; decisionId: string; choiceId: string; occurrenceId: string }
  | { type: 'PROMISE_CHANGED'; promiseOccurrenceId: string; status: 'open' | 'fulfilled' | 'broken' }
  | { type: 'OPPORTUNITY_DECLINED'; occurrenceId: string; sourceId: string }
  | { type: 'PACK_OPENED'; packOccurrenceId: string; categoryId: string; cardDefinitionIds: string[] }
  | { type: 'CARD_LOCATION_CHANGED'; cardId: string; location: 'desk' | 'filed' | 'archived' }
  | { type: 'SESSION_CONCLUDED'; outcome: 'ready' | 'not-ready' }
  | { type: 'VOTE_RESOLVED'; stage: ProcedureStage; passed: boolean; tally: VoteTally }
  | { type: 'REELECTION_RESOLVED'; result: ReelectionResult }
  | {
      type: 'COMMAND_REJECTED';
      commandType: string;
      reason: RejectionReason;
      message: string;
    };

export type GameEventType = GameEvent['type'];
