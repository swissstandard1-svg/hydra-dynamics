/**
 * „Ambient"-Schicht: ein Strömungsfeld aus Partikeln auf einem Canvas.
 * Ersetzt einen schweren WebGL-Fluid-Filter: gleicher Eindruck, kleinere Datei,
 * stabilere Bildrate. Läuft nur, wenn Bewegung erwünscht ist, und pausiert
 * automatisch, sobald der Tab in den Hintergrund geht.
 */

import { addFrameTask, clamp, hasFinePointer, removeFrameTask } from "./utils";

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  span: number;
  size: number;
  tone: string;
}

const field = (x: number, y: number, t: number): number =>
  Math.sin(x * 0.0016 + t * 0.00013) * 1.7 +
  Math.cos(y * 0.0021 - t * 0.00011) * 1.7 +
  Math.sin((x + y) * 0.0009 + t * 0.00007) * 1.1;

export function initAmbient(): () => void {
  const canvas = document.querySelector<HTMLCanvasElement>("#ambient");
  const ctx = canvas?.getContext("2d", { alpha: true });
  if (!canvas || !ctx) return () => {};

  const dpr = clamp(window.devicePixelRatio || 1, 1, 1.75);
  const TONES = ["#22d3ee", "#5eead4", "#67e8f9", "#a78bfa", "#22d3ee", "#5eead4"];
  let width = 0;
  let height = 0;
  let particles: Particle[] = [];
  let visible = true;

  const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, active: false };
  const coarse = !hasFinePointer();

  function resize(): void {
    width = canvas!.clientWidth || window.innerWidth;
    height = canvas!.clientHeight || window.innerHeight;
    canvas!.width = Math.floor(width * dpr);
    canvas!.height = Math.floor(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Partikelanzahl an Fläche koppeln, damit Mobilgeräte nicht überlastet werden.
    const target = clamp(Math.round((width * height) / 26000), 26, 88);
    particles = Array.from({ length: target }, () => spawn(true));
    ctx!.clearRect(0, 0, width, height);
  }

  function spawn(initial = false): Particle {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const span = 2.6 + Math.random() * 4.4;
    return {
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      life: initial ? Math.random() * span : 0,
      span,
      size: 0.6 + Math.random() * 1.5,
      tone: TONES[Math.floor(Math.random() * TONES.length)] ?? "#22d3ee",
    };
  }

  const task = (dt: number, now: number): void => {
    if (!visible) return;

    pointer.x += (pointer.tx - pointer.x) * Math.min(dt * 6, 1);
    pointer.y += (pointer.ty - pointer.y) * Math.min(dt * 6, 1);

    // Sanfte Nachlaufspur statt Vollbild löschen — deutlich günstiger.
    ctx!.globalCompositeOperation = "destination-out";
    ctx!.fillStyle = "rgba(0, 0, 0, 0.09)";
    ctx!.fillRect(0, 0, width, height);

    ctx!.globalCompositeOperation = "lighter";
    ctx!.lineCap = "round";

    for (const p of particles) {
      const angle = field(p.x, p.y, now) * Math.PI;
      // Trägheit: die Richtung wechselt weich, das Feld „fliesst".
      p.vx += (Math.cos(angle) * 26 - p.vx) * Math.min(dt * 1.5, 1);
      p.vy += (Math.sin(angle) * 26 - p.vy) * Math.min(dt * 1.5, 1);

      if (pointer.active) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const dist2 = dx * dx + dy * dy;
        const radius = coarse ? 190 : 150;
        if (dist2 < radius * radius && dist2 > 1) {
          const dist = Math.sqrt(dist2);
          const pull = (1 - dist / radius) * 240;
          p.vx += (dx / dist) * pull * dt;
          p.vy += (dy / dist) * pull * dt;
        }
      }

      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt / p.span;

      if (p.life >= 1 || p.x < -40 || p.y < -40 || p.x > width + 40 || p.y > height + 40) {
        Object.assign(p, spawn());
        continue;
      }

      // Ein- und Ausblenden über die Lebensdauer
      const fade = Math.sin(p.life * Math.PI);
      ctx!.strokeStyle = p.tone;
      ctx!.globalAlpha = 0.05 + fade * 0.42;
      ctx!.lineWidth = p.size;
      ctx!.beginPath();
      ctx!.moveTo(p.px, p.py);
      ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
    }

    if (pointer.active) {
      const glow = ctx!.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 190);
      glow.addColorStop(0, "rgba(34, 211, 238, 0.14)");
      glow.addColorStop(0.55, "rgba(94, 234, 212, 0.05)");
      glow.addColorStop(1, "rgba(4, 7, 14, 0)");
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = glow;
      ctx!.fillRect(pointer.x - 190, pointer.y - 190, 380, 380);
    }

    ctx!.globalAlpha = 1;
    ctx!.globalCompositeOperation = "source-over";
  };

  addFrameTask(task);

  const onPointerMove = (event: PointerEvent): void => {
    pointer.tx = event.clientX;
    pointer.ty = event.clientY;
    if (!pointer.active) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    }
  };

  const onPointerLeave = (): void => {
    pointer.active = false;
    pointer.tx = -1e4;
    pointer.ty = -1e4;
  };

  const onVisibility = (): void => {
    visible = document.visibilityState === "visible";
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerout", onPointerLeave, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    removeFrameTask(task);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerout", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    ctx.clearRect(0, 0, width, height);
  };
}