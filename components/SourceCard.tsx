import type { Citation } from "@/types";

export function SourceCard({ citation, index }: { citation: Citation; index: number }) {
  return (
    <div className="border-l-2 border-blue-500 pl-3 py-1 bg-gray-800/50 rounded-r-lg">
      <div className="flex items-center gap-2">
        <span className="text-blue-400 text-xs font-mono font-bold">[{index}]</span>
        <span className="text-gray-300 text-xs font-medium truncate">{citation.section}</span>
      </div>
      <div className="text-gray-500 text-xs mt-0.5">
        {citation.filename
          ? citation.filename
          : `Document ${citation.docId.slice(-8)}`}
        {" — "}Page {citation.pageNum}
      </div>
    </div>
  );
}
