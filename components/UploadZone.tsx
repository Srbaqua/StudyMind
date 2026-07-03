"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { Document } from "@/types";
import { CONSTANTS } from "@/lib/constants";

const STAGES = ["Uploading", "Extracting text", "Chunking", "Embedding", "Ready"] as const;

export function UploadZone({ onUploadComplete }: { onUploadComplete: (doc: Document) => void }) {
  const [subject, setSubject] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setStageIndex(0);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("subject", subject);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = (await res.json()) as { error: string };
          throw new Error(err.error);
        }
        const { docId } = (await res.json()) as { docId: string };
        setStageIndex(1);

        const docRes = await fetch(`/api/documents/${docId}`, { cache: "no-store" });
        if (docRes.ok) {
          const doc = (await docRes.json()) as Document;
          onUploadComplete(doc);
        }

        let stageCounter = 0;
        const poll = setInterval(async () => {
          const docRes = await fetch(`/api/documents/${docId}`, { cache: "no-store" });
          const doc = (await docRes.json()) as Document;

          stageCounter++;
          if (stageCounter === 3) setStageIndex(2);
          if (stageCounter === 6) setStageIndex(3);

          if (doc.status === "ready") {
            clearInterval(poll);
            setStageIndex(4);
            setTimeout(() => {
              setUploading(false);
              setStageIndex(0);
              onUploadComplete(doc);
            }, 800);
          } else if (doc.status === "error") {
            clearInterval(poll);
            setError(doc.error_msg || "Processing failed");
            setUploading(false);
          }
        }, CONSTANTS.STATUS_POLL_INTERVAL_MS);
      } catch (err) {
        setError(String(err));
        setUploading(false);
      }
    },
    [subject, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files[0]) processFile(files[0]);
    },
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-950/30"
            : uploading
              ? "border-gray-700 bg-gray-900 cursor-not-allowed"
              : "border-gray-700 hover:border-gray-500 bg-gray-900"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-4xl mb-3">{uploading ? "⏳" : "📂"}</p>
        <p className="text-gray-300 font-medium">
          {isDragActive ? "Drop it here" : "Drop your file or click to browse"}
        </p>
        <p className="text-gray-500 text-sm mt-1">PDF, PPTX, JPG, PNG, WEBP — max 50MB</p>
      </div>

      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject (optional — e.g. Operating Systems)"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
        disabled={uploading}
      />

      {uploading && (
        <div className="flex items-center gap-2 mt-2">
          {STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  i < stageIndex
                    ? "bg-green-600 text-white"
                    : i === stageIndex
                      ? "bg-blue-600 text-white animate-pulse"
                      : "bg-gray-700 text-gray-500"
                }`}
              >
                {i < stageIndex ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs ${
                  i === stageIndex
                    ? "text-blue-400"
                    : i < stageIndex
                      ? "text-green-400"
                      : "text-gray-600"
                }`}
              >
                {stage}
              </span>
              {i < STAGES.length - 1 && <div className="w-4 h-px bg-gray-700" />}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-2 text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
