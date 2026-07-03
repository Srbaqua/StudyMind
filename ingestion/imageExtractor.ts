import Tesseract from "tesseract.js";
import type { TextBlock } from "@/types";

export async function extractImage(buffer: Buffer): Promise<{ blocks: TextBlock[]; pageCount: number }> {
  const { data } = await Tesseract.recognize(buffer, "eng", {
    logger: process.env.NODE_ENV === "development" ? console.log : undefined,
  });

  const blocks: TextBlock[] = [];

  const lines =
    data.blocks?.flatMap((block) => block.paragraphs.flatMap((para) => para.lines)) ?? [];

  if (lines.length === 0 && data.text.trim()) {
    for (const line of data.text.split(/\n+/)) {
      const text = line.trim();
      if (text.length >= 2) {
        blocks.push({ text, fontSize: 14, isBold: false, pageNum: 1 });
      }
    }
  } else {
    for (const line of lines) {
      const text = line.text.trim().replace(/\n/g, " ");
      if (!text || line.confidence < 40) continue;

      blocks.push({
        text,
        fontSize: 14,
        isBold: false,
        pageNum: 1,
      });
    }
  }

  return { blocks, pageCount: 1 };
}
