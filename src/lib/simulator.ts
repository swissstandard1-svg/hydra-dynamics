/**
 * Thermaler Simulator: verbindet die Physik aus `simulation.mjs` mit den
 * Reglern und Ausgabefeldern der Seite. Die Rechnung selbst liegt bewusst
 * getrennt, damit sie ohne Browser geprüft werden kann.
 */

import { addFrameTask, removeFrameTask } from "./utils";
import { simulate, SPREAD_K, type SimResult } from "./simulation.mjs";

export function initSimulator(): () => void {
  const root = document.querySelector<HTMLElement>("[data-sim]");
  if (!root) return () => {};

  const load = root.querySelector<HTMLInputElement>("#sim-load");
  const inlet = root.querySelector<HTMLInputElement>("#sim-inlet");
  const quality = root.querySelector<HTMLInputElement>("#sim-quality");
  const loadOut = root.querySelector<HTMLOutputElement>("#sim-load-out");
  const inletOut = root.querySelector<HTMLOutputElement>("#sim-inlet-out");
  const qualityOut = root.querySelector<HTMLOutputElement>("#sim-quality-out");
  const verdict = root.querySelector<HTMLElement>("[data-sim-verdict]");
  const verdictText = root.querySelector<HTMLElement>("[data-sim-verdict-text]");
  if (!load || !inlet || !quality || !loadOut || !inletOut || !qualityOut || !verdict || !verdictText) return () => {};

  const out = {
    flow: root.querySelector<HTMLElement>('[data-sim-out="flow"]'),
    pump: root.querySelector<HTMLElement>('[data-sim-out="pump"]'),
    junction: root.querySelector<HTMLElement>('[data-sim-out="junction"]'),
    recover: root.querySelector<HTMLElement>('[data-sim-out="recover"]'),
  };
  const bar = {
    flow: root.querySelector<HTMLElement>('[data-sim-bar="flow"]'),
    pump: root.querySelector<HTMLElement>('[data-sim-bar="pump"]'),
    junction: root.querySelector<HTMLElement>('[data-sim-bar="junction"]'),
    recover: root.querySelector<HTMLElement>('[data-sim-bar="recover"]'),
  };

  const oneDecimal = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const twoDecimals = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const whole = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

  /** Regler-Füllstand als CSS-Hintergrund setzen — funktioniert in jedem Browser. */
  function paintTrack(input: HTMLInputElement): void {
    const min = Number(input.min || "0");
    const max = Number(input.max || "100");
    const ratio = (Number(input.value) - min) / (max - min || 1);
    input.style.backgroundImage = "linear-gradient(90deg, var(--color-cyan, #22d3ee), var(--color-aqua, #5eead4))";
    input.style.backgroundSize = `${(ratio * 100).toFixed(2)}% 100%`;
    input.style.backgroundRepeat = "no-repeat";
    input.style.backgroundPosition = "left center";
  }

  function describe(result: SimResult): { state: "ok" | "warn"; text: string } {
    // Auslegungsgrenzen der CDU-500: 15 m³/h Fördervolumen, 80 °C Drosselgrenze.
    const critical = result.junctionC > 88 || result.flowM3h > 1.5;
    const throttled = result.junctionC > 80;
    const usable = result.returnC >= 55;

    if (critical) {
      return {
        state: "warn",
        text: `Über der Auslegungsgrenze: ${whole.format(result.junctionC)} °C am Die bei ${twoDecimals.format(result.flowM3h)} m³/h. Kleinere Chips pro Rack oder eine grössere CDU sind nötig.`,
      };
    }
    if (throttled) {
      return {
        state: "warn",
        text: `Die Beschleuniger drosseln: ${whole.format(result.junctionC)} °C liegen über der Grenze von 80 °C. Eine Kaltplatte mit kleinerem Wärmewiderstand löst das.`,
      };
    }
    if (!usable) {
      return {
        state: "warn",
        text: `Thermisch stabil bei ${whole.format(result.junctionC)} °C, aber der Rücklauf erreicht nur ${whole.format(result.returnC)} °C — Fernwärme braucht mindestens 55 °C.`,
      };
    }
    return {
      state: "ok",
      text: `Tragfähig — Junction ${whole.format(result.junctionC)} °C, Rücklauf ${whole.format(result.returnC)} °C bei ${oneDecimal.format(result.flowM3h)} m³/h. Die Abwärme ist auf Netzniveau nutzbar.`,
    };
  }

  let queued = false;

  function tick(): void {
    removeFrameTask(tick);
    queued = false;

    const loadKw = Number(load!.value);
    const inletC = Number(inlet!.value);
    const rth = Number(quality!.value) / 1000;

    paintTrack(load!);
    paintTrack(inlet!);
    paintTrack(quality!);

    loadOut!.textContent = `${whole.format(loadKw)} kW`;
    inletOut!.textContent = `${whole.format(inletC)} °C`;
    qualityOut!.textContent = `${rth.toFixed(3).replace(".", ",")} K/W`;

    const result = simulate({ loadKw, inletC, rth });

    if (out.flow) out.flow.textContent = twoDecimals.format(result.flowM3h);
    if (out.pump) out.pump.textContent = twoDecimals.format(result.pumpKw);
    if (out.junction) out.junction.textContent = whole.format(result.junctionC);
    if (out.recover) out.recover.textContent = whole.format(result.recoverPercent);

    const setBar = (element: HTMLElement | null, ratio: number): void => {
      if (!element) return;
      element.style.transform = `scaleX(${Math.max(0, Math.min(ratio, 1)).toFixed(3)})`;
    };
    // Skalen so gewählt, dass die Reglerbereiche die Balken sichtbar ausfüllen.
    setBar(bar.flow, result.flowM3h / 2);
    setBar(bar.pump, result.pumpKw / 1);
    setBar(bar.junction, result.junctionC / 100);
    setBar(bar.recover, result.recoverPercent / 100);

    if (bar.junction) {
      bar.junction.style.background = result.junctionC > 80
        ? "linear-gradient(90deg, var(--color-heat), #ffb28c)"
        : "linear-gradient(90deg, var(--color-cyan), var(--color-aqua))";
    }

    const message = describe(result);
    verdict!.dataset.state = message.state;
    verdictText!.textContent = message.text;
  }

  function update(): void {
    if (queued) return;
    queued = true;
    addFrameTask(tick);
  }

  const onInput = (): void => update();

  for (const input of [load, inlet, quality]) {
    input.addEventListener("input", onInput);
    input.addEventListener("change", onInput);
  }

  update();

  // Spreizung als Hinweis für Prüflinge im Datenattribut sichtbar machen.
  root.dataset.spread = String(SPREAD_K);

  return () => {
    for (const input of [load, inlet, quality]) {
      input.removeEventListener("input", onInput);
      input.removeEventListener("change", onInput);
    }
    removeFrameTask(tick);
  };
}