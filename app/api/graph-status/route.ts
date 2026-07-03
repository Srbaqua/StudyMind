import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  noStore();

  const supabase = getServiceSupabase();
  const [topicsRes, edgesRes, chunksRes, latestTopic] = await Promise.all([
    supabase.from("topics").select("id", { count: "exact", head: true }),
    supabase.from("topic_edges").select("from_id", { count: "exact", head: true }),
    supabase.from("chunks").select("id", { count: "exact", head: true }).not("embedding", "is", null),
    supabase.from("topics").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  return NextResponse.json({
    topicsCount: topicsRes.count ?? 0,
    edgesCount: (edgesRes.count ?? 0) / 2,
    chunksCount: chunksRes.count ?? 0,
    lastBuilt: latestTopic.data?.[0]?.created_at ?? null,
    isBuilding: false,
  });
}
