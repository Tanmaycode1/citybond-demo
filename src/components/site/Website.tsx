"use client";
/* eslint-disable @next/next/no-img-element */
import Link, { usePageScroll } from "./SiteLink";
import { storyProgress } from "@/lib/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { SiteContent, ContentPage, Product } from "@/lib/cms/schema";
import { EnquiryForm } from "./forms";
import { Blog } from "./Blog";
import { HomeContent } from "./HomeContent";
import type { BlogView } from "@/lib/blog";
import { sitemapPaths } from "@/lib/routes";
import {
  OriginalCopy,
  OriginalPageContext,
  useOriginalPage,
} from "./OriginalCopy";
const Context = createContext<SiteContent>(null!);
export const useContent = () => useContext(Context);
const Arrow = () => <span aria-hidden="true">↗</span>;
export function Button({
  href,
  children,
  light = false,
}: {
  href: string;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <Link className={`button ${light ? "light" : ""}`} href={href}>
      {children}
      <Arrow />
    </Link>
  );
}
export function Photo({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return src ? (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
    />
  ) : (
    <div className={`material-placeholder ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}
function Header() {
  const c = useContent();
  const [open, setOpen] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);
  return (
    <>
      <a className="skip" href="#main">
        {c.ui.skip}
      </a>
      <header className="site-header">
        <Link href="/" aria-label={c.site.name}>
          <img className="logo" src={c.site.logo} alt={c.site.name} />
        </Link>
        <nav aria-label={c.ui.menu} className={open ? "open" : ""}>
          {c.site.nav.map((l) =>
            l.children?.length ? (
              <div
                className="nav-item"
                key={l.label}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget))
                    setDropdown(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setDropdown(null);
                    e.currentTarget.querySelector("button")?.focus();
                  }
                }}
              >
                <button
                  aria-expanded={dropdown === l.label}
                  aria-controls={`nav-${c.site.nav.indexOf(l)}`}
                  onClick={() =>
                    setDropdown(dropdown === l.label ? null : l.label)
                  }
                >
                  {l.label}
                  <span aria-hidden="true">⌄</span>
                </button>
                {dropdown === l.label && (
                  <div
                    className="nav-dropdown"
                    id={`nav-${c.site.nav.indexOf(l)}`}
                  >
                    {l.children.map((child) => (
                      <Link
                        href={child.href}
                        key={child.href}
                        onClick={() => {
                          setOpen(false);
                          setDropdown(null);
                        }}
                      >
                        {child.group && <small>{child.group}</small>}
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link onClick={() => setOpen(false)} key={l.href} href={l.href}>
                {l.label}
              </Link>
            ),
          )}
          <Link className="mobile-contact" href="/contact">
            {c.ui.contact}
          </Link>
        </nav>
        <Link className="header-contact" href="/contact">
          {c.ui.contact}
          <Arrow />
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-label={open ? c.ui.close : c.ui.menu}
          onClick={() => setOpen(!open)}
        >
          {open ? "×" : "☰"}
        </button>
      </header>
    </>
  );
}
function Footer() {
  const c = useContent();
  return (
    <footer>
      <div className="footer-top">
        <Link className="footer-wordmark" href="/" aria-label={c.site.name}>
          <img
            src={c.site.footerLogo || c.site.logo}
            alt={c.site.name + " — " + c.site.tagline}
          />
        </Link>
        <p>{c.site.footer}</p>
        <a href={`mailto:${c.site.email}`}>
          {c.site.email}
          <Arrow />
        </a>
      </div>
      <div className="footer-links">
        {c.site.footerLinks.map((l) => (
          <Link href={l.href} key={l.href}>
            {l.label}
          </Link>
        ))}
        {c.site.social.map((l) => (
          <a href={l.href} key={l.href}>
            {l.label}
          </a>
        ))}
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {c.ui.copyright}
        </span>
        <span>{c.site.tagline}</span>
      </div>
    </footer>
  );
}
function Intro({
  page,
  compact = false,
}: {
  page: ContentPage;
  compact?: boolean;
}) {
  const original = useOriginalPage();
  return (
    <section className={`intro wrap ${compact ? "compact" : ""}`}>
      <p className="eyebrow">{page.eyebrow}</p>
      <h1>
        {original?.title || page.title}
        {!original && (
          <>
            <br />
            <em>{page.accent}</em>
          </>
        )}
      </h1>
      <p className="intro-description">
        {original ? original.description : page.description}
      </p>
    </section>
  );
}
function SectionHead({
  eyebrow,
  title,
  description,
  href,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
}) {
  const c = useContent();
  return (
    <div className="section-head reveal">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {c.ui.viewAll}
          <Arrow />
        </Link>
      )}
    </div>
  );
}
function Hero({ role }: { role?: SiteContent["roles"][number] }) {
  const c = useContent();
  const original = useOriginalPage();
  const [active, setActive] = useState(c.roles[0].id);
  return (
    <section
      className={`entry ${role ? "role-entry" : ""} ${original?.route === "" ? "editorial-entry" : ""}`}
    >
      <div className="entry-copy">
        <p className="eyebrow">
          <span className="tiny-plus">+</span>
          {role ? role.label : c.home.eyebrow}
        </p>
        <h1>
          {original?.title || role?.title || c.home.title}
          {!original && (
            <>
              <br />
              <em>{role?.accent || c.home.accent}</em>
            </>
          )}
        </h1>
        <p className="entry-description">
          {original
            ? original.description
            : role?.description || c.home.description}
        </p>
        {role ? (
          <div className="entry-cta">
            <Button href={role.cta.href}>{role.cta.label}</Button>
            <Link className="perspective-switch" href="/#perspective">
              {c.ui.chooseRole} ↗
            </Link>
          </div>
        ) : (
          <div className="entry-roles" id="perspective">
            <p className="eyebrow">{c.home.rolePrompt}</p>
            <div>
              {c.roles.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/for/${r.id}`}
                  onMouseEnter={() => setActive(r.id)}
                  onFocus={() => setActive(r.id)}
                  className={active === r.id ? "active" : ""}
                >
                  <span className="role-num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{r.label}</strong>
                    <small>{r.hint}</small>
                  </span>
                  <Arrow />
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="entry-foot">
          <span>{c.site.tagline}</span>
          <Link href="#material-story">
            {c.ui.scroll}
            <span>↓</span>
          </Link>
        </div>
      </div>
      <div className="entry-visual">
        <Photo
          src={role?.image || c.home.image}
          alt={role?.imageAlt || c.home.imageAlt}
          eager
        />
        <div className="entry-shade" />
        <p className="eyebrow entry-visual-label">{c.ui.visualEdit}</p>
        <p className="entry-image-title">{c.ui.visualTitle}</p>
        <div className="sample-fan" aria-hidden="true">
          <i className="sample-wood" />
          <i className="sample-stone" />
          <i
            className="sample-colour"
            style={{
              background: [
                "#201E57",
                "#DA1F1C",
                "#61607F",
                "#333542",
                "#444456",
                "#B5B4DB",
              ][c.roles.findIndex((r) => r.id === active)],
            }}
          />
        </div>
        <div className="entry-image-foot">
          <span>{c.ui.stockCaption}</span>
          <span className="circle-symbol">↗</span>
        </div>
      </div>
    </section>
  );
}
function ScrollStory() {
  const c = useContent();
  const ref = useRef<HTMLElement>(null);
  const [chapter, setChapter] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = false;
    const update = () => {
      frame = 0;
      const header = innerWidth <= 760 ? 72 : 80;
      const result = storyProgress(
        el.getBoundingClientRect().top,
        el.offsetHeight,
        innerHeight,
        header,
      );
      el.style.setProperty(
        "--assembly",
        String(media.matches ? 1 : result.assembly),
      );
      el.style.setProperty("--progress", String(result.progress));
      setChapter(media.matches ? 2 : result.chapter);
    };
    const scroll = () => {
      if (visible && !frame) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) scroll();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    update();
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", update);
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      removeEventListener("scroll", scroll);
      removeEventListener("resize", update);
      media.removeEventListener("change", update);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <section className="scroll-story" id="material-story" ref={ref}>
      <div className="story-sticky">
        <div className="story-top">
          <p className="eyebrow">{c.home.scrollEyebrow}</p>
          <span>{c.ui.storyInstruction} ↓</span>
        </div>
        <div className="story-heading">
          <h2>
            {c.home.scrollTitle}
            <br />
            <em>{c.home.scrollAccent}</em>
          </h2>
        </div>
        <div
          className="panel-scene"
          role="img"
          aria-label={c.home.scrollImageAlt}
        >
          <div className="scene-outline" />
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div
              className="facade-panel"
              key={n}
              style={
                {
                  "--i": n,
                  "--offset-x": `${(n - 2.5) * 20}px`,
                  "--offset-y": `${[28, -18, 14, -24, 20, 34][n]}px`,
                  "--rotation": `${[-7, -4, -2, 2, 4, 7][n]}deg`,
                } as CSSProperties
              }
            >
              <img
                src={c.home.scrollImage}
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            </div>
          ))}
          <span className="scene-caption">{c.ui.stockCaption}</span>
        </div>
        <div className="story-bottom">
          <div className="story-chapter" key={chapter}>
            <span className="chapter-count">0{chapter + 1}</span>
            <div>
              <h3>{c.home.chapters[chapter].title}</h3>
              <p>{c.home.chapters[chapter].text}</p>
            </div>
          </div>
          <div className="story-steps" aria-label={c.ui.progress}>
            {[c.ui.storyMaterial, c.ui.storyDimension, c.ui.storySpace].map(
              (label, n) => (
                <div key={n} className={n <= chapter ? "active" : ""}>
                  <i />
                  <span>
                    0{n + 1} {label}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
        <div className="story-progress" />
      </div>
    </section>
  );
}
function ProductCard({ p, index = 0 }: { p: Product; index?: number }) {
  const c = useContent();
  return (
    <Link className="product-card reveal" href={`/products/${p.slug}`}>
      <div className="card-photo">
        <Photo src={p.image} alt={p.imageAlt} />
        <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="card-arrow">
          <Arrow />
        </span>
      </div>
      <div className="card-heading">
        <h3>{p.name}</h3>
        <span>{p.category}</span>
      </div>
      <p>{p.collection}</p>
      <span className="sr-only">{c.ui.explore}</span>
    </Link>
  );
}
function ProductSection({
  hideHeading = false,
}: { hideHeading?: boolean } = {}) {
  const c = useContent();
  const [active, setActive] = useState(0);
  const picks = [
    "wooden-series",
    "lamio-series",
    "metallic-series",
    "solid-series",
  ]
    .map((id) => c.products.find((p) => p.slug === id))
    .filter(Boolean) as Product[];
  if (!picks.length) return null;
  const selected = picks[Math.min(active, picks.length - 1)];
  return (
    <section className="material-edit wrap section" id="materials">
      {!hideHeading && (
        <SectionHead
          eyebrow={c.ui.materialLibrary}
          title={c.home.productsTitle}
          description={c.home.productsDescription}
          href="/products"
        />
      )}
      <div
        className="material-tabs"
        role="tablist"
        aria-label={c.ui.materialLibrary}
      >
        {picks.map((p, i) => (
          <button
            key={p.slug}
            id={`material-tab-${i}`}
            role="tab"
            aria-selected={active === i}
            aria-controls="material-panel"
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? picks.length - 1
                      : (i + (e.key === "ArrowLeft" ? -1 : 1) + picks.length) %
                        picks.length;
                setActive(next);
                document.getElementById(`material-tab-${next}`)?.focus();
              }
            }}
          >
            <span>0{i + 1}</span>
            {p.collection}
            <Arrow />
          </button>
        ))}
      </div>
      <div
        id="material-panel"
        role="tabpanel"
        aria-labelledby={`material-tab-${active}`}
        className="material-panel"
      >
        <div className="material-photo">
          <Photo
            key={selected.image}
            src={selected.image}
            alt={selected.imageAlt}
          />
          <span>{c.ui.stockCaption}</span>
        </div>
        <div className="material-copy" key={selected.slug}>
          <p className="eyebrow">
            {selected.category} / {selected.name}
          </p>
          <h3>
            {selected.name}
            <em>{selected.finishes[0]?.name || selected.collection}.</em>
          </h3>
          <p>{selected.description}</p>
          <div className="material-swatches">
            {selected.finishes.map((f) => (
              <span key={f.name} style={{ background: f.hex }} title={f.name} />
            ))}
            <span>{selected.finishes[0]?.name || selected.collection}</span>
          </div>
          <Link className="text-link" href={`/products/${selected.slug}`}>
            {c.ui.explore}
            <Arrow />
          </Link>
          <p className="material-use">{selected.applications.join(" / ")}</p>
        </div>
      </div>
      <div className="material-foot">
        <p>{c.ui.finishNote}</p>
        <Link href="/collections">
          {c.ui.collectionLink}
          <Arrow />
        </Link>
      </div>
    </section>
  );
}
function ProjectSection({
  hideHeading = false,
}: { hideHeading?: boolean } = {}) {
  const c = useContent();
  return (
    <section className="project-section section">
      <div className="wrap">
        {!hideHeading && (
          <SectionHead
            title={c.home.projectsTitle}
            description={c.home.projectsDescription}
            href="/projects"
          />
        )}
        <div className="project-grid">
          {c.projects.slice(0, 2).map((p) => (
            <ProjectCard key={p.slug} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
function ProjectCard({ p }: { p: SiteContent["projects"][number] }) {
  const c = useContent();
  return (
    <Link className="project-card reveal" href={`/projects/${p.slug}`}>
      <div className="card-photo">
        <Photo src={p.image} alt={p.imageAlt} />
        {p.image.startsWith("/stock/") && (
          <span className="stock-note">{c.ui.stockCaption}</span>
        )}
        <span className="card-arrow">
          <Arrow />
        </span>
      </div>
      <div className="card-heading">
        <h3>{p.name}</h3>
        <span>{p.location}</span>
      </div>
      <p>{p.category}</p>
    </Link>
  );
}
function AboutSection() {
  const c = useContent();
  return (
    <section className="about-section wrap section">
      <div className="about-image reveal">
        <Photo src={c.home.aboutImage} alt={c.home.aboutImageAlt} />
        <span>{c.ui.stockCaption}</span>
      </div>
      <div className="about-copy reveal">
        <p className="eyebrow">{c.ui.learn}</p>
        <h2>{c.home.aboutTitle}</h2>
        <p>{c.home.aboutDescription}</p>
        <Button href="/about">{c.ui.learn}</Button>
      </div>
      <div className="stats">
        {c.home.stats.map((s) => (
          <div key={s.label}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
function FeatureSection({ type }: { type: "visualiser" | "network" }) {
  const c = useContent();
  const page = c.pages.find((p) => p.slug === type)!;
  return (
    <section className={`feature-band ${type}`}>
      <div className="wrap feature-inner">
        <div className="feature-image">
          <Photo src={page.image} alt={page.imageAlt} />
          <span>{c.ui.stockCaption}</span>
        </div>
        <div className="feature-copy">
          <p className="eyebrow">{page.eyebrow}</p>
          <h2>{c.ui[type]}</h2>
          <p>{c.ui[`${type}Description`]}</p>
          <Button href={`/${type}`}>{c.ui[`${type}Cta`]}</Button>
        </div>
      </div>
    </section>
  );
}
function ResourcesSection() {
  const c = useContent();
  return (
    <section className="wrap section">
      <SectionHead
        title={c.ui.resources}
        description={c.ui.resourcesDescription}
        href="/resources"
      />
      <div className="resource-grid">
        {c.resources.slice(0, 3).map((r) => (
          <ResourceCard key={r.slug} r={r} />
        ))}
      </div>
    </section>
  );
}
function ResourceCard({ r }: { r: SiteContent["resources"][number] }) {
  return (
    <Link className="resource-card reveal" href={`/resources/${r.slug}`}>
      <div className="card-photo">
        <Photo src={r.image} alt={r.imageAlt} />
        <span className="card-arrow">
          <Arrow />
        </span>
      </div>
      <p className="eyebrow">{r.type}</p>
      <h3>{r.title}</h3>
      <p>{r.description}</p>
    </Link>
  );
}
function ContactSection() {
  const c = useContent();
  return (
    <section className="contact-band">
      <div className="wrap">
        <p className="eyebrow">{c.site.tagline}</p>
        <h2>{c.home.contactTitle}</h2>
        <div>
          <p>{c.home.contactDescription}</p>
          <Button href="/contact">{c.ui.contact}</Button>
        </div>
      </div>
      <span className="giant-arrow" aria-hidden="true">
        ↗
      </span>
    </section>
  );
}
function Brands() {
  const c = useContent();
  return c.brands.length > 0 ? (
    <section className="brands wrap">
      <p className="eyebrow">{c.ui.partners}</p>
      <div>
        {c.brands.map((b) => (
          <span key={b.name}>
            {b.image ? <Photo src={b.image} alt={b.imageAlt} /> : b.name}
          </span>
        ))}
      </div>
    </section>
  ) : null;
}
function Testimonials() {
  const c = useContent();
  return c.testimonials.length ? (
    <section className="wrap section testimonials">
      {c.testimonials.map((t, i) => (
        <blockquote key={i}>
          <p>“{t.quote}”</p>
          <footer>
            {t.image && <Photo src={t.image} alt={t.imageAlt} />}
            <strong>{t.name}</strong>
            <span>{t.company}</span>
          </footer>
        </blockquote>
      ))}
    </section>
  ) : null;
}
function Landing({ role }: { role?: SiteContent["roles"][number] }) {
  const c = useContent();
  const original = useOriginalPage();
  const editorial = !role && original?.route === "" ? original : undefined;
  const sections = {
    projects: <ProjectSection />,
    products: <ProductSection />,
    about: <AboutSection />,
    visualiser: <FeatureSection type="visualiser" />,
    network: <FeatureSection type="network" />,
    resources: <ResourcesSection />,
    contact: <ContactSection />,
  };
  return (
    <>
      <Hero role={role} />
      <ScrollStory />
      {!editorial && <OriginalCopy />}
      {editorial ? (
        <>
          <HomeContent
            page={editorial}
            content={c}
            materials={<ProductSection hideHeading />}
            projects={<ProjectSection hideHeading />}
          />
          <FeatureSection type="visualiser" />
          <ResourcesSection />
        </>
      ) : role ? (
        role.sections
          .filter((s) => s !== "contact")
          .map((s, i) => <div key={`${s}-${i}`}>{sections[s]}</div>)
      ) : (
        <>
          <ProductSection />
          <ProjectSection />
          <AboutSection />
          <FeatureSection type="visualiser" />
          <ResourcesSection />
        </>
      )}
      {!editorial && (
        <>
          <Brands />
          <Testimonials />
        </>
      )}
      <ContactSection />
    </>
  );
}
function Products({ collections = false }: { collections?: boolean }) {
  const c = useContent();
  const [segment, setSegment] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const products = c.products.filter(
    (p) =>
      (segment === "all" ||
        p.segments.includes(segment as "residential" | "commercial")) &&
      (category === "all" || p.category === category) &&
      `${p.name} ${p.collection} ${p.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Intro
        page={c.pages.find(
          (p) => p.slug === (collections ? "collections" : "products"),
        )!}
      />
      <section className="wrap catalogue">
        <div className="filters">
          <div className="pills">
            {["all", "residential", "commercial"].map((s) => (
              <button
                key={s}
                aria-pressed={s === segment}
                onClick={() => setSegment(s)}
              >
                {c.ui[s]}
              </button>
            ))}
          </div>
          <input
            aria-label={c.ui.search}
            placeholder={`${c.ui.search} ↗`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="category-tabs">
          {["all", ...new Set(c.products.map((p) => p.category))].map((s) => (
            <button
              key={s}
              aria-pressed={s === category}
              onClick={() => setCategory(s)}
            >
              {s === "all" ? c.ui.all : s}
            </button>
          ))}
          <span>{products.length.toString().padStart(2, "0")}</span>
        </div>
        <div className="product-grid">
          {products.map((p, i) =>
            collections && p.finishes.length ? (
              <Link
                className="finish-card reveal"
                key={p.slug}
                href={`/products/${p.slug}`}
              >
                {p.finishes[0].image ? (
                  <Photo src={p.finishes[0].image} alt={p.finishes[0].name} />
                ) : (
                  <div
                    className="swatch-tile"
                    style={{ background: p.finishes[0].hex }}
                    aria-label={p.finishes[0].name}
                  />
                )}
                <span>
                  {p.name}
                  <Arrow />
                </span>
                <small>{p.finishes[0].name}</small>
              </Link>
            ) : (
              <ProductCard key={p.slug} p={p} index={i} />
            ),
          )}
        </div>
        {products.length === 0 && (
          <div className="empty">
            <p>{c.ui.noResults}</p>
            <button
              className="text-link"
              onClick={() => {
                setSegment("all");
                setCategory("all");
                setSearch("");
              }}
            >
              {c.ui.reset}
            </button>
          </div>
        )}
        <p className="note">{c.ui.finishNote}</p>
      </section>
      <FeatureSection type="visualiser" />
    </>
  );
}
function ProductDetail({ p }: { p: Product }) {
  const c = useContent();
  const original = useOriginalPage();
  const [finish, setFinish] = useState(0);
  return (
    <>
      <section className="product-detail wrap">
        <div className="product-detail-copy">
          <Link className="breadcrumb" href="/products">
            ← {c.ui.materialLibrary}
          </Link>
          <p className="eyebrow">
            {p.category} / {p.collection}
          </p>
          <h1>
            {original?.title || p.name}
            {!original && <span>.</span>}
          </h1>
          <p>{original ? original.description : p.description}</p>
          <Button href={`/samples?product=${encodeURIComponent(p.slug)}`}>
            {c.ui.sample}
          </Button>
        </div>
        <div className="product-detail-image">
          <Photo src={p.image} alt={p.imageAlt} eager />
          {p.image && <span className="image-label">{c.ui.concept}</span>}
        </div>
      </section>
      {original ? (
        <OriginalCopy />
      ) : (
        <section className="wrap product-specs section">
          <div>
            <p className="eyebrow">{p.name}</p>
            <h2>{c.ui.specs}</h2>
            {p.body.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
            <p className="note">{c.ui.productNote}</p>
          </div>
          <dl>
            {p.specs.map((s, i) => (
              <div key={i}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {p.finishes.length > 0 && (
        <section className="finish-section section">
          <div className="wrap finish-inner">
            {p.finishes[finish]?.image ? (
              <Photo
                src={p.finishes[finish].image}
                alt={p.finishes[finish].name}
              />
            ) : (
              <div
                className="swatch-tile large"
                style={{ background: p.finishes[finish]?.hex }}
                aria-label={p.finishes[finish]?.name}
              />
            )}
            <div>
              <p className="eyebrow">{p.collection}</p>
              <h2>{c.ui.finishes}</h2>
              <h3>{p.finishes[finish]?.name}</h3>
              <div className="finish-options">
                {p.finishes.map((f, i) => (
                  <button
                    key={i}
                    aria-label={f.name}
                    aria-pressed={finish === i}
                    onClick={() => setFinish(i)}
                    style={{ background: f.hex }}
                  />
                ))}
              </div>
              <p>{c.ui.finishNote}</p>
              <Button href={`/samples?product=${p.slug}`}>{c.ui.sample}</Button>
            </div>
          </div>
        </section>
      )}
      <section className="wrap section">
        <SectionHead title={c.ui.applications} />
        <div className="application-list">
          {p.applications.map((a, i) => (
            <div key={a}>
              <span>0{i + 1}</span>
              <h3>{a}</h3>
              <Arrow />
            </div>
          ))}
        </div>
      </section>
      <ContactSection />
    </>
  );
}
function Projects() {
  const c = useContent();
  const [filter, setFilter] = useState("all");
  return (
    <>
      <Intro page={c.pages.find((p) => p.slug === "projects")!} />
      <OriginalCopy />
      <section className="wrap section no-top">
        <div className="pills">
          {["all", ...new Set(c.projects.map((p) => p.category))].map((s) => (
            <button
              key={s}
              aria-pressed={s === filter}
              onClick={() => setFilter(s)}
            >
              {s === "all" ? c.ui.all : s}
            </button>
          ))}
        </div>
        <div className="project-grid all-projects">
          {c.projects
            .filter((p) => filter === "all" || p.category === filter)
            .map((p) => (
              <ProjectCard key={p.slug} p={p} />
            ))}
        </div>
      </section>
      <ContactSection />
    </>
  );
}
function ProjectDetail({ p }: { p: SiteContent["projects"][number] }) {
  const c = useContent();
  return (
    <>
      <Intro
        page={{
          ...c.pages.find((p) => p.slug === "projects")!,
          eyebrow: `${p.category} / ${p.location}`,
          title: p.name,
          accent: "",
          description: p.description,
        }}
        compact
      />
      <div className="wide-photo wrap">
        <Photo src={p.image} alt={p.imageAlt} eager />
      </div>
      <section className="wrap section">
        <SectionHead title={c.ui.technical} description={c.ui.projectSpec} />
        {p.products.length > 0 ? (
          <div className="product-grid">
            {p.products.map((id) => (
              <ProductCard
                key={id}
                p={c.products.find((p) => p.slug === id)!}
              />
            ))}
          </div>
        ) : (
          <Button href={`/contact?product=${encodeURIComponent(p.name)}`}>
            {c.ui.requestSpec}
          </Button>
        )}
      </section>
      <ProjectSection />
    </>
  );
}
function Resources() {
  const c = useContent();
  const [filter, setFilter] = useState("all");
  return (
    <>
      <Intro page={c.pages.find((p) => p.slug === "resources")!} />
      <section className="wrap section no-top">
        <div className="pills">
          {["all", ...new Set(c.resources.map((r) => r.type))].map((s) => (
            <button
              key={s}
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
            >
              {s === "all" ? c.ui.all : s}
            </button>
          ))}
        </div>
        <div className="resource-grid all-resources">
          {c.resources
            .filter((r) => filter === "all" || filter === r.type)
            .map((r) => (
              <ResourceCard key={r.slug} r={r} />
            ))}
        </div>
      </section>
    </>
  );
}
function ResourceDetail({ r }: { r: SiteContent["resources"][number] }) {
  const c = useContent();
  const original = useOriginalPage();
  return (
    <>
      <Intro
        page={{
          ...c.pages.find((p) => p.slug === "resources")!,
          eyebrow: r.type,
          title: r.title,
          accent: "",
          description: r.description,
        }}
        compact
      />
      <OriginalCopy />
      <section className="wrap article">
        <Photo src={r.image} alt={r.imageAlt} eager />
        <div>
          {!original && r.body.map((p, i) => <p key={i}>{p}</p>)}
          {r.href && <Button href={r.href}>{c.ui.source}</Button>}
        </div>
      </section>
      <ResourcesSection />
    </>
  );
}
function Network() {
  const c = useContent();
  const [state, setState] = useState("all");
  const [selected, setSelected] = useState(c.offices[0]?.city || "");
  const offices = c.offices.filter((o) => state === "all" || o.state === state);
  const current = c.offices.find((o) => o.city === selected);
  return (
    <>
      <Intro page={c.pages.find((p) => p.slug === "network")!} />
      <OriginalCopy />
      <section className="wrap network-layout">
        <div className="network-map">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M32 7 39 4 43 12 40 17 47 21 50 28 60 32 72 34 76 31 84 33 92 26 95 31 89 40 79 44 73 49 66 57 58 61 53 70 49 81 43 96 38 90 33 76 28 63 24 54 17 47 13 38 24 35 25 25 29 20 25 13Z" />
          </svg>
          {c.offices.map((o) => (
            <button
              style={{ left: `${o.x}%`, top: `${o.y}%` }}
              key={o.city}
              aria-label={o.city}
              aria-pressed={selected === o.city}
              className={selected === o.city ? "active" : ""}
              onClick={() => {
                setSelected(o.city);
                setState("all");
              }}
            >
              <span>{o.city}</span>
            </button>
          ))}
        </div>
        <div className="network-directory">
          <label>
            {c.ui.allStates}
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setSelected(
                  c.offices.find(
                    (o) =>
                      e.target.value === "all" || o.state === e.target.value,
                  )?.city || "",
                );
              }}
            >
              <option value="all">{c.ui.allStates}</option>
              {[...new Set(c.offices.map((o) => o.state))].sort().map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="city-list">
            {offices.map((o) => (
              <button
                key={o.city}
                aria-pressed={selected === o.city}
                onClick={() => setSelected(o.city)}
              >
                {o.city}
                <Arrow />
              </button>
            ))}
          </div>
          {current && (
            <div className="city-detail">
              <p className="eyebrow">{c.ui.coverage}</p>
              <h3>{current.city}</h3>
              <p>{current.address}</p>
              <a href={`tel:${current.phone.replaceAll(" ", "")}`}>
                {current.phone}
              </a>
              <a href={`mailto:${current.email}`}>{current.email}</a>
            </div>
          )}
        </div>
      </section>
      <ContactSection />
    </>
  );
}
function GenericPage({ page }: { page: ContentPage }) {
  const c = useContent();
  const original = useOriginalPage();
  return (
    <>
      <Intro page={page} />
      {page.image && (
        <div className="wide-photo wrap">
          <Photo src={page.image} alt={page.imageAlt} eager />
        </div>
      )}
      <OriginalCopy />
      {!original && page.body.length > 0 && (
        <section className="wrap prose section">
          {page.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}
      {!original && page.blocks.length > 0 && (
        <section className="wrap block-grid section">
          {page.blocks.map((b, i) => (
            <article key={i} className="reveal">
              {b.image && <Photo src={b.image} alt={b.imageAlt} />}
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </article>
          ))}
        </section>
      )}
      {page.slug === "about/leadership" && (
        <section className="wrap team-grid section">
          {c.team.map((t) => (
            <article key={t.name}>
              {t.image ? (
                <Photo src={t.image} alt={t.imageAlt} />
              ) : (
                <div className="leader-initials" aria-hidden="true">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
              )}
              <h2>{t.name}</h2>
              <p className="eyebrow">{t.role}</p>
              <p>{t.description}</p>
            </article>
          ))}
        </section>
      )}
      {page.slug === "about/clientele" && (
        <div id="client">
          <Brands />
        </div>
      )}
      {page.slug === "site-map" && (
        <nav className="wrap site-map-grid" aria-label="All website pages">
          {sitemapPaths(c).map((path) => (
            <Link href={path} key={path}>
              {path === "/" ? "Home" : path}
            </Link>
          ))}
        </nav>
      )}
      {page.slug.startsWith("about") && (
        <section className="wrap about-nav section">
          <p className="eyebrow">{c.ui.aboutLinks}</p>
          {c.pages
            .filter((p) => p.slug.startsWith("about") && p.slug !== page.slug)
            .map((p) => (
              <Link href={`/${p.slug}`} key={p.slug}>
                {p.eyebrow}
                <Arrow />
              </Link>
            ))}
        </section>
      )}
      {!["privacy", "terms"].includes(page.slug) && <ContactSection />}
    </>
  );
}
function ContactPage({
  page,
  type,
  product,
}: {
  page: ContentPage;
  type: "contact" | "dealer" | "sample" | "career";
  product?: string;
}) {
  const c = useContent();
  return (
    <>
      <Intro page={page} />
      <OriginalCopy />
      <section className="wrap enquiry-layout section no-top">
        <div className="contact-details">
          <Photo src={page.image} alt={page.imageAlt} />
          {type === "career" ? (
            <>
              <p>{c.ui.careerNote}</p>
              <a href={`mailto:${c.ui.careerEmail}`}>{c.ui.careerEmail}</a>
            </>
          ) : (
            <>
              <p className="eyebrow">{c.ui.headOffice}</p>
              <p>{c.site.address}</p>
              <a href={`tel:${c.site.phone.replaceAll(" ", "")}`}>
                {c.site.phone}
              </a>
              <a href={`mailto:${c.site.email}`}>{c.site.email}</a>
              <p className="eyebrow">{c.ui.factory}</p>
              <p>{c.ui.factoryAddress}</p>
            </>
          )}
        </div>
        <EnquiryForm c={c} type={type} product={product} />
      </section>
    </>
  );
}
export function Website({
  content,
  route,
  preview = false,
  product,
  blogView,
  requestPath,
}: {
  content: SiteContent;
  route: string;
  preview?: boolean;
  product?: string;
  blogView?: BlogView;
  requestPath?: string;
}) {
  usePageScroll(requestPath || route);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.06 },
    );
    document.querySelectorAll(".reveal").forEach((el) => {
      if (
        el.getBoundingClientRect().top > innerHeight &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        el.classList.add("will-reveal");
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, [route, content]);
  const c = content;
  const original = c.originalPages.find((p) => p.route === route);
  const p = c.pages.find((p) => p.slug === route);
  let body: ReactNode = null;
  if (blogView) body = <Blog view={blogView} c={c} preview={preview} />;
  else if (!route) body = <Landing />;
  else if (route.startsWith("for/"))
    body = <Landing role={c.roles.find((r) => r.id === route.split("/")[1])} />;
  else if (route === "products" || route === "collections")
    body = <Products collections={route === "collections"} />;
  else if (route.startsWith("products/"))
    body = (
      <ProductDetail
        p={c.products.find((p) => p.slug === route.split("/")[1])!}
      />
    );
  else if (route === "projects") body = <Projects />;
  else if (route.startsWith("projects/"))
    body = (
      <ProjectDetail
        p={c.projects.find((p) => p.slug === route.split("/")[1])!}
      />
    );
  else if (route === "resources") body = <Resources />;
  else if (route.startsWith("resources/"))
    body = (
      <ResourceDetail
        r={c.resources.find((r) => r.slug === route.split("/")[1])!}
      />
    );
  else if (route === "network") body = <Network />;
  else if (route === "visualiser") body = <Visualiser />;
  else if (route === "product-finder") body = <Quiz />;
  else if (["contact", "become-a-dealer", "samples", "careers"].includes(route))
    body = (
      <ContactPage
        page={p!}
        type={
          route === "become-a-dealer"
            ? "dealer"
            : route === "samples"
              ? "sample"
              : route === "careers"
                ? "career"
                : "contact"
        }
        product={product}
      />
    );
  else if (p) body = <GenericPage page={p} />;
  return (
    <Context.Provider value={c}>
      <OriginalPageContext.Provider value={original}>
        <div className="site-shell">
          {preview && (
            <div className="preview-banner">
              {c.ui.preview}
              <a href={`/${route}`}>{c.ui.exitPreview}</a>
            </div>
          )}
          <Header />
          <main id="main">{body}</main>
          <Footer />
        </div>
      </OriginalPageContext.Provider>
    </Context.Provider>
  );
}
function Visualiser() {
  const c = useContent();
  const [product, setProduct] = useState(c.products[0].slug);
  const selected = c.products.find((p) => p.slug === product)!;
  return (
    <>
      <Intro page={c.pages.find((p) => p.slug === "visualiser")!} />
      <OriginalCopy />
      <section className="wrap visualiser-layout section no-top">
        <div>
          <div className="visualiser-image">
            <Photo src={selected.image} alt={selected.imageAlt} />
            <span className="image-label">
              {c.ui.concept} / {selected.name}
            </span>
          </div>
          <div className="visualiser-swatches">
            {c.products
              .filter((p) => p.finishes.length)
              .map((p) => (
                <button
                  aria-label={p.name}
                  aria-pressed={p.slug === product}
                  onClick={() => setProduct(p.slug)}
                  key={p.slug}
                  style={{ background: p.finishes[0].hex }}
                />
              ))}
          </div>
          <h3>{selected.name}</h3>
          <p>{c.ui.visualiserNote}</p>
        </div>
        <EnquiryForm c={c} type="visualiser" product={product} />
      </section>
    </>
  );
}
function Quiz() {
  const c = useContent();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(["residential", "exterior", "warm"]);
  const questions = [
    { title: c.ui.quizType, options: ["residential", "commercial"] },
    { title: c.ui.quizUse, options: ["exterior", "interior", "signage"] },
    { title: c.ui.quizStyle, options: ["warm", "mineral", "metal", "colour"] },
  ];
  const families: Record<string, string[]> = {
    warm: ["Woodgrain"],
    mineral: ["Stone-inspired", "Expressive textures"],
    metal: ["Metallic"],
    colour: ["Colour"],
  };
  const matches = c.products
    .filter(
      (p) =>
        families[answers[2]].includes(p.collection) &&
        p.segments.includes(answers[0] as "residential" | "commercial") &&
        (answers[1] !== "exterior" || p.slug !== "mirror-series"),
    )
    .slice(0, 3);
  return (
    <>
      <Intro page={c.pages.find((p) => p.slug === "product-finder")!} />
      <section className="wrap quiz section no-top">
        {step < 3 ? (
          <>
            <div className="quiz-progress">
              {[0, 1, 2].map((i) => (
                <span key={i} className={i <= step ? "active" : ""} />
              ))}
            </div>
            <p className="eyebrow">
              {c.ui.step} 0{step + 1} / 03
            </p>
            <h2>{questions[step].title}</h2>
            <div className="quiz-options">
              {questions[step].options.map((o) => (
                <button
                  key={o}
                  aria-pressed={answers[step] === o}
                  onClick={() =>
                    setAnswers((a) => a.map((v, i) => (i === step ? o : v)))
                  }
                >
                  {c.ui[o]}
                  <Arrow />
                </button>
              ))}
            </div>
            <div className="quiz-actions">
              <button
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
              >
                {c.ui.previous}
              </button>
              <button className="button" onClick={() => setStep((s) => s + 1)}>
                {c.ui.next}
                <Arrow />
              </button>
            </div>
          </>
        ) : (
          <>
            <SectionHead
              title={c.ui.matches}
              description={c.ui.matchesDescription}
            />
            <div className="product-grid">
              {matches.map((p) => (
                <ProductCard p={p} key={p.slug} />
              ))}
            </div>
            <button className="text-link" onClick={() => setStep(0)}>
              {c.ui.restart} ↺
            </button>
            <div className="quiz-enquiry">
              <h2>{c.ui.contact}</h2>
              <EnquiryForm
                c={c}
                type="quiz"
                product={matches[0]?.slug}
                message={answers.map((a) => c.ui[a]).join(" / ")}
              />
            </div>
          </>
        )}
      </section>
    </>
  );
}
