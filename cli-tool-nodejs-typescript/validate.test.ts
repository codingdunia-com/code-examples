// From: https://codingdunia.com/blog/building-cli-tool-nodejs-typescript/
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateFile } from './validate.js';

describe('validateFile', () => {
  it('rejects a missing file', async () => {
    await assert.rejects(() => validateFile('/nonexistent.json'));
  });
});
