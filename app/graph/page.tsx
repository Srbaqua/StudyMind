"use client";

import { useState, useCallback } from "react";
import { useTopicGraph } from "@/hooks/useTopicGraph";
import { TopicGraph } from "@/components/TopicGraph";
import { TopicPanel } from "@/components/TopicPanel";
import type { Topic, Chunk } from "@/types";

export default function GraphPage() {
  const { topics, edges, graphStatus, isLoading, refetch } = useTopicGraph();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicChunks, setTopicChunks] = useState<Chunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  const handleNodeClick = useCallback(async (topic: Topic) => {
    setSelectedTopic(topic);
    setIsLoadingChunks(true);
    const res = await fetch(`/api/topics/${topic.id}/chunks`);
    const data = (await res.json()) as Chunk[];
    setTopicChunks(data);
    setIsLoadingChunks(false);
  }, []);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setRebuildMsg("Rebuilding…");
    const res = await fetch("/api/build-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json()) as { topicsCount?: number; error?: string };
    setRebuildMsg(data.error ? `Error: ${data.error}` : `Done — ${data.topicsCount} topics`);
    setIsRebuilding(false);
    await refetch();
  };

  if (!isLoading && topics.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-4xl mb-4">🕸️</p>
          <p className="text-white font-medium mb-2">No knowledge graph yet</p>
          <p className="text-gray-400 text-sm">
            Upload documents and click Build Knowledge Graph on the home page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            {graphStatus.topicsCount} topics · {graphStatus.edgesCount} connections
          </span>
          {graphStatus.lastBuilt && (
            <span className="text-gray-600 text-xs">
              Built {new Date(graphStatus.lastBuilt).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={handleRebuild}
            disabled={isRebuilding}
            className="ml-auto px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs rounded-lg transition-colors"
          >
            {isRebuilding ? "Rebuilding…" : "Rebuild graph"}
          </button>
          {rebuildMsg && <span className="text-gray-400 text-xs">{rebuildMsg}</span>}
        </div>

        <div className="flex-1 rounded-xl overflow-hidden">
          <TopicGraph
            topics={topics}
            edges={edges}
            onNodeClick={handleNodeClick}
            highlightedIds={selectedTopic ? [selectedTopic.id] : []}
          />
        </div>
      </div>

      {selectedTopic && (
        <div className="w-80 flex-shrink-0">
          <TopicPanel
            topic={selectedTopic}
            chunks={topicChunks}
            isLoadingChunks={isLoadingChunks}
            onClose={() => setSelectedTopic(null)}
          />
        </div>
      )}
    </div>
  );
}
