/**
 * Schalter für Effektgruppen.
 *
 * Über die Adresse abschaltbar, damit sich Wirkung und Kosten einzelner
 * Schichten messen lassen, statt sie zu vermuten:
 *
 *   /?effects=off          alle Atmosphäre-Effekte aus
 *   /?effects=ambient      nur das Strömungsfeld aus
 *   /?effects=split        nur die Text-Choreografie aus
 *   /?effects=ambient,split
 *
 * Ohne Parameter ist alles aktiv. `prefers-reduced-motion` sticht das immer.
 */

export type EffectName = "ambient" | "cursor" | "magnet" | "spotlight" | "tilt" | "split" | "scroll" | "counters";

const disabled = new Set<string>();

function read(): void {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("effects");
  if (!value) return;
  if (value === "off" || value === "none") {
    disabled.add("all");
    return;
  }
  for (const name of value.split(",")) disabled.add(name.trim().toLowerCase());
}

read();

/** Ist der Effekt erlaubt? */
export function effectEnabled(name: EffectName): boolean {
  if (disabled.has("all")) return false;
  return !disabled.has(name);
}

/** Nur für die Anzeige im Browser: welche Schalter waren aktiv? */
export function disabledEffects(): string[] {
  return [...disabled];
}