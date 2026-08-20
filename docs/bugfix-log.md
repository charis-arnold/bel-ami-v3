# Bugfix-Log

Protokoll behobener Anzeige- und Verhaltensfehler. Gegenstück zum
[cleanup-log.md](cleanup-log.md), das die reinen Aufräumschritte führt —
hier stehen Änderungen, die tatsächlich das Verhalten der Anwendung
korrigieren.

Jeder Eintrag hält fest: **Symptom**, **Ursache**, **Fix**, und — wo die Frage
aufkam — ob ein Zusammenhang mit vorangegangenen Änderungen besteht.

---

## Fix 1 — Kapitelnummern blieben in der Detailansicht sichtbar

**Datum:** 20. August 2026
**Datei:** `sketch.js`, Funktion `zeichneUebersichtsrouten()`
**Betroffen seit:** Commit `fa1212e` (Initial commit)
**Gemeldet von:** Charis Arnold

### Symptom

In den Kapitel-Detailkarten (z. B. Kapitel 13) blieben die Startpunkt-Badges
**aller 18 Kapitel** sichtbar — Punkt und Nummer, in voller Deckkraft, quer über
den eingezoomten Kartenausschnitt verstreut. In der Übersichtskarte war das
Verhalten korrekt: dort sollen alle Badges stehen und als Klickziele dienen.

Erwartet war, dass beim Zoom in ein Kapitel nur dessen eigene Route und Kreise
stehen bleiben und die Badges der übrigen Kapitel ausblenden.

Die Zahl 18 setzt sich zusammen aus den 17 Routen in
`kapitel-routen-uebersicht.json` (Kapitel 02–18) plus Kapitel 01, das separat
gezeichnet wird.

### Ursache

Zwei Mechanismen greifen ineinander. Der erste erklärt, **dass** überhaupt
gezeichnet wurde, der zweite, **warum** es dabei voll deckend aussah.

**1. Der Sichtbarkeits-Guard griff nie.**

In `zeichneUebersichtsrouten()` stand:

```js
let labelAlpha = (zoomedKapitel && kapitelNr !== zoomedKapitel)
  ? alpha * (1 - kapitelZoomAmount)
  : alpha;
if (labelAlpha <= 0) return;
```

`kapitelZoomAmount` wird in `draw()` per
`lerp(kapitelZoomAmount, zoomedKapitel ? 1 : 0, 0.08)` nachgeführt. Das
konvergiert **asymptotisch** gegen 1 und erreicht den Wert nie exakt. Damit ist
`1 - kapitelZoomAmount` immer echt grösser als 0, `labelAlpha` also immer echt
positiv — der Test `<= 0` konnte per Konstruktion nie zutreffen. Die Badges
wurden in jedem Frame weitergezeichnet, nur mit immer kleinerem Alpha.

**2. Das kleine Alpha kam nicht am Canvas an.**

Der Badge-Block malt die Nummer nicht über p5s `text()`, sondern direkt über
`drawingContext.fillText()` — ein im Sketch an vielen Stellen verwendeter
Workaround gegen p5-Textausfälle bei laufender Animation. Er setzt voraus, dass
das vorangehende `fill()` den Canvas-`fillStyle` gesetzt hat.

p5 speichert die zuletzt gesetzte Füllfarbe intern zwischen und überspringt die
Zuweisung an den Canvas-Context, wenn sich der Wert nicht geändert hat. Bei
gezoomtem Kapitel läuft unmittelbar vor dem Badge-Block `zeichneKreiseOrtRuns()`
(Zeile 2813), und darin schreibt `zeichneKreisLabels()` (Zeile 1750)
`drawingContext.fillStyle` **direkt** — an p5s Zwischenspeicher vorbei, mit
voller Deckkraft (`rgba(33, 43, 46, 1)`).

Sobald `labelAlpha` zwischen zwei Frames konstant bleibt — was nach dem
Einzoomen der Fall ist, weil `kapitelZoomAmount` konvergiert — hält p5 seinen
Zwischenspeicher für aktuell, überspringt das `fill()`, und Punkt wie Nummer
werden mit der fremden, voll deckenden Farbe gemalt.

Genau dieser Fallstrick ist im Projekt bereits dokumentiert: der Kommentar in
`zeichneOrtsveraenderung()` beschreibt denselben Effekt, dort führte er dazu,
dass Ortsnamen rot statt dunkelgrau gezeichnet wurden.

> Mechanismus 1 ist unmittelbar aus dem Code belegbar. Mechanismus 2 ist die
> Erklärung dafür, warum aus „unsichtbar klein" volle Sichtbarkeit wurde; p5s
> Interna liessen sich hier nicht direkt nachmessen (Bibliothek kommt vom CDN),
> die Konstellation deckt sich aber exakt mit dem dokumentierten Präzedenzfall.

### Kein Zusammenhang mit den Cleanup-Schritten

Der Verdacht lag zunächst auf den drei unmittelbar vorangegangenen Aufräum-Commits:

| Commit | Inhalt |
|---|---|
| `eff2b4d` | totes Spine-Timeline-Panel entfernt |
| `46bd12c` | ungenutzten `kreisVergleichOrte`-Ladevorgang entfernt |
| `007fad7` | Duplikat `ovLeereBandCounts()` entfernt |

Die Prüfung schliesst das aus:

1. **Alle acht Diff-Hunks der drei Commits liegen ausserhalb der
   Badge-Zeichnung** — in `preload()`, `bereinigeEingangsdaten()`, im Bereich um
   `bereinigeFotoMarker()`, hinter `baueZwischenMarker()` sowie im
   `ov*`-Variablenblock und in `ovBaueDaten()`/`ovStand()`.

2. **Die relevanten Funktionen sind byte-identisch** zum Stand vor Schritt 1
   (Commit `083d2eb`):

   | Funktion | Umfang | Vergleich |
   |---|---|---|
   | `zeichneUebersichtsrouten` | 317 Zeilen | identisch |
   | `kapitelScheiben` | 25 Zeilen | identisch |
   | `kapitelHitze` | 5 Zeilen | identisch |
   | `draw` | 567 Zeilen | identisch |

3. **`git log -L` auf die fehlerhaften Zeilen** nennt als einzigen Commit
   `fa1212e` — den Initial commit. Die Logik war seit Projektbeginn unverändert.

Der Fehler bestand also von Anfang an. Dass er jetzt auffiel, hat nichts mit den
Cleanups zu tun.

### Fix

**1. Guard für Kapitel 02–18** (`sketch.js:2876`):

```diff
-    if (labelAlpha <= 0) return;
+    if (labelAlpha < 1) return;
```

Schwelle statt Nullvergleich: Unterhalb von 1/255 ist ein Alpha auf dem
8-Bit-Kanal ohnehin nicht mehr darstellbar. Der Fix wirkt **unabhängig von
beiden Mechanismen** — was gar nicht erst gezeichnet wird, kann auch keine
fremde Füllfarbe erben.

**2. Kapitel 01 derselben Regel unterworfen** (`sketch.js:2985`):

```diff
-  let ch1Start = lonLatToScreen(…);
-  let ch1Hover = dist(…) < FOTO_MARKER_TREFFER_RADIUS;
-  if (ch1Hover) kapitelHover = '01';
-  …
-  drawingContext.fillText('01', ch1Start.x + 8, ch1Start.y);
+  let ch1Alpha = zoomedKapitel ? alpha * (1 - kapitelZoomAmount) : alpha;
+  if (ch1Alpha >= 1) {
+    let ch1Start = lonLatToScreen(…);
+    let ch1Hover = dist(…) < FOTO_MARKER_TREFFER_RADIUS;
+    if (ch1Hover) kapitelHover = '01';
+    …
+    drawingContext.fillText('01', ch1Start.x + 8, ch1Start.y);
+  }
```

Kapitel 01 hatte zuvor **gar keinen** Guard — es wurde immer gezeichnet. Der
alte Kommentar wies das als Absicht aus („Bleibt immer klickbar, auch während
eines anderen Kapitel-Zooms (Rückweg)"). Diese Entscheidung wurde nach Rückfrage
bewusst geändert: die 01 wäre sonst die einzige sichtbare Kapitelnummer in einer
Detailansicht, die sonst keine zeigt. Der Rückweg läuft weiterhin über das
Kapitelregister links, Escape und Hochscrollen.

Hover-Test und `kapitelHover`-Zuweisung liegen bewusst **innerhalb** des Guards:
ein unsichtbares Klickziel auf der Kapitelkarte wäre schlimmer als gar keines.

Beide Stellen sind im Code ausführlich kommentiert, damit die Schwelle nicht
später wieder auf `<= 0` „vereinfacht" wird.

### Nachgerechnetes Ausblendverhalten

Konvergenz von `kapitelZoomAmount` bei `alpha = 180` (Normalfall):

| Frame | `kapitelZoomAmount` | `labelAlpha` | alt (`<= 0`) | neu (`< 1`) |
|---|---|---|---|---|
| 10 | 0.5656 | 78.19 | sichtbar | sichtbar |
| 30 | 0.9180 | 14.75 | sichtbar | sichtbar |
| 50 | 0.9845 | 2.78 | sichtbar | sichtbar |
| 60 | 0.9933 | 1.21 | sichtbar | sichtbar |
| 70 | 0.9971 | 0.53 | **sichtbar** | weg |
| 120 | 0.99996 | 0.008 | **sichtbar** | weg |

Der neue Guard greift ab Frame 63, also nach rund **1,05 s bei 60 fps**. Das
weiche Ausblenden bleibt vollständig erhalten — optisch ist der Fade schon nach
etwa 30 Frames abgeschlossen, die Schwelle wird erst deutlich danach erreicht.

Der alte Guard greift in derselben Rechnung nie: `labelAlpha` bleibt
mathematisch immer grösser als 0.

### Nebeneffekt im Schlussakt

Im Schlussakt („Ortsveränderung", siehe `zeichneOrtsveraenderung`) sinkt nicht
nur `kapitelZoomAmount`, sondern `alpha` selbst gegen 0. Es wird in `draw()`
gebildet als

```js
routenSichtbar = Math.max((1 - 0.45 * kreisVergleichMapFade) * (1 - ovZoom), skRauszoom);
routenAlpha    = 180 * routenSichtbar;
```

Dort verschwinden die Badges nun bei `alpha < 1` statt exakt bei `alpha === 0` —
also bei rund **0,6 % Restdeckkraft** (1/180) statt bei null. Auf einer Strecke,
auf der sie ohnehin gerade ausblenden und die Karte darunter mit verschwindet,
ist das nicht wahrnehmbar.

Der Effekt ist bewusst in Kauf genommen: die Alternative wäre ein separater,
nur für den Zoomfall geltender Guard gewesen — mehr Sonderfall-Logik für einen
Unterschied unterhalb der Wahrnehmungsschwelle.

### Prüfungen

- **Syntax:** `sketch.js` parst fehlerfrei (JavaScriptCore, `new Function(quelltext)`).
- **Konvergenz:** numerisch simuliert (siehe Tabelle oben), Schwelle greift ab
  Frame 63.
- **Umfang:** zwei Hunks, beide in `zeichneUebersichtsrouten()`; keine andere
  Funktion berührt.

### Manueller Test

1. In den Übersichtsakt scrollen — alle 18 Badges müssen sichtbar und klickbar sein.
2. Kapitel 13 öffnen (Klick auf Badge oder Kapitelregister links). Nach gut einer
   Sekunde darf **keine** Kapitelnummer mehr auf der Karte stehen.
3. Über „Alle" im Kapitelregister zurück in die Übersicht — alle 18 Badges müssen
   wieder erscheinen.
4. Gegenprobe im Schlussakt: die Badges blenden dort weiterhin gemeinsam mit den
   Routen aus, ohne sichtbaren Sprung.

### Offener, verwandter Befund

Die Konstruktion „`fill()` setzen, danach `drawingContext.fillText()` malen"
steht an weiteren Stellen im Sketch und ist überall demselben Risiko ausgesetzt,
sobald davor jemand `drawingContext.fillStyle` direkt schreibt. Eine generelle
Härtung (fillStyle im Badge-Block und anderswo direkt setzen, statt sich auf
p5s Durchschrieb zu verlassen) wurde bewusst **nicht** Teil dieses Fixes — sie
beträfe zusätzlich die über p5 gezeichneten `ellipse()`-Punkte und gehört in
einen eigenen Schritt.
