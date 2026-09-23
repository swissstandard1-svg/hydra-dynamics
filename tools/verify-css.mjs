/**
 * Prüfwerkzeug für die Stil-Kette: keine Annahmen, sondern Ausgabe.
 *
 *   node tools/verify-css.mjs
 *
 * Prüft drei Dinge:
 *   1. Wird der @theme-Block verarbeitet (Design-System kennt die Tokens)?
 *   2. Erkennt Tailwind die Utility-Klassen aus index.html?
 *   3. Landen die Variablen tatsächlich im erzeugten Stylesheet?
 */

import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "tools/styles-entry.css");
const output = resolve(root, "src/styles/tailwind.css");
const markup = resolve(root, "index.html");

const css = await readFile(entry, "utf8");
const design = await __unstable__loadDesignSystem(css, { base: root });

const probe = ["--color-cyan", "--color-abyss", "--font-display", "--radius-card", "--shadow-glow"];
console.log("— Theme-Variablen —");
for (const token of probe) {
  const value = design.resolveThemeValue(token);
  console.log(`  ${token.padEnd(16)} ${value ? "✓" : "✗ fehlt"}`);
}

const html = await readFile(markup, "utf8");
const classes = new Set(html.match(/(?<=class=")[^"]+/g)?.flatMap((list) => list.split(/\s+/)) ?? []);

/** Eigene Komponentenklassen (BEM) sind gewollt und keine Tailwind-Utilities. */
const isOwnClass = (name) => name.includes("__") || name.includes("--") || name.startsWith("is-");

const utilities = [...classes].filter((name) => name && !isOwnClass(name));
console.log(`— Klassen im Markup: ${classes.size} (davon ${utilities.length} Utility-Kandidaten) —`);

const generated = await readFile(output, "utf8");
let missing = 0;
for (const klass of utilities) {
  if (design.candidatesToAst([klass]).some((nodes) => nodes.length > 0)) continue;
  if (generated.includes(klass)) continue;
  console.log(`  ✗ nicht auflösbar und nicht im CSS: ${klass}`);
  missing += 1;
}
console.log(missing === 0 ? "  ✓ alle Utilities auflösbar" : `  ${missing} Utility-Klasse(n) ohne Auflösung`);

const hasVars = generated.includes("--color-cyan:") && generated.includes("--color-abyss:");
console.log(`— Erzeugtes CSS: ${(Buffer.byteLength(generated, "utf8") / 1024).toFixed(1)} kB, Tokens ${hasVars ? "✓" : "✗"} —`);