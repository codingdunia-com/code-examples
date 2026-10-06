// Runs every generic in the guide and asserts what it produces. A generic that
// only type-checks proves less than people assume, so the ones that carry values
// are executed here.
import assert from 'node:assert/strict';
import { indexById, first, type HasId } from './constraints.js';
import { wrap, unwrap, type ApiResponse } from './api.js';
import { createState, createPalette } from './hook.js';
import { partiallyUnset, unwrappedIsString, unwrappedPassesThrough, type Settings } from './conditional.js';

interface User extends HasId {
  readonly id: string;
  readonly name: string;
}

const users: readonly User[] = [
  { id: 'u1', name: 'Ada' },
  { id: 'u2', name: 'Grace' },
];

// The constraint gives the body .id; the generic gives the caller User back.
const byId = indexById(users);
assert.equal(byId.size, 2);
assert.equal(byId.get('u2')?.name, 'Grace');

// first() returns User | undefined, not HasId | undefined. If the generic were
// widened to the constraint, .name below would not exist.
const head = first(users);
assert.equal(head?.name, 'Ada');
assert.equal(first([]), undefined);

// The envelope carries its payload type through wrap and back out of unwrap.
const response: ApiResponse<readonly User[]> = wrap(users);
assert.equal(unwrap(response).length, 2);
assert.equal(response.status, 200);
assert.throws(() => unwrap(wrap('nope', 503)), /failed with 503/);

const [value, setValue] = createState(41);
assert.equal(value, 41);
setValue(42); // typed as (next: number) => void, so this compiles and 'x' would not

// NoInfer: T comes from the array, the default only has to match it.
const palette = createPalette(['red', 'blue'], 'red');
assert.equal(palette.red, 'red (default)');
assert.equal(palette.blue, 'blue');
assert.deepEqual(Object.keys(palette).sort(), ['blue', 'red']);

// Conditional and mapped types, checked through the values that inhabit them.
assert.equal(unwrappedIsString, 'strings survive');
assert.equal(unwrappedPassesThrough, 7);
assert.equal(partiallyUnset.theme, null);
assert.equal(partiallyUnset.fontSize, 14);

const settings: Settings = { theme: 'dark', fontSize: 16 };
assert.equal(settings.theme, 'dark');

console.log('runtime: every generic in the guide produced what the article says it does');
