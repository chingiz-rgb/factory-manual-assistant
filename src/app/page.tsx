"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Source {
  id: number;
  n: number;
  document: string;
  section: string;
  content: string;
}

interface Turn {
  question: string;
  answer: string;
  sources: Source[];
  searchQuery?: string;
  error?: string;
  pending: boolean;
}

interface Status {
  documents?: number;
  chunks?: number;
  embedded?: number;
  model?: string;
  error?: string;
}

const EXAMPLES = [
  "What do I check before starting the lathe?",
  "The machine shows alarm E-21. What should I do?",
  "How tight should the tool holder bolts be?",
  "When should a carbide insert be replaced?",
];

/** Renders **bold** and turns [n] into clickable citation chips. */
function renderInline(text: string, onCite: (n: number) => void): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
    const cite = /^\[(\d+)\]$/.exec(part);
    if (cite) {
      const n = Number(cite[1]);
      return (
        <button
          key={i}
          onClick={() => onCite(n)}
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-amber-100 px-1 align-text-top text-[11px] font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-200"
          aria-label={`Show source ${n}`}
        >
          {n}
        </button>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function Answer({ text, onCite }: { text: string; onCite: (n: number) => void }) {
  return (
    <div className="space-y-1.5 leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const list = /^\s*(\d+\.|[-*•])\s+(.*)$/.exec(line);
        if (list) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="shrink-0 text-zinc-500">{/\d/.test(list[1]) ? list[1] : "•"}</span>
              <span>{renderInline(list[2], onCite)}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(line, onCite)}</p>;
      })}
    </div>
  );
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>({});
  const [reindexing, setReindexing] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.pending);

  const loadStatus = () =>
    fetch("/api/index")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ error: "Server unreachable" }));

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const update = (index: number, fn: (t: Turn) => Turn) =>
    setTurns((prev) => prev.map((t, i) => (i === index ? fn(t) : t)));

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    const index = turns.length;
    setTurns((prev) => [...prev, { question: q, answer: "", sources: [], pending: true }]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "searchQuery") update(index, (t) => ({ ...t, searchQuery: ev.text }));
          if (ev.type === "sources") update(index, (t) => ({ ...t, sources: ev.sources }));
          if (ev.type === "token") update(index, (t) => ({ ...t, answer: t.answer + ev.text }));
          if (ev.type === "error") update(index, (t) => ({ ...t, error: ev.message }));
        }
      }
    } catch (err) {
      update(index, (t) => ({ ...t, error: (err as Error).message }));
    } finally {
      update(index, (t) => ({ ...t, pending: false }));
      loadStatus();
    }
  }

  async function reindex() {
    setReindexing(true);
    try {
      const res = await fetch("/api/index", { method: "POST" });
      const data = await res.json();
      if (data.error) setStatus((s) => ({ ...s, error: data.error }));
    } finally {
      setReindexing(false);
      loadStatus();
    }
  }

  function cite(turnIndex: number, n: number) {
    const key = `${turnIndex}-${n}`;
    setHighlight(key);
    document.getElementById(`src-${key}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => setHighlight((h) => (h === key ? null : h)), 1800);
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-lg font-bold text-white">
              ⚙
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Factory Manual Assistant</h1>
              <p className="text-xs text-zinc-500">Answers from your manuals, with sources</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {status.error
                ? "⚠ " + status.error
                : status.chunks
                  ? `${status.documents} manuals · ${status.chunks} sections${status.embedded ? "" : " · keyword only"}`
                  : "Not indexed yet"}
            </span>
            {status.model && (
              <span className="hidden rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600 sm:inline dark:bg-zinc-800 dark:text-zinc-300">
                {status.model}
              </span>
            )}
            <button
              onClick={reindex}
              disabled={reindexing || busy}
              className="rounded-full border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {reindexing ? "Indexing…" : "Re-index"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {turns.length === 0 && (
          <div className="mt-10 text-center">
            <h2 className="text-2xl font-semibold">What do you need to know?</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Ask in plain words. Every answer links to the manual section it came from.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => ask(e)}
                  className="rounded-xl border border-zinc-200 bg-white p-3 text-left text-sm hover:border-amber-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-8">
          {turns.map((t, ti) => (
            <section key={ti} className="space-y-3">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-amber-500 px-4 py-2 text-white">
                {t.question}
              </div>
              {t.searchQuery && (
                <p className="text-right text-[11px] text-zinc-500">
                  Searched the English manuals for: “{t.searchQuery}”
                </p>
              )}

              <div className="rounded-2xl rounded-bl-sm border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                {t.answer ? (
                  <Answer text={t.answer} onCite={(n) => cite(ti, n)} />
                ) : t.pending ? (
                  <p className="animate-pulse text-sm text-zinc-500">
                    {t.sources.length ? "Reading the manual…" : "Searching the manuals…"}
                  </p>
                ) : null}
                {t.error && (
                  <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                    {t.error}
                  </p>
                )}
              </div>

              {t.sources.length > 0 && !t.pending && (() => {
                const citedNs = new Set([...t.answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
                const cited = t.sources.filter((s) => citedNs.has(s.n));
                const other = t.sources.filter((s) => !citedNs.has(s.n));
                const card = (s: Source) => {
                  const key = `${ti}-${s.n}`;
                  return (
                    <div
                      key={key}
                      id={`src-${key}`}
                      className={`rounded-lg border p-3 text-sm transition-colors ${
                        highlight === key
                          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40"
                          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                        <span className="rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                          {s.n}
                        </span>
                        <span className="font-medium">{s.document}</span>
                        <span className="text-xs text-zinc-500">{s.section}</span>
                      </div>
                      <p className="line-clamp-4 whitespace-pre-line text-xs text-zinc-600 dark:text-zinc-400">
                        {s.content}
                      </p>
                    </div>
                  );
                };
                return (
                  <div className="space-y-2">
                    {cited.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-zinc-500">Cited sources</p>
                        {cited.map(card)}
                      </>
                    )}
                    {other.length > 0 && (
                      <details open={cited.length === 0}>
                        <summary className="cursor-pointer text-xs font-medium text-zinc-500 select-none">
                          Other search results ({other.length})
                        </summary>
                        <div className="mt-2 space-y-2">{other.map(card)}</div>
                      </details>
                    )}
                  </div>
                );
              })()}
            </section>
          ))}
        </div>
        <div ref={bottomRef} />
      </main>

      <footer className="sticky bottom-0 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="mx-auto flex max-w-3xl gap-2 px-4 py-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a machine, alarm, tool or safety step…"
            maxLength={1000}
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Ask
          </button>
        </form>
        <p className="pb-2 text-center text-[11px] text-zinc-400">
          AI can make mistakes. Always check the cited section before acting.
        </p>
      </footer>
    </div>
  );
}
