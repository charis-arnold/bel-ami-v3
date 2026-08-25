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

~~In `index.html` gibt es kein passendes Element mehr. Diese Regeln sind
Kandidaten für einen eigenen Bereinigungsschritt; `style.css` wurde in
Schritt 1 bewusst nicht angefasst.~~
→ **erledigt in [Schritt 8](#schritt-8--verwaistes-css-des-dom-spine-panels-entfernt).**
Dort zeigte sich, dass der verwaiste Bereich grösser war als hier notiert
(zusätzlich `.spine-panel` und `.spine-heading`, zusammen der ganze Abschnitt 6)
und dass das Panel schon seit dem Initial Commit nie in Betrieb war.

---

## Schritt 2 — Ladevorgang und Bereinigung von `kreisVergleichOrte` entfernt

**Datum:** 20. August 2026
**Datei:** `sketch.js`
**Ausgangsfassung:** Stand nach Schritt 1 (3472 Zeilen)
**Ergebnis:** 3470 Zeilen — 2 Zeilen entfernt

### Was wurde entfernt

| Zeile (vorher) | Kontext | Inhalt |
|---|---|---|
| 224 | `preload()` | `kreisVergleichOrte = loadJSON('kreisvergleich-orte.json');` |
| 245 | `bereinigeEingangsdaten()` | `kreisVergleichOrte = bereinigeKreisVergleichOrte(kreisVergleichOrte);` |

Beide Zeilen standen isoliert am Ende eines Blocks gleichartiger Zuweisungen
(neben `fotoMarkerListe` und `uebersichtsRouten`) und liessen sich ersatzlos
streichen. Es blieben keine Lücken oder verwaisten Kommentare zurück.

### Was ausdrücklich NICHT entfernt wurde

- **Die Variablendeklaration `let kreisVergleichOrte = [];` (Zeile 143)** samt
  ihres erklärenden Kommentarblocks (Zeilen 139–142) steht unverändert.
  Siehe Prüfergebnis unten — sie ist damit referenzlos geworden und wäre ein
  Kandidat für einen Folgeschritt, wurde aber auftragsgemäss stehengelassen.
- **`kreisvergleich-orte.json`** bleibt unangetastet im Projektstamm
  (19 472 Bytes, Zeitstempel unverändert, `git status` meldet keine Änderung).
  Die Datei wird weiterhin von der Python-Pipeline gebraucht:
  `baue-sammelpunkte-handkuriert.py` prüft bei jedem Kapitel-Neubau dagegen,
  ob sich die kapitelübergreifenden Summen geändert haben.

### Warum

Siehe [code-analyse-sketch-js.md, Punkt 4c](code-analyse-sketch-js.md#4-toter-code--explizite-liste).

`kreisVergleichOrte` war **write-only**: die Variable wurde geladen und
bereinigt, ihr Wert danach aber an keiner einzigen Stelle gelesen. Der Grund
steht im Kommentar bei `sketch.js:1971` (Zeilennummer vor diesem Schritt): Das
frühere 4er-Raster des Kreisvergleichs (`zeichneKreisVergleich`) ist entfallen —
dieselbe Information steht heute an den echten Orten auf der Karte, gezeichnet
von `zeichneOrtsveraenderung` aus den `VERGLEICHS_KNOTEN` und den daraus
vorberechneten `ovProKapitel`-Daten. Die JSON-Datei blieb als Datenartefakt
bestehen, ihr Laden im Browser hatte aber keine Wirkung mehr.

Konkret entfielen damit pro Seitenaufruf ein überflüssiger HTTP-Request über
`loadJSON` (19 KB, blockierend in `preload()`) und ein Durchlauf durch
`bereinigeKreisVergleichOrte()`.

### Prüfung vor der Änderung

Auftragsgemäss wurde vorab geprüft, ob die Variable noch anderswo referenziert
wird. Alle Fundstellen von `kreisVergleichOrte` im Projekt
(`sketch.js`, `datenbereinigung.js`, `sonifikation.js`, `index.html`):

| Fundstelle | Art |
|---|---|
| `sketch.js:143` | Deklaration (Schreibzugriff) |
| `sketch.js:224` | Zuweisung — **entfernt** |
| `sketch.js:245` | Zuweisung — **entfernt** |

**Kein einziger Lesezugriff.** Die Variable wird damit nach diesem Schritt
nirgends mehr referenziert; ihre Deklaration bleibt gemäss Auftrag dennoch
erhalten.

> **Methodischer Hinweis:** `datenbereinigung.js` enthält an Zeile 438 ein
> NUL-Byte (im String-Literal `'\x00PARIS_ALLGEMEIN'`). `grep` stuft die Datei
> dadurch als Binärdatei ein und überspringt sie **stillschweigend**, statt eine
> Meldung auszugeben — Suchen über `grep` erfassen sie also nicht. Alle
> Referenzprüfungen ab Schritt 2 laufen deshalb über Python mit explizitem
> Encoding. Die Prüfung aus Schritt 1 wurde auf diesem Weg nachgeholt; ihr
> Ergebnis (null Restreferenzen) bestätigte sich unverändert.

### Prüfungen nach der Änderung

- **Verbleibende Referenzen:** nur noch `sketch.js:143` (die stehengelassene
  Deklaration) und `datenbereinigung.js:290` (die Funktionsdefinition).
- **Syntax:** `sketch.js` parst fehlerfrei (JavaScriptCore, `new Function(quelltext)`).
- **Diff:** ausschliesslich Löschungen (`1 file changed, 2 deletions(-)`).
- **`kreisvergleich-orte.json`:** unverändert, von `git status` nicht gemeldet.

### Offene Folgebefunde (nicht Teil dieses Schritts)

1. ~~**`let kreisVergleichOrte = [];` (`sketch.js:143`)** ist jetzt vollständig
   referenzlos — zusammen mit dem Kommentarblock 139–142 rund 5 Zeilen. Nur auf
   ausdrückliche Freigabe zu entfernen.~~
   → **erledigt im [Nachtrag zu Schritt 2](#nachtrag-zu-schritt-2--verwaiste-deklaration-und-funktion-entfernt).**
2. ~~**`bereinigeKreisVergleichOrte()` (`datenbereinigung.js:290`)** hat mit
   Zeile 245 ihre einzige Aufrufstelle verloren und ist damit toter Code
   geworden. `datenbereinigung.js` lag ausserhalb dieses Schritts und wurde
   nicht angefasst.~~
   → **erledigt im [Nachtrag zu Schritt 2](#nachtrag-zu-schritt-2--verwaiste-deklaration-und-funktion-entfernt).**
3. **NUL-Byte in `datenbereinigung.js:438`** (siehe methodischer Hinweis oben).
   Ob das Zeichen im Sentinel-Präfix `'\x00PARIS_ALLGEMEIN'` beabsichtigt ist
   oder ein Kopierunfall, ist ungeklärt. Es stört Werkzeuge, die die Datei als
   Text behandeln (grep, teilweise Editoren und Diff-Ansichten).

---

## Nachtrag zu Schritt 2 — verwaiste Deklaration und Funktion entfernt

**Datum:** 20. August 2026
**Dateien:** `sketch.js`, `datenbereinigung.js`
**Ausgangsfassung:** Stand nach Schritt 2 (Commit `eff2b4d` + 2 gelöschte Zeilen)
**Ergebnis:** `sketch.js` 3470 → 3464 Zeilen, `datenbereinigung.js` 486 → 475 Zeilen — 17 Zeilen entfernt

Arbeitet die Folgebefunde 1 und 2 aus Schritt 2 ab. Beide Elemente waren vor
Schritt 2 noch in Gebrauch und sind erst durch das Entfernen der Zeilen 224 und
245 tot geworden — sie gehören deshalb sachlich zu Schritt 2 und werden hier
als dessen Nachtrag geführt statt als eigener Schritt.

### Was wurde entfernt

**`sketch.js`, Zeilen 139–144** (6 Zeilen):

| Zeile (vorher) | Inhalt |
|---|---|
| 139–142 | Kommentarblock `// --- Kreisvergleich (letzter Akt): 8 handverlesene, …` |
| 143 | `let kreisVergleichOrte = [];` |
| 144 | trennende Leerzeile |

**`datenbereinigung.js`, Zeilen 286–296** (11 Zeilen):

| Zeile (vorher) | Inhalt |
|---|---|
| 286–289 | Kommentarblock `// kreisvergleich-orte.json (siehe baue-kreisvergleich.py) — wie bei …` |
| 290–295 | `function bereinigeKreisVergleichOrte(rohdaten) { … }` |
| 296 | trennende Leerzeile |

In beiden Dateien lag der Block zwischen zwei unabhängigen Abschnitten und
liess sich ersatzlos streichen; der Abstand von einer Leerzeile zum jeweils
folgenden Abschnitt blieb erhalten.

### Warum

Beide Elemente waren nach Schritt 2 vollständig referenzlos:

- **`kreisVergleichOrte`** hatte mit den Zeilen 224 und 245 seine beiden einzigen
  Zuweisungen verloren. Gelesen wurde die Variable ohnehin nie (siehe
  Prüftabelle in Schritt 2), sie war damit eine leere Deklaration ohne jeden
  Zugriff.
- **`bereinigeKreisVergleichOrte()`** hatte mit Zeile 245 ihre einzige
  Aufrufstelle im gesamten Projekt verloren.

Der zugehörige Kommentar in `sketch.js` beschrieb ausschliesslich die entfernte
Variable, der in `datenbereinigung.js` ausschliesslich die entfernte Funktion —
beide sind mit ihrem Bezugsobjekt weggefallen.

`kreisvergleich-orte.json` bleibt wie in Schritt 2 unangetastet im Projektstamm;
die Python-Pipeline (`baue-sammelpunkte-handkuriert.py`) prüft weiterhin dagegen.

### Besonderheit: binärsichere Bearbeitung von `datenbereinigung.js`

Wegen des NUL-Bytes in der Datei (siehe offener Punkt unten) wurde
`datenbereinigung.js` **nicht** mit `sed` oder im Text-Modus bearbeitet, sondern
byte-genau über Python im Binärmodus (`open(..., 'rb')` / `'wb'`, Split an
`b'\n'`). Der zu löschende Block wurde vorher gegen seinen erwarteten Inhalt
geprüft und zusätzlich darauf, dass das NUL-Byte nicht darin liegt.

Nachweis der Unversehrtheit:

| | vorher | nachher |
|---|---|---|
| Dateigrösse | 25 431 Bytes | 24 924 Bytes |
| Anzahl NUL-Bytes | 1 | 1 |
| Byte-Offset des NUL | 23 327 | 22 820 |
| Zeile des NUL | 438 | 427 |

Die Verschiebung um 507 Bytes bzw. 11 Zeilen entspricht exakt dem entfernten
Block. Das Byte selbst ist unverändert erhalten, sein String-Literal
(`'\x00PARIS_ALLGEMEIN'`) wurde nicht angefasst.

### Prüfungen nach der Änderung

- **Restreferenzen:** `kreisVergleichOrte` und `bereinigeKreisVergleichOrte` —
  jeweils null Treffer in `sketch.js`, `datenbereinigung.js`, `sonifikation.js`,
  `index.html` (Prüfung NUL-sicher über Python).
- **Syntax:** `sketch.js` **und** `datenbereinigung.js` parsen fehlerfrei
  (JavaScriptCore, `new Function(quelltext)`).
- **Diff:** ausschliesslich Löschungen — `sketch.js` −6, `datenbereinigung.js` −11.
- **`kreisvergleich-orte.json`:** unverändert, von `git status` nicht gemeldet.

### Weiterhin offen

~~**NUL-Byte in `datenbereinigung.js`, jetzt Zeile 427** (vor diesem Nachtrag
Zeile 438) — im String-Literal `'\x00PARIS_ALLGEMEIN'` innerhalb von
`zaehleAnnotationenLiveNachOrtBasis()`.~~
→ **erledigt in [Schritt 6](#schritt-6--nie-aktive-paris-sonderbehandlung-in-bauespinedaten-entfernt).**
Zwei Korrekturen zur damaligen Notiz: Das Byte lag in `baueSpineDaten()`, nicht
in `zaehleAnnotationenLiveNachOrtBasis()` (die endet bei Zeile 415). Und es war
ein **rohes** NUL-Byte, nicht die vierstellige Escape-Schreibweise `\x00` —
die kam im ganzen Projekt kein einziges Mal vor.

Bewusst **nicht** angefasst; wird separat betrachtet. Bis dahin galt für alle
weiteren Arbeitsschritte:

- Referenzsuchen über `grep` erfassen `datenbereinigung.js` **nicht** — die
  Datei wird als binär eingestuft und stillschweigend übersprungen (exit 1 ohne
  Meldung). Suchen deshalb über Python mit explizitem Encoding, oder `grep -a`.
- Schreibende Zugriffe auf die Datei binärsicher ausführen, damit das Byte nicht
  unbeabsichtigt verlorengeht oder ersetzt wird.

Ungeklärt bleibt, ob das Zeichen als Sentinel-Präfix beabsichtigt ist (ein
Schlüssel, der garantiert mit keinem echten Ortsnamen kollidieren kann) oder ob
es ein Kopierunfall ist.

---

## Schritt 3 — Duplikat `ovLeereBandCounts()` gegen `leereBandCounts()` zusammengeführt

**Datum:** 20. August 2026
**Datei:** `sketch.js`
**Ausgangsfassung:** Stand nach dem Nachtrag zu Schritt 2 (3464 Zeilen)
**Ergebnis:** 3456 Zeilen — 8 Zeilen entfernt, 2 Zeilen geändert

### Was wurde geändert

**Aufrufstellen umgestellt** (2 Stück, beide in `sketch.js`):

| Zeile (vorher) | Umgebende Funktion | vorher → nachher |
|---|---|---|
| 2217 | `ovBaueDaten()` | `let summe = ovLeereBandCounts();` → `let summe = leereBandCounts();` |
| 2237 | `ovStand()` | `let summe = ovLeereBandCounts();` → `let summe = leereBandCounts();` |

**Definition entfernt** — `sketch.js`, Zeilen 2176–2183 (8 Zeilen):

| Zeile (vorher) | Inhalt |
|---|---|
| 2176–2182 | `function ovLeereBandCounts() { … }` |
| 2183 | trennende Leerzeile |

Die Definition stand zwischen dem `ov*`-Variablenblock (bis Zeile 2174) und
`ovAddiere()` (ab 2184) und liess sich ersatzlos streichen; der Abstand von
einer Leerzeile blieb erhalten. Ein erklärender Kommentar existierte nicht.

### Warum

Siehe [code-analyse-sketch-js.md, Punkt 4d](code-analyse-sketch-js.md#4-toter-code--explizite-liste).

`ovLeereBandCounts()` und `leereBandCounts()` (`sketch.js:1481`) waren exakte
Dubletten: dieselben drei Kategorie-Schlüssel, dieselben vier Valenz-Zähler,
identische Werte. Beide wurden benutzt, es gab also keinen toten Code im engeren
Sinn — wohl aber zwei Namen für dieselbe Sache, mit dem üblichen Risiko, dass
eine künftige Änderung an der Zählstruktur (etwa eine vierte Kategorie oder ein
zusätzlicher Valenz-Zähler) nur in einer der beiden nachgezogen wird und die
Kreisgrafik dann je nach Aufrufweg unterschiedlich zählt.

Beibehalten wurde `leereBandCounts()`, weil sie die allgemeinere ist: sie liegt
im Kreisgrafik-Abschnitt, auf den sich die Struktur inhaltlich bezieht, während
das `ov`-Präfix sie fälschlich dem Schlussakt „Ortsveränderung" zuordnete.

### Prüfung vor der Änderung

Vor dem Ersetzen wurde maschinell verglichen, ob die beiden Funktionskörper
tatsächlich identisch sind — nur dann ist die Umstellung verhaltensneutral:

| | `leereBandCounts` | `ovLeereBandCounts` |
|---|---|---|
| Zeilen | 1481–1487 | 2176–2182 |
| Umfang | 7 Zeilen | 7 Zeilen |
| Körper ohne Signaturzeile | — zeichenweise **identisch** — ||

Beide geben bei jedem Aufruf ein **frisch konstruiertes** Objektliteral zurück.
Es gibt weder eine gemeinsam genutzte Referenz noch inneren Zustand, der
zwischen den Aufrufwegen unterscheiden könnte — die Umstellung ist damit rein
mechanisch und ohne Verhaltensänderung.

Aufrufstellen von `ovLeereBandCounts()` im gesamten Projekt
(`sketch.js`, `datenbereinigung.js`, `sonifikation.js`, `index.html`):
genau die zwei oben genannten, beide in `sketch.js`. Keine weitere Datei
betroffen.

> **Hinweis zur Suche:** Ein Muster wie `\bleereBandCounts\b` findet auch
> `ovLeereBandCounts` mit, da die Wortgrenze nach `ov` nicht greift. Die
> Trennung der beiden Namen erfolgte über einen negativen Lookbehind
> (`(?<!ov)\bleereBandCounts\b`); die Referenzsuche lief wie seit Schritt 2
> NUL-sicher über Python statt über `grep`.

### Prüfungen nach der Änderung

- **Restreferenzen:** `ovLeereBandCounts` — null Treffer in allen vier
  Projektdateien.
- **`leereBandCounts` jetzt:** eine Definition (`sketch.js:1481`) und drei
  Aufrufstellen (`1611` in `zeichneKreiseOrtRuns`, `2209` in `ovBaueDaten`,
  `2229` in `ovStand`) — die beiden umgestellten Aufrufe sind angekommen.
- **Hoisting:** unkritisch. `leereBandCounts` ist eine Funktionsdeklaration und
  steht ohnehin rund 700 Zeilen vor den neuen Aufrufstellen.
- **Syntax:** `sketch.js` parst fehlerfrei (JavaScriptCore, `new Function(quelltext)`).
- **Diff:** drei Hunks — eine Löschung (die Definition) und zwei
  Ein-Zeilen-Ersetzungen, sonst nichts.

---

## Schritt 4 — Gedanken-Spalte vollständig entfernt

**Datum:** 20. August 2026
**Dateien:** `sketch.js`, `dom-aufbau.js`, `index.html`, `style.css`
**Ergebnis:** 76 Zeilen entfernt, 4 geändert

Erste Bereinigung, die über JavaScript hinausgeht — betroffen sind auch Markup
und Stylesheet.

### Was war die Gedanken-Spalte

Eine schmale Textspalte am linken Kartenrand (100 px vom Rand, vertikal
zentriert, max. 220 px breit) mit fünf Einträgen aus `stationenData.gedanken` —
Orte, die in Kapitel 1 nicht betreten, sondern nur gedacht, erinnert oder
erträumt werden: Champs-Élysées, „Afrika (Erinnerung, Militärdienst)", Bois de
Boulogne, Parc Monceau, „imaginierter Sommergarten". Jede Zeile bestand aus
einem Punkt und dem Ortsnamen; daneben zeichnete `draw()` eine Kreisgrafik an
der Bildschirmposition des Punkts.

### Warum entfernt

Die Spalte war über eine fest verdrahtete Zeile in `draw()` **dauerhaft
unsichtbar**:

```js
let sichtbar = false;   // Gedanken-Spalte (Kapitel-1-Ansicht) für den Moment komplett ausgeblendet.
g.el.classList.toggle('sichtbar', sichtbar);
if (!sichtbar) return;
```

`.gedanken-entry` hat per CSS `opacity: 0` und wird nur über die Klasse
`sichtbar` eingeblendet — die hier nie gesetzt wurde. Die Funktion baute also
bei jedem Start fünf DOM-Zeilen, die `draw()` in jedem Frame wieder ausschaltete;
das `return` übersprang zugleich die Kreisgrafik. Auf Nachfrage bestätigt: wird
nicht mehr gebraucht, soll weg statt versteckt zu bleiben.

### Was wurde entfernt

**`dom-aufbau.js`** — `function baueGedankenColumn()` (14 Zeilen), dazu drei
Stellen im Kopfkommentar nachgezogen (`gedankenColumn`/`gedankenEintraege` aus
den Abhängigkeitslisten, „sechs baue*-Funktionen" → „fünf").

**`sketch.js`** — der Block in `draw()` (13 Zeilen) plus vier Reste:

| Zeile (vorher) | Element |
|---|---|
| 702 | `let stageRect = stage.getBoundingClientRect();` |
| 704–716 | `gedankenEintraege.forEach(…)` mit `rv`, `sichtbar`, `return`, Kreisgrafik |
| 43 | `gedankenColumn` aus `let gedankenColumn, kartenMarkierungenEl;` |
| 53 | `let gedankenEintraege = [];` |
| 212 | `gedankenColumn = document.getElementById('gedankenColumn');` |
| 257 | `baueGedankenColumn();` |

**`index.html`** — `<div class="gedanken-column" id="gedankenColumn"></div>`.

**`style.css`** — der ganze Abschnitt „5) Gedanken-Spalte" (`.gedanken-column`,
`.gedanken-entry`, `.gedanken-entry.sichtbar`, 34 Zeilen) sowie die Zeile
`.scrolly-stage.grafik-ansicht #gedankenColumn,` aus der Selektorliste in
Zeile 54.

### Prüfung vor dem Löschen

Vier Namen mussten einzeln geklärt werden, drei davon führten zu Einschränkungen:

| Name | Befund | Konsequenz |
|---|---|---|
| `revealIndex` | 14 Fundstellen im Projekt; die Berechnung in Zeile 705 landete in `rv`, das **nirgends gelesen** wurde. Die übrigen Nutzungen sind unabhängig. | löschbar |
| `stageRect` | nur in den Zeilen 712/713 gebraucht — beide im Löschbereich | mit entfernt |
| `GEDANKEN_FILTER` | nach dem Löschen von Zeile 714 weiterhin in `datenbereinigung.js:149` gebraucht (baut `GEDANKEN_ORTRUN_UNTERDRUECKT`) | **bleibt** |
| `.ortspunkt` | dieselbe CSS-Klasse nutzen `baueKartenMarkierungen`, `baueStationsMarker` und `baueZwischenMarker` | **bleibt** |

Zusätzlich zwei Korrekturen an der Auftragsbeschreibung:

- **`style.css:337` ist `.gedanken-column`, nicht `.gedanken-entry`.** Es waren
  drei Regeln plus Abschnittskopf, nicht eine.
- **`style.css:54`** enthält `#gedankenColumn` als eines von vier Elementen
  einer Selektorliste. Dort wurde nur die eine Zeile entfernt — die Regel gilt
  weiterhin für `#naechstesKapitel`, `#kartenMarkierungen` und `#annotationBox`.

### Prüfungen nach der Änderung

- **Restreferenzen:** `baueGedankenColumn`, `gedankenColumn`, `gedankenEintraege`,
  `gedanken-column`, `gedanken-entry` — null Treffer über alle zwölf Projektdateien
  (zehn JS, `index.html`, `style.css`).
- **Syntax:** alle zehn JS-Dateien parsen fehlerfrei.
- **CSS:** Klammerbilanz ausgeglichen (108 / 108).
- **Ladereihenfolge:** alle zehn Dateien laden in `index.html`-Reihenfolge
  fehlerfrei.
- **Diff:** 76 Löschungen, 4 geänderte Zeilen (Kopfkommentar und die
  Mehrfachdeklaration in Zeile 43).

| Datei | vorher | nachher |
|---|---|---|
| `sketch.js` | 1821 | 1803 |
| `dom-aufbau.js` | 295 | 279 |
| `style.css` | 1125 | 1089 |
| `index.html` | 109 | 107 |

### Offener Folgebefund

**`stationenData.gedanken` hat keinen Leser mehr.** Das Feld wird in
`kapitel01-stationen.json` weiterhin geführt und in
`datenbereinigung.js:273` normalisiert (`rohdaten.gedanken = arrayFuer(rohdaten.gedanken)`),
aber von keiner Stelle mehr ausgewertet. Die Normalisierung ist harmlos und
generisch; ob das JSON-Feld bleiben soll, ist eine Datenfrage und wurde hier
nicht entschieden — die Python-Pipeline erzeugt es weiterhin.

Verwandt: `GEDANKEN_ZIEL_ORT` und `GEDANKEN_ORTRUN_UNTERDRUECKT` in
`datenbereinigung.js` bleiben in Gebrauch. Sie steuern, wie gedachte Orte in die
Kreisgrafik der *echten* Orte einfliessen, und sind von der entfernten Spalte
unabhängig.

---

## Schritt 5 — Karten-Marker stillgelegt statt entfernt

**Datum:** 20. August 2026
**Datei:** `sketch.js`
**Ergebnis:** 1803 → 1816 Zeilen (+13)

Der erste Schritt in diesem Protokoll, der **nichts entfernt**. Die drei
Marker-Ebenen der Kapitel-1-Ansicht sollen erhalten bleiben und später
reaktivierbar sein — nur ihre wirkungslose Rechenlast fällt weg. Deshalb wird
die Datei hier länger statt kürzer.

### Ausgangslage

`baueKartenMarkierungen()`, `baueStationsMarker()` und `baueZwischenMarker()`
(alle in `dom-aufbau.js`) bauen beim Start zusammen **16 DOM-Elemente**:

| Funktion | Quelle | aktive Einträge |
|---|---|---|
| `baueKartenMarkierungen` | `stationenData.markierungen` | 1 |
| `baueStationsMarker` | `stationenData.route` (ohne Index 0) | 10 |
| `baueZwischenMarker` | `stationenData.zwischenPunkte` | 5 |

Sie sind seit längerem dauerhaft ausgeblendet — `draw()` setzte für jedes
Element `classList.toggle('sichtbar', false)` mit dem Literal `false`, und
`.karten-markierung` hat per CSS `opacity: 0`.

Anders als bei der Gedanken-Spalte (Schritt 4) fehlte hier aber ein früher
Ausstieg: Die Positionierung lief in **jedem Frame weiter**.

### Was eingespart wird

Pro Frame für alle 16 Elemente, ohne jede sichtbare Wirkung:

| | pro Frame | bei 60 fps |
|---|---|---|
| `lonLatToScreen()`-Aufrufe | 16 | 960/s |
| `style.left` / `style.top`-Zuweisungen | 32 | 1920/s |
| `classList.toggle()` | 16 | 960/s |

Die Style-Zuweisungen wiegen am schwersten: Jede schreibt ins Layout-Modell des
Browsers, und das in einer Animationsschleife.

### Umsetzung

**1. Schaltkonstante** vor den drei Arrays (`sketch.js:63`):

```js
const KARTEN_MARKER_SICHTBAR = false;
```

Mit Kommentar, der festhält, was übersprungen wird, wie man es umlegt, und dass
für vollständiges Einblenden zusätzlich
`.karten-markierung .label { display: none }` in `style.css` fallen muss —
sonst erschienen nur die Punkte ohne Beschriftung.

**2. Block-Guard** um die drei Schleifen (`sketch.js:712`):

```js
  if (KARTEN_MARKER_SICHTBAR) {
    markierungsEintraege.forEach(m => { … });
    stationsMarker.forEach(m => { … });
    zwischenMarker.forEach(m => { … });
  }
```

Die Schleifenkörper sind unverändert, nur eingerückt.

**3. `toggle`-Parameter umgestellt** — in allen drei Schleifen:

```diff
-      m.el.classList.toggle('sichtbar', false);
+      m.el.classList.toggle('sichtbar', KARTEN_MARKER_SICHTBAR);
```

Damit ist die Konstante ein **echter Schalter**: Auf `true` gesetzt läuft die
Positionierung wieder *und* die Elemente bekommen die `sichtbar`-Klasse. Mit dem
Literal `false` wäre das Umlegen eine Falle gewesen — die Rechenlast käme
zurück, sichtbar würde nichts.

### Warum ein Block-Guard und kein `return`

Naheliegend wäre `if (!sichtbar) return;` gewesen, das Muster aus Schritt 4.
Dort stand es aber **innerhalb** des `forEach`-Callbacks und übersprang nur
einen Eintrag. An dieser Stelle wären wir im Rumpf von `draw()` selbst: Ein
`return` hätte die restlichen **107 Zeilen abgebrochen** — Hero-Fade,
Begleittexte, Kapitel-Einstiegstexte und die Foto-Marker-Ebene. Deshalb ein
Block, kein Ausstieg.

Gegengeprüft: `draw()` enthält weiterhin **keinen einzigen `return` auf
Funktionsebene** und läuft bis zur letzten Anweisung (`zeichneFotoMarker`)
durch.

### Nicht angefasst

Die drei Funktionen in `dom-aufbau.js`, der Container `#kartenMarkierungen` in
`index.html`, sämtliches CSS (`.karten-markierung` und Varianten) sowie die drei
Arrays samt Inhalt. Die DOM-Knoten werden weiterhin bei jedem Start gebaut und
stehen zur Reaktivierung bereit.

**Am sichtbaren Verhalten ändert sich nichts.** Die Klasse `sichtbar` wurde nie
gesetzt; die Elemente stehen seit ihrer Erzeugung auf `opacity: 0`.

### Prüfungen

- **Syntax:** `sketch.js` parst fehlerfrei.
- **`draw()` vollständig:** keine `return`-Anweisung auf Funktionsebene,
  554 Zeilen laufen durch.
- **Ladereihenfolge:** alle zehn Dateien laden unverändert fehlerfrei.
- **Diff:** 34 Einfügungen, 21 Löschungen — der umgestellte Block plus zehn
  Kommentarzeilen.

### Offene Befunde zur möglichen Reaktivierung

Wer den Schalter später auf `true` legt, stösst auf drei Altlasten:

1. **`.karten-markierung .label { display: none }`** (`style.css:327`) blendet
   die Ortsnamen unabhängig vom Schalter aus.
2. **Die Klassen `stations-marker` und `zwischen-marker`** werden vergeben, aber
   in keiner CSS-Regel angesprochen — alle drei Marker-Arten sähen identisch aus
   (9 px schwarzer Punkt).
3. **`revealIndex`** wird beim Bauen in jedes Marker-Objekt geschrieben, aber
   nirgends gelesen. Das war einmal die Grundlage für gestaffeltes Einblenden;
   die Vergleichslogik dazu existiert nicht mehr.

---

## Schritt 6 — Nie aktive Paris-Sonderbehandlung in `baueSpineDaten()` entfernt

**Datum:** 20. August 2026
**Dateien:** `datenbereinigung.js`, `kreisgrafik.js`, `sketch.js`
**Ausgangsfassung:** Commit `d69a78b`
**Ergebnis:** `datenbereinigung.js` 474 → 452 Zeilen, `kreisgrafik.js` 488 → 486,
`sketch.js` unverändert 889 — 22 Einfügungen, 46 Löschungen

Damit erledigt sich zugleich der seit dem [Nachtrag zu Schritt 2](#weiterhin-offen)
offene Befund zum NUL-Byte: die Zeile, die es enthielt, fällt ersatzlos weg.

### Der Fund

`baueSpineDaten()` fasste alle Annotationen, deren Ort in der Konstanten
`PARIS_ALLGEMEIN` stand (`'Paris'`, `'Paris (allgemein)'`, `'unspezifisch'`,
`'Strassenecken von Paris (allgemein)'`), zu **einem** gemeinsamen
Spine-Eintrag „Paris allgemein" zusammen. Der Map-Schlüssel dafür war ein
Pseudo-Schlüssel mit NUL-Präfix, damit er mit keinem echten Ortsnamen
kollidieren konnte.

**Dieser Codepfad war nicht mehr erreichbar.** Die Bedingung `istParis` wird
mit den aktuellen Daten nie wahr — aus zwei voneinander unabhängigen Gründen:

1. **Kapitel 02–18 waren nie betroffen.** Nur der Aufruf für Kapitel 1
   (`sketch.js:285`) übergab überhaupt ein `opts`-Argument; der Aufruf für die
   übrigen Kapitel (`sketch.js:299`) liess `parisAllgemein` auf dem leeren
   Default-Set stehen.
2. **Für Kapitel 1 blockiert der `ortBasis`-Vorrang.** Die Funktion liest
   `a.ortBasis || a.ort || ''`. Die vier vagen Namen stehen im
   Kapitel-1-Datensatz ausschliesslich im Feld `ort` — und alle 14
   betroffenen Annotationen haben ein gesetztes, konkretes `ortBasis`
   (z.B. `ort: 'Paris (allgemein)'` → `ortBasis: 'Place de la Madeleine'`).
   `a.ort` wird daher nie erreicht.

Punkt 2 ist das Ergebnis genau der Datenbereinigung, nach der die Datei heisst:
Die vagen Ortsangaben wurden auf konkrete Orte aufgelöst, der Rohwert blieb in
`ort` als Herkunftsnachweis stehen. Damit hatte die Zusammenfassung ihren
Gegenstand verloren. Eingeführt wurde der Zweig in Commit `11153ee`
(„Kreisdiagramm: ergänzen, F-Werte"), der die Funktion von einer Schleife über
`runs` (mit `r.ort`) auf eine Schleife über `annotationen` (mit `ortBasis`-
Vorrang) umstellte — im selben Commit, der auch das NUL-Byte hereinbrachte.
Beim Umbau lief die Sonderbehandlung ins Leere, wurde aber mitgenommen.

### Beleg vor der Änderung

`baueSpineDaten()` wurde nicht nachgebaut, sondern **im Original ausgeführt**:
`datenbereinigung.js` unverändert in JavaScriptCore (`jsc`) geladen, mit den
echten Kapiteldaten aus `kapitel01-…` bis `kapitel18-stationen.json` und
denselben Argumenten wie in `draw()`.

- `istParis` traf bei **0 von 150** Annotationen in Kapitel 1 zu.
- Der Pseudo-Schlüssel wurde **kein einziges Mal** als Map-Schlüssel gesetzt.
- Einträge mit `typ: 'muted'`: **0**. Kapitel 1 erzeugte 18 Einträge, alle
  `'location'`/`'rueckkehr'` — passend zum Kommentar in `spine-horizontal.js:90`
  („Kapitel 1, 18, mehr als jedes andere").
- Keines der 18 Kapitel-JSONs enthält einen der vier Namen in `ortBasis` oder
  in `ortRuns[].ort` (159 ortRuns insgesamt geprüft).

### Was wurde entfernt

| Datei | Zeilen (vorher) | Element |
|---|---|---|
| `datenbereinigung.js` | 54–59 | Konstante `PARIS_ALLGEMEIN` (vier Ortsnamen) |
| `datenbereinigung.js` | 403–405 | Kommentarabsatz zu `opts.parisAllgemein` |
| `datenbereinigung.js` | 416, 417, 424 | `opts`-Parameter, `parisAllgemein`-Default, `istParis` |
| `datenbereinigung.js` | 427 | Pseudo-Schlüssel — **die Zeile mit dem NUL-Byte** |
| `datenbereinigung.js` | 432–436 | Absorptions-Zweig `if (istParis) return;` samt Kommentar |
| `datenbereinigung.js` | 441–444 | Die drei `istParis ? … : …`-Ternäre im Eintrags-Objekt |
| `sketch.js` | 285 | Argument `{ parisAllgemein: PARIS_ALLGEMEIN }` |
| `kreisgrafik.js` | 98 | `if (PARIS_ALLGEMEIN.has(ort)) return 'UNBESTIMMT';` |
| `kreisgrafik.js` | 24–25, 84, 131–133 | Erwähnungen in Header und Kommentaren |

Mit dem Wegfall des Pseudo-Schlüssels ist der Map-Schlüssel immer der Ortsname
selbst. Die Variablen `indexNachSchluessel`/`laufenderSchluessel` heissen
deshalb jetzt `indexNachOrt`/`laufenderOrt`, und die Zwischenvariable
`schluessel` entfällt. `typ: 'location'` bleibt erhalten — der Renderer prüft
zwar nur auf `'rueckkehr'`, aber `'location'` ist die dokumentierte Gegenprobe.

### Prüfungen nach der Änderung

- **Verhalten identisch:** Dieselbe `jsc`-Ausführung wie oben, vorher und
  nachher, über **alle 18 Kapitel** — Spine-Einträge und
  `sammelpunktKategorie()`-Ergebnisse als JSON serialisiert und verglichen:
  **byte-identisch**. Kapitel 1 erzeugt weiterhin 18 Einträge.
- **Syntax:** `datenbereinigung.js`, `sketch.js` und `kreisgrafik.js` parsen
  fehlerfrei (JavaScriptCore, `new Function(quelltext)`).
- **Restreferenzen:** `PARIS_ALLGEMEIN`, `parisAllgemein`, `istParis`,
  `'muted'` — null Treffer in allen `.js`- und `.html`-Dateien.
- **NUL-Bytes:** null in sämtlichen versionierten Textdateien. Damit ist
  `datenbereinigung.js` wieder eine gewöhnliche Textdatei — die binärsichere
  Sonderbehandlung aus dem Nachtrag zu Schritt 2 entfällt, `grep` erfasst die
  Datei ab jetzt wieder normal.

### Offener Folgebefund

→ **erledigt in [Schritt 7](#schritt-7--sammelpunkt-kreis-orte-ohne-adresse-vollständig-entfernt).**
Die dort ergänzte Historie korrigiert eine Ungenauigkeit dieses Absatzes: für
die Präfix-Kategorien war **nicht** der `ortBasis`-Vorrang die Ursache (anders
als beim Paris-Zweig), sondern eine spätere, bewusste Datenumstellung.

**`sammelpunktKategorie()` in `kreisgrafik.js` greift derzeit überhaupt nicht
mehr** — nicht nur der entfernte `PARIS_ALLGEMEIN`-Zweig, sondern auch die
fünf Präfix-Kategorien darunter (`'Erinnerung (Kapitel'`, `'Phantasie (Kapitel'`,
`'Wunsch (Kapitel'`, `'Gedanken (Kapitel'`, `'Unbestimmt (Kapitel'`).

Die Funktion wird an beiden Aufrufstellen (`kreisgrafik.js:135`,
`annotationsbox.js:86`) mit `r.ort` aus `ortRuns` aufgerufen. Über alle 18
Kapitel hinweg trägt **kein einziger der 159 ortRuns** einen dieser Präfixe.
`'Unbestimmt (Kapitel XX)'` kommt in elf Kapiteldateien vor — aber wie im
Paris-Fall nur in `annotationen[].ort`, während `ortRuns` aus `ortBasis`
gebaut wird. Die Funktion liefert damit ausnahmslos `null`, die Map
`keineAdresseNachKategorie` bleibt leer, und `zeichneOrteOhneAdresse()`
(`kreisgrafik.js:183`) wird nie aufgerufen — der Sammelpunkt-Kreis unterhalb
des Kapitelregisters erscheint nie.

Das ist dieselbe Ursache wie oben, betrifft aber ein sichtbares Feature statt
toten Codes: Entweder ist die Anzeige unbeabsichtigt ausgefallen (dann gehört
der Lesezugriff auf `ort` statt `ortBasis` umgestellt), oder das Feature ist
bewusst entfallen (dann sind `SAMMELPUNKT_KATEGORIEN`, `sammelpunktKategorie`,
`zeichneOrteOhneAdresse`, die Box `#orteOhneAdresse` und das zugehörige CSS
toter Code). **Nicht angefasst** — die Entscheidung braucht erst eine Antwort
darauf, was die Anzeige zeigen soll.

---

## Schritt 7 — Sammelpunkt-Kreis "Orte ohne Adresse" vollständig entfernt

**Datum:** 20. August 2026
**Dateien:** `kreisgrafik.js`, `annotationsbox.js`, `sketch.js`, `index.html`, `style.css`
**Ausgangsfassung:** Commit `8ccc9ad`
**Ergebnis:** `kreisgrafik.js` 486 → 403 Zeilen, `sketch.js` 889 → 877,
`style.css` 1089 → 1063, `annotationsbox.js` 129 → 127, `index.html` 109 → 107
— 31 Einfügungen, 156 Löschungen

Damit erledigt sich der in
[Schritt 6](#schritt-6--nie-aktive-paris-sonderbehandlung-in-bauespinedaten-entfernt)
offen gebliebene Folgebefund.

### Der Fund

Orte ohne konkrete Adresse bekamen keinen Kreis auf der Karte (dort hätten sie
eine frei erfundene Koordinate gebraucht), sondern wurden nach Kategorie
gesammelt und als eigener Kreis-Stapel unterhalb des Kapitelregisters
gezeichnet. Die Mechanik bestand aus fünf Teilen: der Kategorientabelle
`SAMMELPUNKT_KATEGORIEN`, der Zuordnung `sammelpunktKategorie()`, dem
Sammel-Zweig in `zeichneKreiseOrtRuns()`, dem Zeichner
`zeichneOrteOhneAdresse()` und der unsichtbaren Platzhalter-Box
`#orteOhneAdresse`, die nur die Bildschirmposition lieferte.

**Kein einziger ortRun erreichte diese Mechanik mehr.** `sammelpunktKategorie()`
wird an beiden Aufrufstellen mit `r.ort` aus `ortRuns` aufgerufen und lieferte
über alle 18 Kapitel ausnahmslos `null`; `keineAdresseNachKategorie` blieb
folglich leer und `zeichneOrteOhneAdresse()` wurde nie aufgerufen.

### Bestätigung: bewusst stillgelegt, nicht kaputtgegangen

Zwei unabhängige Belege, dass das Feature absichtlich aufgegeben wurde:

**1. Die Datenpipeline sagt es selbst.** In
`data-prep/05 bereinigen/baue-sammelpunkte-handkuriert.py` steht im Kopfkommentar
zur Regel, dass jede Annotation zu dem Ort zählt, an dem sie empfunden wird:

> „Erinnerungen, Wünsche, Vorstellungen und blosse Erwähnungen bekommen also
> keinen eigenen Kreis und kein Sammelbecken, sondern gehören zum Schauplatz,
> an dem die Figur gerade steht. […] (Die Sammelbecken-Mechanik in sketch.js —
> `SAMMELPUNKT_KATEGORIEN`/`zeichneOrteOhneAdresse` — wird dadurch nicht mehr
> gebraucht; sie bleibt vorerst ungenutzt stehen.)"

**2. Die Git-Historie datiert den Umstieg genau.** Jeder Commit wurde daraufhin
geprüft, ob die `ortRuns` irgendeiner Kapiteldatei je einen Sammelpunkt-Namen
trugen:

| Commit | Datum | Treffer in `ortRuns` |
|---|---|---|
| `fa1212e` … `17da603` | 11.–13. Aug. | 11 |
| `75e7e8f` | 18. Aug. | 6 |
| `ff335fc` | 18. Aug. | 4 |
| `ab1a474` | 18. Aug. | 5 |
| **`b6ddbdf`** „Update: Karten und Routen" | **18. Aug.** | **0** |
| alle folgenden bis `8ccc9ad` | 18.–20. Aug. | 0 |

`b6ddbdf` ist derselbe Commit, der `baue-sammelpunkte-handkuriert.py` umstellte
(65 geänderte Zeilen, u.a. das Entfernen der Sammelpunkt-Koordinaten wie
`"Unbestimmt (Kapitel 03)"`). Seit dem 18. August 2026 erzeugt die Pipeline
keine Sammelpunkt-`ortRuns` mehr — die Anzeige war ab da leer. Das war **sechs
Tage nach** dem `ortBasis`-Umbau (`11153ee`, 12. Aug.) und von ihm unabhängig;
die in Schritt 6 vermutete gemeinsame Ursache trifft für die Präfix-Kategorien
also nicht zu.

Die Beobachtung, dass der Sammelpunkt-Kreis auch auf der Live-Seite v2 nicht
mehr zu sehen war, stammt aus der Projektleitung und deckt sich mit diesem
Befund; sie wurde hier nicht eigens nachgeprüft (kein Zugriff auf die
veröffentlichte Fassung).

### Was wurde entfernt

| Datei | Zeilen (vorher) | Element |
|---|---|---|
| `kreisgrafik.js` | 82–100 | Kommentarblock, `SAMMELPUNKT_KATEGORIEN`, `sammelpunktKategorie()` |
| `kreisgrafik.js` | 112 | `let keineAdresseNachKategorie = new Map()` |
| `kreisgrafik.js` | 130–145 | Sammel-Zweig `if (kategorie) { … }` samt Kommentar |
| `kreisgrafik.js` | 182–184 | Aufruf `zeichneOrteOhneAdresse(...)` am Funktionsende |
| `kreisgrafik.js` | 187–224 | `zeichneOrteOhneAdresse()` samt Kommentarblock |
| `kreisgrafik.js` | 31–32, 45 | Header: `orteOhneAdresse`-Abhängigkeit, Zugriff aus `annotationsbox.js` |
| `annotationsbox.js` | 21, 86 | Header-Abhängigkeit und `if (sammelpunktKategorie(r.ort)) return;` |
| `sketch.js` | 74 | Deklaration `let orteOhneAdresse` |
| `sketch.js` | 233 | `document.getElementById('orteOhneAdresse')` in `setup()` |
| `sketch.js` | 674–682 | Sichtbarkeits-Toggle und Andocken der Box in `draw()` |
| `index.html` | 61 | `<div class="orte-ohne-adresse" id="orteOhneAdresse">` |
| `style.css` | 579–603 | Kommentar, `.orte-ohne-adresse`, `.orte-ohne-adresse.sichtbar` |

Der `else`-Zweig in `zeichneKreiseOrtRuns()` — das eigentliche Zeichnen der
Kartenkreise — ist damit der einzig verbliebene Pfad und wurde um eine Ebene
ausgerückt. `leereBandCounts()` **bleibt**: die Funktion wird ausserhalb
weiterhin von `ortsveraenderung.js` (Zeilen 263, 283) gebraucht.

**Nicht angefasst:** `baue-sammelpunkte-handkuriert.py`. Das Skript baut
`ortBasis`/`ortRuns`/`routenPunkte` für alle Kapitel und ist unabhängig von der
entfernten Anzeige weiterhin in Betrieb; nur sein erklärender Hinweis auf die
JS-Mechanik ist jetzt historisch.

### Prüfungen

- **Referenzprüfung vor dem Löschen:** `sammelpunktKategorie`,
  `zeichneOrteOhneAdresse`, `SAMMELPUNKT_KATEGORIEN`, `orteOhneAdresse`,
  `orte-ohne-adresse`, `keineAdresseNachKategorie` — alle Fundstellen in `.js`,
  `.html` und `.css` erfasst und oben aufgeführt. `leereBandCounts` als einziger
  weiterhin gebrauchter Nachbar identifiziert und stehen gelassen.
- **Verhalten:** Die **entfernte** Verzweigung wurde vor dem Löschen aus
  `HEAD:kreisgrafik.js` extrahiert und in JavaScriptCore gegen die echten
  `ortRuns` aller 18 Kapitel ausgeführt: **159 von 159** ortRuns liefen in den
  behaltenen Karten-Zweig, **0** in den entfernten Sammelbecken-Zweig. Das
  Auflösen des `if`/`else` ist damit verhaltensneutral.
- **Spine unverändert:** `baueSpineDaten()` liefert über alle 18 Kapitel
  weiterhin exakt dieselben Einträge wie vor Schritt 6 (Kapitel 1: 18).
- **Syntax:** alle **zwölf** in `index.html` geladenen Skripte parsen
  fehlerfrei (JavaScriptCore, `new Function(quelltext)`).
- **Restreferenzen:** null Treffer für sämtliche entfernten Namen.

**Am sichtbaren Verhalten ändert sich nichts** ausser dem Wegfall des seit dem
18. August 2026 ohnehin leeren Sammelpunkt-Kreises.

---

## Schritt 8 — Verwaistes CSS des DOM-Spine-Panels entfernt

**Datum:** 20. August 2026
**Datei:** `style.css`
**Ausgangsfassung:** Commit `6b8d3fe`
**Ergebnis:** 1063 → 998 Zeilen — 65 Löschungen, keine Einfügung

Abschluss des in [Schritt 1](#schritt-1--toter-spine-timeline-code-entfernt)
notierten Folgebefunds zu den verwaisten Spine-Klassen.

### Der Fund: älter und grösser als die Notiz aus Schritt 1

Die Notiz aus Schritt 1 hielt fest, dass `.spine-timeline`, `.spine-linie`,
`.spine-entry` (plus `.aktiv`, `.spalte-gedanke`, `.spalte-markierung`) in
`style.css:392–427` „seither" verwaist seien — also seit dem Entfernen von
`baueSpineTimeline()`/`fuegeSpineEintragHinzu()`. Die Neuprüfung korrigiert das
in zwei Punkten.

**Erstens: der Umfang war grösser.** Zum verwaisten Bereich gehörten auch
`.spine-panel` und `.spine-heading`, die in der Notiz fehlten — zusammen der
komplette Abschnitt 6 „Spine-Panel (Graph-Ansicht)". Hätte man nur die sechs
notierten Klassen entfernt, wäre eine Abschnittsüberschrift mit zwei
verwaisten Regeln stehen geblieben.

**Zweitens: das Panel war nie in Betrieb — nicht erst seit Schritt 1, sondern
seit dem Initial Commit dieses Repos.** Im Initial Commit `fa1212e` gilt:

- `baueSpineTimeline()` war zwar definiert (`sketch.js:631`), wurde aber
  **nirgends aufgerufen**.
- Die darin verwendeten Variablen `spineTimeline`, `spineLinie` und
  `spineEintraege` waren **nirgends deklariert** (die ähnlich heissenden
  `spineEintraegep5`/`spineEintraegeKapitel` sind die Canvas-Datenhalter der
  horizontalen Spine und haben damit nichts zu tun).
- `index.html` enthielt **kein einziges Spine-Element**.

Ein Aufruf hätte also sofort einen `ReferenceError` geworfen. Das vertikale
DOM-Spine-Panel ist ein Überbleibsel aus v2, bei dem Code und CSS mit ins
Projekt kamen, das Markup aber nicht. Schritt 1 hat davon die Funktionshülle
entfernt, Schritt 8 jetzt das CSS.

**Methodischer Hinweis:** `.spalte-gedanke`/`.spalte-markierung` wurden nie
literal im Quelltext gesetzt, sondern zusammengebaut —
`el.className = 'spine-entry' + (typ !== 'route' ? ' spalte-' + typ : '')`.
Eine wörtliche Suche nach `spalte-gedanke` findet deshalb auch in der Historie
nichts. Bei CSS-Aufräumarbeiten reicht die Suche nach dem vollständigen
Klassennamen nicht; nach Fragmenten (`'spalte-'`) muss mitgesucht werden.

### Was wurde entfernt

Abschnitt 6 vollständig, `style.css:332–394` samt Abschnittsüberschrift und den
beiden nachfolgenden Leerzeilen:

| Zeile (vorher) | Regel |
|---|---|
| 332–334 | Abschnittsüberschrift „6) Spine-Panel (Graph-Ansicht)" |
| 336 | `.spine-panel` |
| 350 | `.spine-heading` |
| 356 | `.spine-timeline` |
| 364 | `.spine-linie` |
| 373 | `.spine-entry` |
| 385 | `.spine-entry.aktiv` |
| 390–391 | `.spine-entry.spalte-gedanke`, `.spine-entry.spalte-markierung` |

**Bewusst stehen geblieben — kein Kollateralschaden:**

- **`.aktiv`** wird weiterhin gebraucht: `.kapitel-register-item.aktiv` und
  `.kapitel-register-modus-item.aktiv` (jetzt Zeilen 453 und 493), gesetzt aus
  `sketch.js` (`classList.toggle('aktiv', …)`). Nur die kombinierten Selektoren
  mit `.spine-entry` fielen weg.
- **`.ortspunkt`** (jetzt Zeilen 291, 321) gehört zu den in
  [Schritt 5](#schritt-5--karten-marker-stillgelegt-statt-entfernt)
  stillgelegten Kartenmarkierungen, deren DOM-Knoten `dom-aufbau.js` weiterhin
  baut. Der entfernte Spine-Code hatte die Klasse nur mitbenutzt.

Die **Abschnittsnummerierung wurde nicht angepasst**: `style.css` hat bereits
Lücken bei 5 und 8 aus früheren Entfernungen. Eine weitere Lücke bei 6 folgt
damit der bestehenden Konvention; ein Durchnummerieren hätte alle folgenden
Überschriften ohne Nutzen verändert.

### Warum ersatzlos und nicht stillgelegt

Anders als bei den Kartenmarkierungen aus Schritt 5 gibt es hier keinen
Reaktivierungspfad: Funktion, Variablen und Markup fehlen alle, und die heutige
Graph-Ansicht (`spine-horizontal.js`) zeichnet ausschliesslich auf den
p5-Canvas — kein `classList`, kein `className`, kein `createElement`. Sie kann
von diesem CSS also gar nicht profitieren. Eine Rückkehr zum vertikalen Panel
wäre ein Neubau, dem 63 Zeilen altes CSS wenig helfen.

### Prüfungen

- **Referenzprüfung vor dem Löschen:** alle sieben Klassennamen projektweit in
  `.js`, `.html` und `.css` gesucht — Fundstellen ausschliesslich in
  `style.css`. `style.css` ist das einzige Stylesheet; `index.html` hat keinen
  `<style>`-Block (einziges `style=`-Attribut ist die Scrollhöhe der
  `.scroll-track`).
- **Dynamisch gebaute Klassennamen:** zusätzlich nach Fragmenten und
  Template-Literalen in `classList.add/toggle/remove` und `className`-
  Zuweisungen gesucht — keine Treffer im aktuellen Code.
- **Historie:** jeder Commit daraufhin geprüft, ob die Klassen je aus JS oder
  HTML gesetzt wurden. `.spine-entry`/`.spine-linie` nur bis `eff2b4d`
  (Schritt 1); `.spine-panel`, `.spine-heading`, `.spine-timeline` **nie**.
- **Restreferenzen:** null Treffer für alle sieben Namen.
- **Struktur:** Klammerbilanz ausgeglichen (99 `{` / 99 `}`), `var(--sans)`
  weiterhin 16-mal in Gebrauch, Nahtstelle folgt der Zwei-Leerzeilen-Konvention
  zwischen Abschnitten.
- **Diff:** ausschliesslich Löschungen — `1 file changed, 65 deletions(-)`.

**Am sichtbaren Verhalten ändert sich nichts** — die Regeln trafen seit dem
Initial Commit auf kein einziges Element im DOM.

---

## Schritt 9 — Irreführendes `OV_`-Präfix an drei Namen bereinigt

**Datum:** 20. August 2026
**Dateien:** `uebersichtsrouten.js`, `ortsveraenderung.js`
**Ausgangsfassung:** Commit `3754a90`
**Ergebnis:** 10 Einfügungen, 14 Löschungen — reine Umbenennung plus eine
gestrichene Kommentarnotiz

### Der Fund

Drei Namen in `uebersichtsrouten.js` trugen das Präfix `OV_`/`ov`, das im
Projekt für den Schlussakt „Ortsveränderung" steht — sie gehören aber zu
`kapitelScheiben()`/`kapitelHitze()` im Übersichtsrouten-Akt. Die
Modularisierung hatte sie deshalb bewusst **nicht** nach `ortsveraenderung.js`
verschoben (siehe `docs/modularisierung-log.md`, Modul 2), das falsche Präfix
aber stehen lassen.

Der Preis dafür stand in `ortsveraenderung.js`: eine dreizeilige Notiz im
Dateikopf, die einzig existierte, um die Nichtzugehörigkeit zu erklären — und
deren Ortsangabe („sind in sketch.js geblieben") nach der Modularisierung
ohnehin überholt war.

### Was wurde umbenannt

| alt | neu | Vorkommen |
|---|---|---|
| `OV_SCHEIBE_GRUNDANTEIL` | `KAPITEL_SCHEIBE_GRUNDANTEIL` | 3 (Zeilen 87, 96, 97) |
| `OV_NACHGLUEHEN` | `KAPITEL_NACHGLUEHEN` | 3 (Zeilen 104, 123, 128) |
| `ovScheiben` | `scheibenCache` | 5 (Zeilen 88, 91 ×2, 112, 113) |

Dazu ersatzlos gestrichen: die Notiz in `ortsveraenderung.js:29–31` samt
zugehöriger Leerzeile. Sie ist mit dem Präfix gegenstandslos geworden — das
ist der eigentliche Gewinn der Umbenennung: der Kommentar musste nicht
korrigiert werden, er entfällt.

### Warum `scheibenCache` und nicht `kapitelScheibenCache`

Der naheliegende Name hätte `kapitelScheiben` als Teilstring enthalten, womit
eine Suche nach der Funktion `kapitelScheiben` auch den Cache gefunden hätte.
Nach mehreren Schritten, deren Sicherheit ausschliesslich auf grep-basierten
Referenzprüfungen beruhte (siehe u.a. den methodischen Hinweis in
[Schritt 8](#schritt-8--verwaistes-css-des-dom-spine-panels-entfernt)), ist
Trennschärfe bei der Namenswahl ein handfester Wert, kein Stilfrage.

`scheibenCache` erfüllt drei Bedingungen:

- **Grep-eindeutig** — kein gemeinsames Token mit `kapitelScheiben`. Eine Suche
  nach `kapitelScheiben` liefert jetzt ausschliesslich Funktion und Aufrufer.
- **Folgt der Hauskonvention** für Caches, `<Gegenstand>Cache`:
  `annotationBoxPlatzCache` (`annotationsbox.js:60`), `spineLayoutCache`
  (`spine-horizontal.js:176`).
- **Nicht unterspezifiziert** — „Scheibe" hat projektweit genau eine Bedeutung.
  Ausserhalb von `uebersichtsrouten.js` kommt der Begriff nur in `sketch.js`
  (Zeilen 761–778) für dieselbe Sache vor.

Ausgeschlossen wurde `uebersichtScheiben`: der Name ist bereits als lokale
Variable in `sketch.js:766` vergeben; ein global fast gleich heissender Name
hätte eine neue Verwechslung geschaffen statt einer beseitigten.

Bei `KAPITEL_NACHGLUEHEN` wurde `SCHEIBE_NACHGLUEHEN` erwogen — der Wert ist
streng genommen ein Anteil *einer Scheibe* (`breite * KAPITEL_NACHGLUEHEN`),
nicht eines Kapitels. Den Ausschlag gab, dass das Nachglühende tatsächlich das
Kapitel ist (Route und Badge) und dass das Präfixpaar mit
`KAPITEL_SCHEIBE_GRUNDANTEIL` zusammenhält.

### Prüfungen

- **Verhalten identisch:** `kapitelScheiben()` und `kapitelHitze()` wurden im
  Original in JavaScriptCore ausgeführt — gegen die echten Routendaten aus
  `kapitel-routen-uebersicht.json`, vor und nach der Umbenennung. Verglichen
  wurden die **17 Scheibengrenzen** (`von`/`bis` je Kapitel, volle Präzision)
  und **3417 `kapitelHitze()`-Stützstellen** (201 Abtastpunkte je Scheibe):
  **byte-identisch**. Auch die Cache-Identität (`kapitelScheiben() ===
  kapitelScheiben()`) gilt unverändert.
- **Syntax:** alle zwölf in `index.html` geladenen Skripte parsen fehlerfrei
  (JavaScriptCore, `new Function(quelltext)`).
- **Restreferenzen:** null Treffer für `OV_SCHEIBE_GRUNDANTEIL`,
  `OV_NACHGLUEHEN` und `ovScheiben` in allen `.js`-, `.html`- und
  `.css`-Dateien.
- **Vorkommenszählung:** vor dem Ersetzen je Name gegen eine erwartete Anzahl
  geprüft. Der erste Lauf brach dabei ab (`ovScheiben`: 5 statt 4 erwartet) —
  Zeile 91 enthält den Namen zweimal (`if (ovScheiben) return ovScheiben;`).
  Die Datei blieb dabei unverändert; erst nach Korrektur der Erwartung wurde
  geschrieben.

**Nicht angefasst:** `docs/modularisierung-log.md` und
`docs/code-analyse-sketch-js.md` nennen die alten Namen an neun Stellen. Beide
sind historische Protokolle des damaligen Stands und werden nicht rückwirkend
umgeschrieben.

---

## Schritt 10 — Herkunft von `ch1ImgBbox` dokumentiert

**Datum:** 20. August 2026
**Datei:** `geo-projektion.js`
**Änderung:** 27 Einfügungen, 0 Löschungen — **ausschliesslich Kommentar**,
kein Wert angefasst

### Anlass

Eine erneute Prüfung der beiden `.pgw`-Weltdateien zu `kapitel01-qgis-karte.png`
(in `d69a78b` gelöscht, für die Prüfung kurz aus der Historie geholt und danach
wieder verworfen) sollte eine früher notierte Abweichung von rund 490 m an der
Nordgrenze von `ch1ImgBbox` klären.

### Ergebnis: `ch1ImgBbox` ist korrekt, die Weltdateien sind veraltet

Die 490 m bestätigen sich rechnerisch (−498,4 m), sind aber nicht der
eigentliche Befund. Gegen `kapitel01-qgis-karte 2.pgw` (EPSG:3857, die
massgebliche der beiden — die andere ist eine fehlerhafte Grad-Umrechnung, die
die cos(Breite)-Korrektur auf beide Achsen statt nur auf die Breite anwendet):

| Kante | World-File | Code | Δ Meter |
|---|---|---|---|
| west | 2,300502858 | 2,317834414 | +1269,0 |
| east | 2,338633875 | 2,352393886 | +1007,5 |
| south | 48,869759568 | 48,866833389 | −325,7 |
| north | 48,886348500 | 48,881871498 | **−498,4** |

Der Code-Ausschnitt ist gleichmässig 90,6 % so breit **und** so hoch wie der
des Weltfiles, sein Mittelpunkt liegt 1138 m östlich und 412 m südlich. Eine
uniforme Skalierung plus Verschiebung ist keine Georeferenz-Abweichung, sondern
ein anderes Kartenfenster — die `.pgw`-Dateien gehören zu einem früheren
Exportstand, genau wie `d69a78b` beim Löschen vermerkte.

Entschieden hat die Gegenprobe am Fixpunkt, dieselbe Methode, die der
Kommentarblock über `startBbox` für die Place de l'Étoile beschreibt. Die
echten Kapitel-1-Koordinaten wurden unter beiden Hypothesen auf
`kapitel01-qgis-karte-web.png` (4783 × 3164) projiziert:

- **Mit `ch1ImgBbox`:** Place de la Madeleine trifft den Platz zwischen
  Boulevard Malesherbes, Rue Royale und Rue Boissy d'Anglas; Place de l'Opéra
  trifft das Opernhaus zwischen Rue Scribe, Rue Gluck und Rue Auber. Alle 18
  `ortRuns` liegen im Bild.
- **Mit dem Weltfile-Ausschnitt:** dieselben Punkte landen rund 1,5 km östlich
  — die Madeleine an der Rue Vivienne und unterhalb des Bildrands, die Opéra an
  der Rue du Croissant beim Bourse-Viertel.

Ein Seitenverhältnis-Test stützt das: `ch1ImgBbox` als Web Mercator gelesen
ergibt 1,511506 gegenüber 1,511694 des Bildes (Abweichung 1,24·10⁻⁴, rund
0,6 px über die Bildbreite); als Plate Carrée gelesen ergäbe sie 2,298 und
passte damit gar nicht.

**Es gab also nichts zu korrigieren.** Am Code wurde kein Wert verändert.

### Der verbliebene Befund: fehlende Herkunft

Rechnet man aus jeder der drei Bboxen den EPSG:3857-Ausschnitt zurück,
reproduziert das Verfahren bei `startBbox` und `uebersichtBbox` **exakt** die
in ihren Kommentaren notierten Zahlen. Bei `ch1ImgBbox` ergibt es
X 258020.147 .. 261867.290, Y 6252295.939 .. 6254841.177 — keine runden Werte.
Der Wert stammt also nicht aus einem in QGIS abgelesenen Ausschnitt, und wie er
entstanden ist, war nirgends festgehalten. Ein `kapitel01-bbox.json` gibt es
ebenfalls nicht; Kapitel 1 steht ausserhalb der Pipeline, die 02–18 erzeugt
(`schneide-kapitelkarten.py`).

### Was ergänzt wurde

Ein Kommentarblock über `ch1ImgBbox` im Format der beiden Nachbarn, der
festhält:

1. dass der QGIS-Ursprung **nicht überliefert** ist, samt der rückgerechneten
   Zahlen und der Begründung, warum sie keine abgelesenen Werte sein können;
2. dass der Wert am 20.08.2026 mit Madeleine und Opéra gegengeprüft und
   **korrekt** ist;
3. dass die `.pgw`-Dateien aus `data-prep/export` **nicht** zu diesem Bild
   gehören, mit dem Betrag der Abweichung — damit niemand sie aus der Historie
   holt und für eine Korrektur hält;
4. dass bei einem Neu-Export von `kapitel01-qgis-karte-web.png` die exakten
   QGIS-Koordinaten (X min/max, Y min/max in EPSG:3857) hierher gehören, im
   Format von `startBbox`/`uebersichtBbox`.

### Prüfungen

- **Werte unverändert:** `startBbox`, `uebersichtBbox` und `ch1ImgBbox`
  byte-identisch zu `HEAD` verglichen.
- **Diff:** 27 Einfügungen, 0 Löschungen; jede eingefügte Zeile ist eine
  Kommentar- oder Leerzeile.
- **Syntax:** `geo-projektion.js` parst fehlerfrei (JavaScriptCore).
- **Arbeitsverzeichnis:** die aus der Historie geholten `.pgw`-Dateien lagen
  nur im Scratchpad und wurden nach der Prüfung gelöscht; im Repo liegt keine
  `.pgw`-Datei.

### Nachtrag — Strukturvergleich mit dem `startBbox`-Fehler

Nachgereicht am 20. August 2026, weil der Verdacht bestand, es handle sich um
denselben Fehlertyp wie bei [Fix 2 im Bugfix-Log](bugfix-log.md) (Route auf der
Schlusskarte um 568 m versetzt). Der Vergleich widerlegt das eindeutig:

| | Breite | Höhe | Art der Abweichung |
|---|---|---|---|
| **`startBbox`-Bug (Fix 2)** | 100,000 % | 100,000 % | reiner Versatz: −567,7 m X, +115,7 m Y |
| **`ch1ImgBbox` vs. `.pgw`** | **90,63 %** | **90,65 %** | Massstabsänderung *und* Versatz: +1138 m Ost, −412 m Nord |

Bei `startBbox` war die Grösse des Kartenfensters **exakt** gleich und nur der
Ursprung falsch — die Signatur von „Werte vom falschen Bild übernommen". Bei
`ch1ImgBbox` ist das Fenster der Weltdatei gleichmässig 9,4 % grösser als das
des Codes. Ein falscher Referenzpunkt erzeugt keine Skalierung; es handelt sich
schlicht um einen **anderen Kartenausschnitt**, nicht um denselben mit falschem
Ursprung.

Auch die übrigen naheliegenden Fehlerarten scheiden aus: keine vertauschten
Achsen (beide Bboxen sind achsenrichtig), kein Rundungsfehler (die Beträge sind
drei Grössenordnungen zu gross), kein falscher Ursprung (dann fehlte die
Skalierung).

Eine Projektionsverwechslung gibt es allerdings — **in der Weltdatei, nicht im
Code**: `kapitel01-qgis-karte.pgw` (die Grad-Variante) ergibt 137,80 % Breite
bei 90,64 % Höhe. Diese Asymmetrie entsteht, weil dort die cos(Breite)-Korrektur
auf *beide* Achsen angewandt wurde statt nur auf die Breite. Massgeblich von den
beiden ist deshalb `kapitel01-qgis-karte 2.pgw` (EPSG:3857).

Fix 2 führte `ch1ImgBbox` bereits unter „Nicht betroffen — eigener Export, kein
Versatz feststellbar". Dieser Nachtrag bestätigt das unabhängig und mit Zahlen.

Die Weltdateien lagen zuletzt in Commit `fd2a423` vor und wurden in `d69a78b`
gelöscht; für den Vergleich wurden sie ausschliesslich über `git show` gelesen,
ohne Checkout und ohne Änderung am Arbeitsverzeichnis.

---

## Schritt 11 — Vier sicher tote Codestellen aus der Gesamtsuche entfernt

**Datum:** 20. August 2026
**Dateien:** `annotationsbox.js`, `ortsveraenderung.js`, `datenbereinigung.js`
**Ausgangsfassung:** Commit `370f06f`
**Ergebnis:** 8 Einfügungen, 35 Löschungen

### Fundquelle

Eine projektweite Suche nach totem und wirkungslosem Code über alle zwölf
JS-Dateien. Verfahren: 251 Top-Level-Deklarationen inventarisiert und auf
kommentarbereinigtem Quelltext referenzgezählt; 187 `if`-Bedingungen
instrumentiert und ihre Zweigabdeckung gemessen, während der Code die volle
Anwendung durchlief (300 Scrollpositionen, alle 18 Kapitel gezoomt in beiden
Ansichtsmodi, Play-Animation, Hover-Raster, vier Fensterbreiten). Die
Instrumentierung wurde vorher als verhaltenstreu geprüft.

Die Suche ergab vier **sicher** tote Stellen (unten), mehrere wahrscheinlich
tote (nicht angefasst, siehe „Nicht entfernt") und keine verwaisten
CSS-Regeln — letzteres das Ergebnis von [Schritt 8](#schritt-8--verwaistes-css-des-dom-spine-panels-entfernt).

### Was wurde entfernt

| Datei | Zeilen (vorher) | Element |
|---|---|---|
| `annotationsbox.js` | 53–55 | `const ANNOTATION_BOX_PLATZ_FEST = {}` samt Kommentar |
| `annotationsbox.js` | 63 | Wächterzeile `if (ANNOTATION_BOX_PLATZ_FEST[kapitelNr]) return …` |
| `ortsveraenderung.js` | 605 | Ternär-Zweig `: k.textSeite === 'links' ? false` |
| `ortsveraenderung.js` | 608 | `else if (k.textSeite === 'rechts-fix') …` |
| `datenbereinigung.js` | 430–451 | `versetzeKollidierendePunkte()` samt Kommentarblock |

**1. `ANNOTATION_BOX_PLATZ_FEST`** war als leeres Objektliteral deklariert,
projektweit nie beschrieben, und ihr einziger Lesezugriff war die
Übersteuerungs-Abfrage am Anfang von `annotationBoxPlatz()`. Der Wächter kann
strukturell nie wahr werden — dasselbe Muster wie `istParis` in
[Schritt 6](#schritt-6--nie-aktive-paris-sonderbehandlung-in-bauespinedaten-entfernt).
Gemessen: 1123 Auswertungen, 0 mal wahr.

**2./3. Die beiden toten `textSeite`-Zweige.** Die Tabelle der sieben
Ortsveränderungs-Knoten ist ein Literal in derselben Datei; ihre vollständige
Werteliste lautet `links-fix` (3×), `oben-fix` (2×), `rechts` (2×). Die Werte
`'rechts-fix'` und `'links'` kommen nicht vor. Gemessen: 70 Auswertungen des
`rechts-fix`-Zweigs, 0 mal wahr.

Der Ternär-Zweig (`'links'`) wurde von der `if`-Instrumentierung **nicht**
erfasst und kam nur beim Nachlesen der Fundstelle ans Licht. Daraus folgt für
künftige Suchen: Ternäre, `&&`/`||`-Kurzschlüsse und `.filter()`-Prädikate
bleiben mit diesem Verfahren unsichtbar; in dieser Klasse können weitere Fälle
stecken.

**4. `versetzeKollidierendePunkte()`** hatte projektweit keine einzige
Referenz — die einzige Funktion in dieser Lage, die kein p5-Lebenszyklus-Hook
ist. Ihr Kommentar wies sie selbst als „additiv, aktuell ungenutzt" aus, also
als bewusst vorgehaltenes Werkzeug. Sie wird auf ausdrückliche Anweisung
entfernt; wer sie zurückholen will, findet sie in diesem Commit.

Zusätzlich angepasst: der Kommentarblock über der Knotentabelle
(`ortsveraenderung.js:139–147`) dokumentierte `'rechts-fix'` und `'links'` als
gültige Werte. Er nennt jetzt die drei tatsächlich behandelten und hält fest,
dass die Gegenstücke entfernt wurden.

### Prüfungen

- **Referenzprüfung vor jeder Entfernung:** alle vier Namen projektweit in
  `.js`, `.html`, `.css`, `.md` und `.py` gesucht, Kommentare eingeschlossen.
  Ausser den oben genannten Fundstellen nur historische Erwähnungen in
  `docs/modularisierung-log.md` und `docs/code-analyse-sketch-js.md` (nicht
  angefasst) sowie der nachgezogene Kommentar.
- **Verhalten identisch — Zeichenspur:** Jeder Zeichenaufruf
  (`line`, `ellipse`, `text`, `fillText`, `fill`, `stroke`, …) wurde samt
  Argumenten protokolliert, während `zeichneOrtsveraenderung()` **101
  Aktpositionen in vier Fensterbreiten** durchlief — 28 656 Aufrufe, vorher und
  nachher **byte-identisch**. Dazu 72 Entscheidungen von `annotationBoxPlatz()`
  (18 Kapitel × 4 Fenstergrössen), ebenfalls unverändert. Das deckt genau die
  Ortsveränderungs-Ansicht ab, die von den Punkten 2 und 3 betroffen ist.
- **Integrationslauf:** alle zwölf Skripte laden in Ladereihenfolge ohne
  Top-Level-Fehler; 15 von 15 Funktionsprüfungen und 3 von 3 Härtetests
  fehlerfrei.
- **Syntax:** alle zwölf Skripte parsen fehlerfrei.
- **Restreferenzen:** null Treffer für alle vier Namen im Code.

### Nicht entfernt

Die als *wahrscheinlich* tot eingestuften Funde blieben unangetastet, weil ihre
Wirkungslosigkeit datenabhängig statt strukturell ist:
`istVorzeitigeErwaehnung()` (feuert 3800×, immer `false`),
`GEDANKEN_ORTRUN_UNTERDRUECKT` (greift an beiden Verwendungsstellen nie) und
der Wächter `!kapitelKarten[nr] && !KAPITEL_MIT_SPINE_PANEL.has(nr)`.
Ebenso das bewusst deaktivierte `KARTEN_MARKER_SICHTBAR` aus
[Schritt 5](#schritt-5--karten-marker-stillgelegt-statt-entfernt).

### Offener Folgebefund

**Die d3-Bibliothek wird nicht mehr gebraucht.** `versetzeKollidierendePunkte()`
enthielt mit `d3.group()` den **einzigen** d3-Aufruf im gesamten Projekt; nach
ihrer Entfernung ist `<script src="https://d3js.org/d3.v6.min.js">`
(`index.html:10`) eine Abhängigkeit ohne Nutzer. Die verbliebene Erwähnung in
`datenbereinigung.js:336` („Zählt per d3.rollup") ist ein Kommentar, dessen
Funktion längst mit reinem JavaScript arbeitet.

**Nicht angefasst** — das Entfernen einer externen Abhängigkeit ist eine eigene
Entscheidung. Wer sie trifft, sollte auch den irreführenden Kommentar in
Zeile 336 mitnehmen.

---

## Schritt 12 — NUL-Byte nachverifiziert, d3-Abhängigkeit entfernt

**Datum:** 20. August 2026
**Dateien:** `index.html`, `datenbereinigung.js`
**Ausgangsfassung:** Commit `07fa69e`
**Ergebnis:** 3 geänderte Zeilen, 1 gelöschte Zeile — keine Logikänderung

Arbeitet zwei Punkte einer „später"-Liste ab: das NUL-Byte in
`datenbereinigung.js` (Punkt A) und die vermutete ungenutzte d3-Abhängigkeit
(Punkt B, als offener Folgebefund in
[Schritt 11](#schritt-11--vier-sicher-tote-codestellen-aus-der-gesamtsuche-entfernt)
vermerkt).

### A) NUL-Byte — nachverifiziert, kein Fix nötig

Das Byte **existiert nicht mehr**; die Prüfung bestätigt nur, was
[Schritt 6](#schritt-6--nie-aktive-paris-sonderbehandlung-in-bauespinedaten-entfernt)
als Nebeneffekt bewirkt hat. Es sass im String-Literal
`'\x00PARIS_ALLGEMEIN'`, dem Pseudo-Schlüssel der nie erreichbaren
Paris-Sonderbehandlung; mit deren Entfernung fiel die ganze Zeile weg.

Belege der heutigen Nachprüfung:

- **Zeile 427 lautet heute** `  return eintraege;` — 19 Bytes reines ASCII,
  kein 0x00.
- **Kein NUL-Byte in irgendeiner versionierten Textdatei** (230 Dateien
  geprüft). Treffer gibt es nur in den 20 PNG-Dateien, wo Nullbytes normaler
  Bildinhalt sind.
- **Commit-genaue Zuordnung:** `46bd12c` enthielt noch 1 NUL-Byte, `8ccc9ad`
  (Schritt 6) und alle folgenden enthalten 0.
- **`grep` behandelt `datenbereinigung.js` wieder als Textdatei** — die
  binärsichere Sonderbehandlung aus dem Nachtrag zu Schritt 2 ist endgültig
  hinfällig.

**Kein neuer Fix.** Der Punkt gilt als geschlossen.

### B) d3 — bestätigt ungenutzt und entfernt

**Statische Suche.** Vier wörtliche `d3`-Vorkommen in JS/HTML, keines davon ein
Aufruf: das Script-Tag, zwei Kopfzeilen und der Kommentar bei Zeile 336. Keine
Destrukturierung, keine Umbenennung, kein `window.d3`/`globalThis.d3`, kein
Klammerzugriff `['d3']`, kein `import`/`require`. Die `d3`-Treffer in
`fotomarker.json` sind Zufallsfolgen in NAKALA-URLs (`…12d3cf…`, `…32d3dea…`),
keine Verwendung.

**Laufzeit-Beweis (Proxy-Test).** Statt sich auf die Textsuche zu verlassen,
wurde `d3` durch einen Proxy ersetzt, der bei **jedem** Property-Zugriff eine
Exception wirft und den Zugriff protokolliert:

```js
var d3 = new Proxy({}, { get: function (t, k) {
  _d3Zugriffe.push(String(k));
  throw new Error("d3." + String(k) + " wurde aufgerufen!");
} });
```

Damit lief die vollständige Anwendung in JavaScriptCore durch — 300
Scrollpositionen, alle 18 Kapitel in Karten- und Graph-Ansicht,
Play-Animation, vier Fensterbreiten:

```
15 von 15 Prüfungen fehlerfrei
3 von 3 Härtetests fehlerfrei
d3-Zugriffe während des gesamten Laufs: KEINE
```

Ein blosser Textfund hätte eine dynamische Verwendung übersehen können; der
Proxy schliesst sie aus.

**Historie.** `d3.group()` in `versetzeKollidierendePunkte()` war vom Initial
Commit `fa1212e` bis `d205887` (Schritt 11) der **einzige** d3-Aufruf im
Projekt. Mit dem Entfernen dieser Funktion verlor die Bibliothek ihren letzten
Nutzer.

### Was wurde geändert

| Datei | Zeile (vorher) | Änderung |
|---|---|---|
| `index.html` | 10 | `<script src="https://d3js.org/d3.v6.min.js">` **entfernt** |
| `datenbereinigung.js` | 336 | „Zählt (per d3.rollup), wie viele…" → „Zählt, wie viele…" |
| `datenbereinigung.js` | 2 | „Datenbereinigung (D3)" → „Datenbereinigung (reines JS)" |
| `datenbereinigung.js` | 4 | „→ Datenbereinigung (hier, D3) →" → „→ Datenbereinigung (hier, reines JS) →" |

Der Kommentar bei Zeile 336 war **schon vor heute falsch**: die Funktion, die er
beschreibt (`zaehleAnnotationenLiveNachOrtBasis`), zählt mit einem gewöhnlichen
`forEach`, nicht mit `d3.rollup`. Die beiden Kopfzeilen benannten die
Architekturstufe nach der Bibliothek und hätten nach deren Wegfall in die Irre
geführt.

Die Seite lädt jetzt zwei statt drei externe Bibliotheken (p5.js und Strudel);
ein Fremd-Origin weniger, auf den der Seitenaufbau wartet.

### Prüfungen

- **Restreferenzen:** null Treffer für `d3` (case-insensitive) in allen `.js`-,
  `.html`- und `.css`-Dateien.
- **Ladereihenfolge:** `index.html` lädt unverändert zwölf lokale Skripte.
- **Integrationslauf ohne jede d3-Attrappe:** alle zwölf Skripte laden ohne
  Top-Level-Fehler; 15 von 15 Funktionsprüfungen und 3 von 3 Härtetests
  fehlerfrei.
- **Diff:** eine gelöschte Zeile in `index.html`, drei geänderte Kommentarzeilen
  in `datenbereinigung.js` — keine Logikänderung.

### Nicht angefasst

Die Python-Pipeline in `data-prep/` ist von der Änderung unberührt; sie hat mit
der JS-seitigen d3-Einbindung nichts zu tun.

---

## Schritt 13 — `gedanken`-Feld bewusst behalten, Foto-Merker nach `fotomarker.js` verschoben

**Datum:** 20. August 2026
**Dateien:** `sketch.js`, `fotomarker.js`, `geo-projektion.js`
**Ausgangsfassung:** Commit `4378bb6`
**Ergebnis:** 20 Einfügungen, 26 Löschungen — reine Verschiebung, keine
Logikänderung

Arbeitet zwei weitere Punkte einer „später"-Liste ab. Der erste endet mit einer
begründeten **Nicht**-Entfernung.

### C) `stationenData.gedanken` — geprüft und bewusst behalten

Der Befund aus [Schritt 4](#schritt-4--gedanken-spalte-vollständig-entfernt)
lautete: das Feld hat keinen Leser mehr. Das stimmt für den Code — die einzige
Berührung ist die Normalisierung in `datenbereinigung.js:266`
(`rohdaten.gedanken = arrayFuer(rohdaten.gedanken)`), eine Schreiboperation
ohne Leser seit `a47fdd9`. Drei Befunde sprechen dennoch gegen ein Entfernen:

**1. Das Feld ist befüllt, mit redaktionellem Inhalt.** Nicht leer, wie
„verwaist" nahelegt:

| Datei | Einträge |
|---|---|
| `kapitel01-stationen.json` | 5 (Champs-Élysées/Bois de Boulogne, Afrika, Bois de Boulogne, Parc Monceau, imaginierter Sommergarten) |
| `kapitel03-stationen.json` | 4 (Canteleu, Militärzeit & Ankunft in Paris, Erträumtes Liebesabenteuer, Algerien) |
| Kapitel 02, 04–18 | `[]` |

**2. Die Kapitel-1-Einträge sind die Herkunft noch lebender Konstanten.** Die
fünf `gedanken[].ort`-Werte wurden gegen die Schlüssel von `GEDANKEN_FILTER`
geprüft: **identisch, alle fünf, keine Abweichung in beide Richtungen.** Die
Kette `gedanken[].ort` → `GEDANKEN_FILTER` → `GEDANKEN_ZIEL_ORT` ist der Grund,
warum gedachte Orte bei ihrem echten Schauplatz mitzählen, und
`GEDANKEN_ZIEL_ORT` ist aktiv (98 wahre Auswertungen in der Zweigmessung aus
[Schritt 11](#schritt-11--vier-sicher-tote-codestellen-aus-der-gesamtsuche-entfernt)).
Die vier Kapitel-3-Einträge sind in keiner Konstante abgebildet und wären
ersatzlos verloren.

**3. Die Pipeline schreibt das Feld aktiv.** `baue-kapitel-stationen.py:428`
und `baue-kapitel-stationen-aus-geojson.py:579` emittieren `"gedanken": []`;
`baue-sammelpunkte-handkuriert.py:46` führt es unter „Unangetastet bleiben".
Ein Entfernen aus den JSON-Dateien wäre beim nächsten Pipeline-Lauf rückgängig
gemacht.

**Ergebnis: nichts entfernt.** Auch die Normalisierungszeile bleibt — sie ist
eine von sechs gleichförmigen (`route`, `gedanken`, `markierungen`,
`routenPunkte`, `annotationen`, `ortRuns`); sie einzeln zu streichen macht den
Block uneinheitlich, spart nichts messbar und wäre falsch, sobald das Feld
wieder einen Leser bekommt.

### D) `letzterFotoOffsetX` / `letzterFotoOffsetY` — verschoben

Vorgemerkt im Modularisierungs-Log (Modul 6): der Umzug nach `fotomarker.js`
war seit der Auslagerung von `mapOffsetX`/`mapOffsetY` nach `geo-projektion.js`
möglich, aber nicht ausgeführt.

**Der Ausschlag gab die Nachbarschaft.** Die beiden Merker gehören zu einem
Trio, das in `draw()` gemeinsam geschrieben und in `mousePressed()` gemeinsam
gelesen wird — und das dritte Mitglied, `letzteActiveBbox`, **wohnte bereits in
`fotomarker.js`**. Der bisherige Zustand war also keine saubere Trennung,
sondern ein Schnitt mitten durch drei zusammengehörige Variablen.

| Datei | Zeile (vorher) | Änderung |
|---|---|---|
| `sketch.js` | 98–105 | Deklaration samt achtzeiligem Kommentar zum ausstehenden Umzug **entfernt** |
| `fotomarker.js` | 52 | Deklaration neben `letzteActiveBbox` eingefügt, mit gemeinsamem Kommentar |
| `fotomarker.js` | 30–36 | Absatz „NICHT hier: letzterFotoOffsetX / …" gestrichen — beschrieb das Gegenteil |
| `fotomarker.js` | 11–14 | Abhängigkeits-Header: `mapOffsetX/mapOffsetY` kommen aus `geo-projektion.js`, nicht aus `sketch.js` |
| `fotomarker.js` | 43–44 | Neuer Abschnitt „ACHTUNG: Auswertung beim LADEN" statt der Zusicherung, die Datei lese beim Laden nichts Fremdes |
| `geo-projektion.js` | 31 | Verweis „sketch.js wertet mapOffsetX beim Laden aus" auf `fotomarker.js` umgeschrieben |

Die letzte Header-Änderung ist die inhaltlich wichtigste: `fotomarker.js` hat
jetzt erstmals einen Top-Level-Initialisierer, der fremde Variablen liest. Das
trägt (Ladeposition 7 gegen 2), macht die Datei aber von der Reihenfolge
abhängig — dieselbe Konstruktion, die `kreisgrafik.js` bereits im Header
ausweist.

### Prüfungen

- **Startwerte identisch:** unmittelbar nach dem Laden, vor `setup()`/`draw()`,
  im alten wie im neuen Stand `letzterFotoOffsetX=-250`,
  `letzterFotoOffsetY=0`, `letzteActiveBbox=null`. `mapOffsetX`/`mapOffsetY`
  werden nirgends zur Laufzeit neu zugewiesen, der frühere Auswertungszeitpunkt
  ändert also nichts.
- **Verhalten byte-identisch:** vollständige Zeichenspur über **251
  Scrollpositionen** plus ein **37 × 23-Mausraster** über `mousePressed()` —
  also genau den Pfad, der die Merker liest. Protokolliert wurden alle
  Zeichenaufrufe mit Argumenten sowie bei jedem Mausschritt die aktuellen
  Merkerwerte: **135 639 Spurzeilen, byte-identisch** zwischen `HEAD` und dem
  neuen Stand.
- **Negativprobe zur Ladereihenfolge:** wird `fotomarker.js` versuchsweise
  **vor** `geo-projektion.js` geladen, bricht der Start mit
  `ReferenceError: Cannot access 'mapOffsetX' before initialization`. Der neue
  Header-Warnhinweis ist damit belegt, nicht dekorativ.
- **Integrationslauf:** alle zwölf Skripte laden in Ladereihenfolge ohne
  Top-Level-Fehler; 15 von 15 Funktionsprüfungen und 3 von 3 Härtetests
  fehlerfrei.
- **Syntax:** alle zwölf Skripte parsen fehlerfrei.
- **Restreferenzen:** `letzterFotoOffset` erscheint als Deklaration nur noch
  einmal, in `fotomarker.js`.

### Nicht angefasst

Der Foto-Teil von `mousePressed()` bleibt in `sketch.js`. Ihn zu verschieben
(etwa als `fotoMarkerUnterMaus()` im Modul) wäre eine Änderung am Kontrollfluss
und gehört in einen eigenen Schritt — so bereits im Modularisierungs-Log
vermerkt.

---

## Offener Punkt — Restspuren der Gedanken-Spalte, plus toter Meilenstein-Schlüssel

**Datum:** 24. August 2026
**Status:** notiert, nicht bearbeitet
**Aufräumen erst,** wenn `sketch.js` aus der aktiven Bearbeitung raus ist.

Aufgefallen beim Kommentar-Durchgang durch `datenbereinigung.js`. Zwei
voneinander unabhängige Sachen, hier nur zusammen notiert, weil sie im selben
Durchgang auftauchten.

### A) Kommentare beschreiben die Gedanken-Spalte noch als bestehend

Das Feature ist seit
[Schritt 4](#schritt-4--gedanken-spalte-vollständig-entfernt) (20. August 2026)
vollständig entfernt: kein DOM-Builder, keine CSS-Klasse, kein Element in
`index.html`. Ein Kommentar führt es weiterhin als vorhanden:

| Fundstelle | Wortlaut | Befund |
|---|---|---|
| `sketch.js:723` | „Kartenbezogene DOM-Overlays (Ortsmarker, **Gedanken-Spalte**, Karten-Markierungen, Annotation-Box)" | Zählt ein Overlay auf, das es nicht mehr gibt. **Einzige verbliebene Fundstelle im Code** |

Die übrigen sind inzwischen erledigt: drei in `datenbereinigung.js` (bei
`GEDANKEN_FILTER`, `GEDANKEN_ORTRUN_UNTERDRUECKT` und über `valenzBucket`)
sowie der Kopfblock von `dom-aufbau.js` — Letzterer beim Kürzen der Kommentare
am 24. August entfallen.

`docs/code-analyse-sketch-js.md:35` nennt `baueGedankenColumn()` ebenfalls
noch — das ist eine Bestandsaufnahme von vor der Bereinigung und beschreibt
korrekt den damaligen Stand. Nicht anzufassen.

**Nicht Teil dieses Punkts: `rohdaten.gedanken`.** Die Normalisierungszeile
(`datenbereinigung.js:176`) ist in [Schritt 13 C](#c-stationendatengedanken--geprüft-und-bewusst-behalten)
geprüft und **bewusst behalten** worden — das Feld ist redaktionell befüllt,
es ist die Herkunft der noch aktiven `GEDANKEN_FILTER`/`GEDANKEN_ZIEL_ORT`-Kette,
und die Python-Pipeline schreibt es weiterhin. Diese Entscheidung steht; sie
soll beim Aufräumen von A) nicht versehentlich mit aufgerollt werden.

### B) `kreisVergleichFadeEnd` hat keinen Leser

Unabhängig von der Gedanken-Spalte, gleicher Durchgang gefunden.

`SCROLL_MEILENSTEINE.kreisVergleichFadeEnd` (`0.750967`, `datenbereinigung.js:162`)
wird von keiner Stelle gelesen. Das Ausblenden der Übersichtskarte im
Schlussakt, das der Schlüssel laut seinem früheren Kommentar steuerte, läuft
über `OV_KARTE_AUS = [0.12, 0.32]` in `ortsveraenderung.js:56`, ausgewertet
in `draw()` als `ovPhase(ovFortschritt, OV_KARTE_AUS)`.

Der Kommentar an der Fundstelle ist bereits auf den Ist-Zustand gesetzt und
benennt den toten Schlüssel. Der Schlüssel selbst steht noch im Objekt —
Entfernen ist eine Code-Änderung und gehört in einen eigenen Schritt.

Zu klären dabei: `SCROLL_MEILENSTEINE` ist exportiert und wird in `sketch.js`
an 14 Stellen gelesen. Vor dem Entfernen ist zu prüfen, ob der Schlüssel
wirklich nirgends dynamisch adressiert wird.

---

## Zurückgezogen — `spieleKapitelSonifikationAudio` ist NICHT tot

**Datum:** 24. August 2026
**Status:** Befund war falsch, Eintrag zurückgezogen

Am 24. August als offener Punkt eingetragen, am selben Tag widerlegt.

Die Funktion existiert: `sonifikation.js:281`
(`async function spieleKapitelSonifikationAudio(nr)`), gerufen von
`spieleSonifikationFuer()` in `sonifikation.js:222`. Sie ist modulintern und
steht nicht im Exportblock — von `spine-horizontal.js` aus ist sie deshalb
nicht erreichbar, aber der Name stimmt.

**Ursache des Fehlbefunds:** eine `grep`-Ausgabe mit `head -2` gelesen und die
beiden angezeigten Kommentarzeilen für das vollständige Ergebnis gehalten. Die
Trefferzahl daneben zählte bereits die zwei echten Codestellen.

Was am ursprünglichen Eintrag bestehen bleibt, jetzt ohne die falsche Prämisse:

| Fundstelle | Befund | Status |
|---|---|---|
| `sonifikation.js:170` | Verweis auf `spieleKapitelSonifikationAudio` | Korrekt, kein Handlungsbedarf |
| `spine-horizontal.js:157` | nannte dieselbe Funktion als Tonquelle | Beim Kürzen der Kommentare entfallen. Der Verweis war insofern unglücklich, als der Name von dort nicht sichtbar ist — der Einstieg ist `spieleSonifikationFuer` |
| `sonifikation.js:309` | verortet `aktuelleGrafikAnimationDauer()` in `sketch.js` | **Falsch, steht noch.** Die Funktion liegt in `spine-horizontal.js:164` |
| `sonifikation.js:20` | führt `window.sonifikationSpieltAb` als bestehend | **Tot, steht noch.** Einziges Vorkommen im Projekt |

Die letzten beiden werden beim Kommentar-Durchgang durch `sonifikation.js`
mit erledigt.

---

## HOCHPRIORITÄR — Windrose: Farbpalette kollabiert, Norden nicht ausgezeichnet

**Datum:** 24. August 2026
**Datei:** `kartendekor.js`
**Status:** offen, betrifft aktiven Code — nicht nur Kommentare

Gefunden beim Kommentar-Durchgang. `zeichneWindrose()` deklariert fünf
Farbkonstanten, die auf nur zwei verschiedene Werte zeigen:

| Konstante | Wert | Helligkeit | Name passt? |
|---|---|---|---|
| `zinkgrau` | `#9DA69D` | 162 | ja |
| `schmiedeeisenSchwarz` | `#9DA69D` | 162 | **nein** — hellgrau bei einem Namen, der Schwarz verspricht |
| `kalksteinCreme` | `#212B2E` | 40 | **nein** — fast schwarz statt creme |
| `cafeRot` | `#212B2E` | 40 | **nein** — kein Rotanteil |
| `messingGold` | `#212B2E` | 40 | **nein** — kein Goldton |

### Sichtbare Folgen

**1. Der Nordzacken ist nicht ausgezeichnet.** `richtungenHaupt` gibt Nord
`cafeRot` und den drei übrigen `kalksteinCreme` — beide sind `#212B2E`. Alle
vier Hauptzacken rendern identisch:

```
Nord  links #212B2E  rechts #9DA69D
Ost   links #212B2E  rechts #9DA69D
Sued  links #212B2E  rechts #9DA69D
West  links #212B2E  rechts #9DA69D
```

Die eigene Konstante für Nord ist offensichtlich als Hervorhebung gedacht und
wirkungslos. Eine Windrose, die Norden nicht kenntlich macht, verfehlt ihren
Zweck.

**2. Auch die Nebenzacken sind gleich.** `messingGold`/`zinkgrau` ergibt
dieselbe Kombination — alle acht Zacken sehen gleich aus.

**3. Der Rand des Zentrums ist unsichtbar.** `stroke(messingGold)` und
`fill(kalksteinCreme)` tragen denselben Wert, das `strokeWeight(1)` ist inert.

### Nicht entschieden

Ob die Werte verlorengegangen sind oder die Palette bewusst auf zwei Töne
reduziert wurde und nur die Namen stehenblieben. Für Letzteres spricht, dass
das Ergebnis in sich stimmig zweifarbig ist; dagegen spricht die eigene
Nord-Konstante, die dann keinen Zweck mehr hätte.

Ein Kommentar in `kartendekor.js` räumte den Zustand halb ein
(„schmiedeeisenSchwarz/zinkgrau sind inzwischen helle Zacken-Farben") — beim
Kürzen entfallen, der Befund steht dafür hier.

### Zu tun

Entscheiden, ob Norden farblich hervorgehoben werden soll. Danach entweder die
echten Farbwerte wiederherstellen oder die Konstanten auf zwei ehrlich benannte
reduzieren (etwa `zackeDunkel` / `zackeHell`). Beides ist eine Code-Änderung
und gehört in einen eigenen Schritt.

---

## BUG — Foto-Popup öffnet in der Graph-Ansicht, wo kein Marker sichtbar ist

**Datum:** 24. August 2026
**Dateien:** `fotomarker.js`, `sketch.js`
**Status:** offen, reproduzierbar — betrifft aktiven Code

In der Graph-Ansicht werden keine Foto-Marker gezeichnet, ihr Treffertest läuft
aber weiter. Ein Klick auf die Stelle, an der ein Marker auf der Karte läge,
öffnet dessen Popup — über der Spine-Darstellung, die dort eigentlich alles
abdeckt.

### Ursache: eine Asymmetrie in `draw()`

| Zeile | Aufruf | Bedingung |
|---|---|---|
| `sketch.js:858` | `merkeKartenlage(activeBbox, fotoOffsetX, fotoOffsetY)` | **unbedingt** |
| `sketch.js:865` | `zeichneFotoMarker(...)` | nur `if (!inKapitelGrafikAnsicht)` |

`merkeKartenlage()` hält `letzteActiveBbox` und die beiden Offsets damit auch
in der Graph-Ansicht frisch. `mousePressed()` prüft dann nur, ob überhaupt eine
Bbox vorliegt:

```js
sketch.js:889   if (!letzteActiveBbox) return;
sketch.js:892   let pos = lonLatToScreen(f.lon, f.lat, letzteActiveBbox, …);
```

Der Ansichtsmodus wird nirgends abgefragt. Die Trennung ist bewusst gebaut —
`merkeKartenlage()` ist eigens von `zeichneFotoMarker()` abgespalten, damit der
Merker beim Ausblenden nicht einfriert —, aber die Folge für den Treffertest
wurde nicht mitgezogen.

### Reproduktion

1. Ein Kapitel öffnen, auf "Graph" umschalten
2. Auf eine Bildschirmstelle klicken, an der in der Plan-Ansicht ein
   Foto-Sternchen sitzt
3. Das Popup öffnet sich, obwohl dort kein Marker zu sehen ist

### Zu tun

Den Treffertest in `mousePressed()` an den Ansichtsmodus binden — dieselbe
Bedingung wie beim Zeichnen (`!inKapitelGrafikAnsicht`). Der Foto-Teil von
`mousePressed()` liegt in `sketch.js`; die Änderung gehört dorthin, nicht nach
`fotomarker.js`.

Der Befund stand bis zum 24. August als Fliesstext in `fotomarker.js` bei
`merkeKartenlage()` („Falls das nicht gewollt ist, gehört der Test dorthin") und
ist beim Kürzen der Kommentare zu einer `ACHTUNG`-Warnung verdichtet worden.
