"use client";

import Link from "next/link";
import type { Topic, Chunk } from "@/types";

export function TopicPanel({
  topic,
  chunks,
  isLoadingChunks,
  onClose,
}: {
  topic: Topic | null;
  chunks: Chunk[];
  isLoadingChunks: boolean;
  onClose: () => void;
}) {
  if (!topic) return null;

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800">
      <div className="flex items-start justify-between p-5 border-b border-gray-800">
        <div>
          <h2 className="text-white font-semibold text-sm">{topic.name}</h2>
          <p className="text-gray-400 text-xs mt-1">{topic.chunk_count} related sections</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 ml-2">
          ✕
        </button>
      </div>

      {topic.summary && (
        <div className="px-5 py-3 border-b border-gray-800">
          <p className="text-gray-400 text-xs leading-relaxed">{topic.summary}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-3">
          Source sections
        </p>

        {isLoadingChunks ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chunks.map((chunk) => (
              <div key={chunk.id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-blue-400 text-xs font-medium truncate">
                    {chunk.section}
                  </span>
                  <span className="text-gray-600 text-xs flex-shrink-0 ml-2">
                    p.{chunk.page_num}
                  </span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">
                  {chunk.text.slice(0, 200)}…
                </p>
                {chunk.documents && (
                  <p className="text-gray-600 text-xs mt-1 truncate">{chunk.documents.filename}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-gray-800">
        <Link
          href={`/chat?topic=${encodeURIComponent(topic.name)}`}
          className="block w-full text-center py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          Ask about this topic →
        </Link>
      </div>
    </div>
  );
}
