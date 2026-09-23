/**
 * Spotlight: der Lichtkegel auf Karten folgt dem Zeiger.
 * Übergibt nur zwei CSS-Variablen — die Optik selbst macht CSS.
 */

export function initSpotlight(): () => void {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".card, .case, .product, .loop__step, .proof"));
  const cleanups: Array<() => void> = [];

  for (const card of cards) {
    const onMove = (event: PointerEvent): void => {
      const rect = card.getBoundingClientRect();
      if (rect.width === 0) return;
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--mx", `${x.toFixed(1)}%`);
      card.style.setProperty("--my", `${y.toFixed(1)}%`);
    };
    card.addEventListener("pointermove", onMove, { passive: true });
    cleanups.push(() => card.removeEventListener("pointermove", onMove));
  }

  return () => {
    for (const dispose of cleanups) dispose();
  };
}