import { test } from "node:test";
import assert from "node:assert/strict";
import { navigationTarget, storyProgress } from "../src/lib/navigation";
test("page navigation discards the source hash and specifies the new page top", () => {
  assert.deepEqual(
    navigationTarget("/products", "https://example.test/#material-story"),
    { pathname: "/products", hash: "", samePage: false },
  );
  assert.deepEqual(
    navigationTarget("/about", "https://example.test/products"),
    { pathname: "/about", hash: "", samePage: false },
  );
});
test("same-page and cross-page anchors preserve their intentional destinations", () => {
  assert.deepEqual(
    navigationTarget("#material-story", "https://example.test/"),
    { pathname: "/", hash: "#material-story", samePage: true },
  );
  assert.deepEqual(
    navigationTarget("/#perspective", "https://example.test/for/architect"),
    { pathname: "/", hash: "#perspective", samePage: false },
  );
  assert.equal(
    navigationTarget("https://citybond.in/", "https://example.test/"),
    null,
  );
  assert.equal(
    navigationTarget("mailto:info@citybond.in", "https://example.test/"),
    null,
  );
});
test("story progress uses the sticky header offset and clamps at both ends", () => {
  assert.deepEqual(storyProgress(800, 1800, 800), {
    progress: 0,
    assembly: 0,
    chapter: 0,
  });
  assert.deepEqual(storyProgress(-1200, 1800, 800), {
    progress: 1,
    assembly: 1,
    chapter: 2,
  });
  assert.equal(storyProgress(80, 1800, 800).progress, 0);
  assert.ok(Number.isFinite(storyProgress(-100, 500, 800).assembly));
});
test("assembly progresses continuously and monotonically into the final composed image", () => {
  let last = 0;
  for (let top = 80; top >= -1000; top -= 5) {
    const result = storyProgress(top, 1800, 800);
    assert.ok(result.assembly >= last);
    assert.ok(result.assembly >= 0 && result.assembly <= 1);
    last = result.assembly;
  }
  assert.equal(last, 1);
  const a = storyProgress(-400, 1800, 800).assembly;
  const b = storyProgress(-401, 1800, 800).assembly;
  assert.ok(b - a < 0.01);
});
