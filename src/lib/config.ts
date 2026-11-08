/** Central place for every setting. All values can be overridden in .env.local. */
export const config = {
  /** "ollama" (free, runs locally) or "anthropic" (Claude API, needs ANTHROPIC_API_KEY). */
  llmProvider: (process.env.LLM_PROVIDER ?? "ollama") as "ollama" | "anthropic",
  ollamaUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  ollamaChatModel: process.env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b",
  ollamaEmbedModel: process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text",
  claudeModel: process.env.CLAUDE_MODEL ?? "claude-opus-5-5",
  /** Folder with the manuals to index (.md, .txt, .pdf). */
  manualsDir: process.env.MANUALS_DIR ?? "manuals",
  /** Where the embedded PostgreSQL (PGlite) keeps its files. */
  dataDir: process.env.DATA_DIR ?? ".data/pglite",
  /** How many manual excerpts are given to the model per question. */
  topK: Number(process.env.TOP_K ?? 5),
};
