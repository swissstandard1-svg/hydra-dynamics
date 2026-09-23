/**
 * Kleine Helfer, die alle Module teilen.
 * Bewusst schlank: kein Framework, keine Abhängigkeiten.
 */

export const NS = "http://www.w3.org/2000/svg";

/** Nutzerwunsch „weniger Bewegung" — wird bei jeder Entscheidung berücksichtigt. */
export const prefersReducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Feinzeiger? Nur dann lohnt Cursor-Magie, Tilt und Hover-Spotlight. */
export const hasFinePointer = (): boolean => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Nachkommastellen einer Zahl aus einem Textmerkmal lesen. */
export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** Deutsche Zahlendarstellung, optional mit fester Stellenzahl. */
export function formatNumber(value: number, decimals?: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  }).format(value);
}

/** Quadratisch auslaufende Kurve für alle Zähl- und Balkenanimationen. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Ein einziger requestAnimationFrame-Takt für die ganze Seite.
 * Mehrere Module hängen sich hier ein, statt eigene Loops zu starten.
 */
type Task = (dt: number, now: number) => void;

const tasks = new Set<Task>();
let running = false;
let last = 0;

function frame(now: number): void {
  if (!running) return;
  const dt = Math.min((now - last) / 1000, 0.05); // Aussetzer nach Tab-Wechsel abfangen
  last = now;
  for (const task of tasks) task(dt, now);
  requestAnimationFrame(frame);
}

export function addFrameTask(task: Task): void {
  tasks.add(task);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
}

export function removeFrameTask(task: Task): void {
  tasks.delete(task);
  if (tasks.size === 0) running = false;
}

/** Element mit Typgarantie abfragen — spart Null-Prüfungen im Aufrufer. */
export function must<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element nicht gefunden: ${selector}`);
  return el;
}