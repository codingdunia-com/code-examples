// Without `extends HasId` the body cannot reach .id. This is why the constraint
// in the guide is not decoration.
export function indexById<T>(items: readonly T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) {
    out.set(item.id, item);
  }
  return out;
}
