/**
 * Physik des Thermal-Simulators — bewusst ohne Framework und ohne DOM,
 * damit die Rechnung direkt mit `node` prüfbar ist.
 *
 * Modell eines Compute-Racks:
 *   8 Sockets × 4 Dies = 32 Chips, Wärmewiderstand je Chip 0,018 K/W
 *   Rücklaufziel 68 °C für die Wärmerückgewinnung
 *
 *   Spreizung   ΔT  = 30 K (fester Sekundärkreis)
 *   Massenstrom ṁ   = Q / (c_p · ΔT)     mit c_p ≈ 4,18 kJ/(kg·K)
 *   Volumenstrom V̇  = ṁ / ρ(θ)
 *   Druckverlust Δp = Δp_Ref × (V̇ / V̇_Ref)²   (reibungsdominiert)
 *   Pumpe       P   = V̇ · Δp / η          mit η = 0,78
 *   Junction    T   = θ_Vorlauf + R_th × P_Chip
 *
 * Alle Werte sind Modellwerte, kein Ersatz für eine Auslegung.
 */

/** Feste Spreizung des Sekundärkreises in Kelvin. */
export const SPREAD_K = 30;
/** Chips pro Rack: 8 Sockets mit je vier Dies. */
export const CHIPS_PER_RACK = 32;

const PUMP_EFFICIENCY = 0.78;
/** Bezugsdruckverlust in mbar beim Bezugsvolumenstrom (typische CDU-Auslegung). */
const PRESSURE_DROP_REF_MBAR = 350;
const FLOW_REF_M3H = 1.3;

/**
 * Druckverlust über dem Volumenstrom. Reibung dominiert, deshalb quadratisch —
 * ein fester Druckverlust würde die Pumpenleistung bei kleiner Last stark
 * überschätzen.
 */
const pressureDropKpa = (flowM3h) => PRESSURE_DROP_REF_MBAR * 0.1 * Math.pow(flowM3h / FLOW_REF_M3H, 2);

/** Spezifische Wärmekapazität von Wasser in kJ/(kg·K), leicht temperaturabhängig. */
const specificHeat = (meanC) => 4.179 + (meanC - 25) * 0.00075;

/**
 * Dichte von Wasser in kg/m³, interpoliert aus einer kurzen Stütztabelle.
 * Eine Potenzformel hat hier zu stark daneben gelegen (Dichte ist keine
 * glatte Potenzfunktion), die Tabelle ist ehrlicher und direkt prüfbar.
 */
const DENSITY_TABLE = [
  [0, 999.8],
  [4, 1000],
  [20, 998.2],
  [40, 992.2],
  [60, 983.2],
  [80, 971.8],
  [100, 958.4],
];

export const density = (meanC) => {
  const t = Math.min(Math.max(meanC, DENSITY_TABLE[0][0]), DENSITY_TABLE[DENSITY_TABLE.length - 1][0]);
  for (let i = 1; i < DENSITY_TABLE.length; i += 1) {
    const [t1, rho1] = DENSITY_TABLE[i - 1];
    const [t2, rho2] = DENSITY_TABLE[i];
    if (t <= t2) return rho1 + ((rho2 - rho1) * (t - t1)) / (t2 - t1);
  }
  return DENSITY_TABLE[DENSITY_TABLE.length - 1][1];
};

/**
 * @typedef {object} SimInput
 * @property {number} loadKw Rechenleistung pro Rack in kW (gilt 1:1 als Wärmelast).
 * @property {number} inletC Vorlauftemperatur in °C.
 * @property {number} rth Wärmewiderstand je Chip in K/W (typisch 0,018).
 */

/**
 * @typedef {object} SimResult
 * @property {number} flowM3h Volumenstrom in m³/h.
 * @property {number} pumpKw Pumpenleistung in kW.
 * @property {number} junctionC Junction-Temperatur in °C.
 * @property {number} returnC Rücklauftemperatur in °C.
 * @property {number} chipKw Wärmelast je Chip in kW.
 * @property {number} recoverPercent Für Fernwärme nutzbarer Anteil in Prozent.
 */

/**
 * @param {SimInput} input
 * @returns {SimResult}
 */
export function simulate({ loadKw, inletC, rth }) {
  const heatKw = Math.max(loadKw, 0);
  const meanC = inletC + SPREAD_K / 2;
  const cp = specificHeat(meanC);
  const rho = density(meanC);

  const massFlow = heatKw / (cp * SPREAD_K); // kg/s
  const flowM3h = (massFlow / rho) * 3600;
  const pumpKw = ((massFlow / rho) * pressureDropKpa(flowM3h)) / PUMP_EFFICIENCY;

  const chipKw = heatKw / CHIPS_PER_RACK;
  const junctionC = inletC + rth * chipKw * 1000;
  const returnC = inletC + SPREAD_K;

  // Fernwärmenetze brauchen mindestens 55 °C Vorlauf; darunter ist nichts nutzbar.
  const recoverPercent = Math.max(0, Math.min(100, ((returnC - 55) / 5) * 100));

  return { flowM3h, pumpKw, junctionC, returnC, chipKw, recoverPercent };
}