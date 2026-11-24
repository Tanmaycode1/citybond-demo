"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SiteContent } from "@/lib/cms/schema";
import { RichEditor } from "./RichEditor";
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
const groups = [
  {name:"Pages",tabs:["originalPages","home","pages","roles","projects"]},
  {name:"Products",tabs:["products"]},
  {name:"Journal",tabs:["blogs","blog"]},
  {name:"Resources",tabs:["resources"]},
  {name:"Enquiries",tabs:["inbox"]},
  {name:"Settings",tabs:["site","seoPages","ui","team","offices","testimonials","brands","history"]},
];
const titles: Record<string,string> = {originalPages:"Page content",home:"Homepage design",pages:"Page images & layout",roles:"Customer journeys",blogs:"Articles & web stories",blog:"Journal settings",ui:"Interface text",site:"Brand & navigation",seoPages:"Search metadata",inbox:"Enquiries",history:"Publish history"};
const label = (s: string) => titles[s] ||
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
    products: { slug: "new-product-" + Date.now().toString(36), name: "Untitled product", category: "ACP", collection: "ACP Series", description: "", image: "", imageAlt: "", body: [""], applications: [], segments: ["residential", "commercial"], specs: [], finishes: [], source: "" },
    blogs: {
      kind: "article", sourceId: 0, categories: [], tags: [], storyPages: [], metaTitle: "", metaDescription: "", modifiedAt: "", source: "", contentHtml: "<p>Write your article here.</p>",
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
      body: [],
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
  locked = false,
  visibleKeys,
}: {
  value: Value;
  onChange: (v: Value) => void;
  path: string;
  locked?: boolean;
  visibleKeys?: string[];
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
  if (Array.isArray(value) && !path.includes(".")) return <CollectionEditor value={value} path={path} onChange={onChange} />;
  if (key === "contentHtml") return <RichEditor value={String(value || "")} onChange={onChange} />;
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
        {Object.entries(value).sort(([a],[b]) => visibleKeys ? visibleKeys.indexOf(a)-visibleKeys.indexOf(b) : 0)
          .filter(([k]) => {
            if (visibleKeys && !visibleKeys.includes(k)) return false;
            if (path.startsWith("blogs.") && ["body", "example"].includes(k) && "contentHtml" in value && value.contentHtml) return false;
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
              locked={Boolean((value as Record<string,Value>).source) && ["slug", "kind", "status", "sourceId"].includes(k)}
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
    key === "kind" && path.startsWith("blogs.") ? ["article", "story"] : key === "type" && path.startsWith("originalPages.")
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
                  "contact", "collections", "technical", "brands", "testimonials", "quiz", "metacity", "dealer-enquiry",
                ]
              : null;
  return (
    <label className={`editor-field ${image ? "image-field" : ""}`}>
      <span>{/^\d+$/.test(key) ? `Item ${Number(key) + 1}` : label(key)}</span>
      {options ? (
        <select
          aria-label={label(key)}
          value={String(value || "")}
          disabled={locked}
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
            locked || path.startsWith("originalPages.") &&
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
function RecordEditor({value,path,onChange}:{value:Value;path:string;onChange:(v:Value)=>void}) {
  const [section,setSection]=useState("Content");
  const type=path.split(".")[0],record=value as Record<string,Value>;
  const config: Record<string,Record<string,string[]>> = {
    blogs: {Content:["title","slug","status","description",...(record.kind === "story" ? ["storyPages"] : ["contentHtml", "body"])],"Images & details":["image","imageAlt","kind","author","authorSlug","publishedAt","modifiedAt","category","categorySlug","categories","tags"],SEO:["metaTitle","metaDescription","source","sourceId"]},
    products: {Content:["name","slug","description","body"],"Images & details":["image","imageAlt","finishes","category","collection","segments","applications","specs"],Source:["source"]},
    originalPages: {Content:["title","description","blocks"],SEO:["metaTitle","metaDescription"],Source:["route","sourceUrl","importedAt"]},
  };
  const tabs=config[type];
  return <>{tabs && <div className="record-tabs" role="tablist" aria-label="Editing options">{Object.keys(tabs).map(name=><button type="button" role="tab" aria-selected={section===name} key={name} onClick={()=>setSection(name)}>{name}</button>)}</div>}<Field value={value} path={path} onChange={onChange} visibleKeys={tabs?.[section]} /></>;
}
function CollectionEditor({value,path,onChange}: {value: Value[]; path: string; onChange:(v:Value)=>void}) {
  const [selected,setSelected] = useState(0);
  const [search,setSearch] = useState("");
  const item = value[selected];
  const protectedItem = !!(item && typeof item === "object" && !Array.isArray(item) && (item.source || path === "originalPages" || path === "seoPages"));
  const entries = value.map((v,index) => { const r = v as Record<string,Value>; return {index,name:String(r.name || r.title || r.city || r.label || r.route || `Item ${index+1}`),subtitle:String(r.slug || r.route || r.path || r.role || ""),kind:String(r.kind || "")}; }).filter(r => `${r.name} ${r.subtitle} ${r.kind}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="collection-editor">
    <div className="collection-list">
      <div className="collection-tools"><input aria-label={`Search ${label(path)}`} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
      {path !== "originalPages" && <button type="button" onClick={()=>{onChange([...value,emptyTemplate(path,value)]);setSelected(value.length);setSearch("");}}>Add {path === "blogs" ? "article" : path === "products" ? "product" : "item"}</button>}</div>
      <small className="collection-count">{entries.length} {label(path).toLowerCase()}</small>
      <div className="collection-rows">{entries.map(r=><button type="button" key={r.index} aria-pressed={selected===r.index} onClick={()=>setSelected(r.index)}><strong>{r.name}</strong><small>{path === "originalPages" ? canonicalPath(r.subtitle) : r.subtitle}{r.kind === "story" ? " · Web story" : ""}</small></button>)}</div>
    </div>
    <div className="collection-detail">
      {item ? <><div className="collection-detail-heading"><span>{label(path)} / Edit</span>{!protectedItem && <button type="button" className="danger" onClick={()=>{if(confirm("Remove this item from the draft?")){onChange(value.filter((_,i)=>i!==selected));setSelected(Math.max(0,selected-1));}}}>Remove</button>}</div><RecordEditor key={`${path}-${selected}`} path={`${path}.${selected}`} value={item} onChange={v=>onChange(value.map((old,i)=>i===selected?v:old))} /></> : <p>Select an item or add your first one.</p>}
    </div>
  </section>;
}
export function Portal({ authenticated }: { authenticated: boolean }) {
  const [signedIn, setSignedIn] = useState(authenticated);
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState("originalPages");
  const group = groups.find(g => g.tabs.includes(tab)) || groups[0];
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewRoute, setPreviewRoute] = useState("");
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [inboxPage,setInboxPage] = useState(1);
  const [inboxTotal,setInboxTotal] = useState(0);
  async function loadInbox(page=1) { const result=await api(`enquiries?page=${page}`);setEnquiries(result.enquiries);setInboxPage(result.page);setInboxTotal(result.total); }
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
      await run(async () => loadInbox());
    if (next === "history")
      await run(async () => setHistory((await api("revisions")).revisions));
  }
  if (!signedIn)
    return (
      <main className="portal-login">
        <Link href="/" className="portal-brand">
          <img src={"/citybond/brand-lockup.svg"} alt="CityBond" />
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
            src={state?.content.site.logo || "/citybond/brand-lockup.svg"}
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
            {busy ? "Working…" : "Publish changes"}
          </button>
        </div>
      </header>
      <aside className="portal-sidebar">
        <p>WORKSPACE</p>
        {groups.map(g => <button key={g.name} aria-current={group.name === g.name ? "page" : undefined} onClick={() => chooseTab(g.tabs[0])}>{g.name}</button>)}
        <div className="sidebar-bottom"><a href="/" target="_blank" rel="noreferrer">View website</a></div>
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
        {group.tabs.length > 1 && <div className="portal-subnav"><label>Editing <select aria-label="Content section" value={tab} onChange={e => chooseTab(e.target.value)}>{group.tabs.map(k => <option key={k} value={k}>{label(k)}</option>)}</select></label></div>}
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
        {tab === "blogs" && <p className="portal-help">Create an article or web story. Save to preview; set its status to Published before publishing. Existing URL slugs must stay unchanged.</p>}
        {tab === "originalPages" && state && <details className="portal-help import-tools"><summary>About the original website content</summary><p>Edit source wording and SEO here. Page images and the homepage design are available from the Editing menu. Importing resets this text to the captured source.</p><button disabled={busy || dirty} onClick={() => {
          if (confirm("Replace imported page text in this draft with the captured source?")) void run(async () => { const result = await api("import-original", { draftEtag: state.draftEtag }); await load(); setNotice(`Imported ${result.pages} pages into your draft.`); });
        }}>Restore captured page text</button></details>}
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
              <span>{inboxTotal} enquiries · Page {inboxPage}</span>
            </div>
            <div className="inbox-pagination"><button disabled={busy || inboxPage <= 1} onClick={()=>run(()=>loadInbox(inboxPage-1))}>Previous</button><button disabled={busy || inboxPage*50 >= inboxTotal} onClick={()=>run(()=>loadInbox(inboxPage+1))}>Next</button></div>
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
                            <dd>{(typeof v === "object" ? JSON.stringify(v) : String(v))}</dd>
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
        ) : (
          <>

            <Field
              key={tab}
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
