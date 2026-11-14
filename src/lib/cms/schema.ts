import { z } from "zod";
import seed from "@/data/site.json";
import { originalPageSchema } from "./original-copy-schema";
const text = z.string().max(12000);
const short = z.string().max(300);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
export const safeUrl = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !v ||
      (v.startsWith("/") && !v.startsWith("//") && !/[\\\x00-\x20]/.test(v)) ||
      /^https:\/\/[^\s]+$/.test(v) ||
      /^mailto:[^\s@]+@[^\s@]+$/.test(v) ||
      /^tel:\+?[\d ()-]+$/.test(v),
    "Use a relative path, HTTPS URL, email or phone link.",
  );
const image = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !v ||
      /^\/(?:citybond|images|stock|api\/media)\/[a-zA-Z0-9_./%-]+$/.test(v) ||
      /^https:\/\/[^\s]+$/.test(v),
    "Use an uploaded image or an HTTPS image URL.",
  );
const link = z.object({ label: short, href: safeUrl });
const navLink = link.extend({
  children: z
    .array(link.extend({ group: short.default("") }))
    .max(100)
    .default([]),
});
const stat = z.object({ value: short, label: short });
const block = z.object({ title: short, text, image, imageAlt: short });
export const blogSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(220),
  title: short.min(1),
  description: text,
  image,
  imageAlt: short,
  author: short.min(1),
  authorSlug: slug,
  category: short.min(1),
  categorySlug: slug,
  publishedAt: z.iso.date(),
  status: z.enum(["draft", "published"]),
  example: z.boolean(),
  body: z.array(block).min(1).max(80),
});
export const productSchema = z.object({
  slug,
  name: short,
  category: short,
  collection: short,
  description: text,
  image,
  imageAlt: short,
  body: z.array(text).max(20),
  applications: z.array(short).max(20),
  segments: z.array(z.enum(["residential", "commercial"])).min(1),
  specs: z.array(z.object({ label: short, value: text })).max(30),
  finishes: z
    .array(
      z.object({
        name: short,
        image,
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(60),
  source: safeUrl,
});
export const pageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/),
  eyebrow: short,
  title: short,
  accent: short,
  description: text,
  image,
  imageAlt: short,
  body: z.array(text).max(20),
  blocks: z.array(block).max(30),
  cta: link,
  source: safeUrl,
});
export const contentSchema = z.object({
  schemaVersion: z.literal(1),
  routeRevision: z.literal(2).default(2),
  originalPages: z.array(originalPageSchema).max(150).default([]),
  site: z.object({
    name: short,
    tagline: short,
    logo: image,
    footerLogo: image.default("/citybond/brand-lockup.svg"),
    headerStyle: z.enum(["white", "tinted"]).default("tinted"),
    phone: short,
    email: short,
    address: text,
    footer: text,
    nav: z.array(navLink).min(1).max(12),
    footerLinks: z.array(link.extend({ group: short.default("Explore") })).max(20),
    social: z.array(link).max(10),
  }),
  ui: z.record(z.string(), text),
  blog: z
    .object({
      title: short,
      description: text,
      postsPerPage: z.number().int().min(1).max(24),
      emptyTitle: short,
      emptyDescription: text,
    })
    .default({
      title: "Ideas, materials & perspectives.",
      description: "Explore the details behind architectural surfaces.",
      postsPerPage: 6,
      emptyTitle: "More stories to come.",
      emptyDescription:
        "There are no published articles in this archive yet. Explore the latest stories or return soon.",
    }),
  blogs: z.array(blogSchema).max(500).default([]),
  home: z.object({
    eyebrow: short,
    title: short,
    accent: short,
    description: text,
    image,
    imageAlt: short,
    rolePrompt: short,
    roleDescription: text,
    scrollEyebrow: short,
    scrollTitle: short,
    scrollAccent: short,
    scrollImage: image,
    scrollImageAlt: short,
    chapters: z.array(z.object({ title: short, text })).length(3),
    stats: z.array(stat).max(6),
    productsTitle: short,
    productsDescription: text,
    projectsTitle: short,
    projectsDescription: text,
    aboutTitle: short,
    aboutDescription: text,
    aboutImage: image,
    aboutImageAlt: short,
    contactTitle: short,
    contactDescription: text,
  }),
  roles: z
    .array(
      z.object({
        id: slug,
        label: short,
        hint: short,
        title: short,
        accent: short,
        description: text,
        image,
        imageAlt: short,
        cta: link,
        secondaryCta: link.optional(),
        projectCategories: z.array(short).max(20).default([]),
        sections: z
          .array(
            z.enum([
              "network",
              "projects",
              "products",
              "visualiser",
              "resources",
              "about",
              "contact",
              "collections",
              "technical",
              "brands",
              "testimonials",
              "quiz",
              "metacity",
              "dealer-enquiry",
            ]),
          )
          .max(16),
      }),
    )
    .min(1)
    .max(12),
  products: z.array(productSchema).min(1).max(100),
  projects: z
    .array(
      z.object({
        slug,
        name: short,
        location: short,
        category: short,
        description: text,
        image,
        imageAlt: short,
        products: z.array(slug).max(20),
        source: safeUrl,
      }),
    )
    .max(100),
  pages: z.array(pageSchema).min(1).max(150),
  resources: z
    .array(
      z.object({
        slug,
        title: short,
        type: z.enum(["catalogue", "magazine", "article", "report", "podcast"]),
        description: text,
        image,
        imageAlt: short,
        body: z.array(text).max(30),
        href: safeUrl,
        source: safeUrl,
      }),
    )
    .max(100),
  team: z
    .array(
      z.object({
        name: short,
        role: short,
        description: text,
        image,
        imageAlt: short,
      }),
    )
    .max(20),
  offices: z
    .array(
      z.object({
        state: short,
        city: short,
        address: text,
        phone: short,
        email: short,
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .max(100),
  testimonials: z
    .array(
      z.object({
        quote: text,
        name: short,
        company: short,
        image,
        imageAlt: short,
        source: safeUrl,
      }),
    )
    .max(30),
  brands: z.array(z.object({ name: short, image, imageAlt: short })).max(50),
});
export type SiteContent = z.infer<typeof contentSchema>;
export type Product = z.infer<typeof productSchema>;
export type ContentPage = z.infer<typeof pageSchema>;
export type BlogPost = z.infer<typeof blogSchema>;
export function validateContent(input: unknown) {
  const raw =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const c = contentSchema.parse({
    ...raw,
    ...(raw.routeRevision !== 2
      ? {
          pages: Array.isArray(raw.pages)
            ? [
                ...raw.pages,
                ...seed.pages.filter(
                  (p) =>
                    !raw.pages ||
                    !(raw.pages as { slug: string }[]).some(
                      (old) => old.slug === p.slug,
                    ),
                ),
              ]
            : raw.pages,
          blog: raw.blog ?? seed.blog,
          blogs: raw.blogs ?? seed.blogs,
          site:
            raw.site && typeof raw.site === "object"
              ? { ...raw.site, nav: seed.site.nav }
              : raw.site,
        }
      : {}),
    ui: { ...seed.ui, ...(raw.ui && typeof raw.ui === "object" ? raw.ui : {}) },
  });
  const requiredPages = seed.pages.map((p) => p.slug);
  if (
    new Set(c.originalPages.map((p) => p.route)).size !== c.originalPages.length
  )
    throw new Error("Duplicate original page routes.");
  for (const slug of requiredPages)
    if (!c.pages.some((p) => p.slug === slug))
      throw new Error(`Required page missing: ${slug}`);
  for (const key of Object.keys(seed.ui))
    if (!(key in c.ui))
      throw new Error(`Required interface text missing: ${key}`);
  for (const p of c.pages)
    if (
      /^(?:api|studio-7c9e|for|blog|version)(?:\/|$)/.test(p.slug) ||
      /^(?:products|projects|resources)\//.test(p.slug)
    )
      throw new Error(`Reserved page path: ${p.slug}`);

  for (const name of [
    "products",
    "projects",
    "pages",
    "resources",
    "roles",
    "blogs",
  ] as const) {
    const ids = c[name].map((item) => ("slug" in item ? item.slug : item.id));
    if (new Set(ids).size !== ids.length)
      throw new Error(`Duplicate identifiers in ${name}.`);
  }
  for (const p of c.blogs)
    if (
      ["page", "author", "category", "web-stories", "feed", "2023"].includes(
        p.slug,
      )
    )
      throw new Error(`Reserved blog slug: ${p.slug}`);
  const valid = new Set(c.products.map((p) => p.slug));
  for (const p of c.projects)
    if (p.products.some((id) => !valid.has(id)))
      throw new Error(`Unknown product in project ${p.name}.`);
  return c;
}
export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d ()-]{7,25}$/),
  city: z.string().trim().min(2).max(160),
  role: z.string().max(120),
  type: z.enum(["contact", "dealer", "sample", "visualiser", "career", "quiz"]),
  product: z.string().max(200).default(""),
  message: z.string().max(4000).default(""),
  consent: z.literal(true),
  website: z.string().max(200).default(""),
});
