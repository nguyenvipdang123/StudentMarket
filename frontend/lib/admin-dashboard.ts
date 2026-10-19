export type ListingTrendPoint = { day: string; label: string; count: number };

export function dashboardMoney(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
});

function dayKey(date: Date) {
  const parts = dayFormatter.formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

// Build calendar days in the site's timezone, including days with no listings.
export function listingTrend(listings: { createdAt: string }[], days: 7 | 30, now = new Date()): ListingTrendPoint[] {
  const today = new Date(`${dayKey(now)}T00:00:00Z`);
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (days - index - 1));
    const day = date.toISOString().slice(0, 10);
    return { day, label: `${day.slice(8)}/${day.slice(5, 7)}`, count: 0 };
  });
  const lookup = new Map(points.map(point => [point.day, point]));
  for (const listing of listings) {
    const date = new Date(listing.createdAt);
    if (!Number.isFinite(date.getTime())) continue;
    const point = lookup.get(dayKey(date));
    if (point) point.count += 1;
  }
  return points;
}
