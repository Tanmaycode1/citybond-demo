"use client";
import { useEffect, useRef, useState } from "react";
export function RichEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const selectedImage = useRef<HTMLImageElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);
  function format(command: string, argument?: string) {
    ref.current?.focus();
    document.execCommand(command, false, argument);
    if (ref.current) onChange(ref.current.innerHTML);
  }
  function applyImage(url = imageUrl) {
    if (!ref.current || !/^(https:\/\/|\/(?!\/))/.test(url)) { setError("Use an uploaded image or an https:// image address."); return; }
    const selected = selectedImage.current;
    const img = selected && ref.current.contains(selected) ? selected : document.createElement("img");
    img.setAttribute("src", url); img.setAttribute("alt", imageAlt);
    // Responsive replacements must not retain the original source's srcset.
    img.removeAttribute("srcset"); img.removeAttribute("sizes");
    if (!ref.current.contains(img)) { const p = document.createElement("p"); p.append(img); ref.current.append(p); }
    onChange(ref.current.innerHTML); setImageOpen(false); setError(""); selectedImage.current = null;
  }
  async function upload(file: File) {
    setUploading(true); setError("");
    try { const body = new FormData(); body.set("file", file); const response = await fetch("/api/studio/upload", {method:"POST",body}); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Image upload failed."); applyImage(data.url); }
    catch(e) { setError(e instanceof Error ? e.message : "Image upload failed."); }
    finally { setUploading(false); if(fileInput.current) fileInput.current.value = ""; }
  }
  return <div className="rich-editor">
    <div className="rich-toolbar" role="toolbar" aria-label="Article formatting">
      {[['Bold','bold'],['Italic','italic'],['Bullets','insertUnorderedList'],['Numbered list','insertOrderedList']].map(([name,command]) => <button type="button" key={command} onMouseDown={e => e.preventDefault()} onClick={() => format(command)}>{name}</button>)}
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => format('formatBlock','h2')}>Heading</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => format('formatBlock','p')}>Paragraph</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { const href = prompt('Link address (https:// or /page)'); if (href && /^(https:\/\/|\/(?!\/))/.test(href)) format('createLink', href); }}>Link</button>
      <button type="button" onClick={() => { selectedImage.current=null; setImageUrl(""); setImageAlt(""); setError(""); setImageOpen(true); }}>Image</button>
    </div>
    {imageOpen && <div className="rich-image-controls">
      <label>Image address<input aria-label="Inline image address" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} /></label>
      <label>Alternative text<input aria-label="Inline image alternative text" value={imageAlt} onChange={e=>setImageAlt(e.target.value)} /></label>
      <div><button type="button" disabled={uploading || !imageUrl} onClick={()=>applyImage()}>Apply image</button><button type="button" disabled={uploading} onClick={()=>fileInput.current?.click()}>{uploading ? "Uploading…" : "Upload image"}</button><button type="button" disabled={uploading} onClick={()=>setImageOpen(false)}>Cancel</button></div>
      <input ref={fileInput} className="portal-file" type="file" aria-label="Upload inline image" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}} />
      {error && <small role="alert">{error}</small>}
    </div>}
    <div ref={ref} className="rich-editable" role="textbox" aria-label="Article content" aria-multiline="true" contentEditable suppressContentEditableWarning onClick={e=>{if(e.target instanceof HTMLImageElement){selectedImage.current=e.target;setImageUrl(e.target.getAttribute("src")||"");setImageAlt(e.target.alt);setError("");setImageOpen(true);}}} onBlur={e => onChange(e.currentTarget.innerHTML)} />
    <small>Format text or select an image to replace it. Changes are saved with your draft.</small>
  </div>;
}
