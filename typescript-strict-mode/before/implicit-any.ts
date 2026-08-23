// noImplicitAny: nothing describes what data is, so the compiler refuses to guess.
export function processData(data) {
  return data.records.map((r) => r.id);
}
