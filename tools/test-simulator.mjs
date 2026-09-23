/**
 * Prüfung der Rechenlogik des Simulators — eigenständiges Skript ohne
 * Testframework, damit es ohne Zusatzinstallation läuft.
 *
 *   node tools/test-simulator.mjs
 *
 * Die Physik liegt in src/lib/simulation.mjs (reines JavaScript), deshalb kann
 * dieses Skript sie direkt laden — ohne Transpiler und ohne zweite Kopie.
 * Referenzwerte sind von Hand nachgerechnet und stehen als Kommentar dabei.
 */

import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = resolve(root, "src/lib/simulation.mjs");
const { simulate, CHIPS_PER_RACK, SPREAD_K } = await import(pathToFileURL(modulePath).href);

let failures = 0;

const check = (condition, label, detail) => {
  if (!condition) failures += 1;
  console.log(`  ${condition ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const near = (actual, expected, tolerance, label) =>
  check(Math.abs(actual - expected) <= tolerance, label, `${actual.toFixed(3)} (erwartet ${expected} ±${tolerance})`);

console.log(`Referenzfall: 12 kW, 38 °C Vorlauf, 0,018 K/W je Chip (${CHIPS_PER_RACK} Chips, ${SPREAD_K} K Spreizung)`);
const reference = simulate({ loadKw: 12, inletC: 38, rth: 0.018 });
// Handrechnung: P_Chip = 12/32 = 0,375 kW → ΔT = 0,018 × 375 = 6,75 K → 44,75 °C
//               ṁ = 12/(4,19 × 30) = 0,0955 kg/s;  ρ(53 °C) = 987 kg/m³ → 0,348 m³/h
//               Δp(0,343 m³/h) = 350 mbar × 0,1 × (0,343/1,3)² = 2,4 kPa
//               P = (0,0955/987) × 2,4 / 0,78 ≈ 0,0003 kW → im plausiblen Bereich
near(reference.chipKw, 0.375, 0.001, "Wärmelast je Chip in kW");
near(reference.junctionC, 44.75, 0.15, "Junction-Temperatur in °C");
near(reference.flowM3h, 0.348, 0.012, "Volumenstrom in m³/h");
near(reference.returnC, 68, 0.01, "Rücklauftemperatur in °C");
near(reference.recoverPercent, 100, 0.5, "nutzbare Abwärme in %");
check(reference.pumpKw > 0.0001 && reference.pumpKw < 0.01, "Pumpenleistung im plausiblen Bereich", `${reference.pumpKw.toFixed(4)} kW`);

console.log("Monotonie");
const heavier = simulate({ loadKw: 24, inletC: 38, rth: 0.018 });
check(heavier.flowM3h > reference.flowM3h, "mehr Last → mehr Volumenstrom", `${reference.flowM3h.toFixed(3)} → ${heavier.flowM3h.toFixed(3)} m³/h`);
check(heavier.junctionC > reference.junctionC, "mehr Last → heissere Junction", `${heavier.junctionC.toFixed(1)} °C`);
check(Math.abs(heavier.flowM3h - reference.flowM3h * 2) < 0.005, "Volumenstrom skaliert linear mit der Last");

const better = simulate({ loadKw: 12, inletC: 38, rth: 0.012 });
check(better.junctionC < reference.junctionC, "kleinerer Wärmewiderstand → kühlere Junction", `${better.junctionC.toFixed(1)} °C`);

const colder = simulate({ loadKw: 12, inletC: 30, rth: 0.018 });
// Rücklauf 60 °C liegt genau 5 K über der Fernwärmegrenze von 55 °C.
check(colder.recoverPercent === 100, "Vorlauf 30 °C → Rücklauf 60 °C, voll nutzbar", `${colder.recoverPercent.toFixed(0)} %`);
check(colder.junctionC < reference.junctionC, "kälterer Vorlauf → kühlere Junction", `${colder.junctionC.toFixed(1)} °C`);

const tooCold = simulate({ loadKw: 12, inletC: 20, rth: 0.018 });
check(tooCold.recoverPercent === 0, "Vorlauf 20 °C → Rücklauf 50 °C, keine Netzwärme", `${tooCold.recoverPercent.toFixed(0)} %`);

console.log("Grenzen der Regler (Wertebereiche der Seite: 4–40 kW, 18–50 °C, 0,012–0,034 K/W)");
const best = simulate({ loadKw: 4, inletC: 18, rth: 0.012 });
check(best.junctionC < 40, "Bestfall bleibt deutlich unter der Drosselgrenze", `${best.junctionC.toFixed(1)} °C`);
check(best.recoverPercent === 0, "Bestfall: Rücklauf 48 °C reicht nicht für Fernwärme", `${best.recoverPercent.toFixed(0)} %`);

const worst = simulate({ loadKw: 40, inletC: 50, rth: 0.034 });
check(worst.junctionC > 80, "Worstfall der Regler erkennt Drosselung", `${worst.junctionC.toFixed(1)} °C`);
check(worst.flowM3h < 1.6, "Worstfall bleibt im Volumenstrombereich der CDU", `${worst.flowM3h.toFixed(2)} m³/h`);
check(worst.recoverPercent === 100, "Worstfall hat weiter nutzbare Abwärme", `${worst.recoverPercent.toFixed(0)} %`);

console.log("Randfälle");
const zero = simulate({ loadKw: 0, inletC: 25, rth: 0.018 });
near(zero.flowM3h, 0, 0.001, "keine Last → kein Volumenstrom");
near(zero.pumpKw, 0, 0.001, "keine Last → keine Pumpenleistung");
near(zero.recoverPercent, 0, 0.01, "keine Last → keine nutzbare Wärme");

const negative = simulate({ loadKw: -50, inletC: 25, rth: 0.018 });
check(negative.flowM3h >= 0, "negative Last wird abgefangen", `${negative.flowM3h.toFixed(3)} m³/h`);

const extreme = simulate({ loadKw: 500, inletC: 50, rth: 0.034 });
check(Number.isFinite(extreme.flowM3h) && Number.isFinite(extreme.junctionC), "Extremfall bleibt endlich");

console.log("Pumpenkennlinie (Δp steigt quadratisch, also P ~ V̇³)");
check(Math.abs(heavier.pumpKw / reference.pumpKw - 8) < 0.4, "doppelter Volumenstrom → achtfache Pumpenleistung", `${(heavier.pumpKw / reference.pumpKw).toFixed(2)}×`);

console.log("Dichte-Plausibilität (Wasser hat sein Maximum bei 4 °C)");
const { density } = await import(pathToFileURL(modulePath).href);
check(Math.abs(density(4) - 1000) < 0.5, "bei 4 °C maximale Dichte", `${density(4).toFixed(2)} kg/m³`);
check(Math.abs(density(53) - 987) < 2, "bei 53 °C etwa 987 kg/m³", `${density(53).toFixed(1)} kg/m³`);
check(Math.abs(density(95) - 962) < 5, "bei 95 °C etwa 962 kg/m³", `${density(95).toFixed(1)} kg/m³`);
check(density(95) < density(4), "heisses Wasser ist dünner als kaltes");

console.log(failures === 0 ? "\nSimulator-Logik: alle Prüfungen bestanden." : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);