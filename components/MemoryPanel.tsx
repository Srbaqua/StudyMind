"use client";

import { useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-gray-300">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-1">{children}</ol>,
  li: ({ children }) => <li className="text-gray-200">{children}</li>,
  h1: ({ children }) => <p className="font-semibold text-white mb-1 mt-2">{children}</p>,
  h2: ({ children }) => <p className="font-semibold text-white mb-1 mt-2">{children}</p>,
  h3: ({ children }) => <p className="font-semibold text-white mb-1 mt-2">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
  code: ({ children }) => (
    <code className="bg-gray-900 px-1.5 py-0.5 rounded text-xs text-emerald-400 break-words">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-900 rounded-lg p-3 overflow-x-auto text-xs my-2">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 underline">{children}</a>
  ),
};

export function MemoryPanel() {
  const [summary, setSummary] = useState<string>("");
  const [status, setStatus] = useState<string>("empty");
  const [isLoading, setIsLoading] = useState(true);
  const [isForgetting, setIsForgetting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/memory", { cache: "no-store" });
      const data = (await res.json()) as { summary?: string | null; error?: string; status?: string };
      setSummary((prev) => {
        const next = data.summary ?? data.error ?? null;
        return next && next.trim() !== "" ? next : prev;
      });
      setStatus((prev) => (data.status === "empty" && prev !== "empty" && prev !== "error") ? prev : (data.status ?? prev));
    } catch (err) {
      // keep previous summary on network errors so the panel does not wipe itself
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleForget = async () => {
    if (!confirm("Forget everything this AI remembers about your learning history?")) return;
    setIsForgetting(true);
    try {
      await fetch("/api/memory", { method: "DELETE" });
      await load();
    } finally {
      setIsForgetting(false);
    }
  };

  return (
    <div className="w-72 shrink-0 border-l border-gray-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-medium text-sm">🧠 Your Learning Memory</h2>
        <button
          onClick={load}
          className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading memory…</p>
      ) : status === "empty" ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-3 text-sm text-gray-300">
          <p className="leading-relaxed">{summary}</p>
          <p className="mt-2 text-xs text-gray-500">Ask one question or upload a note, then Cognee starts building your study graph.</p>
        </div>
      ) : (
        <div className="text-gray-300 text-sm leading-relaxed">
          <ReactMarkdown components={markdownComponents}>{summary}</ReactMarkdown>
        </div>
      )}

      <button
        onClick={handleForget}
        disabled={isForgetting}
        className="mt-4 w-full py-2 bg-red-900/40 hover:bg-red-900/60 disabled:opacity-50 text-red-300 rounded-lg text-xs font-medium transition-colors"
      >
        {isForgetting ? "Forgetting…" : "Forget my learning history"}
      </button>
    </div>
  );
}