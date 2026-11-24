"use client";

import { useEffect, useRef, useState } from "react";
import { scrollToSection } from "@/lib/scroll-to-section";

function startScroll() {
  const target = document.getElementById("material-story");
  return target ? scrollToSection(target) : () => {};
}

export function useHomeExplore(initialExpanded: boolean) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const requested = useRef(false);
  const cancel = useRef<() => void>(() => {});

  useEffect(() => {
    if (expanded && requested.current) {
      requested.current = false;
      // The content and footer are now laid out; measure the destination only
      // after React has revealed them, without a route change or hero remount.
      cancel.current = startScroll();
    }
  }, [expanded]);

  useEffect(() => () => cancel.current(), []);

  function explore() {
    cancel.current();
    if (expanded) cancel.current = startScroll();
    else {
      requested.current = true;
      setExpanded(true);
    }
  }

  return { expanded, explore };
}
