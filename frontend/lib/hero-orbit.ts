/* Original Bezier curve from public/figma/25-29571-imgOrbitalLine.svg.
 * Both the visible line and CSS motion path use these same coordinates. */
const curves = [
  [[341.299, 0.5], [408.086, 17.2747], [456.406, 44.3701]],
  [[504.742, 71.4746], [534.5, 108.84], [534.5, 150]],
  [[534.5, 191.16], [504.742, 228.525], [456.406, 255.63]],
  [[408.086, 282.725], [341.299, 299.5], [267.5, 299.5]],
  [[193.701, 299.5], [126.914, 282.725], [78.5938, 255.63]],
  [[30.2575, 228.525], [0.5, 191.16], [0.5, 150]],
  [[0.5, 108.84], [30.2575, 71.4746], [78.5938, 44.3701]],
  [[126.914, 17.2747], [193.701, 0.5], [267.5, 0.5]],
];
const angle = -18 * Math.PI / 180;
function point([x, y]: number[]) {
  const dx = (x - 267.5) * 0.88;
  const dy = (y - 150) * 0.88;
  return `${(300 + dx * Math.cos(angle) - dy * Math.sin(angle)).toFixed(3)} ${(250 + dx * Math.sin(angle) + dy * Math.cos(angle)).toFixed(3)}`;
}
export const HERO_ORBIT_PATH = `M${point([267.5, 0.5])}${curves.map(curve => `C${curve.map(point).join(" ")}`).join("")}Z`;
