import { createHash } from "node:crypto";
import sharp from "sharp";
import { formats, recordsOfKind, decodeMaskToRaster } from "@meta-sam/parser";
import type { FastScene, WallRegion } from "./fast-types";

export class VisualizerError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

/** Coalesces duplicate requests; failures are never cached. Bounded, process-local and ephemeral. */
export class SceneCache<T> {
  private entries = new Map<string, { expires: number; promise: Promise<T> }>();
  constructor(private capacity = 12, private ttl = 15 * 60_000) {}
  async get(key: string, create: () => Promise<T>, now = Date.now()) {
    for (const [k, e] of this.entries) if (e.expires <= now) this.entries.delete(k);
    const prior = this.entries.get(key);
    if (prior) return { value: await prior.promise, cached: true };
    if (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
    const promise = create();
    this.entries.set(key, { expires: now + this.ttl, promise });
    try { return { value: await promise, cached: false }; }
    catch (error) { if (this.entries.get(key)?.promise === promise) this.entries.delete(key); throw error; }
  }
}
const globalState = globalThis as typeof globalThis & { fastScenes?: SceneCache<Omit<FastScene, "cached">> };
const cache = globalState.fastScenes ||= new SceneCache();

export function parseMasks(text: string, width: number, height: number) {
  const parser = formats.segmentation.image().createParser();
  parser.push(text);
  const result = parser.finish({ status: "completed" }).result;
  if (result.diagnostics.length) throw new VisualizerError("The wall detector returned an unreadable mask. Try a different photo.");
  const boxes = new Map(recordsOfKind(result.records, "box").map(b => [b.objectId, b]));
  return recordsOfKind(result.records, "mask").slice(0, 24).map(m => {
    const b = boxes.get(m.objectId);
    if (!b || b.left < 0 || b.top < 0 || b.right > width || b.bottom > height || b.right <= b.left || b.bottom <= b.top || m.mask.width * m.mask.height > width * height)
      throw new VisualizerError("The wall detector returned invalid image bounds.");
    return { id: m.objectId, left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top,
      maskWidth: m.mask.width, maskHeight: m.mask.height, pixels: decodeMaskToRaster(m.mask) };
  });
}

export async function decodeRegionRaster(m: ReturnType<typeof parseMasks>[number]) {
  const data = await sharp(Buffer.from(m.pixels.map(v => v ? 255 : 0)), { raw: { width: m.maskWidth, height: m.maskHeight, channels: 1 } })
    .resize(m.width, m.height, { kernel: "nearest" }).greyscale().raw().toBuffer();
  if (data.length !== m.width * m.height) throw new VisualizerError("The wall mask could not be decoded.");
  return data;
}

export async function detect(imageUrl: string, concept: string, token: string) {
  let response: Response;
  try {
    response = await fetch("https://api.meta.ai/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sam-3.1", store: false, stream: false,
        input: [{ type: "message", role: "user", content: [{ type: "input_text", text: concept }, { type: "input_image", image_url: imageUrl }] }] }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch { throw new VisualizerError("Wall detection timed out. Please try again shortly.", 504); }
  if (!response.ok) {
    if (response.status === 402) throw new VisualizerError("The preview service needs billing to be enabled. Please contact CityBond.", 503);
    if (response.status === 429) throw new VisualizerError("The preview service is busy. Please try again shortly.", 429);
    throw new VisualizerError("Wall detection is temporarily unavailable. Please try again later.", 503);
  }
  const body = await response.json();
  if (body.status !== "completed") throw new VisualizerError("Wall detection did not complete. Please try another photo.");
  return (body.output || []).flatMap((m: { content?: { type: string; text?: string }[] }) => m.content || [])
    .filter((c: { type: string }) => c.type === "output_text").map((c: { text: string }) => c.text).join("");
}

export async function segmentPhoto(bytes: Buffer, token: string, beforeMiss: () => Promise<void> = async () => {}) {
  let image: Buffer, width: number, height: number;
  try {
    const decoded = await sharp(bytes, { limitInputPixels: 24_000_000 }).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).png().toBuffer({ resolveWithObject: true });
    image = decoded.data; width = decoded.info.width; height = decoded.info.height;
    if (width < 200 || height < 200) throw new Error("too small");
  } catch { throw new VisualizerError("Choose a valid JPG, PNG or WebP exterior photo of at least 200 × 200 pixels.", 400); }
  const hash = createHash("sha256").update("sam-3.1-exterior-v1").update(image).digest("hex");
  const { value, cached } = await cache.get(hash, async () => {
    await beforeMiss();
    const start = performance.now();
    const url = `data:image/png;base64,${image.toString("base64")}`;
    // Exterior gate and wall masks are independent calls: run concurrently to avoid doubling latency.
    const [buildingText, wallText] = await Promise.all([detect(url, "building", token), detect(url, "exterior wall", token)]);
    const buildingMasks = parseMasks(buildingText, width, height);
    const building = new Uint8Array(width * height);
    for (const m of buildingMasks) {
      const data = await decodeRegionRaster(m);
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++)
        if (data[y * m.width + x]) building[(m.top + y) * width + m.left + x] = 255;
    }
    if (building.reduce((a, v) => a + (v ? 1 : 0), 0) < width * height * 0.02)
      throw new VisualizerError("Please upload an exterior building photo. Interior rooms are not supported; include more of the building if the photo is tightly cropped.", 422);
    const regions: WallRegion[] = [];
    for (const m of parseMasks(wallText, width, height)) {
      const data = await decodeRegionRaster(m);
      let count = 0;
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
        const i = y * m.width + x;
        data[i] = data[i] && building[(m.top + y) * width + m.left + x] ? 255 : 0;
        if (data[i]) count++;
      }
      if (count < Math.max(64, width * height * 0.0005)) continue;
      const png = await sharp(data, { raw: { width: m.width, height: m.height, channels: 1 } }).png().toBuffer();
      regions.push({ id: m.id, left: m.left, top: m.top, width: m.width, height: m.height, png: `data:image/png;base64,${png.toString("base64")}` });
    }
    if (!regions.length) throw new VisualizerError("No usable exterior walls were found. Try a clearer, wider photo of the building.", 422);
    const buildingPng = await sharp(building, { raw: { width, height, channels: 1 } }).png().toBuffer();
    return { width, height, regions, building: `data:image/png;base64,${buildingPng.toString("base64")}`, segmentationMs: Math.round(performance.now() - start), model: "sam-3.1" };
  });
  return { ...value, cached };
}
