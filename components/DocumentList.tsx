import type { Document } from "@/types";
import { DocumentCard } from "./DocumentCard";

export function DocumentList({
  documents,
  isLoading,
  onDelete,
}: {
  documents: Document[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-4xl mb-3">📚</p>
        <p className="text-sm">No documents yet. Upload your first notes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} onDelete={onDelete} />
      ))}
    </div>
  );
}
