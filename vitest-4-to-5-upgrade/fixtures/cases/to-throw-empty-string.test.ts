import { expect, test } from 'vitest'

// Vitest 4: toThrow('') only matches an error whose message is empty.
// Vitest 5: a string argument is a substring check, and every message contains ''.
test('toThrow with an empty string', () => {
  expect(() => {
    throw new Error('boom')
  }).toThrow('')
})
