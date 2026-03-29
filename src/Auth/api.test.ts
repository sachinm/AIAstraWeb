import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, signup } from './api';
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

  describe('login', () => {
    it('returns success and user when login succeeds', async () => {
      runGraphQL.mockResolvedValueOnce({
        data: {
          login: {
            success: true,
            token: 'jwt-token',
            user: 'user-id-1',
            role: 'user',
          },
        },
      });

      const result = await login('user1', 'pass123');

      expect(result.success).toBe(true);
      expect(result.user).toBe('user-id-1');
      expect(setAuth).toHaveBeenCalledWith('jwt-token', 'user-id-1');
      expect(runGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('mutation Login'),
        { username: 'user1', password: 'pass123', recaptchaToken: null }
      );
    });

    it('returns failure when GraphQL returns errors', async () => {
      runGraphQL.mockResolvedValueOnce({
        errors: [{ message: 'Invalid credentials' }],
      });

      const result = await login('user1', 'wrong');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
      expect(setAuth).not.toHaveBeenCalled();
    });

    it('returns failure when no token in response', async () => {
      runGraphQL.mockResolvedValueOnce({
        data: {
          login: { success: false, message: 'Invalid username or password' },
        },
      });

      const result = await login('user1', 'pass');

      expect(result.success).toBe(false);
      expect(setAuth).not.toHaveBeenCalled();
    });

    it('returns failure on network error', async () => {
      runGraphQL.mockRejectedValueOnce(new Error('Network error'));

      const result = await login('user1', 'pass');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error');
    });
  });

  describe('signup', () => {
    it('returns success and user when signup succeeds', async () => {
      runGraphQL.mockResolvedValueOnce({
        data: {
          signup: {
            success: true,
            token: 'jwt-token',
            user: 'user-id-2',
            role: 'user',
          },
        },
      });

      const result = await signup({
        username: 'newuser',
        password: 'pass123',
        email: 'new@test.com',
        date_of_birth: '1990-01-01',
      });

      expect(result.success).toBe(true);
      expect(result.user).toBe('user-id-2');
      expect(setAuth).toHaveBeenCalledWith('jwt-token', 'user-id-2');
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
    });

    it('returns failure when GraphQL returns errors', async () => {
      runGraphQL.mockResolvedValueOnce({
        errors: [{ message: 'Username already exists' }],
      });

      const result = await signup({
        username: 'existing',
        password: 'pass123',
        email: 'e@test.com',
        date_of_birth: '1990-01-01',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Username already exists');
      expect(setAuth).not.toHaveBeenCalled();
    });
  });
});
