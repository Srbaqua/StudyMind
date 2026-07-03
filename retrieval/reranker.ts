import { cohereRerank } from "@/lib/cohere";
import { CONSTANTS } from "@/lib/constants";
import type { RetrievedChunk } from "@/types";

export async function rerank(
  question: string,
  chunks: RetrievedChunk[]
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];
  if (chunks.length === 1) return chunks;

  const documents = chunks.map((c) => `Section: ${c.section}\n${c.text}`);

  try {
    const results = await cohereRerank(question, documents, CONSTANTS.RERANK_TOP_K);
    return results.map((r) => ({
      ...chunks[r.index],
      rerankScore: r.relevanceScore,
    }));
  } catch (err) {
    console.error("Cohere rerank failed, falling back to score sort:", err);
    return chunks.sort((a, b) => b.score - a.score).slice(0, CONSTANTS.RERANK_TOP_K);
  }
}
