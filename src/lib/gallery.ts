/**
 * Horizontale Produktgalerie: auf schmalen Bildschirmen mit Pfeiltasten
 * bedienbar, ohne die Seite selbst zu scrollen. Auf breiten Bildschirmen
 * ist die Galerie ein Raster — dann passiert hier nichts.
 */

export function initGalleryKeys(): () => void {
  const rail = document.querySelector<HTMLElement>("[data-gallery]");
  if (!rail) return () => {};

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const scrollable = rail.scrollWidth > rail.clientWidth + 4;
    if (!scrollable) return;

    const item = rail.querySelector<HTMLElement>(".product");
    const step = item ? item.offsetWidth + 24 : rail.clientWidth * 0.8;
    event.preventDefault();
    rail.scrollBy({ left: event.key === "ArrowRight" ? step : -step, behavior: "smooth" });
  };

  rail.addEventListener("keydown", onKeyDown);
  return () => rail.removeEventListener("keydown", onKeyDown);
}