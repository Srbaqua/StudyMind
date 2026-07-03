import { getOpenAI } from "@/lib/openai";
import { getServiceSupabase } from "@/lib/supabase";
import { CONSTANTS } from "@/lib/constants";
import { randomUUID } from "crypto";
import type { ProcessedChunk } from "@/ingestion/chunker";

function isQuotaError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "insufficient_quota"
  );
}

function getEmbeddingErrorMessage(error: unknown): string {
  if (isQuotaError(error)) {
    return (
      "OpenAI quota is exhausted while generating embeddings. " +
      "Set OPENROUTER_BASE_URL to https://openrouter.ai/api/v1 and use a valid OpenRouter key, " +
      "or restore OpenAI billing/quota."
    );
  }

  return String(error);
}

export async function embedAndStoreChunks(
  chunks: ProcessedChunk[],
  docId: string
): Promise<number> {
  const openai = getOpenAI();
  const supabase = getServiceSupabase();
  let stored = 0;

  for (let i = 0; i < chunks.length; i += CONSTANTS.EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + CONSTANTS.EMBEDDING_BATCH_SIZE);
    const texts = batch.map((c) => c.text);

    let embeddings: number[][];
    try {
      const response = await openai.embeddings.create({
        model: CONSTANTS.EMBEDDING_MODEL,
        input: texts,
      });
      embeddings = response.data.map((d) => d.embedding);
    } catch (error) {
      if (isQuotaError(error)) {
        throw new Error(getEmbeddingErrorMessage(error));
      }

      await new Promise((r) => setTimeout(r, 5000));
      try {
        const response = await openai.embeddings.create({
          model: CONSTANTS.EMBEDDING_MODEL,
          input: texts,
        });
        embeddings = response.data.map((d) => d.embedding);
      } catch (retryError) {
        throw new Error(getEmbeddingErrorMessage(retryError));
      }
    }

    const rows = batch.map((chunk, idx) => ({
      id: randomUUID(),
      doc_id: docId,
      section: chunk.sectionHeading,
      text: chunk.text,
      page_num: chunk.pageNum,
      chunk_index: chunk.chunkIndex,
      word_count: chunk.wordCount,
      embedding: embeddings[idx],
      topic_ids: [],
    }));

    for (let j = 0; j < rows.length; j += 50) {
      const { error } = await supabase.from("chunks").insert(rows.slice(j, j + 50));
      if (error) throw new Error(`Supabase chunk insert failed: ${error.message}`);
    }

    stored += batch.length;
    if (i + CONSTANTS.EMBEDDING_BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return stored;
}
