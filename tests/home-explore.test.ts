import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { scrollToSection } from "../src/lib/scroll-to-section";
import { Website } from "../src/components/site/Website";
import { validateContent } from "../src/lib/cms/schema";
import seed from "../src/data/site.json";

function browser(t: TestContext, reduced = false, start = 120) {
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const events = new EventTarget();
  const mediaEvents = new EventTarget();
  const positions: number[] = [];
  const focus: FocusOptions[] = [];
  const media = {
    matches: reduced,
    addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
    removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
  };
  const win = {
    scrollY: start,
    innerHeight: 800,
    matchMedia: () => media,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    scrollTo: ({ top }: ScrollToOptions) => { positions.push(top!); win.scrollY = top!; },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  const target = {
    getBoundingClientRect: () => ({ top: 1080 - win.scrollY }),
    focus: (options: FocusOptions) => focus.push(options),
  } as unknown as HTMLElement;
  const doc = { documentElement: { scrollHeight: 5000 }, querySelector: () => ({ getBoundingClientRect: () => ({ height: 80 }) }) };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  });
  const frame = (time: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(time));
  };
  return { win, doc, target, positions, focus, frames, frame, events, mediaEvents, media };
}

test("Explore starts without a jump, eases continuously, and lands below the header", t => {
  const b = browser(t);
  scrollToSection(b.target);
  assert.deepEqual(b.positions, [], "No scrolling before the first animation frame");
  b.frame(0);
  assert.equal(b.positions[0], 120);
  for (let time = 16; time <= 1504; time += 16) b.frame(time);
  assert.equal(b.positions.at(-1), 1000);
  const steps = b.positions.slice(1).map((position, index) => position - b.positions[index]);
  assert.ok(steps.every(step => step >= 0 && step < 30), "No skipped frames or abrupt jumps");
  assert.ok(steps[0] < 1 && steps.at(-1)! < 1, "Gentle takeoff and landing");
  assert.deepEqual(b.focus, [{ preventScroll: true }]);
  assert.equal(b.frames.size, 0);
});

test("manual scrolling and keyboard navigation cancel without stealing focus", t => {
  const b = browser(t);
  for (const event of ["wheel", "touchstart", "pointerdown", "resize", "keydown"]) {
    scrollToSection(b.target);
    b.frame(0);
    b.frame(200);
    const input = new Event(event);
    if (event === "keydown") Object.defineProperty(input, "key", { value: "Tab" });
    b.events.dispatchEvent(input);
    const before = b.positions.length;
    b.frame(1800);
    assert.equal(b.positions.length, before, event);
    assert.equal(b.frames.size, 0, event);
  }
  assert.equal(b.focus.length, 0);
});

test("repeated activation cancels the old motion and resumes from the current position", t => {
  const b = browser(t);
  const cancel = scrollToSection(b.target);
  b.frame(0);
  b.frame(400);
  cancel();
  const current = b.win.scrollY;
  const stop = scrollToSection(b.target);
  b.frame(500);
  assert.equal(b.positions.at(-1), current);
  assert.equal(b.frames.size, 1);
  stop();
  assert.equal(b.frames.size, 0, "Unmount cleanup stops pending frames");
});

test("reduced motion skips animation and transfers focus without extra scrolling", t => {
  const b = browser(t, true);
  scrollToSection(b.target);
  assert.deepEqual(b.positions, [1000]);
  assert.deepEqual(b.focus, [{ preventScroll: true }]);
  assert.equal(b.frames.size, 0);
});

test("enabling reduced motion during a transition finishes immediately", t => {
  const b = browser(t);
  scrollToSection(b.target);
  b.frame(0);
  b.frame(200);
  b.media.matches = true;
  b.mediaEvents.dispatchEvent(new Event("change"));
  assert.equal(b.positions.at(-1), 1000);
  assert.equal(b.frames.size, 0);
});

test("short pages clamp the landing point to the available document height", t => {
  const b = browser(t, true);
  b.doc.documentElement.scrollHeight = 1200;
  scrollToSection(b.target);
  assert.deepEqual(b.positions, [400]);
});

for (const expanded of [false, true]) {
  test(`homepage Explore uses an accessible in-page control (expanded: ${expanded})`, () => {
    const content = validateContent(seed);
    content.originalPages = content.originalPages.filter(page => page.route === "");
    content.ui.exploreCitybond = "Discover our surfaces";
    const html = renderToStaticMarkup(createElement(Website, { content, route: "", exploreHome: expanded }));
    assert.match(html, new RegExp(`<button type="button" class="home-explore-action" aria-expanded="${expanded}" aria-controls="home-discovery">Discover our surfaces`));
    assert.ok(!html.includes('href="/?explore=1#material-story"'), "Explore must not trigger a route change");
    assert.ok(html.includes(`<div class="home-discovery" id="home-discovery"${expanded ? "" : ' hidden=""'}>`));
    assert.ok(html.includes('id="material-story" tabindex="-1"'), "Destination supports keyboard focus");
    assert.equal(html.includes('<footer class="artistic-footer">'), expanded, "Legacy explore links still include the footer");
  });
}
