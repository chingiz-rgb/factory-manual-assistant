/**
 * Splits manuals into small, citable pieces ("chunks").
 * Each chunk remembers where it came from (section heading or PDF page),
 * so answers can point the worker to the exact place in the manual.
 */
export interface Chunk {
  section: string;
  content: string;
}

const MAX_CHARS = 1200;

/** Markdown: one chunk per heading section; long sections are split by paragraph. */
export function chunkMarkdown(text: string): Chunk[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const headingPath: string[] = [];
  const sections: { section: string; lines: string[] }[] = [];
  let current = { section: "", lines: [] as string[] };

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      if (current.lines.join("").trim()) sections.push(current);
      const level = m[1].length;
      headingPath.length = level - 1;
      headingPath[level - 1] = m[2].trim();
      current = { section: headingPath.filter(Boolean).join(" > "), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.join("").trim()) sections.push(current);

  return sections.flatMap((s) =>
    splitLong(s.lines.join("\n").trim()).map((content) => ({
      section: s.section || "Introduction",
      content,
    })),
  );
}

/** PDF / plain text: one or more chunks per page. */
export function chunkPages(pages: string[]): Chunk[] {
  return pages.flatMap((page, i) =>
    splitLong(page.trim()).map((content) => ({ section: `Page ${i + 1}`, content })),
  );
}

/** Packs paragraphs into pieces of at most MAX_CHARS without cutting a paragraph in half. */
export function splitLong(text: string, max = MAX_CHARS): string[] {
  if (!text) return [];
  if (text.length <= max) return [text];
  const paragraphs = text.split(/\n\s*\n/);
  const out: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (buf && buf.length + p.length + 2 > max) {
      out.push(buf.trim());
      buf = "";
    }
    if (p.length > max) {
      // A single huge paragraph: fall back to sentence-sized pieces.
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      out.push(...splitWords(p, max));
      continue;
    }
    buf += (buf ? "\n\n" : "") + p;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/** Packs words into pieces of at most `max` characters (used for huge paragraphs). */
function splitWords(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > max) {
      out.push(line);
      line = "";
    }
    // A single "word" longer than max (e.g. a long URL) is cut hard.
    for (let w = word; w; w = w.slice(max)) {
      if (w.length > max) out.push(w.slice(0, max));
      else line += (line ? " " : "") + w;
      if (w.length <= max) break;
    }
  }
  if (line) out.push(line);
  return out;
}
