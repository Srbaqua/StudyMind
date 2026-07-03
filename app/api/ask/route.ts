import { NextRequest, NextResponse } from "next/server";
import { hybridRetrieve } from "@/retrieval/hybrid";
import { expandWithGraph } from "@/retrieval/graphTraversal";
import { rerank } from "@/retrieval/reranker";
import { synthesize } from "@/retrieval/synthesizer";
import { getServiceSupabase } from "@/lib/supabase";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const supabase = getServiceSupabase();

  try {
    const { question } = (await req.json()) as { question: string };
    if (!question?.trim())
      return NextResponse.json({ error: "question is required" }, { status: 400 });

    const candidates = await hybridRetrieve(question);
    const expanded = await expandWithGraph(candidates);
    const reranked = await rerank(question, expanded);
    const answer = await synthesize(question, reranked);

    const latencyMs = Date.now() - startTime;
    await supabase.from("query_logs").insert({
      question,
      latency_ms: latencyMs,
      chunks_used: reranked.length,
    });

    return NextResponse.json(answer);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
