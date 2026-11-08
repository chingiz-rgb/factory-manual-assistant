import { connection } from "next/server";
import { modelLabel } from "@/lib/answer";
import { indexStats, ingestAll } from "@/lib/ingest";

/** GET → index status shown in the header. */
export async function GET() {
  await connection(); // always run at request time, never prerender
  try {
    return Response.json({ ...(await indexStats()), model: modelLabel() });
  } catch (err) {
    return Response.json({ error: (err as Error).message, model: modelLabel() }, { status: 500 });
  }
}

/** POST → rebuild the index from the manuals folder. */
export async function POST() {
  try {
    const result = await ingestAll();
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
