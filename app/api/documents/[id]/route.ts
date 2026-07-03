import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data)
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("documents").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
