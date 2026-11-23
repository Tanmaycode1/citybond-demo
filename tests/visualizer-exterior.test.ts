import { test } from "node:test";
import assert from "node:assert/strict";
import { isFacadeLabel, exteriorMask, constrainToFacade } from "../src/lib/visualizer/exterior";

test("interior walls and non-building surfaces are not facade labels", () => {
  for (const label of ["wall", "ceiling", "floor", "sky", "tree", "windowpane", "door", "sofa"]) assert.equal(isFacadeLabel(label), false);
  for (const label of ["building", "house", "skyscraper"]) assert.equal(isFacadeLabel(label), true);
});
test("reject an interior/no-building image and small uncertain building detections", () => {
  assert.equal(exteriorMask(new Float32Array(10000).fill(0.1)).accepted, false);
  const probabilities = new Float32Array(10000).fill(0.1);
  probabilities.fill(0.9, 0, 100);
  assert.equal(exteriorMask(probabilities).accepted, false);
  probabilities.fill(0.9, 0, 3000);
  const result = exteriorMask(probabilities);
  assert.equal(result.accepted, true);
  assert.equal(result.kind[0], 2);
  assert.equal(result.kind[4000], 0);
});
test("add-part masks cannot cover excluded sky, interiors or landscaping", () => {
  assert.deepEqual(constrainToFacade(new Uint8Array([1,1,1,1,1]), new Uint8Array([0,2,0,1,2])), new Uint8Array([0,1,0,0,1]));
});
