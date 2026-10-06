// A caller that does not satisfy the constraint. Numbers have no .id.
interface HasId {
  readonly id: string;
}

function indexById<T extends HasId>(items: readonly T[]): readonly T[] {
  return items;
}

indexById([1, 2, 3]);
