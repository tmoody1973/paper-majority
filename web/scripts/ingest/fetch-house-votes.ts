import sourceMap from '../../src/content/housing/source-map.json';
import { fetchToFile, prepareSnapshot, snapshotArg, writeExclusive, type SourceMapDocument } from './ingest-utils';

async function main(): Promise<void> {
  const snapshot = snapshotArg();
  const directory = await prepareSnapshot(snapshot);
  const mapped = (sourceMap as SourceMapDocument).houseClerkRollCalls;
  const records = [];
  for (const entry of mapped) {
    records.push(await fetchToFile(entry.url, `${directory}/source-data/${entry.id}.html`));
  }
  await writeExclusive(`${directory}/receipts/house-votes.json`, `${JSON.stringify({
    snapshot,
    mapped: mapped.length,
    fetched: records.length,
    skipped: mapped.length === 0
      ? ['No House roll-call result is used by this Session candidate.']
      : [],
    records,
  }, null, 2)}\n`);
  console.log(`House Clerk roll calls mapped=${mapped.length} fetched=${records.length} skipped=${mapped.length === 0 ? 1 : 0}`);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
