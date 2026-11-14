"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "./SiteLink";
import type { SiteContent } from "@/lib/cms/schema";
import { useJourneyRole } from "./JourneyContext";
export function EnquiryForm({
  c,
  type,
  product = "",
  message = "",
  onSuccess,
}: {
  c: SiteContent;
  type: "contact" | "sample" | "dealer" | "career" | "visualiser" | "quiz";
  product?: string;
  message?: string;
  onSuccess?: (reference: string) => void;
}) {
  const roleId = useJourneyRole();
  const selectedRole = c.roles.find(role => role.id === (roleId || (type === "dealer" ? "dealer" : "")))?.label || "";
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const previewRef = useRef("");
  function chooseFile(f: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = f?.type.startsWith("image/") ? URL.createObjectURL(f) : "";
    previewRef.current = url;
    setPreview(url);
    setFile(f);
  }
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setStatus("");
    try {
      const data = {
        name: values.get("name"),
        email: values.get("email"),
        phone: values.get("phone"),
        city: values.get("city"),
        role: values.get("role") || "",
        type,
        product: values.get("product") ?? product,
        message: values.get("message") || message,
        consent: values.get("consent") === "on",
        website: values.get("website") || "",
      };
      const body = new FormData();
      body.set("data", JSON.stringify(data));
      if (file) body.set("file", file);
      const res = await fetch("/api/enquiries", { method: "POST", body });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || c.ui.error);
      setStatus(`${c.ui.success} ${result.reference}`);
      form.reset();
      chooseFile(null);
      onSuccess?.(result.reference);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : c.ui.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="enquiry-form" onSubmit={submit}>
      <div className="form-grid">
        {(["name", "email", "phone", "city"] as const).map((name) => (
          <label key={name}>
            {c.ui[name]}
            <input
              name={name}
              autoComplete={
                name === "name"
                  ? "name"
                  : name === "city"
                    ? "address-level2"
                    : name === "phone"
                      ? "tel"
                      : "email"
              }
              type={
                name === "email" ? "email" : name === "phone" ? "tel" : "text"
              }
              required
              minLength={name === "name" || name === "city" ? 2 : undefined}
              maxLength={name === "phone" ? 25 : 200}
            />
          </label>
        ))}
      </div>
      <label>
        {c.ui.role}
        <select name="role" required defaultValue={selectedRole}>
          <option value="" disabled>
            {c.ui.select}
          </option>
          {c.roles.map((r) => (
            <option value={r.label} key={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      {type !== "career" && (
        <label>
          {c.ui.product}
          <select name="product" key={product} defaultValue={product}>
            <option value="">{c.ui.select}</option>
            {c.products.map((p) => (
              <option value={p.slug} key={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {c.ui.message}
        <textarea
          name="message"
          rows={4}
          maxLength={4000}
          defaultValue={message}
        />
      </label>
      {["visualiser", "career"].includes(type) && (
        <label className="file-field">
          {type === "career" ? c.ui.resume : c.ui.file}
          <input
            name="attachment"
            type="file"
            accept={
              type === "career"
                ? "application/pdf,image/jpeg,image/png,image/webp,image/avif"
                : "image/jpeg,image/png,image/webp,image/avif"
            }
            required={type === "visualiser"}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size > 3500000) {
                e.target.setCustomValidity(
                  "Please choose a file under 3.5 MB.",
                );
                e.target.reportValidity();
                chooseFile(null);
              } else {
                e.target.setCustomValidity("");
                chooseFile(f || null);
              }
            }}
          />
          <small>{type === "career" ? c.ui.resumeHint : c.ui.uploadHint}</small>
          {preview && <img src={preview} alt={c.ui.uploadPreview} />}
        </label>
      )}
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="consent">
        <input type="checkbox" name="consent" required />
        <span>
          {c.ui.consent}{" "}
          <Link href="/privacy">
            {c.site.footerLinks.find((l) => l.href === "/privacy")?.label}
          </Link>
        </span>
      </label>
      <button className="button" type="submit" disabled={busy}>
        {busy ? c.ui.sending : c.ui.submit}
        <span aria-hidden="true">↗</span>
      </button>
      {status && (
        <p className="form-status" role="status">
          {status}
        </p>
      )}
    </form>
  );
}
