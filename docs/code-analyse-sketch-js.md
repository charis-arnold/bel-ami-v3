# sketch.js — Strukturanalyse

**Stand: 20. August 2026**

> **Ausgangszustand vor der Modularisierung.**
> Dieses Dokument hält `sketch.js` so fest, wie die Datei vor dem Refactoring
> aussah — vollständige Bestandsaufnahme aller Funktionen, globalen Variablen
> und toten Codestellen. Es dient als Referenz- und Vergleichspunkt: nach der
> Aufteilung in Module beschreibt es nicht mehr den aktuellen Code, sondern den
> Zustand, von dem aus umgebaut wurde. Alle Zeilenangaben beziehen sich auf die
> Fassung von Commit `083d2eb` (Branch `refactor/code-architektur`).

---

**3497 Zeilen, 67 Top-Level-Funktionen, 2 innere Funktionen, ~143 globale Namen.** Kein ES-Modul: alles liegt im globalen Scope, geladen über `<script>`-Tags in [index.html:98-100](index.html#L98-L100) in der Reihenfolge `datenbereinigung.js → sketch.js → sonifikation.js`.

---

## 1. Top-Level-Funktionen

### Daten laden & aufbereiten
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [16](sketch.js#L16) | `naechstesKapitel(nr)` | Nummer des Folgekapitels als `'05'`-String, oder `null` bei Kapitel 18 |
| [200](sketch.js#L200) | `datenFuerKapitel(nr)` | Dispatcher: `'03'` → `kapitel03Data`, sonst `weitereKapitelDaten[nr]` |
| [204](sketch.js#L204) | `preload()` | **p5** — lädt 3 Übersichtsbilder, 18 Stationen-JSONs, Fotomarker, Übersichtsrouten, Kreisvergleich, 17 Kapitelkarten + Bboxen |
| [236](sketch.js#L236) | `bereinigeEingangsdaten()` | Reicht alle geladenen Rohdaten durch die `bereinige*`-Funktionen aus `datenbereinigung.js` |

### p5-Setup & DOM-Aufbau
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [255](sketch.js#L255) | `oeffneRegister(box, andererBox, eigeneKlasse, andereKlasse)` | Akkordeon-Toggle Legende ⇄ Prolog, setzt zusätzlich die Klasse am gemeinsamen `#registerTabs` |
| [263](sketch.js#L263) | `setup()` | **p5** — holt ~30 DOM-Referenzen, hängt Event-Listener, erzeugt Canvas, ruft die sechs `baue*`-Funktionen |
| [324](sketch.js#L324) | `windowResized()` | **p5** — `resizeCanvas` auf die Stage-Maße |
| [548](sketch.js#L548) | `baueGedankenColumn()` | DOM: Gedanken-Spalte aus `stationenData.gedanken` |
| [577](sketch.js#L577) | `baueKapitelRegister()` | DOM: Register links — Plan/Graph-Zeile, Leerzeile, „Alle", Kapitel 01–18 mit Klick-Handlern |
| [630](sketch.js#L630) | `baueLegende()` | DOM: Legendeninhalt generiert aus `KREIS_KATEGORIEN`/`CATEGORY_LABELS`/`FWERT_PUNKTGROESSE` |
| [732](sketch.js#L732) | `baueKartenMarkierungen()` | DOM: Ortsmarkierungen Kapitel 1 |
| [748](sketch.js#L748) | `baueStationsMarker()` | DOM: Routenstationen Kapitel 1 (ohne Index 0) |
| [766](sketch.js#L766) | `baueZwischenMarker()` | DOM: Zwischenpunkte Kapitel 1 |

> ⚠️ Die drei Marker-Funktionen bauen DOM-Knoten, die `draw()` in [1244-1266](sketch.js#L1244-L1266) **fest auf `sichtbar = false`** schaltet („für den Moment ausgeblendet"). Gleiches bei `baueGedankenColumn` ([1237](sketch.js#L1237): `let sichtbar = false`). Sie laufen, produzieren aber nichts Sichtbares.

### Geometrie & Projektion
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [328](sketch.js#L328) | `getScrollProgress()` | Scrollposition 0..1 relativ zu `.scroll-track` |
| [333](sketch.js#L333) | `coverCrop(imgW, imgH, vAnchor, hAnchor, offsetX)` | Bildausschnitt im „cover"-Seitenverhältnis, mit Anker-Verschiebung |
| [351](sketch.js#L351) | `lonLatToScreen(lon, lat, bbox, offsetX, offsetY)` | Geo → Canvas-Pixel, lineare Abbildung. **17 Aufrufstellen** — die meistgenutzte Funktion der Datei |
| [365](sketch.js#L365) | `haversineMeter(lon1, lat1, lon2, lat2)` | Großkreisdistanz in Metern (nur für die Maßstabsleiste) |
| [529](sketch.js#L529) | `bboxToImgCrop(bbox, refBbox, imgW, imgH)` | Geo-Bbox → Pixel-Crop im Referenzbild |
| [539](sketch.js#L539) | `cropToBbox(crop, refBbox, imgW, imgH)` | Umkehrung von `bboxToImgCrop` |

### Kartendekor
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [378](sketch.js#L378) | `zeichneMassstabsleiste(bbox, offsetX, alphaMultiplier)` | Maßstabsbalken unten rechts; wählt aus `MASSSTAB_SCHRITTE` den größten Rundwert unter 160 px |
| [423](sketch.js#L423) | `zeichneWindrose(x, y, groesse, alphaMultiplier)` | Kompassrose oben rechts — enthält die inneren Funktionen `zeichneZacke` ([434](sketch.js#L434)) und `zeichneBeschriftung` ([499](sketch.js#L499)) |

### Hauptschleife
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [811](sketch.js#L811) | `draw()` | **p5** — ~570 Zeilen. Scroll-Fortschritt, Bildwahl/Kartenüberblendung, alle vier Zoomstufen (`zoomAmount`, `kapitelZoomAmount`, `ovZoom`, `skRauszoom`), Route-/Kreis-/Spine-Aufrufe, Annotationsbox, Register-Sichtbarkeit, DOM-Marker-Positionen, Hero-/Begleit-/Einstiegstext-Fades, Foto-Marker |

### Foto-Marker
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [1393](sketch.js#L1393) | `zeichneFotoMarker(activeBbox, offsetX, offsetY, alphaMultiplier, kartenZoomFaktor)` | Sternchen-Marker, Größe skaliert mit Zoom, Hover-Tooltip |
| [1432](sketch.js#L1432) | `mousePressed()` | **p5** — Klick-Dispatch: Kapitel-Badge (01 / 02–18) vor Foto-Marker-Treffertest |
| [1453](sketch.js#L1453) | `oeffneFotoPopup(f)` | Füllt und öffnet `#fotoPopup` |
| [1462](sketch.js#L1462) | `schliesseFotoPopup()` | Schließt es |

### Kreisgrafik (Kern der Visualisierung)
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [1470](sketch.js#L1470) | `drawHatchedCircle(cx, cy, r, color, alphaSkala)` | Schraffierter Kreis: Clip-Pfad + horizontale Linien im `HATCH_SPACING` |
| [1508](sketch.js#L1508) | `sammelpunktKategorie(ort)` | Ortsname → `ERINNERUNG`/`PHANTASIE`/`WUNSCH`/`GEDANKEN`/`UNBESTIMMT` oder `null` |
| [1514](sketch.js#L1514) | `leereBandCounts()` | Leere 3×4-Zählstruktur |
| [1615](sketch.js#L1615) | `zeichneKreiseOrtRuns(punktIndex, annIndex, activeBbox, offsetX, offsetY, daten)` | Alle Ortskreise eines Kapitels auf der Karte, sammelt Label-Kandidaten, leitet adresslose Orte an `zeichneOrteOhneAdresse` |
| [1700](sketch.js#L1700) | `zeichneOrteOhneAdresse(nachKategorie)` | Sammelkreise unter dem Kapitelregister, vertikal gestapelt |
| [1738](sketch.js#L1738) | `zeichneKreisLabels(kandidaten)` | Kollisionsauflösung (Zeile für Zeile nach unten), gestrichelte Hilfslinie bei Versatz |
| [1808](sketch.js#L1808) | `zeichneHalbkreis(cx, cy, r, winkelMitte, farbeRgb, alphaSkala, blend)` | Valenz-Halbkreis über 180°, optional Multiply-Blend |
| [1824](sketch.js#L1824) | `zeichneVollkreis(cx, cy, r, farbeRgb, alphaSkala, blend)` | Pendant für neutrale Valenz |
| [1851](sketch.js#L1851) | `zeichneKreiseFuerRun(cx, cy, bandCounts, alphaSkala, winkel, radiusSkala, maxRadius)` | **Zentrale Funktion**: zwei Ebenen (schraffiert unten, Valenzflächen oben), je nach Radius sortiert; gibt größten Hatch-Radius zurück. 5 Aufrufstellen |
| [1926](sketch.js#L1926) | `zeichneFwertPunkte(cx, cy, kreisRadius, fwertAnnotationen, alphaSkala, anordnung)` | F-Wert-Punkte in 120°-Dritteln außerhalb des Kreises, mit nachwachsenden Ringen |

### Route
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [2001](sketch.js#L2001) | `zeichneRoute(punkte, upToIndex, bbox, strichstaerke, offsetX, offsetY, alphaMultiplier)` | Polylinie mit Fade-Schweif (jüngere Segmente kräftiger) |

### Annotationsbox-Platzierung
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [1547](sketch.js#L1547) | `annotationBoxPlatz(kapitelNr, daten, bbox)` | Wählt aus vier Plätzen per Strafpunktverfahren (verdeckte Kreise nach Radius gewichtet, Route schwächer); Ergebnis in `annotationBoxPlatzCache` |

### Schlussakt „Ortsveränderung" (`ov*`)
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [2143](sketch.js#L2143) | `ovVersatz(knoten, faktor)` | Pixel-Feinkorrektur einzelner Ortspunkte, fährt mit dem Zoom ein |
| [2157](sketch.js#L2157) | `ovTextUmbruch(text, maxBreite)` | Fließtext-Umbruch mit `textWidth` |
| [2179](sketch.js#L2179) | `ovLabelZeilen(text)` | Zweizeiliger Umbruch, Trennstellen: Klammer → Komma → mittigstes Leerzeichen |
| [2196](sketch.js#L2196) | `ovPhase(p, fenster)` | Phasenfortschritt 0..1 aus `[von, bis]`. **10 Aufrufstellen** |
| [2209](sketch.js#L2209) | `ovLeereBandCounts()` | Leere Zählstruktur — **identisch mit `leereBandCounts()`** ([1514](sketch.js#L1514)) |
| [2217](sketch.js#L2217) | `ovAddiere(ziel, quelle)` | Addiert bandCounts auf |
| [2223](sketch.js#L2223) | `ovRadiusAus(bandCounts)` | Größter Kategorie-Radius, ungedeckelt |
| [2232](sketch.js#L2232) | `ovBaueDaten()` | Vorberechnung `[Knoten][Kapitel] → {bandCounts, fwerte}` + Rohradien + erstes Kapitel je Knoten |
| [2269](sketch.js#L2269) | `ovStand(index, maxNr)` | Kumulierte Summe bis Kapitel `maxNr`, plus Nummer des letzten beitragenden Kapitels |
| [2290](sketch.js#L2290) | `ovBerechneLayout()` | Iteratives Layout (max. 20 Durchläufe): Zielbbox in Mercator-Einheiten, Kreisskala ohne Überlappung, Linientiefen, alle Textumbrüche |
| [2460](sketch.js#L2460) | `ovZoomBbox()` | Zielausschnitt für `draw()` |
| [2471](sketch.js#L2471) | `zeichneOrtsveraenderung(bbox, p, alpha, textFaktor)` | Der ganze Schlussakt: wachsende Senkrechte, Punkte, Kreise, Ortslabel, Kapitelzähler, seitliche Erläuterungsblöcke mit Zuführungslinie und Datenzeile |

### Übersichtsrouten & Kapitel-Navigation
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [2668](sketch.js#L2668) | `kapitelScheiben()` | Teilt den Übersichtsakt nach Routenlänge auf (45 % Grundanteil gleichmäßig), gecacht in `ovScheiben` |
| [2703](sketch.js#L2703) | `kapitelHitze(fortschritt, scheibe)` | 1 während der eigenen Scheibe, danach Abkühlung → Farbverlauf Hover→Gold |
| [2709](sketch.js#L2709) | `zeichneUebersichtsrouten(bbox, alpha, fortschritt)` | **~320 Zeilen, zweitgrößte Funktion**: alle 17 Übersichtsrouten, die genaue Route des gezoomten Kapitels, dessen Kreise/Annotation, Start-Badges mit Duplikat-Versatz und Hover, Kapitel-01-Badge. Gibt `{ aktuelleAnnotationZoom }` zurück |
| [3029](sketch.js#L3029) | `scrolleZuKapitel1()` | Smooth-Scroll ans Ende des Rein-Zooms |
| [3056](sketch.js#L3056) | `setzeKapitelAnsichtZurueck()` | Modus auf `'karte'`, Grafik-Animation + Sonifikation stoppen, Einstiegstext-Timer neu |
| [3071](sketch.js#L3071) | `oeffneKapitelZoom(nr)` | Setzt `zoomedKapitel` ohne Scrollposition zu ändern |
| [3077](sketch.js#L3077) | `schliesseKapitelZoom()` | Gegenstück |
| [3096](sketch.js#L3096) | `springeZuKapitelZoom(nr)` | Springt hart an den Aktanfang + 1 % und öffnet dann — der Weg, den alle Bedienelemente nehmen |
| [3109](sketch.js#L3109) | `springeZurUebersicht()` | Springt in die Aktmitte und schließt jeden Zoom |

### Graph-Ansicht (horizontale Spine)
| Zeile | Funktion | Aufgabe |
|---|---|---|
| [3130](sketch.js#L3130) | `setzeKapitelAnsichtModus(modus)` | Plan/Graph umschalten, Animation auf 0 zurück |
| [3153](sketch.js#L3153) | `aktuelleGrafikAnimationDauer()` | Gesamtdauer: Kapitel 1 = `SONIFIKATION_GESAMTDAUER_SEK`, 02–18 skaliert über ms-pro-Eintrag. Wird auch von `sonifikation.js:259` gelesen |
| [3173](sketch.js#L3173) | `toggleGrafikPlay()` | Play/Pause mit Resume, startet/stoppt die Sonifikation |
| [3188](sketch.js#L3188) | `aktualisiereGrafikFortschritt()` | Rechnet `millis()` in `grafikFortschritt` um |
| [3233](sketch.js#L3233) | `spineLayout(eintraege, daten, abstand, startX)` | Festes Label-Zeilenraster + vertikale Lage der Linie, einmal je Kapitel/Fenstergröße, `WeakMap`-Cache |
| [3324](sketch.js#L3324) | `zeichneSpineHorizontal(eintraege, fortschritt, daten)` | ~170 Zeilen: Playhead, interpolierter `globalAnnIndex`, Linie, Rückkehr-Bögen, Kreise nach Größe sortiert, dann zwei Durchgänge für Punkte/Linien und Labels |

---

## 2. Globale Variablen

Alle 143 geprüften Namen werden mindestens einmal gelesen oder geschrieben — **eine Ausnahme, siehe Punkt 4.**

**DOM-Referenzen (in `setup()` befüllt)** — `stage`, `heroText`, `begleitTexte`, `kapitelEinstiegsTexte`, `annotationBoxEl`, `schlusstextEl`, `naechstesKapitelEl`, `gedankenColumn`, `kartenMarkierungenEl`, `annotationText`, `annotationInner`, `annotationTag`, `annotationBar`, `fotoPopup` + 4 Unterelemente, `scrollFortschritt(Fuellung)`, `kapitelRegister`, `orteOhneAdresse`, `registerTabs`, `legendeBox/Tab/Inhalt`, `prologBox/Tab`, `grafikPlayButton`

**In `baueKapitelRegister()`/`baueLegende()` erzeugt** — `kapitelRegisterEintraege`, `planEintrag`, `graphEintrag`, `modusZeile`, `leerzeile`, `alleEintrag`, `legendeValenzText`, `legendeValenzKreis`, `legendeFwertHinweis`

**Geladene Daten** — `bgImage`, `bgImage2`, `ch1Image`, `stationenData` (Kapitel 1, **32 Nutzungen**), `kapitel03Data`, `weitereKapitelDaten`, `fotoMarkerListe`, `uebersichtsRouten`, `kreisVergleichOrte`, `kapitelKarten`

**Georeferenz** — `startBbox`, `uebersichtBbox`, `ch1ImgBbox`, `mapOffsetX = -250` (17×), `mapOffsetY = 0` (15×)

**Zustandsvariablen (die eigentliche State-Machine)**
- `zoomedKapitel` — **45 Nutzungen**, die mit Abstand meistgelesene Variable
- `kapitelZoomAmount` (23×), `kapitel1ZoomAmount`, `kapitelHover`, `letzterZoomKapitel`
- `kapitelAnsichtsModus` (`'karte'`/`'grafik'`)
- `grafikSpielt`, `grafikStartZeit`, `grafikFortschritt`, `grafikPlayAusblendStart`
- `kapitelEinstiegsStartMillis`
- `letzteActiveBbox`, `letzterFotoOffsetX/Y` — nur damit `mousePressed()` das Hit-Testing wiederholen kann

**Aufgebaute DOM-Listen** — `gedankenEintraege`, `markierungsEintraege`, `stationsMarker`, `zwischenMarker`

**Caches** — `annotationBoxPlatzCache` (Map), `spineLayoutCache` (WeakMap), `ovScheiben`, `ovProKapitel`, `ovRohradien`, `ovErstesKapitel`, `ovLayout`, `spineEintraegep5`, `spineEintraegeKapitel`

**Konstantenblöcke** — `HATCH_SPACING`, `KAPITEL_EINSTIEG_*`, `LEGENDE_VALENZ_*`/`LEGENDE_FWERT_*`, `WEITERE_KAPITEL_NUMMERN`, `FOTO_MARKER_TREFFER_RADIUS`, `MASSSTAB_SCHRITTE`, `SAMMELPUNKT_KATEGORIEN`, `ANNOTATION_BOX_*` (6), `FWERT_PUNKT_*` (4), `VERGLEICHS_KNOTEN` (7 Orte mit Text+Daten), `OV_*` (24), `SK_*` (3), `SPINE_*` (9)

---

## 3. p5.js-Lifecycle-Funktionen

Fünf Stück — von p5 selbst aufgerufen, **kein toter Code**:

| Zeile | Funktion |
|---|---|
| [204](sketch.js#L204) | `preload()` |
| [263](sketch.js#L263) | `setup()` |
| [811](sketch.js#L811) | `draw()` |
| [324](sketch.js#L324) | `windowResized()` |
| [1432](sketch.js#L1432) | `mousePressed()` |

---

## 4. Toter Code — explizite Liste

Alle 67 Funktionsnamen wurden gegen `sketch.js`, `datenbereinigung.js`, `sonifikation.js` und `index.html` geprüft, Kommentare vorher entfernt.

### 4a. `baueSpineTimeline()` — [Zeile 782](sketch.js#L782)
**Null Referenzen im gesamten Projekt.** Weder in `setup()` noch sonstwo. Zusätzlich: die Funktion greift auf **drei Variablen zu, die nirgends deklariert sind** — `spineLinie` ([783](sketch.js#L783)), `spineTimeline` ([785](sketch.js#L785)) und `spineEintraege` ([804](sketch.js#L804)). Ein Aufruf würde also nicht nur nichts Sinnvolles tun, sondern implizite Globals anlegen bzw. an `spineTimeline.appendChild` scheitern. Rückstand des inzwischen ersetzten vertikalen Spine-Panels.

### 4b. `fuegeSpineEintragHinzu(text, typ, stationIndex)` — [Zeile 794](sketch.js#L794)
Drei Aufrufstellen ([785](sketch.js#L785), [786](sketch.js#L786), [787](sketch.js#L787)) — **alle drei innerhalb von `baueSpineTimeline()`**. Transitiv tot; fällt mit 4a weg. Nutzt ebenfalls die undeklarierten `spineTimeline`/`spineEintraege`.

### 4c. `kreisVergleichOrte` — [Zeile 143](sketch.js#L143) *(Variable, nicht Funktion)*
Wird geladen ([224](sketch.js#L224)) und bereinigt ([245](sketch.js#L245)), aber **nie gelesen**. Write-only. Der Kommentar bei [1995](sketch.js#L1995) bestätigt es: die zugehörige Funktion `zeichneKreisVergleich` ist bereits entfallen, `kreisvergleich-orte.json` bleibt nur als Prüfartefakt für die Python-Pipeline. Der Ladevorgang im Browser ist überflüssig — die JSON-Datei selbst sollte laut Kommentar aber bleiben.

### 4d. `ovLeereBandCounts()` — [Zeile 2209](sketch.js#L2209) *(Duplikat, nicht tot)*
Byte-identisch mit `leereBandCounts()` ([1514](sketch.js#L1514)). Beide werden aufgerufen, aber eine der beiden ist überflüssig.

### Was *nicht* tot ist, obwohl es so aussieht
- **`preload`, `setup`, `draw`, `windowResized`, `mousePressed`** — von p5 aufgerufen (siehe Punkt 3).
- **`zeichneVollkreis`, `zeichneHalbkreis`, `drawHatchedCircle`** — je nur 1–2 Aufrufstellen, alle innerhalb von `zeichneKreiseFuerRun`. Echte private Helfer.
- **`OHNE_EIGENEN_KARTENAUSSCHNITT`** ([172](sketch.js#L172)) ist ein leeres Array und **`ANNOTATION_BOX_PLATZ_FEST`** ([1540](sketch.js#L1540)) ein leeres Objekt — beide werden abgefragt, sind aber wirkungslose Konfigurationsschalter. Bewusst dokumentiert, kein Versehen.
- **Kein Sprachumschalter im Code** — den gibt es in `sketch.js` nicht.

---

## 5. Thematische Gruppen für eine Modularisierung

Die Datei zerfällt entlang ziemlich sauberer Schnittkanten. Zeilenangaben grob:

| # | Gruppe | Umfang | Inhalt |
|---|---|---|---|
| 1 | **Geo & Projektion** | ~90 Z. | `lonLatToScreen`, `coverCrop`, `bboxToImgCrop`, `cropToBbox`, `haversineMeter`, `startBbox`/`uebersichtBbox`/`ch1ImgBbox`, `mapOffsetX/Y` |
| 2 | **Kartendekor** | ~150 Z. ([365–527](sketch.js#L365-L527)) | `zeichneMassstabsleiste`, `zeichneWindrose`, `MASSSTAB_SCHRITTE`. Völlig abgeschlossen, hängt nur an `width`/`height`/`bbox` |
| 3 | **DOM-Aufbau & Register** | ~250 Z. | `oeffneRegister`, `baueKapitelRegister`, `baueLegende`, `baueGedankenColumn`, `baueKartenMarkierungen`, `baueStationsMarker`, `baueZwischenMarker` |
| 4 | **Kreisgrafik** | ~400 Z. ([1470–1999](sketch.js#L1470-L1999)) | `zeichneKreiseFuerRun`, `zeichneHalbkreis`, `zeichneVollkreis`, `drawHatchedCircle`, `zeichneFwertPunkte`, `zeichneKreisLabels`, `zeichneKreiseOrtRuns`, `zeichneOrteOhneAdresse`, `sammelpunktKategorie`, `leereBandCounts` + `FWERT_PUNKT_*`, `HATCH_SPACING`, `SAMMELPUNKT_KATEGORIEN` |
| 5 | **Route-Rendering** | ~25 Z. | `zeichneRoute` allein — zu klein für ein eigenes Modul, gehört zu 4 oder 7 |
| 6 | **Foto-Marker & Popup** | ~90 Z. | `zeichneFotoMarker`, `oeffneFotoPopup`, `schliesseFotoPopup`, `fotoMarkerListe`, `letzteActiveBbox`/`letzterFotoOffsetX/Y`, der Foto-Teil von `mousePressed` |
| 7 | **Übersichtsrouten & Kapitel-Navigation** | ~450 Z. ([2660–3115](sketch.js#L2660-L3115)) | `zeichneUebersichtsrouten`, `kapitelScheiben`, `kapitelHitze`, `oeffneKapitelZoom`, `schliesseKapitelZoom`, `springeZuKapitelZoom`, `springeZurUebersicht`, `scrolleZuKapitel1`, `setzeKapitelAnsichtZurueck` + `zoomedKapitel`/`kapitelZoomAmount`/`kapitelHover` |
| 8 | **Schlussakt „Ortsveränderung"** | ~640 Z. ([2015–2660](sketch.js#L2015-L2660)) | Alle `ov*`-Funktionen, `VERGLEICHS_KNOTEN`, sämtliche `OV_*`/`SK_*`-Konstanten, `zeichneOrtsveraenderung`. **Der sauberste Kandidat**: eigener Namensraum, eigene Caches, eine einzige Aufrufstelle in `draw()` ([1066](sketch.js#L1066)) plus `ovZoomBbox()` ([932](sketch.js#L932)) |
| 9 | **Graph-Ansicht / horizontale Spine** | ~380 Z. ([3116–3497](sketch.js#L3116-L3497)) | `zeichneSpineHorizontal`, `spineLayout`, `toggleGrafikPlay`, `aktualisiereGrafikFortschritt`, `aktuelleGrafikAnimationDauer`, `setzeKapitelAnsichtModus`, alle `SPINE_*`, `grafik*`-State. **Zweitsauberster Kandidat**, schon jetzt als Block am Dateiende |
| 10 | **Annotationsbox-Platzierung** | ~110 Z. | `annotationBoxPlatz` + `ANNOTATION_BOX_*` + Cache. Kleines, klar abgegrenztes Layout-Problem |
| 11 | **Lifecycle & Orchestrierung** | ~650 Z. | `preload`, `setup`, `draw`, `windowResized`, `mousePressed`, `bereinigeEingangsdaten`, `getScrollProgress`, `naechstesKapitel`, `datenFuerKapitel` |

### Drei Beobachtungen zum Schnitt

**`draw()` ist der eigentliche Engpass.** ~570 Zeilen, in denen sich vier unabhängige Zoomstufen (`zoomAmount`, `kapitelZoomAmount`, `ovZoom`, `skRauszoom`) und mindestens sechs Fade-Multiplikatoren gegenseitig durchmultiplizieren. Solange die dort verrechneten lokalen Werte nicht in einen expliziten Zustand („welcher Akt läuft gerade, mit welchem Fortschritt") herausgezogen sind, bringt das Verschieben der Zeichenfunktionen in eigene Dateien wenig — sie brauchen alle dieselben ~20 lokalen Variablen aus `draw()`.

**Gruppen 2, 8 und 9 lassen sich sofort herauslösen**, ohne an `draw()` zu rühren: sie haben je eine oder zwei Aufrufstellen und keine versteckten Rückgriffe.

**Die Randbedingung ist der globale Scope.** Ohne ES-Module (`type="module"` in [index.html](index.html#L98)) wird jede neue Datei nur ein weiteres `<script>`-Tag, und die Reihenfolge zählt: `sketch.js` liest `SONIFIKATION_GESAMTDAUER_SEK` aus dem *später* geladenen `sonifikation.js`, das seinerseits `aktuelleGrafikAnimationDauer()` aus `sketch.js` aufruft. Das geht heute nur gut, weil beides erst zur Laufzeit ausgewertet wird — bei einer Aufteilung in acht Dateien wird diese Zirkularität schnell zur Fehlerquelle. Der Umstieg auf ES-Module wäre die stabilere Grundlage, ist aber eine eigene Entscheidung.
