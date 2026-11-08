import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { config } from "./config";

/**
 * Embedded PostgreSQL (PGlite) with the pgvector extension.
 * Real Postgres compiled to WebAssembly, so nothing extra needs to be installed.
 * One shared instance per process (Next.js dev reloads would otherwise open the folder twice).
 */
const globalForDb = globalThis as unknown as { __pg?: Promise<PGlite> };

async function open(): Promise<PGlite> {
  await mkdir(path.dirname(path.resolve(config.dataDir)), { recursive: true });
  const db = new PGlite({ dataDir: config.dataDir, extensions: { vector } });
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE IF NOT EXISTS documents (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      title      TEXT NOT NULL,
      indexed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id          SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL,
      section     TEXT NOT NULL,
      content     TEXT NOT NULL,
      embedding   vector,
      tsv         tsvector GENERATED ALWAYS AS
                    (to_tsvector('english', section || ' ' || content)) STORED
    );
    CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING GIN (tsv);
  `);
  return db;
}

export function getDb(): Promise<PGlite> {
  globalForDb.__pg ??= open();
  return globalForDb.__pg;
}

export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
