"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, type CSSProperties } from "react";
import { HERO_ORBIT_PATH } from "@/lib/hero-orbit";

export default function FigmaHeroArt() {
  const [motion, setMotion] = useState<"on" | "off">("on");
  const playing = motion === "on";
  return <div className="figma-hero-art" data-hero-motion={motion}><div className="figma-hero-scene" style={{ "--hero-orbit-path": `path("${HERO_ORBIT_PATH}")` } as CSSProperties}>
    <div className="figma-orbit"><svg width={600} height={520} viewBox="0 0 600 520" aria-hidden="true"><path d={HERO_ORBIT_PATH} fill="none" stroke="#AFC4AB" /></svg></div>
    <img className="figma-halo" src="/figma/25-29571-imgAmbientHalo.svg" alt="" width={445} height={445}/>
    <figure className="figma-library-card">
      <div className="figma-library-photo"><img src="/images/thu-vien-dntu.jpg" alt="Không gian thư viện DNTU với các kệ sách và khu học tập" width={1800} height={1200} decoding="async" /></div>
    </figure>
    <div className="figma-float headphones" data-motion-id="25:29601"><img src="/figma/25-29571-imgHeroHeadphonesAsset.png" alt="" width={170} height={170}/></div>
    <div className="figma-float backpack" data-motion-id="25:29600"><img src="/figma/25-29571-imgHeroBackpackAsset.png" alt="" width={180} height={205}/></div>
    <div className="figma-float lamp" data-motion-id="25:29599"><img src="/figma/25-29571-imgHeroDeskLampAsset.png" alt="" width={190} height={265}/></div>
    <div className="figma-float books" data-motion-id="25:29598"><img src="/figma/25-29571-imgHeroBooksAsset.png" alt="" width={210} height={145}/></div>
    <div className="figma-float laptop" data-motion-id="25:29597"><img src="/figma/25-29571-imgHeroLaptopAsset.png" alt="" width={350} height={240}/></div>
  </div><button type="button" className="figma-hero-motion-toggle" aria-pressed={playing} onClick={() => setMotion(playing ? "off" : "on")}>{playing ? "Tạm dừng chuyển động" : "Bật chuyển động"}</button></div>;
}
