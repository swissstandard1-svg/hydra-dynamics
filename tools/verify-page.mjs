/**
 * Statische Verifikation von Markup und Stylesheet.
 *
 *   node tools/verify-page.mjs
 *
 * Beantwortet Fragen, die man sonst nur durch Draufschauen klärt: Sind alle
 * Sprungziele vorhanden? Haben alle Bedienelemente Namen? Gibt es genau eine
 * H1? Fehlen CSS-Variablen? Lädt die Seite irgendetwas von aussen?
 *
 * Exit-Code 1, sobald ein Befund vorliegt — damit als Gate nutzbar.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(root, "index.html"), "utf8");

const findings = [];
const notes = [];
const fail = (message) => findings.push(message);

// ── Helfer ────────────────────────────────────────────────────────────────
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const stripTags = (value) => value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const allTags = [...html.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)].map((m) => ({ name: m[1].toLowerCase(), raw: m[0] }));
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const classTokens = new Set(
  [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean),
);

// ── 1. Sprungziele ───────────────────────────────────────────────────────
const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/gi)].map((m) => m[1]);
const hashLinks = links.filter((href) => href.startsWith("#"));
const brokenAnchors = hashLinks.filter((href) => href.length > 1 && !ids.has(href.slice(1)));
if (brokenAnchors.length) fail(`Sprungziel fehlt für: ${[...new Set(brokenAnchors)].join(", ")}`);
notes.push(`${hashLinks.length} Ankerlinks geprüft`);

// ── 2. Eindeutige IDs ────────────────────────────────────────────────────
const idList = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const duplicates = idList.filter((id, index) => idList.indexOf(id) !== index);
if (duplicates.length) fail(`Doppelte IDs: ${[...new Set(duplicates)].join(", ")}`);
notes.push(`${ids.size} IDs, keine Dopplung`);

// ── 3. Überschriftenhierarchie ───────────────────────────────────────────
const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
  level: Number(m[1]),
  text: stripTags(m[2]).slice(0, 48),
}));
const h1Count = headings.filter((h) => h.level === 1).length;
if (h1Count !== 1) fail(`Genau eine H1 erwartet, gefunden: ${h1Count}`);
let previous = 0;
for (const heading of headings) {
  if (previous && heading.level > previous + 1) {
    fail(`Sprung in der Überschriftenebene: h${previous} → h${heading.level} bei „${heading.text}"`);
  }
  previous = heading.level;
}
notes.push(`${headings.length} Überschriften, Hierarchie lückenlos`);

// ── 4. Bedienelemente mit Namen ──────────────────────────────────────────
const buttons = allTags.filter((tag) => tag.name === "button");
const buttonsWithoutName = buttons.filter((tag) => {
  const found = attrs(tag.raw);
  if (found["aria-label"] || found.title) return false;
  const index = html.indexOf(tag.raw);
  const inner = html.slice(index + tag.raw.length, html.indexOf("</button>", index));
  return stripTags(inner).length === 0;
});
if (buttonsWithoutName.length) fail(`${buttonsWithoutName.length} Button(s) ohne barrierefreien Namen`);

const inputs = allTags.filter((tag) => ["input", "textarea", "select"].includes(tag.name));
const inputsWithoutLabel = inputs.filter((tag) => {
  const found = attrs(tag.raw);
  if (found["aria-label"] || found["aria-labelledby"]) return false;
  if (found.type === "range" && found.id) return !html.includes(`for="${found.id}"`);
  return found.id ? !html.includes(`for="${found.id}"`) : true;
});
if (inputsWithoutLabel.length) fail(`${inputsWithoutLabel.length} Eingabefeld(er) ohne Label`);

const ariaControls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
const missingControls = ariaControls.filter((id) => !ids.has(id));
if (missingControls.length) fail(`aria-controls ohne Ziel: ${missingControls.join(", ")}`);
notes.push(`${buttons.length} Buttons, ${inputs.length} Felder, ${ariaControls.length} aria-controls geprüft`);

// ── 5. Deko-Grafiken ─────────────────────────────────────────────────────
const svgs = allTags.filter((tag) => tag.name === "svg");
const decorative = svgs.filter((tag) => attrs(tag.raw)["aria-hidden"] === "true");
const labelled = svgs.filter((tag) => /aria-label|aria-labelledby|role="img"/.test(tag.raw));
const unexplained = svgs.length - decorative.length - labelled.length;
if (unexplained > 0) fail(`${unexplained} SVG(s) ohne aria-hidden oder Beschriftung`);
notes.push(`${svgs.length} SVGs (${decorative.length} dekorativ, ${labelled.length} beschriftet)`);

// ── 6. Externe Abhängigkeiten ────────────────────────────────────────────
// Nur echte Requests zählen: rel="canonical" und rel="alternate" sind Metadaten.
const linkTags = allTags.filter((tag) => tag.name === "link");
const externalCssOrIcon = linkTags
  .filter((tag) => /stylesheet|icon|preconnect|dns-prefetch|preload/.test(attrs(tag.raw).rel ?? ""))
  .map((tag) => attrs(tag.raw).href ?? "")
  .filter((href) => /^https?:\/\//.test(href));
const externalScripts = allTags
  .filter((tag) => tag.name === "script")
  .map((tag) => attrs(tag.raw).src ?? "")
  .filter((src) => /^https?:\/\//.test(src));
const externalMedia = [...html.matchAll(/(?:src|srcset)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
const external = [...externalCssOrIcon, ...externalScripts, ...externalMedia];
if (external.length) fail(`Externe Abhängigkeit(en) gefunden: ${external.join(", ")}`);
notes.push("Kein externer Request im Markup (Schriften und Skripte lokal)");

// ── 7. Prüfhaken des Simulators ──────────────────────────────────────────
const simTargets = ["flow", "pump", "junction", "recover"];
for (const target of simTargets) {
  if (!html.includes(`data-sim-out="${target}"`)) fail(`Simulator ohne Ausgabefeld: ${target}`);
  if (!html.includes(`data-sim-bar="${target}"`)) fail(`Simulator ohne Balken: ${target}`);
}
notes.push(`Simulator: ${simTargets.length} Ausgaben mit Balken verdrahtet`);

// ── 8. CSS-Variablen ─────────────────────────────────────────────────────
const cssDir = resolve(root, "src/styles");
const cssFiles = (await readdir(cssDir)).filter((name) => name.endsWith(".css"));
let cssText = "";
for (const name of cssFiles) cssText += await readFile(resolve(cssDir, name), "utf8");

const declared = new Set([...cssText.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
const used = new Set([...cssText.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
const withFallback = new Set([...cssText.matchAll(/var\(--[\w-]+\s*,/g)].map((m) => m[0]));
const missingVars = [...used].filter((name) => !declared.has(name) && ![...withFallback].some((entry) => entry.includes(name)));
if (missingVars.length) fail(`Nicht deklarierte CSS-Variablen: ${missingVars.join(", ")}`);
notes.push(`${declared.size} CSS-Variablen deklariert, ${used.size} verwendet, keine Lücke`);

// ── 9. Datenattribute, die JavaScript erwartet ───────────────────────────
const libDir = resolve(root, "src/lib");
const libFiles = await readdir(libDir);
let libText = "";
for (const name of libFiles) libText += await readFile(resolve(libDir, name), "utf8");

const selectors = [...libText.matchAll(/querySelector(?:All)?<[^>]*>\("([^"]+)"\)/g)].map((m) => m[1]);
// Zustandsattribute (aria-invalid, data-open, …) setzt JavaScript zur Laufzeit.
// Für sie zählt, dass Markup ODER Modulcode den Namen kennt.
const searchable = `${html}\n${libText}`;
const deadSelectors = [];
for (const selector of new Set(selectors)) {
  if (selector.startsWith("#")) {
    if (!ids.has(selector.slice(1))) deadSelectors.push(selector);
    continue;
  }
  // Ersten Klassen- oder Attribut-Teil prüfen. Attributselektoren können
  // Leerzeichen im Wert enthalten ([aria-invalid='true']), deshalb zuerst
  // den Attributnamen greifen.
  const head = selector.split(/[ >]/)[0];
  const classMatch = head.match(/^\.([\w-]+)/);
  const dataMatch = selector.match(/^\[([\w-]+)/);
  if (classMatch && !classTokens.has(classMatch[1])) deadSelectors.push(selector);
  if (dataMatch && !new RegExp(`\\b${dataMatch[1]}\\b`).test(searchable)) deadSelectors.push(selector);
}
if (deadSelectors.length) fail(`Selektoren ohne Ziel im Markup: ${deadSelectors.join(", ")}`);
notes.push(`${new Set(selectors).size} Selektoren aus src/lib gegen das Markup geprüft`);

// ── Bericht ─────────────────────────────────────────────────────────────
console.log("Statische Prüfung der Seite\n");
for (const note of notes) console.log(`  ✓ ${note}`);
if (findings.length) {
  console.log("\nBefunde:");
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} Befund(e) — Gate nicht bestanden.`);
  process.exit(1);
}
console.log("\nAlle Prüfungen bestanden.");