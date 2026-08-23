export function processData(data: { records: { id: string }[] }): string[] {
  return data.records.map((record) => record.id);
}
