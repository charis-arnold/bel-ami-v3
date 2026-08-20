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
