"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

// React's built-in crossfade, not a directional slide — this is a product
// surface, not a gallery. A slide encodes "going somewhere"; the nav's flat
// three-link structure doesn't have a forward/back hierarchy to encode, and
// the product register is explicit that motion here should convey a state
// change (the route changed), not stage a page-load moment. `key={pathname}`
// is what makes this fire at all: layout.tsx persists across navigations,
// so without a changing key the wrapped content reads as an update, not an
// enter/exit pair (React's own view-transitions guide calls this out).
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} default="auto">
      {children}
    </ViewTransition>
  );
}
