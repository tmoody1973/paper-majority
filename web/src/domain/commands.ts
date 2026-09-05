/**
 * The command boundary.
 *
 * React and Phaser may only ask the engine to do these things. Neither layer
 * mutates authoritative state; the engine validates every command and answers
 * with new state plus events.
 */
export type GameCommand =
  | { type: 'STACK_CARD'; cardId: string; targetStackId: string }
  | { type: 'SEPARATE_STACK'; stackId: string; cardId: string; x: number; y: number }
  | { type: 'MOVE_CARD'; cardId: string; x: number; y: number }
  | {
      type: 'START_ASSIGNMENT';
      assignmentKind: 'card-work' | 'study-tactic';
      staffCardId: string;
      /** For `study-tactic` this is the Tactic instance being studied. */
      targetCardId: string;
    }
  /**
   * The single engine activation boundary for a Tactic rule expansion. It is reached
   * when a timed Study Tactic assignment completes, and directly by deterministic
   * tests. No player-facing control may dispatch it and bypass the Staff assignment.
   */
  | { type: 'ACTIVATE_TACTIC'; tacticCardId: string; expansionId: string }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'FILE_CARD'; cardId: string }
  | { type: 'ARCHIVE_CARD'; cardId: string }
  | { type: 'UNFILE_CARD'; cardId: string }
  | { type: 'SUBMIT_WORK'; cardIds: string[] }
  | { type: 'DOCKET_PROVISION'; cardId: string }
  | {
      type: 'RESOLVE_DECISION';
      decisionId: string;
      choiceId: string;
      expectedBillRevision: number;
    }
  | { type: 'OPEN_PACK'; packOccurrenceId: string; categoryId: string }
  | { type: 'FAST_FORWARD' }
  | { type: 'CONCLUDE_SESSION' }
  | { type: 'ACCEPT_AMENDMENT'; memberId: string; provisionId: string }
  | { type: 'REJECT_AMENDMENT'; memberId: string }
  | { type: 'ADVANCE_WEEK'; confirmEarly: true; expectedWeek: number }
  | { type: 'ADVANCE_WEEK'; confirmEarly?: false; expectedWeek?: never }
  | { type: 'RESOLVE_VOTE' };

export type GameCommandType = GameCommand['type'];
