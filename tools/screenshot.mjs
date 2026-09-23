/**
 * Screenshots des gebauten Stands über das Chrome DevTools Protocol.
 *
 *   node tools/screenshot.mjs --url=http://localhost:4173/ --out=audit/shots
 *
 * Warum eigener Weg statt einer Bibliothek? Chrome startet in dieser Umgebung
 * nur ohne Sandbox, und das Protokoll ist mit wenigen Nachrichten bedient:
 * Seite laden, Einblend-Animationen abschliessen lassen, aufnehmen.
 *
 * Die Bilder landen in audit/ (nicht versioniert) — Belege, keine Projektdateien.
 */

import * as chromeLauncher from "chrome-launcher";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const [key, value = "true"] = entry.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chromePath) {
  console.error("Kein Chrome gefunden.");
  process.exit(2);
}

const url = args.url ?? "http://localhost:4173/";
const outDir = resolve(root, args.out ?? "audit/shots");
const waitMs = Number(args.wait ?? 2200);

const views = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Kleiner CDP-Client: eine Verbindung, Anfragen mit fortlaufender Kennung. */
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: done, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.method ?? ""})`));
        else done(message.result);
        return;
      }
      for (const handler of this.listeners.get(message.method) ?? []) handler(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((done, reject) => {
      this.pending.set(id, { resolve: done, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((done) => {
      const handler = (params) => {
        this.listeners.get(method)?.delete(handler);
        done(params);
      };
      if (!this.listeners.has(method)) this.listeners.set(method, new Set());
      this.listeners.get(method).add(handler);
    });
  }
}

async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", () => fail(new Error("CDP-Verbindung fehlgeschlagen")), { once: true });
  });
  return new Cdp(socket);
}

const chrome = await chromeLauncher.launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--disable-dev-shm-usage"],
});

try {
  // Direkt am Tab verbinden: Am Browser-Endpunkt fehlt die Page-Domain.
  const targets = await (await fetch(`http://127.0.0.1:${chrome.port}/json`)).json();
  const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!pageTarget) throw new Error("Kein Tab zum Verbinden gefunden");

  const session = await connect(pageTarget.webSocketDebuggerUrl);
  const send = (method, params = {}) => session.send(method, params);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });

  await mkdir(outDir, { recursive: true });
  const written = [];

  for (const view of views) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: view.width,
      height: view.height,
      deviceScaleFactor: 1,
      mobile: view.mobile,
    });
    if (view.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

    const loaded = session.once("Page.loadEventFired");
    await send("Page.navigate", { url });
    await loaded;
    await sleep(waitMs);

    // Einblendungen sofort abschliessen und einmal durchscrollen, damit auch
    // Abschnitte unterhalb des ersten Bildes sichtbar aufgenommen werden.
    await send("Runtime.evaluate", {
      expression: `
        document.querySelectorAll('[data-reveal], [data-split]').forEach((el) => el.classList.add('is-revealed'));
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, document.body.scrollHeight);
      `,
    });
    await sleep(900);
    await send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
    await sleep(500);

    const heightResult = await send("Runtime.evaluate", { expression: "document.documentElement.scrollHeight" });
    const fullHeight = Math.min(Number(heightResult.result.value ?? 2000), 12000);

    const state = await send("Runtime.evaluate", {
      expression:
        "JSON.stringify({fehler: document.documentElement.dataset.jsErrors ?? '0', effekte: document.documentElement.dataset.effects ?? 'nicht gestartet', bewegung: document.documentElement.dataset.motion})",
    });

    const full = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: view.width, height: fullHeight, scale: 1 },
    });
    const fullPath = resolve(outDir, `hydra-${view.name}-full.png`);
    await writeFile(fullPath, Buffer.from(full.data, "base64"));
    written.push(fullPath);

    const fold = await send("Page.captureScreenshot", { format: "png" });
    const foldPath = resolve(outDir, `hydra-${view.name}-fold.png`);
    await writeFile(foldPath, Buffer.from(fold.data, "base64"));
    written.push(foldPath);

    console.log(`${view.name} ${view.width}×${view.height}: Seite ${fullHeight}px hoch · ${state.result.value}`);
  }

  for (const file of written) console.log(`  → ${file}`);
} finally {
  beende(chrome);
}

/** Chrome beenden — der Aufräumfehler von chrome-launcher darf das Ergebnis nicht verfälschen. */
function beende(instanz) {
  try {
    instanz.kill();
  } catch {
    // Aufräumen ist best effort
  }
}
