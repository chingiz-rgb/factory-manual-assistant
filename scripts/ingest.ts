/**
 * npm run ingest — rebuilds the search index from the manuals folder.
 * Stop the dev server first: the embedded database can only be opened by one process.
 */
import { closeDb } from "../src/lib/db";
import { ingestAll } from "../src/lib/ingest";

async function main() {
  const started = Date.now();
  console.log("Indexing manuals...");
  const result = await ingestAll(console.log);
  console.log(
    `Done: ${result.documents} documents, ${result.chunks} chunks` +
      (result.embedded ? " (keyword + vector search)" : " (keyword search only)") +
      ` in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  if (result.warning) console.warn(result.warning);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
