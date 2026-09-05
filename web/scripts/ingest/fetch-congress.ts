import sourceMap from '../../src/content/housing/source-map.json';
import { fetchToFile, prepareSnapshot, snapshotArg, writeExclusive, type SourceMapDocument } from './ingest-utils';

async function main(): Promise<void> {
  const snapshot = snapshotArg();
  const directory = await prepareSnapshot(snapshot);
  const key = process.env.CONGRESS_API_KEY;
  const mapped = (sourceMap as SourceMapDocument).congressGovResources;
  if (mapped.length > 0 && !key) {
    throw new Error('CONGRESS_API_KEY is required for the mapped Congress.gov resources.');
  }
  const records = [];
  for (const entry of mapped) {
    const separator = entry.url.includes('?') ? '&' : '?';
    records.push(await fetchToFile(
      `${entry.url}${separator}api_key=${encodeURIComponent(key!)}`,
      `${directory}/source-data/${entry.id}.json`,
      undefined,
      entry.url,
    ));
  }
  await writeExclusive(`${directory}/receipts/congress.json`, `${JSON.stringify({
    snapshot,
    mapped: mapped.length,
    fetched: records.length,
    skipped: mapped.length === 0
      ? ['No Congress.gov legislative-history source is mapped for this candidate.']
      : [],
    records,
  }, null, 2)}\n`);
  console.log(`Congress.gov mapped=${mapped.length} fetched=${records.length} skipped=${mapped.length === 0 ? 1 : 0}`);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
