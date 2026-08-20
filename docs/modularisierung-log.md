# Modularisierungs-Log

Protokoll der Aufteilung von `sketch.js` in eigenständige Dateien. Grundlage
ist die Gruppeneinteilung in
[code-analyse-sketch-js.md, Punkt 5](code-analyse-sketch-js.md#5-thematische-gruppen-für-eine-modularisierung).

Abgegrenzt von den beiden anderen Protokollen:
[cleanup-log.md](cleanup-log.md) führt das Entfernen von totem Code,
[bugfix-log.md](bugfix-log.md) die Verhaltenskorrekturen. **Hier wird nichts
gelöscht und nichts korrigiert — nur verschoben.** Jeder Eintrag weist deshalb
nach, dass der verschobene Code zeichenweise unverändert übernommen wurde.

### Randbedingung

Das Projekt nutzt **keine ES-Module**. Alle Dateien liegen im globalen Scope und
werden über `<script>`-Tags in `index.html` geladen; die Ladereihenfolge dort
ist damit Teil der Architektur. Neue Module müssen VOR ihren Nutzern stehen,
soweit beim Laden bereits etwas ausgewertet wird.

---

## Modul 1 — `kartendekor.js`

**Datum:** 20. August 2026
**Neu:** `kartendekor.js` (187 Zeilen, davon 16 Kopfkommentar)
**Aus:** `sketch.js` — 172 Zeilen entfernt (3476 → 3304)
**Geändert:** `index.html` — ein `<script>`-Tag ergänzt

Entspricht **Gruppe 2 („Kartendekor")** der Analyse.

### Was wurde verschoben

Zusammenhängender Block, `sketch.js` Zeilen **349–519** (plus die
nachfolgende Leerzeile 520):

| Zeilen (vorher) | Element |
|---|---|
| 349–355 | Abschnittskopf „Massstabsleiste (unten rechts) …" |
| 357–364 | `function haversineMeter(lon1, lat1, lon2, lat2)` |
| 366–367 | Kommentar zu den Rundwerten |
| 368 | `const MASSSTAB_SCHRITTE = [ … ]` |
| 370–406 | `function zeichneMassstabsleiste(bbox, offsetX, alphaMultiplier)` |
| 409–413 | Abschnittskopf „Windrose (oben rechts) …" |
| 415–519 | `function zeichneWindrose(x, y, groesse, alphaMultiplier)` — samt der inneren Funktionen `zeichneZacke()` und `zeichneBeschriftung()` |

Der Block lag geschlossen zwischen `lonLatToScreen()` (endet Zeile 347) und
`bboxToImgCrop()` (begann Zeile 521); nach dem Herauslösen stossen diese beiden
mit der üblichen Leerzeile aneinander.

In `kartendekor.js` steht der Block unverändert unter einem neuen
Kopfkommentar, der Zweck, Abhängigkeiten und die nötige Ladereihenfolge nennt.

### Was in `sketch.js` bleibt

Die beiden **Aufrufstellen**, unverändert, in `draw()`:

```js
zeichneMassstabsleiste(activeBbox, massstabOffsetX, 1 - kreisVergleichMapFade);
zeichneWindrose(width - 90, 150, 50, 1 - kreisVergleichMapFade);
```

(vorher Zeilen 972/973, jetzt 800/801 — die Verschiebung ist reine Folge des
entfernten Blocks darüber.)

### Warum diese Gruppe zuerst

Laut Analyse eine der drei Gruppen, die sich „sofort herauslösen lassen, ohne an
`draw()` zu rühren". Konkret:

- **Kein Zugriff auf den Erzählzustand.** Beide Funktionen kennen weder
  `zoomedKapitel` noch `kapitelZoomAmount`, `SCROLL_MEILENSTEINE` oder die
  `ov*`-Caches. Alles, was sie brauchen — sichtbare Bbox, Kartenoffset,
  Alpha-Multiplikator — bekommen sie als Parameter.
- **Nur zwei Aufrufstellen**, beide direkt untereinander in `draw()`.
- **Abhängigkeiten ausschliesslich auf p5** (`width`/`height`, `push`/`pop`,
  `stroke`/`fill`, `textFont`/`textSize`/`textAlign`/`textStyle`, `circle`,
  `triangle`, `line`, `radians`, `cos`/`sin`, `HALF_PI`, `drawingContext`) —
  und p5 wird in `index.html` vor allem anderen geladen.

### `haversineMeter()` — Zuordnung geklärt

Die Analyse-Tabelle war an dieser Stelle widersprüchlich: sie führte
`haversineMeter` textlich unter Gruppe 1 („Geo & Projektion"), gab der Gruppe 2
aber den Zeilenbereich 365–527, der die Funktion einschliesst.

Aufgelöst zugunsten von Gruppe 2, nach Rückfrage: `zeichneMassstabsleiste` ist
ihr **einziger Aufrufer** im gesamten Projekt. Bliebe sie in `sketch.js`,
riefe `kartendekor.js` eine dort definierte Funktion auf — die Modulgrenze
wäre von Anfang an durchlässig. Als Mitbewohnerin ist `kartendekor.js`
eigenständig und hat ausser p5 keine Abhängigkeit.

Für die künftige Gruppe 1 heisst das: `haversineMeter` gehört **nicht** mehr
dorthin. Die übrigen Geo-Helfer (`lonLatToScreen`, `coverCrop`,
`bboxToImgCrop`, `cropToBbox`) sind davon unberührt und bleiben vorerst in
`sketch.js`.

### Prüfung vor dem Verschieben

Referenzsuche nach `zeichneMassstabsleiste`, `zeichneWindrose` und
`MASSSTAB_SCHRITTE` über `sketch.js`, `datenbereinigung.js`, `sonifikation.js`,
`index.html`, `style.css` sowie `data-prep/` und `kapitel karten/`:

**Keine Referenz ausserhalb von `sketch.js`.** Die drei Namen wurden
ausschliesslich dort definiert und dort aufgerufen; nichts in der
Python-Pipeline oder im Stylesheet greift darauf zu.

(Suche NUL-sicher über Python — `grep` überspringt `datenbereinigung.js`
stillschweigend, siehe [cleanup-log.md, Schritt 2](cleanup-log.md).)

### Ladereihenfolge in `index.html`

```diff
   <script src="datenbereinigung.js"></script>
+  <script src="kartendekor.js"></script>
   <script src="sketch.js"></script>
   <script src="sonifikation.js"></script>
```

Vor `sketch.js` eingehängt, wie beauftragt. Streng notwendig wäre es nicht —
beide Funktionen werden erst zur Laufzeit aus `draw()` gerufen, und
Funktionsdeklarationen im globalen Scope stehen unabhängig von der
Tag-Reihenfolge zur Verfügung. Die Reihenfolge macht die Abhängigkeit aber
sichtbar und bleibt gültig, falls später etwas beim Laden ausgewertet wird.

### Nachweis: keine Logikänderung

Der Korpus von `kartendekor.js` (ohne den neuen Kopfkommentar) wurde
zeichenweise gegen `sketch.js` Zeilen 349–519 des Vorzustands verglichen:

| | |
|---|---|
| Original aus `HEAD:sketch.js` | 171 Zeilen |
| Korpus in `kartendekor.js` | 171 Zeilen |
| Vergleich | **zeichenweise identisch** |

Kein Zeichen wurde umformatiert, umbenannt oder umsortiert.

### Weitere Prüfungen

- **Syntax:** `sketch.js`, `kartendekor.js` und `datenbereinigung.js` parsen
  fehlerfrei (JavaScriptCore, `new Function(quelltext)`).
- **Verbleib der Elemente:** alle vier Definitionen liegen in
  `kartendekor.js`; in `sketch.js` stehen nur noch die beiden Aufrufe
  (Zeilen 800/801).
- **Diff:** `sketch.js` −172 Zeilen (ausschliesslich Löschungen),
  `index.html` +1 Zeile, `kartendekor.js` neu.
- **Nahtstelle:** `lonLatToScreen()` und `bboxToImgCrop()` grenzen mit einer
  Leerzeile aneinander, wie im übrigen Sketch üblich.

### Zeilenverschiebung gegenüber der Analyse

Die Zeilenangaben in `code-analyse-sketch-js.md` beziehen sich auf Commit
`083d2eb`. Durch die Cleanup-Schritte haben sich alle Positionen ab Zeile 139
um **8 Zeilen nach oben** verschoben (2 Zeilen aus Schritt 2, 6 aus dessen
Nachtrag; die Löschungen aus Schritt 1 und 3 liegen weiter unten und wirken
sich auf diesen Bereich nicht aus):

| Element | Analyse (`083d2eb`) | vor dieser Extraktion |
|---|---|---|
| `haversineMeter` | 365 | 357 |
| `MASSSTAB_SCHRITTE` | 376 | 368 |
| `zeichneMassstabsleiste` | 378 | 370 |
| `zeichneWindrose` | 423 | 415 |
| `bboxToImgCrop` (dahinter) | 529 | 521 |

Der in der Analyse genannte Bereich **365–527 entspricht damit 357–519**.

> Die Zeilenangaben der Analyse sind ab jetzt an zwei Stellen veraltet: durch
> die Cleanups (−8 ab Zeile 139, mehr weiter unten) und durch diese Extraktion
> (−172 ab Zeile 349). Die Analyse dokumentiert bewusst den Ausgangszustand und
> wird nicht nachgeführt; für aktuelle Positionen gilt die Datei selbst.

### Manueller Test

Die Massstabsleiste steht unten rechts, die Windrose oben rechts — beide in
jeder Kartenansicht (Startseite, Kapitel-1-Ausschnitt, Kapitel-Zoom 02–18,
Übersicht). Beide blenden im Schlussakt mit der Karte aus. Ist eines von beiden
verschwunden oder wirft die Konsole `zeichneWindrose is not defined`, fehlt das
Script-Tag oder steht an falscher Stelle.
