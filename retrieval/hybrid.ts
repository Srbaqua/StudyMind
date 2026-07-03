import { getOpenAI } from "@/lib/openai";
import { getServiceSupabase } from "@/lib/supabase";
import { CONSTANTS } from "@/lib/constants";
import type { RetrievedChunk } from "@/types";

export async function hybridRetrieve(question: string): Promise<RetrievedChunk[]> {
  const openai = getOpenAI();
  const supabase = getServiceSupabase();

  const embResponse = await openai.embeddings.create({
    model: CONSTANTS.EMBEDDING_MODEL,
    input: [question],
  });
  const queryEmbedding = embResponse.data[0].embedding;

  const { data: vectorResults, error: vecErr } = await supabase.rpc("vector_search", {
    query_embedding: queryEmbedding,
    match_count: CONSTANTS.VECTOR_SEARCH_LIMIT,
  });
  if (vecErr) throw new Error(`Vector search failed: ${vecErr.message}`);

  const candidateMap = new Map<string, RetrievedChunk>();

  for (const row of (vectorResults ?? []) as {
    id: string;
    text: string;
    section: string;
    page_num: number;
    doc_id: string;
    topic_ids: string[];
    score: number;
  }[]) {
    candidateMap.set(row.id, {
      id: row.id,
      doc_id: row.doc_id,
      section: row.section,
      text: row.text,
      page_num: row.page_num,
      chunk_index: 0,
      word_count: row.text.split(/\s+/).length,
      topic_ids: row.topic_ids ?? [],
      embedding: undefined,
      score: row.score,
      source: "vector",
    });
  }

  const stopwords = new Set([
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "what",
    "how",
    "why",
    "when",
    "where",
    "which",
    "who",
    "in",
    "of",
    "for",
    "to",
    "with",
    "on",
    "at",
    "be",
    "do",
    "did",
    "does",
    "can",
    "could",
    "would",
    "should",
    "will",
    "have",
    "has",
  ]);
  const keywords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopwords.has(w));

  if (keywords.length > 0) {
    const tsQuery = keywords.join(" | ");
    const { data: kwResults } = await supabase
      .from("chunks")
      .select("id, text, section, page_num, doc_id, topic_ids")
      .textSearch("text", tsQuery)
      .limit(CONSTANTS.KEYWORD_SEARCH_LIMIT);

    for (const row of (kwResults ?? []) as {
      id: string;
      text: string;
      section: string;
      page_num: number;
      doc_id: string;
      topic_ids: string[];
    }[]) {
      if (candidateMap.has(row.id)) {
        candidateMap.get(row.id)!.score += 0.15;
      } else {
        candidateMap.set(row.id, {
          id: row.id,
          doc_id: row.doc_id,
          section: row.section,
          text: row.text,
          page_num: row.page_num,
          chunk_index: 0,
          word_count: row.text.split(/\s+/).length,
          topic_ids: row.topic_ids ?? [],
          embedding: undefined,
          score: 0.65,
          source: "keyword",
        });
      }
    }
  }

  return Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
}
