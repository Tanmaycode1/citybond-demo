import { assertOrigin, allowAttempt, clientIp } from "@/lib/cms/auth";
import { getPublicContent } from "@/lib/cms/content";
import { fastMaterials } from "@/lib/visualizer/fast-types";
import { VisualizerError } from "@/lib/visualizer/fast-server";
import { renderQuality } from "@/lib/visualizer/quality-server";
export const runtime = "nodejs";
export const maxDuration = 240;
const MAX_BYTES = 6 * 1024 * 1024;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Send a photo and selected finish." }, { status: 415 });
    if (Number(request.headers.get("content-length")) > MAX_BYTES) return Response.json({ error: "Choose a smaller photo." }, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Choose a photo first." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return Response.json({ error: "Choose a smaller photo." }, { status: 413 }); }
      chunks.push(value);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
    if (!body || typeof body.photo !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(body.photo) || typeof body.materialId !== "string")
      return Response.json({ error: "Choose a photo and a finish." }, { status: 400 });
    const material = fastMaterials((await getPublicContent()).products).find(m => m.id === body.materialId);
    if (!material) return Response.json({ error: "This finish is no longer available. Please choose another." }, { status: 400 });
    const token = process.env.MODEL_API_KEY;
    if (!token) return Response.json({ error: "The rendering service has not been configured yet." }, { status: 503 });
    const result = await renderQuality(Buffer.from(body.photo.split(",")[1], "base64"), material, token, async () => {
      if (!await allowAttempt("quality-visualizer", clientIp(request), 8, 60 * 60_000)) throw new VisualizerError("Your render limit has been reached. Please try again in an hour.", 429);
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") return Response.json({ error: "Invalid request origin." }, { status: 403 });
    if (error instanceof VisualizerError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "The render could not be prepared. Please try again." }, { status: 500 });
  }
}
