import type { Document } from "@/types";
import { StatusBadge } from "./StatusBadge";

const fileIcons = { pdf: "📄", pptx: "📊", image: "🖼️" };

export function DocumentCard({
  document: doc,
  onDelete,
}: {
  document: Document;
  onDelete: (id: string) => void;
}) {
  const date = new Date(doc.uploaded_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-start gap-3">
      <span className="text-2xl mt-0.5">{fileIcons[doc.file_type] ?? "📄"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate text-sm">{doc.filename}</p>
        {doc.subject && <p className="text-gray-400 text-xs mt-0.5">{doc.subject}</p>}
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={doc.status} />
          {doc.page_count && (
            <span className="text-gray-500 text-xs">{doc.page_count} pages</span>
          )}
          <span className="text-gray-600 text-xs ml-auto">{date}</span>
        </div>
        {doc.error_msg && (
          <p className="text-red-400 text-xs mt-1 truncate">{doc.error_msg}</p>
        )}
      </div>
      <button
        onClick={() => onDelete(doc.id)}
        className="text-gray-600 hover:text-red-400 transition-colors ml-1 flex-shrink-0"
        aria-label="Delete document"
      >
        🗑️
      </button>
    </div>
  );
}
