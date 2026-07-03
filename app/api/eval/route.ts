import { NextResponse } from "next/server";
import { runEvaluation } from "@/eval/evaluator";

export const maxDuration = 300;

export async function GET() {
  try {
    const result = await runEvaluation();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
