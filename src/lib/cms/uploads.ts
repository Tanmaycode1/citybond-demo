import { randomUUID } from "node:crypto";
import { storeFile } from "./storage";
export const MAX_UPLOAD = 3_500_000;
export function detectFile(
  bytes: Uint8Array,
): { type: string; extension: string } | null {
  const b = Buffer.from(bytes);
  if (b.length < 12) return null;
  if (b.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return { type: "image/jpeg", extension: "jpg" };
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { type: "image/png", extension: "png" };
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    return { type: "image/webp", extension: "webp" };
  if (
    b.toString("ascii", 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(b.toString("ascii", 8, 12))
  )
    return { type: "image/avif", extension: "avif" };
  if (b.toString("ascii", 0, 5) === "%PDF-")
    return { type: "application/pdf", extension: "pdf" };
  return null;
}
export async function uploadFile(
  file: File,
  prefix: "media" | "attachments",
  allowPdf = true,
) {
  if (!file.size || file.size > MAX_UPLOAD)
    throw new Error("Choose a file smaller than 3.5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectFile(bytes);
  if (!kind || (!allowPdf && kind.type === "application/pdf"))
    throw new Error(
      "Use a JPG, PNG, WebP or AVIF image" + (allowPdf ? ", or a PDF." : "."),
    );
  const key = `${prefix}/${randomUUID()}.${kind.extension}`;
  await storeFile(key, bytes, kind.type);
  return prefix === "media" ? `/api/media/${key.slice(6)}` : key;
}
