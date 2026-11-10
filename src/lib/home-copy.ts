import type { OriginalBlock } from "./cms/original-copy-schema";

// Bind layout to stable CMS IDs, never to editable heading text or array offsets.
const sections: Record<string, string> = {
  "original-0001": "about",
  "original-0003": "products",
  "original-0008": "certifications",
  "original-0009": "brochure",
  "original-0011": "benefits",
  "original-0016": "industries",
  "original-0024": "brands",
  "original-0025": "stories",
  "original-0030": "awards",
  "original-0032": "projects",
};
export type HomeCopySection = {
  id: string;
  kind: string;
  heading?: OriginalBlock;
  blocks: OriginalBlock[];
};
export function homeCopySections(blocks: OriginalBlock[]): HomeCopySection[] {
  const result: HomeCopySection[] = [];
  for (const block of blocks) {
    if (block.type === "heading" || !result.length) {
      result.push({
        id: block.id,
        kind: sections[block.id] || "extra",
        heading: block.type === "heading" ? block : undefined,
        blocks: block.type === "heading" ? [] : [block],
      });
    } else result[result.length - 1].blocks.push(block);
  }
  return result;
}
