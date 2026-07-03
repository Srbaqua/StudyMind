import { fileTypeFromBuffer } from "file-type";

export type FileFormat = "pdf" | "pptx" | "image";

export async function detectFormat(buffer: Buffer): Promise<FileFormat> {
  const type = await fileTypeFromBuffer(buffer);
  if (!type) throw new Error("Cannot detect file type — file may be corrupted or empty");

  const mime = type.mime;
  if (mime === "application/pdf") return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/vnd.ms-powerpoint"
  )
    return "pptx";
  if (mime.startsWith("image/")) return "image";

  throw new Error(`Unsupported file type: ${mime}. Supported: PDF, PPTX, JPG, PNG, WEBP`);
}
