import candidate from '@/content/housing/vertical-slice.candidate.json';
import { parseScenario } from '@/content/schema';
import type { ScenarioDefinition } from '@/domain/types';

let cached: ScenarioDefinition | undefined;

/** Load the local candidate snapshot through the strict canonical boundary. */
export async function loadScenario(): Promise<ScenarioDefinition> {
  cached ??= parseScenario(candidate);
  return structuredClone(cached);
}
export function getCandidateScenario(): ScenarioDefinition {
  cached ??= parseScenario(candidate);
  return structuredClone(cached);
}
