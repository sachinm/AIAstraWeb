import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginWithMagicLink, signup, LOGIN_FAILED_GENERIC } from './api';
import * as graphql from '../lib/graphql';

vi.mock('../lib/graphql', () => ({
  runGraphQL: vi.fn(),
  setAuth: vi.fn(),
  getUserId: vi.fn(),
  clearAuth: vi.fn(),
}));

const runGraphQL = vi.mocked(graphql.runGraphQL);
const setAuth = vi.mocked(graphql.setAuth);

describe('Auth api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loginWithMagicLink', () => {
    it('stores the session and returns the user when the code is accepted', async () => {
      runGraphQL.mockResolvedValueOnce({
        data: {
          loginWithMagicLink: {
            success: true,
            token: 'jwt-token',
            user: 'user-id-1',
            role: 'novice',
          },
        },
      });

      const result = await loginWithMagicLink(' user@test.com ', 'ABCD2345');

      expect(result.success).toBe(true);
      expect(result.user).toBe('user-id-1');
      expect(setAuth).toHaveBeenCalledWith('jwt-token', 'user-id-1');
      expect(runGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('mutation LoginWithMagicLink'),
        { email: 'user@test.com', code: 'ABCD2345', turnstileToken: null }
      );
    });

    it('returns the generic failure when GraphQL returns errors', async () => {
      runGraphQL.mockResolvedValueOnce({ errors: [{ message: 'Invalid code' }] });

      const result = await loginWithMagicLink('user@test.com', 'WRONG123');

      expect(result.success).toBe(false);
      expect(result.message).toBe(LOGIN_FAILED_GENERIC);
      expect(setAuth).not.toHaveBeenCalled();
    });

    it('returns the generic failure when the server refuses the code', async () => {
      runGraphQL.mockResolvedValueOnce({
        data: { loginWithMagicLink: { success: false, message: LOGIN_FAILED_GENERIC } },
      });

      const result = await loginWithMagicLink('user@test.com', 'WRONG123');

      expect(result.success).toBe(false);
      expect(setAuth).not.toHaveBeenCalled();
    });

    it('returns the generic failure on network error', async () => {
      runGraphQL.mockRejectedValueOnce(new Error('Network error'));

      const result = await loginWithMagicLink('user@test.com', 'ABCD2345');

      expect(result.success).toBe(false);
      expect(result.message).toBe(LOGIN_FAILED_GENERIC);
    });
  });

  describe('signup', () => {
    it('creates the account from email and profile fields without signing in', async () => {
      runGraphQL.mockResolvedValueOnce({
        data: {
          signup: { success: true, message: 'Account created.' },
        },
      });

      const result = await signup({
        username: 'newuser',
        email: 'new@test.com',
        date_of_birth: '1990-01-01',
      });

      expect(result.success).toBe(true);
      expect(setAuth).not.toHaveBeenCalled();
      expect(runGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('mutation Signup'),
        expect.objectContaining({
          input: expect.objectContaining({
            username: 'newuser',
            email: 'new@test.com',
            date_of_birth: '1990-01-01',
          }),
        })
      );
      const sent = runGraphQL.mock.calls[0][1] as { input: Record<string, unknown> };
      expect(sent.input).not.toHaveProperty('password');
    });

    it('returns failure when GraphQL returns errors', async () => {
      runGraphQL.mockResolvedValueOnce({
        errors: [{ message: 'Username or email already exists' }],
      });

      const result = await signup({
        username: 'existing',
        email: 'e@test.com',
        date_of_birth: '1990-01-01',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Username or email already exists');
      expect(setAuth).not.toHaveBeenCalled();
    });
  });
});
