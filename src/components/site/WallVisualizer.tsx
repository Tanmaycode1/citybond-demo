"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SiteContent } from "@/lib/cms/schema";
import { rotatePlane, type Plane, type Vec3 } from "@/lib/visualizer/geometry";
import { materialsFrom, swatchStyle } from "@/lib/visualizer/materials";
import type { TapMode, WorkerRequest, WorkerResponse } from "@/lib/visualizer/protocol";
import { MAX_PLANES, Renderer } from "@/lib/visualizer/renderer";
import Link from "./SiteLink";

const SAMPLES = [
  { src: "/stock/modern-residence.webp", label: "House front" },
];
const MAX_RENDER = 1800;
const MAX_UPLOAD = 25 * 1024 * 1024;

type Scene = Extract<WorkerResponse, { type: "scene" }>;
type Selection = { mask: Uint8Array; labels: Uint8Array; planes: Plane[]; base: Plane[]; anchors: Vec3[]; turns: number[]; refs: number[] };
type Status = "idle" | "working" | "ready" | "error";

const emptySelection = (size: number): Selection => ({ mask: new Uint8Array(size), labels: new Uint8Array(size).fill(255), planes: [], base: [], anchors: [], turns: [], refs: [] });
const copySelection = (s: Selection): Selection => ({ mask: s.mask.slice(), labels: s.labels.slice(), planes: [...s.planes], base: [...s.base], anchors: [...s.anchors], turns: [...s.turns], refs: [...s.refs] });

/** Soft edge for the selection so the product blends into the photo. */
function feather(mask: Uint8Array, W: number, H: number) {
  const a = new Uint8Array(W * H);
  const b = new Uint8Array(W * H);
  a.set(mask);
  for (let pass = 0; pass < 1; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        b[i] = (a[x > 0 ? i - 1 : i] + a[i] * 2 + a[x < W - 1 ? i + 1 : i]) >> 2;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        a[i] = (b[y > 0 ? i - W : i] + b[i] * 2 + b[y < H - 1 ? i + W : i]) >> 2;
      }
  }
  return a;
}

export function WallVisualizer({ content, heading = true }: { content: SiteContent; heading?: boolean }) {
  const materials = useMemo(() => materialsFrom(content.products), [content.products]);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ label: "", ratio: 0 });
  const [error, setError] = useState("");
  const [materialSlug, setMaterialSlug] = useState(materials[0]?.slug || "");
  const [scale, setScale] = useState(1);
  const [joints, setJoints] = useState(true);
  const [turned, setTurned] = useState(false);
  const [split, setSplit] = useState(0);
  const [mode, setMode] = useState<TapMode>("add");
  const [tapReady, setTapReady] = useState(false);
  const [busyTap, setBusyTap] = useState(false);
  const [hint, setHint] = useState("");
  const [hasSelection, setHasSelection] = useState(false);
  const [angle, setAngle] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const historyRef = useRef<Selection[]>([]);
  const lastPlanesRef = useRef<number[]>([]);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const tapId = useRef(0);
  /** A quick outline that waits for its exact outline: the tap id and the selection before the tap. */
  const pendingRefineRef = useRef<{ id: number; snapshot: Selection } | null>(null);
  const viewRef = useRef({ materialSlug, scale, joints, turned, split });

  const material = materials.find((m) => m.slug === materialSlug) || materials[0];

  const draw = useCallback(() => {
    const renderer = rendererRef.current;
    const view = viewRef.current;
    const chosen = materials.find((m) => m.slug === view.materialSlug) || materials[0];
    if (!renderer || !chosen || !sceneRef.current) return;
    renderer.draw({ material: chosen, scale: view.scale, joints: view.joints, turned: view.turned, split: view.split, highlight: 0 });
  }, [materials]);

  const pushSelection = useCallback(() => {
    const scene = sceneRef.current;
    const selection = selectionRef.current;
    const renderer = rendererRef.current;
    if (!scene || !selection || !renderer) return;
    renderer.setSelection(feather(selection.mask, scene.W, scene.H), selection.labels, scene.W, scene.H, selection.planes, selection.refs);
    setHasSelection(selection.mask.some((v) => v > 0));
    setCanUndo(historyRef.current.length > 0);
    draw();
  }, [draw]);

  useEffect(() => {
    viewRef.current = { materialSlug, scale, joints, turned, split };
    draw();
  }, [draw, materialSlug, scale, joints, turned, split]);

  const sendTap = useCallback((x: number, y: number, tapMode: TapMode) => {
    const worker = workerRef.current;
    if (!worker) return;
    setBusyTap(true);
    worker.postMessage({ type: "tap", id: ++tapId.current, x, y, mode: tapMode } satisfies WorkerRequest);
  }, []);

  const onMessage = useCallback(
    (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        setProgress((previous) => ({ label: message.label, ratio: message.total ? (message.loaded || 0) / message.total : message.stage === "download" ? previous.ratio : 1 }));
      } else if (message.type === "error") {
        setStatus("error");
        setError(message.code === "exterior-required" ? "Please upload an exterior building photo. We could not identify a façade in this image. Interior rooms are not supported; include more of the building if your photo is tightly cropped." : "We could not read this photo on your device. Please try another photo, or a newer browser.");
        if (message.code !== "exterior-required") console.error("[visualizer]", message.message);
      } else if (message.type === "scene") {
        const bitmap = bitmapRef.current;
        if (!bitmap || !canvasRef.current) return;
        try {
          rendererRef.current ||= new Renderer(canvasRef.current);
        } catch {
          setStatus("error");
          setError("Your browser cannot draw the preview (WebGL 2 is not available).");
          return;
        }
        const renderer = rendererRef.current;
        renderer.onTextureLoaded = draw;
        renderer.setPhoto(bitmap, message.f);
        renderer.setShade(message.shade, message.shadeW, message.shadeH);
        sceneRef.current = message;
        selectionRef.current = emptySelection(message.W * message.H);
        historyRef.current = [];
        lastPlanesRef.current = [];
        setStatus("ready");
        setAngle(0);
        pushSelection();
        if (message.suggestion) {
          setHint("We covered the largest wall. Tap another wall to add it.");
          sendTap(message.suggestion[0], message.suggestion[1], "add");
        } else setHint("Tap a wall in the photo to cover it.");
      } else if (message.type === "tap-ready") setTapReady(true);
      else if (message.type === "tap-unavailable") console.error("[visualizer] tap model", message.message);
      else if (message.type === "region") {
        if (message.id === tapId.current) setBusyTap(false);
        const scene = sceneRef.current;
        let selection = selectionRef.current;
        if (!scene || !selection) return;
        if (message.refines) {
          // The exact outline replaces the quick outline, when nothing else changed in between.
          const pending = pendingRefineRef.current;
          pendingRefineRef.current = null;
          if (!pending || pending.id !== message.id || message.failed || !message.mask) {
            setHint((previous) => (previous.startsWith("Making") ? "Tap another wall to add it, or pick a different product." : previous));
            return;
          }
          selection = copySelection(pending.snapshot);
          selectionRef.current = selection;
        } else pendingRefineRef.current = null;
        if (message.failed || !message.mask) {
          setHint(message.failed === "exterior-surface-required" ? "Choose an exterior building surface. Sky, landscaping and other objects cannot be covered." : message.failed === "tap-model-not-ready" ? "Tap-to-select is still loading. Please try again in a moment." : "We could not find a surface there. Tap the middle of a wall.");
          return;
        }
        if (!message.refines) {
          historyRef.current.push(copySelection(selection));
          if (historyRef.current.length > 12) historyRef.current.shift();
        }
        if (message.mode === "remove") {
          for (let i = 0; i < message.mask.length; i++) if (message.mask[i]) selection.mask[i] = 0;
          setHint("Removed. Tap again to remove more, or switch back to Add.");
        } else if (message.labels && message.planes && message.anchors) {
          const offset = selection.planes.length;
          if (offset + message.planes.length > MAX_PLANES) {
            historyRef.current.pop();
            setHint("This photo has the maximum number of areas. Use Reset to start again.");
            return;
          }
          // Brightness reference: the usual lit tone of this area, so the product keeps its true colour.
          const samples: number[][] = message.planes.map(() => []);
          const stride = Math.max(1, Math.floor(Math.sqrt((scene.W * scene.H) / 40000)));
          for (let y = 0; y < scene.H; y += stride)
            for (let x = 0; x < scene.W; x += stride) {
              const i = y * scene.W + x;
              if (!message.mask[i] || message.labels[i] === 255) continue;
              const sx = Math.min(scene.shadeW - 1, Math.floor((x * scene.shadeW) / scene.W));
              const sy = Math.min(scene.shadeH - 1, Math.floor((y * scene.shadeH) / scene.H));
              samples[message.labels[i]]?.push(scene.shade[sy * scene.shadeW + sx] / 255);
            }
          const all = samples.flat().sort((a, b) => a - b);
          const overall = all.length ? all[Math.floor(all.length * 0.7)] : 0.6;
          // A second tap on the same wall continues the pattern of the first tap.
          const target: number[] = [];
          message.planes.forEach((plane, index) => {
            const same = selection.planes.findIndex((known) => known.n[0] * plane.n[0] + known.n[1] * plane.n[1] + known.n[2] * plane.n[2] > 0.9995 && Math.abs(known.h - plane.h) < 0.12 * Math.abs(known.h));
            if (same >= 0) {
              target.push(same);
              return;
            }
            target.push(selection.planes.length);
            const values = samples[index].sort((a, b) => a - b);
            const own = values.length ? values[Math.floor(values.length * 0.7)] : overall;
            selection.planes.push(plane);
            selection.base.push(plane);
            selection.anchors.push(message.anchors![index]);
            selection.turns.push(0);
            // Mostly the area's own tone, a little of the whole selection: faces keep some of their light difference.
            selection.refs.push(Math.max(0.08, Math.pow(own, 0.8) * Math.pow(overall, 0.2)));
          });
          for (let i = 0; i < message.mask.length; i++)
            if (message.mask[i] && message.labels[i] !== 255) {
              // Keep the plane of the stronger pixel where two areas meet.
              if (message.mask[i] >= selection.mask[i]) selection.labels[i] = target[message.labels[i]];
              selection.mask[i] = Math.max(selection.mask[i], message.mask[i]);
            }
          lastPlanesRef.current = [...new Set(target)];
          setAngle(0);
          if (message.provisional) {
            pendingRefineRef.current = { id: message.id, snapshot: historyRef.current[historyRef.current.length - 1] };
            setHint("Making the wall edges exact…");
          } else if (message.refines) setHint("The wall edges are exact now. Tap another wall to add it.");
          else setHint((previous) => (previous.startsWith("We covered") ? previous : "Added. Tap another wall, or pick a different product."));
        }
        pushSelection();
      }
    },
    [draw, pushSelection, sendTap],
  );
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      bitmapRef.current?.close();
    },
    [],
  );

  const start = useCallback(async (source: Blob) => {
    setError("");
    setStatus("working");
    setProgress({ label: "Reading your photo", ratio: 0 });
    setTapReady(false);
    setBusyTap(false);
    setHasSelection(false);
    setSplit(0);
    sceneRef.current = null;
    try {
      const full = await createImageBitmap(source, { imageOrientation: "from-image" });
      const ratio = Math.min(1, MAX_RENDER / Math.max(full.width, full.height));
      const bitmap = ratio < 1 ? await createImageBitmap(full, { resizeWidth: Math.round(full.width * ratio), resizeHeight: Math.round(full.height * ratio), resizeQuality: "high" }) : full;
      if (bitmap !== full) full.close();
      bitmapRef.current?.close();
      bitmapRef.current = bitmap;
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL("../../lib/visualizer/worker.ts", import.meta.url), { type: "module" });
        workerRef.current.onmessage = (event) => onMessageRef.current(event);
        workerRef.current.onerror = (event) => {
          console.error("[visualizer] worker", event.message);
          setStatus("error");
          setError("The preview engine could not start in this browser.");
        };
      }
      const forWorker = await createImageBitmap(bitmap);
      // The graphics card path is opt-in (?gpu=1) until it is tested on more devices.
      const preferGpu = "gpu" in navigator && new URLSearchParams(location.search).get("gpu") === "1";
      workerRef.current.postMessage({ type: "analyse", bitmap: forWorker, preferGpu } satisfies WorkerRequest, [forWorker]);
    } catch (reason) {
      console.error("[visualizer]", reason);
      setStatus("error");
      setError("We could not open this file. Please use a JPG, PNG or WebP photo.");
    }
  }, []);

  const onFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setError("Please choose a photo (JPG, PNG or WebP). Video support comes later.");
      return;
    }
    if (file.size > MAX_UPLOAD) {
      setStatus("error");
      setError("This photo is larger than 25 MB. Please choose a smaller photo.");
      return;
    }
    start(file);
  };
  const loadSample = async (src: string) => {
    setStatus("working");
    setProgress({ label: "Reading the photo", ratio: 0 });
    try {
      const response = await fetch(src);
      start(await response.blob());
    } catch {
      setStatus("error");
      setError("We could not load the sample photo.");
    }
  };

  const onStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    if (!scene || !canvas || status !== "ready" || busyTap) return;
    if ((event.target as HTMLElement).closest("[data-no-tap]")) return;
    const box = canvas.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * scene.W;
    const y = ((event.clientY - box.top) / box.height) * scene.H;
    if (x < 0 || y < 0 || x >= scene.W || y >= scene.H) return;
    const kind = scene.kind[Math.floor(y) * scene.W + Math.floor(x)];
    if (mode !== "remove" && kind !== 2) {
      setHint("Choose an exterior building surface. Sky, landscaping and other objects cannot be covered.");
      return;
    }
    if (!tapReady && mode !== "add") {
      setHint("Tap-to-select is still loading. Please try again in a moment.");
      return;
    }
    sendTap(x, y, mode);
  };

  const undo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    pendingRefineRef.current = null;
    selectionRef.current = previous;
    lastPlanesRef.current = [];
    setAngle(0);
    pushSelection();
  };
  const reset = () => {
    const scene = sceneRef.current;
    const selection = selectionRef.current;
    if (!scene || !selection) return;
    pendingRefineRef.current = null;
    historyRef.current.push(copySelection(selection));
    selectionRef.current = emptySelection(scene.W * scene.H);
    lastPlanesRef.current = [];
    setAngle(0);
    setHint("Tap a wall in the photo to cover it.");
    pushSelection();
  };
  const changeAngle = (degrees: number) => {
    setAngle(degrees);
    const selection = selectionRef.current;
    const renderer = rendererRef.current;
    if (!selection || !renderer) return;
    for (const index of lastPlanesRef.current) {
      selection.turns[index] = degrees;
      selection.planes[index] = rotatePlane(selection.base[index], selection.anchors[index], (degrees * Math.PI) / 180);
    }
    renderer.setPlanes(selection.planes);
    draw();
  };
  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const previous = viewRef.current.split;
    viewRef.current = { ...viewRef.current, split: 0 };
    draw();
    canvas.toBlob(
      (blob) => {
        viewRef.current = { ...viewRef.current, split: previous };
        draw();
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `citybond-${material?.slug || "preview"}.jpg`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      },
      "image/jpeg",
      0.92,
    );
  };

  if (!materials.length) return null;
  const working = status === "working";
  const ready = status === "ready";
  return (
    <section className="wall-visualizer" id="visualizer" aria-label="Exterior wall visualizer">
      <div className="wrap">
        {heading && (
          <div className="wv-head">
            <p className="eyebrow">Exterior wall visualizer</p>
            <h2>See CityBond on your façade.</h2>
            <p>Upload an exterior building photo. Choose a façade wall, then preview a CityBond finish.</p>
          </div>
        )}
        <div className={`wv-body${ready ? " is-ready" : ""}`}>
          <div className="wv-stage-column">
            <div
              className={`wv-stage${ready ? " is-ready" : ""}${dragging ? " is-dragging" : ""}${mode === "remove" ? " is-remove" : ""}`}
              ref={stageRef}
              onClick={onStageClick}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                onFile(event.dataTransfer.files[0]);
              }}
            >
              <div className="wv-frame" hidden={!ready}>
                <canvas ref={canvasRef} className="wv-canvas" aria-label={`Your photo with ${material.name} on the selected walls`} role="img" />
                {split > 0.02 && <span className="wv-divider" style={{ left: `${split * 100}%` }} aria-hidden="true" />}
                {busyTap && <span className="wv-busy" data-no-tap>Selecting…</span>}
              </div>
              {!ready && (
                <div className="wv-drop" data-no-tap>
                  {working ? (
                    <div className="wv-progress" role="status" aria-live="polite">
                      <strong>{progress.label || "Working"}</strong>
                      <span className="wv-bar">
                        <span style={{ width: `${Math.round(Math.min(1, progress.ratio) * 100)}%` }} />
                      </span>
                      <small>The first photo takes longer, because your browser downloads the models once. Your photo stays on your device.</small>
                    </div>
                  ) : (
                    <>
                      <strong>Drop an exterior photo here</strong>
                      <span>Use a clear exterior building photo with the façade visible. Interior rooms are not supported.</span>
                      <button type="button" className="button" onClick={() => fileRef.current?.click()}>
                        Upload a photo <span aria-hidden="true">↗</span>
                      </button>
                      {status === "error" && (
                        <p className="wv-error" role="alert">
                          {error}
                        </p>
                      )}
                      <div className="wv-samples">
                        <span>Or try a sample</span>
                        <div>
                          {SAMPLES.map((sample) => (
                            <button type="button" key={sample.src} onClick={() => loadSample(sample.src)} data-sample={sample.label}>
                              <img src={sample.src} alt="" loading="lazy" />
                              {sample.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} />
            </div>
            {ready && (
              <div className="wv-toolbar">
                <p className="wv-hint" role="status" aria-live="polite">
                  {hint}
                  {!tapReady && mode !== "add" && " This tool is still loading…"}
                </p>
                <div className="wv-tools">
                  <div className="wv-toggle" role="group" aria-label="Tap mode">
                    <button type="button" aria-pressed={mode === "add"} onClick={() => setMode("add")} title="Tap a wall to cover the whole wall">Add wall</button>
                    <button type="button" aria-pressed={mode === "part"} onClick={() => setMode("part")} title="Tap to cover only one surface, for example one band or one pillar">Add part</button>
                    <button type="button" aria-pressed={mode === "remove"} onClick={() => setMode("remove")} title="Tap a window, a door or another object to uncover it">Remove</button>
                  </div>
                  <button type="button" onClick={undo} disabled={!canUndo}>Undo</button>
                  <button type="button" onClick={reset} disabled={!hasSelection}>Reset</button>
                  <button type="button" onClick={() => fileRef.current?.click()}>New photo</button>
                </div>
                <label className="wv-compare">
                  <span>Before</span>
                  <input type="range" min={0} max={100} value={Math.round(split * 100)} onChange={(event) => setSplit(Number(event.target.value) / 100)} aria-label="Compare before and after" />
                  <span>After</span>
                </label>
              </div>
            )}
          </div>
          <aside className="wv-panel" aria-label="Products">
            <h3>{material.name}</h3>
            <p className="wv-finish">{material.finish}</p>
            <div className="wv-materials" role="listbox" aria-label="Choose a product">
              {materials.map((item) => (
                <button type="button" role="option" aria-selected={item.slug === material.slug} key={item.slug} onClick={() => setMaterialSlug(item.slug)} title={`${item.name} · ${item.finish}`} data-material={item.slug}>
                  <span className={`wv-swatch${item.relief ? " is-fluted" : ""}`} style={swatchStyle(item)} aria-hidden="true" />
                  {item.name}
                </button>
              ))}
            </div>
            <fieldset className="wv-controls" disabled={!ready || !hasSelection}>
              <label>
                <span>Panel size <output>{Math.round(scale * 100)}%</output></span>
                <input type="range" min={40} max={250} step={5} value={Math.round(scale * 100)} onChange={(event) => setScale(Number(event.target.value) / 100)} />
              </label>
              <label>
                <span>Wall angle (last area) <output>{angle > 0 ? "+" : ""}{angle}°</output></span>
                <input type="range" min={-60} max={60} step={1} value={angle} onChange={(event) => changeAngle(Number(event.target.value))} />
              </label>
              <div className="wv-checks">
                <label><input type="checkbox" checked={joints} onChange={(event) => setJoints(event.target.checked)} /> Panel joints</label>
                <label><input type="checkbox" checked={turned} onChange={(event) => setTurned(event.target.checked)} /> Lay sheets sideways</label>
              </div>
            </fieldset>
            <div className="wv-actions">
              <Link className="button" href={`/samples?product=${material.slug}`}>
                Request a sample <span aria-hidden="true">↗</span>
              </Link>
              <button type="button" className="text-link" onClick={download} disabled={!ready || !hasSelection || busyTap}>
                Download the picture <span aria-hidden="true">↓</span>
              </button>
            </div>
            <p className="wv-note">Sheets are drawn at 1220 × 2440 mm. The size is an estimate from one photo, so use “Panel size” to match your wall. Colours are indicative: request a physical sample before you decide.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
