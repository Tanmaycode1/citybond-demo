"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SiteContent } from "@/lib/cms/schema";
import seed from "@/data/site.json";
import Link from "next/link";
import { routes, canonicalPath } from "@/lib/routes";
import "./portal.css";
type Value =
  string | number | boolean | null | Value[] | { [key: string]: Value };
type State = {
  content: SiteContent;
  draftEtag: string | null;
  publishedEtag: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  storageReady: boolean;
};
type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  role: string;
  type: string;
  product: string;
  message: string;
  createdAt: string;
  attachment: string;
};
const label = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
async function api(action: string, body?: unknown) {
  const res = await fetch(
    `/api/studio/${action}`,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      data.issues
        ? data.issues
            .map(
              (i: { path: (string | number)[]; message: string }) =>
                `${i.path.join(" → ")}: ${i.message}`,
            )
            .join("\n")
        : data.error || "Request failed",
    );
  return data;
}
function emptyTemplate(path: string, value: Value): Value {
  const key = path.split(".").pop()!;
  if (path.startsWith("originalPages.") && key === "rows") return [""];
  if (path.startsWith("originalPages.") && key === "blocks")
    return {
      id: "block-" + Date.now().toString(36),
      type: "paragraph",
      level: 2,
      text: "",
      ordered: false,
      items: [],
      rows: [],
      headerRows: 0,
      href: "",
    };
  const templates: Record<string, Value> = {
    blogs: {
      slug: "new-article-" + Date.now().toString(36),
      title: "Untitled article",
      description: "",
      image: "",
      imageAlt: "",
      author: "CityBond Editorial",
      authorSlug: "citybond-editorial",
      category: "Design notes",
      categorySlug: "design-notes",
      publishedAt: new Date().toISOString().slice(0, 10),
      status: "draft",
      example: false,
      body: [{ title: "Introduction", text: "", image: "", imageAlt: "" }],
    },
    testimonials: {
      quote: "",
      name: "",
      company: "",
      image: "",
      imageAlt: "",
      source: "",
    },
    brands: { name: "", image: "", imageAlt: "" },
    finishes: { name: "New finish", image: "", hex: "#b3aa91" },
    blocks: { title: "New section", text: "", image: "", imageAlt: "" },
    specs: { label: "Specification", value: "" },
    nav: { label: "New link", href: "/", children: [] },
    children: { label: "New page", href: "/", group: "" },
    footerLinks: { label: "New link", href: "/" },
    social: { label: "New link", href: "https://" },
    stats: { value: "", label: "" },
  };
  if (templates[key]) return templates[key];
  if (Array.isArray(value) && value.length) {
    const first = structuredClone(value[0]);
    if (typeof first === "string") return "";
    if (first && typeof first === "object" && !Array.isArray(first)) {
      if ("slug" in first) first.slug = "new-" + Date.now().toString(36);
      if ("id" in first) first.id = "new-" + Date.now().toString(36);
      if ("name" in first) first.name = "New item";
      if ("title" in first) first.title = "New item";
      return first;
    }
    return first;
  }
  return "";
}
function Field({
  value,
  onChange,
  path,
}: {
  value: Value;
  onChange: (v: Value) => void;
  path: string;
}) {
  const key = path.split(".").pop() || path;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/studio/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  if (Array.isArray(value))
    return (
      <section className="editor-array">
        <div className="array-heading">
          <h3>
            {label(key)} <span>{value.length}</span>
          </h3>
          <button
            type="button"
            onClick={() => onChange([...value, emptyTemplate(path, value)])}
          >
            + Add item
          </button>
        </div>
        {value.map((item, i) =>
          typeof item === "object" && item !== null ? (
            <details className="editor-item" key={`${path}-${i}`}>
              <summary>
                <span>
                  {String(
                    (item as Record<string, Value>).name ||
                      (item as Record<string, Value>).title ||
                      (item as Record<string, Value>).label ||
                      (item as Record<string, Value>).city ||
                      (item as Record<string, Value>).slug ||
                      (path.startsWith("originalPages.") &&
                        String(
                          (item as Record<string, Value>).text || "",
                        ).slice(0, 90)) ||
                      `Item ${i + 1}`,
                  )}
                </span>
                <small>#{i + 1}</small>
              </summary>
              <div className="item-controls">
                <button
                  disabled={i === 0}
                  onClick={() => {
                    const a = [...value];
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    onChange(a);
                  }}
                >
                  Move up
                </button>
                <button
                  disabled={i === value.length - 1}
                  onClick={() => {
                    const a = [...value];
                    [a[i + 1], a[i]] = [a[i], a[i + 1]];
                    onChange(a);
                  }}
                >
                  Move down
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Remove this item from the draft? You can reload to discard unsaved edits.",
                      )
                    )
                      onChange(value.filter((_, n) => n !== i));
                  }}
                >
                  Remove
                </button>
              </div>
              <Field
                value={item}
                path={`${path}.${i}`}
                onChange={(v) =>
                  onChange(value.map((old, n) => (n === i ? v : old)))
                }
              />
            </details>
          ) : (
            <div className="simple-array" key={`${path}-${i}`}>
              <Field
                value={item}
                path={`${path}.${i}`}
                onChange={(v) =>
                  onChange(value.map((old, n) => (n === i ? v : old)))
                }
              />
              <button
                aria-label={`Remove ${label(key)} item ${i + 1}`}
                onClick={() => onChange(value.filter((_, n) => n !== i))}
              >
                ×
              </button>
            </div>
          ),
        )}
      </section>
    );
  if (value && typeof value === "object")
    return (
      <div className="editor-fields">
        {Object.entries(value)
          .filter(([k]) => {
            if (!/^originalPages\.\d+\.blocks\.\d+$/.test(path)) return true;
            const fields: Record<string, string[]> = {
              heading: ["type", "level", "text"],
              paragraph: ["type", "text"],
              list: ["type", "ordered", "items"],
              table: ["type", "text", "rows", "headerRows"],
              link: ["type", "text", "href"],
            };
            return fields[
              String((value as Record<string, Value>).type)
            ]?.includes(k);
          })
          .map(([k, v]) => (
            <Field
              key={k}
              value={v}
              path={`${path}.${k}`}
              onChange={(next) => onChange({ ...value, [k]: next })}
            />
          ))}
      </div>
    );
  if (typeof value === "number")
    return (
      <label className="editor-field">
        {label(key)}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    );
  if (typeof value === "boolean")
    return (
      <label className="editor-field">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label(key)}
      </label>
    );
  const image = /image$|logo$/i.test(key) && !/alt$/i.test(key);
  const multiline =
    /description|body|text|quote|footer|message|address/i.test(key) ||
    String(value).length > 160 ||
    String(value).includes("\n");
  const options =
    key === "type" && path.startsWith("originalPages.")
      ? ["heading", "paragraph", "list", "table", "link"]
      : key === "status" && path.startsWith("blogs.")
        ? ["draft", "published"]
        : key === "type"
          ? ["catalogue", "magazine", "article", "report", "podcast"]
          : path.includes(".segments.")
            ? ["residential", "commercial"]
            : path.includes(".sections.")
              ? [
                  "network",
                  "projects",
                  "products",
                  "visualiser",
                  "resources",
                  "about",
                  "contact",
                ]
              : null;
  return (
    <label className={`editor-field ${image ? "image-field" : ""}`}>
      <span>{/^\d+$/.test(key) ? `Item ${Number(key) + 1}` : label(key)}</span>
      {options ? (
        <select
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : multiline ? (
        <textarea
          rows={3}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          value={String(value ?? "")}
          readOnly={
            path.startsWith("originalPages.") &&
            ["route", "sourceUrl", "importedAt"].includes(key)
          }
          onChange={(e) => onChange(e.target.value)}
        />
      )}{" "}
      {image && (
        <>
          <div className="image-tools">
            {value && <img src={String(value)} alt="Content image preview" />}
            <button
              type="button"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload image"}
            </button>
            <small>JPG, PNG, WebP or AVIF · up to 3.5 MB</small>
          </div>
          <input
            ref={input}
            className="portal-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </>
      )}
      {key === "href" && (
        <div className="image-tools">
          <button
            type="button"
            disabled={uploading}
            onClick={() => input.current?.click()}
          >
            Upload PDF
          </button>
          <input
            ref={input}
            className="portal-file"
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </div>
      )}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
export function Portal({ authenticated }: { authenticated: boolean }) {
  const [signedIn, setSignedIn] = useState(authenticated);
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState("originalPages");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewRoute, setPreviewRoute] = useState("");
  const [originalIndex, setOriginalIndex] = useState(0);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [history, setHistory] = useState<{ key: string; date: string }[]>([]);
  const [filter, setFilter] = useState("all");
  async function load() {
    const data = await api("content");
    setState(data);
    setDirty(false);
  }
  useEffect(() => {
    if (signedIn)
      api("content")
        .then(setState)
        .catch((e) => setNotice(e.message));
  }, [signedIn]);
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    addEventListener("beforeunload", before);
    return () => removeEventListener("beforeunload", before);
  }, [dirty]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await task();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    await run(async () => {
      await api("login", { password });
      setSignedIn(true);
    });
  }
  async function save() {
    if (!state) return;
    const result = await api("save", {
      content: state.content,
      draftEtag: state.draftEtag,
    });
    setState((s) => (s ? { ...s, ...result } : s));
    setDirty(false);
    setNotice("Draft saved. The live website has not changed.");
    return { ...state, ...result } as State;
  }
  async function publish() {
    const s = dirty ? await save() : state;
    if (!s?.draftEtag) {
      setNotice("Save a draft before publishing.");
      return;
    }
    const result = await api("publish", {
      draftEtag: s.draftEtag,
      publishedEtag: s.publishedEtag,
    });
    setState((old) => (old ? { ...old, ...result } : old));
    setNotice("Published. Your content is now live across the website.");
  }
  async function chooseTab(next: string) {
    setTab(next);
    if (next === "inbox")
      await run(async () => setEnquiries((await api("enquiries")).enquiries));
    if (next === "history")
      await run(async () => setHistory((await api("revisions")).revisions));
  }
  if (!signedIn)
    return (
      <main className="portal-login">
        <Link href="/" className="portal-brand">
          <img src={seed.site.logo} alt="CityBond" />
          <span> / Studio</span>
        </Link>
        <form onSubmit={login}>
          <p className="eyebrow">CONTENT PORTAL</p>
          <h1>
            A space to
            <br />
            <em>make it yours.</em>
          </h1>
          <p>
            Sign in to edit your website, publish updates and review enquiries.
          </p>
          <label>
            Owner password
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              required
              maxLength={256}
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Signing in…" : "Enter the studio"} <span>↗</span>
          </button>
          {notice && (
            <p className="portal-notice" role="alert">
              {notice}
            </p>
          )}
        </form>
        <small>Private access · Secure session · CityBond</small>
      </main>
    );
  return (
    <div className="portal">
      <header className="portal-header">
        <Link href="/" className="portal-brand">
          <img
            src={state?.content.site.logo || seed.site.logo}
            alt="CityBond"
          />
          <span> / Studio</span>
        </Link>
        <div>
          <span className={dirty ? "unsaved" : ""}>
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button
            disabled={busy || !state}
            onClick={() =>
              run(async () => {
                await save();
              })
            }
          >
            Save draft
          </button>
          <button
            className="publish"
            disabled={busy || !state}
            onClick={() => run(publish)}
          >
            {busy ? "Working…" : "Publish changes ↗"}
          </button>
        </div>
      </header>
      <aside className="portal-sidebar">
        <p>YOUR WEBSITE</p>
        {Object.keys(seed)
          .filter((k) => !["schemaVersion", "routeRevision"].includes(k))
          .map((k) => (
            <button
              aria-current={tab === k ? "page" : undefined}
              key={k}
              onClick={() => chooseTab(k)}
            >
              {label(k)}
            </button>
          ))}
        <p>MANAGE</p>
        <button
          aria-current={tab === "inbox" ? "page" : undefined}
          onClick={() => chooseTab("inbox")}
        >
          Enquiry inbox
        </button>
        <button
          aria-current={tab === "history" ? "page" : undefined}
          onClick={() => chooseTab("history")}
        >
          Publish history
        </button>
        <button
          onClick={() => {
            if (!dirty || confirm("Discard unsaved changes and sign out?"))
              run(async () => {
                await api("logout", {});
                setSignedIn(false);
                setState(null);
                setDirty(false);
              });
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="portal-main">
        <div className="portal-title">
          <div>
            <p className="eyebrow">CONTENT STUDIO</p>
            <h1>
              {tab === "inbox"
                ? "Enquiry inbox"
                : tab === "history"
                  ? "Publish history"
                  : label(tab)}
            </h1>
          </div>
          <button
            disabled={busy}
            onClick={() => {
              if (
                !dirty ||
                confirm("Discard unsaved changes and reload the latest draft?")
              )
                run(load);
            }}
          >
            Reload latest
          </button>
        </div>
        {notice && (
          <div className="portal-notice" role="status">
            {notice}
          </div>
        )}
        {state && (
          <div className="preview-tools">
            <label>
              Preview page
              <select
                value={previewRoute}
                onChange={(e) => setPreviewRoute(e.target.value)}
              >
                {routes(state.content, { includeDrafts: true }).map((r) => (
                  <option key={r} value={r}>
                    /{r}
                  </option>
                ))}
              </select>
            </label>
            <a
              href={`/${previewRoute}?preview=1`}
              target="_blank"
              rel="noreferrer"
              aria-disabled={dirty}
              onClick={(e) => {
                if (dirty) {
                  e.preventDefault();
                  setNotice("Save your draft before opening the preview.");
                }
              }}
            >
              Open draft preview ↗
            </a>
            <small>
              {state.publishedAt
                ? `Last published ${new Date(state.publishedAt).toLocaleString()}`
                : "The original website content is live. Save and publish to update it."}
            </small>
          </div>
        )}
        {tab === "blogs" && (
          <p className="portal-help">
            Add an article, set its URL slug, and edit its image, author,
            category and sections. New articles start as drafts. Set Status to
            published, then save and publish the website to make the article
            available at /blog/your-slug/. Keep existing article slugs unchanged
            to preserve links. Example articles are labelled and excluded from
            search indexing.
          </p>
        )}
        {tab === "home" &&
          state?.content.originalPages.some((p) => p.route === "") && (
            <p className="portal-help">
              Edit the homepage headline, introduction and section text in
              Original Pages → /. This Home section controls images, the role
              selector, scroll story, statistics and contact section. Its other
              text fields supply the role pages and the fallback layout.
            </p>
          )}
        {tab === "originalPages" && state && (
          <div className="portal-help">
            <p>
              Original website text, organised by page. Edit titles,
              descriptions, SEO fields and the ordered content blocks here.
              Lists and tables are editable too. Images remain in their existing
              Home, Pages, Products and Resources sections. Original aliases
              share the same record.
            </p>
            <button
              disabled={busy || dirty}
              onClick={() => {
                if (
                  confirm(
                    "Replace the imported page text in this draft with the captured original website copy? Other content and images stay as they are. Publish when you have reviewed it.",
                  )
                )
                  void run(async () => {
                    const result = await api("import-original", {
                      draftEtag: state.draftEtag,
                    });
                    await load();
                    setNotice(
                      `Imported ${result.pages} pages into the draft. Review the copy, then publish changes.`,
                    );
                  });
              }}
            >
              Import original website text
            </button>
            {dirty && <small>Save your changes before importing.</small>}
          </div>
        )}
        {!state ? (
          <p>Loading your content…</p>
        ) : tab === "inbox" ? (
          <>
            <div className="inbox-filters">
              <label>
                Request type
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    "all",
                    "contact",
                    "dealer",
                    "sample",
                    "visualiser",
                    "career",
                    "quiz",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <span>{enquiries.length} recent enquiries</span>
            </div>
            {enquiries.length === 0 ? (
              <div className="portal-empty">
                <h2>A place for new conversations.</h2>
                <p>
                  Submitted website enquiries will appear here. Attachments are
                  available only to signed-in editors.
                </p>
              </div>
            ) : (
              enquiries
                .filter((e) => filter === "all" || e.type === filter)
                .map((e) => (
                  <details className="editor-item enquiry-item" key={e.id}>
                    <summary>
                      <span>
                        {e.name}{" "}
                        <small>
                          {e.type} · {e.city}
                        </small>
                      </span>
                      <small>{new Date(e.createdAt).toLocaleString()}</small>
                    </summary>
                    <dl>
                      {Object.entries(e)
                        .filter(([k]) => !["attachment", "website"].includes(k))
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt>{label(k)}</dt>
                            <dd>{String(v)}</dd>
                          </div>
                        ))}
                    </dl>
                    {e.attachment && (
                      <a
                        className="portal-download"
                        href={`/api/studio/attachment?key=${encodeURIComponent(e.attachment)}`}
                      >
                        Download private attachment ↓
                      </a>
                    )}
                  </details>
                ))
            )}
          </>
        ) : tab === "history" ? (
          <>
            <p className="portal-help">
              Restore a previous published version to the draft. Review it, then
              publish when ready.
            </p>
            {history.length === 0 && <p>No published revisions yet.</p>}
            {history.map((r) => (
              <div className="revision" key={r.key}>
                <span>
                  {r.key.split("/")[1].slice(0, 19).replace("T", " ")}
                </span>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Replace the current draft with this revision? The live website will stay unchanged.",
                      )
                    )
                      run(async () => {
                        await api("restore", {
                          key: r.key,
                          draftEtag: state.draftEtag,
                        });
                        await load();
                        setNotice(
                          "Revision restored to draft. Review and publish when ready.",
                        );
                      });
                  }}
                >
                  Restore to draft
                </button>
              </div>
            ))}
          </>
        ) : tab === "originalPages" ? (
          <>
            <label className="editor-field">
              <span>Choose a page to edit</span>
              <select
                value={originalIndex}
                onChange={(e) => {
                  const index = Number(e.target.value);
                  setOriginalIndex(index);
                  setPreviewRoute(
                    canonicalPath(
                      state.content.originalPages[index].route,
                    ).slice(1),
                  );
                }}
              >
                {state.content.originalPages.map((p, i) => (
                  <option value={i} key={p.route}>
                    {canonicalPath(p.route)} — {p.title}
                  </option>
                ))}
              </select>
            </label>
            {state.content.originalPages[originalIndex] ? (
              <Field
                key={originalIndex}
                value={
                  state.content.originalPages[originalIndex] as unknown as Value
                }
                path={`originalPages.${originalIndex}`}
                onChange={(value) => {
                  setState({
                    ...state,
                    content: {
                      ...state.content,
                      originalPages: state.content.originalPages.map((p, i) =>
                        i === originalIndex
                          ? (value as unknown as SiteContent["originalPages"][number])
                          : p,
                      ),
                    },
                  });
                  setDirty(true);
                }}
              />
            ) : (
              <p>Import the original website text to begin editing.</p>
            )}
          </>
        ) : (
          <>
            <p className="portal-help">
              Edit any field below. Save your draft to preview, then publish to
              make it live. Expand items to edit images, details and links.
            </p>
            <Field
              value={state.content[tab as keyof SiteContent] as Value}
              path={tab}
              onChange={(v) => {
                setState({ ...state, content: { ...state.content, [tab]: v } });
                setDirty(true);
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
