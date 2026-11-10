import { z } from "zod";
const copyText = z.string().max(30000);
export const originalBlockSchema = z.object({
  id: z.string().max(100),
  type: z.enum(["heading", "paragraph", "list", "table", "link"]),
  level: z.number().int().min(1).max(6).default(2),
  text: copyText.default(""),
  ordered: z.boolean().default(false),
  items: z.array(copyText).max(300).default([]),
  rows: z.array(z.array(copyText).max(30)).max(300).default([]),
  headerRows: z.number().int().min(0).max(10).default(0),
  href: z
    .string()
    .max(2000)
    .refine(
      (v) =>
        !v ||
        (/^\/(?!\/)/.test(v) && !/[\\\x00-\x20]/.test(v)) ||
        /^https:\/\/[^\s]+$/.test(v) ||
        /^mailto:[^\s]+$/.test(v) ||
        /^tel:\+?[\d ()-]+$/.test(v) ||
        /^#[a-zA-Z0-9_-]+$/.test(v),
      "Use a safe website, email, phone or section link.",
    )
    .default(""),
});
export const originalPageSchema = z.object({
  route: z.string().max(220),
  title: z.string().max(1000),
  description: copyText,
  metaTitle: z.string().max(1000),
  metaDescription: copyText,
  sourceUrl: z.url(),
  importedAt: z.string(),
  blocks: z.array(originalBlockSchema).max(500),
});
export type OriginalPage = z.infer<typeof originalPageSchema>;
export type OriginalBlock = z.infer<typeof originalBlockSchema>;
