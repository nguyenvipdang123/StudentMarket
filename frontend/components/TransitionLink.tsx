"use client";

import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";
import LoadingIndicator from "./LoadingIndicator";

function NavigationWait() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  // The portal keeps feedback outside cards, clipped containers and links.
  return createPortal(<div className="navigation-wait" data-navigation-pending="true">
    <div className="navigation-wait-track" aria-hidden="true"><span /></div>
    <div className="navigation-wait-pill"><LoadingIndicator label="Đang mở trang…" /></div>
  </div>, document.body);
}

/** Preserve Next.js prefetch, keyboard, new-tab and cancellation behavior. */
export default function TransitionLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<NavigationWait /></Link>;
}
