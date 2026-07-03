import { NextRequest, NextResponse } from "next/server";
import { buildTopicGraph } from "@/graph/clusterer";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const docIds: string[] | undefined = body?.docIds;

    const result = await buildTopicGraph(docIds);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      status: "complete",
      topicsCount: result.topicsCount,
      edgesCount: result.edgesCount,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
