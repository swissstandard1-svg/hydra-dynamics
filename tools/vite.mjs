/**
 * Vite-Build über die Node-API statt über die CLI.
 *
 * Grund: Die Vite-CLI bündelt vor jedem Start `vite.config.ts` mit Rolldown.
 * Auf diesem Windows-System läuft dabei Vites `optimizeSafeRealPathSync()` in
 * einen Zweig, der `subst`/`net use` als Kindprozess aufruft — unter der
 * Sandbox ein `spawn EPERM`. Ohne Config-Datei entfällt der Schritt komplett,
 * die Einstellungen stehen hier direkt im Aufruf.
 */

import { build, preview } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Gemeinsame Einstellungen für Build und Vorschau. */
const config = {
  configFile: false,
  root: projectRoot,
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    cssCodeSplit: false,
    // Der Preload-Polyfill hilft nur alten Browsern; moderne Zielgruppe spart die Bytes.
    modulePreload: { polyfill: false },
    reportCompressedSize: true,
    // Kein manuelles Chunking: Rolldown (Vite 8) erwartet hier eine Funktion,
    // und die Seite ist klein genug, dass der Bundler selbst gut aufteilt.
  },
  preview: { port: 4173, strictPort: true },
  server: { port: 5173, strictPort: true },
};

/**
 * Stylesheet nach dem Build direkt in das HTML schreiben.
 *
 * Warum? Das verlinkte CSS war die einzige render-blockierende Anfrage
 * (im Modell 152 ms) und lag damit auf dem kritischen Pfad vor dem ersten
 * Bild. Bei einer Seite ohne CSS-Code-Splitting ist das Einbetten der
 * einfachere und schnellere Weg: ein Roundtrip weniger, kein Aufblitzen
 * ungestylter Inhalte. Das HTML wächst dadurch um wenige Kilobyte gzip.
 */
async function inlineStylesheet() {
  const { readFile, writeFile, rm } = await import("node:fs/promises");

  const htmlPath = resolve(projectRoot, "dist/index.html");
  let html = await readFile(htmlPath, "utf8");

  const tag = html.match(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
  if (!tag) {
    console.log("Kein Stylesheet-Link gefunden — nichts eingebettet.");
    return;
  }

  const href = tag[1].replace(/^\.\//, "/");
  const cssPath = resolve(projectRoot, "dist", href.replace(/^\//, ""));
  const css = await readFile(cssPath, "utf8");

  html = html.replace(tag[0], `<style>${css}</style>`);
  await writeFile(htmlPath, html, "utf8");
  await rm(cssPath, { force: true });

  // Nur die gerade eingebettete Datei entfernen — und nur, wenn die Einbettung
  // wirklich stattgefunden hat. Quelldateien unter src/ werden nie angefasst.
  if (!cssPath.startsWith(resolve(projectRoot, "dist"))) {
    throw new Error("Sicherung: Pfad liegt ausserhalb von dist/");
  }

  console.log(`Stylesheet eingebettet: ${(Buffer.byteLength(css, "utf8") / 1024).toFixed(1)} kB roh, kein externer CSS-Request mehr.`);
}

const mode = process.argv[2] ?? "build";

if (mode === "serve") {
  const server = await preview({ ...config, preview: { ...config.preview, open: false } });
  server.printUrls();
} else {
  await build(config);
  await inlineStylesheet();
  console.log("Build fertig (dist/).");
}