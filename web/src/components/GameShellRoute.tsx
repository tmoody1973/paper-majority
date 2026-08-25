'use client';

import { useSearchParams } from 'next/navigation';

import { GameShell } from '@/components/GameShell';
import type { FixtureId } from '@/content/fixtures/loadFixture';

/**
 * Reads `?fixture=` and hands the shell a fixture id.
 *
 * `useSearchParams` needs a Suspense boundary above it in the App Router, which
 * `page.tsx` provides.
 */
export function GameShellRoute() {
  const params = useSearchParams();

  // `desk-foundation` names the same desk; it exists so the low-level drag E2E
  // spec can say what it is exercising. One fixture, two honest names.
  const fixture: FixtureId = 'interaction-spike';
  const requested = params.get('fixture') ?? 'interaction-spike';

  return <GameShell key={requested} fixture={fixture} />;
}
