/**
 * Einblenden beim Scrollen und Text-Choreografie.
 * Ein gemeinsamer IntersectionObserver und CSS-Übergänge sorgen dafür,
 * dass weder Scroll-Handler noch Layoutmessungen pro Frame nötig sind.
 */

import { prefersReducedMotion } from "./utils";

type Dispose = () => void;

/** Überschriften in Wörter und Zeichen zerlegen (Silbengrenzen bleiben intakt). */
function splitNode(node: HTMLElement): number {
  const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text) return 0;

  const segmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("de", { granularity: "grapheme" }) : null;
  const words = text.split(" ");
  const fragment = document.createDocumentFragment();
  let charIndex = 0;

  words.forEach((word, position) => {
    const wordNode = document.createElement("span");
    wordNode.style.display = "inline-block";
    wordNode.style.whiteSpace = "nowrap";

    const units = segmenter ? Array.from(segmenter.segment(word), (part) => part.segment) : Array.from(word);
    for (const unit of units) {
      const span = document.createElement("span");
      span.textContent = unit;
      span.style.setProperty("--char-index", String(charIndex));
      wordNode.appendChild(span);
      charIndex += 1;
    }

    fragment.appendChild(wordNode);
    if (position < words.length - 1) fragment.appendChild(document.createTextNode(" "));
  });

  node.replaceChildren(fragment);
  node.classList.add("split");
  return charIndex;
}

export function initRevealLayer(): Dispose {
  document.querySelectorAll<HTMLElement>("[data-split]").forEach((node) => {
    splitNode(node);
  });

  // Ohne Animationswunsch: alles bleibt sofort sichtbar, keine Staffelung.
  if (prefersReducedMotion()) {
    document.querySelectorAll<HTMLElement>("[data-reveal], [data-split]").forEach((el) => el.classList.add("is-revealed"));
    return () => {};
  }

  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal], [data-split]"));
  if (targets.length === 0) return () => {};

  for (const target of targets) {
    const delay = Number(target.dataset.revealDelay ?? "0");
    if (delay > 0) target.style.setProperty("--reveal-delay", String(delay));
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target); // nur einmal einblenden, spart Rechenzeit
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  for (const target of targets) observer.observe(target);
  return () => observer.disconnect();
}