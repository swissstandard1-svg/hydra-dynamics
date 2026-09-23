/**
 * Tilt: Karten kippen minimal zum Zeiger hin — reine 3D-Transformation,
 * kein Layout-Einfluss. Auf Touchgeräten bleibt davon nichts übrig.
 */

const MAX_TILT = 5.5;

export function initTilt(): () => void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
  const cleanups: Array<() => void> = [];

  for (const el of elements) {
    el.style.transformStyle = "preserve-3d";
    el.style.willChange = "transform";

    const onMove = (event: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 2 * MAX_TILT;
      const rotateX = (0.5 - py) * 2 * MAX_TILT;
      el.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px)`;
    };

    const onLeave = (): void => {
      el.style.transform = "";
      el.style.transition = "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)";
      window.setTimeout(() => {
        el.style.transition = "";
      }, 640);
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    cleanups.push(() => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.transform = "";
    });
  }

  return () => {
    for (const dispose of cleanups) dispose();
  };
}