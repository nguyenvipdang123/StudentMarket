"use client";

import { googleMapsEmbedUrl, googleMapsLinks, mapQuery } from "@/lib/google-maps";
import Icon from "./FigmaIcon";
import styles from "./LocationMap.module.css";

export default function LocationMap({ location, school = "" }: {
  location: string;
  school?: string;
  preview?: boolean;
}) {
  const query = mapQuery(location, school);
  const links = googleMapsLinks(query);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY || "";
  if (!links) return null;
  const embedUrl = googleMapsEmbedUrl(query, apiKey);
  // In the listing form, show the current location immediately. Previously the
  // preview required a click, which made the map appear to be missing.
  const showMap = Boolean(embedUrl);

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
      <p>{embedUrl ? "Bản đồ không tải được. Bạn vẫn có thể mở Google Maps để xem địa điểm." : "Bản đồ nhúng chưa được cấu hình. Hãy thêm NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY để xem bản đồ ngay tại đây."}</p>
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
