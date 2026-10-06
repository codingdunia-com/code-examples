// The guide's generic-hook shape, minus React. A custom hook is a function
// returning a tuple whose type follows its argument, and that relationship is
// what generics express; rendering is not what is being claimed here.

export type Setter<T> = (next: T) => void;

export function createState<T>(initial: T): [T, Setter<T>] {
  let current = initial;
  return [current, (next: T) => { current = next; }];
}

// NoInfer<T> from TypeScript 5.4, exactly as the guide describes it: the first
// argument decides T, the second only has to match it.
export function createPalette<T extends string>(
  colors: readonly T[],
  defaultColor: NoInfer<T>,
): Record<T, string> {
  const palette = {} as Record<T, string>;
  for (const color of colors) {
    palette[color] = color === defaultColor ? `${color} (default)` : color;
  }
  return palette;
}
