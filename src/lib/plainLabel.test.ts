import { describe, expect, it } from 'vitest';
import { nameOr, plainLabel } from './plainLabel';

describe('plainLabel', () => {
  it('turns an internal id into plain words', () => {
    expect(plainLabel('career_start')).toBe('Career start');
    expect(plainLabel('self.activation')).toBe('Activation');
    expect(plainLabel('work.present_tone')).toBe('Present tone');
    expect(plainLabel('if-it-drifts')).toBe('If it drifts');
    expect(plainLabel('')).toBe('');
    expect(plainLabel(null)).toBe('');
  });

  it('prefers the name map', () => {
    expect(nameOr({ best: 'Best' }, 'best')).toBe('Best');
    expect(nameOr({ best: 'Best' }, 'the_floor')).toBe('The floor');
    expect(nameOr(null, 'primary_job')).toBe('Primary job');
  });
});
