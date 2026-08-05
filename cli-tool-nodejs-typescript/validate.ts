// From: https://codingdunia.com/blog/building-cli-tool-nodejs-typescript/
import { stat } from 'node:fs/promises';

export async function validateFile(path: string): Promise<void> {
  const info = await stat(path); // throws ENOENT if the file doesn't exist
  if (!info.isFile()) {
    throw new Error(`${path} is not a file`);
  }
}
