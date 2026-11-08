export interface Source {
  id: number;
  n: number;
  document: string;
  section: string;
  content: string;
}

export const SYSTEM_PROMPT = `You are a manual assistant for workers on a factory floor.
Answer ONLY with information that is written in the numbered manual excerpts you are given.

Rules:
- Put the excerpt number in square brackets at the END of each sentence or step it supports, like "... 25 N·m [2]." Only cite an excerpt that really contains that fact.
- If the excerpts do not answer the question, reply only: "I couldn't find this in the manuals. Please ask your supervisor." (translated into the question's language). Never guess or add knowledge of your own.
- Copy numbers, limits, codes and units exactly as written. A wrong torque value or speed can hurt someone.
- If a safety step is relevant (lockout/tagout, PPE, emergency stop), mention it first.
- Keep answers short and practical. Use a numbered list when there are several steps.
- Reply in the same language as the question, even if the excerpts are in English.

Example:
Excerpts: [1] Pump Manual — Start-up: "Open the inlet valve fully before starting. Never run the pump dry."
Question: How do I start the pump?
Answer:
1. Open the inlet valve fully [1].
2. Then start the pump. Never run it dry [1].`;

export function buildUserPrompt(question: string, sources: Source[]): string {
  const excerpts = sources
    .map((s) => `[${s.n}] ${s.document} — ${s.section}\n${s.content}`)
    .join("\n\n---\n\n");
  const lang = languageOf(question);
  // Small local models sometimes drift into another language, so state it explicitly.
  const langRule = lang === "English" ? "" : `\n\nWrite the whole answer in ${lang}.`;
  return `Manual excerpts:\n\n${excerpts || "(no excerpts found)"}\n\nQuestion: ${question}${langRule}`;
}

/** Rough language detection by script, good enough to tell the model which language to use. */
export function languageOf(text: string): string {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "Japanese";
  if (/\p{Script=Hangul}/u.test(text)) return "Korean";
  if (/\p{Script=Han}/u.test(text)) return "Chinese";
  if (/\p{Script=Cyrillic}/u.test(text)) return "Russian";
  return "English";
}

export const SEARCH_QUERY_PROMPT = `Translate the user's question into English so it can be used to search an English technical manual.
Keep machine names, alarm codes, part numbers and units unchanged.
Output only the English question, nothing else.`;

/** True when the question is mostly non-Latin text (e.g. Japanese or Russian). */
export function needsTranslation(question: string): boolean {
  const letters = question.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return false;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  return latin / letters.length < 0.5;
}
