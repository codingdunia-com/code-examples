// ReturnType of an async function is the Promise, not the value inside it.
import { type FetchUserPromise } from '../src/function-types.js';

export function currentName(pending: FetchUserPromise): string {
  return pending.name;
}
