import { runGraphQL, setAuth } from '../lib/graphql';

const SIGNUP_MUTATION = `
  mutation Signup($input: SignUpInput!) {
    signup(input: $input) {
      success
      message
      code
    }
  }
`;

const REQUEST_MAGIC_LINK_MUTATION = `
  mutation RequestMagicLink($email: String!, $turnstileToken: String) {
    requestMagicLink(email: $email, turnstileToken: $turnstileToken) {
      success
      message
    }
  }
`;

const LOGIN_WITH_MAGIC_LINK_MUTATION = `
  mutation LoginWithMagicLink($email: String!, $code: String!, $turnstileToken: String) {
    loginWithMagicLink(email: $email, code: $code, turnstileToken: $turnstileToken) {
      success
      message
      token
      user
      role
    }
  }
`;

/** Matches server MAGIC_LINK_LOGIN_FAILED: never reveal whether the email exists or the code was wrong. */
export const LOGIN_FAILED_GENERIC = 'Unable to sign in. Check your code and try again.';

export interface LoginResult {
  success: boolean;
  user?: string;
  message?: string;
}

/** Account details only. There is no password: sign-in is by emailed code. */
export interface SignUpInput {
  username: string;
  email: string;
  date_of_birth: string;
  place_of_birth?: string | null;
  time_of_birth?: string | null;
  gender?: string | null;
  turnstileToken?: string | null;
}

/** Signup does not sign the user in; the caller moves to the code step. */
export interface SignUpResult {
  success: boolean;
  message?: string;
  /** Stable server code for a refused signup, e.g. EMAIL_EXISTS. */
  code?: string;
}

export const EMAIL_EXISTS_CODE = 'EMAIL_EXISTS';

export interface MagicLinkRequestResult {
  success: boolean;
  message?: string;
}

export async function requestMagicLinkEmail(
  email: string,
  turnstileToken?: string | null
): Promise<MagicLinkRequestResult> {
  try {
    const { data, errors } = await runGraphQL<{
      requestMagicLink?: { success: boolean; message?: string };
    }>(REQUEST_MAGIC_LINK_MUTATION, {
      email: email.trim(),
      turnstileToken: turnstileToken ?? null,
    });

    if (errors?.length) {
      return { success: false, message: errors[0].message };
    }
    const r = data?.requestMagicLink;
    return {
      success: Boolean(r?.success),
      message: r?.message,
    };
  } catch (e) {
    console.error('requestMagicLinkEmail:', e);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
}

export async function loginWithMagicLink(
  email: string,
  code: string,
  turnstileToken?: string | null
): Promise<LoginResult> {
  const CODE_FAILED =
    'Unable to sign in. Check your code and try again.';
  try {
    const { data, errors } = await runGraphQL<{
      loginWithMagicLink?: {
        success: boolean;
        message?: string;
        token?: string;
        user?: string;
        role?: string;
      };
    }>(LOGIN_WITH_MAGIC_LINK_MUTATION, {
      email: email.trim(),
      code: code.trim(),
      turnstileToken: turnstileToken ?? null,
    });

    if (errors?.length) {
      return { success: false, message: CODE_FAILED };
    }

    const result = data?.loginWithMagicLink;
    if (result?.success && result?.token && result?.user) {
      setAuth(result.token, result.user);
      return { success: true, user: result.user };
    }
    return { success: false, message: result?.message || CODE_FAILED };
  } catch (e) {
    console.error('loginWithMagicLink:', e);
    return { success: false, message: CODE_FAILED };
  }
}

export async function signup(userData: SignUpInput): Promise<SignUpResult> {
  try {
    const input = {
      username: userData.username,
      email: userData.email,
      date_of_birth: userData.date_of_birth,
      place_of_birth: userData.place_of_birth ?? null,
      time_of_birth: userData.time_of_birth ?? null,
      gender: userData.gender ?? null,
      turnstileToken: userData.turnstileToken ?? null,
    };

    const { data, errors } = await runGraphQL<{
      signup?: {
        success: boolean;
        message?: string;
        code?: string | null;
      };
    }>(SIGNUP_MUTATION, { input });

    if (errors?.length) {
      return { success: false, message: errors[0].message || 'Signup failed' };
    }

    const result = data?.signup;
    if (result?.success) {
      return { success: true, message: result.message };
    }
    return {
      success: false,
      message: result?.message || 'Signup failed',
      code: result?.code ?? undefined,
    };
  } catch (error) {
    console.error('Signup error:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Signup failed',
    };
  }
}

const LOGOUT_MUTATION = `
  mutation Logout {
    logout
  }
`;

/**
 * Asks the server to delete this user's LLM prompt caches.
 * Fire-and-forget: never throws and never blocks local logout.
 * The auth token is read synchronously by runGraphQL, so call this before clearing localStorage.
 */
export async function requestServerLogout(): Promise<void> {
  try {
    const { errors } = await runGraphQL<{ logout?: boolean }>(LOGOUT_MUTATION, undefined, {
      timeoutMs: 2000,
      keepalive: true,
    });
    if (errors?.length) {
      console.debug('[logout] server cache cleanup returned errors', errors[0].message);
    }
  } catch (e) {
    console.debug('[logout] server cache cleanup failed', e instanceof Error ? e.message : String(e));
  }
}
