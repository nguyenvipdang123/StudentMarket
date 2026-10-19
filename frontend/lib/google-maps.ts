function cleanLocation(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function mapQuery(location: string, school = ""): string {
  const place = cleanLocation(location);
  const campus = cleanLocation(school);
  if (!place) return "";
  if (!campus || place.toLocaleLowerCase("vi").includes(campus.toLocaleLowerCase("vi"))) return place;
  if (campus.toLocaleLowerCase("vi").includes(place.toLocaleLowerCase("vi"))) return campus;
  return `${place}, ${campus}`;
}

export function googleMapsLinks(query: string) {
  const place = cleanLocation(query);
  if (!place) return null;
  return {
    search: `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: place })}`,
    directions: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: place })}`,
  };
}

export function googleMapsEmbedUrl(query: string, apiKey: string): string | null {
  const place = cleanLocation(query);
  const key = apiKey.trim();
  if (!place || !key) return null;
  return `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key, q: place, language: "vi", region: "VN" })}`;
}

// Old meeting messages remain readable; links are built from the address, never from a supplied URL.
export function meetingLocation(message: string): string {
  if (!message.startsWith("📅 Đề xuất hẹn gặp")) return "";
  const line = message.split(/\r?\n/).find(value => value.startsWith("Địa điểm:"));
  const place = line?.slice("Địa điểm:".length).trim() || "";
  return place.length <= 200 ? cleanLocation(place) : "";
}
