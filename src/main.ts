/* ============================================================================
   Einstiegspunkt: lädt Stile, startet alle Schichten in fester Reihenfolge
   und räumt beim Verlassen der Seite wieder auf.

   Die schweren Atmosphäre-Schichten (Canvas, GSAP/ScrollTrigger, Cursor,
   Magnet, Tilt) werden erst nach dem ersten Bild nachgeladen. Sie sind zum
   Ansehen der Seite nicht nötig — und blockieren so weder First Paint noch
   Interaktivität.
   ========================================================================== */

import "./styles/style.css";

import { initConsoleWatch } from "./lib/console";
import { initRevealLayer } from "./lib/reveal";
import { initBars, initCounters } from "./lib/signals";
import { initSimulator } from "./lib/simulator";
import { initFaq } from "./lib/faq";
import { initNav } from "./lib/nav";
import { initGalleryKeys } from "./lib/gallery";
import { initContactForm } from "./lib/form";
import { disabledEffects, effectEnabled } from "./lib/features";
import { prefersReducedMotion } from "./lib/utils";

const VERSION = "1.0.0";

/** Startet die Effekt-Schicht erst, wenn der Hauptfaden frei ist. */
function afterFirstPaint(task: () => Promise<void>): void {
  const run = (): void => {
    void task();
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void })
    .requestIdleCallback;
  if (typeof idle === "function") idle(run, { timeout: 1200 });
  else window.setTimeout(run, 240);
}

function boot(): void {
  const cleanup: Array<() => void> = [];
  const reduced = prefersReducedMotion();

  // Fehlerbeobachtung zuerst, damit auch spätere Module erfasst werden.
  cleanup.push(initConsoleWatch());

  // Kernfunktionen laufen immer — auch ohne Animationen.
  cleanup.push(initNav());
  cleanup.push(initRevealLayer(effectEnabled("split")));
  cleanup.push(initCounters());
  cleanup.push(initBars());
  cleanup.push(initSimulator());
  cleanup.push(initFaq());
  cleanup.push(initGalleryKeys());
  cleanup.push(initContactForm());

  document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  if (disabledEffects().length) document.documentElement.dataset.effectsOff = disabledEffects().join(",");

  if (reduced) {
    document.documentElement.style.scrollBehavior = "auto";
    return;
  }

  afterFirstPaint(async () => {
    if (effectEnabled("scroll")) {
      const { initScrollLayer } = await import("./lib/scroll");
      cleanup.push(initScrollLayer());
    }
    if (effectEnabled("ambient")) {
      const { initAmbient } = await import("./lib/ambient");
      cleanup.push(initAmbient());
    }
    if (effectEnabled("cursor") || effectEnabled("magnet") || effectEnabled("tilt")) {
      const [{ initCursor }, { initMagnets }, { initTilt }] = await Promise.all([
        import("./lib/cursor"),
        import("./lib/magnet"),
        import("./lib/tilt"),
      ]);
      if (effectEnabled("cursor")) cleanup.push(initCursor());
      if (effectEnabled("magnet")) cleanup.push(initMagnets());
      if (effectEnabled("tilt")) cleanup.push(initTilt());
    }
    if (effectEnabled("spotlight")) {
      const { initSpotlight } = await import("./lib/spotlight");
      cleanup.push(initSpotlight());
    }
    document.documentElement.dataset.effects = "ready";
  });

  window.addEventListener(
    "pagehide",
    () => {
      for (const dispose of cleanup) dispose();
      cleanup.length = 0;
    },
    { once: true },
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

console.info(
  `%cHYDRA Dynamics%c ${VERSION} — fiktives Konzept für einen Design- und Coding-Benchmark.`,
  "color:#22d3ee;font-weight:700",
  "color:#cfdbe9",
);