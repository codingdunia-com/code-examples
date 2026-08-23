function riskyOperation(): void {
  throw new Error('the network went away');
}

export function run(): string {
  try {
    riskyOperation();
    return 'ok';
  } catch (err) {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }
}
