import sourceMap from '../../src/content/housing/source-map.json';
import { fetchToFile, prepareSnapshot, snapshotArg, writeExclusive } from './ingest-utils';

async function main(): Promise<void> {
  const snapshot = snapshotArg();
  const directory = await prepareSnapshot(snapshot);
  const mapped = sourceMap.sources.filter((entry) => entry.kind === 'census-table');
  const records = [];
  for (const entry of mapped) {
    records.push(await fetchToFile(entry.url, `${directory}/source-data/${entry.stagingFiles[0]}`));
    if (entry.metadataUrl && entry.stagingFiles[1]) {
      records.push(await fetchToFile(entry.metadataUrl, `${directory}/source-data/${entry.stagingFiles[1]}`));
    }
  }
  await writeExclusive(`${directory}/receipts/census.json`, `${JSON.stringify({
    snapshot,
    mapped: mapped.length,
    fetched: records.length,
    skipped: [],
    records,
  }, null, 2)}\n`);
  console.log(`Census tables mapped=${mapped.length} fetched=${records.length} skipped=0`);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
