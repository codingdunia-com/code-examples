// Proof that the key union is real: a name that is not in the registry fails.
import { type CommandName } from './command-registry.js';

export const unknown: CommandName = 'publish';
