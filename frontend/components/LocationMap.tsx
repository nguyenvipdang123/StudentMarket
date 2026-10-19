"use client";

import { useState } from "react";
import { googleMapsEmbedUrl, googleMapsLinks, mapQuery } from "@/lib/google-maps";
import Icon from "./FigmaIcon";
import styles from "./LocationMap.module.css";

export default function LocationMap({ location, school = "", preview = false }: {
  location: string;
  school?: string;
  preview?: boolean;
}) {
  const query = mapQuery(location, school);
  const links = googleMapsLinks(query);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY || "";
  const [previewQuery, setPreviewQuery] = useState("");
  if (!links) return null;
  const embedUrl = googleMapsEmbedUrl(query, apiKey);
  const showMap = Boolean(embedUrl && (!preview || previewQuery === query));

  return <section className={styles.card} aria-label="Bản đồ địa điểm hẹn gặp">
    <div className={styles.heading}><Icon name="pin" /><strong>Địa điểm hẹn gặp</strong></div>
    <p className={styles.address}>{query}</p>
    {showMap ? <iframe
      className={styles.map}
      title={`Google Maps: ${query}`}
      src={embedUrl!}
      width="600"
      height="280"
      loading="lazy"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    /> : <div className={styles.placeholder}>
      <Icon name="pin" size={28} />
      <p>{embedUrl ? "Xem trước điểm hẹn trên bản đồ trước khi xác nhận." : "Mở Google Maps để xem địa điểm và chọn đường đi."}</p>
      {embedUrl && preview && <button type="button" className="figma-button" onClick={() => setPreviewQuery(query)}>Xem bản đồ</button>}
    </div>}
    <div className={styles.actions}>
      <a className="figma-button" href={links.search} target="_blank" rel="noopener noreferrer"><Icon name="arrowUp" />Mở Google Maps</a>
      <a className="figma-button primary" href={links.directions} target="_blank" rel="noopener noreferrer"><Icon name="arrowWhite" />Chỉ đường</a>
    </div>
    <p className={styles.note}>Vị trí được tìm theo tên địa điểm. Xác nhận đúng cơ sở và điểm hẹn trước khi đến.</p>
  </section>;
}

export function MeetingMapLinks({ location }: { location: string }) {
  const links = googleMapsLinks(location);
  if (!links) return null;
  return <div className={styles.meetingActions}>
    <a href={links.search} target="_blank" rel="noopener noreferrer">Xem địa điểm</a>
    <a href={links.directions} target="_blank" rel="noopener noreferrer">Chỉ đường</a>
  </div>;
}
