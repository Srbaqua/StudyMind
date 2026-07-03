import type { Document } from "@/types";

export function StatusBadge({ status }: { status: Document["status"] }) {
  const map = {
    pending: "bg-gray-700 text-gray-300",
    processing: "bg-yellow-900 text-yellow-300",
    ready: "bg-green-900 text-green-300",
    error: "bg-red-900 text-red-300",
  };
  const labels = {
    pending: "Pending",
    processing: "Processing…",
    ready: "Ready",
    error: "Error",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}
    >
      {status === "processing" && (
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
      )}
      {labels[status]}
    </span>
  );
}
