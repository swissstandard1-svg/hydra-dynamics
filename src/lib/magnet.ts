/**
 * Magnetische Schaltflächen: das Ziel zieht den Cursor sanft an.
 * Bewusst begrenzt (max. 7 px), damit die Trefferfläche glaubwürdig bleibt.
 */

import { addFrameTask, removeFrameTask } from "./utils";

interface Magnet {
  el: HTMLElement;
  x: number;
  y: number;
  tx: number;
  ty: number;
  active: boolean;
}

export function initMagnets(): () => void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-magnet]"));
  if (elements.length === 0) return () => {};

  const magnets: Magnet[] = elements.map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0, active: false }));

  const task = (dt: number): void => {
    for (const magnet of magnets) {
      magnet.x += (magnet.tx - magnet.x) * Math.min(dt * 14, 1);
      magnet.y += (magnet.ty - magnet.y) * Math.min(dt * 14, 1);
      const done = Math.abs(magnet.tx - magnet.x) < 0.05 && Math.abs(magnet.ty - magnet.y) < 0.05;
      if (done && !magnet.active) {
        magnet.el.style.translate = "";
        continue;
      }
      magnet.el.style.translate = `${magnet.x.toFixed(2)}px ${magnet.y.toFixed(2)}px`;
    }
  };

  addFrameTask(task);

  const onMove = (event: PointerEvent): void => {
    for (const magnet of magnets) {
      const rect = magnet.el.getBoundingClientRect();
      if (rect.width === 0) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const distance = Math.hypot(dx, dy);
      const range = 150;
      if (distance < range && distance > 1) {
        const strength = (1 - distance / range) * 7;
        magnet.tx = (dx / distance) * strength;
        magnet.ty = (dy / distance) * strength;
        magnet.active = true;
      } else if (magnet.active) {
        magnet.tx = 0;
        magnet.ty = 0;
        magnet.active = false;
      }
    }
  };

  window.addEventListener("pointermove", onMove, { passive: true });

  return () => {
    removeFrameTask(task);
    window.removeEventListener("pointermove", onMove);
    for (const magnet of magnets) magnet.el.style.translate = "";
  };
}