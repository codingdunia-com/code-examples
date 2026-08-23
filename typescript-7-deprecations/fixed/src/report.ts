// Ordinary code. Nothing here is deprecated; the tsconfig next to it is.
// The point of this file is that the compiler never gets far enough to check it.
export interface Row {
  label: string;
  ms: number;
}

export function slowest(rows: Row[]): Row | undefined {
  return rows.reduce<Row | undefined>((worst, row) => {
    if (worst === undefined || row.ms > worst.ms) {
      return row;
    }
    return worst;
  }, undefined);
}
