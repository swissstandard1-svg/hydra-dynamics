/**
 * Typen für `simulation.mjs`. Die Rechnung liegt bewusst in reinem JavaScript
 * (direkt mit `node` prüfbar), die öffentliche Schnittstelle ist hier festgehalten.
 */

/** Feste Spreizung des Sekundärkreises in Kelvin. */
export declare const SPREAD_K: number;

/** Chips pro Rack: 8 Sockets mit je vier Dies. */
export declare const CHIPS_PER_RACK: number;

/** Dichte von Wasser in kg/m³, interpoliert aus einer Stütztabelle. */
export declare function density(meanC: number): number;

export interface SimInput {
  /** Rechenleistung pro Rack in kW (gilt 1:1 als Wärmelast). */
  loadKw: number;
  /** Vorlauftemperatur in °C. */
  inletC: number;
  /** Wärmewiderstand je Chip in K/W (typisch 0,018). */
  rth: number;
}

export interface SimResult {
  /** Volumenstrom in m³/h. */
  flowM3h: number;
  /** Pumpenleistung in kW. */
  pumpKw: number;
  /** Junction-Temperatur in °C. */
  junctionC: number;
  /** Rücklauftemperatur in °C. */
  returnC: number;
  /** Wärmelast je Chip in kW. */
  chipKw: number;
  /** Für Fernwärme nutzbarer Anteil in Prozent. */
  recoverPercent: number;
}

export declare function simulate(input: SimInput): SimResult;