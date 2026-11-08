import { getDb, toVectorLiteral } from "./db";
import { embed } from "./ollama";
import { reciprocalRankFusion } from "./rank";
import type { Source } from "./prompt";

/**
 * Hybrid search: keyword (Postgres full-text) + meaning (pgvector), fused with RRF.
 * If the embedding model is unavailable, keyword search still works on its own.
 */
export async function hybridSearch(question: string, k: number): Promise<Source[]> {
  const db = await getDb();
  const pool = 20;

  const keyword = await db.query<{ id: number }>(
    `SELECT id FROM chunks
     WHERE tsv @@ websearch_to_tsquery('english', $1)
     ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('english', $1)) DESC
     LIMIT $2`,
    [question, pool],
  );

  let semanticIds: number[] = [];
  try {
    const [qv] = await embed([question], "query");
    const semantic = await db.query<{ id: number }>(
      `SELECT id FROM chunks WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector LIMIT $2`,
      [toVectorLiteral(qv), pool],
    );
    semanticIds = semantic.rows.map((r) => r.id);
  } catch (err) {
    console.warn("[search] vector search skipped:", (err as Error).message);
  }

  const ids = reciprocalRankFusion([keyword.rows.map((r) => r.id), semanticIds]).slice(0, k);
  if (ids.length === 0) return [];

  const rows = await db.query<{ id: number; title: string; section: string; content: string }>(
    `SELECT c.id, d.title, c.section, c.content
     FROM chunks c JOIN documents d ON d.id = c.document_id
     WHERE c.id = ANY($1::int[])`,
    [ids],
  );
  const byId = new Map(rows.rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r, i) => ({
      id: r.id,
      n: i + 1,
      document: r.title,
      section: r.section,
      content: r.content,
    }));
}
