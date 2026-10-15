export default {
  test: {
    include: ['*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text'] },
  },
}
