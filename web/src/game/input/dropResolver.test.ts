import { describe, expect, it } from 'vitest';

import { resolveDropTarget, type DropTarget } from '@/game/input/dropResolver';

const low: DropTarget = { stackId: 'stack-low', x: 0, y: 0, width: 100, height: 100, z: 1 };
const high: DropTarget = { stackId: 'stack-high', x: 50, y: 50, width: 100, height: 100, z: 5 };

describe('resolveDropTarget', () => {
  it('returns the only overlapping target', () => {
    expect(resolveDropTarget({ x: 10, y: 10 }, [low, high])).toBe('stack-low');
  });

  it('lets the highest z win where targets overlap', () => {
    expect(resolveDropTarget({ x: 75, y: 75 }, [low, high])).toBe('stack-high');
    expect(resolveDropTarget({ x: 75, y: 75 }, [high, low])).toBe('stack-high');
  });

  it('returns undefined for an out-of-bounds pointer', () => {
    expect(resolveDropTarget({ x: 900, y: 900 }, [low, high])).toBeUndefined();
  });

  it('returns undefined when there are no targets', () => {
    expect(resolveDropTarget({ x: 10, y: 10 }, [])).toBeUndefined();
  });

  it('treats the right and bottom edges as outside', () => {
    expect(resolveDropTarget({ x: 100, y: 50 }, [low])).toBeUndefined();
    expect(resolveDropTarget({ x: 50, y: 100 }, [low])).toBeUndefined();
    expect(resolveDropTarget({ x: 0, y: 0 }, [low])).toBe('stack-low');
  });
});
