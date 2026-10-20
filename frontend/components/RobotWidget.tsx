"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Application } from "@splinetool/runtime";

const Scene = dynamic(() => import("@/components/ui/splite").then(module => module.SplineScene), {
  ssr: false, loading: () => <span className="wait-spinner" role="status" aria-label="Đang tải robot 3D" />,
});
const collapsedKey = "sangtay_robot_collapsed";
const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const media = matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function getMotion() { return matchMedia(motionQuery).matches; }

function RobotSymbol() {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="5" /><path d="M12 3v4M2 12v4m20-4v4M9 16h6" /><circle cx="8.5" cy="12" r="1" /><circle cx="15.5" cy="12" r="1" /></svg>;
}

export default function RobotWidget() {
  const pathname = usePathname();
  const [activated, setActivated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [manualPaused, setManualPaused] = useState<boolean | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, () => false);
  const paused = manualPaused ?? reducedMotion;
  const hostRef = useRef<HTMLDivElement>(null);
  const hidden = pathname.startsWith("/admin");

  useEffect(() => {
    // Defer the WebGL bundle until after the initial page content has rendered.
    const timer = window.setTimeout(() => {
      let wasCollapsed = false;
      try { wasCollapsed = sessionStorage.getItem(collapsedKey) === "1"; } catch { /* Storage is optional. */ }
      setCollapsed(wasCollapsed);
      setActivated(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const loaded = useCallback((app: Application) => {
    // Scene pointer events follow the cursor without an overlay intercepting clicks.
    app.setGlobalEvents(true);
    setStatus("ready");
  }, []);
  const failed = useCallback(() => setStatus("error"), []);
  function toggleCollapsed(next: boolean) {
    try { sessionStorage.setItem(collapsedKey, next ? "1" : "0"); } catch { /* Storage is optional. */ }
    setCollapsed(next);
    if (!next) setStatus("loading");
    requestAnimationFrame(() => hostRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
  }

  if (hidden || !activated) return null;
  return <div ref={hostRef} className={`robot-widget${collapsed ? " is-collapsed" : ""}`} data-status={status} data-paused={paused} aria-label="Robot 3D SangTay">
    {collapsed ? <button className="robot-open" type="button" onClick={() => toggleCollapsed(false)} aria-label="Hiện robot 3D"><RobotSymbol /></button> : <>
      <div className={`robot-stage${paused ? " is-paused" : ""}`} aria-hidden="true">
        <Scene scene="/scenes/robot.splinecode" className="robot-spline" paused={paused} onLoad={loaded} onError={failed} />
      </div>
      <div className="robot-controls">
        <button type="button" onClick={() => toggleCollapsed(true)} aria-label="Thu gọn robot 3D" title="Thu gọn robot"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg></button>
        {status === "ready" && <button type="button" onClick={() => setManualPaused(!paused)} aria-label={paused ? "Tiếp tục robot 3D" : "Tạm dừng robot 3D"} aria-pressed={paused} title={paused ? "Tiếp tục robot" : "Tạm dừng robot"}><span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span></button>}
      </div>
    </>}
  </div>;
}
