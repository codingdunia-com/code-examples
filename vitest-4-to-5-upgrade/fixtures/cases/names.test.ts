import { describe, expect, test } from 'vitest'

// Used with -t. Vitest 4 joins the suite chain and the test name with a space,
// Vitest 5 joins them with " > ", so a --testNamePattern copied from an old CI
// script can match zero tests and still exit 0.
describe('cart', () => {
  test('adds an item', () => {
    expect(1).toBe(1)
  })
})

describe('other', () => {
  test('is unrelated', () => {
    expect(1).toBe(1)
  })
})
