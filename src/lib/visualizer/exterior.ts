/** Generic ADE20K `wall` includes indoor rooms, so it is deliberately excluded. */
export function isFacadeLabel(label: string) {
  return ["building", "house", "skyscraper"].includes(label);
}

/** Require a visible, confidently detected building before offering a preview.
 * This is a conservative model gate, not a perfect indoor/outdoor classifier.
 * Close crops that the model calls only `wall` need a wider building photo.
 */
export function exteriorMask(probability: Float32Array) {
  const kind = new Uint8Array(probability.length);
  let area = 0;
  for (let i = 0; i < probability.length; i++) {
    if (probability[i] > 0.5) { kind[i] = 2; area++; }
  }
  return { kind, accepted: area >= Math.max(64, probability.length * 0.02) };
}

/** SAM can select arbitrary objects; clip all additive results to the façade. */
export function constrainToFacade(mask: Uint8Array, kind: Uint8Array) {
  for (let i = 0; i < mask.length; i++) if (kind[i] !== 2) mask[i] = 0;
  return mask;
}
