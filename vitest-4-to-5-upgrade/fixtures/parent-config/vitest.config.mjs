// Lives one directory ABOVE the test. Vitest 4 walks up the tree and finds it, Vitest 5
// does not, so the globals it enables silently disappear.
export default { test: { globals: true } }
