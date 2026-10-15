import { expect, test } from 'vitest'

// The assertion is TRUE, it just is not awaited. Vitest 4 lets this pass silently.
// Vitest 5 fails the test, because it can no longer guarantee the assertion finished.
test('unawaited resolves that would pass', () => {
  expect(Promise.resolve(1)).resolves.toBe(1)
})
