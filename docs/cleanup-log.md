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

**NUL-Byte in `datenbereinigung.js`, jetzt Zeile 427** (vor diesem Nachtrag
Zeile 438) — im String-Literal `'\x00PARIS_ALLGEMEIN'` innerhalb von
`zaehleAnnotationenLiveNachOrtBasis()`.

Bewusst **nicht** angefasst; wird separat betrachtet. Bis dahin gilt für alle
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
