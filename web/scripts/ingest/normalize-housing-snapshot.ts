import { createHash } from 'node:crypto';
import { constants, createReadStream, existsSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createInterface } from 'node:readline';

import { canonicalSha256 } from '../../src/persistence/canonicalHash';
import { parseScenario } from '../../src/content/schema';
import sourceMap from '../../src/content/housing/source-map.json';
import candidate from '../../src/content/housing/vertical-slice.candidate.json';
import { snapshotArg, stagingDirectory, writeExclusive } from './ingest-utils';

async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function extractMappedCensus(path: string) {
  const mapping = sourceMap.sources.find((entry) => entry.kind === 'census-table');
  if (!mapping?.geographyIds || !mapping.mappedFields) throw new Error('Census table mapping is incomplete.');
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let header: string[] | undefined;
  const rows: Record<string, string>[] = [];
  for await (const line of lines) {
    const cells = line.split('|');
    if (!header) {
      header = cells;
      continue;
    }
    if (!mapping.geographyIds.includes(cells[0] ?? '')) continue;
    const row = Object.fromEntries(mapping.mappedFields.map((field) => {
      const index = header!.indexOf(field);
      if (index < 0) throw new Error(`Mapped Census field is absent: ${field}`);
      return [field, cells[index]];
    }));
    rows.push(row);
  }
  if (rows.length !== mapping.geographyIds.length) throw new Error(`Expected ${mapping.geographyIds.length} mapped Census rows; found ${rows.length}.`);
  return rows.sort((a, b) => a.GEO_ID.localeCompare(b.GEO_ID));
}

async function main(): Promise<void> {
  const snapshot = snapshotArg();
  const directory = stagingDirectory(snapshot);
  const candidateTarget = resolve(directory, 'vertical-slice.candidate.json');
  const sourcesTarget = resolve(directory, 'normalized-sources.json');
  const manifestTarget = resolve(directory, 'normalized-manifest.json');
  if ([candidateTarget, sourcesTarget, manifestTarget].some(existsSync)) {
    throw new Error(`Refusing to overwrite normalized snapshot outputs: ${snapshot}`);
  }
  const inputManifestPath = resolve(directory, 'research-input-manifest.json');
  const inputManifest = JSON.parse(await readFile(inputManifestPath, 'utf8')) as {
    files: Array<{ path: string; bytes: number; sha256: string }>;
  };
  const verified = [];
  for (const entry of inputManifest.files) {
    const path = resolve(directory, entry.path);
    const sha256 = await fileSha256(path);
    if (sha256 !== entry.sha256) throw new Error(`Frozen input checksum mismatch: ${entry.path}`);
    verified.push({ path: entry.path, bytes: entry.bytes, sha256 });
  }
  const census = sourceMap.sources.find((entry) => entry.kind === 'census-table');
  if (!census) throw new Error('No mapped Census table.');
  const censusRows = await extractMappedCensus(resolve(directory, 'source-data', census.stagingFiles[0]));
  const parsed = parseScenario(candidate);
  await copyFile(resolve(process.cwd(), 'src/content/housing/vertical-slice.candidate.json'), candidateTarget, constants.COPYFILE_EXCL);
  await writeExclusive(sourcesTarget, `${JSON.stringify({ censusRows }, null, 2)}\n`);
  await writeExclusive(manifestTarget, `${JSON.stringify({
    snapshot,
    candidate: true,
    humanReviewPending: true,
    promoted: false,
    scenarioSha256: canonicalSha256(parsed),
    sourceMapSha256: canonicalSha256(sourceMap),
    rawInputsVerified: verified,
    selectedCensusRows: censusRows.length,
    output: basename(candidateTarget),
  }, null, 2)}\n`);
  console.log(`Normalized candidate only: cards=${parsed.cards.length} mappedCensusRows=${censusRows.length} rawChecksums=${verified.length}`);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
