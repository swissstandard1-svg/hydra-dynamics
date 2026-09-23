/* ============================================================================
   Einstiegspunkt: lädt Stile, startet alle Schichten in fester Reihenfolge
   und räumt beim Verlassen der Seite wieder auf.
   ========================================================================== */

import "./styles/style.css";

import { initAmbient } from "./lib/ambient";
import { initScrollLayer } from "./lib/scroll";
import { initCursor } from "./lib/cursor";
import { initMagnets } from "./lib/magnet";
import { initSpotlight } from "./lib/spotlight";
import { initTilt } from "./lib/tilt";
import { initRevealLayer } from "./lib/reveal";
import { initBars, initCounters } from "./lib/signals";
import { initSimulator } from "./lib/simulator";
import { initFaq } from "./lib/faq";
import { initNav } from "./lib/nav";
import { initGalleryKeys } from "./lib/gallery";
import { initContactForm } from "./lib/form";
import { initConsoleWatch } from "./lib/console";
import { hasFinePointer, prefersReducedMotion } from "./lib/utils";

const VERSION = "1.0.0";

function boot(): void {
  const cleanup: Array<() => void> = [];

  // Fehlerbeobachtung zuerst, damit auch spätere Module erfasst werden.
  cleanup.push(initConsoleWatch());

  // Kernfunktionen laufen immer — auch ohne Animationen.
  cleanup.push(initNav());
  cleanup.push(initRevealLayer());
  cleanup.push(initCounters());
  cleanup.push(initBars());
  cleanup.push(initSimulator());
  cleanup.push(initFaq());
  cleanup.push(initGalleryKeys());
  cleanup.push(initContactForm());

  const reduced = prefersReducedMotion();
  document.documentElement.dataset.motion = reduced ? "reduced" : "full";

  // Ab hier nur noch Atmosphäre — und nur, wenn sie erwünscht ist.
  if (!reduced) {
    cleanup.push(initScrollLayer());
    cleanup.push(initAmbient());

    if (hasFinePointer()) {
      cleanup.push(initCursor());
      cleanup.push(initMagnets());
      cleanup.push(initTilt());
    }
    cleanup.push(initSpotlight());
  } else {
    // Ohne Bewegungsoption bleibt Lenis aus; Ankersprünge erledigt der Browser.
    document.documentElement.style.scrollBehavior = "auto";
  }

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