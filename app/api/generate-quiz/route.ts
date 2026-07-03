import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { generateQuiz } from "@/retrieval/synthesizer";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { topicId } = (await req.json()) as { topicId: string };
    if (!topicId) return NextResponse.json({ error: "topicId required" }, { status: 400 });

    const supabase = getServiceSupabase();
    const [topicRes, chunksRes] = await Promise.all([
      supabase.from("topics").select("name").eq("id", topicId).single(),
      supabase
        .from("chunks")
        .select("id, text, section, page_num, doc_id, topic_ids")
        .contains("topic_ids", [topicId])
        .limit(8),
    ]);

    if (!topicRes.data) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

    const chunks = (chunksRes.data ?? []).map((c) => ({
      ...c,
      chunk_index: 0,
      word_count: c.text.split(/\s+/).length,
      embedding: undefined,
      score: 1,
      source: "vector" as const,
      rerankScore: undefined,
    }));

    const questions = await generateQuiz(topicRes.data.name, chunks);
    return NextResponse.json({ questions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
