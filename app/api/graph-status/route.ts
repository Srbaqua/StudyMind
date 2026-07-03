import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

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

export async function GET() {
  const supabase = getServiceSupabase();
  const [topicsRes, edgesRes, chunksRes, latestTopic] = await Promise.all([
    supabase.from("topics").select("id", { count: "exact", head: true }),
    supabase.from("topic_edges").select("from_id", { count: "exact", head: true }),
    supabase.from("chunks").select("embedding"),
    supabase.from("topics").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  const chunksCount = (chunksRes.data ?? []).filter((chunk) => parseEmbedding((chunk as { embedding?: unknown }).embedding)).length;

  return NextResponse.json({
    topicsCount: topicsRes.count ?? 0,
    edgesCount: (edgesRes.count ?? 0) / 2,
    chunksCount,
    lastBuilt: latestTopic.data?.[0]?.created_at ?? null,
    isBuilding: false,
  });
}
