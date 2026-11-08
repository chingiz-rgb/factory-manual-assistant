import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chunkMarkdown, chunkPages, type Chunk } from "./chunk";
import { config } from "./config";
import { getDb, toVectorLiteral } from "./db";
import { embed } from "./ollama";

const SUPPORTED = new Set([".md", ".txt", ".pdf"]);

async function parse(file: string): Promise<{ title: string; chunks: Chunk[] }> {
  const ext = path.extname(file).toLowerCase();
  const fallbackTitle = path.basename(file, ext).replace(/[-_]/g, " ");
  if (ext === ".pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(file)));
    const { text } = await extractText(pdf, { mergePages: false });
    return { title: fallbackTitle, chunks: chunkPages(text) };
  }
  const text = await readFile(file, "utf8");
  if (ext === ".md") {
    const h1 = /^#\s+(.+)$/m.exec(text)?.[1]?.trim();
    return { title: h1 ?? fallbackTitle, chunks: chunkMarkdown(text) };
  }
  return { title: fallbackTitle, chunks: chunkPages(text.split(/\f/)) };
}

export interface IngestResult {
  documents: number;
  chunks: number;
  embedded: boolean;
  warning?: string;
}

/** Re-reads every manual in the manuals folder and rebuilds the search index. */
export async function ingestAll(log: (msg: string) => void = () => {}): Promise<IngestResult> {
  const db = await getDb();
  const dir = path.resolve(config.manualsDir);
  const files = (await readdir(dir))
    .filter((f) => SUPPORTED.has(path.extname(f).toLowerCase()))
    .sort();

  await db.exec("TRUNCATE chunks, documents RESTART IDENTITY CASCADE;");

  let total = 0;
  let embedded = true;
  let warning: string | undefined;

  for (const name of files) {
    const parsed = await parse(path.join(dir, name));
    const title = parsed.title;
    // "CL-200 Manual > 5. Alarm Codes" → "5. Alarm Codes" (the title is shown separately).
    const chunks = parsed.chunks.map((c) => ({
      ...c,
      section:
        c.section === title
          ? "Introduction"
          : c.section.startsWith(`${title} > `)
            ? c.section.slice(title.length + 3)
            : c.section,
    }));
    const doc = await db.query<{ id: number }>(
      "INSERT INTO documents (name, title) VALUES ($1, $2) RETURNING id",
      [name, title],
    );
    const docId = doc.rows[0].id;

    let vectors: (number[] | null)[] = chunks.map(() => null);
    if (embedded) {
      try {
        vectors = await embed(
          chunks.map((c) => `${title} — ${c.section}\n${c.content}`),
          "document",
        );
      } catch (err) {
        embedded = false;
        warning = `Indexed for keyword search only: ${(err as Error).message}`;
        log(warning);
      }
    }

    for (const [i, c] of chunks.entries()) {
      const v = vectors[i];
      await db.query(
        `INSERT INTO chunks (document_id, position, section, content, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [docId, i, c.section, c.content, v ? toVectorLiteral(v) : null],
      );
    }
    total += chunks.length;
    log(`  ${name}: ${chunks.length} chunks`);
  }
  return { documents: files.length, chunks: total, embedded, warning };
}

export async function indexStats(): Promise<{ documents: number; chunks: number; embedded: number }> {
  const db = await getDb();
  const r = await db.query<{ documents: number; chunks: number; embedded: number }>(
    `SELECT (SELECT count(*)::int FROM documents) AS documents,
            (SELECT count(*)::int FROM chunks) AS chunks,
            (SELECT count(*)::int FROM chunks WHERE embedding IS NOT NULL) AS embedded`,
  );
  return r.rows[0];
}
