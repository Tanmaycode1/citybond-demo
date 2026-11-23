/// <reference lib="webworker" />
// Wall visualizer worker. All AI models run here, in the visitor's browser.
// The photo never leaves the device.
import { AutoModel, AutoProcessor, RawImage } from "@huggingface/transformers";
import { analyseScene, facesForRegion, shadingMap, type SceneFrame } from "./geometry";
import { flood, guidedFilter, regionAlpha, removeOpenings, resample, snapToEdges, tidy } from "./masks";
import { exteriorMask, constrainToFacade, isFacadeLabel } from "./exterior";
import type { TapMode, WorkerRequest, WorkerResponse } from "./protocol";

const SEGMENTATION = "Xenova/segformer-b2-finetuned-ade-512-512";
const DEPTH = "onnx-community/depth-anything-v2-small";
const SAM = "onnx-community/sam2.1-hiera-tiny-ONNX";
const GROUND = ["floor", "road", "sidewalk", "earth", "grass", "path", "field", "rug", "sand", "dirt track"];
const WORK = 1024;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Loaded = { model: any; processor: any };
const post = (message: WorkerResponse, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(message, transfer);

let device: "webgpu" | "wasm" = "wasm";
const files = new Map<string, { loaded: number; total: number }>();
function reportDownload(label: string) {
  return (event: any) => {
    if (event.status !== "progress" || !event.total) return;
    files.set(event.file + event.name, { loaded: event.loaded, total: event.total });
    let loaded = 0;
    let total = 0;
    for (const entry of files.values()) {
      loaded += entry.loaded;
      total += entry.total;
    }
    post({ type: "progress", stage: "download", label, loaded, total });
  };
}
async function load(id: string, label: string, precise?: Record<string, string>): Promise<Loaded> {
  const processor = await AutoProcessor.from_pretrained(id);
  const options = (target: "webgpu" | "wasm") => ({ device: target, dtype: target === "webgpu" ? "fp16" : precise || "q8", progress_callback: reportDownload(label) }) as any;
  try {
    return { processor, model: await AutoModel.from_pretrained(id, options(device)) };
  } catch (error) {
    if (device === "wasm") throw error;
    // The graphics card path failed. Use the processor path for every model.
    device = "wasm";
    return { processor, model: await AutoModel.from_pretrained(id, options("wasm")) };
  }
}
const cache = new Map<string, Promise<Loaded>>();
const model = (id: string, label: string, precise?: Record<string, string>) => {
  if (!cache.has(id)) cache.set(id, load(id, label, precise));
  return cache.get(id)!;
};

type State = {
  W: number;
  H: number;
  image: RawImage;
  scene: SceneFrame;
  wall: Float32Array;
  gray: Float32Array;
  /** Photo brightness, 0..1. The guide for edge refinement. */
  guide: Float32Array;
  /** 0 = excluded surface, 2 = exterior building. */
  kind: Uint8Array;
  /** True when the edge model has read the photo. */
  samReady?: boolean;
  sam?: Promise<{ embeddings: Record<string, any>; loaded: Loaded }>;
};
let state: State | null = null;
let generation = 0;

async function analyse(bitmap: ImageBitmap, preferGpu: boolean) {
  const run = ++generation;
  state = null;
  device = preferGpu ? "webgpu" : "wasm";
  const ratio = WORK / Math.max(bitmap.width, bitmap.height);
  const W = Math.max(64, Math.round(bitmap.width * Math.min(1, ratio)));
  const H = Math.max(64, Math.round(bitmap.height * Math.min(1, ratio)));
  const canvas = new OffscreenCanvas(W, H);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, W, H);
  bitmap.close();
  const pixels = context.getImageData(0, 0, W, H).data;
  const rgb = new Uint8ClampedArray(W * H * 3);
  const gray = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    rgb[i * 3] = pixels[i * 4];
    rgb[i * 3 + 1] = pixels[i * 4 + 1];
    rgb[i * 3 + 2] = pixels[i * 4 + 2];
    gray[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
  }
  const image = new RawImage(rgb, W, H, 3);

  post({ type: "progress", stage: "walls", label: "Finding the exterior façade" });
  const segmentation = await model(SEGMENTATION, "Loading the wall model");
  if (run !== generation) return;
  post({ type: "progress", stage: "walls", label: "Finding the exterior façade" });
  const { logits } = await segmentation.model(await segmentation.processor(image));
  const [, classes, lh, lw] = logits.dims as number[];
  const names: string[] = [];
  for (let c = 0; c < classes; c++) names.push(String(segmentation.model.config.id2label[c]).split(",")[0].trim());
  const paintable = names.map(isFacadeLabel);
  const isGround = names.map((name) => GROUND.includes(name));
  const isSky = names.map((name) => name === "sky");
  const data = logits.data as Float32Array;
  const lowWall = new Float32Array(lh * lw);
  const lowGround = new Float32Array(lh * lw);
  const lowSky = new Float32Array(lh * lw);
  const plane = lh * lw;
  for (let i = 0; i < plane; i++) {
    let max = -Infinity;
    let best = 0;
    for (let c = 0; c < classes; c++) {
      const value = data[c * plane + i];
      if (value > max) {
        max = value;
        best = c;
      }
    }
    let sum = 0;
    let wallSum = 0;
    for (let c = 0; c < classes; c++) {
      const e = Math.exp(data[c * plane + i] - max);
      sum += e;
      if (paintable[c]) wallSum += e;
    }
    lowWall[i] = wallSum / sum;
    lowGround[i] = isGround[best] ? 1 : 0;
    lowSky[i] = isSky[best] ? 1 : 0;
  }
  const wall = resample(lowWall, lw, lh, W, H);
  const guide = new Float32Array(W * H);
  for (let i = 0; i < guide.length; i++) guide[i] = gray[i] / 255;
  const groundSoft = resample(lowGround, lw, lh, W, H);
  const skySoft = resample(lowSky, lw, lh, W, H);
  const { kind, accepted } = exteriorMask(wall);
  if (!accepted) {
    post({ type: "error", code: "exterior-required", message: "No exterior façade detected" });
    return;
  }
  const ground = new Uint8Array(W * H);
  const sky = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    ground[i] = groundSoft[i] > 0.5 ? 1 : 0;
    sky[i] = skySoft[i] > 0.5 ? 1 : 0;
  }

  post({ type: "progress", stage: "depth", label: "Estimating the façade depth" });
  const depth = await model(DEPTH, "Loading the depth model");
  if (run !== generation) return;
  post({ type: "progress", stage: "depth", label: "Estimating the façade depth" });
  const { predicted_depth: predicted } = await depth.model(await depth.processor(image));
  const dims = predicted.dims as number[];
  const disparity = resample(predicted.data as Float32Array, dims[dims.length - 1], dims[dims.length - 2], W, H);

  post({ type: "progress", stage: "geometry", label: "Working out the wall angles" });
  const scene = analyseScene(gray, W, H, { disparity, wall, ground, sky });
  const shade = shadingMap(gray, wall, W, H);
  const shadeBytes = new Uint8Array(shade.w * shade.h);
  for (let i = 0; i < shadeBytes.length; i++) shadeBytes[i] = Math.max(0, Math.min(255, Math.round(shade.map[i] * 255)));
  if (run !== generation) return;
  state = { W, H, image, scene, wall, gray, guide, kind };

  // Suggest the centre of a confidently detected exterior building surface.
  let suggestion: [number, number] | null = null;
  {
    const step = 8;
    let bestScore = 0;
    const columns = Math.floor(W / step);
    const rows = Math.floor(H / step);
    const distance = new Float32Array(columns * rows);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < columns; x++) {
        const value = kind[(y * step + 4) * W + x * step + 4];
        const inside = value === 2;
        const left = x > 0 ? distance[y * columns + x - 1] : 0;
        const up = y > 0 ? distance[(y - 1) * columns + x] : 0;
        distance[y * columns + x] = inside ? Math.min(left, up) + 1 : 0;
      }
    for (let y = rows - 1; y >= 0; y--)
      for (let x = columns - 1; x >= 0; x--) {
        const right = x < columns - 1 ? distance[y * columns + x + 1] : 0;
        const down = y < rows - 1 ? distance[(y + 1) * columns + x] : 0;
        const value = Math.min(distance[y * columns + x], Math.min(right, down) + 1);
        distance[y * columns + x] = value;
        if (value > bestScore) {
          bestScore = value;
          suggestion = [x * step + 4, y * step + 4];
        }
      }
    if (bestScore < 5) suggestion = null;
  }
  // The edge model (SAM) draws the exact outline of a selected wall. It reads the photo in the background,
  // so the visitor sees a first result early.
  const current = state;
  const sam = (async () => {
    // Start a little later: the first wall selection is already waiting and must run first.
    await new Promise((resolve) => setTimeout(resolve, 600));
    // The mask decoder stays at full precision: a reduced decoder gives ragged edges and is slower.
    const loaded = await model(SAM, "Loading the edge model", { vision_encoder: "q8", prompt_encoder_mask_decoder: "fp32" });
    const inputs = await loaded.processor(image);
    const embeddings = await loaded.model.get_image_embeddings({ pixel_values: inputs.pixel_values });
    return { embeddings, loaded };
  })();
  state.sam = sam;
  const kindCopy = kind.slice();
  post(
    {
      type: "scene",
      W,
      H,
      f: scene.f,
      kind: kindCopy,
      shade: shadeBytes,
      shadeW: shade.w,
      shadeH: shade.h,
      suggestion,
      exterior: true,
      scaleFromGround: scene.scaleFromGround,
      device,
    },
    [kindCopy.buffer, shadeBytes.buffer],
  );

  sam.then(
    () => {
      current.samReady = true;
      if (run === generation) post({ type: "tap-ready" });
    },
    (error) => run === generation && post({ type: "tap-unavailable", message: String(error?.message || error) }),
  );
}

type Prompted = { masks: Uint8Array[]; scores: number[] };
/** Ask the edge model for the surface that contains the positive points (label 1) and not the negative points (label 0). */
async function samPrompt(current: State, points: number[], labels: number[]): Promise<Prompted | null> {
  if (!current.sam || !points.length) return null;
  const { embeddings, loaded } = await current.sam;
  const { W, H } = current;
  const coordinates = points.map((i) => [i % W, Math.floor(i / W)]);
  const inputs = await loaded.processor(current.image, { input_points: [[coordinates]], input_labels: [[labels]] });
  const output = await loaded.model({ ...embeddings, input_points: inputs.input_points, input_labels: inputs.input_labels });
  const tensor = (await loaded.processor.post_process_masks(output.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes))[0];
  const count = tensor.dims[tensor.dims.length - 3] as number;
  const scores = Array.from(output.iou_scores.data as Float32Array).slice(0, count);
  const masks: Uint8Array[] = [];
  for (let k = 0; k < count; k++) {
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = tensor.data[k * W * H + i] ? 1 : 0;
    masks.push(mask);
  }
  return { masks, scores };
}
const bestOf = (result: Prompted, contains?: number) => {
  const order = result.scores.map((_, i) => i).sort((p, q) => result.scores[q] - result.scores[p]);
  return result.masks[(contains === undefined ? undefined : order.find((i) => result.masks[i][contains])) ?? order[0]];
};

/** One surface under a tap. */
async function samMask(current: State, x: number, y: number): Promise<Uint8Array | null> {
  const { W, H } = current;
  const at = Math.round(y) * W + Math.round(x);
  const result = await samPrompt(current, [at], [1]);
  if (!result) return null;
  const raw = bestOf(result, at);
  const clean = tidy(raw, W, H, 2);
  // Keep only the part that touches the tap.
  const start = clean[at] ? at : raw[at] ? at : -1;
  return start < 0 ? clean : flood((i) => clean[i] === 1 || (i === at && raw[i] === 1), W, H, start);
}

async function tap(id: number, x: number, y: number, mode: TapMode) {
  const current = state;
  if (!current) return;
  const { W, H, scene, kind } = current;
  const px = Math.max(0, Math.min(W - 1, Math.round(x)));
  const py = Math.max(0, Math.min(H - 1, Math.round(y)));
  const at = py * W + px;
  if (mode !== "remove" && kind[at] !== 2) {
    post({ type: "region", id, mode, failed: "exterior-surface-required" });
    return;
  }
  /** Work out the planes and the soft edge of a region, and send it to the page. */
  const send = (region: Uint8Array, flags: { provisional?: boolean; refines?: boolean } = {}) => {
    constrainToFacade(region, kind);
    const edgeLabels: number[] = [];
    const faces = facesForRegion(scene, region);
    if (!faces.planes.length) {
      post({ type: "region", id, mode, ...flags, failed: "too-small" });
      return;
    }
    // Opacity with a soft edge that follows the fine edges of the photo.
    const soft = guidedFilter(Float32Array.from(region), current.guide, W, H, 3, 2e-4);
    const alpha = regionAlpha(region, soft, W, H);
    // Never feather outside the detected façade.
    for (let i = 0; i < alpha.length; i++) if (kind[i] !== 2) alpha[i] = 0;
    // Pixels in the soft edge need a plane too.
    for (let i = 0; i < alpha.length; i++)
      if (alpha[i] && faces.labels[i] === 255) {
        const x = i % W;
        const near = [x > 0 ? i - 1 : i, x < W - 1 ? i + 1 : i, i >= W ? i - W : i, i < W * (H - 1) ? i + W : i, x > 1 ? i - 2 : i, x < W - 2 ? i + 2 : i, i >= 2 * W ? i - 2 * W : i, i < W * (H - 2) ? i + 2 * W : i];
        let label = 255;
        for (const q of near) if (faces.labels[q] !== 255 && region[q]) label = faces.labels[q];
        if (label === 255) alpha[i] = 0;
        else edgeLabels.push(i, label);
      }
    for (let k = 0; k < edgeLabels.length; k += 2) faces.labels[edgeLabels[k]] = edgeLabels[k + 1];
    post({ type: "region", id, mode, ...flags, mask: alpha, labels: faces.labels, planes: faces.planes, anchors: faces.anchors }, [alpha.buffer, faces.labels.buffer]);
  };
  let region: Uint8Array | null = null;
  try {
    if (mode === "add") {
      const base = flood((i) => kind[i] === 2, W, H, at);
      const split = facesForRegion(scene, base);
      if (split.planes.length > 1) {
        const face = split.labels[at];
        for (let i = 0; i < base.length; i++) if (split.labels[i] !== face) base[i] = 0;
      }
      // Exterior sunlight can confuse SAM; keep the building segmentation in charge.
      region = snapToEdges(tidy(base, W, H, 2), current.guide, W, H);
      removeOpenings(region, current.gray, W, H);
    } else {
      region = await samMask(current, px, py);
      if (region && mode !== "remove") constrainToFacade(region, kind);
    }
  } catch (error) {
    post({ type: "region", id, mode, failed: String((error as Error)?.message || error) });
    return;
  }
  if (state !== current) return;
  if (!region) {
    post({ type: "region", id, mode, failed: "tap-model-not-ready" });
    return;
  }
  if (mode === "remove") {
    post({ type: "region", id, mode, mask: region }, [region.buffer]);
    return;
  }
  send(region);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "analyse")
    analyse(message.bitmap, message.preferGpu).catch((error) => post({ type: "error", message: String(error?.message || error) }));
  else if (message.type === "tap") tap(message.id, message.x, message.y, message.mode);
};
