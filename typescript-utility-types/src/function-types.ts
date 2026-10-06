import { type Config, type User } from './types.js';

export async function fetchUser(id: string, includeRole = false): Promise<User> {
  return {
    id,
    name: 'Ada',
    email: 'ada@example.com',
    role: includeRole ? 'admin' : 'viewer',
  };
}

// Derived from the function, so they cannot drift from it.
export type FetchUserArgs = Parameters<typeof fetchUser>;
export type FetchUserPromise = ReturnType<typeof fetchUser>;
export type FetchUserResult = Awaited<ReturnType<typeof fetchUser>>;

// Wrap any function without retyping its signature. Inferring the argument
// tuple and the return type separately keeps both exact.
export function withCallLog<A extends unknown[], R>(
  fn: (...args: A) => R,
  log: string[],
): (...args: A) => R {
  return (...args) => {
    log.push(args.map(String).join(','));
    return fn(...args);
  };
}

export const loggedFetchUser = withCallLog(fetchUser, []);

export const DEFAULTS: Readonly<Config> = Object.freeze({ timeout: 5000, retries: 3 });
