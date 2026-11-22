import { describe, expect, it } from 'vitest';
import { boardMode } from './boardMode';

describe('boardMode', () => {
  it('chooses the two-fold layout from viewport segments, or a wide short touch screen', () => {
    expect(boardMode(1180, 820, true, false)).toBe('duo');
    expect(boardMode(1280, 720, false, true)).toBe('duo');
    expect(boardMode(1280, 720, false, false)).toBe('landscape');
    expect(boardMode(1180, 820, false, false)).toBe('landscape');
    expect(boardMode(1440, 900, false, false)).toBe('wide');
    expect(boardMode(1920, 1080, false, false)).toBe('xwide');
    expect(boardMode(2560, 1440, false, false)).toBe('ultrawide');
    expect(boardMode(1024, 1366, false, false)).toBe('portrait');
    expect(boardMode(390, 844, false, false)).toBe('phone');
  });
});
