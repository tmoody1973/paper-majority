import { createHash } from 'node:crypto';
import { constants, createReadStream, existsSync } from 'node:fs';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

export interface SourceMapEntry {
  id: string;
  kind: string;
  url: string;
  metadataUrl?: string;
  stagingFiles: string[];
  geographyIds?: string[];
  mappedFields?: string[];
  districtRecords?: Array<{ districtId: string; geographyId: string; url: string }>;
}

export interface SourceMapDocument {
  sources: SourceMapEntry[];
  congressGovResources: Array<{ id: string; url: string; purpose: string }>;
  houseClerkRollCalls: Array<{ id: string; url: string; purpose: string }>;
}

export interface ProducerRecord {
  requestUrl: string;
  finalUrl: string;
  status: number;
  retrievedAt: string;
  path: string;
  bytes: number;
  sha256: string;
}

export function snapshotArg(): string {
  const index = process.argv.indexOf('--snapshot');
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error('Pass a kebab-case --snapshot ID.');
  }
  return value;
}

export function stagingDirectory(snapshot: string, root = process.cwd()): string {
  return resolve(root, '.ingest-staging', snapshot);
}

export async function prepareSnapshot(snapshot: string, root = process.cwd()): Promise<string> {
  const directory = stagingDirectory(snapshot, root);
  if (['vertical-slice.candidate.json', 'normalized-sources.json', 'normalized-manifest.json']
    .some((name) => existsSync(resolve(directory, name)))) {
    throw new Error(`Refusing to append to frozen normalized snapshot: ${directory}`);
  }
  await mkdir(resolve(directory, 'source-data'), { recursive: true });
  await mkdir(resolve(directory, 'receipts'), { recursive: true });
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
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(target), { recursive: true });
  const handle = await open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
  return {
    requestUrl: publicReceiptUrl,
    finalUrl: publicReceiptUrl === url ? response.url : publicReceiptUrl,
    status: response.status,
    retrievedAt: new Date().toISOString(),
    path: relative(resolve(target, '../..'), target),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifiedProducerRecords(
  directory: string,
  sources: SourceMapEntry[],
): Promise<Array<{ path: string; bytes: number; sha256: string }>> {
  const records = new Map<string, { path: string; bytes: number; sha256: string }>();
  const researchManifest = resolve(directory, 'research-input-manifest.json');
  if (existsSync(researchManifest)) {
    const parsed = JSON.parse(await readFile(researchManifest, 'utf8')) as {
      files: Array<{ path: string; bytes: number; sha256: string }>;
    };
    for (const record of parsed.files) records.set(record.path, record);
  }
  const receiptDirectory = resolve(directory, 'receipts');
  if (existsSync(receiptDirectory)) {
    for (const name of (await readdir(receiptDirectory)).filter((entry) => entry.endsWith('.json')).sort()) {
      const parsed = JSON.parse(await readFile(resolve(receiptDirectory, name), 'utf8')) as {
        records?: Array<{ path: string; bytes: number; sha256: string }>;
      };
      for (const record of parsed.records ?? []) {
        const prior = records.get(record.path);
        if (prior && (prior.sha256 !== record.sha256 || prior.bytes !== record.bytes)) {
          throw new Error(`Conflicting producer receipts for ${record.path}`);
        }
        records.set(record.path, record);
      }
    }
  }
  const required = new Set(sources.flatMap((source) => source.stagingFiles.map((name) => `source-data/${name}`)));
  for (const path of required) if (!records.has(path)) throw new Error(`No producer receipt for mapped input: ${path}`);
  const verified = [];
  for (const record of [...records.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const path = resolve(directory, record.path);
    const sha256 = await fileSha256(path);
    if (sha256 !== record.sha256) throw new Error(`Producer input checksum mismatch: ${record.path}`);
    verified.push(record);
  }
  return verified;
}

export function stream(path: string) {
  return createReadStream(path);
}
