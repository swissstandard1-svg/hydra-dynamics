# Design-Spezifikation — HYDRA Dynamics

Stand: 23.09.2026 · Fiktive Marke, gebaut als Design- und Coding-Benchmark.
Diese Datei ist die Entscheidungsgrundlage, nach der gebaut wurde.

## 1. Aufgabe und Abgrenzung

Ziel: eine moderne, effektreiche Marketing-Seite für ein **erfundenes** Projekt,
die technisch sauber, zugänglich und performant ist. Kein Backend, keine echten
Produkte, keine echten Kunden, keine externen Dienste zur Laufzeit.

Bewusst nicht enthalten: Login, Warenkorb, CMS, Analytics, Newsletter,
Videohintergründe, 3D-Assets, WebGL-Postprocessing.

## 2. Projektidee

**HYDRA Dynamics AG** (Zürich, gegründet 2019, fiktiv) baut Direct-to-Chip-
Flüssigkeitskühlung für KI-Rechenzentren: Coldplate X1, RackLoop R8, CDU-500.

Warum diese Idee? Sie hat eine echte, erzählbare Mechanik (Wasser, Strömung,
Temperatur) — daraus lassen sich Effekte ableiten, die zur Geschichte passen,
statt Dekoration zu sein: Strömungsfeld, Thermografie, Durchflussanzeigen.

## 3. Gestaltung

**Leitidee „Deep Water":** dunkle Tiefsee als Grund, ein kaltes Leuchten für
alles, was kühlt, und ein warmes Signal für alles, was Wärme trägt.

| Rolle | Farbe | Verwendung |
|---|---|---|
| Abyss `#04070E` | Seitengrund | Hintergrund, Canvas |
| Ink `#0A111C` / `#0D1421` | Flächen | Karten, Panels, Kopfzeile |
| Line `#1B2537` | Rahmen | Kartenkanten, Trennlinien |
| Cyan `#22D3EE` | Primärakzent | Aktionen, Fortschritt, Daten |
| Aqua `#5EEAD4` | Sekundärakzent | Erfolg, Rücklauf, Diagramme |
| Ice `#67E8F9` | Highlight | Fokus, Werte, Überschriften-Akzente |
| Heat `#FF7A45` | Warm-Signal | Wärme, Warnung, Drosselung |
| Violet `#A78BFA` | Nebenakzent | Fortschritts-Ader, einzelne Partikel |
| Mist `#CFDBE9` | Text sekundär | Fliesstext |
| Foam `#F4F8FC` | Text primär | Überschriften, Werte |

Kontrast (geprüft gegen den jeweiligen Grund): Foam 18:1, Mist 14:1, Cyan 12:1,
Aqua 13:1, Heat 7,4:1 — alle über der AA-Schwelle von 4,5:1, Cyan und Ice für
Linktexte und Bedienelemente geeignet.

**Typografie:** Space Grotesk (Überschriften, eng gesetzt, `-0.03em`),
Inter (Text, 1,68 Zeilenhöhe), JetBrains Mono (alle Messwerte, `tabular-nums`).
Flüssige Skalen über `clamp()`, alles selbst gehostet — kein Fonts-CDN, kein
externer Request.

**Formen und Licht:** Karten mit 1,25 rem Radius, feine Rahmen, Blur-Panels,
feines Korn als Overlay (`soft-light`, 5 %), Glow nur dort, wo es Zustand
bedeutet (Leistung, Fortschritt) — nicht als Flächendeko.

## 4. Aufbau der Seite

1. **Hero** — Aussage, Zusage, zwei Handlungswege, vier Kennzahlen.
2. **Ausgangslage** — die Wand bei 25 kW pro Rack, Gegensatz Luft gegen Kaltplatte,
   Thermografie-Vergleich als SVG (94 °C gegen 45 °C).
3. **Prinzip** — vier Schritte im geschlossenen Kreis plus Vergleichstabelle
   Luft gegen Direct-to-Chip.
4. **Simulator** — interaktive Auslegung (siehe Abschnitt 5).
5. **Produkte** — drei Bausteine, horizontal scrollbar auf schmalen Geräten.
6. **Technik & Nachweis** — Zählwerte und Messbalken.
7. **Referenzen** — drei fiktive Stimmen, klar als fiktiv gekennzeichnet.
8. **FAQ** — vier Einwände, ehrliche Antworten (inklusive „bleib bei Luft").
9. **Kontakt** — Formular mit lokaler Prüfung und offener Kennzeichnung.
10. **Footer** — Navigation, Hinweis auf die Fiktivität.

## 5. Simulator: Modell

Ein Rechenkern, ausgelagert nach `src/lib/simulation.mjs`, ohne DOM, damit er
mit `node` prüfbar ist:

```
ṁ  = Q / (c_p · ΔT)                c_p ≈ 4,19 kJ/(kg·K), ΔT = 30 K
V̇  = ṁ / ρ(θ)                      ρ aus Stütztabelle, Wasser 0…100 °C
Δp = 350 mbar × (V̇ / 1,3 m³/h)²    reibungsdominiert, quadratisch
P  = V̇ · Δp / η                    η = 0,78
T_J = θ_Vorlauf + R_th × P_Chip    32 Chips pro Rack
```

Regler: 4–40 kW pro Rack, 18–50 °C Vorlauf, 0,012–0,034 K/W je Chip.
Ausgaben: Volumenstrom, Pumpenleistung, Junction, nutzbare Abwärme — dazu eine
Bewertung in Worten (grün oder orange), die auf Drosselung, Auslegungsgrenze
und Fernwärmetauglichkeit achtet.

Ein Fehler in dieser Rechnung wurde während der Umsetzung durch den Physik-Test
gefunden: Die erste Dichteformel lieferte 690 kg/m³ statt 987 kg/m³ bei 53 °C
und damit 43 % zu viel Volumenstrom. Jetzt: Stütztabelle plus Interpolation,
geprüft bei 4, 53 und 95 °C.

## 6. Bewegung und Effekte

| Effekt | Umsetzung | Begründung |
|---|---|---|
| Strömungsfeld | Canvas 2D, 26–88 Partikel, Trägheit, Zeigeranziehung, Lifecycle-Fade | ersetzt einen schweren WebGL-Fluid-Filter: gleicher Eindruck, kleinere Datei, stabilere Bildrate |
| Scroll | Lenis + GSAP-Ticker, ScrollTrigger für Hero-Tiefe und Kartenstaffelung | ein gemeinsamer Takt statt zweier Schleifen |
| Text | Wörter und Grapheme in Spans, Staffelung per CSS-Animation | kein Zeilenmessen, kein Layout-Neuberechnen |
| Einblenden | ein IntersectionObserver, CSS-Übergänge, Stufen über `--reveal-delay` | keine Scroll-Handler pro Frame |
| Zeiger | Cursor-Ring, magnetische Buttons, Spotlight, 3D-Tilt | nur bei Feinzeiger und ohne Bewegungsbremse |
| Zählwerte, Balken | ein Animations-Takt, `easeOutCubic`, deutsche Zahlenformatierung | Werte stehen ohne JavaScript schon korrekt im Markup |

Alle Effekte: `prefers-reduced-motion: reduce` blendet sie aus und zeigt die
Inhalte sofort; die Canvas-Schleife pausiert, wenn der Tab in den Hintergrund
geht. Ein unbehandelter JavaScript-Fehler wird in `data-js-errors` am
`<html>`-Element gezählt, damit Fehlerfreiheit überprüfbar ist.

## 7. Robustheit und Zugänglichkeit

- Sprungmarke „Direkt zum Inhalt" als erstes fokussierbares Element.
- Fokus sichtbar (2 px Ice, 3 px Abstand), nie entfernt.
- Genau eine H1, lückenlose Überschriftenhierarchie, sinnvolle Landmarken.
- Alle Bedienelemente mit Namen, Simulator als Live-Region, FAQ mit
  `aria-expanded` und echtem Panel.
- Tastatur: Galerie mit Pfeiltasten, FAQ mit Enter/Leertaste, Escape schliesst
  das mobile Menü und gibt den Fokus zurück.
- Formular: `aria-invalid`, deutsche Meldungen, kein Versand (offen benannt).

## 8. Prüfkonzept

| Prüfung | Werkzeug | Kriterium |
|---|---|---|
| Typen | `tsc --noEmit` | keine Fehler |
| Markup | `tools/verify-page.mjs` | Ankerziele, IDs, H1, Labels, SVG-Namen, CSS-Variablen, Selektorziele |
| Stile | `tools/verify-css.mjs` | Theme-Tokens vorhanden, alle Utility-Klassen auflösbar |
| Physik | `tools/test-simulator.mjs` | Referenzwerte, Monotonie, Randfälle, Pumpenkennlinie |
| Leistung/Zugänglichkeit | `npm run lh` (Lighthouse) | Perf ≥ 90, A11y/Best/SEO ≥ 95 |
| Fehlerfreiheit | `data-js-errors` | 0 im Browser |

Was in dieser Umgebung nicht möglich war: Screenshots und Lighthouse, weil
Chrome headless an gesperrten benannten Pipes scheitert. Das Werkzeug ist
fertig, die Ausführung gehört auf einen Rechner ohne diese Sperre oder in CI.