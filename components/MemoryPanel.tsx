"use client";

import { useEffect, useState, useCallback } from "react";

export function MemoryPanel() {
  const [summary, setSummary] = useState<string>("");
  const [status, setStatus] = useState<string>("empty");
  const [isLoading, setIsLoading] = useState(true);
  const [isForgetting, setIsForgetting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/memory", { cache: "no-store" });
      const data = (await res.json()) as { summary?: string; error?: string; status?: string };
      setSummary(data.summary ?? data.error ?? "Nothing yet.");
      setStatus(data.status ?? "empty");
    } catch (err) {
      setSummary(`Error: ${String(err)}`);
      setStatus("error");
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
        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{summary}</p>
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