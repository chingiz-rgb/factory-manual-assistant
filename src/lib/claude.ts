import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

/**
 * Optional: answer with Claude instead of the local model.
 * Set LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY in .env.local.
 */
export async function* claudeChat(system: string, user: string): AsyncGenerator<string> {
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: config.claudeModel,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low" },
    // If a safety classifier declines the request, the API retries it on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    yield "\n\n(The model declined to answer this question.)";
  }
}
