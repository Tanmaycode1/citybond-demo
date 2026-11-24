export type WallRegion = { id: string; left: number; top: number; width: number; height: number; png: string };
export type FastScene = { width: number; height: number; regions: WallRegion[]; building: string; segmentationMs: number; cached: boolean; model: string };
export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export type FastMaterial = { id: string; name: string; finish: string; texture: string; hex: string };

/** CMS finish images are product swatches, unlike the lifestyle product hero. */
export function fastMaterials(products: { slug: string; name: string; finishes: { name: string; image: string; hex: string }[] }[]): FastMaterial[] {
  return products.filter(p => !/mirror|3d-panel/.test(p.slug)).flatMap(p => p.finishes.map((f, i) => ({
    id: `${p.slug}:${i}`, name: p.name, finish: f.name, texture: f.image, hex: f.hex,
  })));
}
