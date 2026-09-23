/**
 * Zeitmessung im echten Browser: wann stehen Schrift, H1 und Blöcke?
 *
 *   node tools/measure-timing.mjs --url=http://localhost:4173/
 *
 * Nutzt die Performance-Zeitachse: First Paint, LCP, Schriftfreigabe und die
 * Dauer der gestellten Anfragen. Damit lässt sich eine schlechte Bildzeit
 * eingrenzen, statt sie zu erraten.
 */

import * as chromeLauncher from "chrome-launcher";
import { existsSync } from "node:fs";

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
].filter(Boolean).find((candidate) => existsSync(candidate));

if (!chromePath) {
  console.error("Kein Chrome gefunden (Exit 2).");
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

try {
  const targets = await (await fetch(`http://127.0.0.1:${chrome.port}/json`)).json();
  const page = targets.find((target) => target.type === "page");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done) => socket.addEventListener("open", done, { once: true }));
  const cdp = new Cdp(socket);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // CPU-Drosselung wie Lighthouse: so sind die Zahlen vergleichbar
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Page.navigate", { url });
  await sleep(4500);

  const result = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const marken = performance.getEntriesByType("paint").map(e => [e.name, Math.round(e.startTime)]);
      const lcp = performance.getEntriesByType("largest-contentful-paint").map(e => [e.element?.tagName + "#" + (e.element?.id || e.element?.className?.toString().slice(0,30)), Math.round(e.startTime)]);
      const ressourcen = performance.getEntriesByType("resource").map(e => ({
        name: e.name.split("/").pop(),
        start: Math.round(e.startTime),
        dauer: Math.round(e.duration),
        typ: e.initiatorType,
        groesse: e.transferSize,
      })).sort((a,b) => b.start - a.start).slice(0, 10);

      const h1 = document.querySelector("h1");
      const stil = getComputedStyle(h1);
      const schrift = document.fonts.check(stil.fontSize + " " + stil.fontFamily);

      return JSON.stringify({
        marken,
        lcp,
        ressourcen,
        schriftBereit: schrift,
        schriftStatus: document.fonts.status,
        geladeneSchriften: [...document.fonts].map(f => f.family + " " + f.weight + " " + f.status),
        h1Kinder: h1.querySelectorAll("span").length,
        lcpKandidat: h1.textContent.slice(0, 30),
      });
    })()`,
  });

  const data = JSON.parse(result.result.value);
  console.log(`Messung gegen ${url} (CPU 4× gedrosselt)\n`);
  console.log("Zeitmarken:", data.marken.map(([name, time]) => `${name} ${time} ms`).join(" · "));
  console.log("LCP:", data.lcp.map(([who, time]) => `${who} @ ${time} ms`).join(" · "));
  console.log(`Schrift bereit: ${data.schriftBereit} (Status: ${data.schriftStatus}) — geladen: ${data.geladeneSchriften.filter((s) => s.includes('loaded') && !s.includes('unloaded')).length}, Fehler: ${data.geladeneSchriften.filter((s) => s.includes('error')).length}`);
  console.log("Schriften:", data.geladeneSchriften.join(" | "));
  console.log(`H1: ${data.h1Kinder} Span-Kinder — „${data.lcpKandidat}“`);
  console.log("\nSpäteste Netzwerkanfragen:");
  for (const r of data.ressourcen) {
    console.log(`  +${String(r.start).padStart(5)} ms  ${String(r.dauer).padStart(4)} ms  ${String(r.groesse).padStart(7)} B  ${r.typ.padEnd(8)} ${r.name}`);
  }
} finally {
  try {
    chrome.kill();
  } catch {
    // best effort
  }
}