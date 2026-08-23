// useUnknownInCatchVariables: err is unknown, and unknown has no .message.
function riskyOperation(): void {
  throw new Error('the network went away');
}

export function run(): string {
  try {
    riskyOperation();
    return 'ok';
  } catch (err) {
    return err.message;
  }
}
