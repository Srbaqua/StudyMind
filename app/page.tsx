"use client";

import { useState } from "react";
import { useEffect } from "react";
import { useDocuments } from "@/hooks/useDocuments";
import { UploadZone } from "@/components/UploadZone";
import { DocumentList } from "@/components/DocumentList";
import type { Document } from "@/types";

export default function HomePage() {
  const { documents, isLoading, refetch, deleteDoc } = useDocuments();
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [chunksCount, setChunksCount] = useState<number | null>(null);

  useEffect(() => {
    const loadGraphStatus = async () => {
      try {
        const res = await fetch("/api/graph-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { chunksCount?: number };
        setChunksCount(data.chunksCount ?? 0);
      } catch {
        setChunksCount(null);
      }
    };

    loadGraphStatus();
  }, [documents]);

  const handleUploadComplete = async (_doc: Document) => {
    await refetch();
  };

  const handleBuildGraph = async () => {
    setIsBuilding(true);
    setBuildStatus("Building knowledge graph…");
    try {
      const res = await fetch("/api/build-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        topicsCount?: number;
        edgesCount?: number;
        error?: string;
      };
      if (data.error) {
        setBuildStatus(`Error: ${data.error}`);
      } else {
        setBuildStatus(`Done — ${data.topicsCount} topics, ${data.edgesCount} connections`);
      }
    } catch (err) {
      setBuildStatus(`Failed: ${String(err)}`);
    } finally {
      setIsBuilding(false);
    }
  };

  const readyCount = documents.filter((d) => d.status === "ready").length;
  const graphLabelCount = chunksCount ?? 0;

  return (
    <div className="flex h-full">
      <div className="w-3/5 p-8 border-r border-gray-800 overflow-y-auto">
        <h1 className="text-2xl font-semibold text-white mb-1">Your Study Notes</h1>
        <p className="text-gray-400 text-sm mb-6">
          Upload PDFs, slide decks, or photos of handwritten notes
        </p>
        <UploadZone onUploadComplete={handleUploadComplete} />

        {readyCount > 0 && (
          <div className="mt-6">
            <button
              onClick={handleBuildGraph}
              disabled={isBuilding}
              className="w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl font-medium text-sm transition-colors"
            >
              {isBuilding
                ? "Building…"
                : `🧠 Build Knowledge Graph (${graphLabelCount} embedded chunks)`}
            </button>
            {buildStatus && (
              <p className="text-sm text-gray-400 mt-2 text-center">{buildStatus}</p>
            )}
          </div>
        )}
      </div>

      <div className="w-2/5 p-8 overflow-y-auto">
        <h2 className="text-lg font-medium text-white mb-4">Uploaded documents</h2>
        <DocumentList documents={documents} isLoading={isLoading} onDelete={deleteDoc} />
      </div>
    </div>
  );
}
