/**
 * Cursor-Schicht: ein weicher Ring plus Punkt, der interaktiven Zielen folgt.
 * Läuft nur bei Feinzeiger und ohne Bewegungsbremse; sonst bleibt der
 * Systemcursor sichtbar und hier passiert nichts.
 */

import { addFrameTask, removeFrameTask } from "./utils";

export function initCursor(): () => void {
  const wrapper = document.querySelector<HTMLElement>(".cursor");
  const dot = wrapper?.querySelector<HTMLElement>(".cursor__dot");
  const ring = wrapper?.querySelector<HTMLElement>(".cursor__ring");
  if (!wrapper || !dot || !ring) return () => {};

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let dotX = targetX;
  let dotY = targetY;
  let ringX = targetX;
  let ringY = targetY;
  let visible = false;

  document.documentElement.classList.add("has-custom-cursor");

  const task = (dt: number): void => {
    dotX += (targetX - dotX) * Math.min(dt * 26, 1);
    dotY += (targetY - dotY) * Math.min(dt * 26, 1);
    ringX += (targetX - ringX) * Math.min(dt * 12, 1);
    ringY += (targetY - ringY) * Math.min(dt * 12, 1);

    dot.style.transform = `translate3d(${dotX.toFixed(2)}px, ${dotY.toFixed(2)}px, 0)`;
    ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0)`;
    if (visible) wrapper.dataset.visible = "true";
  };

  addFrameTask(task);

  const onMove = (event: PointerEvent): void => {
    targetX = event.clientX;
    targetY = event.clientY;
    if (!visible) {
      visible = true;
      dotX = targetX;
      dotY = targetY;
      ringX = targetX;
      ringY = targetY;
    }
  };

  const onOver = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    const interactive = target?.closest("a, button, input, textarea, [data-tilt], [data-magnet]");
    if (interactive) wrapper.classList.add("is-hover");
  };

  const onOut = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    if (target?.closest("a, button, input, textarea, [data-tilt], [data-magnet]")) wrapper.classList.remove("is-hover");
  };

  const onDown = (): void => wrapper.classList.add("is-down");
  const onUp = (): void => wrapper.classList.remove("is-down");
  const onLeave = (): void => {
    visible = false;
    delete wrapper.dataset.visible;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerover", onOver, { passive: true });
  window.addEventListener("pointerout", onOut, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  document.addEventListener("pointerleave", onLeave);

  return () => {
    removeFrameTask(task);
    document.documentElement.classList.remove("has-custom-cursor");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerover", onOver);
    window.removeEventListener("pointerout", onOut);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointerleave", onLeave);
  };
}