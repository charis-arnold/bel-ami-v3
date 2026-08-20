/* =============================================================================
   dom-aufbau.js — Aufbau der HTML-Bedienelemente

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Alles, was
   beim Start EINMAL an DOM-Knoten erzeugt wird: das Kapitelregister links
   (Plan/Graph, "Alle", Kapitel 01–18), der Legendeninhalt rechts, die
   Gedanken-Spalte und die drei Marker-Ebenen der Kapitel-1-Ansicht. Dazu der
   Akkordeon-Umschalter der beiden Register.

   Hier wird nur GEBAUT, nicht gezeichnet und nicht positioniert: Die Knoten
   bekommen ihre Bildschirmposition erst später in draw(), das dafür
   lonLatToScreen() aus geo-projektion.js nutzt. Diese Datei selbst greift
   nirgends auf die Geo-Projektion zu.

   --- Abhängigkeiten NACH AUSSEN (alle erst zur Laufzeit) -------------------
   aus sketch.js (26):
     DOM-Wurzeln       gedankenColumn, kartenMarkierungenEl, kapitelRegister,
                       legendeInhalt, registerTabs
     erzeugte Knoten   modusZeile, planEintrag, graphEintrag, leerzeile,
                       alleEintrag, kapitelRegisterEintraege, legendeValenzText,
                       legendeValenzKreis, legendeFwertHinweis
     gefüllte Listen   gedankenEintraege, markierungsEintraege, stationsMarker,
                       zwischenMarker
     Konstanten        WEITERE_KAPITEL_NUMMERN, LEGENDE_VALENZ_KARTE,
                       LEGENDE_FWERT_KARTE, FWERT_PUNKT_DURCHMESSER
     Navigation        scrolleZuKapitel1, springeZuKapitelZoom,
                       springeZurUebersicht
     Daten             stationenData
   aus datenbereinigung.js: KREIS_KATEGORIEN, CATEGORY_LABELS, FWERT_PUNKT_FARBE
   aus spine-horizontal.js: setzeKapitelAnsichtModus (Plan/Graph-Umschalter)

   Keine Zugriffe auf geo-projektion.js, kartendekor.js, ortsveraenderung.js,
   fotomarker.js, annotationsbox.js oder sonifikation.js.

   --- Wer von aussen hierher greift ----------------------------------------
   setup()  ruft die sechs baue*-Funktionen und hängt oeffneRegister an die
            Klick-Listener der beiden Registertabs

   Der Zustand ist geteilt, nicht gekapselt: Die hier gefüllten Listen und
   Element-Referenzen liegen weiterhin in sketch.js und werden dort von draw()
   je Frame gelesen. Bei einer Umstellung auf ES-Module müssten diese
   Variablen mitwandern oder über Rückgabewerte übergeben werden.

   Wird in index.html VOR sketch.js geladen. Kein Top-Level-Initialisierer —
   die Datei enthält ausschliesslich Funktionsdeklarationen.
============================================================================= */

// Öffnet EIN Register (Legende ODER Prolog) exklusiv (Akkordeon: das jeweils
// andere schliesst automatisch mit) und markiert den Zustand zusätzlich am
// gemeinsamen #registerTabs-Container. Daran hängt in style.css die Regel,
// die den TAB (nicht den Inhalt) des GESCHLOSSENEN Registers an dieselbe
// Kante mit ausfahren lässt wie das gerade geöffnete — sonst bliebe er am
// Bildschirmrand stehen, während der geöffnete Tab zur Inhaltskante
// wandert, und die beiden Tabs würden optisch auseinanderreissen.
function oeffneRegister(box, andererBox, eigeneKlasse, andereKlasse) {
  const warOffen = box.classList.contains('offen');
  box.classList.toggle('offen', !warOffen);
  andererBox.classList.remove('offen');
  registerTabs.classList.toggle(eigeneKlasse, !warOffen);
  registerTabs.classList.remove(andereKlasse);
}

function baueGedankenColumn() {
  stationenData.gedanken.forEach(g => {
    let el = document.createElement('div');
    el.className = 'gedanken-entry';
    let dot = document.createElement('div');
    dot.className = 'ortspunkt';
    let label = document.createElement('span');
    label.textContent = g.ort;
    el.appendChild(dot);
    el.appendChild(label);
    gedankenColumn.appendChild(el);
    gedankenEintraege.push({ el, dot, ort: g.ort, nachStation: g.nachStation });
  });
}

// Kapitelregister (linker Rand). Oben drei feste Einträge (ersetzen den
// ehemaligen ansicht-wechseln-btn oben rechts):
//   - "Plan"/"Graph" (eine Zeile, zwei Hälften): setzt kapitelAnsichtsModus
//     direkt auf 'karte' bzw. 'grafik' (siehe setzeKapitelAnsichtModus) für
//     die gerade offene Kapitel-Ansicht.
//   - Leerzeile als Abstandshalter.
//   - "Alle": verlässt jede offene Kapitel-Ansicht zurück auf die neutrale
//     Übersichtskarte (springeZurUebersicht).
// Danach ein Eintrag je Kapitel, 01–18 lückenlos. 01 hat kein
// kapitelKarten-Pendant, eigenes System — springt per scrolleZuKapitel1()
// zurück in die Hauptgeschichte statt in einen Kapitel-Zoom. Alle anderen
// (inkl. 03, das in WEITERE_KAPITEL_NUMMERN fehlt, da eigene Datenquelle
// kapitel03Data) springen per springeZuKapitelZoom(nr) — die Funktion hat
// einen eigenen Sicherheits-Guard und tut bei fehlenden Daten einfach nichts.
function baueKapitelRegister() {
  modusZeile = document.createElement('div');
  modusZeile.className = 'kapitel-register-modus-zeile';

  planEintrag = document.createElement('button');
  planEintrag.type = 'button';
  planEintrag.className = 'kapitel-register-modus-item';
  planEintrag.textContent = 'Plan';
  planEintrag.addEventListener('click', () => setzeKapitelAnsichtModus('karte'));
  modusZeile.appendChild(planEintrag);

  graphEintrag = document.createElement('button');
  graphEintrag.type = 'button';
  graphEintrag.className = 'kapitel-register-modus-item';
  graphEintrag.textContent = 'Graph';
  graphEintrag.addEventListener('click', () => setzeKapitelAnsichtModus('grafik'));
  modusZeile.appendChild(graphEintrag);

  kapitelRegister.appendChild(modusZeile);

  leerzeile = document.createElement('div');
  leerzeile.className = 'kapitel-register-leerzeile';
  kapitelRegister.appendChild(leerzeile);

  alleEintrag = document.createElement('button');
  alleEintrag.type = 'button';
  alleEintrag.className = 'kapitel-register-item';
  alleEintrag.textContent = 'Alle';
  alleEintrag.addEventListener('click', springeZurUebersicht);
  kapitelRegister.appendChild(alleEintrag);

  let alleNummern = ['01', '03', ...WEITERE_KAPITEL_NUMMERN].sort();

  alleNummern.forEach(nr => {
    let eintrag = document.createElement('button');
    eintrag.type = 'button';
    eintrag.className = 'kapitel-register-item';
    eintrag.textContent = 'Kapitel ' + parseInt(nr, 10);
    eintrag.addEventListener('click', nr === '01' ? scrolleZuKapitel1 : () => springeZuKapitelZoom(nr));
    kapitelRegister.appendChild(eintrag);
    kapitelRegisterEintraege[nr] = eintrag;
  });
}

// Legende (mitte rechts, sichtbar in Plan- UND Graph-Ansicht, siehe
// draw()) — Farberklärung der Kreisgrafik (zeichneKreiseFuerRun). Inhalt aus
// KREIS_KATEGORIEN/CATEGORY_LABELS (datenbereinigung.js) gebaut statt hart
// codiert, damit Legende und tatsächliche Kreisfarben nie auseinanderlaufen.
// Erklärt beide Bild-Ebenen einzeln: die schraffierte Gesamtfläche (alle
// Erwähnungen der Kategorie, auch neutrale/unbewertete) und die vollflächigen
// Halbkreise (nur negativ/positiv bewertete, per fester Position links/rechts
// unterschieden — NICHT per Farbe, siehe "Kreise"-Kommentar bei
// zeichneKreiseFuerRun).
function baueLegende() {
  let titel = document.createElement('div');
  titel.className = 'legende-titel';
  titel.textContent = 'Legende';
  legendeInhalt.appendChild(titel);

  KREIS_KATEGORIEN.forEach(k => {
    let zeile = document.createElement('div');
    zeile.className = 'legende-zeile';

    let kreis = document.createElement('span');
    kreis.className = 'legende-kreis';
    kreis.style.setProperty('--legende-farbe', `rgb(${k.farbe.join(', ')})`);
    zeile.appendChild(kreis);

    let label = document.createElement('span');
    label.className = 'legende-label';
    label.textContent = CATEGORY_LABELS[k.key] || k.key;
    zeile.appendChild(label);

    legendeInhalt.appendChild(zeile);
  });

  let hinweisSchraffur = document.createElement('p');
  hinweisSchraffur.className = 'legende-hinweis';
  hinweisSchraffur.textContent = 'Schraffur: alle Erwähnungen der Kategorie (auch neutral/unbewertet). Kreisgrösse = Anzahl.';
  legendeInhalt.appendChild(hinweisSchraffur);

  let valenzZeile = document.createElement('div');
  valenzZeile.className = 'legende-valenz';

  let valenzKreis = document.createElement('span');
  valenzKreis.className = 'legende-valenz-kreis';
  let beispielFarbe = KREIS_KATEGORIEN.find(k => k.key === 'gold_mittel') || KREIS_KATEGORIEN[0];
  valenzKreis.style.setProperty('--legende-farbe', `rgb(${beispielFarbe.farbe.join(', ')})`);
  valenzZeile.appendChild(valenzKreis);

  let valenzText = document.createElement('span');
  valenzText.className = 'legende-valenz-text';
  valenzText.textContent = LEGENDE_VALENZ_KARTE;
  valenzZeile.appendChild(valenzText);
  // Für die Umschaltung Plan/Graph merken: die Halbkreise stehen in der
  // Graph-Ansicht oben/unten statt links/rechts (siehe
  // zeichneSpineHorizontal), die Legende muss das mitmachen — sie ist in
  // BEIDEN Ansichten sichtbar.
  legendeValenzText = valenzText;
  legendeValenzKreis = valenzKreis;

  legendeInhalt.appendChild(valenzZeile);

  let neutralZeile = document.createElement('div');
  neutralZeile.className = 'legende-valenz legende-valenz-mehr';

  let neutralKreis = document.createElement('span');
  neutralKreis.className = 'legende-valenz-kreis-voll';
  neutralKreis.style.setProperty('--legende-farbe', `rgb(${beispielFarbe.farbe.join(', ')})`);
  neutralZeile.appendChild(neutralKreis);

  let neutralText = document.createElement('span');
  neutralText.className = 'legende-valenz-text';
  neutralText.textContent = 'Ganzer Kreis: neutral bewertet';
  neutralZeile.appendChild(neutralText);

  legendeInhalt.appendChild(neutralZeile);

  let fwertTitel = document.createElement('div');
  fwertTitel.className = 'legende-fwert-titel';
  fwertTitel.textContent = 'F-Wert';
  legendeInhalt.appendChild(fwertTitel);

  // Reihenfolge = Grösse 1..3, siehe FWERT_PUNKTGROESSE (datenbereinigung.js).
  [
    { groesse: 1, text: 'Raum löst Emotion aus' },
    { groesse: 2, text: 'Emotion färbt Raum' },
    { groesse: 3, text: 'Körper als Sensor' },
  ].forEach(({ groesse, text }) => {
    let zeile = document.createElement('div');
    zeile.className = 'legende-fwert-zeile';

    let punkt = document.createElement('span');
    punkt.className = 'legende-fwert-punkt';
    let d = FWERT_PUNKT_DURCHMESSER[groesse];
    punkt.style.width = d + 'px';
    punkt.style.height = d + 'px';
    punkt.style.backgroundColor = FWERT_PUNKT_FARBE;
    zeile.appendChild(punkt);

    let label = document.createElement('span');
    label.className = 'legende-label';
    label.textContent = text;
    zeile.appendChild(label);

    legendeInhalt.appendChild(zeile);
  });

  let fwertHinweis = document.createElement('p');
  fwertHinweis.className = 'legende-hinweis';
  fwertHinweis.textContent = LEGENDE_FWERT_KARTE;
  legendeInhalt.appendChild(fwertHinweis);
  legendeFwertHinweis = fwertHinweis; // wechselt mit der Ansicht, siehe draw()
}

function baueKartenMarkierungen() {
  stationenData.markierungen.filter(m => !m.deaktiviert).forEach(m => {
    let wrap = document.createElement('div');
    wrap.className = 'karten-markierung';
    let dot = document.createElement('div');
    dot.className = 'ortspunkt';
    let label = document.createElement('div');
    label.className = 'label';
    label.textContent = m.ort;
    wrap.appendChild(dot);
    wrap.appendChild(label);
    kartenMarkierungenEl.appendChild(wrap);
    markierungsEintraege.push({ el: wrap, lon: m.lon, lat: m.lat, revealIndex: m.revealIndex });
  });
}

function baueStationsMarker() {
  stationenData.route.forEach((station, i) => {
    if (i === 0) return;
    if (station.deaktiviert) return;
    let wrap = document.createElement('div');
    wrap.className = 'karten-markierung stations-marker';
    let dot = document.createElement('div');
    dot.className = 'ortspunkt';
    let label = document.createElement('div');
    label.className = 'label';
    label.textContent = station.ort;
    wrap.appendChild(dot);
    wrap.appendChild(label);
    kartenMarkierungenEl.appendChild(wrap);
    stationsMarker.push({ el: wrap, lon: station.lon, lat: station.lat, revealIndex: station.revealIndex });
  });
}

function baueZwischenMarker() {
  (stationenData.zwischenPunkte || []).filter(z => !z.deaktiviert).forEach(z => {
    let wrap = document.createElement('div');
    wrap.className = 'karten-markierung zwischen-marker';
    let dot = document.createElement('div');
    dot.className = 'ortspunkt';
    let label = document.createElement('div');
    label.className = 'label';
    label.textContent = z.name;
    wrap.appendChild(dot);
    wrap.appendChild(label);
    kartenMarkierungenEl.appendChild(wrap);
    zwischenMarker.push({ el: wrap, lon: z.lon, lat: z.lat, revealIndex: z.revealIndex });
  });
}
