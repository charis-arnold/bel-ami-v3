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

### Diagnose: „Karte da, alles andere weg"

Ein Symptommuster, das mit jedem Extraktionsschritt wahrscheinlicher wird und
**kein Code-Fehler** ist. In `draw()` steht die Kartenzeichnung vor den
Aufrufen in die ausgelagerten Module:

| Zeile | Aufruf | Modul |
|---|---|---|
| 692 | `ovPhase(…)` | `ortsveraenderung.js` |
| 776 | `image(currentBgImage, …)` | — Karte erscheint |
| 789/790 | `zeichneMassstabsleiste()`, `zeichneWindrose()` | `kartendekor.js` |
| 820 | `zeichneUebersichtsrouten()` | — Kapitel-Badges |
| 1160 | `zeichneFotoMarker()` | `fotomarker.js` |

Lädt eine Moduldatei nicht, wirft der erste Zugriff darauf einen
`ReferenceError`, und `draw()` bricht an dieser Stelle ab — alles davor ist
gezeichnet, alles danach fehlt. Je nachdem, welche Datei fehlt, sieht man ein
anderes Teilbild; fällt `kartendekor.js` aus, bleibt genau die Karte ohne
Massstab, Windrose, Badges und Foto-Marker stehen.

Die häufigste Ursache ist der Browser-Cache: jede Extraktion fügt eine Datei
hinzu, die separat gecacht wird, und eine veraltete `index.html` kennt die
neuen `<script>`-Tags noch nicht. Ein solcher Fall trat nach Modul 3 einmal auf
und verschwand mit einem Neuladen.

**Faustregel:** Fehlen Overlays, während die Karte steht, zuerst Hard-Reload
(Cmd+Shift+R) und im Netzwerk-Tab prüfen, ob alle `.js`-Dateien mit Status 200
kommen — erst danach Code lesen. Der zugehörige Konsolenfehler ist leicht zu
übersehen, weil Chrome die bei 60 fps millionenfach identische Meldung zu einer
einzigen Zeile mit Zähler zusammenfasst.

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

---

## Modul 3 — `spine-horizontal.js`

**Datum:** 20. August 2026
**Neu:** `spine-horizontal.js` (441 Zeilen, davon 49 Kopfkommentar)
**Aus:** `sketch.js` — 393 Zeilen entfernt (2680 → 2287)
**Geändert:** `index.html` — ein `<script>`-Tag ergänzt

Entspricht **Gruppe 9 („Graph-Ansicht / horizontale Spine")** der Analyse, dort
als „zweitsauberster Kandidat" geführt. Die Prüfung zeigt: sauber abgegrenzt ist
der **Code**, nicht der **Zustand** — dazu unten mehr.

### Was wurde verschoben

Anders als bei Modul 1 und 2 waren es **zwei getrennte Blöcke**:

**Block A — Play-Zustand, `sketch.js` Zeilen 91–100** (10 Zeilen), lag oben bei
den übrigen Zustandsvariablen:

| Zeile | Element |
|---|---|
| 91 | `let grafikSpielt` |
| 92 | `let grafikStartZeit` |
| 93 | `let grafikFortschritt` |
| 94–99 | Kommentar zum Play-Ausblenden des Einstiegstexts |
| 100 | `let grafikPlayAusblendStart` |

**Block B — der Spine-Abschnitt, `sketch.js` Zeilen 2299–2679** (381 Zeilen), bis
dahin das Ende der Datei:

| Zeilen (vorher) | Element |
|---|---|
| 2299–2301 | Abschnittskopf „Spine in p5" |
| 2303–2306 | `spineEintraegep5`, `spineEintraegeKapitel` |
| 2308–2334 | `setzeKapitelAnsichtModus()` |
| 2336–2354 | `aktuelleGrafikAnimationDauer()` |
| 2356–2369 | `toggleGrafikPlay()` |
| 2371–2375 | `aktualisiereGrafikFortschritt()` |
| 2388–2414 | `SPINE_PUNKT_ABSTAND`, `SPINE_RAND_LINKS`/`_RECHTS`/`_OBEN`/`_UNTEN`, `SPINE_LABEL_*` (5), `spineLayoutCache` |
| 2416–2505 | `spineLayout()` |
| 2507–2679 | `zeichneSpineHorizontal()` |

Beide Blöcke stehen in `spine-horizontal.js` unverändert untereinander, Block A
zuerst.

### Ein Name, der zurückblieb

**`grafikPlayButton`** (`sketch.js:90`) fällt wörtlich unter „alle
`grafik*`-State-Variablen", ist aber kein Zustand, sondern ein DOM-Handle — und
wird **ausschliesslich in `setup()` und `draw()`** benutzt, nie im Modul.
Verschoben hätte er eine Variable im Spine-Modul deklariert, die nur `sketch.js`
anfasst. Er steht daher weiterhin bei den übrigen DOM-Referenzen.

Analog zur Entscheidung bei `OV_SCHEIBE_GRUNDANTEIL` in Modul 2: das gemeinsame
Präfix ist kein Zugehörigkeitsbeweis.

### Der Zustand ist geteilt, nicht gekapselt

Das ist der wesentliche Unterschied zu den bisherigen Modulen. `kartendekor.js`
ist vollständig eigenständig, `ortsveraenderung.js` liest zwar von aussen, hält
seinen Zustand aber für sich. Hier dagegen **schreibt `sketch.js` in den Zustand
des Moduls**:

| Von | Zeile | Zugriff |
|---|---|---|
| `draw()` | 599, 600 | **schreibt** `spineEintraegep5` |
| `draw()` | 611, 614 | **schreibt** `spineEintraegeKapitel` |
| `setzeKapitelAnsichtZurueck()` | 2231–2233 | **schreibt** `grafikSpielt`, `grafikFortschritt`, `grafikPlayAusblendStart` |
| `draw()` | 866, 1004, 1089–1136 | liest `spineEintraege*`, `grafikSpielt`, `grafikPlayAusblendStart` |
| `draw()` | 868, 869 | ruft `aktualisiereGrafikFortschritt()`, `zeichneSpineHorizontal()` |
| `setup()` | 281 | hängt `toggleGrafikPlay` an den Play-Button |
| `baueKapitelRegister()` | 395, 402 | ruft `setzeKapitelAnsichtModus()` |

Das trägt, weil `let` auf Top-Level eines klassischen Scripts im globalen
Lexical Environment landet und von später geladenen Dateien les- **und
schreibbar** ist. Bei einer späteren Umstellung auf ES-Module reicht ein
`export` hier aber nicht: importierte Bindungen sind schreibgeschützt. Dann
müsste der Zustand hinter Setter-Funktionen wandern (etwa
`setzeSpineEintraege()`, `setzeGrafikZustandZurueck()`) oder `draw()` müsste den
Aufbau der Spine-Caches an das Modul abgeben — die naheliegendere Lösung, denn
inhaltlich gehört er ohnehin dorthin.

### Abhängigkeiten des Moduls nach aussen

16 Namen, alle erst zur Laufzeit gebraucht:

| aus `sketch.js` (5) | aus `datenbereinigung.js` (6) | aus `sonifikation.js` (5) |
|---|---|---|
| `kapitelAnsichtsModus` | `KREIS_KATEGORIEN` | `SONIFIKATION_GESAMTDAUER_SEK` |
| `zoomedKapitel` | `ROUTE_COLOR_RGB` | `sonifikationSpieltGerade` |
| `stationenData` | `kreisRadius` | `beendeSonifikationAudio` |
| `zeichneKreiseFuerRun` | `wohnungFilterFuerOrt` | `spieleKapitel1SonifikationAudio` |
| `zeichneFwertPunkte` | `sammleAnnotationenNachOrtBasis` | `spieleKapitelSonifikationAudio` |
| | `zaehleAnnotationenLiveNachOrtBasis` | |

Keine Zugriffe auf `kartendekor.js` oder `ortsveraenderung.js` — die drei Module
kennen einander nicht.

### Abhängigkeitszyklus mit `sonifikation.js`

Beide Dateien greifen **gegenseitig** aufeinander zu:

```
spine-horizontal.js ──5 Namen──▶ sonifikation.js
                    ◀──2 Namen──
```

Zurück greift `sonifikation.js` an zwei Stellen:

| Zeile | Zugriff |
|---|---|
| 264 | `let eintraege = spineEintraegeKapitel[nr];` |
| 292 | `let gesamtdauerSek = aktuelleGrafikAnimationDauer() / 1000;` |

In der Ladereihenfolge steht `spine-horizontal.js` an Position 4,
`sonifikation.js` an Position 6 — eine der beiden Dateien steht also
zwangsläufig vor ihrer Abhängigkeit. **Das trägt nur, weil sämtliche Zugriffe in
beiden Richtungen zur Laufzeit stattfinden:** `sonifikation.js:264/292` stehen in
`spieleKapitelSonifikationAudio()`, das Modul ruft die Audio-Funktionen erst aus
`toggleGrafikPlay()` heraus.

Geprüft und im Kopfkommentar der Datei als Warnung festgehalten: **kein
Top-Level-Initialisierer darf hier je eine fremde Funktion aufrufen.** Der
einzige nicht-literale Initialisierer ist derzeit `new WeakMap()` für
`spineLayoutCache` — ein eingebauter Konstruktor ohne Fremdbezug.

Inhaltlich ist der Zyklus kein Zufall: Ton und Wachstumsanimation müssen
dieselbe Gesamtdauer verwenden, damit sie synchron laufen. Aufzulösen wäre er,
indem die Dauerberechnung in eine dritte, abhängigkeitsfreie Datei wandert.

### Ladereihenfolge in `index.html`

```diff
   <script src="datenbereinigung.js"></script>
   <script src="kartendekor.js"></script>
   <script src="ortsveraenderung.js"></script>
+  <script src="spine-horizontal.js"></script>
   <script src="sketch.js"></script>
   <script src="sonifikation.js"></script>
```

### Nachweis: keine Logikänderung

| Block | Original | Modul | Vergleich |
|---|---|---|---|
| A (`grafik*`) | `HEAD:sketch.js` ab Z. 91 | 10 Zeilen | **zeichenweise identisch** |
| B (Spine) | `HEAD:sketch.js` ab Z. 2299 | 381 Zeilen | **zeichenweise identisch** |

### Ladereihenfolge praktisch getestet

Erstmals nicht nur statisch geprüft, sondern ausgeführt: alle sechs Dateien
wurden in JavaScriptCore in exakt der `index.html`-Reihenfolge geladen, mit
minimalen Stubs für `document`/`window` und die p5-Konstanten.

- Alle sechs Dateien laden **fehlerfrei** — kein `ReferenceError`, keine
  Temporal-Dead-Zone-Verletzung.
- Stichprobe über Dateigrenzen hinweg nach dem Laden: `zeichneSpineHorizontal`,
  `aktuelleGrafikAnimationDauer`, `toggleGrafikPlay`, `setzeKapitelAnsichtModus`,
  `zeichneOrtsveraenderung`, `zeichneWindrose` und `draw` sind `function`;
  `grafikFortschritt` ist `number`, `spineEintraegeKapitel` `object`,
  `SPINE_PUNKT_ABSTAND` und `SONIFIKATION_GESAMTDAUER_SEK` `number`.
- `grafikPlayButton` ist erwartungsgemäss `undefined` — es wird erst in `setup()`
  aus dem DOM geholt.

Der Test deckt das Laden ab, nicht das Laufzeitverhalten (dafür fehlt p5).

### Weitere Prüfungen

- **Syntax:** alle sechs JS-Dateien parsen fehlerfrei.
- **Alle 22 Definitionen** liegen in `spine-horizontal.js`; in `sketch.js`
  stehen nur noch die Zugriffe aus `setup()`, `baueKapitelRegister()`, `draw()`
  und `setzeKapitelAnsichtZurueck()`.
- **Keine unerwarteten Reste:** eine Suche nach `SPINE_*`/`spine*` in
  `sketch.js` findet ausschliesslich die sechs Zugriffe auf
  `spineEintraegep5`/`spineEintraegeKapitel` in `draw()`.
- **Nahtstellen:** bei Zeile 90 folgt auf `let grafikPlayButton;` direkt der
  Georeferenz-Abschnitt; am Dateiende schliesst `springeZurUebersicht()` die
  Datei ab.

### Zwischenstand der Modularisierung

| Datei | Zeilen |
|---|---|
| `sketch.js` | **2287** (von ursprünglich 3497) |
| `ortsveraenderung.js` | 659 |
| `datenbereinigung.js` | 475 |
| `spine-horizontal.js` | 441 |
| `kartendekor.js` | 187 |
| `sonifikation.js` | unverändert |

`sketch.js` hat damit rund **35 %** seines ursprünglichen Umfangs abgegeben.

### Manueller Test

1. Ein Kapitel öffnen, im Kapitelregister links auf **„Graph"** schalten — die
   waagrechte Spine muss erscheinen, mit Ortspunkten, Beschriftungen und
   Rückkehr-Bögen.
2. **Play** drücken: die Kreise wachsen von links nach rechts, der Ton läuft
   synchron, der Kapitel-Einstiegstext blendet aus. Button wechselt auf ❚❚.
3. **Pause** und erneut Play: die Spine wächst an derselben Stelle weiter (der
   Ton beginnt neu — bekanntes Verhalten, Strudel kann nicht einsteigen).
4. Auf **„Plan"** zurückschalten: Animation springt auf 0, Ton stoppt.
5. Kapitel wechseln: die Ansicht startet wieder in der Kartenansicht.
6. Kapitel 1 gegenprüfen — es nutzt die eigene Sonifikationsdauer
   (`SONIFIKATION_GESAMTDAUER_SEK`), 02–18 die daraus abgeleitete pro Eintrag.

Meldet die Konsole `zeichneSpineHorizontal is not defined` oder bleibt der
Play-Button wirkungslos, steht das Script-Tag falsch.

---

## Modul 4 — `fotomarker.js`

**Datum:** 20. August 2026
**Neu:** `fotomarker.js` (110 Zeilen, davon 44 Kopfkommentar)
**Aus:** `sketch.js` — 56 Zeilen entfernt (2287 → 2231)
**Geändert:** `index.html` — ein `<script>`-Tag ergänzt

Entspricht **Gruppe 6 („Foto-Marker & Popup")** der Analyse. Das kleinste
Modul bisher — und das erste, bei dem „nur verschieben" an eine echte Grenze
stiess.

### Was wurde verschoben

Der Bereich lag **nicht** zusammenhängend, sondern in vier getrennten Stücken:

| Zeilen (vorher) | Element |
|---|---|
| 61 | `let fotoPopup, fotoPopupTitel, fotoPopupPlz, fotoPopupBild, fotoPopupBeschreibung;` |
| 120–122 | Abschnittskommentar, `fotoMarkerListe`, `letzteActiveBbox` |
| 124 | `const FOTO_MARKER_TREFFER_RADIUS = 12;` |
| 1174–1215 | Abschnittskopf „Foto-Marker (Fotobank Huma-Num/FNP)" + `zeichneFotoMarker()` |
| 1238–1249 | `oeffneFotoPopup()`, `schliesseFotoPopup()` |

Die **DOM-Handles aus Zeile 61** waren in der Vorgabe nicht genannt, sind aber
mitgewandert: `fotoPopupTitel`, `fotoPopupPlz`, `fotoPopupBild` und
`fotoPopupBeschreibung` werden ausserhalb des Moduls **nur** in `setup()`
befüllt und sonst nirgends gelesen; `fotoPopup` zusätzlich für zwei Listener.
Sie dienen ausschliesslich dem Popup.

Das unterscheidet sie von `grafikPlayButton` (Modul 3), der zurückblieb: der
wird im Modul überhaupt nicht benutzt, nur in `setup()` und `draw()`.

### Zwei Dinge blieben bewusst zurück

**1. `letzterFotoOffsetX` / `letzterFotoOffsetY` (`sketch.js:123`)**

Die Deklaration lautet:

```js
let letzterFotoOffsetX = mapOffsetX, letzterFotoOffsetY = mapOffsetY;
```

Sie **liest beim Laden** zwei Variablen, die in `sketch.js` (Zeilen 116/117)
deklariert sind. In einer Datei, die vor `sketch.js` geladen wird, läge dieser
Zugriff vor deren Deklaration.

Isoliert nachgestellt: eine früher geladene Datei, die auf diese Weise ein
späteres `let` liest, bricht mit
`ReferenceError: Can't find variable: mapOffsetX` ab. Die Datei wäre damit
komplett wirkungslos — `zeichneFotoMarker` undefiniert, `draw()` scheitert.

Genau der Fall, vor dem der Kopfkommentar von `spine-horizontal.js` warnt;
hier tritt er zum ersten Mal real auf. Die Alternativen wären gewesen, die
Initialisierung zu verzögern (`let letzterFotoOffsetX, letzterFotoOffsetY;`)
oder das Modul hinter `sketch.js` zu laden — beides nach Rückfrage verworfen
zugunsten der Variante ohne jede Verhaltensänderung. Die beiden Merker stehen
jetzt direkt bei `mapOffsetX`/`mapOffsetY`, mit einem Kommentar, der erklärt
warum.

**2. Der Foto-Teil von `mousePressed()`**

`mousePressed` ist eine p5-Lifecycle-Funktion und behandelt zwei Dinge
nacheinander: erst die Kapitel-Badges (mit `return`), dann die Foto-Marker.
Die Foto-Schleife herauszulösen hiesse, eine neue Funktion zu erfinden und den
Kontrollfluss umzubauen — eine Logikänderung, die alle bisherigen Module
vermieden haben. Die Funktion bleibt vollständig in `sketch.js`; vor der
Schleife steht jetzt ein Verweis:

```js
// Foto-Marker: Treffertest und Popup liegen in fotomarker.js
```

Ein späterer Umbau (etwa `fotoMarkerUnterMaus()` im Modul, aufgerufen aus
`mousePressed`) wäre sinnvoll, gehört aber in einen eigenen Schritt.

### `FOTO_MARKER_TREFFER_RADIUS` ist mitgewandert

Die Konstante wird auch von `zeichneUebersichtsrouten()` genutzt (zwei Stellen,
Hover-Test der Kapitel-Badges) — dieselbe Distanz, damit sich alle Klickziele
der Karte gleich grosszügig anfühlen. Nach Rückfrage mitgenommen: Name und
Hauptnutzung gehören zum Fotomarker, `sketch.js` greift jetzt für die zwei
Hover-Tests darauf zu.

Anders als bei `OV_SCHEIBE_GRUNDANTEIL` (Modul 2), das zurückblieb: dort lagen
Name und Nutzung auseinander, hier decken sie sich.

### Abhängigkeiten des Moduls nach aussen

Die kürzeste Liste aller bisherigen Module — vier Namen:

| aus `sketch.js` | aus `datenbereinigung.js` |
|---|---|
| `lonLatToScreen` | `FWERT_COLOR_RGB` |
| `mapOffsetX`, `mapOffsetY` (Default-Parameter von `zeichneFotoMarker`, erst beim Aufruf ausgewertet) | |
| `letzterFotoOffsetX`, `letzterFotoOffsetY` (siehe oben) | |

Keine Zugriffe auf `kartendekor.js`, `ortsveraenderung.js`, `spine-horizontal.js`
oder `sonifikation.js`. Kein Zugriff auf `zoomedKapitel`, `kapitelZoomAmount`
oder `SCROLL_MEILENSTEINE` — die Ebene kennt keinen Erzählzustand.

### Wer von aussen hierher greift

| Von | Zugriff |
|---|---|
| `preload()` | lädt `fotomarker.json` nach `fotoMarkerListe` |
| `bereinigeEingangsdaten()` | ersetzt sie durch `bereinigeFotoMarker(...)` |
| `setup()` | befüllt die fünf `fotoPopup*`-Handles, hängt drei Listener auf `schliesseFotoPopup` |
| `draw()` | schreibt `letzteActiveBbox`, ruft `zeichneFotoMarker()` |
| `mousePressed()` | liest `fotoMarkerListe`, `letzteActiveBbox`, `FOTO_MARKER_TREFFER_RADIUS`, ruft `oeffneFotoPopup()` |
| `zeichneUebersichtsrouten()` | liest `FOTO_MARKER_TREFFER_RADIUS` |

Wie bei Modul 3 ist der Zustand **geteilt, nicht gekapselt**: `preload()`,
`bereinigeEingangsdaten()`, `setup()` und `draw()` schreiben hinein.

### Ladereihenfolge in `index.html`

```diff
   <script src="datenbereinigung.js"></script>
   <script src="kartendekor.js"></script>
   <script src="ortsveraenderung.js"></script>
   <script src="spine-horizontal.js"></script>
+  <script src="fotomarker.js"></script>
   <script src="sketch.js"></script>
   <script src="sonifikation.js"></script>
```

### Nachweis: keine Logikänderung

Jeder verschobene Codeblock wurde einzeln gegen `HEAD:sketch.js` verglichen:

| Block | Zeilen | Vergleich |
|---|---|---|
| DOM-Handles | 1 | identisch |
| `fotoMarkerListe` / `letzteActiveBbox` | 2 | identisch |
| `FOTO_MARKER_TREFFER_RADIUS` | 1 | identisch |
| `zeichneFotoMarker()` | 38 | identisch |
| `oeffneFotoPopup()` | 8 | identisch |
| `schliesseFotoPopup()` | 3 | identisch |

Neu hinzugekommen sind ausschliesslich **Kommentare**: der Dateikopf, drei
Zeilen zum Trefferradius, vier Zeilen bei den zurückgebliebenen Merkern in
`sketch.js` und der Verweis in `mousePressed`. Kein ausführbares Zeichen wurde
geändert.

### Weitere Prüfungen

- **Syntax:** alle sieben JS-Dateien parsen fehlerfrei.
- **Ladereihenfolge ausgeführt:** alle sieben Dateien laden in
  `index.html`-Reihenfolge fehlerfrei (JavaScriptCore, mit Stubs) — der
  TDZ-Fall tritt dank der zurückgelassenen Zeile 123 nicht ein.
- **Namenskollisionen:** keine (245 Top-Level-Namen über alle Dateien).
- **Definitionen:** alle acht liegen in `fotomarker.js`, `letzterFotoOffsetX/Y`
  erwartungsgemäss in `sketch.js:123`.

### Zwischenstand der Modularisierung

| Datei | Zeilen |
|---|---|
| `sketch.js` | **2231** (von ursprünglich 3497) |
| `ortsveraenderung.js` | 659 |
| `datenbereinigung.js` | 475 |
| `spine-horizontal.js` | 441 |
| `kartendekor.js` | 187 |
| `fotomarker.js` | 110 |
| `sonifikation.js` | unverändert |

`sketch.js` hat damit rund **36 %** seines ursprünglichen Umfangs abgegeben.

### Manueller Test

1. In einer Kartenansicht (Startseite, Kapitel-Zoom, Übersicht) müssen die
   Sternchen-Marker sichtbar sein; im Kapitel-Zoom grösser als in der Übersicht
   (Grösse skaliert mit `kartenZoomFaktor`).
2. Mit der Maus darüberfahren: das Sternchen wird grösser und rot (`#C2511C`),
   daneben erscheint ein schwarzes Label mit dem Fototitel.
3. Klicken: das Popup öffnet mit Bild, Titel, PLZ und Beschreibung.
4. Schliessen auf drei Wegen prüfen — Schliessen-Knopf, Klick auf den
   Hintergrund, Escape.
5. In der Graph-Ansicht dürfen **keine** Marker zu sehen sein.
6. Im Schlussakt blenden sie mit der Karte aus.

---

## Modul 5 — `annotationsbox.js`

**Datum:** 20. August 2026
**Neu:** `annotationsbox.js` (129 Zeilen, davon 37 Kopfkommentar)
**Aus:** `sketch.js` — 93 Zeilen entfernt (2231 → 2138)
**Geändert:** `index.html` — ein `<script>`-Tag ergänzt

Entspricht **Gruppe 10 („Annotationsbox-Platzierung")** der Analyse. Der
glatteste Schnitt bisher: ein zusammenhängender Block, eine aufrufende
Funktion, kein Sonderfall.

### Was wurde verschoben

Ein einziger zusammenhängender Block, `sketch.js` Zeilen **1251–1342** (plus
die nachfolgende Leerzeile 1343):

| Zeilen (vorher) | Element |
|---|---|
| 1251–1265 | Abschnittskopf mit der Begründung, warum die Box ausweicht statt der Karte |
| 1266 | `const ANNOTATION_BOX_PLAETZE` — die vier Plätze in Bevorzugungsreihenfolge |
| 1267–1269 | Kommentar + `const ANNOTATION_BOX_PLATZ_FEST` (manuelle Übersteuerung je Kapitel) |
| 1270–1273 | `ANNOTATION_BOX_BREITE`, `ANNOTATION_BOX_RAND_X`, `ANNOTATION_BOX_RAND_OBEN`, `ANNOTATION_BOX_RAND_UNTEN` |
| 1274 | `const annotationBoxPlatzCache = new Map();` |
| 1276–1342 | `function annotationBoxPlatz(kapitelNr, daten, bbox)` |

Der Block lag geschlossen zwischen `leereBandCounts()` (endet Zeile 1249) und
`zeichneKreiseOrtRuns()` (begann 1344); beide grenzen jetzt mit einer Leerzeile
aneinander.

### Keine Sonderfälle

Anders als bei den vorherigen vier Modulen gab es nichts zurückzulassen und
nichts zu klären:

- **Kein Element mit geteilter Zuständigkeit** (wie `OV_SCHEIBE_GRUNDANTEIL`
  in Modul 2 oder `FOTO_MARKER_TREFFER_RADIUS` in Modul 4).
- **Kein Element mit irreführendem Präfix** (wie `grafikPlayButton` in Modul 3).
- **Kein Ladezeit-Problem** (wie `letzterFotoOffsetX` in Modul 4): einziger
  Top-Level-Initialisierer ist `new Map()` — ein eingebauter Konstruktor ohne
  Zugriff auf fremde Variablen.
- **Kein zerrissener Bereich** — alles lag an einem Stück beisammen.

### Abhängigkeiten in beide Richtungen

**Wer von aussen hierher greift** — ausschliesslich `draw()`, an zwei
unmittelbar benachbarten Zeilen:

| `sketch.js` | Zugriff |
|---|---|
| 887 | `let platz = annotationBoxPlatz(platzKapitel, platzDaten, platzBbox);` |
| 888 | `ANNOTATION_BOX_PLAETZE.forEach(p => annotationBoxEl.classList.toggle('pos-' + p, p === platz));` |

**Worauf das Modul zugreift** — neun Namen:

| aus `sketch.js` (5) | aus `datenbereinigung.js` (4) |
|---|---|
| `annotationText` (nur für `getComputedStyle` — die Boxhöhe wird aus der echten Schriftgrösse geschätzt) | `KREIS_KATEGORIEN` |
| `lonLatToScreen` | `kreisRadius` |
| `mapOffsetX`, `mapOffsetY` | `wohnungFilterFuerOrt` |
| `sammelpunktKategorie` | `zaehleAnnotationenLiveNachOrtBasis` |

**Ausdrücklich geprüft, weil danach gefragt war:** Es besteht **keine
Verbindung in beide Richtungen** zu `kartendekor.js`, `ortsveraenderung.js`,
`spine-horizontal.js` oder `fotomarker.js`. Weder greift das Modul dorthin,
noch greift eines von ihnen hierher. Die inzwischen sechs ausgelagerten
Bereiche kennen einander weiterhin nicht — jede Kommunikation läuft über
`sketch.js` und `datenbereinigung.js`.

Der Zustand ist hier **gekapselt**, nicht geteilt: `annotationBoxPlatzCache`
wird nur innerhalb des Moduls gelesen und geschrieben. Damit ist es nach
`kartendekor.js` das zweite Modul, das einer späteren ES-Modul-Umstellung
nichts entgegensetzt — bei Modul 3 und 4 schreibt `sketch.js` dagegen in den
Modulzustand hinein.

`annotationBoxEl` (das DOM-Element, das die Klasse trägt) bleibt in
`sketch.js`: Es wird nur dort gesetzt und benutzt, das Modul liefert lediglich
den Platznamen und fasst das Element nie an.

### Ladereihenfolge in `index.html`

```diff
   <script src="spine-horizontal.js"></script>
   <script src="fotomarker.js"></script>
+  <script src="annotationsbox.js"></script>
   <script src="sketch.js"></script>
   <script src="sonifikation.js"></script>
```

### Nachweis: keine Logikänderung

| | |
|---|---|
| Original aus `HEAD:sketch.js` ab Zeile 1251 | 92 Zeilen |
| Korpus in `annotationsbox.js` (ohne Kopf) | 92 Zeilen |
| Vergleich | **zeichenweise identisch** |

### Weitere Prüfungen

- **Syntax:** alle acht JS-Dateien parsen fehlerfrei.
- **Ladereihenfolge ausgeführt:** alle acht Dateien laden in
  `index.html`-Reihenfolge fehlerfrei (JavaScriptCore, mit Stubs).
- **Namenskollisionen:** keine (245 Top-Level-Namen über alle Dateien).
- **Restnutzungen:** in `sketch.js` stehen nur noch die beiden Zugriffe aus
  `draw()` (Zeilen 887/888) sowie die Deklaration von `annotationBoxEl`.
- **Nahtstelle:** `leereBandCounts()` und `zeichneKreiseOrtRuns()` grenzen mit
  einer Leerzeile aneinander.

### Zwischenstand der Modularisierung

| Datei | Zeilen |
|---|---|
| `sketch.js` | **2138** (von ursprünglich 3497) |
| `ortsveraenderung.js` | 659 |
| `datenbereinigung.js` | 475 |
| `spine-horizontal.js` | 441 |
| `kartendekor.js` | 187 |
| `annotationsbox.js` | 129 |
| `fotomarker.js` | 110 |
| `sonifikation.js` | unverändert |

`sketch.js` hat damit rund **39 %** seines ursprünglichen Umfangs abgegeben.

### Manueller Test

Die Wirkung ist subtil, weil die Box je nach Kapitel und Fenstergrösse einen
anderen Platz wählt — auffallen würde erst ihr Fehlen oder ein Springen.

1. Mehrere Kapitel nacheinander öffnen (etwa 3, 8, 13) und prüfen, dass die
   Annotationsbox **nicht** über den grossen Ortskreisen liegt. Je nach Kapitel
   sitzt sie oben links, unten links, oben rechts oder unten rechts.
2. Innerhalb eines Kapitels durchscrollen: die Box muss **an ihrem Platz
   stehen bleiben**, während die Kreise wachsen — genau dafür gibt es den Cache.
3. Fenstergrösse ändern und dasselbe Kapitel erneut öffnen: die Box darf einen
   anderen Platz wählen (der seitliche Beschnitt der Karte hängt am
   Fensterformat), aber innerhalb dieser Grösse wieder stabil bleiben.

---

## Modul 6 — `geo-projektion.js`

**Datum:** 20. August 2026
**Neu:** `geo-projektion.js` (108 Zeilen, davon 38 Kopfkommentar)
**Aus:** `sketch.js` — 71 Zeilen entfernt (2138 → 2067)
**Geändert:** `index.html` (Script-Tag), `sketch.js` und `fotomarker.js` (je ein überholter Kommentar)

Entspricht **Gruppe 1 („Geo & Projektion")** der Analyse — abzüglich
`haversineMeter()`, das bereits mit Modul 1 nach `kartendekor.js` ging
(dort ist `zeichneMassstabsleiste()` sein einziger Aufrufer).

Dieses Modul ist die **unterste Schicht** der Anwendung und steht in
`index.html` deshalb ganz vorne, direkt hinter `datenbereinigung.js`.

### Was wurde verschoben

Zwei getrennte Blöcke:

**Block A — Georeferenz und Kartenoffset, `sketch.js` Zeilen 91–117** (27 Zeilen):

| Zeilen (vorher) | Element |
|---|---|
| 91–110 | Kommentarkopf zur Georeferenz beider Übersichtskarten, inkl. der Gegenprobe mit den verworfenen QGIS-Werten |
| 111 | `let startBbox` — `paris-startkarte-web.png` |
| 112–113 | `let uebersichtBbox` — `paris-ueberblickkarte-web.png` |
| 114 | `let ch1ImgBbox` — Kapitel-1-Ausschnitt |
| 116–117 | `let mapOffsetX = -250;`, `let mapOffsetY = 0;` |

**Block B — Projektionsfunktionen, `sketch.js` Zeilen 314–355** (42 Zeilen):

| Zeilen (vorher) | Element |
|---|---|
| 314–330 | `coverCrop()` |
| 332–336 | `lonLatToScreen()` |
| 338–346 | `bboxToImgCrop()` |
| 348–355 | `cropToBbox()` |

### Die `mapOffsetX`-Frage: der Grund von Modul 4 kehrt sich um

In Modul 4 blieben `letzterFotoOffsetX`/`letzterFotoOffsetY` in `sketch.js`,
weil ihre Deklaration

```js
let letzterFotoOffsetX = mapOffsetX, letzterFotoOffsetY = mapOffsetY;
```

`mapOffsetX` **beim Laden** liest — in einer vor `sketch.js` geladenen Datei
hätte das einen `ReferenceError` geworfen.

Vor diesem Schritt wurde geprüft, ob dieselbe Falle erneut zuschnappt.
**Ergebnis: nein — sie löst sich auf.** Die genannte Zeile ist die **einzige**
Top-Level-Auswertung von `mapOffsetX`/`mapOffsetY` im gesamten Projekt (die
beiden Deklarationen selbst ausgenommen). Seit `geo-projektion.js` sie führt
und **vor** `sketch.js` geladen wird, sind sie beim Laden von `sketch.js`
bereits initialisiert — die Zeile trägt.

Alle übrigen fünf Nutzungen sind **Default-Parameter**
(`function … (…, offsetX = mapOffsetX, …)`) in `coverCrop`, `lonLatToScreen`,
`zeichneKreiseOrtRuns`, `zeichneRoute` und `zeichneFotoMarker`. Die werden erst
beim Aufruf ausgewertet und sind für die Ladereihenfolge belanglos.

**Folge für später:** `letzterFotoOffsetX`/`letzterFotoOffsetY` könnten jetzt
doch nach `fotomarker.js` umziehen — `geo-projektion.js` steht vor beiden
Dateien. Dieser Umzug ist **nicht** Teil dieses Schritts (er war nicht
beauftragt und gehört sachlich zu Modul 4), aber die Blockade ist weg.

### Zwei Kommentare wurden dadurch falsch — und korrigiert

Die Verschiebung machte zwei bestehende Kommentare sachlich unrichtig. Beide
wurden angepasst, weil ein veralteter Kommentar aktiv in die Irre führt:

- **`sketch.js`** (bei `letzterFotoOffsetX`): sprach von
  „mapOffsetX/mapOffsetY **(oben)**" — die stehen nun in einer anderen Datei.
  Der Text erklärt jetzt, warum die Merker hier stehen, dass die Blockade seit
  Modul 6 aufgehoben ist und wo das nachzulesen ist.
- **`fotomarker.js`** (Dateikopf): behauptete, ein Umzug der beiden Merker
  würde einen `ReferenceError` werfen. Das galt bis Modul 5; der Absatz nennt
  jetzt beide Zustände.

Es sind ausschliesslich Kommentare — kein ausführbares Zeichen wurde geändert.

### Abhängigkeiten in beide Richtungen

**Nach aussen: keine.** Der Block braucht ausser p5 (`width`, `height`, `map`,
`constrain`) nichts — kein Zugriff auf `sketch.js`, `datenbereinigung.js` oder
eines der fünf anderen Module. Nach `kartendekor.js` das **zweite vollständig
autarke Modul**, und das einzige, das keinerlei Projektdaten kennt.

**Von aussen hierher** — das am breitesten genutzte Modul bisher:

| Name | genutzt von |
|---|---|
| `lonLatToScreen()` | `sketch.js` (11×), `ortsveraenderung.js` (3×), `annotationsbox.js` (3×), `fotomarker.js` (2×) |
| `mapOffsetX` | `sketch.js` (17×), `fotomarker.js` (4×), `annotationsbox.js` (3×) |
| `mapOffsetY` | `sketch.js` (11×), `fotomarker.js` (4×), `annotationsbox.js` (3×) |
| `coverCrop()`, `bboxToImgCrop()`, `cropToBbox()` | nur `sketch.js` |
| `startBbox`, `uebersichtBbox`, `ch1ImgBbox` | nur `sketch.js` |

Erstmals greifen mehrere ausgelagerte Module auf ein anderes ausgelagertes
Modul zu. Bis Modul 5 kannten die Module einander nicht und kommunizierten nur
über `sketch.js` und `datenbereinigung.js`; `geo-projektion.js` ist die erste
gemeinsame Basis.

### Ladereihenfolge in `index.html`

```diff
   <script src="datenbereinigung.js"></script>
+  <script src="geo-projektion.js"></script>
   <script src="kartendekor.js"></script>
   <script src="ortsveraenderung.js"></script>
   <script src="spine-horizontal.js"></script>
   <script src="fotomarker.js"></script>
   <script src="annotationsbox.js"></script>
   <script src="sketch.js"></script>
   <script src="sonifikation.js"></script>
```

Bewusst an den Anfang gesetzt, nicht bloss irgendwo vor `sketch.js`: Die Datei
ist die Basis, auf die vier andere zugreifen, und `sketch.js` wertet
`mapOffsetX` beim Laden aus. Die Reihenfolge bildet die Schichtung jetzt ab —
Daten, Geometrie, Fachmodule, Orchestrierung, Ton.

### Nachweis: keine Logikänderung

| Block | Zeilen | Vergleich |
|---|---|---|
| A (Bboxen, Offsets) | 27 | **zeichenweise identisch** |
| B (Projektionsfunktionen) | 42 | **zeichenweise identisch** |

### Weitere Prüfungen

- **Syntax:** alle neun JS-Dateien parsen fehlerfrei.
- **Ladereihenfolge ausgeführt:** alle neun laden in `index.html`-Reihenfolge
  fehlerfrei (JavaScriptCore, mit Stubs) — insbesondere `sketch.js:98`, das
  `mapOffsetX` beim Laden liest.
- **Namenskollisionen:** keine (245 Top-Level-Namen).
- **`haversineMeter`** liegt weiterhin in `kartendekor.js:25` und wurde nicht
  angefasst.
- **Nahtstellen:** in Block A grenzen `grafikPlayButton` und der
  Foto-Merker-Kommentar aneinander, in Block B `getScrollProgress()` und
  `baueGedankenColumn()`.

### Zwischenstand der Modularisierung

| Datei | Zeilen |
|---|---|
| `sketch.js` | **2067** (von ursprünglich 3497) |
| `ortsveraenderung.js` | 659 |
| `datenbereinigung.js` | 474 |
| `spine-horizontal.js` | 441 |
| `sonifikation.js` | 309 |
| `kartendekor.js` | 187 |
| `annotationsbox.js` | 129 |
| `fotomarker.js` | 112 |
| `geo-projektion.js` | 108 |

`sketch.js` hat damit rund **41 %** seines ursprünglichen Umfangs abgegeben.

### Manueller Test

Dieses Modul trägt alles, was auf der Karte liegt — ein Fehler wäre sofort und
überall sichtbar, nicht subtil.

1. Startseite: die Karte füllt das Fenster, der Routen-Startpunkt liegt auf dem
   richtigen Strassenzug.
2. In Kapitel 1 zoomen: der Ausschnitt wechselt sauber, Route und Kreise
   bleiben deckungsgleich mit den Strassen.
3. Ein Kapitel 02–18 öffnen: die Route folgt den Strassen, nicht der Luftlinie
   — das ist der empfindlichste Test für `lonLatToScreen` und `coverCrop`.
4. Foto-Marker und Kapitel-Badges müssen an ihren Orten sitzen, nicht seitlich
   versetzt (dafür sorgen die Offset-Parameter).
5. Schlussakt: der Zoom auf die sieben Orte trifft den richtigen Ausschnitt.

Ein Versatz der ganzen Ebene gegenüber der Karte deutet auf
`mapOffsetX/mapOffsetY`, eine Verzerrung auf `coverCrop`/`cropToBbox`.
