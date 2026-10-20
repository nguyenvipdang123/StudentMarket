"use client";

import { gsap } from "gsap";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

interface CrowdCanvasProps {
  src: string;
  /** Horizontal tiles in the supplied Skiper sprite sheet. */
  rows?: number;
  /** Vertical tiles in the supplied Skiper sprite sheet. */
  cols?: number;
  paused?: boolean;
}

type Peep = {
  rect: [number, number, number, number];
  width: number; height: number;
  x: number; y: number; anchorY: number; scaleX: number;
  walk: gsap.core.Timeline | null;
};

function CrowdCanvas({ src, rows = 15, cols = 7, paused = false }: CrowdCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const playbackRef = useRef<(() => void) | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
    playbackRef.current?.();
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows * cols > 200) return;

    let disposed = false;
    let inView = false;
    let ticking = false;
    let ready = false;
    let resizeFrame = 0;
    const image = new Image();
    const stage = { width: 0, height: 0, dpr: 1 };
    const allPeeps: Peep[] = [];
    const availablePeeps: Peep[] = [];
    const crowd: Peep[] = [];
    const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

    function render() {
      if (!ctx || !ready || disposed) return;
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.clearRect(0, 0, stage.width, stage.height);
      for (const peep of crowd) {
        ctx.save();
        ctx.translate(peep.x, peep.y);
        ctx.scale(peep.scaleX, 1);
        ctx.drawImage(image, ...peep.rect, 0, 0, peep.width, peep.height);
        ctx.restore();
      }
    }

    function updatePlayback() {
      const play = ready && inView && !document.hidden && !pausedRef.current && !disposed;
      for (const peep of crowd) peep.walk?.paused(!play);
      if (play && !ticking) { gsap.ticker.add(render); ticking = true; }
      if (!play && ticking) { gsap.ticker.remove(render); ticking = false; }
      canvas!.dataset.playing = String(play);
      if (!play) render();
    }
    playbackRef.current = updatePlayback;

    function addPeepToCrowd() {
      if (disposed || !availablePeeps.length) return;
      const index = Math.floor(Math.random() * availablePeeps.length);
      const peep = availablePeeps.splice(index, 1)[0];
      const direction = Math.random() > 0.5 ? 1 : -1;
      const depth = gsap.parseEase("power2.in")(Math.random());
      const startY = stage.height - peep.height + 26 - depth * 60;
      peep.scaleX = direction;
      peep.x = direction === 1 ? -peep.width : stage.width + peep.width;
      peep.y = startY;
      peep.anchorY = startY;
      const walk = gsap.timeline({ paused: true });
      walk.timeScale(randomRange(0.6, 1.25));
      walk.to(peep, { duration: 12, x: direction === 1 ? stage.width + peep.width : -peep.width, ease: "none" }, 0);
      walk.to(peep, { duration: 0.25, repeat: 47, yoyo: true, y: startY - 6, ease: "sine.inOut" }, 0);
      walk.eventCallback("onComplete", () => {
        if (disposed) return;
        const at = crowd.indexOf(peep);
        if (at >= 0) crowd.splice(at, 1);
        availablePeeps.push(peep);
        addPeepToCrowd();
      });
      peep.walk = walk;
      crowd.push(peep);
      crowd.sort((a, b) => a.anchorY - b.anchorY);
      if (ticking) walk.play();
      return peep;
    }

    function resize() {
      if (disposed || !ready || !canvas) return;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!width || !height || (stage.width === width && stage.height === height && stage.dpr === dpr)) return;
      for (const peep of crowd) peep.walk?.kill();
      crowd.length = 0;
      stage.width = width; stage.height = height; stage.dpr = dpr;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      const peepHeight = Math.min(height * 0.85, width < 640 ? 160 : 220);
      for (const peep of allPeeps) {
        peep.height = peepHeight;
        peep.width = peepHeight * peep.rect[2] / peep.rect[3];
      }
      availablePeeps.splice(0, availablePeeps.length, ...allPeeps);
      const count = Math.min(allPeeps.length, width < 640 ? 22 : 40);
      for (let i = 0; i < count; i++) addPeepToCrowd()?.walk?.progress(Math.random(), true);
      render();
      updatePlayback();
    }

    const observer = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false;
      updatePlayback();
    });
    observer.observe(canvas);
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    });
    resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", updatePlayback);

    image.onload = () => {
      if (disposed) return;
      setImageFailed(false);
      const rectWidth = image.naturalWidth / rows;
      const rectHeight = image.naturalHeight / cols;
      for (let i = 0; i < rows * cols; i++) allPeeps.push({
        rect: [(i % rows) * rectWidth, Math.floor(i / rows) * rectHeight, rectWidth, rectHeight],
        width: rectWidth, height: rectHeight, x: 0, y: 0, anchorY: 0, scaleX: 1, walk: null,
      });
      ready = true;
      canvas.dataset.ready = "true";
      resize();
    };
    image.onerror = () => { if (!disposed) setImageFailed(true); };
    image.src = src;

    return () => {
      disposed = true;
      image.onload = null; image.onerror = null;
      observer.disconnect(); resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
      document.removeEventListener("visibilitychange", updatePlayback);
      gsap.ticker.remove(render);
      for (const peep of crowd) peep.walk?.kill();
      playbackRef.current = null;
    };
  }, [src, rows, cols]);

  return <>
    <canvas ref={canvasRef} className="crowd-canvas absolute inset-0 h-full w-full" aria-hidden="true" />
    {imageFailed && <p className="crowd-image-fallback">Cùng nhau tạo nên cộng đồng SangTay.</p>}
  </>;
}

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function motionSnapshot() { return window.matchMedia(motionQuery).matches; }

function Skiper39() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, () => false);
  const [manualPaused, setManualPaused] = useState<boolean | null>(null);
  const paused = manualPaused ?? reducedMotion;
  return <section className="footer-crowd" aria-label="Cộng đồng SangTay">
    <header className="footer-crowd-heading">
      <p>CŨ VỚI BẠN · MỚI VỚI AI ĐÓ</p>
      <h2>Trao một món đồ, thêm một kết nối.</h2>
    </header>
    <button className="footer-crowd-control" type="button" aria-pressed={paused} onClick={() => setManualPaused(!paused)}>
      <span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span>{paused ? "Tiếp tục chuyển động" : "Tạm dừng chuyển động"}
    </button>
    <div className="footer-crowd-scene">
      <CrowdCanvas src="/illustrations/open-peeps-crowd.png" rows={15} cols={7} paused={paused} />
    </div>
    <p className="footer-crowd-credit">Animation: <a href="https://skiper-ui.com" target="_blank" rel="noopener noreferrer">Skiper UI</a> · Minh họa: <a href="https://www.openpeeps.com/" target="_blank" rel="noopener noreferrer">Open Peeps</a></p>
  </section>;
}

export { CrowdCanvas, Skiper39 };
export default Skiper39;

/**
 * Skiper 39 Canvas_Landing_004 — React + Canvas + GSAP.
 * Adapted from the component supplied by the user; inspired by
 * https://codepen.io/zadvorsky/pen/xxwbBQV, illustrations by Open Peeps.
 * Original component author: @gurvinder-singh02 (https://gxuri.me).
 * Free Skiper UI usage requires attribution; visible credit is retained above.
 * Integration: typed sprites, responsive sizing, pause control, reduced motion,
 * viewport/visibility suspension and cleanup of image handlers/timelines.
 */
