# Cleanup-Log

Protokoll aller Bereinigungsschritte an der Codebasis im Zuge der
Modularisierung (Branch `refactor/code-architektur`). Grundlage ist die
Bestandsaufnahme in [code-analyse-sketch-js.md](code-analyse-sketch-js.md);
die dort unter Punkt 4 („Toter Code") aufgeführten Fundstellen werden hier
Schritt für Schritt abgearbeitet.

Jeder Eintrag hält fest, **was** entfernt wurde, **warum**, und **welche Zeilen**
der jeweiligen Ausgangsfassung betroffen waren — damit sich der Schritt später
über `git log`/`git diff` hinaus auch inhaltlich nachvollziehen lässt.

---

## Schritt 1 — Toter Spine-Timeline-Code entfernt

**Datum:** 20. August 2026
**Datei:** `sketch.js`
**Ausgangsfassung:** Commit `083d2eb` (3497 Zeilen, 67 Top-Level-Funktionen)
**Ergebnis:** 3472 Zeilen, 65 Top-Level-Funktionen — 25 Zeilen entfernt

### Was wurde entfernt

| Zeilen (vorher) | Element | Umfang |
|---|---|---|
| 782–792 | `function baueSpineTimeline()` | 11 Zeilen |
| 794–805 | `function fuegeSpineEintragHinzu(text, typ, stationIndex)` | 12 Zeilen |
| 781, 793, 806 | Trennende Leerzeilen (eine davon als Abstand erhalten) | 2 Zeilen netto |

Zusammenhängender Block **782–806**, gelöscht zwischen dem Ende von
`baueZwischenMarker()` (bis Zeile 780) und dem Kommentarkopf des
`draw()`-Abschnitts (ab Zeile 807). Beide Funktionen lagen direkt
nebeneinander; es blieb keine Lücke im umgebenden Code.

**Aufrufstellen:** Alle drei Aufrufe von `fuegeSpineEintragHinzu()` standen in
den Zeilen 788, 789 und 790 — also innerhalb von `baueSpineTimeline()` und
damit selbst im gelöschten Block. Ausserhalb davon gab es keine einzige
Aufrufstelle, es musste also an keiner anderen Stelle nachgezogen werden.

### Warum

Siehe [code-analyse-sketch-js.md, Punkt 4a und 4b](code-analyse-sketch-js.md#4-toter-code--explizite-liste).
Zusammengefasst:

1. **`baueSpineTimeline()` wurde nirgends aufgerufen.** Die Prüfung aller
   67 Funktionsnamen gegen `sketch.js`, `datenbereinigung.js`,
   `sonifikation.js` und `index.html` (Kommentare vorher entfernt) ergab null
   Referenzen. Insbesondere fehlte sie in `setup()`, wo die übrigen sechs
   `baue*`-Funktionen aufgerufen werden.

2. **`fuegeSpineEintragHinzu()` war transitiv tot** — ihre einzigen drei
   Aufrufstellen lagen in `baueSpineTimeline()`.

3. **Der Code war nicht nur ungenutzt, sondern nicht lauffähig.** Beide
   Funktionen griffen auf drei Variablen zu, die im gesamten Projekt nirgends
   deklariert sind: `spineLinie` (Zeile 783), `spineTimeline` (Zeilen 785, 803)
   und `spineEintraege` (Zeile 804). Ein Aufruf hätte an
   `spineTimeline.appendChild(...)` einen `ReferenceError` geworfen. Die
   Funktionen konnten also zu keinem Zeitpunkt der jüngeren Projektgeschichte
   funktioniert haben.

4. **Fachlicher Hintergrund:** Es handelt sich um einen Rückstand des früheren
   *vertikalen* Spine-Panels am rechten Bildschirmrand. Dieses ist inzwischen
   vollständig durch die *horizontale* Spine der Graph-Ansicht ersetzt
   (`zeichneSpineHorizontal` / `spineLayout` / `baueSpineDaten`), die p5-seitig
   auf Canvas zeichnet statt DOM-Knoten zu bauen und ihre Daten aus
   `spineEintraegep5` bzw. `spineEintraegeKapitel` bezieht.

### Nicht betroffen

Die noch aktiven Spine-Mechanismen wurden **nicht** angetastet — die
Namensähnlichkeit ist irreführend, es sind verschiedene Systeme:

- `spineEintraegep5` und `spineEintraegeKapitel` (Caches der Graph-Ansicht,
  9 Fundstellen) — weiterhin in Gebrauch
- `zeichneSpineHorizontal()`, `spineLayout()`, alle `SPINE_*`-Konstanten
- `baueSpineDaten()` und `ortRunsFuerSpine()` in `datenbereinigung.js`

### Prüfungen nach der Änderung

- **Restreferenzen:** `baueSpineTimeline`, `fuegeSpineEintragHinzu`,
  `spineLinie`, `spineTimeline`, `spineEintraege` — jeweils null Treffer in
  `sketch.js`, `datenbereinigung.js`, `sonifikation.js`, `index.html`.
- **Syntax:** `sketch.js` parst fehlerfrei (Prüfung über JavaScriptCore,
  `new Function(quelltext)`).
- **Diff:** ausschliesslich Löschungen, keine Änderung an anderen Stellen
  (`1 file changed, 25 deletions(-)`).

### Offener Folgebefund (nicht Teil dieses Schritts)

Mit den beiden Funktionen sind die zugehörigen CSS-Regeln verwaist, da die
Klassen jetzt von keiner Stelle mehr vergeben werden:

- `style.css:392` — `.spine-timeline`
- `style.css:400` — `.spine-linie`
- `style.css:409`, `421` — `.spine-entry`, `.spine-entry.aktiv`
- `style.css:426–427` — `.spine-entry.spalte-gedanke`, `.spine-entry.spalte-markierung`

In `index.html` gibt es kein passendes Element mehr. Diese Regeln sind
Kandidaten für einen eigenen Bereinigungsschritt; `style.css` wurde in
Schritt 1 bewusst nicht angefasst.
