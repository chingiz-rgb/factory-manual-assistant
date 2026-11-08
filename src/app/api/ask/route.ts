import { answerStream } from "@/lib/answer";
import { config } from "@/lib/config";
import { indexStats, ingestAll } from "@/lib/ingest";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/prompt";
import { hybridSearch } from "@/lib/search";

/**
 * POST { question } → a stream of newline-delimited JSON events:
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

        const sources = await hybridSearch(q, config.topK);
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
