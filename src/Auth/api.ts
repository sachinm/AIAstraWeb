import { runGraphQL, setAuth } from '../lib/graphql';

const LOGIN_MUTATION = `
  mutation Login($username: String!, $password: String!, $recaptchaToken: String) {
    login(username: $username, password: $password, recaptchaToken: $recaptchaToken) {
      success
      message
      token
      user
      role
    }
  }
`;

const SIGNUP_MUTATION = `
  mutation Signup($input: SignUpInput!) {
    signup(input: $input) {
      success
      message
      token
      user
      role
    }
  }
`;

const REQUEST_MAGIC_LINK_MUTATION = `
  mutation RequestMagicLink($email: String!, $recaptchaToken: String) {
    requestMagicLink(email: $email, recaptchaToken: $recaptchaToken) {
      success
      message
    }
  }
`;

const LOGIN_WITH_MAGIC_LINK_MUTATION = `
  mutation LoginWithMagicLink($email: String!, $code: String!, $recaptchaToken: String) {
    loginWithMagicLink(email: $email, code: $code, recaptchaToken: $recaptchaToken) {
      success
      message
      token
      user
      role
    }
  }
`;

/** Matches server LOGIN_FAILED_OBFUSCATED — never reveal user-not-found vs wrong password. */
export const LOGIN_FAILED_GENERIC =
  'Unable to sign in. Check your email and password and try again.';

export interface LoginResult {
  success: boolean;
  user?: string;
  message?: string;
}

export interface SignUpInput {
  username: string;
  password: string;
  email: string;
  date_of_birth: string;
  place_of_birth?: string | null;
  time_of_birth?: string | null;
  gender?: string | null;
  recaptchaToken?: string | null;
}

export interface SignUpResult {
  success: boolean;
  user?: string;
  message?: string;
}

export async function login(
  username: string,
  password: string,
  recaptchaToken?: string | null
): Promise<LoginResult> {
  try {
    const { data, errors } = await runGraphQL<{
      login?: {
        success: boolean;
        message?: string;
        token?: string;
        user?: string;
        role?: string;
      };
    }>(LOGIN_MUTATION, {
      username,
      password,
      recaptchaToken: recaptchaToken ?? null,
    });

    if (errors?.length) {
      return { success: false, message: LOGIN_FAILED_GENERIC };
    }

    const result = data?.login;
    if (result?.success && result?.token && result?.user) {
      setAuth(result.token, result.user);
      return { success: true, user: result.user };
    }
    return { success: false, message: result?.message || LOGIN_FAILED_GENERIC };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: LOGIN_FAILED_GENERIC };
  }
}

export interface MagicLinkRequestResult {
  success: boolean;
  message?: string;
}

export async function requestMagicLinkEmail(
  email: string,
  recaptchaToken?: string | null
): Promise<MagicLinkRequestResult> {
  try {
    const { data, errors } = await runGraphQL<{
      requestMagicLink?: { success: boolean; message?: string };
    }>(REQUEST_MAGIC_LINK_MUTATION, {
      email: email.trim(),
      recaptchaToken: recaptchaToken ?? null,
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
  recaptchaToken?: string | null
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
      recaptchaToken: recaptchaToken ?? null,
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
      password: userData.password,
      email: userData.email,
      date_of_birth: userData.date_of_birth,
      place_of_birth: userData.place_of_birth ?? null,
      time_of_birth: userData.time_of_birth ?? null,
      gender: userData.gender ?? null,
      recaptchaToken: userData.recaptchaToken ?? null,
    };

    const { data, errors } = await runGraphQL<{
      signup?: {
        success: boolean;
        message?: string;
        token?: string;
        user?: string;
        role?: string;
      };
    }>(SIGNUP_MUTATION, { input });

    if (errors?.length) {
      return { success: false, message: errors[0].message || 'Signup failed' };
    }

    const result = data?.signup;
    if (result?.success && result?.token && result?.user) {
      setAuth(result.token, result.user);
      return { success: true, user: result.user };
    }
    return { success: false, message: result?.message || 'Signup failed' };
  } catch (error) {
    console.error('Signup error:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Signup failed',
    };
  }
}
