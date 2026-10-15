import { expect, test } from 'vitest'

// The assertion is FALSE and not awaited. Vitest 4.1.11 already fails this one (it
// auto-awaits hanging assertions at the end of the test and prints a warning), so
// this is NOT a v4 to v5 difference. Both versions are expected to fail here.
test('unawaited resolves that would fail', () => {
  expect(Promise.resolve(1)).resolves.toBe(2)
})
