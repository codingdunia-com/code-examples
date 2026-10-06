// Runtime proof that the typed helpers above actually do what the types promise.
// Compiled by tsc, then executed by node. If an assertion fails, npm test fails.
import assert from 'node:assert/strict';

import { applyUpdate } from './partial.js';
import { validateConfig } from './required.js';
import { toCard, toPublic } from './pick-omit.js';
import { describe, statusMessages } from './record.js';
import { closedStates, isOpen, openStates } from './exclude-extract.js';
import { DEFAULTS, fetchUser, loggedFetchUser, type FetchUserArgs, type FetchUserResult } from './function-types.js';
import { type HttpStatus, type Product, type User } from './types.js';

const user: User = { id: 'u-1', name: 'Ada', email: 'ada@example.com', role: 'viewer' };

assert.equal(applyUpdate(user, { name: 'Alice' }).name, 'Alice');
assert.equal(applyUpdate(user, { name: 'Alice' }).email, 'ada@example.com');
assert.equal(applyUpdate(user, { role: 'admin', email: 'alice@example.com' }).role, 'admin');
assert.equal(applyUpdate(user, {}).id, 'u-1');

const resolved = validateConfig({ apiUrl: 'https://example.com' });
assert.deepEqual(resolved, { apiUrl: 'https://example.com', timeout: 5000, retries: 3 });
assert.throws(() => validateConfig({}), /apiUrl is required/);

const product: Product = {
  id: 'p-1',
  name: 'Desk lamp',
  price: 4900,
  stock: 12,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-08-23'),
};

assert.deepEqual(Object.keys(toCard(product)).sort(), ['id', 'name', 'price']);
assert.deepEqual(Object.keys(toPublic(product)).sort(), ['id', 'name', 'price', 'stock']);

const allStatuses: HttpStatus[] = [200, 201, 400, 401, 403, 404, 500];
assert.equal(Object.keys(statusMessages).length, allStatuses.length);
for (const status of allStatuses) {
  assert.ok(typeof statusMessages[status] === 'string');
}
assert.equal(describe(404), '404 Not Found');

assert.deepEqual(openStates, ['active', 'pending']);
assert.deepEqual(closedStates, ['inactive', 'banned']);
assert.equal(isOpen('active'), true);
assert.equal(isOpen('banned'), false);

const args: FetchUserArgs = ['u-2', true];
const fetched: FetchUserResult = await fetchUser(...args);
assert.equal(fetched.role, 'admin');
assert.equal((await loggedFetchUser('u-3')).role, 'viewer');
assert.equal(Object.isFrozen(DEFAULTS), true);
assert.equal(DEFAULTS.timeout, 5000);

console.log('      all runtime assertions passed');
