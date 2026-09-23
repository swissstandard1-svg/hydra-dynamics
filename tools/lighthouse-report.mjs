/**
 * Lily: Diagnose eines Lighthouse-Berichts.
 *
 *   node tools/lighthouse-report.mjs            # audit/lighthouse.json auswerten
 *
 * Zeigt die Audits mit Optimierungspotenzial und die wichtigsten Kennzahlen,
 * statt im HTML-Bericht zu scrollen.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = resolve(root, process.argv[2] ?? "audit/lighthouse.json");
const report = JSON.parse(await readFile(reportPath, "utf8"));

console.log(`Bericht: ${reportPath}`);
console.log(`Gerät:   ${report.configSettings.formFactor} · ${report.configSettings.screenEmulation.width}×${report.configSettings.screenEmulation.height}`);
console.log("\nKategorien");
for (const category of Object.values(report.categories)) {
  console.log(`  ${String(Math.round((category.score ?? 0) * 100)).padStart(3)}  ${category.title}`);
}

console.log("\nKennzahlen");
for (const audit of Object.values(report.audits)) {
  if (audit.scoreDisplayMode !== "numeric" || !audit.displayValue) continue;
  if (!["first-contentful-paint", "largest-contentful-paint", "speed-index", "total-blocking-time", "cumulative-layout-shift", "interactive"].includes(audit.id)) continue;
  console.log(`  ${audit.title}: ${audit.displayValue}`);
}

console.log("\nOptimierungspotenzial (nach Einsparung sortiert)");
const opportunities = Object.values(report.audits)
  .filter((audit) => audit.score !== null && audit.score < 0.9 && audit.details?.overallSavingsMs > 0)
  .sort((a, b) => (b.details.overallSavingsMs ?? 0) - (a.details.overallSavingsMs ?? 0));
if (opportunities.length === 0) console.log("  keins gefunden");
for (const audit of opportunities) {
  console.log(`  ${(audit.displayValue ?? "").padStart(10)}  ${audit.title}`);
}

console.log("\nAuffällige Diagnosen");
for (const id of [
  "mainthread-work-breakdown",
  "bootup-time",
  "render-blocking-resources",
  "unused-javascript",
  "uses-text-compression",
  "network-requests",
  "font-display",
  "third-party-summary",
  "diagnostics",
]) {
  const audit = report.audits[id];
  if (!audit) continue;
  if (id === "diagnostics") continue;
  const value = audit.displayValue ? `${audit.displayValue} — ` : "";
  console.log(`  ${value}${audit.title}`);
}

if (report.audits["network-requests"]?.details?.items) {
  const items = report.audits["network-requests"].details.items
    .slice()
    .sort((a, b) => (b.transferSize ?? 0) - (a.transferSize ?? 0))
    .slice(0, 6);
  console.log("\nGrösste Übertragungen");
  for (const item of items) {
    const kb = ((item.transferSize ?? 0) / 1024).toFixed(1);
    console.log(`  ${kb.padStart(8)} kB  ${item.url.slice(0, 110)}`);
  }
}