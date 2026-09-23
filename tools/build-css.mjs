/**
 * Tailwind-CSS-Build als eigener Schritt.
 *
 * Warum nicht das Vite-Plugin? Beim Bündeln der Vite-Config versucht Rolldown,
 * die native Tailwind-Bindung als Config-Abhängigkeit zu lesen, und bricht mit
 * „stream did not contain valid UTF-8" ab. Die Node-API von `@tailwindcss/node`
 * (dasselbe Rust-Backend wie das Plugin) läuft zuverlässig und lässt sich
 * direkt prüfen.
 *
 * Eingabe : tools/styles-entry.css (zieht Tokens, Basis, Komponenten herein)
 * Ausgabe : src/styles/tailwind.css
 */

import { compile } from "@tailwindcss/node";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(projectRoot, "tools/styles-entry.css");
const output = resolve(projectRoot, "src/styles/tailwind.css");

const css = await readFile(entry, "utf8");

// Utility-Quellen: Markup und Quellcode. `base` muss der Projektwurzel
// entsprechen, sonst findet Tailwind die Dateien nicht.
const candidates = ["index.html", "src/**/*.{ts,html}"];

const compiler = await compile(css, {
  base: projectRoot,
  from: entry,
  onDependency: () => {},
});

const result = compiler.build(candidates);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, result, "utf8");

const size = Buffer.byteLength(result, "utf8");
console.log(`tailwind.css erzeugt: ${size.toLocaleString("de-DE")} Bytes aus ${candidates.length} Quellmustern.`);