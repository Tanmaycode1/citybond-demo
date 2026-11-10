"use client";
/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/cms/schema";
import type { OriginalPage } from "@/lib/cms/original-copy-schema";
import { homeCopySections, type HomeCopySection } from "@/lib/home-copy";
import { canonicalHref } from "@/lib/routes";
import { OriginalBlocks } from "./OriginalCopy";
import Link from "./SiteLink";

function Copy({ section }: { section: HomeCopySection }) {
  return (
    <div className="home-prose">
      <OriginalBlocks blocks={section.blocks} />
    </div>
  );
}
function Heading({ section }: { section: HomeCopySection }) {
  return section.heading ? <h2>{section.heading.text}</h2> : null;
}
function Action({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <span aria-hidden="true">↗</span>
    </Link>
  );
}

export function HomeContent({
  page,
  content: c,
  materials,
  projects,
}: {
  page: OriginalPage;
  content: SiteContent;
  materials: ReactNode;
  projects: ReactNode;
}) {
  const groups = homeCopySections(page.blocks);
  // Keep the narrative intentional while rendering every editable block once.
  const order = [
    "about",
    "products",
    "benefits",
    "industries",
    "projects",
    "brochure",
    "brands",
    "stories",
    "awards",
    "certifications",
    "extra",
  ];
  const sorted = [...groups].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );
  return (
    <div className="home-editorial" data-original-copy={page.route}>
      {sorted.map((s) => {
        if (s.kind === "about")
          return (
            <section className="home-about wrap" key={s.id}>
              <div className="home-about-image reveal">
                <img
                  src={c.home.aboutImage}
                  alt={c.home.aboutImageAlt}
                  loading="lazy"
                />
                <span className="home-photo-note">{c.ui.stockCaption}</span>
              </div>
              <div className="home-about-copy reveal">
                <p className="eyebrow">{c.site.tagline}</p>
                <Heading section={s} />
                <Copy section={s} />
                <Action href="/about">{c.ui.learn}</Action>
              </div>
              <div className="home-stats">
                {c.home.stats.map((stat) => (
                  <div key={stat.label}>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        if (s.kind === "products")
          return (
            <section className="home-collections" key={s.id}>
              <div className="wrap">
                <div className="home-section-heading reveal">
                  <Heading section={s} />
                  <div className="home-prose">
                    <OriginalBlocks
                      blocks={s.blocks.filter((b) => b.type !== "link")}
                    />
                  </div>
                </div>
                <div className="home-collection-grid">
                  {s.blocks
                    .filter((b) => b.type === "link")
                    .map((b, i) => {
                      const product = c.products.find(
                        (p) => canonicalHref(`/products/${p.slug}`) === b.href,
                      );
                      const match = b.text.match(/^(.+? Series)\s+([\s\S]*)$/);
                      return (
                        <Link
                          className="home-collection reveal"
                          href={b.href || "/products"}
                          key={b.id}
                        >
                          <div className="home-collection-photo">
                            {product?.image && (
                              <img
                                src={product.image}
                                alt={product.imageAlt}
                                loading="lazy"
                              />
                            )}
                            <span aria-hidden="true">0{i + 1} / ↗</span>
                          </div>
                          <div className="home-collection-copy">
                            {match ? (
                              <>
                                <h3>{match[1]}</h3> <p>{match[2]}</p>
                              </>
                            ) : (
                              <h3>{b.text}</h3>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                </div>
              </div>
              {materials}
            </section>
          );
        if (s.kind === "benefits")
          return (
            <section className="home-benefits" id="why-citybond" key={s.id}>
              <div className="wrap">
                <div className="home-section-heading reveal">
                  <Heading section={s} />
                  <div className="home-prose">
                    <OriginalBlocks blocks={s.blocks.slice(0, 1)} />
                  </div>
                </div>
                <div className="home-benefit-grid">
                  {s.blocks.slice(1).map((b, i) => (
                    <div className="home-benefit reveal" key={b.id}>
                      <span aria-hidden="true">0{i + 1}</span>
                      <OriginalBlocks blocks={[b]} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        if (s.kind === "industries")
          return (
            <section className="home-industries wrap" id="industries" key={s.id}>
              <div className="home-industry-copy reveal">
                <Heading section={s} />
                <div className="home-prose">
                  <OriginalBlocks blocks={s.blocks.slice(0, 1)} />
                </div>
                <div className="home-industry-list">
                  {s.blocks.slice(1).map((b, i) => (
                    <div key={b.id}>
                      <span aria-hidden="true">0{i + 1}</span>
                      <OriginalBlocks blocks={[b]} />
                      <span aria-hidden="true">↗</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="home-industry-image reveal">
                <img src={c.home.image} alt={c.home.imageAlt} loading="lazy" />
                <span className="home-photo-note">{c.ui.stockCaption}</span>
              </div>
            </section>
          );
        if (s.kind === "projects")
          return (
            <section className="home-projects" key={s.id}>
              <div className="wrap home-section-heading reveal">
                <Heading section={s} />
                <Copy section={s} />
              </div>
              {projects}
            </section>
          );
        if (s.kind === "brochure")
          return (
            <section className="home-brochure wrap reveal" key={s.id}>
              <Heading section={s} />
              <Copy section={s} />
              <Link
                href="/catalogue-download"
                className="home-round-link"
                aria-label={s.heading?.text || c.ui.resources}
              >
                <span aria-hidden="true">↗</span>
              </Link>
            </section>
          );
        if (s.kind === "brands")
          return (
            <section className="home-brands wrap reveal" key={s.id}>
              <Heading section={s} />
              <Copy section={s} />
              <div>
                {c.brands.map((b) => (
                  <span key={b.name}>
                    {b.image ? (
                      <img src={b.image} alt={b.imageAlt} loading="lazy" />
                    ) : (
                      b.name
                    )}
                  </span>
                ))}
              </div>
            </section>
          );
        if (s.kind === "stories")
          return (
            <section className="home-stories wrap" key={s.id}>
              <div className="reveal">
                <Heading section={s} />
              </div>
              <div className="home-quote-grid">
                {Array.from(
                  { length: Math.ceil(s.blocks.length / 2) },
                  (_, i) => (
                    <blockquote className="reveal" key={s.blocks[i * 2].id}>
                      <span className="home-quote-mark" aria-hidden="true">
                        “
                      </span>
                      <OriginalBlocks
                        blocks={s.blocks.slice(i * 2, i * 2 + 1)}
                      />
                      <footer>
                        <OriginalBlocks
                          blocks={s.blocks.slice(i * 2 + 1, i * 2 + 2)}
                        />
                      </footer>
                    </blockquote>
                  ),
                )}
              </div>
            </section>
          );
        if (s.kind === "awards")
          return (
            <section className="home-awards wrap reveal" key={s.id}>
              <Heading section={s} />
              <Copy section={s} />
              <Action href="/awards">{c.ui.viewAll}</Action>
            </section>
          );
        if (s.kind === "certifications")
          return (
            <section className="home-certifications wrap reveal" key={s.id}>
              <Heading section={s} />
              <Copy section={s} />
              <Action href="/infrastructure">
                {c.pages.find((p) => p.slug === "about/infrastructure")
                  ?.title || c.ui.viewAll}
              </Action>
            </section>
          );
        return (
          <section className="home-extra wrap reveal" key={s.id}>
            <Heading section={s} />
            <Copy section={s} />
          </section>
        );
      })}
    </div>
  );
}
