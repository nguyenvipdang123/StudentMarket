/* Preserve the native bounds of the static SVG assets exported from Figma. */
/* eslint-disable @next/next/no-img-element */
const assets = {
  school: "school.svg", verified: "verified.svg", safety: "safety.svg",
  message: "message.svg", heart: "heart.svg",
} as const;

export default function SellerProfileIcon({ name }: { name: keyof typeof assets }) {
  return <span className={`seller-profile-icon seller-profile-icon-${name}`} aria-hidden="true">
    <img src={`/figma/seller-profile/${assets[name]}`} alt="" />
  </span>;
}
