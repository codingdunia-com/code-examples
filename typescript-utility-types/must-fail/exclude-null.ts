// Exclude<MaybeString, null | undefined> is string, and only string.
import { type DefiniteString } from '../src/exclude-extract.js';

export const nothing: DefiniteString = null;
