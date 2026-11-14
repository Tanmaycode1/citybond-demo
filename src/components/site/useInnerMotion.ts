"use client";

import { useEffect } from "react";
import type { SiteContent } from "@/lib/cms/schema";

// Animate individual landmarks, rather than whole forms or long sections.
const landmarks = [
  ".company-hero > img",
  ".network-statistics > div",
  ".product-detail-image",
  ".product-specifications-heading",
  ".resource-hero > img",
  ".all-resources .resource-card",
  ".audience-hero > img",
  ".contact-offices > img",
].join(", ");

export function useInnerMotion(route: string, content: SiteContent) {
  useEffect(() => {
    if (route !== "about") return;
    const timeline = document.querySelector<HTMLElement>(".company-timeline");
    if (!timeline) return;
    const rows = Array.from(timeline.querySelectorAll<HTMLElement>(":scope > li"));
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (preference.matches) return;
      const readingLine = innerHeight * .65;
      // Read layout together before writing styles; the native scroll remains untouched.
      const progress = rows.map(row => {
        const rect = row.getBoundingClientRect();
        return Math.max(0, Math.min(1, (readingLine - rect.top - 16) / Math.max(1, rect.height)));
      });
      timeline.classList.add("timeline-scroll-active");
      rows.forEach((row, index) => {
        row.style.setProperty("--timeline-progress", String(progress[index]));
        row.classList.toggle("timeline-reached", progress[index] > 0);
      });
    };
    const schedule = () => {
      if (!frame && !preference.matches) frame = requestAnimationFrame(update);
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      timeline.classList.remove("timeline-scroll-active");
      rows.forEach(row => {
        row.style.removeProperty("--timeline-progress");
        row.classList.remove("timeline-reached");
      });
    };
    const onPreference = () => preference.matches ? reset() : schedule();
    const resize = new ResizeObserver(schedule);
    resize.observe(timeline);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    preference.addEventListener("change", onPreference);
    schedule();
    return () => {
      reset();
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      preference.removeEventListener("change", onPreference);
    };
  }, [route, content]);

  useEffect(() => {
    if (!route || !("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const play = (element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = element.animate(frames, options);
      animations.add(animation);
      animation.onfinish = () => animations.delete(animation);
    };
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
        observer.unobserve(entry.target);
        if (preference.matches) return;
        // Content is visible before, during, and after the enhancement.
        play(entry.target,
          [{ opacity: .8, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 420, delay: Math.min(index * 45, 135), easing: "cubic-bezier(.22, 1, .36, 1)" },
        );
      });
    }, { threshold: .12 });
    const stopMotion = () => {
      if (!preference.matches) return;
      animations.forEach(animation => animation.cancel());
      animations.clear();
    };
    document.querySelectorAll(`.site-shell :is(${landmarks})`).forEach(element => observer.observe(element));
    preference.addEventListener("change", stopMotion);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", stopMotion);
      animations.forEach(animation => animation.cancel());
    };
  }, [route, content]);
}
