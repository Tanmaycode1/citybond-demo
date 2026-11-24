"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteContent } from "@/lib/cms/schema";
import { fastMaterials } from "@/lib/visualizer/fast-types";
import { FastWallVisualizer } from "./FastWallVisualizer";

type Result = { image: string; width: number; height: number; renderMs: number; cached: boolean };
export function QualityWallVisualizer({ content, heading = true }: { content: SiteContent; heading?: boolean }) {
  const materials = useMemo(() => fastMaterials(content.products), [content.products]);
  const [chosen, setChosen] = useState(() => materials.find(m => m.id.startsWith("wooden"))?.id || materials[0]?.id || "");
  const [view, setView] = useState("quality");
  const [photo, setPhoto] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [split, setSplit] = useState(0), [elapsed, setElapsed] = useState(0);
  const input = useRef<HTMLInputElement>(null), pending = useRef<AbortController | null>(null);
  const generation = useRef(0), prepared = useRef("");
  const results = useRef(new Map<string, Result>());
  const material = materials.find(m => m.id === chosen) || materials[0];
  useEffect(() => { const id = generation; return () => { id.current++; pending.current?.abort(); }; }, []);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const render = async (source = prepared.current, id = chosen) => {
    if (!source || !id) return;
    const cached = results.current.get(id);
    if (cached) { setResult(cached); setSplit(0); return; }
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    const requestId = ++generation.current;
    setBusy(true); setElapsed(0); setError(""); setResult(null); setSplit(0);
    try {
      const response = await fetch("/api/visualizer/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo: source, materialId: id }), signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The render could not be completed.");
      if (requestId !== generation.current) return;
      if (results.current.size >= 5) results.current.delete(results.current.keys().next().value!);
      results.current.set(id, body); setResult(body);
    } catch (e) {
      if (requestId === generation.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : "Please try again.");
    } finally { if (requestId === generation.current) setBusy(false); }
  };
  const load = async (source: File | string) => {
    pending.current?.abort(); const id = ++generation.current;
    setError(""); setResult(null); setBusy(true); setElapsed(0); setPhoto(""); prepared.current = ""; results.current.clear();
    let url = "";
    try {
      if (source instanceof File && (!/^image\/(jpeg|png|webp)$/.test(source.type) || source.size > 25 * 1024 * 1024)) throw new Error("Choose a JPG, PNG or WebP photo under 25 MB.");
      url = typeof source === "string" ? source : URL.createObjectURL(source);
      const img = new Image(); img.src = url; await img.decode();
      if (id !== generation.current) return;
      if (img.naturalWidth < 200 || img.naturalHeight < 200 || img.naturalWidth * img.naturalHeight > 24_000_000) throw new Error("Choose a photo between 200 × 200 pixels and 24 megapixels.");
      const ratio = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(img.naturalWidth * ratio); canvas.height = Math.round(img.naturalHeight * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", .96); prepared.current = data; setPhoto(data);
      await render(data);
    } catch (e) { if (id === generation.current) { setError(e instanceof Error ? e.message : "The photo could not be opened."); setBusy(false); } }
    finally { if (source instanceof File && url) URL.revokeObjectURL(url); }
  };
  const choose = (id: string) => { setChosen(id); setResult(results.current.get(id) || null); setSplit(0); setError(""); };
  const download = async () => {
    if (!result) return;
    const blob = await (await fetch(result.image)).blob(), url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `citybond-${chosen.split(":")[0]}-render.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="fv qv" aria-label="Exterior wall visualizer" data-status={busy ? "loading" : result ? "ready" : error ? "error" : "idle"}>
    {heading && <header className="fv-heading"><span className="fv-eyebrow">CITYBOND / THIRD EYE VIEW</span><h2>Your exterior.<br/><em>Beautifully reimagined.</em></h2><p>Choose a finish and upload your exterior. See it rendered with natural light, wall perspective and subtle panel detailing.</p></header>}
    <div className="qv-tabs" role="group" aria-label="Preview method"><button disabled={busy} type="button" aria-pressed={view === "quality"} onClick={() => setView("quality")}>Realistic render</button><button disabled={busy} type="button" aria-pressed={view === "quick"} onClick={() => setView("quick")}>Quick material study</button></div>
    {view === "quick" ? <><p className="qv-study-note">A quick texture study for comparing finishes. For a more natural result, use Realistic render.</p><FastWallVisualizer content={content} heading={false}/></> : <div className="fv-workspace">
      <div className="fv-main">
        <div className="fv-topbar"><span>{busy ? "Creating your realistic render…" : result ? `${material?.finish} · Realistic render` : photo ? "Original photo · choose a finish to render" : "Start with an exterior photo"}</span><button type="button" disabled={busy} onClick={() => input.current?.click()}>Upload photo</button></div>
        <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label="Upload exterior photo" onChange={e => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ""; }}/>
        <div className="fv-stage qv-stage">
          {photo ? <div className="qv-image"><img src={photo} alt="Original exterior photograph"/>{result && <img className="qv-result" src={result.image} alt={`${material?.finish} realistic exterior render`} style={{ clipPath: `inset(0 0 0 ${split}%)` }}/>}</div> : <div className="fv-empty"><img src="/stock/modern-residence.webp" alt="House exterior ready for cladding"/><div><h3>Make it your own.</h3><p>Pick a finish, then choose your exterior photo.</p><button type="button" disabled={busy} onClick={() => input.current?.click()}>Choose your photo</button></div></div>}
          {busy && <div className="fv-loading" role="status"><span className="fv-spinner"/><strong>{elapsed < 8 ? "Checking your exterior" : "Rendering materials, light and perspective"}</strong><p>A considered finish takes a little longer. Your original photo stays safe.</p><small>{elapsed}s elapsed</small></div>}
        </div>
        {error && <p className="fv-error" role="alert">{error}</p>}
        <div className="fv-samples"><span>Try a sample</span>{[{ src: "/stock/modern-residence.webp", label: "House front" }, { src: "/stock/hillside-residence.webp", label: "Hillside house" }].map(s => <button type="button" key={s.src} disabled={busy} onClick={() => void load(s.src)}><img src={s.src} alt=""/>{s.label}</button>)}</div>
        {result && <div className="fv-compare"><label htmlFor="qv-compare">Compare original / render</label><input id="qv-compare" type="range" min="0" max="100" value={split} aria-label="Compare original and render" onChange={e => setSplit(Number(e.target.value))}/><div><span>{result.width} × {result.height} · PNG</span><span>{result.cached ? "Saved render" : `Rendered in ${(result.renderMs / 1000).toFixed(1)}s`}</span></div></div>}
        <p className="fv-note">Exterior photos only. AI visualisation: small architectural details may vary. Colours and panel scale are indicative; confirm against physical samples. Your photo is sent to Meta for processing.</p>
      </div>
      <aside className="fv-controls" aria-label="Render controls">
        <div className="fv-material-heading"><span className="fv-eyebrow">01 / CHOOSE YOUR FINISH</span><h3>{material?.finish || "Materials"}</h3><p>{material?.name}</p></div>
        <div className="fv-swatches" role="group" aria-label="Material finishes">{materials.map(m => <button type="button" key={m.id} disabled={busy} aria-label={`${m.name} · ${m.finish}`} aria-pressed={chosen === m.id} onClick={() => choose(m.id)}><span style={{ backgroundColor: m.hex, ...(m.texture ? { backgroundImage: `url(${m.texture})` } : {}) }}/><small>{m.name}</small></button>)}</div>
        <div className="qv-process"><span className="fv-eyebrow">02 / YOUR EXTERIOR</span><p>Use a clear photo of the whole facade. We render the selected finish when you upload.</p><span className="fv-eyebrow">03 / SEE THE FINISH</span><p>Choose another material and render it when you’re ready. Previously rendered finishes reopen instantly.</p></div>
        <button type="button" className="fv-download qv-render" disabled={busy || !photo || !!result} onClick={() => void render()}>{busy ? "Rendering…" : result ? "Render ready" : "Render this finish"}</button>
        <button type="button" className="fv-download qv-download" disabled={busy || !result} onClick={() => void download().catch(() => setError("The download failed. Please try again."))}>Download render</button>
        <p className="fv-note">Actual finish swatches come from the content portal. The realistic render accounts for wall angles and lighting; it is a visual concept, not a measured installation drawing.</p>
      </aside>
    </div>}
  </section>;
}
