import { expect, test } from 'vitest'

// toMatchFileSnapshot returns a promise too. Vitest 5 fails the test when it is not awaited.
test('unawaited toMatchFileSnapshot', () => {
  expect('hello').toMatchFileSnapshot('./__file_snapshots__/hello.txt')
})
