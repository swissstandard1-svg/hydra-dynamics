# HYDRA Dynamics — Konzept-Website (Design- & Coding-Benchmark)

Eine vollständig erfundene Marke mit echter Mechanik: **HYDRA Dynamics** kühlt
KI-Beschleuniger direkt am Die. Die Website erklärt das Prinzip, rechnet einen
Lastfall live nach und ist dabei ohne Framework-Ballast gebaut.

> Alles auf dieser Seite ist Fiktion: Firma, Produkte, Referenzen, Personen,
> Messwerte. Es gibt kein Backend, es wird nichts versendet.

## Was hier drin steckt

| Bereich | Umsetzung |
|---|---|
| Build | Vite 8 + TypeScript 6, keine UI-Bibliothek — DOM direkt, dafür 56 kB gzip JS |
| Stil | Tailwind 4 als CSS-Build-Schritt + eigenes Token-System in `src/styles/` |
| Bewegung | GSAP 3 mit ScrollTrigger, Motion, Lenis für weiches Scrollen |
| Effekte | Canvas-Strömungsfeld, Cursor-Layer, magnetische Buttons, Spotlight, 3D-Tilt, Split-Text, Zählwerte, Balken, SVG-Thermografie |
| Rechnung | `src/lib/simulation.mjs` — Energiebilanz, Dichtetabelle, Pumpenkennlinie |
| Robustheit | `prefers-reduced-motion`-Pfad, Tastaturbedienung, Fokusführung, Live-Region für den Simulator, Formularprüfung mit deutschen Meldungen |
| Schriften | Space Grotesk, Inter und JetBrains Mono selbst gehostet — kein externer Request |
| Prüfung | Statische Markup-/CSS-Prüfung, Physik-Test, Lighthouse-Gate, CI-Workflow |

## Befehle

```bash
npm install
npm run dev        # Tailwind bauen, dann Entwicklungsserver auf :5173
npm run build      # Tailwind → tsc --noEmit → Vite-Build nach dist/
npm run preview    # gebaute Seite auf :4173 ausliefern
npm run typecheck  # nur Typen prüfen
```

Prüfungen:

```bash
node tools/verify-page.mjs      # Ankerziele, IDs, Überschriften, Labels, CSS-Variablen
node tools/verify-css.mjs       # Theme-Tokens vorhanden? Alle Utility-Klassen auflösbar?
node tools/test-simulator.mjs   # Physik: Referenzwerte, Monotonie, Randfälle, Pumpenkennlinie
npm run lh                      # Lighthouse gegen dist/ mit Schwellen (Perf 90, A11y 95)
```

## Aufbau

```
index.html                 Markup und Inhalte (deutsch), ARIA vollständig
src/main.ts                startet alle Schichten, räumt beim Verlassen auf
src/lib/                   eine Datei pro Aufgabe (Effekte, UI, Rechnung)
src/styles/tokens.css      Farben, Typografie, Abstände, Bewegung
src/styles/base.css        Reset, Typo-Skala, Barrierefreiheit, Grundraster
src/styles/components.css  alle Komponenten und Keyframes
tools/                     Build- und Prüfwerkzeuge (siehe oben)
docs/                      Design-Spezifikation und Modellnotizen
```

## Physik des Simulators

Vollständig offengelegt in `src/lib/simulation.mjs`:

```
ṁ  = Q / (c_p · ΔT)                  c_p ≈ 4,19 kJ/(kg·K), ΔT = 30 K
V̇  = ṁ / ρ(θ)                        ρ aus Stütztabelle (Wasser, 0 … 100 °C)
Δp = 350 mbar × (V̇ / 1,3 m³/h)²      reibungsdominiert, quadratisch
P  = V̇ · Δp / η                      η = 0,78
T_J = θ_Vorlauf + R_th · P_Chip      32 Chips pro Rack, R_th in K/W
```

Referenzfall 12 kW / 38 °C / 0,018 K/W → 45 °C Junction, 0,35 m³/h, 0,3 W
Pumpenleistung. Die Zahlen sind Modellwerte, kein Ersatz für eine Auslegung.

## Umgebungsnotizen (wichtig für Windows + Sandbox)

Diese Punkte sind echte Stolpersteine, keine Vermutungen — sie wurden in dieser
Umgebung reproduziert:

1. **npm-Cache** lag ausserhalb des Schreibbereichs → `.npmrc` setzt
   `cache=../.npm-cache` in den Projektbaum.
2. **`@tailwindcss/vite` liess sich nicht nutzen:** Beim Bündeln der
   Vite-Config bricht Rolldown beim Laden der nativen Tailwind-Bindung mit
   „stream did not contain valid UTF-8" ab. Ersatz: `tools/build-css.mjs`
   benutzt die Node-API von `@tailwindcss/node` (gleiches Rust-Backend).
   Nebeneffekt: Der CSS-Build ist ein eigener, prüfbarer Schritt.
3. **`vite`-CLI startet hier nicht:** Vite bündelt vor jedem Lauf die Config
   und landet in `optimizeSafeRealPathSync()`, das unter Windows `subst`/`net use`
   als Kindprozess aufruft — in der Sandbox ein `spawn EPERM`. Ersatz:
   `tools/vite.mjs` nutzt die Vite-Node-API ohne Config-Datei.
4. **Chrome headless startet in der Sandbox nicht** (`mojo platform_channel`,
   benannte Pipes gesperrt). Deshalb konnten hier weder Screenshots noch
   Lighthouse-Zahlen entstehen; `npm run lh` und der CI-Workflow sind fertig
   verdrahtet und liefern auf einem normalen Rechner bzw. in CI die Messwerte.

## Nächste Schritte, falls gewünscht

- Lighthouse-Zahlen in CI erheben und hier dokumentieren.
- Bilder/Screenshots der Abschnitte ergänzen (bewusst nicht im Repo).
- Echte WebGL-Effektschicht statt des Canvas-Strömungsfelds.