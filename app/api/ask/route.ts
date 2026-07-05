import { NextRequest, NextResponse } from "next/server";
import { hybridRetrieve } from "@/retrieval/hybrid";
import { expandWithGraph } from "@/retrieval/graphTraversal";
import { rerank } from "@/retrieval/reranker";
import { synthesize } from "@/retrieval/synthesizer";
import { getServiceSupabase } from "@/lib/supabase";
import { recallMemory, rememberInteraction, CONTENT_DATASET } from "@/lib/cognee";

export const maxDuration = 120;

// Cap how long we'll wait on Cognee recall before answering without it —
// GRAPH_COMPLETION search is LLM-backed and can occasionally be slow;
// this keeps a Cognee slowdown from ever stalling the whole chat response.
const RECALL_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

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

    // Pull from both Cognee graphs in parallel, each capped by a timeout so a
    // slow Cognee response degrades gracefully instead of stalling the answer.
    const [learnerMemory, conceptGraph] = await Promise.all([
      withTimeout(
        recallMemory(question).catch((err) => {
          console.error("cognee recall (CONTENT_DATASET) failed:", err);
          return "";
        }),
        RECALL_TIMEOUT_MS,
        ""
      ),
      withTimeout(
        recallMemory(question, CONTENT_DATASET).catch((err) => {
          console.error("cognee recall (course_content) failed:", err);
          return "";
        }),
        RECALL_TIMEOUT_MS,
        ""
      ),
    ]);

    const combinedContext = [
      learnerMemory && `LEARNER HISTORY (what this student has asked/struggled with before):\n${learnerMemory}`,
      conceptGraph && `CONCEPT RELATIONSHIPS (extracted from the notes by Cognee's knowledge graph):\n${conceptGraph}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const answer = await synthesize(question, reranked, combinedContext);

    // Fire-and-forget: don't let a slow/failing remember() delay the response.
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