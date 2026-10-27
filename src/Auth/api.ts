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

const START_SIGNUP_MUTATION = `
  mutation StartSignup($input: StartSignupInput!) {
    startSignup(input: $input) {
      success
      code
      message
    }
  }
`;

const VERIFY_SIGNUP_CODE_MUTATION = `
  mutation VerifySignupCode($email: String!, $code: String!) {
    verifySignupCode(email: $email, code: $code) {
      success
      message
      token
      user
      role
    }
  }
`;

const COMPLETE_PROFILE_MUTATION = `
  mutation CompleteProfile($input: CompleteProfileInput!) {
    completeProfile(input: $input) {
      success
      message
      referral_code
    }
  }
`;

const ME_QUERY = `
  query Me {
    me {
      profile_complete
      email_verified
      kundli_status
    }
  }
`;

export interface StartSignupInput {
  name: string;
  email: string;
  turnstileToken?: string | null;
}

export interface StartSignupResult {
  success: boolean;
  code?: string;
  message?: string;
}

/** Page 1 of registration: name and email only. The server emails a verification code. */
export async function startSignup(input: StartSignupInput): Promise<StartSignupResult> {
  try {
    const { data, errors } = await runGraphQL<{
      startSignup?: { success: boolean; code?: string | null; message?: string | null };
    }>(START_SIGNUP_MUTATION, {
      input: {
        name: input.name.trim(),
        email: input.email.trim(),
        turnstileToken: input.turnstileToken ?? null,
      },
    });
    if (errors?.length) {
      return { success: false, message: errors[0].message || 'Something went wrong. Please try again.' };
    }
    const r = data?.startSignup;
    return {
      success: Boolean(r?.success),
      code: r?.code ?? undefined,
      message: r?.message ?? undefined,
    };
  } catch (e) {
    console.error('startSignup:', e);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
}

/** Confirms the emailed code. On success the user is signed in (token stored, as for code sign-in). */
export async function verifySignupCode(email: string, code: string): Promise<LoginResult> {
  const FAILED = 'That code did not match. Check the latest email or request a new code.';
  try {
    const { data, errors } = await runGraphQL<{
      verifySignupCode?: { success: boolean; message?: string; token?: string; user?: string; role?: string };
    }>(VERIFY_SIGNUP_CODE_MUTATION, { email: email.trim(), code: code.trim() });
    if (errors?.length) return { success: false, message: FAILED };
    const r = data?.verifySignupCode;
    if (r?.success && r.token && r.user) {
      setAuth(r.token, r.user);
      return { success: true, user: r.user };
    }
    return { success: false, message: r?.message || FAILED };
  } catch (e) {
    console.error('verifySignupCode:', e);
    return { success: false, message: FAILED };
  }
}

export type Gender = 'male' | 'female' | 'prefer_not_to_say';

export interface CompleteProfileInput {
  /** YYYY-MM-DD */
  date_of_birth: string;
  /** HH:MM, 24-hour */
  time_of_birth: string;
  /** ISO 3166-1 alpha-2 */
  country_code: string;
  city: string;
  gender: Gender;
  referral_code?: string | null;
}

export interface CompleteProfileResult {
  success: boolean;
  message?: string;
  referral_code?: string | null;
}

/** Page 2 of registration: birth details. Needs the signed-in token from verifySignupCode. */
export async function completeProfile(input: CompleteProfileInput): Promise<CompleteProfileResult> {
  try {
    const { data, errors } = await runGraphQL<{
      completeProfile?: { success: boolean; message?: string | null; referral_code?: string | null };
    }>(COMPLETE_PROFILE_MUTATION, {
      input: { ...input, referral_code: input.referral_code?.trim() || null },
    });
    if (errors?.length) {
      return { success: false, message: errors[0].message || 'Something went wrong. Please try again.' };
    }
    const r = data?.completeProfile;
    return {
      success: Boolean(r?.success),
      message: r?.message ?? undefined,
      referral_code: r?.referral_code ?? null,
    };
  } catch (e) {
    console.error('completeProfile:', e);
    return { success: false, message: 'Something went wrong. Your details are still here; try again in a moment.' };
  }
}

export type KundliStatus = 'pending' | 'building' | 'ready';

export interface Me {
  profile_complete: boolean;
  email_verified: boolean;
  kundli_status: KundliStatus;
}

/** The signed-in user's onboarding state, or null when it cannot be read (callers fail open). */
export async function fetchMe(): Promise<Me | null> {
  try {
    const { data, errors } = await runGraphQL<{ me?: Me | null }>(ME_QUERY);
    if (errors?.length || !data?.me) return null;
    return data.me;
  } catch (e) {
    console.debug('fetchMe failed', e instanceof Error ? e.message : String(e));
    return null;
  }
}

const UPDATE_PROFILE_MUTATION = `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      success
      message
    }
  }
`;

const PROFILE_QUERY = `
  query MyProfile {
    me {
      name
      gender
      date_of_birth
      time_of_birth
      country_code
      city
    }
  }
`;

export interface Profile {
  name: string;
  gender: Gender | null;
  /** YYYY-MM-DD */
  date_of_birth: string | null;
  /** HH:MM (24-hour); the server may add seconds. */
  time_of_birth: string | null;
  country_code: string | null;
  city: string | null;
}

/** The signed-in user's saved details for the Profile page, or null when they cannot be read. */
export async function fetchProfile(): Promise<Profile | null> {
  try {
    const { data, errors } = await runGraphQL<{ me?: Profile | null }>(PROFILE_QUERY);
    if (errors?.length || !data?.me) return null;
    return data.me;
  } catch (e) {
    console.debug('fetchProfile failed', e instanceof Error ? e.message : String(e));
    return null;
  }
}

export interface UpdateProfileInput {
  name: string;
  gender: Gender;
  date_of_birth: string;
  time_of_birth: string;
  country_code: string;
  city: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, errors } = await runGraphQL<{ updateProfile?: { success: boolean; message?: string | null } }>(
      UPDATE_PROFILE_MUTATION,
      { input }
    );
    if (errors?.length) return { success: false, message: errors[0].message || 'Something went wrong. Please try again.' };
    const r = data?.updateProfile;
    return { success: Boolean(r?.success), message: r?.message ?? undefined };
  } catch (e) {
    console.error('updateProfile:', e);
    return { success: false, message: 'Something went wrong. Your changes are still here; try again in a moment.' };
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
