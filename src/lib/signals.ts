/**
 * Zahlen, die beim Sichtbarwerden hochzählen — und Balken, die sich füllen.
 * Werte kommen aus data-Attributen im Markup, damit der Inhalt ohne JavaScript
 * bereits korrekt dasteht (wichtig für Suchmaschinen und Screenreader).
 */

import { addFrameTask, easeOutCubic, formatNumber, removeFrameTask } from "./utils";

type Dispose = () => void;

export function initCounters(): Dispose {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-count-to]"));
  if (nodes.length === 0) return () => {};

  const disposers = new Set<Dispose>();

  const run = (node: HTMLElement): Dispose => {
    const to = Number(node.dataset.countTo ?? "0");
    const decimals = Number(node.dataset.countDecimals ?? "0");
    const suffix = node.dataset.countSuffix ?? "";
    const prefix = node.dataset.countPrefix ?? "";
    const duration = Number(node.dataset.countDuration ?? "1500");
    const from = Number(node.dataset.countFrom ?? "0");

    let done = false;
    let start = 0;
    const task = (dt: number, now: number): void => {
      if (!start) start = now;
      const raw = Math.min((now - start) / duration, 1);
      const value = from + (to - from) * easeOutCubic(raw);
      node.textContent = `${prefix}${formatNumber(value, decimals)}${suffix}`;
      if (raw >= 1 && !done) {
        done = true;
        removeFrameTask(task);
        node.textContent = `${prefix}${formatNumber(to, decimals)}${suffix}`;
      }
      void dt;
    };

    addFrameTask(task);
    // Startwert sofort setzen, damit nichts springt.
    node.textContent = `${prefix}${formatNumber(from, decimals)}${suffix}`;

    return () => removeFrameTask(task);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const node = entry.target as HTMLElement;
        observer.unobserve(node);
        const dispose = run(node);
        disposers.add(dispose);
      }
    },
    { threshold: 0.4 },
  );

  for (const node of nodes) observer.observe(node);

  return () => {
    observer.disconnect();
    for (const dispose of disposers) dispose();
    disposers.clear();
  };
}

export function initBars(): Dispose {
  const bars = Array.from(document.querySelectorAll<HTMLElement>("[data-bar-to]"));
  if (bars.length === 0) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const bar = entry.target as HTMLElement;
        observer.unobserve(bar);
        const ratio = Math.max(0, Math.min(Number(bar.dataset.barTo ?? "0") / 100, 1));
        // Ein Frame Verzögerung, damit der Übergang tatsächlich animiert.
        requestAnimationFrame(() => {
          bar.style.transform = `scaleX(${ratio})`;
        });
      }
    },
    { threshold: 0.5 },
  );

  for (const bar of bars) observer.observe(bar);
  return () => observer.disconnect();
}