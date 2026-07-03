import { UMAP } from "umap-js";
import { DBSCAN } from "density-clustering";
import { getServiceSupabase } from "@/lib/supabase";
import { CONSTANTS } from "@/lib/constants";
import { nameTopic } from "./namer";
import { randomUUID } from "crypto";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dims = vectors[0].length;
  const centroid = new Array(dims).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) centroid[i] += vec[i];
  }
  return centroid.map((v) => v / vectors.length);
}

function parseEmbedding(embedding: unknown): number[] | null {
  if (Array.isArray(embedding) && embedding.every((value) => typeof value === "number")) {
    return embedding;
  }

  if (typeof embedding === "string") {
    try {
      const parsed = JSON.parse(embedding) as unknown;
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === "number")) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function buildTopicGraph(docIds?: string[]): Promise<{
  topicsCount: number;
  edgesCount: number;
  error?: string;
}> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from("chunks")
    .select("id, doc_id, text, section, embedding, page_num");

  if (docIds && docIds.length > 0) {
    query = query.in("doc_id", docIds);
  }

  const { data: chunks, error: fetchError } = await query;
  if (fetchError) throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
  if (!chunks) throw new Error("No chunks returned");

  const validChunks = chunks
    .map((c) => ({ ...c, embedding: parseEmbedding(c.embedding) }))
    .filter((c) => c.embedding !== null) as (typeof chunks[number] & { embedding: number[] })[];
  if (validChunks.length < CONSTANTS.HDBSCAN_MIN_CLUSTER_SIZE * 2) {
    return {
      topicsCount: 0,
      edgesCount: 0,
      error: "Not enough embedded chunks. Upload more documents first.",
    };
  }

  const embeddings: number[][] = validChunks.map((c) => c.embedding);

  const nNeighbors = Math.max(2, Math.min(CONSTANTS.UMAP_N_NEIGHBORS, validChunks.length - 1));
  const umap = new UMAP({
    nComponents: Math.min(CONSTANTS.UMAP_N_COMPONENTS, embeddings[0].length),
    nNeighbors,
    minDist: 0.1,
  });
  const reducedEmbeddings: number[][] = umap.fit(embeddings);

  const umap2d = new UMAP({ nComponents: 2, nNeighbors, minDist: 0.1 });
  const coords2d: number[][] = umap2d.fit(embeddings);

  const dbscan = new DBSCAN();
  const epsilon = 1.5;
  const clusters: number[][] = dbscan.run(
    reducedEmbeddings,
    epsilon,
    CONSTANTS.HDBSCAN_MIN_CLUSTER_SIZE
  );

  if (clusters.length === 0) {
    return {
      topicsCount: 0,
      edgesCount: 0,
      error: "No topic clusters found. Try uploading more documents.",
    };
  }

  await supabase.from("topic_edges").delete().neq("from_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("topics").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const topicRecords: {
    id: string;
    centroid: number[];
    chunkIds: string[];
    coords2d: number[];
  }[] = [];

  for (const clusterIndices of clusters) {
    const clusterEmbeddings = clusterIndices.map((i) => embeddings[i]);
    const centroid = computeCentroid(clusterEmbeddings);

    const distances = clusterIndices.map((i) => ({
      i,
      dist: 1 - cosineSimilarity(embeddings[i], centroid),
    }));
    distances.sort((a, b) => a.dist - b.dist);
    const central3 = distances.slice(0, 3).map((d) => validChunks[d.i]);

    const avgX =
      clusterIndices.reduce((sum, i) => sum + coords2d[i][0], 0) / clusterIndices.length;
    const avgY =
      clusterIndices.reduce((sum, i) => sum + coords2d[i][1], 0) / clusterIndices.length;

    const { name, summary } = await nameTopic(central3);
    const topicId = randomUUID();

    const { error: topicErr } = await supabase.from("topics").insert({
      id: topicId,
      name,
      summary,
      embedding: centroid,
      chunk_count: clusterIndices.length,
      x2d: avgX,
      y2d: avgY,
    });
    if (topicErr) throw new Error(`Topic insert failed: ${topicErr.message}`);

    const chunkIds = clusterIndices.map((i) => validChunks[i].id);
    for (const chunkId of chunkIds) {
      await supabase.from("chunks").update({ topic_ids: [topicId] }).eq("id", chunkId);
    }

    topicRecords.push({ id: topicId, centroid, chunkIds, coords2d: [avgX, avgY] });
  }

  let edgesCount = 0;
  const edgeRows: { from_id: string; to_id: string; weight: number }[] = [];

  for (let i = 0; i < topicRecords.length; i++) {
    for (let j = i + 1; j < topicRecords.length; j++) {
      const sim = cosineSimilarity(topicRecords[i].centroid, topicRecords[j].centroid);
      if (sim >= CONSTANTS.TOPIC_EDGE_THRESHOLD) {
        edgeRows.push({ from_id: topicRecords[i].id, to_id: topicRecords[j].id, weight: sim });
        edgeRows.push({ from_id: topicRecords[j].id, to_id: topicRecords[i].id, weight: sim });
        edgesCount++;
      }
    }
  }

  if (edgeRows.length > 0) {
    const { error: edgeErr } = await supabase.from("topic_edges").insert(edgeRows);
    if (edgeErr) throw new Error(`Edge insert failed: ${edgeErr.message}`);
  }

  return { topicsCount: topicRecords.length, edgesCount };
}
