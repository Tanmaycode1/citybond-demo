"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SiteContent } from "@/lib/cms/schema";
import { fastMaterials, type FastScene, type Quad } from "@/lib/visualizer/fast-types";
import { paintMask, prepareShade, rectangle, renderMaterial, validQuad, type PreparedPhoto, type Raster, type Surface } from "@/lib/visualizer/fast-renderer";

const SAMPLES = [{ src: "/stock/modern-residence.webp", label: "House front" }, { src: "/stock/hillside-residence.webp", label: "Hillside house" }];
const MAX_UPLOAD = 25 * 1024 * 1024;
function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    const timeout = setTimeout(() => reject(new Error("The image took too long to load. Please try again.")), 15_000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); reject(new Error("The image could not be loaded. Please choose another photo or material.")); };
    img.src = url;
  });
}
function raster(img: CanvasImageSource, width: number, height: number): Raster {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}
function drawRaster(canvas: HTMLCanvasElement, pixels: Raster) {
  if (canvas.width !== pixels.width || canvas.height !== pixels.height) { canvas.width = pixels.width; canvas.height = pixels.height; }
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
}

export function FastWallVisualizer({ content, heading = true }: { content: SiteContent; heading?: boolean }) {
  const materials = useMemo(() => fastMaterials(content.products), [content.products]);
  const [chosen, setChosen] = useState(() => materials.find(m => m.id.startsWith("wooden"))?.id || materials[0]?.id || "");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [scale, setScale] = useState(1); const [joints, setJoints] = useState(false); const [turned, setTurned] = useState(false);
  const [split, setSplit] = useState(0); const [mask, setMask] = useState(false);
  const [mode, setMode] = useState("view"); const [brush, setBrush] = useState(14); const [selected, setSelected] = useState(0);
  const [surfaces, setSurfaces] = useState<Surface[]>([]); const [revision, setRevision] = useState(0); const [undoCount, setUndoCount] = useState(0);
  const [timing, setTiming] = useState({ firstMs: 0, renderMs: 0, cached: false, sequence: 0 });
  const canvas = useRef<HTMLCanvasElement>(null); const file = useRef<HTMLInputElement>(null);
  const scene = useRef<PreparedPhoto | null>(null); const originalLabels = useRef<Uint8Array | null>(null);
  const originalSurfaces = useRef<Surface[]>([]); const history = useRef<{ labels: Uint8Array; surfaces: Surface[] }[]>([]);
  const textures = useRef(new Map<string, Promise<Raster>>()); const generation = useRef(0); const drawGeneration = useRef(0);
  const pending = useRef<AbortController | null>(null); const began = useRef(0); const meta = useRef({ first: true, cached: false });
  const drag = useRef<{ handle: number; painting: boolean } | null>(null);
  const material = materials.find(m => m.id === chosen) || materials[0];

  const textureFor = useCallback(async (url: string) => {
    if (!url) return null;
    let promise = textures.current.get(url);
    if (!promise) {
      promise = image(url).then(img => raster(img, Math.min(512, img.naturalWidth), Math.min(1024, img.naturalHeight)));
      textures.current.set(url, promise);
      promise.catch(() => textures.current.delete(url));
    }
    return promise;
  }, []);

  useEffect(() => {
    const photoGeneration = generation, renderGeneration = drawGeneration;
    for (const m of materials) if (m.texture) void textureFor(m.texture).catch(() => {});
    return () => { pending.current?.abort(); photoGeneration.current++; renderGeneration.current++; };
  }, [materials, textureFor]);

  useEffect(() => {
    if (!scene.current || !material) return;
    const id = ++drawGeneration.current;
    const start = performance.now();
    const handle = requestAnimationFrame(() => {
      void textureFor(material.texture).then(texture => {
        if (id !== drawGeneration.current || !scene.current || !canvas.current) return;
        const pixels = renderMaterial(scene.current, material, texture, { scale, joints, turned, split, mask });
        drawRaster(canvas.current, pixels);
        if (mode === "perspective") {
          const q = scene.current.surfaces[selected]?.quad;
          if (q) {
            const ctx = canvas.current.getContext("2d")!; ctx.strokeStyle = "#ffe7a3"; ctx.lineWidth = 3;
            ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
            q.forEach((p, i) => { ctx.fillStyle = "#143d37"; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "white"; ctx.font = "14px sans-serif"; ctx.fillText(String(i + 1), p.x - 4, p.y + 5); });
          }
        }
        requestAnimationFrame(() => {
          if (id !== drawGeneration.current) return;
          const now = performance.now();
          const firstMs = meta.current.first ? now - began.current : null, cached = meta.current.cached;
          setTiming(t => ({ firstMs: firstMs ?? t.firstMs, cached, renderMs: now - start, sequence: t.sequence + 1 }));
          meta.current.first = false; setStatus("ready");
        });
      }).catch(() => {
        if (id !== drawGeneration.current) return;
        // Never silently present a plain colour as an unavailable product texture.
        if (canvas.current && scene.current) drawRaster(canvas.current, scene.current.original);
        setStatus("error"); setError("This material swatch could not be loaded. Choose another finish or check its image in the content portal.");
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [material, scale, joints, turned, split, mask, mode, selected, revision, textureFor]);

  const load = async (source: Blob | string) => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    const id = ++generation.current; drawGeneration.current++;
    setStatus("loading"); setError(""); setNotice(""); setMode("view"); setMask(false); setSplit(0); setUndoCount(0); setSurfaces([]);
    scene.current = null; history.current = []; began.current = performance.now();
    let objectUrl = "";
    try {
      if (source instanceof Blob && (!/^image\/(jpeg|png|webp)$/.test(source.type) || source.size > MAX_UPLOAD))
        throw new Error("Choose a JPG, PNG or WebP photo smaller than 25 MB.");
      const url = typeof source === "string" ? source : (objectUrl = URL.createObjectURL(source));
      const img = await image(url);
      if (img.naturalWidth < 200 || img.naturalHeight < 200 || img.naturalWidth * img.naturalHeight > 24_000_000) throw new Error("Choose a photo between 200 × 200 pixels and 24 megapixels.");
      if (id !== generation.current) return;
      const ratio = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.round(img.naturalWidth * ratio), height = Math.round(img.naturalHeight * ratio);
      const original = raster(img, width, height);
      const inputCanvas = document.createElement("canvas"); drawRaster(inputCanvas, original);
      if (canvas.current) drawRaster(canvas.current, original);
      const blob = await new Promise<Blob>((resolve, reject) => inputCanvas.toBlob(b => b ? resolve(b) : reject(new Error("Photo could not be prepared.")), "image/png"));
      const response = await fetch("/api/visualizer/segment", { method: "POST", headers: { "Content-Type": blob.type }, body: blob, signal: controller.signal });
      const result = await response.json() as FastScene & { error?: string };
      if (!response.ok) throw new Error(result.error || "Wall detection is unavailable. Please try again.");
      if (id !== generation.current) return;
      const labels = new Uint8Array(width * height);
      const buildingImage = await image(result.building); const b = raster(buildingImage, width, height);
      const building = Uint8Array.from({ length: labels.length }, (_, i) => b.data[i * 4]);
      const nextSurfaces: Surface[] = [];
      for (let i = 0; i < result.regions.length; i++) {
        const r = result.regions[i], maskImage = await image(r.png); const pixels = raster(maskImage, r.width, r.height);
        for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (pixels.data[(y * r.width + x) * 4] >= 128) labels[(y + r.top) * width + r.left + x] = i + 1;
        nextSurfaces.push({ id: r.id, quad: rectangle(r.left, r.top, r.width, r.height), enabled: true });
      }
      if (id !== generation.current) return;
      scene.current = { original, labels, building, surfaces: nextSurfaces, shade: prepareShade(original, labels) };
      originalLabels.current = labels.slice(); originalSurfaces.current = structuredClone(nextSurfaces);
      setSurfaces([...nextSurfaces]); setSelected(0); meta.current = { first: true, cached: result.cached };
      setRevision(r => r + 1);
    } catch (e) {
      if (id === generation.current && !controller.signal.aborted) { setStatus("error"); setError(e instanceof Error ? e.message : "Please try another photo."); }
    } finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
  };

  const remember = () => {
    if (!scene.current) return;
    history.current.push({ labels: scene.current.labels.slice(), surfaces: structuredClone(scene.current.surfaces) });
    if (history.current.length > 8) history.current.shift(); setUndoCount(history.current.length);
  };
  const refresh = () => { if (scene.current) setSurfaces([...scene.current.surfaces]); setRevision(r => r + 1); };
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * event.currentTarget.width, y: (event.clientY - rect.top) / rect.height * event.currentTarget.height };
  };
  const applyPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!scene.current || !drag.current) return;
    const p = point(event);
    if (drag.current.painting) paintMask(scene.current.labels, scene.current.building, scene.current.original.width, scene.current.original.height, p, brush, selected + 1, mode === "erase");
    else {
      const surface = scene.current.surfaces[selected];
      const q = surface.quad.map((corner, i) => i === drag.current!.handle ? { x: Math.max(0, Math.min(canvas.current!.width, p.x)), y: Math.max(0, Math.min(canvas.current!.height, p.y)) } : corner) as Quad;
      if (validQuad(q)) surface.quad = q;
    }
    refresh();
  };
  const download = async () => {
    if (!scene.current || !material || status !== "ready") return;
    const texture = await textureFor(material.texture);
    const output = document.createElement("canvas");
    drawRaster(output, renderMaterial(scene.current, material, texture, { scale, joints, turned, split: 0, mask: false }));
    output.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "citybond-exterior-preview.png"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, "image/png");
  };
  return <section className="fv" aria-label="Fast exterior wall visualizer" data-status={status} data-render-sequence={timing.sequence} data-render-ms={timing.renderMs.toFixed(1)}>
    {heading && <header className="fv-heading"><span className="fv-eyebrow">CITYBOND / EXTERIOR PREVIEW</span><h2>Your exterior.<br/><em>A different finish.</em></h2><p>Upload once. Explore finishes instantly. Your building, windows and surroundings stay in place.</p></header>}
    <div className="fv-workspace">
      <div className="fv-main">
        <div className="fv-topbar"><span>{status === "loading" ? "Finding exterior walls…" : status === "ready" ? "Your preview is ready" : "Start with an exterior photo"}</span><button type="button" onClick={() => file.current?.click()} disabled={status === "loading"}>Upload photo</button></div>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Upload exterior photo" onChange={e => { const chosenFile = e.target.files?.[0]; if (chosenFile) void load(chosenFile); e.target.value = ""; }}/>
        <div className={`fv-stage ${mode !== "view" ? "fv-editing" : ""}`}>
          <canvas ref={canvas} aria-label="Exterior material preview" hidden={status === "idle"} onPointerDown={event => {
            if (!scene.current || mode === "view" || status !== "ready") return;
            const p = point(event); const handle = scene.current.surfaces[selected].quad.findIndex(c => Math.hypot(c.x - p.x, c.y - p.y) < 28);
            if (mode === "perspective" && handle < 0) return;
            remember(); drag.current = { handle, painting: mode !== "perspective" }; event.currentTarget.setPointerCapture(event.pointerId); applyPointer(event);
          }} onPointerMove={applyPointer} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}/>
          {status === "idle" && <div className="fv-empty"><img src="/stock/modern-residence.webp" alt="White exterior house ready for a material preview"/><div><h3>See the possibilities.</h3><p>A clear, front-facing photo works best.</p><button type="button" onClick={() => file.current?.click()}>Choose your photo</button></div></div>}
          {status === "loading" && <div className="fv-loading" role="status"><span className="fv-spinner"/><strong>Preparing your exterior</strong><p>Finding walls and keeping the surroundings protected.</p></div>}
        </div>
        {error && <p className="fv-error" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="fv-samples"><span>Try a sample</span>{SAMPLES.map(s => <button type="button" key={s.src} disabled={status === "loading"} onClick={() => void load(s.src)}><img src={s.src} alt=""/>{s.label}</button>)}</div>
        {status === "ready" && <div className="fv-compare"><label htmlFor="fv-compare">Compare original / preview</label><input id="fv-compare" type="range" min="0" max="100" value={split * 100} aria-label="Compare before and after" onChange={e => setSplit(Number(e.target.value) / 100)}/><div><span>Preview ready in {(timing.firstMs / 1000).toFixed(1)}s{timing.cached ? " · cached photo" : ""}</span><span>Last update {Math.round(timing.renderMs)}ms</span></div></div>}
        <p className="fv-note">Exterior buildings only. JPG, PNG or WebP, up to 25 MB / 24 megapixels. Photos are processed by Meta to identify walls. Colours and scale are indicative; confirm with physical samples.</p>
      </div>
      <aside className="fv-controls" aria-label="Preview controls">
        <div className="fv-material-heading"><span className="fv-eyebrow">CHOOSE A FINISH</span><h3>{material?.finish || "Materials"}</h3><p>{material?.name}</p></div>
        <div className="fv-swatches" role="group" aria-label="Material finishes">{materials.map(m => <button type="button" key={m.id} aria-label={`${m.name} · ${m.finish}`} aria-pressed={chosen === m.id} onClick={() => { setChosen(m.id); setError(""); }}><span style={{ backgroundColor: m.hex, ...(m.texture ? { backgroundImage: `url(${m.texture})` } : {}) }}/><small>{m.name}</small></button>)}</div>
        <label className="fv-range">Sheet scale <span>{scale.toFixed(1)}×</span><input type="range" aria-label="Sheet scale" min="0.4" max="2.5" step="0.1" value={scale} onChange={e => setScale(Number(e.target.value))}/></label>
        <div className="fv-toggles"><label><input type="checkbox" checked={joints} onChange={e => setJoints(e.target.checked)}/> Subtle panel joints</label><label><input type="checkbox" checked={turned} onChange={e => setTurned(e.target.checked)}/> Rotate grain</label></div>
        {scene.current && <details className="fv-adjust"><summary>Adjust wall selection &amp; perspective</summary><p>Check the green coverage. Restore missing wall areas or erase spills. Perspective anchors control texture alignment, not the wall outline.</p>
          <label className="fv-select">Selected wall<select aria-label="Selected wall" value={selected} onChange={e => setSelected(Number(e.target.value))}>{surfaces.map((s, i) => <option key={s.id} value={i}>Wall {i + 1}</option>)}</select></label>
          <label><input type="checkbox" checked={surfaces[selected]?.enabled ?? true} onChange={e => { remember(); scene.current!.surfaces[selected].enabled = e.target.checked; refresh(); }}/> Include this wall</label>
          <label><input type="checkbox" checked={mask} onChange={e => setMask(e.target.checked)}/> Show wall coverage</label>
          <div className="fv-modes">{["view", "erase", "restore", "perspective"].map(m => <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "view" ? "View" : m === "erase" ? "Erase" : m === "restore" ? "Restore wall" : "Perspective"}</button>)}</div>
          {(mode === "erase" || mode === "restore") && <label className="fv-range">Brush size<input aria-label="Brush size" type="range" min="3" max="50" value={brush} onChange={e => setBrush(Number(e.target.value))}/></label>}
          {mode === "perspective" && <p>Drag the four numbered corners to match this wall plane. Use a front-facing photo for the most reliable automatic result.</p>}
          <div className="fv-modes"><button type="button" disabled={!undoCount} onClick={() => { const past = history.current.pop(); if (past && scene.current) { scene.current.labels = past.labels; scene.current.surfaces = past.surfaces; setUndoCount(history.current.length); refresh(); } }}>Undo adjustment</button><button type="button" onClick={() => { if (!scene.current || !originalLabels.current) return; remember(); scene.current.labels = originalLabels.current.slice(); scene.current.surfaces = structuredClone(originalSurfaces.current); refresh(); }}>Reset walls</button></div>
        </details>}
        <button type="button" className="fv-download" disabled={status !== "ready"} onClick={() => void download().catch(() => setNotice("The export could not be created. Please try again."))}>Download preview</button>
        <p className="fv-note">Material images and colours come from the content portal. This preview shows surface appearance; mirror reflections and 3D relief are not simulated.</p>
      </aside>
    </div>
  </section>;
}
