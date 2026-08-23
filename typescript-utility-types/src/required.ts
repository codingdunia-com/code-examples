import { type Config } from './types.js';

// After loading and validation, every field must be present.
export type ResolvedConfig = Required<Config>;

export function validateConfig(raw: Config): ResolvedConfig {
  if (raw.apiUrl === undefined) {
    throw new Error('apiUrl is required');
  }
  return {
    apiUrl: raw.apiUrl,
    timeout: raw.timeout ?? 5000,
    retries: raw.retries ?? 3,
  };
}
