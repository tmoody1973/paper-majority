/**
 * How far along a timed assignment is, 0 to 1.
 *
 * Kept in its own module with no Phaser import so the progress strip's maths can be
 * tested in a plain DOM — importing anything that pulls in Phaser needs a real canvas.
 */
export function progressFraction(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
}
