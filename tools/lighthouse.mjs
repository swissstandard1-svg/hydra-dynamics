/**
 * Lighthouse-Audit als Gate.
 *
 *   node tools/lighthouse.mjs            # gegen den Build in dist/
 *   node tools/lighthouse.mjs --url=…    # gegen eine laufende Instanz
 *
 * Ablauf: Chrome headless starten → Seite messen → Berichte schreiben
 * (audit/lighthouse.{html,json}) → Schwellen prüfen → Exit-Code 1 bei Verstoss.
 *
 * Hinweis zur Umgebung: Läuft der Prozess in einer Sandbox, die keine
 * benannten Pipes erlaubt (Chrome bricht dann mit `mojo platform_channel`
 * ab), schlägt der Start fehl und das Skript sagt das offen. In CI und auf
 * einem normalen Entwicklungsrechner funktioniert es.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, "audit");

const THRESHOLDS = { performance: 90, accessibility: 95, "best-practices": 95, seo: 95 };

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const [key, value = "true"] = entry.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chromePath) {
  console.error("Kein Chrome gefunden. CHROME_PATH setzen oder Chrome installieren.");
  process.exit(2);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

/** Minimaler Dateiserver für dist/ — kein zusätzliches Paket nötig. */
async function serveDist(port) {
  const dist = resolve(root, "dist");
  if (!existsSync(dist)) throw new Error("dist/ fehlt — bitte zuerst `npm run build` ausführen.");
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      let filePath = resolve(dist, `.${url.pathname}`);
      if (!filePath.startsWith(dist)) throw new Error("Pfad ausserhalb von dist");
      if (!existsSync(filePath) || url.pathname === "/") filePath = join(dist, "index.html");
      const body = await readFile(filePath);
      response.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end("nicht gefunden");
    }
  });
  await new Promise((done) => server.listen(port, done));
  return server;
}

const port = Number(args.port ?? 4173);
const url = args.url ?? `http://localhost:${port}/`;
const server = args.url ? null : await serveDist(port);

let chrome;
try {
  chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
} catch (error) {
  console.error(`Chrome konnte nicht starten: ${error.message}`);
  console.error("In einer Umgebung ohne benannte Pipes ist dieser Schritt nicht möglich — siehe Kopfkommentar.");
  server?.close();
  process.exit(2);
}

try {
  const result = await lighthouse(
    url,
    { port: chrome.port, output: ["html", "json"], logLevel: "error" },
    {
      extends: "lighthouse:default",
      settings: {
        formFactor: "desktop",
        screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
      },
    },
  );

  await mkdir(outputDir, { recursive: true });
  const [htmlReport, jsonReport] = result.report;
  await writeFile(resolve(outputDir, "lighthouse.html"), htmlReport, "utf8");
  await writeFile(resolve(outputDir, "lighthouse.json"), jsonReport, "utf8");

  const scores = result.lhr.categories;
  let failed = false;
  console.log(`Lighthouse gegen ${url}\n`);
  for (const [key, threshold] of Object.entries(THRESHOLDS)) {
    const category = scores[key];
    const value = Math.round((category?.score ?? 0) * 100);
    const ok = value >= threshold;
    if (!ok) failed = true;
    console.log(`  ${ok ? "✓" : "✗"} ${category?.title ?? key}: ${value} (Schwelle ${threshold})`);
  }

  const metrics = result.lhr.audits;
  for (const id of ["first-contentful-paint", "largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time"]) {
    const audit = metrics[id];
    if (audit) console.log(`  · ${audit.title}: ${audit.displayValue ?? "—"}`);
  }

  console.log(`\nBericht: ${resolve(outputDir, "lighthouse.html")}`);
  process.exit(failed ? 1 : 0);
} finally {
  beende(chrome);
  server?.close();
}

/** Chrome beenden — der Aufräumfehler von chrome-launcher darf das Ergebnis nicht verfälschen. */
function beende(instanz) {
  try {
    instanz.kill();
  } catch {
    // Aufräumen ist best effort
  }
}
