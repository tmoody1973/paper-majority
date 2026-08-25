/**
 * Pure drop-target hit testing.
 *
 * Kept out of Phaser so it can be tested without a canvas, and so the same rule
 * serves the keyboard-accessible move commands.
 */
export interface DropTarget {
  stackId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}

export function resolveDropTarget(
  pointer: { x: number; y: number },
  targets: DropTarget[],
): string | undefined {
  let best: DropTarget | undefined;

  for (const target of targets) {
    const inside =
      pointer.x >= target.x &&
      pointer.x < target.x + target.width &&
      pointer.y >= target.y &&
      pointer.y < target.y + target.height;
    if (!inside) continue;
    if (!best || target.z > best.z) best = target;
  }

  return best?.stackId;
}
