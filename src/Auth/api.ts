import { runGraphQL, setAuth } from '../lib/graphql';

const LOGIN_MUTATION = `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
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
}

export interface SignUpResult {
  success: boolean;
  user?: string;
  message?: string;
}

export async function login(
  username: string,
  password: string
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
    }>(LOGIN_MUTATION, { username, password });

    if (errors?.length) {
      return { success: false, message: errors[0].message || 'Login failed' };
    }

    const result = data?.login;
    if (result?.success && result?.token && result?.user) {
      setAuth(result.token, result.user);
      return { success: true, user: result.user };
    }
    return { success: false, message: result?.message || 'Login failed' };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Login failed',
    };
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
