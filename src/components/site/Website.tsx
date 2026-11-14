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
import { canonicalPath, sitemapPaths } from "@/lib/routes";
import { emptyProductFilters, filterCatalogue } from "@/lib/product-filters";
import { JourneyRoleContext } from "./JourneyContext";
import { useInnerMotion } from "./useInnerMotion";
import {
  OriginalCopy,
  OriginalBlocks,
  OriginalPageContext,
  useOriginalPage,
} from "./OriginalCopy";
const Context = createContext<SiteContent>(null!);
export const useContent = () => useContext(Context);
function photoCaption(src: string, ui: SiteContent["ui"]) {
  return /^\/(stock|images)\//.test(src) ? ui.stockCaption : null;
}
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
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  return (
    <>
      <a className="skip" href="#main">
        {c.ui.skip}
      </a>
      <header className={`site-header grouped-header header-${c.site.headerStyle}`}>
        <Link href="/" aria-label={c.site.name}>
          <img className="logo" src={c.site.logo} alt={c.site.name} />
        </Link>
        <nav id="primary-navigation" aria-label={c.ui.menu} className={open ? "open" : ""}>
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
                  onClick={() => {
                    setDropdown(dropdown === l.label ? null : l.label);
                    setMobileGroup(null);
                  }}
                >
                  {l.label}
                  <svg className="nav-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {dropdown === l.label && (
                  <div
                    className="nav-dropdown grouped-dropdown"
                    id={`nav-${c.site.nav.indexOf(l)}`}
                  >
                    {Array.from(new Set(l.children.map((child) => child.group || "Explore"))).map((group) => (
                      <section className={`nav-group ${mobileGroup === group ? "group-expanded" : ""}`} key={group} aria-label={group}>
                        <h2 className="desktop-group-title">{group}</h2>
                        <button className="mobile-group-toggle" aria-expanded={mobileGroup === group} aria-controls={`nav-${c.site.nav.indexOf(l)}-group-${l.children.findIndex(child => (child.group || "Explore") === group)}`} onClick={() => setMobileGroup(mobileGroup === group ? null : group)}>
                          {group}<span aria-hidden="true">{mobileGroup === group ? "−" : "+"}</span>
                        </button>
                        <ul id={`nav-${c.site.nav.indexOf(l)}-group-${l.children.findIndex(child => (child.group || "Explore") === group)}`} className={group === "Cities" ? "nav-city-list" : undefined}>
                    {l.children.filter((child) => (child.group || "Explore") === group).map((child) => (
                      <li key={child.href}>
                      <Link
                        href={child.href}
                        key={child.href}
                        onClick={() => {
                          setOpen(false);
                          setDropdown(null);
                        }}
                      >
                        {child.label}
                      </Link>
                      </li>
                    ))}
                        </ul>
                      </section>
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
          <Link className="mobile-contact" href="/contact" onClick={() => { setOpen(false); setDropdown(null); }}>
            {c.ui.contact}
          </Link>
        </nav>
        <Link className="header-contact" href="/contact">
          {c.ui.contact}
          <Arrow />
        </Link>
        <button
          className="menu-toggle"
          aria-controls="primary-navigation"
          aria-expanded={open}
          aria-label={open ? c.ui.close : c.ui.menu}
          onClick={() => { setOpen(!open); setDropdown(null); setMobileGroup(null); }}
        >
          {open ? "×" : "☰"}
        </button>
      </header>
    </>
  );
}
function Footer() {
  const c = useContent();
  const groups = [...new Set(c.site.footerLinks.map(link => link.group || "Explore"))];
  return (
    <footer className="artistic-footer">
      <div className="wrap">
      <div className="footer-directory">
      <div className="footer-brand">
        <Link className="footer-wordmark" href="/" aria-label={c.site.name}>
          <img
            src={c.site.footerLogo || c.site.logo}
            alt={c.site.name + " — " + c.site.tagline}
          />
        </Link>
        <p>{c.site.footer}</p>
        {c.site.social.length > 0 && <div className="footer-social">{c.site.social.map(link => <a href={link.href} key={link.href}>{link.label}<Arrow /></a>)}</div>}
      </div>
      <nav className="footer-navigation" aria-label={c.ui.footerNavigation}>
        {groups.map(group => <section key={group}>
          <h3>{group}</h3>
          <ul>{c.site.footerLinks.filter(link => (link.group || "Explore") === group).map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
        </section>)}
      </nav>
      <div className="footer-contact">
        <h3>{c.ui.contact}</h3>
        <a href={`mailto:${c.site.email}`}>{c.site.email}<Arrow /></a>
        <a href={`tel:${c.site.phone.replaceAll(" ", "")}`}>{c.site.phone}</a>
        <p>{c.site.address}</p>
      </div>
      </div>
      <div className="footer-signature">
        <svg className="footer-folds" viewBox="0 0 560 220" fill="none" aria-hidden="true" focusable="false">
          <path d="M0 220 100 20 180 70 80 220Z" fill="#514d8a" />
          <path d="m100 20 80 50 40 150H80Z" fill="#343064" />
          <path d="M180 220 280 0 360 50 260 220Z" fill="#aaa7cd" />
          <path d="m280 0 80 50 40 170H260Z" fill="#625d9d" />
          <path d="M360 220 460 20 540 70 440 220Z" fill="#de201c" />
          <path d="m460 20 80 50 20 150H440Z" fill="#971b27" />
          <path d="m100 20 80 50M280 0l80 50m100-30 80 50" stroke="white" strokeOpacity=".35" />
        </svg>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {c.ui.copyright}
        </span>
        <span>{c.site.tagline}</span>
      </div>
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
function Hero({ role, exploreHome = false }: { role?: SiteContent["roles"][number]; exploreHome?: boolean }) {
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
          <Link className={!role && !exploreHome ? "home-explore-action" : undefined} href={!role && !exploreHome ? "/?explore=1#material-story" : "#material-story"}>
            {!role && !exploreHome ? c.ui.exploreCitybond : c.ui.scroll}
            <span aria-hidden="true">↓</span>
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
        {photoCaption(role?.image || c.home.image, c.ui) && (
          <div className="entry-image-foot">
            <span>{photoCaption(role?.image || c.home.image, c.ui)}</span>
          </div>
        )}
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
    let dirty = true;
    let lastTime = 0;
    let displayed = 0;
    let assembly = 0;
    let target = { progress: 0, assembly: 0, chapter: 0 };
    let currentChapter = -1;
    const measure = () => {
      const header = document.querySelector(".site-header")?.getBoundingClientRect().height || 84;
      el.style.setProperty("--story-header", header + "px");
      const sticky = el.querySelector<HTMLElement>(".story-sticky");
      const viewport = (sticky?.offsetHeight || innerHeight - header) + header;
      target = storyProgress(el.getBoundingClientRect().top, el.offsetHeight, viewport, header);
      dirty = false;
    };
    const update = (time: number) => {
      frame = 0;
      if (dirty) measure();
      const elapsed = lastTime ? Math.min(64, time - lastTime) : 16.67;
      lastTime = time;
      const blend = 1 - Math.exp(-elapsed / 110);
      if (media.matches) { displayed = 1; assembly = 1; }
      else {
        displayed += (target.progress - displayed) * blend;
        assembly += (target.assembly - assembly) * blend;
        if (Math.abs(target.progress - displayed) < 0.0001) displayed = target.progress;
        if (Math.abs(target.assembly - assembly) < 0.0001) assembly = target.assembly;
      }
      el.style.setProperty("--assembly", String(assembly));
      el.style.setProperty("--progress", String(displayed));
      const next = Math.min(2, Math.floor(displayed * 3));
      if (next !== currentChapter) { currentChapter = next; setChapter(next); }
      if (visible && !media.matches && (displayed !== target.progress || assembly !== target.assembly))
        frame = requestAnimationFrame(update);
    };
    const schedule = () => {
      dirty = true;
      if (visible && !frame) { lastTime = 0; frame = requestAnimationFrame(update); }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    }, { rootMargin: "150px" });
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    const sticky = el.querySelector(".story-sticky");
    if (sticky) resize.observe(sticky);
    observer.observe(el);
    measure();
    displayed = media.matches ? 1 : target.progress;
    assembly = media.matches ? 1 : target.assembly;
    update(performance.now());
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    media.addEventListener("change", schedule);
    return () => {
      observer.disconnect(); resize.disconnect();
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      media.removeEventListener("change", schedule);
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
                  "--offset-x": `${(n - 2.5) * 12}px`,
                  "--offset-y": `${[20, -12, 8, -8, 12, -20][n]}px`,
                  "--rotation": `${[-3, -2, -1, 1, 2, 3][n]}deg`,
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
          {photoCaption(c.home.scrollImage, c.ui) && <span className="scene-caption">{photoCaption(c.home.scrollImage, c.ui)}</span>}
        </div>
        <div className="story-bottom">
          <div className="story-chapter">
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
function ProductCard({ p, index = 0, collection = false }: { p: Product; index?: number; collection?: boolean }) {
  const c = useContent();
  const finish = collection ? p.finishes[0] : undefined;
  return (
    <Link className="product-card reveal" href={`/products/${p.slug}`}>
      <div className="card-photo">
        {finish && !finish.image ? <div className="swatch-tile" style={{ background: finish.hex }} aria-label={finish.name} /> : <Photo src={finish?.image || p.image} alt={finish?.name || p.imageAlt} />}
        <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="card-arrow">
          <Arrow />
        </span>
      </div>
      <div className="card-heading">
        <h3>{p.name}</h3>
        <span>{p.category}</span>
      </div>
      <p>{finish?.name || p.collection}</p>
      <span className="sr-only">{c.ui.explore}</span>
    </Link>
  );
}
function ProductSection({
  hideHeading = false,
  linkBelow = false,
}: { hideHeading?: boolean; linkBelow?: boolean } = {}) {
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
          href={linkBelow ? undefined : "/products"}
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
          {(selected.image.startsWith("/stock/") || selected.image.startsWith("/images/")) && <span>{c.ui.stockCaption}</span>}
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
  linkBelow = false,
  categories = [],
}: { hideHeading?: boolean; linkBelow?: boolean; categories?: string[] } = {}) {
  const c = useContent();
  return (
    <section className="project-section section">
      <div className="wrap">
        {!hideHeading && (
          <SectionHead
            title={c.home.projectsTitle}
            description={c.home.projectsDescription}
            href={linkBelow ? undefined : "/projects"}
          />
        )}
        <div className="project-grid">
          {c.projects.filter(p => !categories.length || categories.includes(p.category)).slice(0, 2).map((p) => (
            <ProjectCard key={p.slug} p={p} />
          ))}
        </div>
        {linkBelow && <SectionFooterLink href="/projects" />}
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
        {photoCaption(c.home.aboutImage, c.ui) && <span>{photoCaption(c.home.aboutImage, c.ui)}</span>}
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
function FeatureSection({ type }: { type: "visualiser" | "network" | "product-finder" }) {
  const c = useContent();
  const page = c.pages.find((p) => p.slug === type)!;
  return (
    <section className={`feature-band ${type}`}>
      <div className="wrap feature-inner">
        <div className="feature-image">
          <Photo src={page.image} alt={page.imageAlt} />
          {photoCaption(page.image, c.ui) && <span>{photoCaption(page.image, c.ui)}</span>}
        </div>
        <div className="feature-copy">
          <p className="eyebrow">{page.eyebrow}</p>
          <h2>{c.ui[type] || page.title}</h2>
          <p>{c.ui[`${type}Description`] || page.description}</p>
          <Button href={`/${type}`}>{c.ui[`${type}Cta`] || page.cta.label}</Button>
        </div>
      </div>
    </section>
  );
}
function SectionFooterLink({ href }: { href: string }) {
  const c = useContent();
  return <div className="section-footer-link"><Link className="text-link" href={href}>{c.ui.viewAll}<Arrow /></Link></div>;
}
function ResourcesSection({ linkBelow = false }: { linkBelow?: boolean } = {}) {
  const c = useContent();
  return (
    <section className="wrap section">
      <SectionHead
        title={c.ui.resources}
        description={c.ui.resourcesDescription}
        href={linkBelow ? undefined : "/resources"}
      />
      <div className="resource-grid">
        {c.resources.slice(0, 3).map((r) => (
          <ResourceCard key={r.slug} r={r} />
        ))}
      </div>
      {linkBelow && <SectionFooterLink href="/resources" />}
    </section>
  );
}
function ResourceCard({ r, reveal = true }: { r: SiteContent["resources"][number]; reveal?: boolean }) {
  return (
    <Link className={`resource-card${reveal ? " reveal" : ""}`} href={`/resources/${r.slug}`}>
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
function AudienceCopy({ part }: { part: "intro" | "benefits" | "stories" | "callback" }) {
  const original = useOriginalPage();
  if (!original) return null;
  const groups: typeof original.blocks[] = [];
  original.blocks.forEach(block => {
    if (!groups.length || (block.type === "heading" && block.level <= 5)) groups.push([]);
    groups[groups.length - 1].push(block);
  });
  return <div className="wrap audience-original">
    {groups.filter(blocks => {
      const id = blocks[0].id;
      return part === "benefits" ? id === "original-0002" : part === "stories" ? id === "original-0022" : part === "callback" ? id === "original-0027" : !["original-0002", "original-0022", "original-0027"].includes(id);
    }).map(blocks => {
      const numberedStart = blocks.findIndex(block => /^\d{2}$/.test(block.text));
      const heading = blocks[0];
      const stories = heading.text === "Success Stories";
      const callback = heading.text === "Request a Call-back";
      const benefits: typeof blocks[] = [];
      if (numberedStart >= 0) blocks.slice(numberedStart).forEach(block => {
        if (!benefits.length || /^\d{2}$/.test(block.text)) benefits.push([]);
        benefits[benefits.length - 1].push(block);
      });
      return <section className={`audience-copy-section${callback ? " audience-callback" : ""}`} key={heading.id}>
        <div className="original-copy"><OriginalBlocks blocks={numberedStart >= 0 ? blocks.slice(0, numberedStart) : stories ? blocks.slice(0, 1) : blocks} title={original.title} /></div>
        {benefits.length > 0 && <div className="audience-benefits">{benefits.map(items => <article key={items[0].id}>
          <span className="eyebrow">{items[0].text}</span>
          <OriginalBlocks blocks={items.slice(1)} title={original.title} />
        </article>)}</div>}
        {stories && <div className="audience-stories">{blocks.slice(1).filter((_, i) => i % 2 === 0).map((block, i) => <blockquote key={block.id}>
          <p>{block.text}</p><footer>{blocks[i * 2 + 2]?.text}</footer>
        </blockquote>)}</div>}
        {callback && <Button href="/contact">{heading.text}</Button>}
      </section>;
    })}
  </div>;
}
function AudienceProducts() {
  const c = useContent();
  return <section className="wrap section audience-products">
    <SectionHead title={c.home.productsTitle} description={c.home.productsDescription} />
    <div>{[...new Set(c.products.map(product => product.category))].map(category => <section key={category}>
      <h3>{category}</h3>
      <ul>{c.products.filter(product => product.category === category).map(product => <li key={product.slug}><Link href={`/products/${product.slug}`}>{product.name}<Arrow /></Link></li>)}</ul>
    </section>)}</div>
  </section>;
}
function AudienceTechnical() {
  const c = useContent();
  const links = c.site.nav.flatMap(item => item.children || []).filter(item => ["Thickness", "Core options"].includes(item.group));
  return <section className="wrap section audience-technical"><SectionHead title={c.ui.technicalSpecifications} description={c.ui.technicalDescription} />
    <div>{links.map(link => <Link className="text-link" key={link.href} href={link.href}>{link.label}<Arrow /></Link>)}</div>
  </section>;
}
function AudienceProductFeature({ slug }: { slug: string }) {
  const c = useContent();
  const product = c.products.find(product => product.slug === slug);
  if (!product) return null;
  return <section className="feature-band"><div className="wrap feature-inner">
    <div className="feature-image"><Photo src={product.image} alt={product.imageAlt} /></div>
    <div className="feature-copy"><p className="eyebrow">{product.category}</p><h2>{product.name}</h2><p>{product.description}</p><Button href={`/products/${product.slug}`}>{c.ui.explore}</Button></div>
  </div></section>;
}
function AudiencePage({ role }: { role: SiteContent["roles"][number] }) {
  const c = useContent();
  const original = useOriginalPage();
  const sections = {
    projects: <ProjectSection linkBelow categories={role.projectCategories} />,
    products: <AudienceProducts />,
    about: <><AudienceCopy part="benefits" /><AboutSection /></>,
    visualiser: <FeatureSection type="visualiser" />,
    network: <Network embedded />,
    resources: <ResourcesSection linkBelow />,
    contact: <ContactSection />,
    collections: <ProductSection linkBelow />,
    technical: <AudienceTechnical />,
    brands: <Brands />,
    testimonials: <><AudienceCopy part="stories" /><Testimonials /></>,
    quiz: <FeatureSection type="product-finder" />,
    metacity: <AudienceProductFeature slug="metacity" />,
    "dealer-enquiry": <section className="wrap section audience-enquiry planning-page"><h2>{c.pages.find(page => page.slug === "become-a-dealer")?.title}</h2><EnquiryForm c={c} type="dealer" /></section>,
  };
  return <div className="audience-page">
    <section className="wrap audience-hero">
      <div>
        <p className="eyebrow">{role.label}</p>
        <h1>{original?.title || <>{role.title}<span>{role.accent}</span></>}</h1>
        <p className="audience-description">{original?.description || role.description}</p>
        <div className="audience-actions"><Button href={role.cta.href}>{role.cta.label}</Button>{role.secondaryCta && <Link className="text-link" href={role.secondaryCta.href}>{role.secondaryCta.label}<Arrow /></Link>}</div>
      </div>
      <Photo src={role.image} alt={role.imageAlt} eager />
    </section>
    <AudienceCopy part="intro" />
    {role.sections.filter(section => section !== "contact").map((section, i) => <div className="audience-section" data-journey-section={section} key={`${section}-${i}`}>{sections[section]}</div>)}
    {!role.sections.includes("brands") && <Brands />}
    {!role.sections.includes("testimonials") && <><AudienceCopy part="stories" /><Testimonials /></>}
    <AudienceCopy part="callback" />
    <nav className="wrap audience-options" id="audience-options" aria-label={c.ui.chooseRole}>
      <h2>{c.ui.chooseRole}</h2>
      <div>{c.roles.map(item => <Link key={item.id} href={`/for/${item.id}`} aria-current={item.id === role.id ? "page" : undefined}>{item.label}<Arrow /></Link>)}</div>
    </nav>
    <ContactSection />
  </div>;
}
function Landing({ exploreHome = false }: { exploreHome?: boolean }) {
  const c = useContent();
  const original = useOriginalPage();
  const editorial = original?.route === "" ? original : undefined;
  return (
    <>
      <Hero exploreHome={exploreHome} />
      <div className="home-discovery" hidden={!exploreHome}>
      <ScrollStory />
      {!editorial && <OriginalCopy />}
      {editorial ? (
        <>
          <HomeContent
            page={editorial}
            content={c}
            materials={<ProductSection hideHeading />}
            projects={<ProjectSection hideHeading />}
            finder={<FeatureSection type="product-finder" />}
          />
          <FeatureSection type="visualiser" />
          <ResourcesSection />
        </>
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
      </div>
    </>
  );
}
function Products({ collections = false, thicknessByProduct = {} }: { collections?: boolean; thicknessByProduct?: Record<string, number[]> }) {
  const c = useContent();
  const [filters, setFilters] = useState(emptyProductFilters);
  const { segment, category, thickness, search } = filters;
  const entries = c.products.map(product => ({ product, thicknesses: thicknessByProduct[product.slug] || [] }));
  const thicknesses = [...new Set(entries.flatMap(entry => entry.thicknesses))].sort((a, b) => a - b);
  const products = filterCatalogue(entries, filters);
  const reset = () => setFilters(emptyProductFilters);
  const filtered = segment !== "all" || category !== "all" || thickness !== "all" || search !== "";
  return (
    <div className="products-page">
      <Intro
        page={c.pages.find(
          (p) => p.slug === (collections ? "collections" : "products"),
        )!}
      />
      <section className="wrap catalogue">
        <div className="filters">
          <div className="pills" role="group" aria-label="Project use">
            {["all", "residential", "commercial"].map((s) => (
              <button
                key={s}
                aria-pressed={s === segment}
                onClick={() => setFilters(previous => ({ ...previous, segment: s }))}
              >
                {c.ui[s]}
              </button>
            ))}
          </div>
          <input
            aria-label={c.ui.search}
            placeholder={c.ui.search}
            value={search}
            onChange={(e) => setFilters(previous => ({ ...previous, search: e.target.value }))}
          />
        </div>
        <div className="category-tabs" role="group" aria-label="Product types">
          {["all", ...new Set(c.products.map((p) => p.category))].map((s) => (
            <button
              key={s}
              aria-pressed={s === category}
              onClick={() => setFilters(previous => ({ ...previous, category: s }))}
            >
              {s === "all" ? c.ui.all : s}
            </button>
          ))}
        </div>
        <div className="catalogue-summary">
          <div className="thickness-filter">
            <label htmlFor="catalogue-thickness">Panel thickness</label>
            <select id="catalogue-thickness" value={thickness} onChange={e => setFilters(previous => ({ ...previous, thickness: e.target.value }))}>
              <option value="all">All thicknesses</option>
              {thicknesses.map(value => <option key={value} value={String(value)}>{value} mm</option>)}
            </select>
          </div>
          <div className="catalogue-results">
          <p role="status" aria-live="polite">{products.length} {products.length === 1 ? "result" : "results"}</p>
          {filtered && (
            <button onClick={reset}>{c.ui.reset}</button>
          )}
          </div>
        </div>
        <div className="product-grid">
          {products.map((p, i) => <ProductCard key={p.slug} p={p} index={i} collection={collections} />)}
        </div>
        {products.length === 0 && (
          <div className="empty">
            <p>{c.ui.noResults}</p>
            <button
              className="text-link"
              onClick={reset}
            >
              {c.ui.reset}
            </button>
          </div>
        )}
        <p className="note">{c.ui.finishNote}</p>
      </section>
      <FeatureSection type="visualiser" />
    </div>
  );
}
function ProductDetail({ p }: { p: Product }) {
  const c = useContent();
  const original = useOriginalPage();
  const [finish, setFinish] = useState(0);
  return (
    <div className={`product-template${p.finishes.length === 0 ? " without-finishes" : ""}`}>
      <section className="product-detail wrap">
        <div className="product-detail-copy">
          <Link className="breadcrumb" href="/products">
            ← All products
          </Link>
          <p className="eyebrow">
            {p.category} / {p.collection}
          </p>
          <h1>
            {original?.title || p.name}
            {!original && <span>.</span>}
          </h1>
          <p>{original?.description || p.description}</p>
          <div className="product-actions">
          <Button href={`/samples?product=${encodeURIComponent(p.slug)}`}>
            {c.ui.sample}
          </Button>
          <Link className="text-link" href={`/contact?product=${encodeURIComponent(p.slug)}`}>{c.ui.technical}<Arrow /></Link>
          </div>
          <div className="product-tags">{p.applications.slice(0, 3).map(item => <span key={item}>{item}</span>)}</div>
        </div>
        <div className="product-detail-image">
          <Photo src={p.image} alt={p.imageAlt} eager />
          {(p.image.startsWith("/stock/") || p.image.startsWith("/images/")) && <span className="image-label">{c.ui.concept}</span>}
        </div>
      </section>
      <div id="product-overview">
      {original ? (
        <section className="product-overview wrap">
          <div className="product-overview-copy">
            <h2>Overview</h2>
            <OriginalCopy groupFinishLists />
          </div>
        </section>
      ) : (
        <section className="wrap product-specs section">
          <div>
            <p className="eyebrow">{p.name}</p>
            <h2>Overview</h2>
            {p.body.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </div>
        </section>
      )}
      </div>
      {p.finishes.length > 0 && (
        <section className="finish-section section" id="product-finishes">
          <div className="wrap finish-inner">
            {p.finishes[finish]?.image ? (
              <Photo
                src={p.finishes[finish].image}
                alt={p.finishes[finish].name}
              />
            ) : (
              <div
                className="swatch-tile large"
                role="img"
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
                    title={f.name}
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
      <section className="wrap section" id="product-applications">
        <SectionHead title="Applications" />
        <div className="application-list">
          {p.applications.map((a, i) => (
            <div key={a}>
              <span>0{i + 1}</span>
              <h3>{a}</h3>
            </div>
          ))}
        </div>
      </section>
      <ContactSection />
    </div>
  );
}
function Projects() {
  const c = useContent();
  const original = useOriginalPage();
  const [filter, setFilter] = useState("all");
  return (
    <div className="projects-page">
      <Intro page={c.pages.find((p) => p.slug === "projects")!} />
      {original && <div className="original-copy wrap projects-introduction">
        <OriginalBlocks blocks={original.blocks.slice(0, 2)} title={original.title} />
      </div>}
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
    </div>
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
        <SectionHead title={p.products.length ? c.ui.productsUsed : c.ui.technical} description={p.products.length ? undefined : c.ui.projectSpec} />
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
          <Button href={`/contact?project=${encodeURIComponent(p.slug)}`}>
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
    <div className="resources-page">
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
              <ResourceCard key={r.slug} r={r} reveal={false} />
            ))}
        </div>
      </section>
    </div>
  );
}
function ResourceDetail({ r }: { r: SiteContent["resources"][number] }) {
  const c = useContent();
  const original = useOriginalPage();
  const presenceIndex = original?.blocks.findIndex(block => block.type === "heading" && block.text === "Our Presence") ?? -1;
  const presenceEnd = presenceIndex >= 0 ? original!.blocks.findIndex((block, index) => index > presenceIndex && (block.type === "heading" || block.text === "Buying Options")) : -1;
  return (
    <div className="resources-page resource-detail-page">
      <section className="wrap resource-hero">
        <div>
          <Link className="breadcrumb" href="/resources">← {c.ui.resources}</Link>
          <p className="eyebrow">{r.type}</p>
          <h1>{r.title}</h1>
          <p className="resource-description">{r.description}</p>
          {r.href && <Button href={r.href}>{c.ui.source}</Button>}
        </div>
        <Photo src={r.image} alt={r.imageAlt} eager />
      </section>
      <div className="wrap original-copy resource-body">
        {original ? presenceIndex >= 0 ? <>
          <OriginalBlocks blocks={original.blocks.slice(0, presenceIndex)} title={r.title} />
          <section className="resource-presence">
            <h3>{original.blocks[presenceIndex].text}</h3>
            <ul>{original.blocks.slice(presenceIndex + 1, presenceEnd >= 0 ? presenceEnd : undefined).map(block => {
              const city = block.text.trim().toLowerCase();
              const destination = c.site.nav.flatMap(item => item.children || []).find(item =>
                item.label.toLowerCase() === city || item.href.replace(/^\/+|\/+$/g, "").toLowerCase() === city,
              );
              return <li key={block.id}>{destination ? <Link href={destination.href}>{block.text}</Link> : block.text}</li>;
            })}</ul>
          </section>
          {presenceEnd >= 0 && <OriginalBlocks blocks={original.blocks.slice(presenceEnd)} title={r.title} />}
        </> : <OriginalBlocks blocks={original.blocks} title={r.title} /> : r.body.map((text, i) => <p key={i}>{text}</p>)}
      </div>
      <ResourcesSection />
    </div>
  );
}
function Network({ embedded = false }: { embedded?: boolean } = {}) {
  const c = useContent();
  const currentOriginal = useOriginalPage();
  const original = embedded ? undefined : currentOriginal;
  const presenceIndex = original?.blocks.findIndex(block => block.text === "Our Presence") ?? -1;
  const supportIndex = original?.blocks.findIndex(block => block.text === "Buying Options") ?? -1;
  const introduction = original?.blocks.slice(0, presenceIndex >= 0 ? presenceIndex : undefined) || [];
  const opening = introduction.find(block => block.type === "heading");
  const statistics = introduction.flatMap(block => {
    const match = block.type === "paragraph" && block.text.trim().match(/^(\d[\d,.]*\s*\+?)\s+(.+)$/);
    return match ? [{ id: block.id, value: match[1].replace(/\s/g, ""), label: match[2] }] : [];
  });
  const supportingCopy = introduction.filter(block => block !== opening && !statistics.some(stat => stat.id === block.id));
  const cityLinks = c.site.nav.flatMap(item => item.children || []);
  const cityHref = (city: string) => cityLinks.find(item => item.label.toLowerCase() === city.toLowerCase() || item.href.replace(/^\/+|\/+$/g, "").toLowerCase() === city.toLowerCase())?.href;
  const [state, setState] = useState("all");
  const [selected, setSelected] = useState(c.offices[0]?.city || "");
  const offices = c.offices.filter((o) => state === "all" || o.state === state);
  const current = c.offices.find((o) => o.city === selected);
  return (
    <div className="network-page">
      {embedded ? <div className="wrap section"><SectionHead title={c.pages.find(p => p.slug === "network")!.title} /></div> : <Intro page={c.pages.find((p) => p.slug === "network")!} />}
      {original && <div className="wrap network-introduction">
        {opening && <h2>{opening.text}</h2>}
        {statistics.length > 0 && <dl className="network-statistics">{statistics.map(stat => <div key={stat.id}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
      </div>}
      <section className="wrap network-layout">
        <div className="network-map">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M32 7 39 4 43 12 40 17 47 21 50 28 60 32 72 34 76 31 84 33 92 26 95 31 89 40 79 44 73 49 66 57 58 61 53 70 49 81 43 96 38 90 33 76 28 63 24 54 17 47 13 38 24 35 25 25 29 20 25 13Z" />
          </svg>
          {offices.map((o) => (
            <button
              style={{ left: `${o.x}%`, top: `${o.y}%` }}
              key={o.city}
              aria-label={o.city}
              aria-pressed={selected === o.city}
              className={selected === o.city ? "active" : ""}
              onClick={() => {
                setSelected(o.city);
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
              <div className="network-city-row" key={o.city}><button
                aria-pressed={selected === o.city}
                onClick={() => setSelected(o.city)}
              >
                {o.city}
              </button>
              </div>
            ))}
          </div>
          {current && (
            <div className="city-detail">
              <p className="eyebrow">{c.ui.coverage}</p>
              <h3>{cityHref(current.city) ? <Link href={cityHref(current.city)!}>{current.city}<Arrow /></Link> : current.city}</h3>
              <p>{current.address}</p>
              <a href={`tel:${current.phone.replaceAll(" ", "")}`}>
                {current.phone}
              </a>
              <a href={`mailto:${current.email}`}>{current.email}</a>
            </div>
          )}
        </div>
      </section>
      {original && supportingCopy.length > 0 && <div className="wrap original-copy network-story"><OriginalBlocks blocks={supportingCopy} title={original.title} /></div>}
      {original && presenceIndex >= 0 && <section className="wrap contact-presence">
        <h2>{original.blocks[presenceIndex].text}</h2>
        <ul>{original.blocks.slice(presenceIndex + 1, supportIndex >= 0 ? supportIndex : undefined).map(block => <li key={block.id}>{cityHref(block.text) ? <Link href={cityHref(block.text)!}>{block.text}</Link> : block.text}</li>)}</ul>
      </section>}
      {original && supportIndex >= 0 && <div className="wrap original-copy network-support"><OriginalBlocks blocks={original.blocks.slice(supportIndex)} title={original.title} /></div>}
      {!embedded && <ContactSection />}
    </div>
  );
}
function MaterialInfoPage({ page }: { page: ContentPage }) {
  const original = useOriginalPage();
  const content = useContent();
  const isCore = ["fire-retardent", "low-density-poly-ethylene"].includes(page.slug);
  const isApplication = ["exterior-facade", "interior-design", "brand-identity"].includes(page.slug);
  const brandHeading = page.slug === "brand-identity" ? original?.blocks.find(block => block.type === "heading" && block.text === "Approved By Leading Brands") : undefined;
  const blocks = (original?.blocks || []).filter(block => !isApplication || ![
    "Have a Message For Us?",
    "Use this form to send your message. We will get back within 24 hours.",
  ].includes(block.text.trim()));
  return <div className="thickness-page">
    <section className="wrap thickness-hero">
      <div>
        <Link className="breadcrumb" href={isApplication ? "/projects" : "/products"}>← {isApplication ? "Explore projects" : "All products"}</Link>
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{original?.title || page.title}</h1>
        <p className="thickness-intro">{original?.description || page.description}</p>
        <Button href={page.cta.href}>{page.cta.label}</Button>
      </div>
      {page.image && <Photo src={page.image} alt={page.imageAlt} eager />}
    </section>
    <div className="wrap thickness-content">
      {isCore ? <OriginalCopy groupFinishLists /> : <div className="original-copy">
        <OriginalBlocks blocks={blocks.filter(block => block !== brandHeading)} title={page.title} />
      </div>}
    </div>
    {brandHeading && <section className="home-brands wrap">
      <h2>{brandHeading.text}</h2>
      <div>{content.brands.map(brand => <span key={brand.name}>
        {brand.image ? <Photo src={brand.image} alt={brand.imageAlt} /> : brand.name}
      </span>)}</div>
    </section>}
    <ContactSection />
  </div>;
}
function AwardsList() {
  const original = useOriginalPage();
  return <div className="original-copy">
    <ul>{original?.blocks.filter(block => block.type === "paragraph").map(block => <li key={block.id}>{block.text}</li>)}</ul>
    <OriginalBlocks blocks={original?.blocks.filter(block => block.type !== "paragraph") || []} title={original?.title} />
  </div>;
}
function CompanyPage({ page }: { page: ContentPage }) {
  const c = useContent();
  const original = useOriginalPage();
  const leadership = page.slug === "about/leadership";
  const awards = page.slug === "awards";
  const isYear = (text: string) => /^\d{4}(?:\s*[-–]\s*\d{4})?$/.test(text.trim());
  const historyStart = page.slug === "about" ? original?.blocks.findIndex(block => block.type === "heading" && isYear(block.text)) ?? -1 : -1;
  const historyStop = original?.blocks.findIndex((block, index) => index > historyStart && block.type === "heading" && block.level <= 2 && !isYear(block.text)) ?? -1;
  const historyEnd = historyStop >= 0 ? historyStop : original?.blocks.length ?? 0;
  const milestones = original && historyStart >= 0 ? original.blocks.slice(historyStart, historyEnd).reduce<typeof original.blocks[]>((groups, block) => {
    if (block.type === "heading" && isYear(block.text)) groups.push([]);
    groups[groups.length - 1].push(block);
    return groups;
  }, []) : [];
  const companyPages = c.pages.filter(p => p.slug.startsWith("about") || p.slug === "awards");
  return <div className="company-page">
    <section className={`wrap company-hero${!page.image || leadership ? " company-hero-text" : ""}`}>
      <div>
        {page.slug !== "about" && <Link className="breadcrumb" href="/about">← {c.pages.find(p => p.slug === "about")?.title}</Link>}
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{original?.title || page.title}</h1>
        {(original?.description || page.description) && <p className="company-intro">{original?.description || page.description}</p>}
      </div>
      {page.image && !leadership && <Photo src={page.image} alt={page.imageAlt} eager />}
    </section>
    <div className="wrap company-content">
      {awards ? <AwardsList /> : leadership && original ? <div className="company-leaders">
        {original.blocks.reduce<typeof original.blocks[]>((groups, block) => {
          if (block.type === "heading" && c.team.some(person => person.name === block.text)) groups.push([]);
          if (!groups.length) groups.push([]);
          groups[groups.length - 1].push(block);
          return groups;
        }, []).map((blocks, i) => {
          const person = c.team.find(person => person.name === blocks[0]?.text);
          return <article className="original-copy" key={blocks[0]?.id || i}>
            {person?.image && <Photo src={person.image} alt={person.imageAlt} />}
            <OriginalBlocks blocks={blocks} title={page.title} />
            {person && <p>{person.description}</p>}
          </article>;
        })}
      </div> : original ? <div className="original-copy company-copy">
        {original.blocks.map((block, index) => index === historyStart ? <ol className="company-timeline" key={block.id}>
          {milestones.map(([year, ...blocks]) => <li key={year.id}>
            <div className="company-timeline-year">{year.text}</div>
            <div className="company-timeline-copy"><OriginalBlocks blocks={blocks} title={page.title} /></div>
          </li>)}
        </ol> : historyStart >= 0 && index > historyStart && index < historyEnd ? null : block.type === "heading" && block.text === "Approved By Leading Brands" ?
          <section className="home-brands" key={block.id}>
            <h2>{block.text}</h2>
            <div>{c.brands.map(brand => <span key={brand.name}>{brand.image ? <Photo src={brand.image} alt={brand.imageAlt} /> : brand.name}</span>)}</div>
          </section> : <OriginalBlocks key={block.id} blocks={[block]} title={page.title} />)}
      </div> : <div className="original-copy">{page.body.map((text, i) => <p key={i}>{text}</p>)}</div>}
    </div>
    <nav className="wrap company-navigation" aria-label={c.ui.aboutLinks}>
      <p className="eyebrow">{c.ui.aboutLinks}</p>
      <div>{companyPages.filter(p => p.slug !== page.slug).map(p => <Link href={`/${p.slug}`} key={p.slug}>{p.title}<Arrow /></Link>)}</div>
    </nav>
    <ContactSection />
  </div>;
}
function GenericPage({ page }: { page: ContentPage }) {
  const c = useContent();
  const original = useOriginalPage();
  if (page.slug.startsWith("about") || ["awards", "lalit-mittal", "mohit-mittal"].includes(page.slug)) return <CompanyPage page={page} />;
  if (/^[346]mm-acp-sheet$/.test(page.slug) || ["fire-retardent", "low-density-poly-ethylene", "exterior-facade", "interior-design", "brand-identity"].includes(page.slug)) return <MaterialInfoPage page={page} />;
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
function SitemapPage({ page }: { page: ContentPage }) {
  const c = useContent();
  const groups = new Map<string, { href: string; label: string }[]>([
    ["Explore", []], ["Products & collections", []], ["Applications", []],
    ["Planning tools & partners", []], ["Company", []], ["Our network", []],
    ["Projects", []], ["Resources", []], ["Legal", []],
  ]);
  const labels = new Map<string, string>();
  const categories = new Map<string, string>();
  const register = (route: string, label: string, category: string) => {
    const href = canonicalPath(route);
    labels.set(href, label);
    categories.set(href, category);
  };
  c.pages.forEach(p => {
    const category = p.slug.startsWith("about") || ["awards", "lalit-mittal", "mohit-mittal", "careers"].includes(p.slug) ? "Company"
      : ["privacy", "terms"].includes(p.slug) ? "Legal"
      : ["products", "collections", "3mm-acp-sheet", "4mm-acp-sheet", "6mm-acp-sheet", "fire-retardent", "low-density-poly-ethylene"].includes(p.slug) ? "Products & collections"
      : ["exterior-facade", "interior-design", "brand-identity"].includes(p.slug) ? "Applications"
      : ["visualiser", "product-finder", "samples", "become-a-dealer"].includes(p.slug) ? "Planning tools & partners"
      : p.slug === "resources" ? "Resources" : p.slug === "projects" ? "Projects" : p.slug === "network" ? "Our network" : "Explore";
    register(p.slug, p.title, category);
  });
  c.products.forEach(p => register(`products/${p.slug}`, p.name, "Products & collections"));
  c.projects.forEach(p => register(`projects/${p.slug}`, p.name, "Projects"));
  c.resources.forEach(r => register(`resources/${r.slug}`, r.title, "Resources"));
  c.roles.forEach(r => register(`for/${r.id}`, r.label, "Planning tools & partners"));
  c.blogs.forEach(b => register(`blog/${b.slug}`, b.title, "Resources"));
  c.originalPages.find(p => p.route === "site-map")?.blocks.forEach(block => {
    if (block.type === "link" && block.href && block.href !== "/sitemap.html") labels.set(canonicalPath(block.href.replace(/^\/+|\/+$/g, "")), block.text);
  });
  c.site.nav.forEach(item => {
    (item.children || []).forEach(link => {
      const href = canonicalPath(link.href.replace(/^\/+|\/+$/g, ""));
      labels.set(href, link.label);
      if (item.href === "/network") categories.set(href, "Our network");
    });
  });
  labels.set("/", "Home");
  labels.set("/collections", "Collections");
  labels.set("/blog/", "Blog");
  categories.set("/blog/", "Resources");
  sitemapPaths(c).forEach(href => groups.get(categories.get(href) || "Explore")!.push({ href, label: labels.get(href) || href }));
  return <div className="sitemap-page">
    <Intro page={page} />
    <nav className="wrap sitemap-groups" aria-label="All website pages">
      {[...groups].filter(([, links]) => links.length).map(([title, links]) => <section key={title}>
        <h2>{title}</h2>
        <ul>{links.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
      </section>)}
    </nav>
  </div>;
}
function ContactPage({
  page,
  type,
  product,
  message = "",
}: {
  page: ContentPage;
  type: "contact" | "dealer" | "sample" | "career";
  product?: string;
  message?: string;
}) {
  const c = useContent();
  const original = useOriginalPage();
  if (type === "contact" && original) {
    const messageIndex = original.blocks.findIndex(block => block.text === "Have a Message For Us?");
    const presenceIndex = original.blocks.findIndex(block => block.text === "Our Presence");
    if (messageIndex >= 0 && presenceIndex > messageIndex) return <div className="planning-page contact-page">
      <Intro page={page} />
      <section className="wrap contact-main">
        <div className="original-copy contact-offices">
          {original.blocks.slice(0, messageIndex).map(block => {
            const parts = block.text.split(/(\+91[\d ]{10,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g);
            return block.type === "paragraph" && parts.length > 1 ? <p className="contact-direct" key={block.id}>{parts.map((part, index) => part.startsWith("+91") ? <a key={index} href={`tel:${part.replaceAll(" ", "")}`}>{part.trim()}</a> : part.includes("@") ? <a key={index} href={`mailto:${part}`}>{part}</a> : <span key={index}>{part}</span>)}</p> : <OriginalBlocks key={block.id} blocks={[block]} title={page.title} />;
          })}
          {page.image && <Photo src={page.image} alt={page.imageAlt} />}
        </div>
        <div className="contact-form-area">
          <h2>{original.blocks[messageIndex].text}</h2>
          {original.blocks.slice(messageIndex + 1, presenceIndex).map(block => <p key={block.id}>{block.text}</p>)}
          <EnquiryForm c={c} type="contact" product={product} message={message} />
        </div>
      </section>
      <section className="wrap contact-presence">
        <h2>{original.blocks[presenceIndex].text}</h2>
        <ul>{original.blocks.slice(presenceIndex + 1).map(block => {
          const city = block.text.trim().toLowerCase();
          const destination = c.site.nav.flatMap(item => item.children || []).find(item =>
            item.label.toLowerCase() === city || item.href.replace(/^\/+|\/+$/g, "").toLowerCase() === city,
          );
          return <li key={block.id}>{destination ? <Link href={destination.href}>{block.text}</Link> : block.text}</li>;
        })}</ul>
      </section>
    </div>;
  }
  return (
    <div className={type === "sample" ? "planning-page samples-page" : type === "contact" || type === "career" ? "planning-page company-form-page" : undefined}>
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
        <EnquiryForm c={c} type={type} product={product} message={message} />
      </section>
    </div>
  );
}
export function Website({
  content,
  route,
  preview = false,
  product,
  blogView,
  requestPath,
  catalogueThicknesses,
  journeyRole = "",
  exploreHome = false,
  enquiryProject,
}: {
  content: SiteContent;
  catalogueThicknesses?: Record<string, number[]>;
  journeyRole?: string;
  exploreHome?: boolean;
  enquiryProject?: string;
  route: string;
  preview?: boolean;
  product?: string;
  blogView?: BlogView;
  requestPath?: string;
}) {
  usePageScroll(requestPath || route);
  useInnerMotion(route, content);
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
  else if (!route) body = <Landing exploreHome={exploreHome} />;
  else if (route.startsWith("for/"))
    body = <AudiencePage role={c.roles.find((r) => r.id === route.split("/")[1])!} />;
  else if (route === "products" || route === "collections")
    body = <Products collections={route === "collections"} thicknessByProduct={catalogueThicknesses} />;
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
  else if (route === "site-map") body = <SitemapPage page={p!} />;
  else if (route === "visualiser") body = <Visualiser />;
  else if (route === "product-finder") body = <Quiz />;
  else if (["contact", "become-a-dealer", "samples", "careers"].includes(route))
    body = (
      <ContactPage
        page={p!}
        message={enquiryProject ? `${c.ui.projectEnquiry}: ${c.projects.find(project => project.slug === enquiryProject)?.name || ""}` : ""}
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
    <JourneyRoleContext.Provider value={journeyRole}>
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
          {(route !== "" || exploreHome) && <Footer />}
        </div>
      </OriginalPageContext.Provider>
    </Context.Provider>
    </JourneyRoleContext.Provider>
  );
}
function Visualiser() {
  const c = useContent();
  const original = useOriginalPage();
  const [product, setProduct] = useState(c.products[0].slug);
  const selected = c.products.find((p) => p.slug === product)!;
  return (
    <div className="planning-page visualiser-page">
      <Intro page={c.pages.find((p) => p.slug === "visualiser")!} />
      {original && <div className="original-copy wrap planning-introduction"><OriginalBlocks blocks={original.blocks.slice(0, 2)} title={original.title} /></div>}
      <section className="wrap visualiser-layout section no-top">
        <div>
          {original && <div className="original-copy planning-instructions"><OriginalBlocks blocks={original.blocks.slice(2, 7)} title={original.title} /></div>}
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
                  title={p.name}
                ><span style={{ background: p.finishes[0].hex }} aria-hidden="true" />{p.name}</button>
              ))}
          </div>
          <h3>{selected.name}</h3>
          <p>{c.ui.visualiserNote}</p>
        </div>
        <div className="planning-form-column">
          {original && <div className="original-copy planning-form-title"><OriginalBlocks blocks={original.blocks.slice(7, 8)} title={original.title} /></div>}
          <EnquiryForm c={c} type="visualiser" product={product} />
          {original && <div className="original-copy planning-support"><OriginalBlocks blocks={original.blocks.slice(8)} title={original.title} /></div>}
        </div>
      </section>
    </div>
  );
}
function Quiz() {
  const c = useContent();
  const [step, setStep] = useState(0);
  const [reference, setReference] = useState("");
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
    <div className="planning-page finder-page">
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
        ) : !reference ? (
          <div className="quiz-enquiry">
            <h2>{c.ui.quizLeadTitle}</h2><p>{c.ui.quizLeadDescription}</p>
            <EnquiryForm c={c} type="quiz" product={matches[0]?.slug} message={answers.map(answer => c.ui[answer]).join(" / ")} onSuccess={setReference} />
            <button className="text-link" onClick={() => setStep(2)}>{c.ui.previous}</button>
          </div>
        ) : (
          <>
            <p role="status">{c.ui.success} {reference}</p>
            <SectionHead
              title={c.ui.matches}
              description={c.ui.matchesDescription}
            />
            <div className="product-grid">
              {matches.map((p) => (
                <ProductCard p={p} key={p.slug} />
              ))}
            </div>
            <button className="text-link" onClick={() => { setStep(0); setReference(""); }}>
              {c.ui.restart} ↺
            </button>
          </>
        )}
      </section>
    </div>
  );
}
