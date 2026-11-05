import { describe, it, expect, beforeEach } from 'vitest';
import { ASTRO_USER_KEY, readStoredUser, toUser, writeStoredUser } from './storedUser';
import { parseStoredUser } from './sessionRestore';

describe('astroUser holds the name only', () => {
  beforeEach(() => localStorage.clear());

  it('drops birth fields and email from a legacy stored value and rewrites the key without them', () => {
    localStorage.setItem(
      ASTRO_USER_KEY,
      JSON.stringify({
        name: 'Asha',
        email: 'asha@example.com',
        dateOfBirth: '1990-04-27',
        timeOfBirth: '00:05',
        placeOfBirth: 'Pune',
      })
    );
    expect(readStoredUser()).toEqual({ name: 'Asha' });
    expect(JSON.parse(localStorage.getItem(ASTRO_USER_KEY)!)).toEqual({ name: 'Asha' });
  });

  it('the session restore path reads it the same way', () => {
    localStorage.setItem(ASTRO_USER_KEY, JSON.stringify({ name: 'Asha', dateOfBirth: '1990-04-27', placeOfBirth: 'Pune', timeOfBirth: '00:05' }));
    expect(parseStoredUser()).toEqual({ name: 'Asha' });
    expect(localStorage.getItem(ASTRO_USER_KEY)).toBe('{"name":"Asha"}');
  });

  it('writes only the name, whatever object it is given', () => {
    const legacy = { name: 'Asha', email: 'asha@example.com', dateOfBirth: '1990-04-27', placeOfBirth: 'Pune', timeOfBirth: '00:05' };
    writeStoredUser(legacy);
    expect(localStorage.getItem(ASTRO_USER_KEY)).toBe('{"name":"Asha"}');
  });

  it('removes a value that is not a user object (e.g. a bare user id string) or not JSON', () => {
    localStorage.setItem(ASTRO_USER_KEY, JSON.stringify('2f6c-user-id'));
    expect(readStoredUser()).toBeNull();
    expect(localStorage.getItem(ASTRO_USER_KEY)).toBeNull();
    localStorage.setItem(ASTRO_USER_KEY, '{not json');
    expect(readStoredUser()).toBeNull();
    expect(localStorage.getItem(ASTRO_USER_KEY)).toBeNull();
  });

  it('toUser keeps the name and an in-memory email, and nothing else', () => {
    expect(toUser({ name: 'A', email: 'a@b.c', dateOfBirth: 'x' })).toEqual({ name: 'A', email: 'a@b.c' });
    expect(toUser({ name: 'A' })).toEqual({ name: 'A' });
    expect(toUser('user-id')).toBeNull();
    expect(toUser(null)).toBeNull();
  });
});
