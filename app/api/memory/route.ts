import { NextResponse } from "next/server";
import { recallMemory, forgetMemory } from "@/lib/cognee";

export const maxDuration = 60;

export async function GET() {
  try {
    const summary = await recallMemory(
      "Summarize what topics this student has asked about, what they seem to understand well, and what they keep struggling with."
    );
    return NextResponse.json({
      status: summary ? "ready" : "empty",
      summary: summary || "No learning history yet — upload notes or ask a question to seed Cognee.",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await forgetMemory();
    return NextResponse.json({ status: "forgotten" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}