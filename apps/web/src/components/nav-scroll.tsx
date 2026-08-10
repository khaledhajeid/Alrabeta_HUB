"use client";

import { useEffect } from "react";

// Renders nothing — sets a data-scrolled attribute on the root element the
// same way theme-script.tsx sets data-theme, so the header (a plain async
// server component, it needs the session) never needs its own client
// boundary just to react to scroll position. globals.css does the actual
// shadow-resting -> shadow-raised escalation off this attribute.
const SCROLL_THRESHOLD = 8;

export function NavScroll() {
  useEffect(() => {
    const root = document.documentElement;
    let ticking = false;

    const apply = () => {
      root.setAttribute("data-scrolled", window.scrollY > SCROLL_THRESHOLD ? "true" : "false");
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
