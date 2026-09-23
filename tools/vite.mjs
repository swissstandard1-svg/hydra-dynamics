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

const mode = process.argv[2] ?? "build";

if (mode === "serve") {
  const server = await preview({ ...config, preview: { ...config.preview, open: false } });
  server.printUrls();
} else {
  await build(config);
  console.log("Build fertig (dist/).");
}