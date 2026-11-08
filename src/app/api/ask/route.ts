import { answerStream, complete } from "@/lib/answer";
import { config } from "@/lib/config";
import { indexStats, ingestAll } from "@/lib/ingest";
import {
  buildUserPrompt,
  needsTranslation,
  SEARCH_QUERY_PROMPT,
  SYSTEM_PROMPT,
} from "@/lib/prompt";
import { hybridSearch } from "@/lib/search";

/**
 * POST { question } → a stream of newline-delimited JSON events:
 *   { type: "searchQuery", text }  English search text (only for non-English questions)
 *   { type: "sources", sources }   the manual excerpts used
 *   { type: "token", text }        part of the answer
 *   { type: "error", message }
 *   { type: "done" }
 */
export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  const q = question?.trim();
  if (!q) return Response.json({ error: "Question is empty" }, { status: 400 });
  if (q.length > 1000) return Response.json({ error: "Question is too long" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        // First run: build the index automatically.
        if ((await indexStats()).chunks === 0) await ingestAll();

        // The manuals are in English: search with an English version of the question,
        // but answer the original question so the reply stays in the worker's language.
        let searchQuery = q;
        if (needsTranslation(q)) {
          searchQuery = (await complete(SEARCH_QUERY_PROMPT, q)) || q;
          send({ type: "searchQuery", text: searchQuery });
        }
        const sources = await hybridSearch(searchQuery, config.topK);
        send({ type: "sources", sources });

        if (sources.length === 0) {
          send({
            type: "token",
            text: "I couldn't find anything about this in the manuals. Please ask your supervisor.",
          });
        } else {
          for await (const text of answerStream(SYSTEM_PROMPT, buildUserPrompt(q, sources))) {
            send({ type: "token", text });
          }
        }
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
