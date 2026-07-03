import type { TextBlock } from "@/types";

export async function extractPdf(buffer: Buffer): Promise<{ blocks: TextBlock[]; pageCount: number }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");

  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDocument = await loadingTask.promise;
  const pageCount = pdfDocument.numPages;
  const blocks: TextBlock[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const content = await page.getTextContent();

    for (const item of content.items) {
      const textItem = item as {
        str: string;
        transform: number[];
        height: number;
        fontName: string;
      };

      const text = textItem.str.trim();
      if (!text) continue;

      const fontSize =
        textItem.height > 0 ? textItem.height : Math.abs(textItem.transform[3]);
      const isBold = textItem.fontName?.toLowerCase().includes("bold") ?? false;

      blocks.push({
        text,
        fontSize: Math.round(fontSize * 10) / 10,
        isBold,
        pageNum,
      });
    }
  }

  await pdfDocument.destroy();
  return { blocks, pageCount };
}
