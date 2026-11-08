import { config } from "./config";

/** Thin client for the local Ollama server (https://ollama.com). */
async function post(path: string, body: { model: string }): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${config.ollamaUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      `Can't reach Ollama at ${config.ollamaUrl}. Is it installed and running? (see README)`,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 && /not found/i.test(text)) {
      throw new Error(`Ollama model "${body.model}" is missing. Run: ollama pull ${body.model}`);
    }
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }
  return res;
}

/**
 * Turns text into vectors. nomic-embed-text expects a task prefix,
 * so documents and questions are embedded slightly differently.
 */
export async function embed(texts: string[], kind: "document" | "query"): Promise<number[][]> {
  const prefix = kind === "document" ? "search_document: " : "search_query: ";
  const res = await post("/api/embed", {
    model: config.ollamaEmbedModel,
    input: texts.map((t) => prefix + t),
  } as { model: string });
  const data = (await res.json()) as { embeddings: number[][] };
  return data.embeddings;
}

/** Streams a chat answer token by token. */
export async function* ollamaChat(system: string, user: string): AsyncGenerator<string> {
  const res = await post("/api/chat", {
    model: config.ollamaChatModel,
    stream: true,
    options: { temperature: 0.1 },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  } as { model: string });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (msg.error) throw new Error(msg.error);
      if (msg.message?.content) yield msg.message.content;
    }
  }
}
