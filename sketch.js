/* =============================================================================
   sketch.js — p5-Zeichnung für Bel-Ami v2
   Datenaufbereitung und Darstellung sind getrennt gehalten.
============================================================================= */

let stage, heroText, begleitTexte, kapitelEinstiegsTexte;
let annotationBoxEl; // #annotationBox — trägt die Positionsklasse (pos-oben-links etc.), siehe annotationBoxPosition()
let schlusstextEl;   // #schlusstext — Gegenstück zum Einstiegstext, blendet im Schlussakt ein
let naechstesKapitelEl; // #naechstesKapitel — Hinweis am Kapitelende, siehe draw()


// Nummer des folgenden Kapitels, oder null wenn es keines gibt (Kapitel 18 ist
// das letzte). Kapitel 1 hat seinen eigenen Scroll-Akt und ist hier nicht
// gemeint — der Hinweis gilt für die klickbaren Kapitel 02–18.
function naechstesKapitel(nr) {
  if (!nr) return null;
  let ziel = String(parseInt(nr, 10) + 1).padStart(2, '0');
  return kapitelHatEigeneAnsicht(ziel) ? ziel : null;
}
// Kapitel 02–18 öffnen sich per Klick (springeZuKapitelZoom/oeffneKapitelZoom),
// nicht scroll-gebunden wie Kapitel 1 — daher kein data-von/data-bis-Fenster
// möglich. Stattdessen ein fester Zeitfenster-Fade ab dem Klick-Zeitpunkt
// (kapitelEinstiegsStartMillis), siehe draw().
let kapitelEinstiegsStartMillis = null;
const KAPITEL_EINSTIEG_FADE_MS = 800;

// Setzt die Einstiegstext-Uhr neu. Von uebersichtsrouten.js beim
// Kapitelwechsel gerufen — vorher schrieb setzeKapitelAnsichtZurueck() dort
// direkt in diese Variable hinein (siehe docs/best-practices-review.md,
// "Handler-Dreieck").
function starteKapitelEinstieg() {
  kapitelEinstiegsStartMillis = millis();
}


// Der Einstiegstext blendet von selbst EIN (zeitbasiert, ab Klick-Zeitpunkt),
// danach übernimmt das Scrollen: zwischen diesen beiden Anteilen des
// Kapitel-Akts (uebersichtRoutenStart..uebersichtRoutenEnd) blendet er aus,
// und erst danach beginnen Route, Kreise und Annotationsbox. Vorher lief das
// über ein festes Zeitfenster von 14 Sekunden — der Text verschwand also auch
// dann, wenn man ihn noch las, und die Route startete ohne Zutun.
const KAPITEL_EINSTIEG_SCROLL_START = 0.015;
const KAPITEL_EINSTIEG_SCROLL_ENDE = 0.06;
// bgImage: Startseite/erste Übersicht vor dem Zoom in Kapitel 1
// (bilder-karten/paris-startkarte-web.png). bgImage2: "zweite" Übersichts-
// karte, die nach
// dem Rauszoomen aus Kapitel 1 gezeigt wird (Übersichtsrouten- und
// Kreisvergleich-Akt, bilder-karten/paris-ueberblickkarte-web.png). Beide
// stammen aus
// demselben QGIS-Ausschnitt und haben dieselben Pixelmasse, teilen sich also
// Bbox (uebersichtBbox) und Crop-Rechenweg — es wechselt nur, welches Bild
// gezeichnet wird (siehe currentBgImage in draw()).
let bgImage, bgImage2, ch1Image;
let kartenMarkierungenEl;
let stationenData;
let kapitel03Data; // eigenes Datenset fürs Kapitel-3-Spine-Panel (Kartenausschnitt-Zoom)

// Automatische Erstentwurf-Datensätze für Kapitel 2, 4–18 (siehe
// data-prep/05 bereinigen/baue-kapitel-stationen.py) — geladen, aber noch
// nirgends im Draw-Loop verwendet; das Verdrahten von Spine-Panel/Kreisen
// pro Kapitel (wie bisher nur für Kapitel 3) folgt in einem Folgeschritt.
const WEITERE_KAPITEL_NUMMERN = ['02', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
let weitereKapitelDaten = {}; // z.B. weitereKapitelDaten['04'].ortRuns
// Ortspunkte/Labels auf der Karte (Kapitel-1-Ansicht) sind derzeit dauerhaft
// ausgeblendet. Die DOM-Knoten werden weiterhin gebaut (baueKartenMarkierungen/
// baueStationsMarker/baueZwischenMarker in dom-aufbau.js), aber draw()
// überspringt ihre Positionierung: 16 Elemente x lonLatToScreen plus zwei
// style-Zuweisungen je Frame, deren Ergebnis niemand sieht.
//
// Auf true gesetzt läuft alles wieder — die Konstante steuert sowohl den
// Rechenweg als auch die 'sichtbar'-Klasse. Zum vollständigen Einblenden muss
// zusätzlich .karten-markierung .label { display: none } in style.css fallen,
// sonst erscheinen nur die Punkte ohne Beschriftung.
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
// Benannt nach der TEILUNG, nicht nach der Ansicht: Plan- und Graph-Ansicht
// teilen inzwischen beide oben/unten (siehe zeichneKreiseOrtRuns und
// zeichneSpineHorizontal), links/rechts bleibt nur im Schlussakt
// Ortsveränderung übrig.
const LEGENDE_VALENZ_LINKS_RECHTS = 'Volltonfarbe: links negativ, rechts positiv bewertet';
const LEGENDE_VALENZ_OBEN_UNTEN = 'Volltonfarbe: oben positiv, unten negativ bewertet';
let legendeFwertHinweis; // Positions-Hinweis der F-Wert-Punkte — ebenfalls ansichtsabhängig
const LEGENDE_FWERT_LINKS_RECHTS = 'Position ausserhalb des Kreises: negativ oben links, positiv oben rechts, neutral/unbewertet unten.';
const LEGENDE_FWERT_OBEN_UNTEN = 'Position ausserhalb des Kreises: positiv oben, negativ unten, neutral/unbewertet rechts.';
let legendeTab, legendeInhalt; // Tab (vertikal beschriftet, immer sichtbar solang legendeBox.sichtbar) + ausfahrender Inhalt (Farberklärung der Kreisgrafik)
let prologBox, prologTab; // Zweites Register direkt unter Legende (siehe #registerTabs in index.html) — gleiches Verhalten wie Legende, eigener (statischer, hart codierter) Inhalt Projekt-Hintergrund
let registerTabs; // gemeinsamer Fixed-Container beider Register (siehe #registerTabs in index.html) — trägt die legende-offen/prolog-offen-Klasse, an der sich der jeweils GESCHLOSSENE Tab orientiert, um mit ausrücken zu können (siehe CSS)

// Jede Kapitel-Ansicht (1–18) hat zwei Modi: 'karte' (Kartenausschnitt+Route,
// wie bisher) und 'grafik' (horizontale Spine, zentriert, mit Play-Animation
// statt Karte — siehe zeichneSpineHorizontal). Umschalten über die
// "Plan"/"Graph"-Einträge oben im Kapitel-Menübalken
// (setzeKapitelAnsichtModus).
let kapitelAnsichtsModus = 'karte';

// Setzt den Ansichtsmodus. Gerufen von setzeKapitelAnsichtModus()
// (spine-horizontal.js, Menübalken) und setzeKapitelAnsichtZurueck()
// (uebersichtsrouten.js, Kapitelwechsel) — beide schrieben vorher direkt in
// diese Variable hinein. Nur das Setzen liegt hier; was sonst noch zum
// Zurücksetzen gehört, macht jedes Modul für seinen eigenen Zustand
// (setzeGrafikZurueck in spine-horizontal.js, starteKapitelEinstieg oben).
function setzeAnsichtsModus(modus) {
  kapitelAnsichtsModus = modus;
}
// Zoomstand des Kapitel-1-Kartenausschnitts (0 = Startseite/Gesamtkarte,
// 1 = ganz im Ausschnitt), je Frame in draw() gesetzt. Wird ausserhalb von
// draw() gebraucht, um die Beschriftung des Routen-Startpunkts erst mit dem
// Kapitel einzublenden (siehe zeichneKreiseOrtRuns).
let kapitel1ZoomAmount = 0;
let grafikPlayButton;

// --- Übersichtsrouten (Kapitel 02–18, nur in der letzten, rausgezoomten Ansicht) ---
let uebersichtsRouten = {};

// --- Kapitelausschnitte: Startpunkt/Nummer einer Übersichtsroute wird zum
// Link, der auf den eigenen Kartenausschnitt dieses Kapitels zoomt. Nur
// Kapitel, die hier einen Eintrag haben, sind klickbar — das sind exakt die
// Kapitel, für die "bilder-karten/kapitelXX-{karte.png,bbox.json}"
// existiert (aktuell alle außer 01 — das hat sein eigenes, handverfeinertes
// System, siehe bilder-karten/kapitel01-qgis-karte-web.png/stationenData).
// vAnchor/hAnchor
// (optional, siehe coverCrop):
// verschieben den sichtbaren Ausschnitt vertikal bzw. horizontal innerhalb
// des Kapitelbilds, ohne die zugrundeliegende karte.png/bbox.json neu
// rendern zu müssen (0 = oberster/linker Bildrand sichtbar, 1 = unterster/
// rechter Bildrand sichtbar, 0.5 = zentriert, Default). Kapitel 3s
// Routenanfang liegt z.B. nahe am Nordrand seiner Bbox — ohne vAnchor-Bias
// würde der zentrierte Bildausschnitt genau dort beschneiden.
// Kapitel 17 hatte lange keinen eigenen Ausschnitt: seine Route reichte bis
// Saint-Germain-en-Laye, weit ausserhalb des Basisbilds. Seit die Landpartie
// zu EINEM Sammelpunkt am Westrand des Bois zusammengefasst ist (kurz vor dem
// Seineübergang) und La Roche-Guyon wie Cannes/Rouen als Ersatzpunkt dort
// sitzt, wo die Stadt verlassen wird, liegt das ganze Kapitel im Bild — es
// bekommt daher wie alle anderen einen eigenen Ausschnitt.
// Kapitel 06, 07, 09 und 10 bleiben nach der Literaturwissenschafts-Korrektur
// der ortRuns/Route vollständig innerhalb von Paris (kein Bahnhof/Verlassen
// der Stadt mehr — weit entfernte Handlungsorte wie "Bois du Vésinet" in
// Kapitel 07 oder "Fahrt über Rouen nach Canteleau..." in Kapitel 09 sind
// symbolisch an den Kartenrand gesetzt statt an ihre echten, weit
// entfernten Koordinaten; Kapitel 10 spielt ohnehin komplett in Paris,
// inkl. Bois de Boulogne) und bekommen daher einen eigenen, eng um die
// tatsächliche Route zugeschnittenen Kartenausschnitt.
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

// Liefert das (bereinigte) stationenData-Objekt für eine Kapitelnummer
// (String, zweistellig) — Kapitel 3 liegt in seiner eigenen Variable
// (kapitel03Data), alle anderen (02, 04–18) in weitereKapitelDaten.
function datenFuerKapitel(nr) {
  return nr === '03' ? kapitel03Data : weitereKapitelDaten[nr];
}

// Hat dieses Kapitel eine eigene, öffenbare Ansicht? Entweder einen eigenen
// Kartenausschnitt (kapitelKarten) oder zumindest ein Spine-Panel
// (KAPITEL_MIT_SPINE_PANEL in datenbereinigung.js).
//
// Die Regel stand vorher viermal im Code: dreimal in uebersichtsrouten.js
// (Hover-Test, oeffneKapitelZoom, springeZuKapitelZoom) und einmal in
// naechstesKapitel() oben, dort sogar nur zur Hälfte. Sie steht jetzt hier,
// bei ihren Geschwistern — sketch.js hält das Kapitelinventar.
//
// !!kapitelKarten[nr] prüft die INVENTARZUGEHÖRIGKEIT, nicht ob das Bild
// geladen ist: Die Einträge stehen als Literal da, .bild füllt erst
// preload(). Ein Kapitel in OHNE_EIGENEN_KARTENAUSSCHNITT behält seinen
// Eintrag und gilt hier weiterhin als vorhanden.
//
// Die ODER-Klausel kann heute nicht greifen — beide Listen führen dieselben
// 17 Kapitel (02–18). Sie bleibt trotzdem: Sie benennt die Absicht und hält
// beide Listen als gleichwertige Quellen. Dass es zwei handgepflegte Listen
// für dasselbe gibt, ist der eigentliche Mangel; eine einzige Quelle wäre
// der saubere Schnitt, aber das ist eine Datenstruktur-Entscheidung.
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
  // Destrukturierungs-ZUWEISUNG, bewusst ohne const/let: Die acht Handles
  // sind oben auf Modulebene deklariert, weil draw() sie jeden Frame liest.
  // Ein `const { … } =` hier würde funktionslokale Konstanten anlegen, die
  // Modulvariablen blieben undefined — Menübalken-Hervorhebung und
  // Legendentext fielen still aus.
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

  // letzterZoomKapitel bleibt auch nach dem Schliessen (zoomedKapitel=null)
  // gesetzt, damit das Spine-Panel während des Ausblendens
  // (kapitelZoomAmount -> 0) weiter die richtigen Daten zeigt, statt abrupt
  // zu verschwinden. Der Aufbau der Caches liegt in spine-horizontal.js,
  // dem die beiden Arrays gehören.
  if (zoomedKapitel) letzterZoomKapitel = zoomedKapitel;
  stelleSpineDatenBereit(letzterZoomKapitel);
  let targetCrop = coverCrop(ch1Image.width, ch1Image.height);
  let targetBbox = cropToBbox(targetCrop, ch1ImgBbox, ch1Image.width, ch1Image.height);

  let progress = getScrollProgress();
  // Ein offenes Kapitel endet mit seiner letzten Annotation — dahinter wird
  // nicht weitergescrollt: kein Hinübergleiten in den Kreisvergleich, kein
  // Ausblenden der Kapitelkarte. Die Scrollposition wird dafür am Ende des
  // Kapitel-Akts festgehalten; nach OBEN bleibt sie frei, das ist der Weg
  // zurück (siehe uebersichtRoutenFortschritt <= 0 -> schliesseKapitelZoom).
  if (zoomedKapitel && progress > SCROLL_MEILENSTEINE.uebersichtRoutenEnd) {
    progress = SCROLL_MEILENSTEINE.uebersichtRoutenEnd;
    let trackEl = document.querySelector('.scroll-track');
    window.scrollTo(0, trackEl.offsetHeight * progress);
  }
  scrollFortschrittFuellung.style.width = (progress * 100) + '%';

  // Wechsel Startseiten-Karte -> zweite Übersichtskarte genau an dem Punkt,
  // an dem bgImage ohnehin unsichtbar ist (voll in Kapitel 1 eingezoomt) —
  // dadurch kein sichtbarer Sprung. Rück-Scrollen über diesen Punkt schaltet
  // symmetrisch wieder auf die Startseiten-Karte zurück. Beide Bilder zeigen
  // denselben Ausschnitt (siehe uebersichtBbox) und haben dieselben
  // Pixelmasse — es wechselt also wirklich nur, welches gezeichnet wird.
  // Im Schlussakt kehrt die STARTkarte zurück (nicht die Überblickkarte) —
  // der Bogen schliesst dort, wo er begonnen hat. Jedes der beiden Bilder
  // bringt seine eigene Georeferenz mit.
  let imStartkarteAkt = progress >= SCROLL_MEILENSTEINE.startkarteStart;
  let zeigeStartkarte = progress < SCROLL_MEILENSTEINE.zoomEnd || imStartkarteAkt;
  let currentBgImage = zeigeStartkarte ? bgImage : bgImage2;
  let currentBgBbox = zeigeStartkarte ? startBbox : uebersichtBbox;
  let fullCrop = coverCrop(currentBgImage.width, currentBgImage.height, 0.5, 0.5, 0); // grosse Karte bleibt zentriert, unabhängig von mapOffsetX
  let fullBbox = cropToBbox(fullCrop, currentBgBbox, currentBgImage.width, currentBgImage.height);

  let zoomAmount = constrain(map(progress, SCROLL_MEILENSTEINE.zoomStart, SCROLL_MEILENSTEINE.zoomEnd, 0, 1), 0, 1);
  // Nach Abschluss der Route wieder auf die Gesamtkarte rauszoomen — die
  // Route/Kreise/Spine bleiben dabei sichtbar, da ihr Fortschritt
  // (routeAmount, unten) über constrain() bei 1 gehalten wird und nicht
  // vom Zoom abhängt.
  let zoomOutAmount = constrain(map(progress, SCROLL_MEILENSTEINE.zoomOutStart, SCROLL_MEILENSTEINE.zoomOutEnd, 0, 1), 0, 1);
  zoomAmount *= (1 - zoomOutAmount);
  kapitel1ZoomAmount = zoomAmount;

  // "In einer Kapitel-Ansicht" (1–18, für Menübalken/Ansichtsmodus/
  // Scroll-Fortschritt-Sichtbarkeit): entweder ein gezoomtes Kapitel 02–18
  // (zoomedKapitel) ODER Kapitel 1s eigener Kartenausschnitt (zoomAmount
  // mehrheitlich eingezoomt). inKapitelGrafikAnsicht zusätzlich nur, wenn
  // dort auch aktiv auf 'grafik' umgeschaltet wurde (siehe
  // setzeKapitelAnsichtModus).
  let inKapitel1Kartenausschnitt = !zoomedKapitel && zoomAmount > 0.5;
  let inKapitelAnsicht = !!zoomedKapitel || inKapitel1Kartenausschnitt;
  let inKapitelGrafikAnsicht = inKapitelAnsicht && kapitelAnsichtsModus === 'grafik';

  // Gemeinsamer Kapitel-1-Kartenoffset für alle Overlay-Elemente (Route,
  // Kreise/Labels, Ortsmarker, Foto-Marker): 0 bei zoomAmount=0 (zentrierte
  // Übersichtskarte sichtbar), voller mapOffsetX bei zoomAmount=1 (voll in
  // ch1Image gezoomt) — sonst blieben diese Elemente beim Rein-/Rauszoomen
  // gegenüber der jeweils sichtbaren Karte verschoben.
  let kartenOffsetX = lerp(0, mapOffsetX, zoomAmount);
  let kartenOffsetY = lerp(0, mapOffsetY, zoomAmount);

  // Übersichtsrouten/Kapitel-Zoom sind nur im letzten Akt (voll rausgezoomt)
  // erreichbar — schon hier berechnet, da activeBbox unten davon abhängt.
  // Auch der Weg zurück aus einem Kapitel-Zoom: Hoch-scrollen bis vor den
  // Anfang dieses Akts schliesst ihn wieder — Kapitel 1 ist die einzige
  // Ausnahme, das funktioniert weiterhin über Runter-scrollen.
  let uebersichtRoutenFortschritt = constrain(map(progress, SCROLL_MEILENSTEINE.uebersichtRoutenStart, SCROLL_MEILENSTEINE.uebersichtRoutenEnd, 0, 1), 0, 1);
  if (zoomedKapitel && uebersichtRoutenFortschritt <= 0) schliesseKapitelZoom(); // zurückgescrollt

  // Letzter Akt: Ortsveränderung an sieben kapitelübergreifenden Orten
  // (siehe zeichneOrtsveraenderung und die Phasen OV_*).
  // Schlussakt "Ortsveränderung" (siehe zeichneOrtsveraenderung): ein
  // durchgehender Fortschritt 0..1 über den ganzen Akt, aus dem sich die
  // Phasen ableiten. Der Kartenfade läuft nicht mehr sofort, sondern über
  // OV_KARTE_AUS — die Karte verschwindet langsam, während die senkrechten
  // Linien schon wachsen.
  let ovFortschritt = constrain(map(progress, SCROLL_MEILENSTEINE.kreisVergleichStart, SCROLL_MEILENSTEINE.kreisVergleichEnd, 0, 1), 0, 1);
  let skFortschritt = constrain(map(progress, SCROLL_MEILENSTEINE.startkarteStart, 1, 0, 1), 0, 1);
  let skEinblenden = ovPhase(skFortschritt, SK_EINBLENDEN);
  let skRauszoom = ovPhase(skFortschritt, SK_RAUSZOOM);
  if (schlusstextEl) schlusstextEl.style.opacity = ovPhase(skFortschritt, SK_TEXT);
  let kreisVergleichMapFade = ovPhase(ovFortschritt, OV_KARTE_AUS);
  // Ein noch offener Kapitel-Zoom soll nicht mit in diesen Akt "hinüber-
  // gescrollt" werden können (sonst läge sein Kartenausschnitt über dem
  // ausblendenden Übersichtsbild und dem neuen Kreis-Raster).
  if (zoomedKapitel && kreisVergleichMapFade > 0) schliesseKapitelZoom();

  // Kapitel-Zoom (Klick auf «04» etc., siehe oeffneKapitelZoom): öffnet sich
  // sofort mit voll sichtbarer Route, kein eigener Scroll-Akt — nur zeitlich
  // weich eingeblendet (wie zuvor).
  aktualisiereKapitelZoom();

  let activeBbox = {
    west: lerp(fullBbox.west, targetBbox.west, zoomAmount),
    east: lerp(fullBbox.east, targetBbox.east, zoomAmount),
    south: lerp(fullBbox.south, targetBbox.south, zoomAmount),
    north: lerp(fullBbox.north, targetBbox.north, zoomAmount),
  };

  // Schlusszoom auf den Ausschnitt, der die sieben Orte der Ortsveränderung
  // fasst — erst nachdem die Linien zurückgeschrumpft sind und die Punkte auf
  // ihrem echten Ort liegen (siehe OV_ZOOM). Dadurch rücken die Orte weit
  // genug auseinander, dass ihre Kreise sich nicht überlagern.
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
  // Ausserhalb des Blocks, weil die Positionswahl der Annotationsbox weiter
  // unten dieselbe (unanimierte) Ziel-Bbox braucht — mit der laufend
  // interpolierten activeBbox würde sie während des Reinzoomens wandern.
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

  // currentBgImage steht schon oben fest (zusammen mit fullBbox) — hier wird
  // daraus nur noch der zu zeichnende Bildausschnitt für die aktuelle
  // activeBbox berechnet.
  let bgCrop = bboxToImgCrop(activeBbox, currentBgBbox, currentBgImage.width, currentBgImage.height);
  // ch1Image "zoomt" nicht selbst mit — es blendet an seiner bereits fest
  // berechneten, korrekt proportionierten Zielposition (targetCrop) ein.
  // Ein dynamisch aus der (während des Übergangs noch viel zu grossen)
  // activeBbox berechneter Ausschnitt würde auf die Bildgrenzen geklemmt
  // und dabei im falschen Seitenverhältnis erscheinen (sichtbare Verzerrung
  // bei einer Strassenkarte).
  let ch1Crop = targetCrop;

  // (1 - kreisVergleichMapFade) blendet die Karte im Ortsveränderungs-Akt aus;
  // skEinblenden holt sie im allerletzten Akt zurück.
  tint(255, 255 * (1 - zoomAmount) * Math.max(1 - kreisVergleichMapFade, skEinblenden));
  image(currentBgImage, 0, 0, width, height, bgCrop.x, bgCrop.y, bgCrop.w, bgCrop.h);
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

  let routeAmount = constrain(map(progress, SCROLL_MEILENSTEINE.routeStart, SCROLL_MEILENSTEINE.routeEnd, 0, 1), 0, 1);

  let annListe = stationenData.annotationen;
  let annIndex = Math.min(annListe.length - 1, Math.floor(routeAmount * annListe.length));
  let punktIndex = annListe[annIndex].revealIndex;
  if (annListe[annIndex].vorRoutenstart) punktIndex = 0;

  let endStation = stationenData.route.filter(s => s.routeEndsHere).pop()
    || stationenData.route[stationenData.route.length - 1];
  let liniIndex = Math.min(punktIndex, endStation.revealIndex);

  // Übersichtsrouten (Kapitel 02–18) — beginnen erst zu zeichnen, wenn das
  // Rauszoomen vollständig abgeschlossen ist (eigener Akt danach). Zuerst
  // gezeichnet, damit Kapitel 1s Route (unten) und ihre Kreise (falls
  // sichtbar) darüber liegen. (uebersichtRoutenFortschritt bereits oben
  // berechnet, wird dort schon für den Kapitel-Zoom gebraucht.)
  let aktuelleAnnotationZoom = null;
  // Die Routen bleiben im Ortsveränderungs-Akt zunächst stehen, auch wenn die
  // Karte darunter ausblendet — auf sie kommen die Ortspunkte zu liegen. Erst
  // mit dem Zoom verschwinden sie ganz: bis dahin sind die Punkte gelandet,
  // und fürs Kapitelzählen soll der Hintergrund leer sein.
  //
  // Beim Rauszoomen im allerletzten Akt kommen sie zurück (Math.max) — das
  // Schlussbild ist wieder die ganze Karte mit allen achtzehn Routen, so wie
  // der Überblicksakt sie hinterlassen hat.
  // Unbedingt aufgerufen, auch bei Fortschritt 0: zeichneUebersichtsrouten()
  // steigt dann selbst früh aus und setzt dabei kapitelHover und den Cursor
  // zurück. Früher stand das hier in einem else-Zweig — draw() musste den
  // Zustand eines fremden Moduls von Hand nachziehen.
  let routenSichtbar = Math.max((1 - 0.45 * kreisVergleichMapFade) * (1 - ovZoom), skRauszoom);
  let routenAlpha = 180 * routenSichtbar;
  let uebersichtRoutenErgebnis = zeichneUebersichtsrouten(activeBbox, routenAlpha, uebersichtRoutenFortschritt);
  aktuelleAnnotationZoom = uebersichtRoutenErgebnis.aktuelleAnnotationZoom;

  // Kapitel 1s eigene Route/Kreise nutzen weiterhin activeBbox — sobald ein
  // ANDERES Kapitel gezoomt ist (zoomedKapitel), zeigt activeBbox aber dessen
  // Bbox, nicht mehr Kapitel 1s eigene Gegend. Ohne diese Sperre würde
  // Kapitel 1s (geografisch bedeutungslose) Route/Kreise über dem gezoomten
  // Kartenausschnitt des anderen Kapitels weitergezeichnet — das erzeugte
  // genau das chaotische Liniengewirr, das beim Testen auffiel.
  if (!zoomedKapitel) {
    // Strichstärke der Kapitel-1-Route läuft beim Rauszoomen von 10 auf 2 —
    // exakt die Stärke der Übersichtsrouten (siehe zeichneUebersichtsrouten),
    // damit Kapitel 1s Linie in der Gesamtkarten-Ansicht gleich dünn wirkt.
    // Kapitel 1s eigene Route folgt demselben Ausblenden wie die Übersichts-
    // routen oben — sonst verschwände sie schon mit der Karte, während die
    // anderen noch stehen.
    zeichneRoute(stationenData.routenPunkte, liniIndex, activeBbox, lerp(10, 2, zoomOutAmount), kartenOffsetX, kartenOffsetY,
      Math.max((1 - 0.45 * kreisVergleichMapFade) * (1 - ovZoom), skRauszoom));
    // Kreisgrafik (Karte) in der letzten Ansicht (Rauszoomen) für den Moment
    // ausgeblendet — Route/Spine bleiben davon unberührt sichtbar.
    if (zoomOutAmount <= 0) {
      zeichneKreiseOrtRuns(punktIndex, annIndex, activeBbox, kartenOffsetX, kartenOffsetY);
    }
  }

  // Letzter Akt: Ortsveränderung — senkrechte Linien wachsen gestaffelt,
  // die Karte blendet aus, die Linien schrumpfen zurück auf die echten Orte,
  // Zoom, dann wachsen die Kreise während die Kapitel durchzählen.
  if (ovFortschritt > 0 && !zoomedKapitel) {
    zeichneOrtsveraenderung(activeBbox, ovFortschritt, 255 * (1 - skRauszoom), 1 - skEinblenden);
  }

  // Grafische Ansicht (siehe kapitelAnsichtsModus): deckt Karte/Route/Kreise
  // dieses Frames vollständig mit einer eigenen, auf den Browser
  // zentrierten horizontalen Spine-Darstellung ab, statt der üblichen
  // rechten Spine-Spalte — siehe zeichneSpineHorizontal/aktualisiereGrafik.
  // In der Kartenansicht bleibt die rechte Spine-Spalte dagegen komplett
  // ausgeblendet (nicht mehr wie früher permanent während des Zooms
  // sichtbar).
  if (inKapitelGrafikAnsicht) {
    background(226, 230, 225); // #E2E6E1
    let grafikEintraege = spineEintraegeFuer(zoomedKapitel);
    let grafikDaten = zoomedKapitel ? datenFuerKapitel(zoomedKapitel) : stationenData;
    aktualisiereGrafikFortschritt();
    zeichneSpineHorizontal(grafikEintraege || [], grafikFortschritt, grafikDaten);
  }

  // Annotation — in der letzten Ansicht (Rauszoomen) für den Moment ausgeblendet.
  // Kapitel 1 (eigener Kartenausschnitt) läuft über routeAmount/annIndex;
  // ein gezoomtes anderes Kapitel (02–18) stattdessen über
  // aktuelleAnnotationZoom (siehe zeichneUebersichtsrouten oben) — beide
  // schliessen sich gegenseitig aus (zoomedKapitel ist nie gleichzeitig
  // Kapitel 1s eigene Ansicht).
  let aktuelleAnnotation = !zoomedKapitel
    ? ((routeAmount > 0 && zoomOutAmount <= 0) ? annListe[annIndex] : null)
    : (kapitelZoomAmount > 0.5 ? aktuelleAnnotationZoom : null);
  // Position der Box je Kapitel bestimmen (siehe annotationBoxPosition) — die
  // Ziel-Bbox des Kapitels, nicht die animierte activeBbox, sonst wanderte
  // die Wahl während des Reinzoomens.
  let positionKapitel = zoomedKapitel || '01';
  let positionBbox = zoomedKapitel ? kapitelTargetBbox : targetBbox;
  let positionDaten = zoomedKapitel ? datenFuerKapitel(zoomedKapitel) : stationenData;
  if (annotationBoxEl && positionBbox && positionDaten && positionDaten.ortRuns) {
    let position = annotationBoxPosition(positionKapitel, positionDaten, positionBbox);
    ANNOTATION_BOX_POSITIONEN.forEach(p => annotationBoxEl.classList.toggle('pos-' + p, p === position));
  }

  // Hinweis "Nächstes Kapitel" am Ende eines Kapitels (02–18). Sichtbar,
  // sobald der kapitel-eigene Fortschritt durchgelaufen ist — also Route
  // gezeichnet und die letzte Annotation erreicht. Nur in der Kartenansicht:
  // in der Graph-Ansicht sitzt an derselben Stelle der Play-Button (siehe
  // .scrolly-stage.grafik-ansicht #naechstesKapitel in style.css).
  // kapitelZoomAmount > 0.5 verhindert ein Aufblitzen während des Zoom-
  // Übergangs, naechstesKapitel() blendet ihn im Schlusskapitel 18 aus.
  if (naechstesKapitelEl) {
    let kapitelLokalerFortschritt = constrain(
      map(uebersichtRoutenFortschritt, KAPITEL_EINSTIEG_SCROLL_ENDE, 1, 0, 1), 0, 1);
    // Schwelle exakt dort, wo die LETZTE Annotation erscheint — dieselbe
    // Rechnung wie annIndexZoom in zeichneUebersichtsrouten
    // (floor(fortschritt * anzahl) erreicht anzahl-1). Ein fester Wert wie
    // 0.995 läge je nach Kapitellänge davor oder dahinter; bei 79
    // Annotationen etwa erst deutlich nach der letzten.
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

  // Kapitelregister (inkl. Plan/Graph + Alle oben drin) — sichtbar in JEDER
  // Kapitel-Ansicht (inKapitelAnsicht, oben berechnet: zoomedKapitel ODER
  // Kapitel 1s eigener Kartenausschnitt) UND zusätzlich schon in der
  // Übersicht (alle Kapitelrouten gleichzeitig, uebersichtRoutenFortschritt
  // > 0, noch kein Kapitel gezoomt) — so lässt sich von dort direkt in ein
  // Kapitel springen, ohne erst eines anklicken zu müssen. Nicht mehr im
  // letzten Akt (Kreisvergleich, kreisVergleichMapFade > 0), der ersetzt die
  // Übersichtskarte durch das Kreis-Raster. Legende bleibt bewusst NUR in
  // der eigentlichen Kapitel-Ansicht sichtbar (in der Übersicht gibt es
  // keine Kreisgrafik, die sie erklären könnte).
  let inUebersichtRouten = uebersichtRoutenFortschritt > 0 && !zoomedKapitel && kreisVergleichMapFade <= 0;
  kapitelRegister.classList.toggle('sichtbar', inKapitelAnsicht || inUebersichtRouten);

  // Legende und Prolog sind überall sichtbar AUSSER auf der Startkarte —
  // dort soll nichts vom Einstieg ablenken. Auf der Schlusskarte bleibt nur
  // der Prolog stehen: die Kreisgrafik ist dann verblasst, die Legende hätte
  // nichts mehr zu erklären.
  //
  // Beide Register hängen an einem gemeinsamen fixed-Container und werden
  // über visibility (nicht display) geschaltet — der Prolog bleibt deshalb
  // an seinem Platz, auch wenn die Legende darüber verschwindet.
  let aufStartkarte = progress < SCROLL_MEILENSTEINE.zoomStart;
  let aufSchlusskarte = progress >= SCROLL_MEILENSTEINE.startkarteStart;
  legendeBox.classList.toggle('sichtbar', !aufStartkarte && !aufSchlusskarte);
  prologBox.classList.toggle('sichtbar', !aufStartkarte);

  // Ausgefahrener Inhalt fährt ein, sobald sein Register verschwindet —
  // taucht es später wieder auf, startet es eingefahren (nur der Tab) statt
  // im zuletzt offenen Stand.
  if (aufStartkarte || aufSchlusskarte) {
    legendeBox.classList.remove('offen');
    registerTabs.classList.remove('legende-offen');
  }
  if (aufStartkarte) {
    prologBox.classList.remove('offen');
    registerTabs.classList.remove('prolog-offen');
  }
  // Plan/Graph (inkl. Leerzeile darunter) braucht es nur innerhalb einer
  // echten Kapitel-Ansicht — in der Übersicht gibt es keine Karte/Grafik zum
  // Umschalten, dafür ist dort "Alle" selbst der aktive Eintrag.
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
    // Neutral bis auf "Alle" (oben schon gesetzt): kein Kapitel ist "aktiv",
    // sonst bliebe eine veraltete Hervorhebung vom zuletzt betrachteten
    // Kapitel stehen.
    Object.values(kapitelRegisterEintraege).forEach(eintrag => eintrag.classList.remove('aktiv'));
  }

  // Untere Scroll-Fortschritt-Leiste: nur ausserhalb jeder Kapitel-Ansicht
  // sichtbar (dort ersatzlos in der Kartenansicht, ersetzt durch den
  // Play-Button in der grafischen Ansicht).
  scrollFortschritt.classList.toggle('versteckt', inKapitelAnsicht);
  grafikPlayButton.classList.toggle('sichtbar', inKapitelGrafikAnsicht);
  grafikPlayButton.textContent = grafikSpielt ? '❚❚' : '▶';

  // Kartenbezogene DOM-Overlays (Ortsmarker, Gedanken-Spalte, Karten-
  // Markierungen, Annotation-Box) blenden sich in der grafischen Ansicht
  // per CSS aus (siehe .scrolly-stage.grafik-ansicht in style.css).
  stage.classList.toggle('grafik-ansicht', inKapitelGrafikAnsicht);

  // Legende an die Ansicht anpassen: in JEDER Kapitel-Ansicht — Plan wie
  // Graph — sind die Valenz-Halbkreise oben/unten geteilt. Links/rechts gilt
  // nur noch ausserhalb davon, im Schlussakt Ortsveränderung (siehe
  // zeichneOrtsveraenderung), wo die Legende ebenfalls noch sichtbar ist.
  if (legendeValenzText) {
    legendeValenzText.textContent = inKapitelAnsicht ? LEGENDE_VALENZ_OBEN_UNTEN : LEGENDE_VALENZ_LINKS_RECHTS;
    legendeValenzKreis.classList.toggle('valenz-oben-unten', inKapitelAnsicht);
    legendeFwertHinweis.textContent = inKapitelAnsicht ? LEGENDE_FWERT_OBEN_UNTEN : LEGENDE_FWERT_LINKS_RECHTS;
  }

  // DOM-Marker — Ortspunkte/Labels auf der Karte (Kapitel-1-Ansicht). Derzeit
  // ausgeblendet und deshalb komplett übersprungen, siehe
  // KARTEN_MARKER_SICHTBAR oben. Route/Kreisgrafik/Spine sind davon unberührt.
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

  // Hero / Marker Opacity
  let heroProgress = constrain(map(progress, SCROLL_MEILENSTEINE.heroFadeStart, SCROLL_MEILENSTEINE.heroFadeEnd, 0, 1), 0, 1);
  let heroFade = heroProgress * heroProgress * heroProgress;
  let heroOpacity = 1 - heroFade;
  heroText.forEach(el => el.style.opacity = heroOpacity);

  // Begleittexte: beliebig viele <p class="begleittext" data-von="…" data-bis="…">
  // — jeder blendet sich in seinem eigenen Scroll-Fenster (Anteil 0–1 der
  // gesamten Scrollstrecke) ein und wieder aus. Neue Texte = einfach neue
  // <p>-Tags in index.html, kein JS nötig.
  begleitTexte.forEach(el => {
    let von = parseFloat(el.dataset.von);
    let bis = parseFloat(el.dataset.bis);
    let fadeDauerMax = 0.142857; // 0.2 auf die verlängerte Scrollstrecke umskaliert (2200/3080)
    // Auf höchstens 35% des Anzeige-Fensters begrenzt (statt sonst würden
    // sich Ein- und Ausblend-Rampe bei kurzen Fenstern überlappen, bevor die
    // Box volle Deckkraft erreicht) — lässt zusätzlich ein echtes Plateau bei
    // opacity 1 übrig (mind. 30% des Fensters), statt nur einen einzigen
    // Momentanpunkt zu treffen.
    let fadeDauer = Math.min(fadeDauerMax, (bis - von) * 0.35);
    let opacity = constrain(
      Math.min(
        map(progress, von, von + fadeDauer, 0, 1),
        map(progress, bis - fadeDauer, bis, 1, 0)
      ),
      0, 1
    );
    // Kapitel 1 hat keinen eigenen .kapitel-einstiegstext — in seiner
    // Graph-Ansicht steht an dieser Stelle der Begleittext des laufenden
    // Scroll-Fensters. Damit "Play blendet den Einstiegstext aus" auch dort
    // greift, bekommt er hier denselben Play-Ausblendweg. Nur in der
    // Graph-Ansicht: in der Kartenansicht ist der Begleittext die normale,
    // scroll-gesteuerte Erzählspur und muss unberührt bleiben.
    if (inKapitelGrafikAnsicht && grafikPlayAusblendStart !== null) {
      opacity = Math.min(opacity, 1 - constrain(
        map(millis() - grafikPlayAusblendStart, 0, KAPITEL_EINSTIEG_FADE_MS, 0, 1), 0, 1));
    }
    el.style.opacity = opacity;
  });
  // Kapitel-Einstiegstexte (02–18): zeitbasierter Fade ab Klick-Zeitpunkt
  // (kapitelEinstiegsStartMillis, gesetzt in setzeKapitelAnsichtZurueck) —
  // kein data-von/data-bis möglich, da diese Kapitel per Klick statt per
  // Scroll-Fortschritt öffnen (siehe springeZuKapitelZoom/oeffneKapitelZoom).
  // Zusätzlich mit kapitelZoomAmount multipliziert, damit der Text beim
  // Schliessen/Wechseln synchron mit der Karte mit-ausblendet.
  // Übersichtsakt: jedes Kapitel bekommt seine eigene Scheibe des Akts
  // (i/n .. (i+1)/n, dieselbe Aufteilung wie die Routen in
  // zeichneUebersichtsrouten). Sobald eine Route zu wachsen beginnt, blendet
  // der Einstiegstext dieses Kapitels ein und wieder aus, bevor das nächste
  // an die Reihe kommt.
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
        // Einblenden über das erste Achtel der Scheibe, ausblenden gegen ihr
        // Ende. Das Fenster ist bewusst breit gehalten: seit die Scheiben
        // nach Routenlänge gewichtet sind, haben kurze Kapitel deutlich
        // weniger Strecke, und ihr Text soll trotzdem lesbar bleiben.
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
      // Graph-Ansicht: zusätzlicher, zeitbasierter Ausblendweg ab dem
      // Play-Klick (grafikPlayAusblendStart) — gleiche Dauer wie das
      // Einblenden, damit Text und Animation sauber ineinander übergehen.
      let ausblendenPlay = grafikPlayAusblendStart === null ? 1 :
        1 - constrain(map(millis() - grafikPlayAusblendStart, 0, KAPITEL_EINSTIEG_FADE_MS, 0, 1), 0, 1);
      opacity = Math.min(einblenden, ausblenden, ausblendenPlay) * kapitelZoomAmount * (1 - kreisVergleichMapFade);
    }
    el.style.opacity = opacity;
  });
  // Foto-Marker (separate, additive Ebene) — ganz zuletzt, über allem anderen.
  // Nutzt denselben Offset wie die jeweils sichtbare Karte: kartenOffsetX/Y
  // für Übersichts-/Kapitel-1-Ansicht (blendet dort zwischen 0 und
  // mapOffsetX), aber den FIXEN mapOffsetX/Y, sobald ein einzelnes Kapitel
  // (04–18) gezoomt ist — dessen Kartenausschnitt/Route wird immer mit dem
  // fixen mapOffsetX/Y gezeichnet (siehe kapitelCrop/"Genauere Route" oben),
  // nicht mit kartenOffsetX/Y (das bleibt im letzten Akt durchgehend bei 0).
  // Ohne diese Unterscheidung sassen die Foto-Marker bei offenem
  // Kapitel-Zoom sichtbar neben der eigentlichen Karte.
  let fotoOffsetX = (zoomedKapitel && kapitelZoomAmount > 0.001) ? mapOffsetX : kartenOffsetX;
  let fotoOffsetY = (zoomedKapitel && kapitelZoomAmount > 0.001) ? mapOffsetY : kartenOffsetY;
  merkeKartenlage(activeBbox, fotoOffsetX, fotoOffsetY);
  // In der grafischen Ansicht deckt zeichneSpineHorizontal (oben) die Karte
  // bereits vollständig ab — Foto-Marker blieben sonst sichtbar darüber
  // schweben.
  // kartenZoomFaktor fürs Skalieren der Sternchen-Grösse: der grössere von
  // Kapitel-1-eigenem Zoom (zoomAmount) und Kapitel-Zoom (kapitelZoomAmount)
  // — je nachdem, welche der beiden Kartenausschnitt-Arten gerade aktiv ist.
  if (!inKapitelGrafikAnsicht) zeichneFotoMarker(activeBbox, fotoOffsetX, fotoOffsetY, 1 - kreisVergleichMapFade, Math.max(zoomAmount, kapitelZoomAmount));
}

// ---------------------------------------------------------------------------
// Sonifikations-Play-Modus (sonifikation.js) — zeitbasierte Kapitel-1-Wiedergabe
// ---------------------------------------------------------------------------
// Liefert nur noch den Ton (spieleKapitel1SonifikationAudio/
// beendeSonifikationAudio in sonifikation.js) — das Bild dazu ist die ganz
// normale Graph-Ansicht (zeichneSpineHorizontal), siehe toggleGrafikPlay/
// aktuelleGrafikAnimationDauer weiter unten. Frühere Fassung hatte hier ein
// eigenes, per window.sonifikationSpieltAb kurzgeschlossenes Karten-Bild —
// entfernt, da es die Graph-Ansicht beim Abspielen unerwartet verdeckte.

function mousePressed() {
  if (kapitelHover === '01') { scrolleZuKapitel1(); return; }
  // Über springeZuKapitelZoom statt direkt über oeffneKapitelZoom: Der
  // Einstiegstext und der Start der Kapitelroute hängen am Fortschritt
  // INNERHALB des uebersichtRouten-Akts (siehe KAPITEL_EINSTIEG_SCROLL_ENDE).
  // Die Routen-Startpunkte sind aber erst sichtbar, wenn man schon ein gutes
  // Stück in den Akt gescrollt hat — ein Klick dort öffnete das Kapitel
  // deshalb mitten im Ablauf: Einstiegstext längst ausgeblendet, Route schon
  // fertig gezeichnet. springeZuKapitelZoom setzt die Scrollposition zuerst
  // an den Anfang des Akts zurück, genau wie der Klick im Kapitelregister.
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

// Das frühere 4er-Raster des Kreisvergleichs (zeichneKreisVergleich) ist
// entfallen — dieselbe Information steht jetzt an den echten Orten auf der
// Karte, siehe zeichneOrtsveraenderung. kreisvergleich-orte.json bleibt als
// Datenartefakt bestehen: baue-sammelpunkte-handkuriert.py prüft bei jedem
// Kapitel-Neubau dagegen, ob sich die kapitelübergreifenden Summen geändert
// haben.

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

