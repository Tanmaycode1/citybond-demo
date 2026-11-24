import { assertOrigin, allowAttempt, clientIp } from "@/lib/cms/auth";
import { segmentPhoto, VisualizerError } from "@/lib/visualizer/fast-server";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const token = process.env.MODEL_API_KEY;
    if (!token) return Response.json({ error: "The preview service has not been configured yet." }, { status: 503 });
    if (!/^image\/(jpeg|png|webp)(;|$)/.test(request.headers.get("content-type") || ""))
      return Response.json({ error: "Choose a JPG, PNG or WebP photo." }, { status: 415 });
    if (Number(request.headers.get("content-length")) > MAX_BYTES) return Response.json({ error: "Choose a smaller photo." }, { status: 413 });
    // Stream with a hard limit even when Content-Length is absent or incorrect.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Choose a photo first." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return Response.json({ error: "Choose a smaller photo." }, { status: 413 }); }
      chunks.push(value);
    }
    const result = await segmentPhoto(Buffer.concat(chunks), token, async () => {
      if (!(await allowAttempt("fast-visualizer", clientIp(request), 12, 60 * 60_000)))
        throw new VisualizerError("You have tried several photos. Please return in an hour or contact CityBond.", 429);
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") return Response.json({ error: "Invalid request origin." }, { status: 403 });
    if (error instanceof VisualizerError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "The preview could not be prepared. Please try again." }, { status: 500 });
  }
}
