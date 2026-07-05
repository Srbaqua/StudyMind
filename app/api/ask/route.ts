import { NextRequest, NextResponse } from "next/server";
import { hybridRetrieve } from "@/retrieval/hybrid";
import { expandWithGraph } from "@/retrieval/graphTraversal";
import { rerank } from "@/retrieval/reranker";
import { synthesize } from "@/retrieval/synthesizer";
import { getServiceSupabase } from "@/lib/supabase";
import { recallMemory, rememberInteraction, CONTENT_DATASET } from "@/lib/cognee";

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

    // Pull from both Cognee graphs in parallel: what this learner has asked before,
    // and concept-level relationships Cognee extracted from the notes themselves.
    const [learnerMemory, conceptGraph] = await Promise.all([
      recallMemory(question).catch((err) => {
        console.error("cognee recall (learner_memory) failed:", err);
        return "";
      }),
      recallMemory(question, CONTENT_DATASET).catch((err) => {
        console.error("cognee recall (course_content) failed:", err);
        return "";
      }),
    ]);

    const combinedContext = [
      learnerMemory && `LEARNER HISTORY (what this student has asked/struggled with before):\n${learnerMemory}`,
      conceptGraph && `CONCEPT RELATIONSHIPS (extracted from the notes by Cognee's knowledge graph):\n${conceptGraph}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const answer = await synthesize(question, reranked, combinedContext);

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