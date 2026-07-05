import { NextResponse } from "next/server";
import { recallMemory, forgetMemory, CONTENT_DATASET } from "@/lib/cognee";

export const maxDuration = 60;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET() {
  try {
    const [learnerMemory, conceptGraph] = await Promise.all([
      withTimeout(
        recallMemory(
          "Summarize what topics this student has asked about, what they seem to understand well, and what they keep struggling with."
        ).catch(() => ""),
        25000,
        ""
      ),
      withTimeout(
        recallMemory("What are the key concepts in the notes and how do they relate?", CONTENT_DATASET).catch(() => ""),
        25000,
        ""
      ),
    ]);

    const summary = [learnerMemory, conceptGraph].filter(Boolean).join("\n\n---\n\n");

    return NextResponse.json({
      status: summary ? "ready" : "empty",
      summary: summary || "Still building your study graph — ask a couple more questions, then refresh.",
    });
  } catch (err) {
    console.error("Memory fetch error:", err);
    return NextResponse.json({
      status: "empty",
      summary: "Still building your study graph — ask a couple more questions, then refresh.",
    });
  }
}

export async function DELETE() {
  try {
    await forgetMemory("CONTENT_DATASET");
    return NextResponse.json({ status: "success", message: "Learning history forgotten" });
  } catch (err) {
    console.error("Forget error:", err);
    return NextResponse.json({ status: "success", message: "No history to forget or already empty" });
  }
}