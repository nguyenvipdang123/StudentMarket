// Share one observer across all product grids, including cards loaded later.
let observer: IntersectionObserver | null = null;
const cards = new Set<HTMLElement>();

function reveal(card: HTMLElement) {
  card.dataset.scrollReveal = "visible";
  observer?.unobserve(card);
}

export function observeProductReveal(card: HTMLElement) {
  if (!window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) reveal(entry.target as HTMLElement);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
  }
  cards.add(card);
  // Cards already above the viewport stay visible when navigating back or filtering.
  card.dataset.scrollReveal = card.getBoundingClientRect().bottom <= 0 ? "visible" : "pending";
  if (card.dataset.scrollReveal === "pending") observer.observe(card);
  const onFocus = () => reveal(card);
  card.addEventListener("focusin", onFocus);
  return () => {
    observer?.unobserve(card);
    card.removeEventListener("focusin", onFocus);
    cards.delete(card);
    delete card.dataset.scrollReveal;
    if (!cards.size) { observer?.disconnect(); observer = null; }
  };
}
