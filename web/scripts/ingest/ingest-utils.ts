import { constants, createReadStream, existsSync } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export interface SourceMapEntry {
  id: string;
  kind: string;
  url: string;
  metadataUrl?: string;
  stagingFiles: string[];
  geographyIds?: string[];
  mappedFields?: string[];
}

export interface SourceMapDocument {
  sources: SourceMapEntry[];
  congressGovResources: Array<{ id: string; url: string; purpose: string }>;
  houseClerkRollCalls: Array<{ id: string; url: string; purpose: string }>;
}

export function snapshotArg(): string {
  const index = process.argv.indexOf('--snapshot');
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error('Pass a kebab-case --snapshot ID.');
  }
  return value;
}

export function stagingDirectory(snapshot: string): string {
  return resolve(process.cwd(), '.ingest-staging', snapshot);
}

export async function prepareNewSnapshot(snapshot: string): Promise<string> {
  const directory = stagingDirectory(snapshot);
  if (existsSync(directory)) throw new Error(`Refusing to overwrite frozen snapshot directory: ${directory}`);
  await mkdir(directory, { recursive: false });
  return directory;
}

export async function writeExclusive(path: string, value: string): Promise<void> {
  const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    await handle.writeFile(value, 'utf8');
  } finally {
    await handle.close();
  }
}

export async function fetchToFile(
  url: string,
  target: string,
  headers?: HeadersInit,
  publicReceiptUrl = url,
) {
  const response = await fetch(url, { headers, redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Official source returned HTTP ${response.status}: ${publicReceiptUrl}`);
  }
  const handle = await open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    await handle.writeFile(Buffer.from(await response.arrayBuffer()));
  } finally {
    await handle.close();
  }
  return {
    requestUrl: publicReceiptUrl,
    finalUrl: publicReceiptUrl === url ? response.url : publicReceiptUrl,
    status: response.status,
    retrievedAt: new Date().toISOString(),
    localFile: basename(target),
  };
}

export function stream(path: string) {
  return createReadStream(path);
}
