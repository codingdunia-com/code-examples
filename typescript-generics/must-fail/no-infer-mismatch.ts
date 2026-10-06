// The guide's own example of what NoInfer<T> is for: 'green' is not one of the
// colors, and without NoInfer it would simply widen T to include it.
function createPalette<T extends string>(colors: readonly T[], defaultColor: NoInfer<T>): Record<T, string> {
  return {} as Record<T, string>;
}

createPalette(['red', 'blue'], 'green');
