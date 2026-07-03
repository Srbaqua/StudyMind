"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Document } from "@/types";
import { CONSTANTS } from "@/lib/constants";

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Document[];
      setDocuments(data);
      setError(null);
      return data;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (hasProcessing) {
      pollRef.current = setInterval(fetchDocuments, CONSTANTS.STATUS_POLL_INTERVAL_MS);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [documents, fetchDocuments]);

  const deleteDoc = useCallback(async (id: string) => {
    const confirmed = window.confirm("Delete this document and all its data?");
    if (!confirmed) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return { documents, isLoading, error, refetch: fetchDocuments, deleteDoc };
}
