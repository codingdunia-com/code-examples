import { expect, test } from 'vitest'

test('one passing test is enough to start the coverage provider', () => {
  expect([1, 2, 3].reduce((a, b) => a + b, 0)).toBe(6)
})
