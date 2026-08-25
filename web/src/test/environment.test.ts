import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('provides browser storage', () => {
    expect(window.localStorage).toBeDefined();
  });
});
