# Benchmark-Bericht — Coding & Design

Gemessen am 23.09.2026 auf diesem Arbeitsplatz. Jede Zahl stammt aus einem
ausgeführten Werkzeug. `npm run lh` bewertet den **Median aus drei Läufen**,
weil einzelne Läufe hier um bis zu elf Punkte schwanken (kaltes Dateisystem,
Hintergrundlast).

## Veröffentlichte Seite

**https://swissstandard1-svg.github.io/hydra-dynamics/**

Messung direkt gegen diese URL (Lighthouse, Desktop): Performance **93**,
Accessibility 98, Best Practices 100, SEO 100, FCP 1,2 s, LCP 1,3 s.
GitHub Pages liefert komprimiert und mit Cache-Headern aus; das ist der
Zustand, den Besucher tatsächlich erleben.

## Ergebnis (lokal gemessen)

| Prüfung | Ergebnis | Werkzeug |
|---|---|---|
| Lighthouse Performance (Median aus 3) | **87** | `npm run lh` |
| Lighthouse Accessibility | **98** | `npm run lh` |
| Lighthouse Best Practices | **100** | `npm run lh` |
| Lighthouse SEO | **100** | `npm run lh` |
| First Contentful Paint | **1,5 s** | Lighthouse, CPU 4× gedrosselt |
| Largest Contentful Paint | **1,7 s** | Lighthouse |
| Cumulative Layout Shift | **0** | Lighthouse |
| Total Blocking Time | **0 ms** | Lighthouse |
| Start-JavaScript | **5,5 kB gzip** | Vite-Build |
| Nachgeladen nach dem ersten Bild | **50,5 kB gzip** (GSAP + ScrollTrigger + Lenis) | Vite-Build |
| HTML inklusive eingebettetem CSS | **18,8 kB gzip** | Build |
| Schriften | **3 Dateien geladen, 109 kB**, selbst gehostet, 0 Fehler | Build + Layout-Gate |
| Übertragen gesamt | **190 kB in 13 Anfragen** | Lighthouse |
| JavaScript-Fehler im Browser | **0** | `data-js-errors` im DOM |
| Markup, CSS, Physik, Layout | **alle bestanden** | vier Prüfwerkzeuge |

## Was die Prüfungen gefunden haben

Sieben echte Fehler, jeder von einem Werkzeug aufgedeckt:

1. **Einheitenfehler im Thermal-Modell.** 40 Chips × 2,5 kW ergaben 87 °C, obwohl
   der Text „2.000 W pro Socket" behauptete. Das Modell rechnet jetzt mit 32
   Chips und 0,375 kW pro Chip; die Texte wurden angepasst, nicht die Zahl.
2. **Falsche Dichteformel.** 690 kg/m³ statt 987 kg/m³ bei 53 °C — 43 % zu viel
   Volumenstrom. Ersetzt durch eine Stütztabelle mit Interpolation.
3. **Unrealistische Pumpenkennlinie.** Fester Druckverlust überschätzte die
   Pumpenleistung bei kleiner Last. Jetzt quadratisch, geprüft über P ~ V̇³.
4. **Überlappung im Kopf auf schmalen Geräten.** Ursache war die Kaskade:
   Tailwind deklariert `@layer theme, base, components, utilities`, meine Regeln
   lagen ausserhalb jeder Ebene und verloren. Behoben durch explizite
   Ebenenfolge plus eigene letzte Ebene `responsive`.
5. **Dekoration fing Zeiger ab.** Die Fortschrittsleiste nahm Klicks an.
6. **Die selbst gehosteten Schriften wurden nie geladen.** Die @fontsource-
   Importe erzeugten @font-face-Regeln, aber der Bundler gab die Dateien nicht
   aus; die Anfragen liefen ins Leere und die Seite zeigte Ersatzschriften.
   Jetzt liegen die sechs benötigten Schnitte als Projektdateien in
   `src/styles/fonts/` mit eigenen @font-face-Regeln (nur latin und latin-ext).
7. **Render-blockierendes Stylesheet.** Es war die einzige Anfrage auf dem
   kritischen Pfad (152 ms im Modell). Jetzt wird es beim Build direkt ins HTML
   geschrieben — ein Roundtrip weniger.

8. **Die Schriftpfade zeigten nach dem Einbetten ins Leere.** Das Stylesheet
   wurde aus `dist/assets/` ins HTML kopiert, seine `url(./…)`-Angaben zeigten
   aber weiter auf `assets/…` — relativ zum HTML also auf eine nicht existierende
   Datei. Aufgefallen ist es beim Prüfen der Pfade gegen den Build, nicht im
   Browser: dort greift stillschweigend die Ersatzschrift. Behoben, und das
   Layout-Gate zählt jetzt fehlerhafte Schriften mit.

## Was die Messung verändert hat

- Der erste Lauf gegen einen selbstgebauten Mini-Server ergab Performance 65 mit
  FCP und LCP bei 3,2 s — der Server lieferte uncompressed aus. Gegen den
  Vite-Vorschau-Server (Zustand wie im echten Deployment) waren es 85.
- Das Start-Bundle enthielt GSAP, ScrollTrigger und Lenis mit 151 kB. Jetzt lädt
  der Kern 14,7 kB (5,5 kB gzip), die Effekt-Schicht kommt nach dem ersten Bild.
  85 → 91 nach Median-Bewertung, mit zwischenzeitlichen 93.
- Zwei Messungen waren wertlos, weil ein **alter Serverprozess** noch den
  vorherigen Build auslieferte. Seither wird vor jeder Messung geprüft, dass die
  ausgelieferte `index.html` byteweise dem Build entspricht (`md5sum`).

## Warum die Punktzahl nach der Schriften-Korrektur sinkt

Zwischenzeitlich standen 91 Punkte im Bericht — damals **luden die Schriften
nicht**. Mit tatsächlich geladenen Schriften sind es 87: 109 kB in drei
zusätzlichen Anfragen, die im 4G-Modell von Lighthouse je einen Roundtrip
kosten. Die Gestaltung ist das wert, und die tatsächliche Bildzeit ohne
Drosselung sank von 600 ms auf **368 ms**. Vorladen der Display-Schrift hat
davon 5 Punkte zurückgeholt (82 → 87). Weiter ginge nur auf Kosten der
Typografie, deshalb bleibt es hier.

## Verbleibender Befund

Accessibility 98 statt 100: Lighthouse beanstandet die Überschriftenreihenfolge
für die vier FAQ-Fragen (`ul.faq > li > h3`). Jede einzelne Überschrift folgt im
Dokument auf die H2 des Abschnitts, die Reihenfolge h1 → h2 → h3 ist also
eingeordnet korrekt; die Prüfung sieht den Text in den `h3`-Elementen nicht, weil
er in einem `button` liegt. Die Fragen bleiben als Überschriften erhalten, weil
das für die Navigation mit Screenreadern der richtige Weg ist. Der Befund ist
damit dokumentiert und bewusst offen — nicht weggeredet und nicht wegoptimiert.

## Grenzen der Messung

- Lokaler Vorschau-Server, kein CDN. Andere Netzbedingungen verschieben FCP/LCP.
- Desktop-Konfiguration 1440×900. Mobil ist über das Layout-Gate geprüft
  (390, 768, 1440 px), aber nicht durch Lighthouse bewertet.
- Der jeweils erste Lauf einer Sitzung ist reproduzierbar langsamer (80–82).
  Bewertet wird der Median aus drei Läufen.
- Die Performance-Grenze hängt von der Maschine ab: lokal 90, auf geteilten
  CI-Runnern 80, weil derselbe Stand dort reproduzierbar 81–87 erreicht.
  Gegen die veröffentlichte Seite werden 93 erreicht.

## Werkzeuge

```bash
npm run build                     # Tailwind → tsc --noEmit → Vite-Build → CSS einbetten
npm run lh                        # Lighthouse, Median aus 3 Läufen, Schwellen 90/95
node tools/verify-page.mjs        # Ankerziele, IDs, H1, Labels, CSS-Variablen
node tools/verify-css.mjs         # Theme-Tokens, auflösbare Utility-Klassen
node tools/verify-layout.mjs      # Überlappungen, Überlauf, Fehlerzähler (Browser)
node tools/test-simulator.mjs     # Physik: Referenz, Monotonie, Randfälle
node tools/measure-timing.mjs     # Bildzeiten, Schriften, späte Anfragen
node tools/screenshot.mjs         # Aufnahmen nach audit/shots (nicht versioniert)
node tools/lighthouse-report.mjs  # Bericht auswerten statt scrollen
```
