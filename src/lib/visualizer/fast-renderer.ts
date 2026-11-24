import type { FastMaterial, Point, Quad } from "./fast-types";

export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export type Surface = { id: string; quad: Quad; enabled: boolean };
export type PreparedPhoto = { original: Raster; labels: Uint8Array; building: Uint8Array; shade: Float32Array; surfaces: Surface[] };
export type RenderOptions = { scale: number; joints: boolean; turned: boolean; split: number; mask: boolean };
const linear = Float32Array.from({ length: 256 }, (_, i) => i / 255 <= 0.04045 ? i / 3294.6 : Math.pow((i / 255 + 0.055) / 1.055, 2.4));
const srgb = Uint8ClampedArray.from({ length: 4097 }, (_, i) => {
  const v = i / 4096; return (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255;
});
export const rectangle = (left: number, top: number, width: number, height: number): Quad => [
  { x: left, y: top }, { x: left + width, y: top }, { x: left + width, y: top + height }, { x: left, y: top + height },
];

/** Pixel -> unit-square homography. Four optional user anchors calibrate perspective without a depth model. */
export function quadTransform(quad: Quad): number[] | null {
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = quad[i]; const u = i === 1 || i === 2 ? 1 : 0; const v = i >= 2 ? 1 : 0;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[p][c])) p = r;
    if (Math.abs(rows[p][c]) < 1e-8) return null;
    [rows[c], rows[p]] = [rows[p], rows[c]];
    const divisor = rows[c][c]; for (let j = c; j <= 8; j++) rows[c][j] /= divisor;
    for (let r = 0; r < 8; r++) if (r !== c) { const factor = rows[r][c]; for (let j = c; j <= 8; j++) rows[r][j] -= factor * rows[c][j]; }
  }
  return rows.map(r => r[8]);
}
export function project(h: number[], p: Point) {
  const d = h[6] * p.x + h[7] * p.y + 1;
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / d, y: (h[3] * p.x + h[4] * p.y + h[5]) / d };
}
export function validQuad(q: Quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 2 || (sign && Math.sign(cross) !== sign)) return false;
    sign = Math.sign(cross);
  }
  return sign > 0 && quadTransform(q) !== null;
}

/** Shared highlight reference keeps shadows and relative illumination across wall faces. */
export function prepareShade(photo: Raster, labels: Uint8Array) {
  const shade = new Float32Array(labels.length); const histogram = new Uint32Array(256); let total = 0;
  for (let i = 0; i < labels.length; i++) {
    const p = i * 4;
    shade[i] = 0.2126 * linear[photo.data[p]] + 0.7152 * linear[photo.data[p + 1]] + 0.0722 * linear[photo.data[p + 2]];
    if (labels[i]) { histogram[Math.round(Math.min(1, shade[i]) * 255)]++; total++; }
  }
  let sum = 0, reference = 0.8;
  for (let i = 0; i < 256; i++) { sum += histogram[i]; if (total && sum >= total * 0.9) { reference = Math.max(0.08, i / 255); break; } }
  for (let i = 0; i < shade.length; i++) shade[i] = Math.max(0.08, Math.min(1.4, shade[i] / reference));
  return shade;
}

export function paintMask(labels: Uint8Array, building: Uint8Array, width: number, height: number, point: Point, radius: number, region: number, erase: boolean) {
  for (let y = Math.max(0, Math.floor(point.y - radius)); y <= Math.min(height - 1, point.y + radius); y++)
    for (let x = Math.max(0, Math.floor(point.x - radius)); x <= Math.min(width - 1, point.x + radius); x++) {
      if ((x - point.x) ** 2 + (y - point.y) ** 2 > radius * radius) continue;
      const i = y * width + x;
      if (erase) labels[i] = 0; else if (building[i]) labels[i] = region;
    }
}

/** No generative model, depth download, or WebGL requirement. Unselected pixels are copied byte-for-byte. */
export function renderMaterial(photo: PreparedPhoto, material: FastMaterial, texture: Raster | null, options: RenderOptions): Raster {
  const { width, height } = photo.original; const output = new Uint8ClampedArray(photo.original.data);
  const color = [0, 2, 4].map(i => parseInt(material.hex.replace("#", "").slice(i, i + 2), 16) || 0);
  const maps = photo.surfaces.map(s => ({ h: quadTransform(s.quad), enabled: s.enabled,
    w: Math.hypot(s.quad[1].x - s.quad[0].x, s.quad[1].y - s.quad[0].y),
    hgt: Math.hypot(s.quad[3].x - s.quad[0].x, s.quad[3].y - s.quad[0].y) }));
  const sheetWidth = height / 4 * 1.22 * options.scale;
  for (let y = 0; y < height; y++) for (let x = Math.ceil(width * options.split); x < width; x++) {
    const i = y * width + x; const label = photo.labels[i]; const m = maps[label - 1];
    if (!label || !m?.enabled || !m.h) continue;
    const p = i * 4;
    if (options.mask) { output[p] = output[p] * .55; output[p + 1] = output[p + 1] * .55 + 210 * .45; output[p + 2] = output[p + 2] * .55 + 150 * .45; continue; }
    const h = m.h, d = h[6] * x + h[7] * y + 1;
    let u = ((h[0] * x + h[1] * y + h[2]) / d) * m.w / sheetWidth;
    let v = ((h[3] * x + h[4] * y + h[5]) / d) * m.hgt / (sheetWidth * 2);
    if (options.turned) [u, v] = [v, -u];
    u -= Math.floor(u); v -= Math.floor(v);
    const groove = options.joints && (Math.min(u, 1 - u) * sheetWidth < .65 || Math.min(v, 1 - v) * sheetWidth * 2 < .65) ? .72 : 1;
    const texel = texture ? (Math.min(texture.height - 1, Math.floor(v * texture.height)) * texture.width + Math.min(texture.width - 1, Math.floor(u * texture.width))) * 4 : 0;
    for (let c = 0; c < 3; c++) {
      const sample = texture ? texture.data[texel + c] : color[c];
      const value = Math.max(0, Math.min(1, linear[sample] * photo.shade[i] * groove));
      output[p + c] = srgb[Math.round(value * 4096)];
    }
  }
  return { width, height, data: output };
}
