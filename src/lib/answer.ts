import { config } from "./config";
import { ollamaChat } from "./ollama";
import { claudeChat } from "./claude";

export function answerStream(system: string, user: string): AsyncGenerator<string> {
  return config.llmProvider === "anthropic" ? claudeChat(system, user) : ollamaChat(system, user);
}

export function modelLabel(): string {
  return config.llmProvider === "anthropic"
    ? `Claude (${config.claudeModel})`
    : `${config.ollamaChatModel} · local`;
}
