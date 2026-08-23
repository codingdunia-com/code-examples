import { type Status } from './types.js';

export type ActiveStatus = Exclude<Status, 'banned' | 'inactive'>;
export type ClosedStatus = Extract<Status, 'inactive' | 'banned'>;

export type MaybeString = string | null | undefined;
export type DefiniteString = Exclude<MaybeString, null | undefined>;

// The unions are not just type-level decoration; these arrays only accept the
// members that survived the filter.
export const openStates: ActiveStatus[] = ['active', 'pending'];
export const closedStates: ClosedStatus[] = ['inactive', 'banned'];

export function isOpen(status: Status): status is ActiveStatus {
  return (openStates as Status[]).includes(status);
}
