# Auftrag: Kreisgrafik-Überarbeitung (Farben, Neutral-Opazität, Valenz-Achse)

Vor Beginn: `docs/architektur.md`, `docs/cleanup-log.md` und
`docs/modularisierung-log.md` lesen und die dort festgelegten
Refactoring-Prinzipien einhalten (keine IIFE-Body-Einrückung,
`window.X = X`-Export-Stil, statische Verifikation vor Browser-Tests,
kein `'use strict'`, kein `Object.defineProperty` ausser bei
tatsächlich mutierten Werten). Keine Umformatierung von Code
ausserhalb der drei unten beschriebenen Änderungen — der Cleanup-Pass
ist abgeschlossen, dieser Auftrag baut darauf auf, ersetzt ihn nicht.

## 1. Farbwerte aktualisieren (`datenbereinigung.js`)

Alte Werte (Helligkeits-Kaskade, verworfen):
```js
const CATEGORY_COLORS = { gold_dunkel: '#63561F', gold_mittel: '#917712', gold_hell: '#BF9E16' };
const KREIS_KATEGORIEN = [
  { key: 'gold_dunkel', farbe: [142, 117, 42] },
  { key: 'gold_mittel', farbe: [206, 169, 62] },
  { key: 'gold_hell', farbe: [202, 179, 122] },
];
```

Neue Werte (harmonische Reihe, gleiche Sättigung/Helligkeit, Hue
wandert nur 44°–50°):
```js
const CATEGORY_COLORS = { gold_dunkel: '#DEB031', gold_mittel: '#DEB831', gold_hell: '#DEC131' };
const KREIS_KATEGORIEN = [
  { key: 'gold_dunkel', farbe: [222, 176, 49] },
  { key: 'gold_mittel', farbe: [222, 184, 49] },
  { key: 'gold_hell', farbe: [222, 193, 49] },
];
```

Die Schlüssel `gold_dunkel`/`gold_mittel`/`gold_hell` NICHT umbenennen
— zu viele Abhängigkeiten in `kreisgrafik.js`
(`zaehleBandCounts`, `zeichneKreiseFuerRun`) und vermutlich weiteren
Dateien. Nur die Farbwerte ändern, keine Schlüssel.

`FWERT_COLORS`, `FWERT_PUNKT_FARBE`, `ROUTE_COLOR` bleiben
unverändert — nur die drei Kategorie-Goldtöne sind betroffen.

## 2. Neutrale Fläche abschwächen (`kreisgrafik.js`)

In `zeichneKreiseFuerRun()` ruft die neutrale Valenz
`zeichneVollkreis()` auf. Diese Fläche soll sichtbar leiser wirken
als die negativ/positiv-Halbkreise, aber nicht auf Schraffur
reduziert werden (das würde sie mit der Gesamtzahl-Schraffur
verwechselbar machen — bewusste Designentscheidung, nicht
offenlassen).

Einen zusätzlichen, festen Dämpfungsfaktor einführen, der NUR den
neutralen Aufruf betrifft, nicht `alphaSkala` global ändern (das
steuert auch Ein-/Ausblendungen und darf nicht verändert werden):

```js
const NEUTRAL_DAEMPFUNG = 0.35; // Konstante neben HATCH_SPACING platzieren

// im neutralR-Block in zeichneKreiseFuerRun():
if (neutralR > 0) flaechenFormen.push({ r: neutralR, zeichne: () => zeichneVollkreis(cx, cy, neutralR, k.farbe, alphaSkala * NEUTRAL_DAEMPFUNG, blend) });
```

`zeichneHalbkreis()`-Aufrufe für neg/pos bleiben unverändert bei
`alphaSkala` ohne Dämpfung.

## 3. Valenz-Achse um 90° drehen (`kreisgrafik.js`)

**Ziel:** negativ = unten, positiv = oben (statt links/rechts).
F-Werte müssen mitrotieren, damit Halbkreis-Ausrichtung und
F-Wert-Position weiterhin zusammenpassen.

**Vor der Umsetzung klären, nicht raten:**

a) Der `winkel`-Parameter in `zeichneKreiseOrtRuns()` wird aktuell
   fix als `PI` an `zeichneKreiseFuerRun()` übergeben. Rechnerisch
   ergibt `winkel=PI` bereits `negBulge = winkel − HALF_PI` und
   `posBulge = winkel + HALF_PI` — das sollte bereits neg=unten,
   pos=oben ergeben, nicht links/rechts wie aktuell beschrieben.
   Das deutet auf eine Rotation oder Spiegelung stromaufwärts hin
   (z. B. in `lonLatToScreen()` oder einer Kartenprojektion), die
   den tatsächlichen Bildschirm-Winkel verschiebt. **Vor jeder
   Codeänderung im Browser verifizieren, welcher `winkel`-Wert
   aktuell tatsächlich zu links/rechts führt**, dann von dort aus um
   90° drehen (nicht blind `PI` durch `HALF_PI` ersetzen).

b) Der Code-Stand, der review­t wurde, übergibt in
   `zeichneKreiseOrtRuns()` bereits `anordnung = 'obenUnten'` an
   `zeichneFwertPunkte()` — und die `'obenUnten'`-Formel
   (`valenz===-1` → `HALF_PI`, `valenz===1` → `−HALF_PI`,
   `valenz===0` → `0`) entspricht bereits exakt dem Zielmuster
   (negativ unten, positiv oben, neutral rechts). **Vor der
   Umsetzung prüfen, ob das im aktuell laufenden Code schon so ist**
   oder ob es einen abweichenden Aufruf mit `anordnung='seitlich'`
   gibt. Falls `'obenUnten'` schon aktiv ist, betrifft dieser
   Auftrag nur noch (a), nicht die F-Wert-Platzierung.

**Nach Klärung:** `winkel` auf den Wert setzen, der neg=unten/pos=oben
ergibt. Sicherstellen, dass Halbkreis-Rotation und F-Wert-Anordnung
im selben Commit geändert werden, falls beides noch nötig ist — sonst
zeigen Fläche und Punkte kurzzeitig in unterschiedliche Richtungen.

## Nicht anfassen

`kreisRadius()` (Wurzel-Skalierung, `BASIS=6, K=11.5`) ist bereits
korrekt und bewusst so gebaut — keine Änderung. Punktdichte bei den
F-Werten ist ein gewolltes Gestaltungsmittel ("Gefühlskribbeln"),
keine Grössenanpassung vornehmen.

## Verifikation

Nach jeder der drei Änderungen: statisch prüfen (Farbwerte in
`CATEGORY_COLORS` und `KREIS_KATEGORIEN` konsistent? Dämpfung nur am
neutralen Pfad? Halbkreis- und F-Wert-Rotation synchron?), erst dann
im Browser an mindestens zwei Stationen mit unterschiedlicher
Annotationsdichte gegenprüfen (z. B. Palais Walter, hohe Dichte, und
Place de la Madeleine, niedrige Dichte).

Commit-Message kurz und stichwortartig, wie im Projekt üblich —
z. B. drei Commits: "Kreisgrafik: Goldreihe harmonisiert",
"Kreisgrafik: Neutral-Fläche gedämpft", "Kreisgrafik: Valenzachse
gedreht".
