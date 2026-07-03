import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceSupabase();
  const [topicRes, neighborsRes] = await Promise.all([
    supabase.from("topics").select("*").eq("id", params.id).single(),
    supabase
      .from("topic_edges")
      .select("to_id, weight, topics!to_id(id, name, summary)")
      .eq("from_id", params.id)
      .order("weight", { ascending: false })
      .limit(10),
  ]);

  if (!topicRes.data)
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  return NextResponse.json({ topic: topicRes.data, neighbors: neighborsRes.data ?? [] });
}
