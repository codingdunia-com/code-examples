// noUncheckedIndexedAccess: items[0] is string | undefined, not string.
const items = ['a', 'b', 'c'];
const first = items[0];
export const shouted = first.toUpperCase();
