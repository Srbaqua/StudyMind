import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { detectFormat } from "@/ingestion/detector";
import { extractPdf } from "@/ingestion/pdfExtractor";
import { extractPptx } from "@/ingestion/pptxExtractor";
import { extractImage } from "@/ingestion/imageExtractor";
import { chunkDocument } from "@/ingestion/chunker";
import { embedAndStoreChunks } from "@/retrieval/embedder";
import { rememberInteraction } from "@/lib/cognee";
import { randomUUID } from "crypto";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subject = (formData.get("subject") as string) || "";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fmt = await detectFormat(buffer);
    const docId = randomUUID();

    const { error: insertErr } = await supabase.from("documents").insert({
      id: docId,
      filename: file.name,
      subject,
      file_type: fmt,
      status: "processing",
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    processDocument(docId, buffer, fmt, file.name, subject).catch(async (err) => {
      console.error("Processing failed for doc", docId, err);
      await supabase
        .from("documents")
        .update({ status: "error", error_msg: String(err) })
        .eq("id", docId);
    });

    return NextResponse.json({ docId, status: "processing", filename: file.name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function processDocument(docId: string, buffer: Buffer, fmt: string, fileName: string, subject: string) {
  const supabase = getServiceSupabase();

  try {
    let blocks, pageCount;
    if (fmt === "pdf") {
      ({ blocks, pageCount } = await extractPdf(buffer));
    } else if (fmt === "pptx") {
      ({ blocks, pageCount } = await extractPptx(buffer));
    } else {
      ({ blocks, pageCount } = await extractImage(buffer));
    }

    if (blocks.length === 0) {
      throw new Error(
        "No text could be extracted from this file. It may be a scanned image without OCR support or an empty document."
      );
    }

    const chunks = chunkDocument(blocks);
    if (chunks.length === 0) {
      throw new Error("File was parsed but produced no usable text chunks.");
    }

    await embedAndStoreChunks(chunks, docId);

    await supabase
      .from("documents")
      .update({ status: "ready", page_count: pageCount })
      .eq("id", docId);

    rememberInteraction(
      `Uploaded study material: "${fileName}"${subject ? ` for ${subject}` : ""}. File type: ${fmt}. Extracted ${chunks.length} chunks across ${pageCount} pages. This is part of the learner's study history.`
    ).catch((err) => console.error("cognee remember failed for upload:", err));
  } catch (err) {
    await supabase
      .from("documents")
      .update({ status: "error", error_msg: String(err) })
      .eq("id", docId);
    throw err;
  }
}
