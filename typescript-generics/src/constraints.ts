// `<T extends ...>` from the guide's constraint section. The constraint is what
// lets the body touch `.id` at all; without it the property access is an error,
// which is the point must-fail/constraint-missing.ts pins down.

export interface HasId {
  readonly id: string;
}

export function indexById<T extends HasId>(items: readonly T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) {
    out.set(item.id, item);
  }
  return out;
}

// The return type mirrors the input, which is the guide's rule for when a
// generic earns its place. `first` of a User[] is a User, not a HasId.
export function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}
