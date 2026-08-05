// From: https://codingdunia.com/blog/building-cli-tool-nodejs-typescript/
import { mkdir, copyFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export async function processFile(inputFile: string, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await copyFile(inputFile, join(outputDir, basename(inputFile)));
}
