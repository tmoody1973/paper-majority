import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  fetchToFile,
  prepareSnapshot,
  verifiedProducerRecords,
  writeExclusive,
  type SourceMapEntry,
} from './ingest-utils';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('composable ingestion receipts', () => {
  it('lets independent producers share an unfrozen snapshot and verifies nonempty bytes for normalization', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'paper-majority-ingest-'));
    roots.push(root);
    const directory = await prepareSnapshot('portable-proof', root);
    expect(await prepareSnapshot('portable-proof', root)).toBe(directory);
    const record = await fetchToFile(
      'data:text/plain,GEO_ID%7CB25070_E001%0A5001900US1305%7C100',
      resolve(directory, 'source-data', 'tiny-b25070.dat'),
    );
    await writeExclusive(resolve(directory, 'receipts', 'census.json'), `${JSON.stringify({ records: [record] })}\n`);
    await writeExclusive(resolve(directory, 'receipts', 'congress.json'), `${JSON.stringify({ records: [] })}\n`);
    const mapping: SourceMapEntry = {
      id: 'tiny-census', kind: 'census-table', url: record.requestUrl, stagingFiles: ['tiny-b25070.dat'],
    };
    expect(record.bytes).toBeGreaterThan(0);
    await expect(verifiedProducerRecords(directory, [mapping])).resolves.toEqual([
      expect.objectContaining({ path: 'source-data/tiny-b25070.dat', bytes: record.bytes, sha256: record.sha256 }),
    ]);
    await writeExclusive(resolve(directory, 'normalized-manifest.json'), '{}');
    await expect(prepareSnapshot('portable-proof', root)).rejects.toThrow(/frozen normalized snapshot/);
  });
});
