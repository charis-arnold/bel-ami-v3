/* =============================================================================
   sketch.js — p5-Zeichnung für Bel-Ami v3

   Der Scroll-Akt: preload/setup/draw plus die Zustandsvariablen, an denen die
   zehn Module hängen. draw() leitet aus der Scrollposition alle Phasen ab und
   ruft die Zeichenmodule in fester Reihenfolge.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 35 von 70 Namen intern, 35 exportiert. Konvention: docs/architektur.md.
(function () {

let stage, heroText, begleitTexte, kapitelEinstiegsTexte;
let annotationBoxEl; // #annotationBox — trägt die Positionsklasse (pos-oben-links etc.), siehe annotationBoxPosition()
let schlusstextEl;   // #schlusstext — Gegenstück zum Einstiegstext, blendet im Schlussakt ein
let naechstesKapitelEl; // #naechstesKapitel — Hinweis am Kapitelende, siehe draw()


// Nummer des folgenden Kapitels, oder null bei 18. Gilt für 02–18; Kapitel 1
// hat seinen eigenen Scroll-Akt.
function naechstesKapitel(nr) {
  if (!nr) return null;
  let ziel = String(parseInt(nr, 10) + 1).padStart(2, '0');
  return kapitelHatEigeneAnsicht(ziel) ? ziel : null;
}
// Kapitel 02–18 öffnen per Klick, nicht per Scroll — daher kein
// data-von/data-bis, sondern ein Zeitfenster-Fade ab dem Klick.
let kapitelEinstiegsStartMillis = null;
const KAPITEL_EINSTIEG_FADE_MS = 800;

// Setzt die Einstiegstext-Uhr neu, gerufen von uebersichtsrouten.js beim
// Kapitelwechsel.
function starteKapitelEinstieg() {
  kapitelEinstiegsStartMillis = millis();
}


// Der Einstiegstext blendet zeitbasiert ein, dann übernimmt das Scrollen:
// zwischen diesen Anteilen des Akts blendet er aus, erst danach die Route.
const KAPITEL_EINSTIEG_SCROLL_START = 0.015;
const KAPITEL_EINSTIEG_SCROLL_ENDE = 0.06;
// bgImage: Startseite und Schlusskarte. bgImage2: Übersichtsakt.
// ACHTUNG die beiden haben NICHT dieselbe Bbox — 568 m versetzt, deshalb
// startBbox und uebersichtBbox getrennt. Siehe docs/bugfix-log.md, Fix 2.
let bgImage, bgImage2, ch1Image;
let kartenMarkierungenEl;
let stationenData;
let kapitel03Data; // eigenes Datenset fürs Kapitel-3-Spine-Panel (Kartenausschnitt-Zoom)

// Erstentwurf-Datensätze für Kapitel 2, 4–18 (baue-kapitel-stationen.py).
// Zugriff nur über datenFuerKapitel(), auch aus vier anderen Modulen.
const WEITERE_KAPITEL_NUMMERN = ['02', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
let weitereKapitelDaten = {}; // z.B. weitereKapitelDaten['04'].ortRuns
// Ortspunkte/Labels der Kapitel-1-Ansicht sind stillgelegt: dom-aufbau.js baut
// die Knoten weiter, draw() überspringt ihre Positionierung.

// ACHTUNG zum Wiedereinschalten reicht true nicht — zusätzlich muss
// .karten-markierung .label { display: none } in style.css fallen, sonst
// erscheinen nur Punkte ohne Beschriftung.
const KARTEN_MARKER_SICHTBAR = false;
let markierungsEintraege = [];
let stationsMarker = [];
let zwischenMarker = [];
let annotationText;
let annotationInner;
let annotationTag;
let annotationBar;
let scrollFortschritt, scrollFortschrittFuellung; // Fortschrittsleiste unten (Übersicht Scrollytelling-Hauptstrang) — ausgeblendet während einer Kapitel-Ansicht (siehe kapitelAnsichtsModus)
let kapitelRegister; // Kapitelregister links (inkl. Plan/Graph + Alle), sichtbar während eines Kapitel-Zooms
let kapitelRegisterEintraege = {}; // nr -> Eintrags-Element, fürs Aktiv-Highlighting in draw()
let planEintrag, graphEintrag; // "Plan"/"Graph"-Hälften oben im Register, fürs Aktiv-Highlighting in draw()
let modusZeile, leerzeile, alleEintrag; // Plan/Graph-Zeile + Abstandshalter + "Alle" — in der Übersicht (kein Kapitel gezoomt) blendet draw() modusZeile/leerzeile aus und markiert alleEintrag als aktiv
let legendeBox; // Register-Container (Tab+Inhalt), mitte rechts — sichtbar wie kapitelRegister (Plan UND Graph)
let legendeValenzText, legendeValenzKreis; // Valenz-Zeile der Legende — Text/Symbol wechseln je Ansicht (siehe draw())
// Alle drei Ansichten (Plan, Graph, Schlussakt) teilen oben/unten — es gibt
// keine Links/Rechts-Fassung mehr.
const LEGENDE_VALENZ_OBEN_UNTEN = 'Volltonfarbe: oben positiv, unten negativ bewertet';
let legendeFwertHinweis; // Positions-Hinweis der F-Wert-Punkte — ebenfalls ansichtsabhängig
const LEGENDE_FWERT_OBEN_UNTEN = 'Position ausserhalb des Kreises: positiv oben, negativ unten, neutral/unbewertet rechts.';
let legendeTab, legendeInhalt; // Tab (vertikal beschriftet, immer sichtbar solang legendeBox.sichtbar) + ausfahrender Inhalt (Farberklärung der Kreisgrafik)
let prologBox, prologTab; // Zweites Register direkt unter Legende (siehe #registerTabs in index.html) — gleiches Verhalten wie Legende, eigener (statischer, hart codierter) Inhalt Projekt-Hintergrund
let registerTabs; // gemeinsamer Fixed-Container beider Register (siehe #registerTabs in index.html) — trägt die legende-offen/prolog-offen-Klasse, an der sich der jeweils GESCHLOSSENE Tab orientiert, um mit ausrücken zu können (siehe CSS)

// Zwei Modi je Kapitel-Ansicht: 'karte' (Ausschnitt und Route) und 'grafik'
// (horizontale Spine mit Play). Umschalten über "Plan"/"Graph" im Menübalken.
let kapitelAnsichtsModus = 'karte';

// Nur das Setzen liegt hier; den restlichen Zustand setzt jedes Modul selbst
// zurück (setzeGrafikZurueck, starteKapitelEinstieg).
function setzeAnsichtsModus(modus) {
  kapitelAnsichtsModus = modus;
}
// Zoomstand des Kapitel-1-Ausschnitts (0..1), je Frame in draw() gesetzt.
// kreisgrafik.js blendet daran das Label des Routen-Startpunkts ein.
let kapitel1ZoomAmount = 0;
let grafikPlayButton;

// --- Übersichtsrouten (Kapitel 02–18, nur in der letzten, rausgezoomten Ansicht) ---
let uebersichtsRouten = {};

// Kapitel mit eigenem Kartenausschnitt (bilder-karten/kapitelXX-*): alle
// ausser 01, das sein eigenes System hat. Die Ausschlussliste ist leer.

// vAnchor/hAnchor verschieben den sichtbaren Ausschnitt im Kapitelbild
// (0 = oben/links, 1 = unten/rechts, 0.5 = Default), siehe coverCrop.
const OHNE_EIGENEN_KARTENAUSSCHNITT = [];
let kapitelKarten = {
  '02': { bild: null, bboxRaw: null },
  '03': { bild: null, bboxRaw: null, vAnchor: 0.15 },
  '04': { bild: null, bboxRaw: null },
  '05': { bild: null, bboxRaw: null },
  '06': { bild: null, bboxRaw: null },
  '07': { bild: null, bboxRaw: null },
  '08': { bild: null, bboxRaw: null },
  '09': { bild: null, bboxRaw: null },
  '10': { bild: null, bboxRaw: null },
  '11': { bild: null, bboxRaw: null },
  '12': { bild: null, bboxRaw: null },
  '13': { bild: null, bboxRaw: null },
  '14': { bild: null, bboxRaw: null },
  '15': { bild: null, bboxRaw: null },
  '16': { bild: null, bboxRaw: null },
  '17': { bild: null, bboxRaw: null },
  '18': { bild: null, bboxRaw: null },
};
let letzterZoomKapitel = null; // bleibt waehrend des Ausblendens gesetzt, siehe draw()

// Datensatz zu einer Kapitelnummer. Kapitel 3 hat eine eigene Variable,
// alle anderen liegen in weitereKapitelDaten.
function datenFuerKapitel(nr) {
  return nr === '03' ? kapitel03Data : weitereKapitelDaten[nr];
}

// Hat dieses Kapitel eine öffenbare Ansicht? Eigener Kartenausschnitt oder
// zumindest ein Spine-Panel. sketch.js hält das Kapitelinventar.

// ACHTUNG !!kapitelKarten[nr] prüft die Inventarzugehörigkeit, nicht ob das
// Bild geladen ist — .bild füllt erst preload(). Die ODER-Klausel greift
// heute nie: beide Listen führen dieselben 17 Kapitel. Zwei handgepflegte
// Listen für dasselbe sind der eigentliche Mangel, ungelöst.
function kapitelHatEigeneAnsicht(nr) {
  return !!kapitelKarten[nr] || KAPITEL_MIT_SPINE_PANEL.has(nr);
}

function preload() {
  bgImage = loadImage('bilder-karten/paris-startkarte-web.png');
  bgImage2 = loadImage('bilder-karten/paris-ueberblickkarte-web.png');
  ch1Image = loadImage('bilder-karten/kapitel01-qgis-karte-web.png');

  const kapitelDatenDateien = [
    { nr: '01', ziel: 'stationenData' },
    { nr: '03', ziel: 'kapitel03Data' },
    ...WEITERE_KAPITEL_NUMMERN.map(nr => ({ nr, ziel: nr }))
  ];

  kapitelDatenDateien.forEach(({ nr, ziel }) => {
    const datei = `kapitel${nr}-stationen.json`;
    if (ziel === 'stationenData') stationenData = loadJSON(datei);
    else if (ziel === 'kapitel03Data') kapitel03Data = loadJSON(datei);
    else weitereKapitelDaten[ziel] = loadJSON(datei);
  });

  fotoMarkerListe = loadJSON('fotomarker.json');
  uebersichtsRouten = loadJSON('kapitel-routen-uebersicht.json');

  Object.keys(kapitelKarten).forEach(nr => {
    if (OHNE_EIGENEN_KARTENAUSSCHNITT.includes(nr)) return;
    kapitelKarten[nr].bild = loadImage(`bilder-karten/kapitel${nr}-karte.png`);
    kapitelKarten[nr].bboxRaw = loadJSON(`bilder-karten/kapitel${nr}-bbox.json`);
  });
}

function bereinigeEingangsdaten() {
  [stationenData, kapitel03Data, ...WEITERE_KAPITEL_NUMMERN.map(nr => weitereKapitelDaten[nr])]
    .filter(Boolean)
    .forEach(daten => {
      bereinigeStationenDaten(daten);
    });

  fotoMarkerListe = bereinigeFotoMarker(fotoMarkerListe);
  uebersichtsRouten = bereinigeUebersichtsrouten(uebersichtsRouten);
}

function setup() {
  bereinigeEingangsdaten();

  stage = document.getElementById('scrollyStage');
  heroText = document.querySelectorAll('h1, h2, .lead, .scroll-hinweis');
  begleitTexte = document.querySelectorAll('.begleittext');
  kapitelEinstiegsTexte = document.querySelectorAll('.kapitel-einstiegstext');

  kartenMarkierungenEl = document.getElementById('kartenMarkierungen');
  naechstesKapitelEl = document.getElementById('naechstesKapitel');
  naechstesKapitelEl.addEventListener('click', (ev) => {
    // stopPropagation: p5 hört mousePressed am Fenster ab — ohne das liefe
    // derselbe Klick zusätzlich durch die Foto-Marker-Treffprüfung dort.
    ev.stopPropagation();
    let ziel = naechstesKapitel(zoomedKapitel);
    if (ziel) springeZuKapitelZoom(ziel);
  });
  annotationBoxEl = document.getElementById('annotationBox');
  schlusstextEl = document.getElementById('schlusstext');
  annotationText = document.getElementById('annotationText');
  annotationInner = document.getElementById('annotationInner');
  annotationTag = document.getElementById('annotationTag');
  annotationBar = document.getElementById('annotationBar');
  kapitelRegister = document.getElementById('kapitelRegister');
  registerTabs = document.getElementById('registerTabs');
  legendeBox = document.getElementById('legendeBox');
  legendeTab = document.getElementById('legendeTab');
  legendeInhalt = document.getElementById('legendeInhalt');
  legendeTab.addEventListener('click', () => oeffneRegister(legendeBox, prologBox, 'legende-offen', 'prolog-offen'));
  prologBox = document.getElementById('prologBox');
  prologTab = document.getElementById('prologTab');
  prologTab.addEventListener('click', () => oeffneRegister(prologBox, legendeBox, 'prolog-offen', 'legende-offen'));
  scrollFortschritt = document.getElementById('scrollFortschritt');
  grafikPlayButton = document.getElementById('grafikPlayButton');
  grafikPlayButton.addEventListener('click', toggleGrafikPlay);

  fotoPopup = document.getElementById('fotoPopup');
  fotoPopupTitel = document.getElementById('fotoPopupTitel');
  fotoPopupPlz = document.getElementById('fotoPopupPlz');
  fotoPopupBild = document.getElementById('fotoPopupBild');
  fotoPopupBeschreibung = document.getElementById('fotoPopupBeschreibung');
  scrollFortschrittFuellung = document.getElementById('scrollFortschrittFuellung');
  document.getElementById('fotoPopupClose').addEventListener('click', schliesseFotoPopup);
  fotoPopup.addEventListener('click', e => { if (e.target === fotoPopup) schliesseFotoPopup(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { schliesseFotoPopup(); schliesseKapitelZoom(); }
  });

  let cnv = createCanvas(stage.offsetWidth, stage.offsetHeight);
  cnv.parent('scrollyStage');

  baueKartenMarkierungen();
  // ACHTUNG Destrukturierungs-ZUWEISUNG ohne const/let: die Handles sind oben
  // auf Modulebene deklariert. Ein `const { … } =` legte funktionslokale
  // Konstanten an, die Modulvariablen blieben undefined — Menübalken und
  // Legende fielen still aus.
  //
  // Vorher schrieb dom-aufbau.js diese acht direkt von aussen; jetzt baut es
  // und gibt zurück (siehe docs/best-practices-review.md, "Gruppe B").
  ({ modusZeile, planEintrag, graphEintrag, leerzeile, alleEintrag } = baueKapitelRegister());
  ({ legendeValenzText, legendeValenzKreis, legendeFwertHinweis } = baueLegende());
  baueStationsMarker();
  baueZwischenMarker();
}

function windowResized() {
  resizeCanvas(stage.offsetWidth, stage.offsetHeight);
}

function getScrollProgress() {
  let trackEl = document.querySelector('.scroll-track');
  return constrain(window.scrollY / trackEl.offsetHeight, 0, 1);
}

// ---------------------------------------------------------------------------
// draw()
// ---------------------------------------------------------------------------

function draw() {
  background(220);

  // letzterZoomKapitel bleibt nach dem Schliessen gesetzt, damit das
  // Spine-Panel beim Ausblenden noch die richtigen Daten zeigt.
  if (zoomedKapitel) letzterZoomKapitel = zoomedKapitel;
  stelleSpineDatenBereit(letzterZoomKapitel);
  let targetCrop = coverCrop(ch1Image.width, ch1Image.height);
  let targetBbox = cropToBbox(targetCrop, ch1ImgBbox, ch1Image.width, ch1Image.height);

  let progress = getScrollProgress();
  // Ein offenes Kapitel endet mit seiner letzten Annotation: Scrollposition
  // wird nach unten festgehalten, nach oben bleibt sie frei — der Weg zurück.
  if (zoomedKapitel && progress > SCROLL_MEILENSTEINE.uebersichtRoutenEnd) {
    progress = SCROLL_MEILENSTEINE.uebersichtRoutenEnd;
    let trackEl = document.querySelector('.scroll-track');
    window.scrollTo(0, trackEl.offsetHeight * progress);
  }
  scrollFortschrittFuellung.style.width = (progress * 100) + '%';

  // Startkarte blendet vor dem Zoom auf die helle Überblickskarte über.
  // Im Schlussakt kehrt die STARTkarte wieder, mit eigener Georeferenz.
  let imStartkarteAkt = progress >= SCROLL_MEILENSTEINE.startkarteStart;
  let kartenwechsel = imStartkarteAkt ? 0 : constrain(map(progress,
    SCROLL_MEILENSTEINE.kartenwechselStart, SCROLL_MEILENSTEINE.kartenwechselEnd, 0, 1), 0, 1);
  let fullCrop = coverCrop(bgImage.width, bgImage.height, 0.5, 0.5, 0); // grosse Karte bleibt zentriert, unabhängig von mapOffsetX
  // ACHTUNG der Ausschnitt muss in BEIDE Karten passen: sonst klemmt
  // bboxToImgCrop ihn an der Bildkante und streckt das Bild dabei um 2.5%.
  // Deshalb in die Schnittmenge beider Georeferenzen eingepasst.
  let fullBbox = passeBboxInRahmen(
    cropToBbox(fullCrop, startBbox, bgImage.width, bgImage.height), UEBERSICHT_SCHNITT_BBOX);

  let zoomAmount = constrain(map(progress, SCROLL_MEILENSTEINE.zoomStart, SCROLL_MEILENSTEINE.zoomEnd, 0, 1), 0, 1);
  // Nach der Route zurück auf die Gesamtkarte. Route und Kreise bleiben
  // sichtbar: routeAmount hängt nicht am Zoom.
  let zoomOutAmount = constrain(map(progress, SCROLL_MEILENSTEINE.zoomOutStart, SCROLL_MEILENSTEINE.zoomOutEnd, 0, 1), 0, 1);
  zoomAmount *= (1 - zoomOutAmount);
  kapitel1ZoomAmount = zoomAmount;

  // "In einer Kapitel-Ansicht": ein gezoomtes Kapitel 02–18 ODER Kapitel 1s
  // eigener Ausschnitt. Grafik-Ansicht zusätzlich nur bei Modus 'grafik'.
  let inKapitel1Kartenausschnitt = !zoomedKapitel && zoomAmount > 0.5;
  let inKapitelAnsicht = !!zoomedKapitel || inKapitel1Kartenausschnitt;
  let inKapitelGrafikAnsicht = inKapitelAnsicht && kapitelAnsichtsModus === 'grafik';

  // Gemeinsamer Offset aller Overlays, 0 bis mapOffsetX mit dem Zoom —
  // sonst sitzen sie beim Zoomen neben der sichtbaren Karte.
  let kartenOffsetX = lerp(0, mapOffsetX, zoomAmount);
  let kartenOffsetY = lerp(0, mapOffsetY, zoomAmount);

  // Schon hier berechnet, weil activeBbox unten davon abhängt. Hochscrollen
  // vor den Aktanfang schliesst einen offenen Kapitel-Zoom wieder.
  let uebersichtRoutenFortschritt = constrain(map(progress, SCROLL_MEILENSTEINE.uebersichtRoutenStart, SCROLL_MEILENSTEINE.uebersichtRoutenEnd, 0, 1), 0, 1);
  if (zoomedKapitel && uebersichtRoutenFortschritt <= 0) schliesseKapitelZoom(); // zurückgescrollt

  // Schlussakt Ortsveränderung: ein Fortschritt 0..1 über den ganzen Akt,
  // aus dem die Phasen OV_*/SK_* abgeleitet werden.
  let ovFortschritt = constrain(map(progress, SCROLL_MEILENSTEINE.kreisVergleichStart, SCROLL_MEILENSTEINE.kreisVergleichEnd, 0, 1), 0, 1);
  let skFortschritt = constrain(map(progress, SCROLL_MEILENSTEINE.startkarteStart, 1, 0, 1), 0, 1);
  let skEinblenden = ovPhase(skFortschritt, SK_EINBLENDEN);
  let skRauszoom = ovPhase(skFortschritt, SK_RAUSZOOM);
  if (schlusstextEl) schlusstextEl.style.opacity = ovPhase(skFortschritt, SK_TEXT);
  let kreisVergleichMapFade = ovPhase(ovFortschritt, OV_KARTE_AUS);
  // Ein offener Kapitel-Zoom darf nicht in diesen Akt hinübergescrollt werden.
  if (zoomedKapitel && kreisVergleichMapFade > 0) schliesseKapitelZoom();

  // Kapitel-Zoom öffnet sofort mit voller Route, nur zeitlich eingeblendet.
  aktualisiereKapitelZoom();

  let activeBbox = {
    west: lerp(fullBbox.west, targetBbox.west, zoomAmount),
    east: lerp(fullBbox.east, targetBbox.east, zoomAmount),
    south: lerp(fullBbox.south, targetBbox.south, zoomAmount),
    north: lerp(fullBbox.north, targetBbox.north, zoomAmount),
  };

  // Schlusszoom auf die sieben Orte, erst nach dem Schrumpfen der Linien —
  // so rücken sie weit genug auseinander für ihre Kreise.
  let ovZoom = ovPhase(ovFortschritt, OV_ZOOM);
  if (ovZoom > 0) {
    let ziel = ovZoomBbox();
    if (ziel) {
      activeBbox = {
        west: lerp(activeBbox.west, ziel.west, ovZoom),
        east: lerp(activeBbox.east, ziel.east, ovZoom),
        south: lerp(activeBbox.south, ziel.south, ovZoom),
        north: lerp(activeBbox.north, ziel.north, ovZoom),
      };
    }
  }

  // Und wieder heraus: aus dem Ausschnitt der sieben Orte zurück auf die
  // ganze Startkarte, nachdem diese eingeblendet hat.
  if (skRauszoom > 0) {
    activeBbox = {
      west: lerp(activeBbox.west, fullBbox.west, skRauszoom),
      east: lerp(activeBbox.east, fullBbox.east, skRauszoom),
      south: lerp(activeBbox.south, fullBbox.south, skRauszoom),
      north: lerp(activeBbox.north, fullBbox.north, skRauszoom),
    };
  }

  // Kapitel-Zoom (Klick auf «03» etc.) — zoomt von der Gesamtkarte weiter in
  // den eigenen Kartenausschnitt des Kapitels, genau wie oben bgImage→ch1Image.
  let kapitelCrop = null;
  // Ausserhalb des Blocks: die Annotationsbox unten braucht dieselbe
  // unanimierte Ziel-Bbox, sonst wandert ihre Position beim Reinzoomen.
  let kapitelTargetBbox = null;
  if (zoomedKapitel && kapitelKarten[zoomedKapitel] && kapitelKarten[zoomedKapitel].bild
    && kapitelKarten[zoomedKapitel].bild.width && kapitelKarten[zoomedKapitel].bboxRaw) {
    let k = kapitelKarten[zoomedKapitel];
    kapitelCrop = coverCrop(k.bild.width, k.bild.height, k.vAnchor ?? 0.5, k.hAnchor ?? 0.5);
    kapitelTargetBbox = cropToBbox(kapitelCrop, k.bboxRaw, k.bild.width, k.bild.height);
    activeBbox = {
      west: lerp(activeBbox.west, kapitelTargetBbox.west, kapitelZoomAmount),
      east: lerp(activeBbox.east, kapitelTargetBbox.east, kapitelZoomAmount),
      south: lerp(activeBbox.south, kapitelTargetBbox.south, kapitelZoomAmount),
      north: lerp(activeBbox.north, kapitelTargetBbox.north, kapitelZoomAmount),
    };
  }

  // ch1Image zoomt nicht mit, es blendet an seiner festen Zielposition ein.
  // Ein dynamischer Ausschnitt würde geklemmt und dabei verzerrt.
  let ch1Crop = targetCrop;

  // (1 - kreisVergleichMapFade) blendet die Karte im Ortsveränderungs-Akt aus;
  // skEinblenden holt sie im allerletzten Akt zurück.
  let kartenAlpha = 255 * (1 - zoomAmount) * Math.max(1 - kreisVergleichMapFade, skEinblenden);
  // Beide Karten auf dieselbe activeBbox, je aus der eigenen Georeferenz —
  // so liegen sie im Crossfade deckungsgleich übereinander.
  if (kartenwechsel < 1) {
    let startCrop = bboxToImgCrop(activeBbox, startBbox, bgImage.width, bgImage.height);
    tint(255, kartenAlpha);
    image(bgImage, 0, 0, width, height, startCrop.x, startCrop.y, startCrop.w, startCrop.h);
  }
  if (kartenwechsel > 0) {
    let uebersichtCrop = bboxToImgCrop(activeBbox, uebersichtBbox, bgImage2.width, bgImage2.height);
    tint(255, kartenAlpha * kartenwechsel);
    image(bgImage2, 0, 0, width, height, uebersichtCrop.x, uebersichtCrop.y, uebersichtCrop.w, uebersichtCrop.h);
  }
  tint(255, 255 * zoomAmount * (1 - kreisVergleichMapFade));
  image(ch1Image, mapOffsetX, mapOffsetY, width - mapOffsetX, height, ch1Crop.x, ch1Crop.y, ch1Crop.w, ch1Crop.h);
  noTint();

  if (kapitelCrop && kapitelZoomAmount > 0.001) {
    let k = kapitelKarten[zoomedKapitel];
    tint(255, 255 * kapitelZoomAmount * (1 - kreisVergleichMapFade));
    image(k.bild, mapOffsetX, mapOffsetY, width - mapOffsetX, height, kapitelCrop.x, kapitelCrop.y, kapitelCrop.w, kapitelCrop.h);
    noTint();
  }

  let massstabOffsetX = (kapitelCrop && kapitelZoomAmount > 0.5) ? mapOffsetX : kartenOffsetX;
  zeichneMassstabsleiste(activeBbox, massstabOffsetX, 1 - kreisVergleichMapFade);
  zeichneWindrose(width - 90, 150, 50, 1 - kreisVergleichMapFade);

  // Demo-Kreisgrafik auf der hellen Überblickskarte, oberhalb der
  // Erklärungstexte (.begleittext sitzt auf 64% Höhe).
  let demoWachstum = constrain(map(progress, SCROLL_MEILENSTEINE.demoStart, SCROLL_MEILENSTEINE.demoVoll, 0, 1), 0, 1);
  let demoAlpha = demoWachstum * constrain(map(progress, SCROLL_MEILENSTEINE.zoomStart, SCROLL_MEILENSTEINE.demoEnde, 1, 0), 0, 1);
  zeichneDemoKreisgrafik(width * 0.5, height * 0.33, demoWachstum, demoAlpha);

  let routeAmount = constrain(map(progress, SCROLL_MEILENSTEINE.routeStart, SCROLL_MEILENSTEINE.routeEnd, 0, 1), 0, 1);

  let annListe = stationenData.annotationen;
  let annIndex = Math.min(annListe.length - 1, Math.floor(routeAmount * annListe.length));
  let punktIndex = annListe[annIndex].revealIndex;
  if (annListe[annIndex].vorRoutenstart) punktIndex = 0;

  let endStation = stationenData.route.filter(s => s.routeEndsHere).pop()
    || stationenData.route[stationenData.route.length - 1];
  let liniIndex = Math.min(punktIndex, endStation.revealIndex);

  // Übersichtsrouten 02–18, zuerst gezeichnet — Kapitel 1s Route liegt darüber.
  let aktuelleAnnotationZoom = null;
  // Die Routen bleiben stehen, damit die Ortspunkte auf ihnen landen; erst
  // der Zoom lässt sie verschwinden, im Schlussakt kommen sie zurück.

  // Unbedingt aufrufen, auch bei Fortschritt 0: zeichneUebersichtsrouten()
  // setzt dann selbst kapitelHover und den Cursor zurück.
  let routenSichtbar = Math.max((1 - 0.45 * kreisVergleichMapFade) * (1 - ovZoom), skRauszoom);
  let routenAlpha = 180 * routenSichtbar;
  let uebersichtRoutenErgebnis = zeichneUebersichtsrouten(activeBbox, routenAlpha, uebersichtRoutenFortschritt);
  aktuelleAnnotationZoom = uebersichtRoutenErgebnis.aktuelleAnnotationZoom;

  // ACHTUNG Sperre nötig: bei gezoomtem Kapitel zeigt activeBbox dessen Bbox,
  // nicht Kapitel 1s Gegend. Ohne sie liefe Kapitel 1s Route quer über den
  // fremden Kartenausschnitt.
  if (!zoomedKapitel) {
    // Strichstärke 10 -> 2 beim Rauszoomen, wie die Übersichtsrouten. Auch
    // dasselbe Ausblenden, sonst verschwände sie vor den anderen.
    zeichneRoute(stationenData.routenPunkte, liniIndex, activeBbox, lerp(10, 2, zoomOutAmount), kartenOffsetX, kartenOffsetY,
      Math.max((1 - 0.45 * kreisVergleichMapFade) * (1 - ovZoom), skRauszoom));
    // Kreisgrafik (Karte) in der letzten Ansicht (Rauszoomen) für den Moment
    // ausgeblendet — Route/Spine bleiben davon unberührt sichtbar.
    if (zoomOutAmount <= 0) {
      zeichneKreiseOrtRuns(punktIndex, annIndex, activeBbox, kartenOffsetX, kartenOffsetY);
    }
  }

  // Schlussakt, siehe ortsveraenderung.js.
  if (ovFortschritt > 0 && !zoomedKapitel) {
    zeichneOrtsveraenderung(activeBbox, ovFortschritt, 255 * (1 - skRauszoom), 1 - skEinblenden);
  }

  // Graph-Ansicht deckt Karte, Route und Kreise dieses Frames vollständig ab
  // (zeichneSpineHorizontal, aktualisiereGrafikFortschritt).
  if (inKapitelGrafikAnsicht) {
    background(226, 230, 225); // #E2E6E1
    let grafikEintraege = spineEintraegeFuer(zoomedKapitel);
    let grafikDaten = zoomedKapitel ? datenFuerKapitel(zoomedKapitel) : stationenData;
    aktualisiereGrafikFortschritt();
    zeichneSpineHorizontal(grafikEintraege || [], grafikFortschritt, grafikDaten);
  }

  // Kapitel 1 läuft über routeAmount/annIndex, ein gezoomtes Kapitel über
  // aktuelleAnnotationZoom. Beide schliessen sich aus.
  let aktuelleAnnotation = !zoomedKapitel
    ? ((routeAmount > 0 && zoomOutAmount <= 0) ? annListe[annIndex] : null)
    : (kapitelZoomAmount > 0.5 ? aktuelleAnnotationZoom : null);
  // Ziel-Bbox des Kapitels, nicht die animierte activeBbox — sonst wandert
  // die Positionswahl beim Reinzoomen.
  let positionKapitel = zoomedKapitel || '01';
  let positionBbox = zoomedKapitel ? kapitelTargetBbox : targetBbox;
  let positionDaten = zoomedKapitel ? datenFuerKapitel(zoomedKapitel) : stationenData;
  if (annotationBoxEl && positionBbox && positionDaten && positionDaten.ortRuns) {
    let position = annotationBoxPosition(positionKapitel, positionDaten, positionBbox);
    ANNOTATION_BOX_POSITIONEN.forEach(p => annotationBoxEl.classList.toggle('pos-' + p, p === position));
  }

  // Hinweis "Nächstes Kapitel", sobald die letzte Annotation erreicht ist.
  // Nur in der Kartenansicht — in der Graph-Ansicht sitzt dort der Play-Button.
  if (naechstesKapitelEl) {
    let kapitelLokalerFortschritt = constrain(
      map(uebersichtRoutenFortschritt, KAPITEL_EINSTIEG_SCROLL_ENDE, 1, 0, 1), 0, 1);
    // Schwelle aus der Annotationszahl, nicht fest: dieselbe Rechnung wie
    // annIndexZoom. Ein fester Wert läge je nach Kapitellänge daneben.
    let endDaten = datenFuerKapitel(zoomedKapitel);
    let anzahl = endDaten && endDaten.annotationen ? endDaten.annotationen.length : 0;
    let amEnde = !!zoomedKapitel && kapitelZoomAmount > 0.5
      && kapitelAnsichtsModus === 'karte'
      && anzahl > 0 && kapitelLokalerFortschritt >= (anzahl - 1) / anzahl
      && !!naechstesKapitel(zoomedKapitel);
    naechstesKapitelEl.classList.toggle('sichtbar', amEnde);
  }

  if (aktuelleAnnotation) {
    annotationText.textContent = '«' + aktuelleAnnotation.text + '»';
    annotationText.style.opacity = 1;
    annotationInner.style.opacity = 1;
    annotationInner.style.background = 'rgba(226, 230, 225, 0.85)';
    let catColor = CATEGORY_COLORS[aktuelleAnnotation.category] || ROUTE_COLOR;
    let fwertColor = FWERT_COLORS[aktuelleAnnotation.fWertType] || FWERT_COLOR;
    annotationBar.style.background = aktuelleAnnotation.hasFwert
      ? `linear-gradient(90deg, ${catColor}, ${fwertColor})`
      : catColor;
    annotationTag.textContent = CATEGORY_LABELS[aktuelleAnnotation.category] || '';
  } else {
    annotationText.style.opacity = 0;
    annotationInner.style.opacity = 0;
    annotationTag.textContent = '';
  }

  // Kapitelregister: in jeder Kapitel-Ansicht und zusätzlich in der Übersicht,
  // damit man von dort direkt in ein Kapitel springen kann. Im Schlussakt nicht.
  let inUebersichtRouten = uebersichtRoutenFortschritt > 0 && !zoomedKapitel && kreisVergleichMapFade <= 0;
  kapitelRegister.classList.toggle('sichtbar', inKapitelAnsicht || inUebersichtRouten);

  // Legende und Prolog überall ausser auf der Startkarte; auf der
  // Schlusskarte bleibt nur der Prolog, die Kreisgrafik ist dann verblasst.

  // Über visibility statt display geschaltet, damit der Prolog an seinem
  // Platz bleibt, wenn die Legende darüber verschwindet.
  // Ab dem Kartenwechsel, nicht erst ab dem Zoom: die Kreisgrafik-Erklärung
  // davor verweist auf die Legende.
  let aufStartkarte = progress < SCROLL_MEILENSTEINE.kartenwechselStart;
  let aufSchlusskarte = progress >= SCROLL_MEILENSTEINE.startkarteStart;
  legendeBox.classList.toggle('sichtbar', !aufStartkarte && !aufSchlusskarte);
  prologBox.classList.toggle('sichtbar', !aufStartkarte);
  legendeTab.classList.toggle('hervorgehoben',
    progress >= SCROLL_MEILENSTEINE.legendeHervorStart && progress < SCROLL_MEILENSTEINE.zoomStart);

  // Ausgefahrener Inhalt fährt ein, wenn sein Register verschwindet — es
  // taucht später eingefahren wieder auf, nicht im letzten Stand.
  if (aufStartkarte || aufSchlusskarte) {
    legendeBox.classList.remove('offen');
    registerTabs.classList.remove('legende-offen');
  }
  if (aufStartkarte) {
    prologBox.classList.remove('offen');
    registerTabs.classList.remove('prolog-offen');
  }
  // Plan/Graph nur in einer echten Kapitel-Ansicht; in der Übersicht ist
  // "Alle" der aktive Eintrag.
  modusZeile.classList.toggle('versteckt', !inKapitelAnsicht);
  leerzeile.classList.toggle('versteckt', !inKapitelAnsicht);
  alleEintrag.classList.toggle('aktiv', inUebersichtRouten);
  if (inKapitelAnsicht) {
    planEintrag.classList.toggle('aktiv', kapitelAnsichtsModus === 'karte');
    graphEintrag.classList.toggle('aktiv', kapitelAnsichtsModus === 'grafik');
    Object.entries(kapitelRegisterEintraege).forEach(([nr, eintrag]) => {
      eintrag.classList.toggle('aktiv', zoomedKapitel ? nr === zoomedKapitel : nr === '01');
    });
  } else if (inUebersichtRouten) {
    // Kein Kapitel aktiv, sonst bliebe eine veraltete Hervorhebung stehen.
    Object.values(kapitelRegisterEintraege).forEach(eintrag => eintrag.classList.remove('aktiv'));
  }

  // Fortschrittsleiste nur ausserhalb einer Kapitel-Ansicht; in der
  // Graph-Ansicht steht dort der Play-Button.
  scrollFortschritt.classList.toggle('versteckt', inKapitelAnsicht);
  grafikPlayButton.classList.toggle('sichtbar', inKapitelGrafikAnsicht);
  grafikPlayButton.textContent = grafikSpielt ? '❚❚' : '▶';

  // Kartenbezogene DOM-Overlays blenden sich in der Graph-Ansicht per CSS
  // aus, siehe .scrolly-stage.grafik-ansicht in style.css.
  stage.classList.toggle('grafik-ansicht', inKapitelGrafikAnsicht);

  // Alle Ansichten teilen die Halbkreise oben/unten, auch der Schlussakt —
  // die Legende hat deshalb nur noch eine Fassung.
  if (legendeValenzText) {
    legendeValenzText.textContent = LEGENDE_VALENZ_OBEN_UNTEN;
    legendeValenzKreis.classList.add('valenz-oben-unten');
    legendeFwertHinweis.textContent = LEGENDE_FWERT_OBEN_UNTEN;
  }

  // Stillgelegt, siehe KARTEN_MARKER_SICHTBAR oben.
  if (KARTEN_MARKER_SICHTBAR) {
    markierungsEintraege.forEach(m => {
      let p = lonLatToScreen(m.lon, m.lat, activeBbox);
      m.el.style.left = p.x + 'px';
      m.el.style.top = p.y + 'px';
      m.el.classList.toggle('sichtbar', KARTEN_MARKER_SICHTBAR);
    });
    stationsMarker.forEach(m => {
      let p = lonLatToScreen(m.lon, m.lat, activeBbox);
      m.el.style.left = p.x + 'px';
      m.el.style.top = p.y + 'px';
      m.el.classList.toggle('sichtbar', KARTEN_MARKER_SICHTBAR);
    });
    zwischenMarker.forEach(m => {
      let p = lonLatToScreen(m.lon, m.lat, activeBbox);
      m.el.style.left = p.x + 'px';
      m.el.style.top = p.y + 'px';
      m.el.classList.toggle('sichtbar', KARTEN_MARKER_SICHTBAR);
    });
  }

  // Hero-Text ausblenden, kubisch — er bleibt dadurch lange stehen.
  let heroProgress = constrain(map(progress, SCROLL_MEILENSTEINE.heroFadeStart, SCROLL_MEILENSTEINE.heroFadeEnd, 0, 1), 0, 1);
  let heroFade = heroProgress * heroProgress * heroProgress;
  let heroOpacity = 1 - heroFade;
  heroText.forEach(el => el.style.opacity = heroOpacity);

  // Begleittexte: jedes <p class="begleittext"> blendet in seinem eigenen
  // data-von/data-bis-Fenster ein und aus. Neue Texte brauchen kein JS.
  begleitTexte.forEach(el => {
    let von = parseFloat(el.dataset.von);
    let bis = parseFloat(el.dataset.bis);
    let fadeDauerMax = 0.142857; // 0.2 auf die verlängerte Scrollstrecke umskaliert (2200/3080)
    // Höchstens 35% des Fensters, sonst überlappen sich die Rampen bei kurzen
    // Fenstern und die Box erreicht nie volle Deckkraft.
    let fadeDauer = Math.min(fadeDauerMax, (bis - von) * 0.35);
    let opacity = constrain(
      Math.min(
        map(progress, von, von + fadeDauer, 0, 1),
        map(progress, bis - fadeDauer, bis, 1, 0)
      ),
      0, 1
    );
    // Kapitel 1 hat keinen eigenen Einstiegstext — in der Graph-Ansicht
    // übernimmt der Begleittext dessen Play-Ausblendweg.
    if (inKapitelGrafikAnsicht && grafikPlayAusblendStart !== null) {
      opacity = Math.min(opacity, 1 - constrain(
        map(millis() - grafikPlayAusblendStart, 0, KAPITEL_EINSTIEG_FADE_MS, 0, 1), 0, 1));
    }
    el.style.opacity = opacity;
  });
  // Kapitel-Einstiegstexte 02–18: zeitbasierter Fade ab Klick-Zeitpunkt
  // (kapitelEinstiegsStartMillis, gesetzt von starteKapitelEinstieg oben).

  // Im Übersichtsakt bekommt jedes Kapitel die Scheibe seiner Route: der Text
  // blendet ein und aus, bevor das nächste an die Reihe kommt.
  let uebersichtScheiben = !zoomedKapitel ? kapitelScheiben() : null;
  let imUebersichtsakt = uebersichtRoutenFortschritt > 0
    && progress < SCROLL_MEILENSTEINE.kreisVergleichStart;

  kapitelEinstiegsTexte.forEach(el => {
    let passtZuOffenemKapitel = el.dataset.kapitel === zoomedKapitel;
    let opacity = 0;

    if (uebersichtScheiben && imUebersichtsakt) {
      let scheibe = uebersichtScheiben.find(sch => sch.nr === el.dataset.kapitel);
      if (scheibe) {
        let lokal = constrain(map(uebersichtRoutenFortschritt, scheibe.von, scheibe.bis, 0, 1), 0, 1);
        // Breites Fenster, damit auch kurze Kapitel mit schmaler Scheibe
        // lesbar bleiben.
        opacity = Math.min(
          constrain(map(lokal, 0, 0.12, 0, 1), 0, 1),
          1 - constrain(map(lokal, 0.72, 0.88, 0, 1), 0, 1));
      }
    }
    if (passtZuOffenemKapitel && kapitelEinstiegsStartMillis !== null) {
      let elapsed = millis() - kapitelEinstiegsStartMillis;
      let einblenden = constrain(map(elapsed, 0, KAPITEL_EINSTIEG_FADE_MS, 0, 1), 0, 1);
      let ausblenden = 1 - constrain(map(uebersichtRoutenFortschritt,
        KAPITEL_EINSTIEG_SCROLL_START, KAPITEL_EINSTIEG_SCROLL_ENDE, 0, 1), 0, 1);
      // Graph-Ansicht: zusätzlicher Ausblendweg ab dem Play-Klick, gleiche
      // Dauer wie das Einblenden.
      let ausblendenPlay = grafikPlayAusblendStart === null ? 1 :
        1 - constrain(map(millis() - grafikPlayAusblendStart, 0, KAPITEL_EINSTIEG_FADE_MS, 0, 1), 0, 1);
      opacity = Math.min(einblenden, ausblenden, ausblendenPlay) * kapitelZoomAmount * (1 - kreisVergleichMapFade);
    }
    el.style.opacity = opacity;
  });
  // Foto-Marker ganz zuletzt. Offset wie die sichtbare Karte: fixer
  // mapOffsetX/Y bei gezoomtem Kapitel, sonst kartenOffsetX/Y.
  let fotoOffsetX = (zoomedKapitel && kapitelZoomAmount > 0.001) ? mapOffsetX : kartenOffsetX;
  let fotoOffsetY = (zoomedKapitel && kapitelZoomAmount > 0.001) ? mapOffsetY : kartenOffsetY;
  merkeKartenlage(activeBbox, fotoOffsetX, fotoOffsetY);
  // In der Graph-Ansicht nicht zeichnen, sonst schweben sie über der Spine.
  // kartenZoomFaktor skaliert die Sternchen: der grössere der beiden Zooms.
  if (!inKapitelGrafikAnsicht) zeichneFotoMarker(activeBbox, fotoOffsetX, fotoOffsetY, 1 - kreisVergleichMapFade, Math.max(zoomAmount, kapitelZoomAmount));
}

// ---------------------------------------------------------------------------
// Klicks auf dem Canvas
// ---------------------------------------------------------------------------
// sonifikation.js liefert nur den Ton, das Bild ist die Graph-Ansicht.
// Play-Schalter und Animationsdauer liegen in spine-horizontal.js.

function mousePressed() {
  if (kapitelHover === '01') { scrolleZuKapitel1(); return; }
  // ACHTUNG über springeZuKapitelZoom, nicht direkt über oeffneKapitelZoom:
  // die Startpunkte sind erst weit im Akt sichtbar, ein Klick dort öffnete
  // das Kapitel sonst mitten im Ablauf.
  if (kapitelHover) { springeZuKapitelZoom(kapitelHover); return; }
  if (!letzteActiveBbox) return;
  // Foto-Marker: Treffertest und Popup liegen in fotomarker.js
  for (let f of fotoMarkerListe) {
    let pos = lonLatToScreen(f.lon, f.lat, letzteActiveBbox, letzterFotoOffsetX, letzterFotoOffsetY);
    if (dist(mouseX, mouseY, pos.x, pos.y) < FOTO_MARKER_TREFFER_RADIUS) {
      if (f.fotoUrl) oeffneFotoPopup(f);
      return;
    }
  }
}

// kreisvergleich-orte.json wird vom Code nicht gelesen, bleibt aber als
// Prüf-Artefakt: baue-sammelpunkte-handkuriert.py vergleicht dagegen.

function zeichneRoute(punkte, upToIndex, bbox, strichstaerke = 2, offsetX = mapOffsetX, offsetY = mapOffsetY, alphaMultiplier = 1) {
  if (upToIndex < 1) return;
  let fadeStrecke = 20, minAlpha = 20, maxAlpha = 255;
  noFill();
  strokeWeight(strichstaerke);
  for (let i = 0; i < upToIndex && i < punkte.length - 1; i++) {
    let alter = upToIndex - i;
    let alpha = constrain(map(alter, 0, fadeStrecke, maxAlpha, minAlpha), minAlpha, maxAlpha) * alphaMultiplier;
    stroke(ROUTE_COLOR_RGB.r, ROUTE_COLOR_RGB.g, ROUTE_COLOR_RGB.b, alpha);
    let p0 = lonLatToScreen(punkte[i][0], punkte[i][1], bbox, offsetX, offsetY);
    let p1 = lonLatToScreen(punkte[i + 1][0], punkte[i + 1][1], bbox, offsetX, offsetY);
    line(p0.x, p0.y, p1.x, p1.y);
  }
}



// --- Export ------------------------------------------------------------
// 35 Namen: 13 als Wert, 5 p5-Hooks, 17 als Lesebindung.

// Konstanten, Funktionen und die vier nur befüllten Container: Die Bindung
// ändert sich nie, deshalb Wertzuweisung.
window.WEITERE_KAPITEL_NUMMERN = WEITERE_KAPITEL_NUMMERN;
window.KAPITEL_EINSTIEG_SCROLL_ENDE = KAPITEL_EINSTIEG_SCROLL_ENDE;
window.LEGENDE_VALENZ_OBEN_UNTEN = LEGENDE_VALENZ_OBEN_UNTEN;
window.LEGENDE_FWERT_OBEN_UNTEN = LEGENDE_FWERT_OBEN_UNTEN;
window.kapitelRegisterEintraege = kapitelRegisterEintraege;
window.markierungsEintraege = markierungsEintraege;
window.stationsMarker = stationsMarker;
window.zwischenMarker = zwischenMarker;
window.datenFuerKapitel = datenFuerKapitel;
window.kapitelHatEigeneAnsicht = kapitelHatEigeneAnsicht;
window.zeichneRoute = zeichneRoute;
window.setzeAnsichtsModus = setzeAnsichtsModus;
window.starteKapitelEinstieg = starteKapitelEinstieg;

// Die fünf p5-Hooks. Nicht optional: p5 sucht sie am window. Fehlt einer,
// bleibt das Bild schwarz, ohne Fehlermeldung.
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.windowResized = windowResized;

// Lesebindung für alles, was erst nach dem IIFE-Lauf gesetzt wird — eine
// Wertkopie wäre hier durchweg undefined.
function lesebindung(name, lies) {
  Object.defineProperty(window, name, { get: lies, configurable: true });
}
lesebindung('stationenData', () => stationenData);
lesebindung('uebersichtsRouten', () => uebersichtsRouten);
lesebindung('kapitelAnsichtsModus', () => kapitelAnsichtsModus);
lesebindung('kapitel1ZoomAmount', () => kapitel1ZoomAmount);
lesebindung('annotationText', () => annotationText);
lesebindung('kartenMarkierungenEl', () => kartenMarkierungenEl);
lesebindung('kapitelRegister', () => kapitelRegister);
lesebindung('legendeInhalt', () => legendeInhalt);
lesebindung('registerTabs', () => registerTabs);
lesebindung('modusZeile', () => modusZeile);
lesebindung('planEintrag', () => planEintrag);
lesebindung('graphEintrag', () => graphEintrag);
lesebindung('leerzeile', () => leerzeile);
lesebindung('alleEintrag', () => alleEintrag);
lesebindung('legendeValenzText', () => legendeValenzText);
lesebindung('legendeValenzKreis', () => legendeValenzKreis);
lesebindung('legendeFwertHinweis', () => legendeFwertHinweis);

})(); // Ende der Modulkapselung, siehe Kommentar oben
