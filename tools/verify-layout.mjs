/**
 * Layout-Prüfung im echten Browser.
 *
 *   node tools/verify-layout.mjs --url=http://localhost:4173/
 *
 * Prüft bei mehreren Bildschirmbreiten Dinge, die man im Code nicht sieht:
 * Überlappungen im Kopf, waagerechter Überlauf, Streichung von Dekoration,
 * Fehlerzähler der Seite. Genau diese Klasse Fehler ist beim Bauen aufgetreten
 * (der Kopf-Button stand auf schmalen Geräten neben dem Menü-Icon).
 *
 * Exit-Code 1, sobald ein Befund vorliegt.
 */

import * as chromeLauncher from "chrome-launcher";
import { existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chromePath) {
  console.error("Kein Chrome gefunden — Layout-Prüfung übersprungen (Exit 2).");
  process.exit(2);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const [key, value = "true"] = entry.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const url = args.url ?? "http://localhost:4173/";
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const viewports = [
  { name: "schmal (390)", width: 390, height: 844, mobile: true },
  { name: "mittel (768)", width: 768, height: 1024, mobile: true },
  { name: "breit (1440)", width: 1440, height: 900, mobile: false },
];

/** Prüfungen, die im Browserkontext laufen. */
const PROBE = `(() => {
  const sichtbar = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const rechteck = (sel) => {
    const el = document.querySelector(sel);
    if (!el || !sichtbar(el)) return null;
    const r = el.getBoundingClientRect();
    return { links: Math.round(r.left), rechts: Math.round(r.right), oben: Math.round(r.top), unten: Math.round(r.bottom) };
  };
  const überlappt = (a, b) => {
    if (!a || !b) return false;
    return a.links < b.rechts && b.links < a.rechts && a.oben < b.unten && b.oben < a.unten;
  };

  const nav = rechteck(".nav");
  const cta = rechteck(".header__cta");
  const toggle = rechteck("#nav-toggle");
  const brand = rechteck(".site-header .brand");

  const breit = window.innerWidth;
  const befund = [];

  if (überlappt(cta, toggle)) befund.push("Kopf: CTA überlappt das Menü-Icon");
  if (überlappt(brand, cta)) befund.push("Kopf: Marke überlappt den CTA");
  if (überlappt(brand, toggle)) befund.push("Kopf: Marke überlappt das Menü-Icon");
  if (breit < 992 && nav) befund.push("Kopf: Navigation ist auf schmalen Geräten sichtbar");
  if (breit < 992 && cta) befund.push("Kopf: CTA ist auf schmalen Geräten sichtbar");

  const überlauf = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (überlauf > 2) befund.push("Waagerechter Überlauf: " + überlauf + " px");

  // Dekoration darf keine Trefferflächen abfangen
  for (const sel of [".grain", ".ambient", ".cursor", ".scroll-progress"]) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const s = getComputedStyle(el);
    if (s.pointerEvents !== "none") befund.push("Dekoration fängt Zeiger ab: " + sel);
  }

  // Unsichtbare Bedienelemente sind ein Barrierefreiheitsproblem
  const ohneNamen = [...document.querySelectorAll("button, a")].filter((el) => {
    const text = (el.textContent || "").trim();
    const label = el.getAttribute("aria-label") || el.getAttribute("title");
    return !text && !label;
  }).length;
  if (ohneNamen > 0) befund.push(ohneNamen + " Bedienelement(e) ohne Namen");

  return JSON.stringify({
    breite: breit,
    befund,
    fehler: document.documentElement.dataset.jsErrors ?? "0",
    effekte: document.documentElement.dataset.effects ?? "nicht gestartet",
    kopf: { brand, nav, cta, toggle },
    überlauf,
  });
})()`;

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: done } = this.pending.get(message.id);
        this.pending.delete(message.id);
        done(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((done) => {
      this.pending.set(id, { resolve: done });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

const chrome = await chromeLauncher.launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

let failed = false;
try {
  const targets = await (await fetch(`http://127.0.0.1:${chrome.port}/json`)).json();
  const page = targets.find((target) => target.type === "page");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done) => socket.addEventListener("open", done, { once: true }));
  const cdp = new Cdp(socket);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  console.log(`Layout-Prüfung gegen ${url}\n`);

  for (const view of viewports) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: view.width,
      height: view.height,
      deviceScaleFactor: 1,
      mobile: view.mobile,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: view.mobile, maxTouchPoints: view.mobile ? 5 : 0 });
    await cdp.send("Page.navigate", { url });
    await sleep(2600);

    const result = await cdp.send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
    const state = JSON.parse(result.result.value);
    const findings = [...state.befund];
    if (state.fehler !== "0") findings.push(`JavaScript-Fehler: ${state.fehler}`);

    console.log(
      `  ${findings.length === 0 ? "✓" : "✗"} ${view.name}: Überlauf ${state.überlauf} px · Effekte ${state.effekte} · Kopf ${JSON.stringify(state.kopf)}`,
    );
    for (const finding of findings) console.log(`      → ${finding}`);
    if (findings.length) failed = true;
  }
} finally {
  beende(chrome);
}

console.log(failed ? "\nLayout: Befunde offen." : "\nLayout: alle Prüfungen bestanden.");
process.exit(failed ? 1 : 0);

/** Chrome beenden — der Aufräumfehler von chrome-launcher darf das Ergebnis nicht verfälschen. */
function beende(instanz) {
  try {
    instanz.kill();
  } catch {
    // Aufräumen ist best effort
  }
}
