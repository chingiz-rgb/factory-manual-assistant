import { config } from "./config";
import { ollamaChat } from "./ollama";
import { claudeChat } from "./claude";

export function answerStream(system: string, user: string): AsyncGenerator<string> {
  return config.llmProvider === "anthropic" ? claudeChat(system, user) : ollamaChat(system, user);
}

/** Runs the model to completion and returns the whole text (for short helper tasks). */
export async function complete(system: string, user: string): Promise<string> {
  let out = "";
  for await (const t of answerStream(system, user)) out += t;
  return out.trim();
}

export function modelLabel(): string {
  return config.llmProvider === "anthropic"
    ? `Claude (${config.claudeModel})`
    : `${config.ollamaChatModel} · local`;
}
