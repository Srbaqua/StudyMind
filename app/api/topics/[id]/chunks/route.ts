import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("chunks")
    .select("id, section, text, page_num, doc_id, word_count, documents(filename, subject)")
    .contains("topic_ids", [params.id])
    .order("page_num")
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
