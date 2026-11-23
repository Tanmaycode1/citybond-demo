import type { Plane, Vec3 } from "./geometry";

export type WorkerRequest =
  | { type: "analyse"; bitmap: ImageBitmap; preferGpu: boolean }
  | { type: "tap"; id: number; x: number; y: number; mode: TapMode };

/** add = the whole wall under the tap. part = only the surface under the tap. remove = take a surface out. */
export type TapMode = "add" | "part" | "remove";

export type WorkerResponse =
  | { type: "progress"; stage: "download" | "walls" | "depth" | "geometry"; label: string; loaded?: number; total?: number }
  | {
      type: "scene";
      W: number;
      H: number;
      f: number;
      /** Per pixel: 0 = excluded surface, 2 = exterior building. */
      kind: Uint8Array;
      /** Smoothed brightness of the photo, 0..255. */
      shade: Uint8Array;
      shadeW: number;
      shadeH: number;
      /** A suggested exterior façade point, in work pixels. */
      suggestion: [number, number] | null;
      exterior: boolean;
      scaleFromGround: boolean;
      device: "webgpu" | "wasm";
    }
  | { type: "tap-ready" }
  | { type: "tap-unavailable"; message: string }
  /**
   * provisional = a quick outline; a second message with the same id and `refines` follows with the exact outline.
   */
  | { type: "region"; id: number; mode: TapMode; provisional?: boolean; refines?: boolean; mask?: Uint8Array; labels?: Uint8Array; planes?: Plane[]; anchors?: Vec3[]; failed?: string }
  | { type: "error"; message: string; code?: "exterior-required" };
