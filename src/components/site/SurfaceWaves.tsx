"use client";
import { useEffect, useRef, useState } from "react";

/** Decorative contour lines. Only animate while their section is on screen. */
export function SurfaceWaves() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "40px" });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`surface-waves${visible ? " is-visible" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 1000 440" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
      {[0, 1].map(group => <g key={group} className={`surface-wave surface-wave-${group}`}>
        {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M -180 ${120 + i * 16} C 140 ${-130 + i * 20}, 310 ${490 - i * 6}, 610 ${230 + i * 12} S 1030 ${-40 + i * 21}, 1200 ${140 + i * 15}`} />)}
      </g>)}
    </svg>
  </div>;
}
