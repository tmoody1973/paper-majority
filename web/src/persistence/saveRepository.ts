import type { ScenarioDefinition, TermState } from '@/domain/types';
import {
  createSaveEnvelope,
  validateAndMigrateSave,
  type SaveValidationFailure,
} from '@/persistence/saveMigrations';

export const SAVE_KEYS = {
  candidate: 'congress-game.save.candidate',
  current: 'congress-game.save.current',
  previousWeek: 'congress-game.save.previous-week',
  replaced: 'congress-game.save.replaced',
} as const;

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveResult =
  | { kind: 'saved'; state: TermState; bytes: string; message: string }
  | { kind: 'corrupt'; message: string }
  | { kind: 'storage-unavailable'; state: TermState; message: string };

export type LoadResult =
  | { kind: 'loaded'; state: TermState; message: string }
  | { kind: 'recovered-previous'; state: TermState; message: string }
  | { kind: 'empty'; message: string }
  | SaveValidationFailure
  | { kind: 'storage-unavailable'; message: string };

function parseStored(raw: string, scenario: ScenarioDefinition) {
  try {
    return validateAndMigrateSave(JSON.parse(raw) as unknown, scenario);
  } catch {
    return { kind: 'corrupt' as const, message: 'The saved checkpoint is not valid JSON.' };
  }
}

function paused(state: TermState): TermState {
  return state.paused ? state : { ...state, paused: true };
}

function storageFailure(operation: string, error: unknown): string {
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return `Browser storage failed while ${operation}${detail}. Your in-memory session is still available; keep this tab open and try again.`;
}

function completedAnotherWeek(current: TermState, candidate: TermState): boolean {
  const existing = new Set(current.resolvedWeekIds);
  return candidate.resolvedWeekIds.some((id) => !existing.has(id));
}

/**
 * Stage, read-validate, and promote a synchronous browser checkpoint. A failed
 * promotion never rewinds the accepted engine state passed to this function.
 */
export function saveCheckpoint(
  storage: SaveStorage,
  state: TermState,
  scenario: ScenarioDefinition,
): SaveResult {
  const validation = validateAndMigrateSave(createSaveEnvelope(state, scenario), scenario);
  if (validation.kind !== 'valid') {
    return { kind: 'corrupt', message: `The current session could not be checkpointed: ${validation.message}` };
  }
  const serialized = JSON.stringify(validation.envelope);

  try {
    storage.setItem(SAVE_KEYS.candidate, serialized);
  } catch (error) {
    return { kind: 'storage-unavailable', state, message: storageFailure('staging the checkpoint', error) };
  }

  let staged: string | null;
  try {
    staged = storage.getItem(SAVE_KEYS.candidate);
  } catch (error) {
    return { kind: 'storage-unavailable', state, message: storageFailure('validating the staged checkpoint', error) };
  }
  if (staged === null) {
    return { kind: 'storage-unavailable', state, message: 'Browser storage did not retain the staged checkpoint. Your in-memory session is still available; keep this tab open and try again.' };
  }
  const stagedValidation = parseStored(staged, scenario);
  if (stagedValidation.kind !== 'valid') {
    return { kind: 'corrupt', message: `Browser storage changed the staged checkpoint: ${stagedValidation.message}` };
  }
  if (staged !== serialized) {
    return { kind: 'corrupt', message: 'Browser storage replaced the staged checkpoint before it could be promoted. The current checkpoint was left untouched.' };
  }

  let currentRaw: string | null;
  try {
    currentRaw = storage.getItem(SAVE_KEYS.current);
  } catch (error) {
    return { kind: 'storage-unavailable', state, message: storageFailure('reading the current checkpoint', error) };
  }
  const currentValidation = currentRaw === null ? undefined : parseStored(currentRaw, scenario);

  if (
    currentRaw !== null
    && currentValidation?.kind === 'valid'
    && completedAnotherWeek(currentValidation.envelope.state, state)
  ) {
    try {
      storage.setItem(SAVE_KEYS.previousWeek, currentRaw);
    } catch (error) {
      return { kind: 'storage-unavailable', state, message: storageFailure('rotating the last completed-week checkpoint', error) };
    }
  }

  try {
    storage.setItem(SAVE_KEYS.current, staged);
  } catch (error) {
    return { kind: 'storage-unavailable', state, message: storageFailure('promoting the checkpoint', error) };
  }

  try {
    storage.removeItem(SAVE_KEYS.candidate);
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
    return {
      kind: 'storage-unavailable',
      state,
      message: `The checkpoint was saved, but browser storage failed while cleaning up its staging copy${detail}. You can safely continue.`,
    };
  }

  return { kind: 'saved', state, bytes: serialized, message: 'Session checkpoint saved.' };
}

function read(storage: SaveStorage, key: string, description: string): { raw: string | null } | { error: string } {
  try {
    return { raw: storage.getItem(key) };
  } catch (error) {
    return { error: storageFailure(description, error) };
  }
}

export function loadCheckpoint(storage: SaveStorage, scenario: ScenarioDefinition): LoadResult {
  const currentRead = read(storage, SAVE_KEYS.current, 'reading the current checkpoint');
  if ('error' in currentRead) return { kind: 'storage-unavailable', message: currentRead.error };
  const currentValidation = currentRead.raw === null ? undefined : parseStored(currentRead.raw, scenario);
  if (currentValidation?.kind === 'valid') {
    return { kind: 'loaded', state: paused(currentValidation.envelope.state), message: 'Session checkpoint restored and paused.' };
  }

  const previousRead = read(storage, SAVE_KEYS.previousWeek, 'reading the previous-week checkpoint');
  if ('error' in previousRead) return { kind: 'storage-unavailable', message: previousRead.error };
  const previousValidation = previousRead.raw === null ? undefined : parseStored(previousRead.raw, scenario);
  if (previousValidation?.kind === 'valid') {
    return {
      kind: 'recovered-previous',
      state: paused(previousValidation.envelope.state),
      message: 'The newest checkpoint was unavailable, so the last valid completed-week checkpoint was restored and paused.',
    };
  }

  if (currentValidation) return currentValidation;
  if (previousValidation) return previousValidation;
  return { kind: 'empty', message: 'No saved session was found.' };
}
