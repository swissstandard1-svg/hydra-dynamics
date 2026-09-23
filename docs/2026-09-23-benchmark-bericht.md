# Benchmark-Bericht — Coding & Design

Gemessen am 23.09.2026 auf diesem Arbeitsplatz. Jede Zahl in diesem Bericht
stammt aus einem ausgeführten Werkzeug, nicht aus einer Schätzung.

## Ergebnis in Kurzform

| Prüfung | Ergebnis | Werkzeug |
|---|---|---|
| Lighthouse Performance (Desktop) | **93** | `npm run lh` |
| Lighthouse Accessibility | **98** | `npm run lh` |
| Lighthouse Best Practices | **100** | `npm run lh` |
| Lighthouse SEO | **100** | `npm run lh` |
| First Contentful Paint | **1,2 s** | Lighthouse, CPU 4× gedrosselt |
| Largest Contentful Paint | **1,4 s** | Lighthouse |
| Cumulative Layout Shift | **0** | Lighthouse |
| Total Blocking Time | **0 ms** | Lighthouse |
| Start-JavaScript (gzip) | **5,5 kB** | Vite-Build |
| Nachgeladen (gzip) | **50,5 kB** (GSAP + ScrollTrigger + Lenis) | Vite-Build |
| Stylesheet (gzip) | **11,2 kB** | Vite-Build |
| JavaScript-Fehler im Browser | **0** | `data-js-errors` am `<html>` |
| Physik-Prüfungen | **alle bestanden** | `tools/test-simulator.mjs` |
| Markup-/CSS-Prüfungen | **alle bestanden** | `verify-page`, `verify-css` |
| Layout bei 390/768/1440 px | **keine Befunde** | `tools/verify-layout.mjs` |

## Was der Prüfweg gefunden hat

Fünf echte Fehler, jeder durch ein Werkzeug aufgedeckt — nicht durch Hinsehen:

1. **Einheitenfehler im Thermal-Modell.** 40 Chips × 2,5 kW ergaben 87 °C
   Junction, obwohl das Modell „2.000 W pro Socket" behauptete. Das Modell wurde
   auf 32 Chips und realistische 0,375 kW pro Chip umgerechnet, und die Texte
   der Seite wurden angepasst — statt die Zahl schönzurechnen.
2. **Falsche Dichteformel.** Meine Potenzformel lieferte 690 kg/m³ statt
   987 kg/m³ bei 53 °C, also 43 % zu viel Volumenstrom. Ersetzt durch eine
   Stütztabelle mit linearer Interpolation, geprüft bei 4/53/95 °C.
3. **Unrealistische Pumpenkennlinie.** Ein fester Druckverlust überschätzte die
   Pumpenleistung bei kleiner Last. Jetzt quadratischer Druckverlust, geprüft
   über den Zusammenhang P ~ V̇³ (doppelter Volumenstrom → achtfache Leistung).
4. **Überlappung im Kopf auf schmalen Geräten.** Der CTA-Button stand neben dem
   Menü-Icon. Ursache war keine Feinheit im Layout, sondern die Kaskade:
   Tailwind deklariert `@layer theme, base, components, utilities`, meine Regeln
   lagen ausserhalb jeder Ebene und verloren gegen die Utilities-Ebene. Behoben
   durch eine explizite Ebenenfolge und eine eigene, letzte Ebene `responsive`.
   Seither prüft `tools/verify-layout.mjs` genau das bei drei Breiten.
5. **Dekoration fing Zeiger ab.** Die Fortschrittsleiste am oberen Rand nahm
   Klicks an, weil `pointer-events: none` fehlte — ebenfalls vom Layout-Gate
   gefunden.

## Was die Messung verändert hat

Der erste Lighthouse-Lauf gegen meinen eigenen Mini-Server ergab Performance 65
mit FCP und LCP bei je 3,2 s. Ursache war nicht die Seite, sondern der Server:
Er lieferte uncompressed aus und erzeugte so einen unrealistischen Engpass
(167 KiB Ersparnis, die es in echt nicht gibt). Danach wurde gegen den
Vite-Vorschau-Server gemessen — der Zustand, den ein echtes Deployment hat.

Geblieben ist eine echte Ersparnis: Das Start-Bundle lag bei 151 kB (56 kB gzip),
weil GSAP, ScrollTrigger und Lenis zusammen mit der Grundfunktion geladen
wurden. Jetzt lädt der Kern 14,7 kB (5,5 kB gzip), die Effekt-Schicht kommt nach
dem ersten Bild nach. Ergebnis: 65 → 93 Punkte.

## Grenzen dieser Messung

- Gemessen auf einem lokalen Vorschau-Server, nicht auf einem CDN. Andere
  Netzbedingungen verschieben FCP und LCP.
- Desktop-Konfiguration (1440×900). Mobil wurde im Layout geprüft, aber nicht
  durch Lighthouse bewertet.
- Ein einzelner Lauf je Konfiguration nach dem Neustart des Servers. Vorherige
  Schwankungen (93 → 82) kamen von einem Server, der noch den alten Build
  auslieferte — deshalb gehört zu jeder Messung der Fingerabdruck der
  ausgelieferten Dateien.

## Umgebungsnotizen

Screenshots und Lighthouse waren in dieser Umgebung lange blockiert: Chrome
headless scheitert an gesperrten benannten Pipes (`mojo platform_channel`).
Mit weiterem Zugriff laufen beide Werkzeuge. Ebenfalls blockiert und gelöst:

- npm-Cache ausserhalb des Schreibbereichs → `.npmrc` verlegt ihn in den Projektbaum.
- `@tailwindcss/vite` bricht beim Config-Bündeln ab → eigener CSS-Schritt über
  die Node-API (`tools/build-css.mjs`).
- Die `vite`-CLI startet nicht (`spawn EPERM` in `optimizeSafeRealPathSync`) →
  Vite-Node-API ohne Config-Datei (`tools/vite.mjs`).

## Werkzeuge in diesem Projekt

```bash
npm run build                     # Tailwind → tsc --noEmit → Vite-Build
npm run lh                        # Lighthouse mit Schwellen (90/95/95/95)
node tools/verify-page.mjs        # Ankerziele, IDs, H1, Labels, CSS-Variablen
node tools/verify-css.mjs         # Theme-Tokens, auflösbare Utility-Klassen
node tools/verify-layout.mjs      # Überlappungen, Überlauf, Fehlerzähler (Browser)
node tools/test-simulator.mjs     # Physik: Referenz, Monotonie, Randfälle
node tools/measure-timing.mjs     # Bildzeiten, Schriften, späte Anfragen
node tools/screenshot.mjs         # Aufnahmen in audit/shots (nicht versioniert)
node tools/lighthouse-report.mjs  # Bericht auswerten statt scrollen
```