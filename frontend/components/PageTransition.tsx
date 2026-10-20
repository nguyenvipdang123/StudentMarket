"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !ref.current?.animate) return;
    // Opacity only: transforms would change positioning of fixed menus/dialogs.
    const animation = ref.current.animate([{ opacity: 0.65 }, { opacity: 1 }], {
      duration: 240, easing: "ease-out", id: "sangtay-page-enter",
    });
    return () => animation.cancel();
  }, [pathname]);
  return <div ref={ref} className="page-transition">{children}</div>;
}
