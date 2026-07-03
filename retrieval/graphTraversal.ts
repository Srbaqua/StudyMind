import { getServiceSupabase } from "@/lib/supabase";
import { CONSTANTS } from "@/lib/constants";
import type { RetrievedChunk } from "@/types";

export async function expandWithGraph(chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  const supabase = getServiceSupabase();

  const topChunks = chunks.slice(0, 5);
  const topicIds = [...new Set(topChunks.flatMap((c) => c.topic_ids))];
  if (topicIds.length === 0) return chunks;

  const neighborTopicIds = new Set<string>();
  for (const topicId of topicIds) {
    const { data: edges } = await supabase
      .from("topic_edges")
      .select("to_id, weight")
      .eq("from_id", topicId)
      .gte("weight", CONSTANTS.GRAPH_HOP_WEIGHT_THRESHOLD);

    for (const edge of (edges ?? []) as { to_id: string; weight: number }[]) {
      if (!topicIds.includes(edge.to_id)) {
        neighborTopicIds.add(edge.to_id);
      }
    }
  }

  if (neighborTopicIds.size === 0) return chunks;

  const existingIds = new Set(chunks.map((c) => c.id));
  const expandedChunks: RetrievedChunk[] = [...chunks];

  for (const neighborId of neighborTopicIds) {
    const { data: neighborChunks } = await supabase
      .from("chunks")
      .select("id, text, section, page_num, doc_id, topic_ids")
      .contains("topic_ids", [neighborId])
      .limit(4);

    for (const row of (neighborChunks ?? []) as {
      id: string;
      text: string;
      section: string;
      page_num: number;
      doc_id: string;
      topic_ids: string[];
    }[]) {
      if (existingIds.has(row.id)) continue;
      existingIds.add(row.id);
      expandedChunks.push({
        id: row.id,
        doc_id: row.doc_id,
        section: row.section,
        text: row.text,
        page_num: row.page_num,
        chunk_index: 0,
        word_count: row.text.split(/\s+/).length,
        topic_ids: row.topic_ids ?? [],
        embedding: undefined,
        score: 0.5,
        source: "graph",
      });
    }
  }

  return expandedChunks;
}
