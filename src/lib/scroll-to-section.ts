/** A deliberate, interruptible transition for the homepage's Explore action. */
export function scrollToSection(target: HTMLElement) {
  const from = window.scrollY;
  const header = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
  const to = Math.max(0, Math.min(
    from + target.getBoundingClientRect().top - header,
    document.documentElement.scrollHeight - window.innerHeight,
  ));
  const distance = to - from;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let started: number | undefined;
  const duration = Math.min(1400, 900 + Math.abs(distance) * 0.25);
  const stop = () => {
    window.cancelAnimationFrame(frame);
    for (const event of ["wheel", "touchstart", "pointerdown", "resize"])
      window.removeEventListener(event, stop);
    window.removeEventListener("keydown", onKey);
    motion.removeEventListener("change", onMotionChange);
  };
  const finish = () => {
    stop();
    window.scrollTo({ top: to, behavior: "instant" });
    target.focus({ preventScroll: true });
  };
  const onKey = (event: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Escape", "Tab"].includes(event.key)) stop();
  };
  const onMotionChange = () => { if (motion.matches) finish(); };
  if (motion.matches || Math.abs(distance) < 1) {
    finish();
    return stop;
  }
  const tick = (time: number) => {
    started ??= time;
    const progress = Math.min(1, (time - started) / duration);
    // Smootherstep starts and lands with zero velocity and acceleration.
    const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
    window.scrollTo({ top: from + distance * eased, behavior: "instant" });
    if (progress < 1) frame = window.requestAnimationFrame(tick);
    else finish();
  };
  for (const event of ["wheel", "touchstart", "pointerdown", "resize"])
    window.addEventListener(event, stop, { passive: true });
  window.addEventListener("keydown", onKey);
  motion.addEventListener("change", onMotionChange);
  frame = window.requestAnimationFrame(tick);
  return stop;
}
