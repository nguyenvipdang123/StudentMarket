"use client";

import { Component, Suspense, lazy, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { Application } from "@splinetool/runtime";

const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
  paused?: boolean;
  onLoad?: (app: Application) => void;
  onError?: () => void;
}

function SceneLoading() {
  return <div className="robot-scene-loading" role="status" aria-label="Đang tải robot 3D"><span className="wait-spinner" aria-hidden="true" /></div>;
}

class SceneBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() {
    return this.state.failed ? <div className="robot-scene-unavailable" role="status">Robot 3D chưa tải được. Bạn có thể thu gọn và mở lại.</div> : this.props.children;
  }
}

function SceneRuntime({ scene, className, paused = false, onLoad }: SplineSceneProps) {
  const appRef = useRef<Application | null>(null);
  const pausedRef = useRef(paused);
  const firstFrameRef = useRef(0);
  const activeRef = useRef(false);
  const syncPlayback = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    if (pausedRef.current || document.hidden) app.stop();
    else app.play();
  }, []);
  useEffect(() => {
    pausedRef.current = paused;
    syncPlayback();
  }, [paused, syncPlayback]);
  useEffect(() => {
    activeRef.current = true;
    document.addEventListener("visibilitychange", syncPlayback);
    return () => { activeRef.current = false; document.removeEventListener("visibilitychange", syncPlayback); cancelAnimationFrame(firstFrameRef.current); appRef.current = null; };
  }, [syncPlayback]);
  const loaded = useCallback((app: Application) => {
    if (!activeRef.current) return;
    appRef.current = app;
    app.setBackgroundColor("rgba(0, 0, 0, 0)");
    app.setGlobalEvents(false);
    // Let WebGL draw an initial still before honoring reduced-motion pause.
    if (pausedRef.current && !document.hidden) {
      app.play();
      firstFrameRef.current = requestAnimationFrame(() => {
        firstFrameRef.current = requestAnimationFrame(syncPlayback);
      });
    } else syncPlayback();
    onLoad?.(app);
  }, [onLoad, syncPlayback]);
  return <Spline scene={scene} className={className} onLoad={loaded} renderOnDemand wasmPath="/spline-runtime/2.0.95"><SceneLoading /></Spline>;
}

export function SplineScene(props: SplineSceneProps) {
  return <SceneBoundary key={props.scene} onError={props.onError}>
    <Suspense fallback={<SceneLoading />}><SceneRuntime {...props} /></Suspense>
  </SceneBoundary>;
}
