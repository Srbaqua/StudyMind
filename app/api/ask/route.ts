import { NextRequest, NextResponse } from "next/server";
import { hybridRetrieve } from "@/retrieval/hybrid";
import { expandWithGraph } from "@/retrieval/graphTraversal";
import { rerank } from "@/retrieval/reranker";
import { synthesize } from "@/retrieval/synthesizer";
import { getServiceSupabase } from "@/lib/supabase";
import { recallMemory, rememberInteraction } from "@/lib/cognee";

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

    // Recall what this learner has asked/struggled with before.
    // Never let a memory outage break the core answer flow.
    const memoryContext = await recallMemory(question).catch((err) => {
      console.error("cognee recall failed:", err);
      return "";
    });

    const answer = await synthesize(question, reranked, memoryContext);

    // Store this interaction as part of the learner's long-term memory graph.
    rememberInteraction(
      `Student asked: "${question}". Answer given: "${answer.answer}". Related topics: ${answer.relatedTopics.join(", ")}.`
    ).catch((err) => console.error("cognee remember failed:", err));

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

// import { NextRequest, NextResponse } from "next/server";
// import { hybridRetrieve } from "@/retrieval/hybrid";
// import { expandWithGraph } from "@/retrieval/graphTraversal";
// import { rerank } from "@/retrieval/reranker";
// import { synthesize } from "@/retrieval/synthesizer";
// import { getServiceSupabase } from "@/lib/supabase";

// export const maxDuration = 120;

// export async function POST(req: NextRequest) {
//   const startTime = Date.now();
//   const supabase = getServiceSupabase();

//   try {
//     const { question } = (await req.json()) as { question: string };
//     if (!question?.trim())
//       return NextResponse.json({ error: "question is required" }, { status: 400 });

//     const candidates = await hybridRetrieve(question);
//     const expanded = await expandWithGraph(candidates);
//     const reranked = await rerank(question, expanded);
//     const answer = await synthesize(question, reranked);

//     const latencyMs = Date.now() - startTime;
//     await supabase.from("query_logs").insert({
//       question,
//       latency_ms: latencyMs,
//       chunks_used: reranked.length,
//     });

//     return NextResponse.json(answer);
//   } catch (err) {
//     return NextResponse.json({ error: String(err) }, { status: 500 });
//   }
// }
