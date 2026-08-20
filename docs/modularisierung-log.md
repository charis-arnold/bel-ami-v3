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

---

## Modul 2 — `ortsveraenderung.js`

**Datum:** 20. August 2026
**Neu:** `ortsveraenderung.js` (659 Zeilen, davon 36 Kopfkommentar)
**Aus:** `sketch.js` — 624 Zeilen entfernt (3304 → 2680)
**Geändert:** `index.html` — ein `<script>`-Tag ergänzt

Entspricht **Gruppe 8 („Schlussakt Ortsveränderung")** der Analyse, in der sie
als „der sauberste Kandidat" geführt war. Die Prüfung hat das im Kern bestätigt,
aber zwei Annahmen der Analyse korrigiert (siehe unten).

### Was wurde verschoben

Zusammenhängender Block, `sketch.js` Zeilen **1811–2433** (plus die
nachfolgende Leerzeile 2434) — 45 Top-Level-Namen:

| Zeilen (vorher) | Element |
|---|---|
| 1811–1819 | Kommentarkopf zu den sieben Knoten |
| 1820–1880 | `const VERGLEICHS_KNOTEN` — die sieben Orte mit Text, Kennzahlen, Koordinaten und Namensvarianten |
| 1882–1897 | Phasenfenster `OV_LINIE_WACHSEN`, `OV_KARTE_AUS`, `OV_LINIE_ZURUECK`, `OV_LABEL_EIN`, `OV_ZOOM`, `OV_KAPITEL`, `SK_EINBLENDEN`, `SK_RAUSZOOM`, `SK_TEXT` |
| 1899–1948 | Layout-Konstanten `OV_STAFFEL`, `OV_ZOOM_RAND`, `OV_LINIE_*`, `OV_LABEL_*`, `OV_TEXT_*`, `OV_DATEN_*` |
| 1938–1998 | `ovVersatz()`, `ovTextUmbruch()`, `ovLabelZeilen()`, `ovPhase()` |
| 1999–2002 | Caches `ovProKapitel`, `ovRohradien`, `ovErstesKapitel`, `ovLayout` |
| 2004–2076 | `ovAddiere()`, `ovRadiusAus()`, `ovBaueDaten()`, `ovStand()` |
| 2077–2246 | `ovBerechneLayout()` — iteratives Zoom-/Skalen-Layout |
| 2247–2256 | `ovZoomBbox()` |
| 2258–2433 | `zeichneOrtsveraenderung()` |

Der Block lag geschlossen zwischen `zeichneRoute()` (endet Zeile 1809) und dem
Kommentarkopf der Übersichtsrouten (ab 2435).

### Zwei Korrekturen an der Analyse

**1. Es ist nicht *eine* Aufrufstelle in `draw()`, sondern sieben.**

Die Analyse nannte „eine einzige Aufrufstelle in `draw()` plus `ovZoomBbox()`"
und übersah dabei die fünf `ovPhase()`-Aufrufe mit ihren vier Konstanten:

| `sketch.js` | Referenz |
|---|---|
| 703 | `ovPhase(skFortschritt, SK_EINBLENDEN)` |
| 704 | `ovPhase(skFortschritt, SK_RAUSZOOM)` |
| 705 | `ovPhase(skFortschritt, SK_TEXT)` |
| 706 | `ovPhase(ovFortschritt, OV_KARTE_AUS)` |
| 728 | `ovPhase(ovFortschritt, OV_ZOOM)` |
| 730 | `ovZoomBbox()` |
| 864 | `zeichneOrtsveraenderung(…)` |

Alle sieben bleiben unverändert in `draw()` und greifen nun ins Modul hinein.
`ovPhase()` ist damit faktisch öffentliche Schnittstelle, nicht Interna — das
sollte bei einer späteren Umstellung auf ES-Module beim Export berücksichtigt
werden.

**2. Drei `OV_*`/`ov*`-Namen gehören nicht zum Schlussakt.**

`OV_SCHEIBE_GRUNDANTEIL`, `ovScheiben` und `OV_NACHGLUEHEN` tragen dasselbe
Präfix, liegen aber ausserhalb des Blocks und werden **ausschliesslich** von
`kapitelScheiben()` und `kapitelHitze()` benutzt — Funktionen des
Übersichtsrouten-Akts (Gruppe 7). Sie steuern, wie die Scrollstrecke des
Übersichtsakts auf die Kapitel verteilt wird und wie eine frisch gezeichnete
Route auf Gold abkühlt; mit der Ortsveränderung haben sie nichts zu tun.

Wörtlich genommen fielen sie unter „alle `OV_*`-Konstanten". Sie sind bewusst
**in `sketch.js` geblieben**: mitgenommen hätten sie eine Rückabhängigkeit von
`sketch.js` auf das neue Modul erzeugt, für Code, der thematisch gar nicht
dorthin gehört. Das irreführende Präfix bleibt als Altlast bestehen — eine
Umbenennung wäre eine Logik-fremde Änderung und gehört nicht in einen
Verschiebeschritt.

### Abhängigkeiten des Moduls nach aussen

Anders als `kartendekor.js` ist dieses Modul **nicht** eigenständig. Es greift
auf zwölf Namen zu, die anderswo definiert sind — alle Zugriffe erfolgen erst
zur Laufzeit:

| aus `sketch.js` | aus `datenbereinigung.js` |
|---|---|
| `stationenData` | `KREIS_KATEGORIEN` |
| `uebersichtsRouten` | `ROUTE_COLOR_RGB` |
| `datenFuerKapitel()` | `kreisRadius()` |
| `leereBandCounts()` | `sammleAnnotationenNachOrtBasis()` |
| `lonLatToScreen()` | `zaehleAnnotationenLiveNachOrtBasis()` |
| `zeichneKreiseFuerRun()` | |
| `zeichneFwertPunkte()` | |

Kein Zugriff auf `kartendekor.js`. Ebenfalls bemerkenswert: **kein Zugriff auf
die Zoom-Zustandsvariablen** (`zoomedKapitel`, `kapitelZoomAmount`,
`kapitel1ZoomAmount`) und nicht auf `SCROLL_MEILENSTEINE` — der Aktfortschritt
kommt als Parameter `p`, die Bbox als Parameter `bbox`. Genau das machte die
Gruppe zum guten Kandidaten.

Die fünf Namen aus `datenbereinigung.js` sind unkritisch: die Datei wird vorher
geladen. Die sieben aus `sketch.js` wären es nur, wenn dieses Modul beim Laden
etwas auswerten würde — tut es nicht (siehe nächster Abschnitt).

### Ladezeit-Sicherheit geprüft

Vor dem Verschieben wurde geprüft, ob ein Top-Level-Initialisierer des Blocks
eine Funktion aufruft. Das wäre der einzige Fall, in dem die Platzierung vor
`sketch.js` scheitern würde — so wie es etwa
`const FWERT_PUNKT_FARBE_RGB = hexZuRgb(FWERT_PUNKT_FARBE)` in `sketch.js` täte,
das `datenbereinigung.js` beim Laden braucht.

**Ergebnis: keiner.** Sämtliche 30 Top-Level-Initialisierer des Blocks sind
reine Literale — Arrays (`[0.32, 0.52]`), Zahlen, Strings oder `null`. Die vier
Cache-Variablen starten auf `null` und werden erst von `ovBaueDaten()` bzw.
`ovBerechneLayout()` gefüllt, beide zur Laufzeit aus `zeichneOrtsveraenderung()`
heraus.

### Ladereihenfolge in `index.html`

```diff
   <script src="datenbereinigung.js"></script>
   <script src="kartendekor.js"></script>
+  <script src="ortsveraenderung.js"></script>
   <script src="sketch.js"></script>
   <script src="sonifikation.js"></script>
```

### Nachweis: keine Logikänderung

| | |
|---|---|
| Original aus `HEAD:sketch.js` ab Zeile 1811 | 623 Zeilen |
| Korpus in `ortsveraenderung.js` (ohne Kopf) | 623 Zeilen |
| Vergleich | **zeichenweise identisch** |

Kein Zeichen umformatiert, umbenannt oder umsortiert.

### Weitere Prüfungen

- **Syntax:** `sketch.js`, `kartendekor.js`, `ortsveraenderung.js` und
  `datenbereinigung.js` parsen fehlerfrei (JavaScriptCore).
- **Alle 45 Definitionen** liegen in `ortsveraenderung.js`; in `sketch.js`
  stehen nur noch die sieben Aufrufstellen aus `draw()`.
- **Keine unerwarteten Reste:** eine Suche nach `ov*`/`OV_*`/`SK_*`/
  `VERGLEICHS_KNOTEN` in `sketch.js` findet ausschliesslich die sieben
  Aufrufstellen, deren lokale Variablen (`ovFortschritt`, `ovZoom`) und die
  drei bewusst zurückgelassenen Namen.
- **Nahtstelle:** `zeichneRoute()` und der Kommentarkopf der Übersichtsrouten
  grenzen mit einer Leerzeile aneinander.

### Zwischenstand der Modularisierung

| Datei | Zeilen |
|---|---|
| `sketch.js` | 2680 (von ursprünglich 3497) |
| `ortsveraenderung.js` | 659 |
| `kartendekor.js` | 187 |
| `datenbereinigung.js` | 475 |
| `sonifikation.js` | unverändert |

`sketch.js` hat damit rund 23 % seines Umfangs abgegeben.

### Manueller Test

Bis ans Ende durchscrollen. Der Schlussakt muss unverändert ablaufen: senkrechte
Linien wachsen gestaffelt aus den sieben Orten, die Karte blendet aus, die Linien
schrumpfen zurück, die Ansicht zoomt auf den Ausschnitt aller sieben, die
Erläuterungsblöcke erscheinen nacheinander (Redaktion/Madeleine/Boulevards ab
Kapitel 1, Rue Boursault ab 3, Rue Constantinople ab 5, Rue Fontaine und Palais
Walter ab 6), der Kapitelzähler läuft bis 18. Danach kehrt die Startkarte zurück
und der Schlusstext blendet ein.

Bleibt der Bildschirm im letzten Akt leer oder meldet die Konsole
`zeichneOrtsveraenderung is not defined`, fehlt das Script-Tag oder steht nach
`sketch.js`.
