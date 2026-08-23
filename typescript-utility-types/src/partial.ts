import { type User } from './types.js';

// Every field optional, which is exactly what a PATCH body is.
export type UserUpdate = Partial<User>;

export function applyUpdate(user: User, changes: UserUpdate): User {
  return { ...user, ...changes };
}
