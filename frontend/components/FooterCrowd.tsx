"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Crowd = dynamic(() => import("@/components/ui/skiper39"), { ssr: false });

export default function FooterCrowd() {
  const ref = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="footer-crowd-slot">{nearViewport && <Crowd />}</div>;
}
