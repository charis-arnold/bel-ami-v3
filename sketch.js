/* =============================================================================
   sketch.js — p5-Zeichnung für Bel-Ami v2
   Datenaufbereitung und Darstellung sind getrennt gehalten.
============================================================================= */

const HATCH_SPACING = 3;

let stage, heroText, begleitTexte, kapitelEinstiegsTexte;
let annotationBoxEl; // #annotationBox — trägt die Platz-Klasse, siehe annotationBoxPlatz()
let schlusstextEl;   // #schlusstext — Gegenstück zum Einstiegstext, blendet im Schlussakt ein
let naechstesKapitelEl; // #naechstesKapitel — Hinweis am Kapitelende, siehe draw()

// Nummer des folgenden Kapitels, oder null wenn es keines gibt (Kapitel 18 ist
// das letzte). Kapitel 1 hat seinen eigenen Scroll-Akt und ist hier nicht
// gemeint — der Hinweis gilt für die klickbaren Kapitel 02–18.
function naechstesKapitel(nr) {
  if (!nr) return null;
  let ziel = String(parseInt(nr, 10) + 1).padStart(2, '0');
  return kapitelKarten[ziel] ? ziel : null;
}
// Kapitel 02–18 öffnen sich per Klick (springeZuKapitelZoom/oeffneKapitelZoom),
// nicht scroll-gebunden wie Kapitel 1 — daher kein data-von/data-bis-Fenster
// möglich. Stattdessen ein fester Zeitfenster-Fade ab dem Klick-Zeitpunkt
// (kapitelEinstiegsStartMillis), siehe draw().
let kapitelEinstiegsStartMillis = null;
const KAPITEL_EINSTIEG_FADE_MS = 800;
// Der Einstiegstext blendet von selbst EIN (zeitbasiert, ab Klick-Zeitpunkt),
// danach übernimmt das Scrollen: zwischen diesen beiden Anteilen des
// Kapitel-Akts (uebersichtRoutenStart..uebersichtRoutenEnd) blendet er aus,
// und erst danach beginnen Route, Kreise und Annotationsbox. Vorher lief das
// über ein festes Zeitfenster von 14 Sekunden — der Text verschwand also auch
// dann, wenn man ihn noch las, und die Route startete ohne Zutun.
const KAPITEL_EINSTIEG_SCROLL_START = 0.015;
const KAPITEL_EINSTIEG_SCROLL_ENDE = 0.06;
// bgImage: Startseite/erste Übersicht vor dem Zoom in Kapitel 1
// (paris-startkarte-web.png). bgImage2: "zweite" Übersichtskarte, die nach
// dem Rauszoomen aus Kapitel 1 gezeigt wird (Übersichtsrouten- und
// Kreisvergleich-Akt, paris-ueberblickkarte-web.png). Beide stammen aus
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
let orteOhneAdresse; // Platzhalter-Box unterhalb des Kapitelregisters, liefert die Bildschirmposition für zeichneOrteOhneAdresse()
let legendeBox; // Register-Container (Tab+Inhalt), mitte rechts — sichtbar wie kapitelRegister (Plan UND Graph)
let legendeValenzText, legendeValenzKreis; // Valenz-Zeile der Legende — Text/Symbol wechseln je Ansicht (siehe draw())
const LEGENDE_VALENZ_KARTE = 'Volltonfarbe: links negativ, rechts positiv bewertet';
const LEGENDE_VALENZ_GRAPH = 'Volltonfarbe: oben positiv, unten negativ bewertet';
let legendeFwertHinweis; // Positions-Hinweis der F-Wert-Punkte — ebenfalls ansichtsabhängig
const LEGENDE_FWERT_KARTE = 'Position ausserhalb des Kreises: negativ oben links, positiv oben rechts, neutral/unbewertet unten.';
const LEGENDE_FWERT_GRAPH = 'Position ausserhalb des Kreises: positiv oben, negativ unten, neutral/unbewertet rechts.';
let legendeTab, legendeInhalt; // Tab (vertikal beschriftet, immer sichtbar solang legendeBox.sichtbar) + ausfahrender Inhalt (Farberklärung der Kreisgrafik)
let prologBox, prologTab; // Zweites Register direkt unter Legende (siehe #registerTabs in index.html) — gleiches Verhalten wie Legende, eigener (statischer, hart codierter) Inhalt Projekt-Hintergrund
let registerTabs; // gemeinsamer Fixed-Container beider Register (siehe #registerTabs in index.html) — trägt die legende-offen/prolog-offen-Klasse, an der sich der jeweils GESCHLOSSENE Tab orientiert, um mit ausrücken zu können (siehe CSS)

// Jede Kapitel-Ansicht (1–18) hat zwei Modi: 'karte' (Kartenausschnitt+Route,
// wie bisher) und 'grafik' (horizontale Spine, zentriert, mit Play-Animation
// statt Karte — siehe zeichneSpineHorizontal). Umschalten über die
// "Plan"/"Graph"-Einträge oben im Kapitel-Menübalken
// (setzeKapitelAnsichtModus).
let kapitelAnsichtsModus = 'karte';
// Zoomstand des Kapitel-1-Kartenausschnitts (0 = Startseite/Gesamtkarte,
// 1 = ganz im Ausschnitt), je Frame in draw() gesetzt. Wird ausserhalb von
// draw() gebraucht, um die Beschriftung des Routen-Startpunkts erst mit dem
// Kapitel einzublenden (siehe zeichneKreiseOrtRuns).
let kapitel1ZoomAmount = 0;
let grafikPlayButton;

// --- Foto-Marker: Marker, Popup und Trefferradius liegen in fotomarker.js. ---
// Diese beiden Merker stehen noch hier. Ihre Deklaration initialisiert sich aus
// mapOffsetX/mapOffsetY und wird BEIM LADEN ausgewertet — solange die beiden
// ebenfalls in sketch.js standen, hätte das in einer vorher geladenen Datei
// nicht getragen. Seit geo-projektion.js sie führt und VOR fotomarker.js
// geladen wird, wäre ein Umzug dorthin möglich (siehe
// docs/modularisierung-log.md, Modul 6).
let letzterFotoOffsetX = mapOffsetX, letzterFotoOffsetY = mapOffsetY; // fürs Hit-Testing in mousePressed

// --- Übersichtsrouten (Kapitel 02–18, nur in der letzten, rausgezoomten Ansicht) ---
let uebersichtsRouten = {};

// --- Kapitelausschnitte: Startpunkt/Nummer einer Übersichtsroute wird zum
// Link, der auf den eigenen Kartenausschnitt dieses Kapitels zoomt. Nur
// Kapitel, die hier einen Eintrag haben, sind klickbar — das sind exakt die
// Kapitel, für die "kapitel karten/kapitelXX-{karte.png,bbox.json}"
// existiert (aktuell alle außer 01 — das hat sein eigenes, handverfeinertes
// System, siehe kapitel01-qgis-karte-web.png/stationenData). vAnchor/hAnchor
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
let zoomedKapitel = null;      // z.B. '03', oder null (Übersicht)
let kapitelZoomAmount = 0;     // 0 = Übersicht, 1 = voll in Kapitelausschnitt gezoomt
let kapitelHover = null;       // Kapitelnummer unter der Maus (fürs Cursor/Highlight)
let letzterZoomKapitel = null; // bleibt waehrend des Ausblendens gesetzt, siehe draw()

// Liefert das (bereinigte) stationenData-Objekt für eine Kapitelnummer
// (String, zweistellig) — Kapitel 3 liegt in seiner eigenen Variable
// (kapitel03Data), alle anderen (02, 04–18) in weitereKapitelDaten.
function datenFuerKapitel(nr) {
  return nr === '03' ? kapitel03Data : weitereKapitelDaten[nr];
}

function preload() {
  bgImage = loadImage('paris-startkarte-web.png');
  bgImage2 = loadImage('paris-ueberblickkarte-web.png');
  ch1Image = loadImage('kapitel01-qgis-karte-web.png');

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
    // Ordnername "kapitel karten" enthält ein Leerzeichen — explizit als
    // %20 kodiert, damit loadImage/loadJSON (fetch-basiert) den Pfad
    // zuverlässig auflösen, unabhängig vom Server/Browser-Verhalten.
    kapitelKarten[nr].bild = loadImage(`kapitel%20karten/kapitel${nr}-karte.png`);
    kapitelKarten[nr].bboxRaw = loadJSON(`kapitel%20karten/kapitel${nr}-bbox.json`);
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
  orteOhneAdresse = document.getElementById('orteOhneAdresse');
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
  baueKapitelRegister();
  baueLegende();
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

  if (spineEintraegep5.length === 0 && stationenData.ortRuns) {
    spineEintraegep5 = baueSpineDaten(stationenData, ortRunsFuerSpine(stationenData), { parisAllgemein: PARIS_ALLGEMEIN });
  }
  // Generisches Spine-Panel fürs jeweils gezoomte Kapitel (02–18, ausser 01 —
  // das hat sein eigenes live wachsendes Panel), einmal berechnet und dann
  // gecacht — die Hauptorte kommen aber wie bei Kapitel 1 dynamisch aus
  // ortRunsFuerSpine(daten), nicht mehr aus einer je Kapitel von Hand
  // gepflegten Liste (siehe KAPITEL_MIT_SPINE_PANEL in datenbereinigung.js).
  // letzterZoomKapitel bleibt auch nach dem Schliessen (zoomedKapitel=null)
  // gesetzt, damit das Panel während des Ausblendens (kapitelZoomAmount -> 0)
  // weiter die richtigen Daten zeigt, statt abrupt zu verschwinden.
  if (zoomedKapitel) letzterZoomKapitel = zoomedKapitel;
  if (letzterZoomKapitel && !spineEintraegeKapitel[letzterZoomKapitel]) {
    let daten = datenFuerKapitel(letzterZoomKapitel);
    if (daten && daten.ortRuns) {
      spineEintraegeKapitel[letzterZoomKapitel] = baueSpineDaten(daten, ortRunsFuerSpine(daten));
    }
  }
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
  kapitelZoomAmount = lerp(kapitelZoomAmount, zoomedKapitel ? 1 : 0, 0.08);

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
  // Ausserhalb des Blocks, weil die Platzwahl der Annotationsbox weiter unten
  // dieselbe (unanimierte) Ziel-Bbox braucht — mit der laufend
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
  if (uebersichtRoutenFortschritt > 0) {
    let routenSichtbar = Math.max((1 - 0.45 * kreisVergleichMapFade) * (1 - ovZoom), skRauszoom);
    let routenAlpha = 180 * routenSichtbar;
    let uebersichtRoutenErgebnis = zeichneUebersichtsrouten(activeBbox, routenAlpha, uebersichtRoutenFortschritt);
    aktuelleAnnotationZoom = uebersichtRoutenErgebnis && uebersichtRoutenErgebnis.aktuelleAnnotationZoom;
  } else {
    kapitelHover = null; // Routen (und damit Hover-Ziele) aktuell nicht gezeichnet
    cursor(ARROW);
  }

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
    let grafikEintraege = zoomedKapitel ? spineEintraegeKapitel[zoomedKapitel] : spineEintraegep5;
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
  // Platz der Box je Kapitel bestimmen (siehe annotationBoxPlatz) — die
  // Ziel-Bbox des Kapitels, nicht die animierte activeBbox, sonst wanderte
  // die Wahl während des Reinzoomens.
  let platzKapitel = zoomedKapitel || '01';
  let platzBbox = zoomedKapitel ? kapitelTargetBbox : targetBbox;
  let platzDaten = zoomedKapitel ? datenFuerKapitel(zoomedKapitel) : stationenData;
  if (annotationBoxEl && platzBbox && platzDaten && platzDaten.ortRuns) {
    let platz = annotationBoxPlatz(platzKapitel, platzDaten, platzBbox);
    ANNOTATION_BOX_PLAETZE.forEach(p => annotationBoxEl.classList.toggle('pos-' + p, p === platz));
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

  // Orte-ohne-Adresse-Box direkt unterhalb des Kapitelregisters andocken
  // (dessen Höhe variiert nicht, aber so bleibt es robust gegen künftige
  // Änderungen an der Registergröße) — nur in der Kartenansicht relevant,
  // im Strahl-Modus (Spine) gibt es keine geografischen Kreise.
  orteOhneAdresse.classList.toggle('sichtbar', inKapitelAnsicht && kapitelAnsichtsModus === 'karte');
  if (inKapitelAnsicht) {
    let registerRect = kapitelRegister.getBoundingClientRect();
    orteOhneAdresse.style.top = (registerRect.bottom + 12) + 'px';
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

  // Legende an die Ansicht anpassen: in der Graph-Ansicht sind die
  // Valenz-Halbkreise oben/unten geteilt, auf der Karte links/rechts.
  if (legendeValenzText) {
    legendeValenzText.textContent = inKapitelGrafikAnsicht ? LEGENDE_VALENZ_GRAPH : LEGENDE_VALENZ_KARTE;
    legendeValenzKreis.classList.toggle('valenz-oben-unten', inKapitelGrafikAnsicht);
    legendeFwertHinweis.textContent = inKapitelGrafikAnsicht ? LEGENDE_FWERT_GRAPH : LEGENDE_FWERT_KARTE;
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
  letzteActiveBbox = activeBbox;
  letzterFotoOffsetX = fotoOffsetX;
  letzterFotoOffsetY = fotoOffsetY;
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

// ---------------------------------------------------------------------------
// Kreise
// ---------------------------------------------------------------------------

function drawHatchedCircle(cx, cy, r, color, alphaSkala = 1) {
  if (r <= 0) return;
  const ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55 * alphaSkala;
  ctx.lineWidth = 1.8;
  for (let ly = cy - r; ly <= cy + r; ly += HATCH_SPACING) {
    ctx.beginPath();
    ctx.moveTo(cx - r, ly);
    ctx.lineTo(cx + r, ly);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

// Orte ohne konkrete Adresse werden nicht mehr in einen einzigen
// "UNBESTIMMT"-Topf geworfen, sondern nach Art des Inhalts getrennt: reine
// Ortsunkenntnis (generisches "Unbestimmt (Kapitel XX)"/PARIS_ALLGEMEIN)
// gegenüber Erinnerung/Phantasie/Wunsch/Gedanken — Inhalte, die gar keine
// reale Szene an einem echten Ort sind, sondern im Kopf der Figur spielen
// (siehe Kapitel 3: Kindheitserinnerung, erträumtes Liebesabenteuer, etc.).
// Reihenfolge hier bestimmt die Stapel-Reihenfolge in zeichneOrteOhneAdresse.
const SAMMELPUNKT_KATEGORIEN = [
  { prefix: 'Erinnerung (Kapitel', label: 'ERINNERUNG' },
  { prefix: 'Phantasie (Kapitel', label: 'PHANTASIE' },
  { prefix: 'Wunsch (Kapitel', label: 'WUNSCH' },
  { prefix: 'Gedanken (Kapitel', label: 'GEDANKEN' },
  { prefix: 'Unbestimmt (Kapitel', label: 'UNBESTIMMT' },
];

function sammelpunktKategorie(ort) {
  if (PARIS_ALLGEMEIN.has(ort)) return 'UNBESTIMMT';
  let treffer = SAMMELPUNKT_KATEGORIEN.find(k => ort.startsWith(k.prefix));
  return treffer ? treffer.label : null;
}

function leereBandCounts() {
  return {
    gold_dunkel: { neg: 0, pos: 0, neutral: 0, unrated: 0 },
    gold_mittel: { neg: 0, pos: 0, neutral: 0, unrated: 0 },
    gold_hell: { neg: 0, pos: 0, neutral: 0, unrated: 0 },
  };
}

function zeichneKreiseOrtRuns(punktIndex, annIndex, activeBbox, offsetX = mapOffsetX, offsetY = mapOffsetY, daten = stationenData) {
  let runs = daten.ortRuns || [];
  let keineAdresseNachKategorie = new Map(); // Label -> bandCounts
  let labelKandidaten = [];

  runs.forEach(r => {
    if (punktIndex < r.revealIndex) return;
    if (istVorzeitigeErwaehnung(r, daten)) return;
    // Die folgenden drei Ausnahmen gehören zu Kapitel-1-eigenen Mechanismen
    // (Gedanken-Spalte, Wohnung/Rue-Notre-Dame-Split) und dürfen nur dort
    // greifen: sie sind reine Namens-Sets ohne Kapitelbezug, und mehrere
    // automatisch gebaute Kapitel (z.B. Kapitel 3) verwenden zufällig
    // denselben ortBasis-Namen (z.B. "Parc Monceau") für einen eigenen,
    // echten Ort — ohne diesen Kapitel-1-Filter würde dessen Kreis
    // faelschlich komplett unterdrückt.
    if (daten === stationenData) {
      if (WOHNUNG_SAMMELPUNKT_ABSORBIERTE_ORTRUNS.has(r.ort)) return;
      if (GEDANKEN_ORTRUN_UNTERDRUECKT.has(r.ort)) return;
      if (r.ort === RUE_NOTRE_DAME_DE_LORETTE_ORT && annIndex < wohnungSplitAi(daten)) return;
    }
    // Orte ohne echte, konkrete Adresse (Kapitel-1s Alt-Sammelbecken
    // "Paris (allgemein)" & Co. — PARIS_ALLGEMEIN — sowie der generische
    // Sammelpunkt "Unbestimmt (Kapitel XX)" der automatisch gebauten
    // Kapitel 02–18): erscheinen nicht mehr auf der Karte an einer
    // erfundenen Koordinate, sondern gesammelt als ein Kreis unterhalb des
    // Kapitelregisters (siehe zeichneOrteOhneAdresse-Aufruf am Funktionsende).
    let kategorie = sammelpunktKategorie(r.ort);
    if (kategorie) {
      if (!keineAdresseNachKategorie.has(kategorie)) {
        keineAdresseNachKategorie.set(kategorie, leereBandCounts());
      }
      let bc = keineAdresseNachKategorie.get(kategorie);
      ['gold_dunkel', 'gold_mittel', 'gold_hell'].forEach(cat => {
        ['neg', 'pos', 'neutral', 'unrated'].forEach(v => {
          bc[cat][v] += (r.bandCounts[cat]?.[v] || 0);
        });
      });
    } else {
      // Alle ortRuns wachsen live mit annIndex (nicht nur die Hauptorte) —
      // so löst wirklich jede Annotation irgendwo auf der Karte eine
      // sichtbare Änderung aus, statt dass Nebenerwähnungen als fertiger,
      // fest vorberechneter Kreis auf einmal aufploppen.
      let pos = lonLatToScreen(r.lon, r.lat, activeBbox, offsetX, offsetY);
      let filter = wohnungFilterFuerOrt(r.ort);
      let bandCounts = zaehleAnnotationenLiveNachOrtBasis(filter, annIndex, daten);
      let radius = zeichneKreiseFuerRun(pos.x, pos.y, bandCounts, 1);
      let fwertAnnotationen = sammleAnnotationenNachOrtBasis(filter, annIndex, daten).filter(a => a.hasFwert);
      zeichneFwertPunkte(pos.x, pos.y, radius, fwertAnnotationen, 1);
      if (radius > 0) {
        // Label mit demselben Begriff wie in der Spine (r.ort) — erst
        // sammeln, Kollisionen erst nach der Schleife auflösen (siehe
        // zeichneKreisLabels), da sich mehrere Kreise dieselbe Koordinate
        // teilen können (z.B. Aussenraum/Innenraum-Paare).
        // Der Kreis des Routen-Startpunkts ("Lokal in der Nähe der Rue
        // Notre-Dame de Lorette", revealIndex 0) ist schon auf der Startseite
        // zu sehen — seine Beschriftung soll dort aber noch fehlen und erst
        // mit dem Kapitel-1-Kartenausschnitt einblenden. Deckkraft daher am
        // Zoomstand (kapitel1ZoomAmount) statt fest 1. Farbe wie alle anderen
        // Labels (#212B2E); vorher stand hier fest #9DA69D.
        let istRoutenStart = daten === stationenData && r.ort === WOHNUNG_SAMMELPUNKT_ANKER;
        labelKandidaten.push({
          ankerX: pos.x, ankerY: pos.y,
          x: pos.x, y: pos.y + 15,
          text: r.ort.toUpperCase(), // .annotation-tag ist text-transform: uppercase
          farbe: null,
          alpha: istRoutenStart ? kapitel1ZoomAmount : 1,
        });
      }
    }
  });

  zeichneKreisLabels(labelKandidaten);

  if (keineAdresseNachKategorie.size > 0) {
    zeichneOrteOhneAdresse(keineAdresseNachKategorie);
  }
}

// Kreise + Labels für Orte ohne konkrete Adresse — Startposition kommt aus
// der unsichtbaren .orte-ohne-adresse-Box in index.html (direkt unterhalb
// des Kapitelregisters angedockt, siehe draw()), nicht aus lon/lat. Mehrere
// Kategorien (Erinnerung/Phantasie/Wunsch/Gedanken/Unbestimmt) stapeln sich
// untereinander in fester, grosszügiger Distanz (max. Kreisdurchmesser laut
// kreisRadius ist 2*100px, plus Label-Zeile darunter) — nur Kategorien mit
// tatsächlichem Inhalt (radius > 0) belegen einen Stapelplatz.
function zeichneOrteOhneAdresse(nachKategorie) {
  let rect = orteOhneAdresse.getBoundingClientRect();
  let cx = rect.left + rect.width / 2;
  let cy = rect.top + rect.height / 2;
  // Die Box dockt unterhalb des vollen 18-Kapitel-Registers an, d.h. sie
  // sitzt oft schon nahe am unteren Bildschirmrand — nach unten bleibt wenig
  // Luft. Abstand bewusst knapp gewählt (reicht für die aktuell einzigen
  // mehrfach gleichzeitig aktiven Kategorien, Kapitel 3: max. ~44px Radius);
  // sollte ein Kapitel künftig mehrere SEHR grosse Kategorien gleichzeitig
  // haben, müsste die Anordnung grundsätzlicher überarbeitet werden (z.B.
  // horizontal statt vertikal stapeln).
  const STAPEL_ABSTAND = 90;

  let reihenfolge = SAMMELPUNKT_KATEGORIEN.map(k => k.label);
  let platz = 0;
  reihenfolge.forEach(label => {
    let bandCounts = nachKategorie.get(label);
    if (!bandCounts) return;
    let y = cy + platz * STAPEL_ABSTAND;
    let radius = zeichneKreiseFuerRun(cx, y, bandCounts);
    if (radius > 0) {
      zeichneKreisLabels([{
        ankerX: cx, ankerY: y,
        x: cx, y: y + 15,
        text: label,
        farbe: null,
      }]);
      platz++;
    }
  });
}

// Zeichnet die Kreis-Labels und löst dabei Überlagerungen auf: Kandidaten
// (sortiert von oben nach unten) werden nacheinander platziert, ein Label
// wird nach unten versetzt, sobald es die Bounding-Box eines bereits
// platzierten Labels überlappen würde (z.B. bei Aussenraum/Innenraum-Paaren,
// die dieselbe Koordinate teilen). Bei nennenswertem Versatz zeigt eine
// gestrichelte Linie an, zu welchem Kreis das Label gehört.
function zeichneKreisLabels(kandidaten) {
  // Vollständig transparente Kandidaten (alpha 0, z.B. der Routen-Startpunkt
  // auf der Startseite) fallen ganz raus — sie sollen auch keinen Platz im
  // Kollisions-Layout belegen und keine Hilfslinie ziehen.
  kandidaten = kandidaten.filter(k => (k.alpha === undefined ? 1 : k.alpha) > 0.002);
  if (kandidaten.length === 0) return;

  noStroke();
  fill(33, 43, 46, 255); // #212B2E, wie die Kapitelnummern
  textFont("'Source Sans 3', sans-serif"); // wie .annotation-tag (var(--sans)) und die Spine-Labels
  textSize(11);
  textStyle(BOLD); // .annotation-tag ist font-weight: 700
  textAlign(LEFT, CENTER);

  let labelHoehe = 14, padding = 4;
  let platziert = [];

  kandidaten
    .map(k => ({ ...k, w: textWidth(k.text) }))
    .sort((a, b) => a.y - b.y)
    .forEach(k => {
      let y = k.y;
      let ueberlappt = true;
      while (ueberlappt) {
        ueberlappt = platziert.some(p =>
          y < p.y + labelHoehe + padding && y + labelHoehe + padding > p.y &&
          k.x < p.x + p.w && k.x + k.w > p.x
        );
        if (ueberlappt) y += labelHoehe + padding;
      }
      platziert.push({ x: k.x, y, w: k.w });

      let alpha = k.alpha === undefined ? 1 : k.alpha;
      if (Math.abs(y - k.y) > 1) {
        stroke(0, 100 * alpha);
        strokeWeight(0.8);
        drawingContext.setLineDash([2, 3]);
        line(k.ankerX, k.ankerY, k.x - 4, y);
        drawingContext.setLineDash([]);
        noStroke();
      }
      // Direkt statt über fill() — siehe zeichneOrtsveraenderung: p5s
      // Füllfarben-Zwischenspeicher wird von den direkt gesetzten
      // fillStyle-Zuweisungen in zeichneKreiseFuerRun/zeichneFwertPunkte
      // umgangen und liefert sonst die zuletzt dort gesetzte Farbe.
      drawingContext.fillStyle = k.farbe
        ? k.farbe
        : `rgba(33, 43, 46, ${alpha})`;
      // p5s text() bleibt hier während des Scrollens (viele Frames/Sekunde,
      // wechselnde Werte) manchmal unsichtbar, obwohl der Canvas-Context
      // nachweislich korrekt gesetzt ist (siehe zeichneSpineHorizontal,
      // gleicher Bug/Workaround) — direkt über den Canvas-Context gezeichnet,
      // fillStyle kommt schon vom fill()-Aufruf oben.
      drawingContext.fillText(k.text, k.x, y);
    });
}

// Vollflächiger Halbkreis (PIE-Modus über exakt 180°, daher ohne sichtbaren
// Keil-Rand — die beiden Radiuslinien am Rand liegen genau gegenüber und
// bilden zusammen den Durchmesser). winkelMitte = Bildschirm-Winkel der
// Mitte der Wölbung (p5-Konvention: 0 = rechts, wächst im Uhrzeigersinn).
// Deckkraft (0.75) und Multiply-Blend wie im alten Entwurf
// (kapitel01-embed.js/addBand) — blend=true für gold_hell/gold_dunkel,
// blend=false (normale, deckende Basis) für gold_mittel; siehe Aufrufer.
// p5s arc()/ellipse() bleiben bei laufender Animation (viele Frames/
// Sekunde, wechselnde Werte) manchmal unsichtbar, obwohl alle Canvas-
// Context-Eigenschaften (fillStyle/globalAlpha/composite) nachweislich
// korrekt gesetzt sind — derselbe Bug wie bei p5s text(), siehe
// zeichneSpineHorizontal. Beide Formen deshalb direkt über den
// Canvas-Context gezeichnet statt über p5s arc()/ellipse().
function zeichneHalbkreis(cx, cy, r, winkelMitte, farbeRgb, alphaSkala = 1, blend = false) {
  if (r <= 0) return;
  let ctx = drawingContext;
  if (blend) ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${farbeRgb[0]}, ${farbeRgb[1]}, ${farbeRgb[2]}, ${0.75 * alphaSkala})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, winkelMitte - HALF_PI, winkelMitte + HALF_PI);
  ctx.closePath();
  ctx.fill();
  if (blend) ctx.globalCompositeOperation = 'source-over';
}

// Vollflächiger Kreis für neutrale Valenz — dieselbe Deckkraft/Blend-Logik
// wie zeichneHalbkreis (s.o.), aber als ganze Fläche statt Halbkreis:
// neutral hat keine Links/Rechts- bzw. Oben/Unten-Seite wie neg/pos.
function zeichneVollkreis(cx, cy, r, farbeRgb, alphaSkala = 1, blend = false) {
  if (r <= 0) return;
  let ctx = drawingContext;
  if (blend) ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${farbeRgb[0]}, ${farbeRgb[1]}, ${farbeRgb[2]}, ${0.75 * alphaSkala})`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TWO_PI);
  ctx.fill();
  if (blend) ctx.globalCompositeOperation = 'source-over';
}

// winkel: feste (NICHT von der Routenrichtung abgeleitete) Basis für die
// Links/Rechts-Aufteilung der Valenz-Halbkreise, siehe unten — Default
// -HALF_PI ("nach oben ausgerichtet") ergibt neg=links/pos=rechts, die
// senkrechte Trennlinie für alle geografisch verstreuten Kreise (Karte,
// Orte-ohne-Adresse, Kreisvergleich). Die horizontale Spine
// (zeichneSpineHorizontal) übergibt stattdessen 0 ("nach rechts
// ausgerichtet") für neg=oben/pos=unten — bei einer Reihe nebeneinander
// liegender Kreise würde eine links/rechts-Teilung benachbarte Kreise
// gegenseitig überlappen/verdecken, eine oben/unten-Teilung bleibt dagegen
// innerhalb der eigenen Spalte.
// radiusSkala/maxRadius: nur die Übersichtskarten-Knoten nutzen sie (siehe
// zeichneVergleichsKnoten) — dort werden die Radien ohne Deckel berechnet und
// danach gemeinsam so weit verkleinert, dass die senkrecht gestaffelten Kreise
// ins Fenster passen. Die Skalierung greift am fertigen Radius, nicht über
// eine Canvas-Transformation: so behalten Schraffur-Abstand und Strichstärken
// ihre normale Grösse.
function zeichneKreiseFuerRun(cx, cy, bandCounts, alphaSkala = 1, winkel = -HALF_PI, radiusSkala = 1, maxRadius = 100) {
  // Zwei Ebenen, jede für sich nach Radius geordnet (kleinste zuoberst,
  // mittlere danach, grösste zuunterst): unten die schraffierten
  // Gesamt-Kreise (neg+pos+neutral+unrated) der 3 Kategorien, darüber die
  // flächigen Valenz-Formen (neg/pos als Halbkreis, neutral als ganzer
  // Kreis). Die Ebenen selbst bleiben in dieser Reihenfolge FEST (schraffiert
  // immer unten) — sonst könnte eine flächenmässig kleinere Schraffur einer
  // Kategorie eine grössere Valenz-Fläche einer ANDEREN Kategorie zudecken,
  // die Kreisgrafik wirkte dann unvollständig (schraffiert statt farbig).
  let hatchFormen = [];
  let flaechenFormen = [];
  let groessterHatchRadius = 0;

  KREIS_KATEGORIEN.forEach(k => {
    let bc = bandCounts[k.key] || {};
    let n = (bc.neg || 0) + (bc.pos || 0) + (bc.neutral || 0) + (bc.unrated || 0);
    let hatchR = kreisRadius(n, maxRadius) * radiusSkala;
    if (hatchR > groessterHatchRadius) groessterHatchRadius = hatchR;
    if (hatchR > 0) {
      let hex = '#' + k.farbe.map(v => v.toString(16).padStart(2, '0')).join('');
      hatchFormen.push({ r: hatchR, zeichne: () => drawHatchedCircle(cx, cy, hatchR, hex, alphaSkala) });
    }

    // blend=true (Multiply) für gold_hell/gold_dunkel, blend=false (normale,
    // deckende Fläche) für gold_mittel — wie im alten Entwurf
    // (kapitel01-embed.js/addBand). winkel bewusst NICHT an die lokale
    // Laufrichtung der Route angelehnt, sondern fest: die Trennlinie
    // zwischen neg/pos dreht sich nie mit der Route mit. Kartenansicht
    // (Default -HALF_PI): negativ links, positiv rechts. Graph-Ansicht
    // (winkel PI, siehe zeichneSpineHorizontal): positiv oben, negativ
    // unten — dort liegen die Kreise auf einer waagrechten Linie, eine
    // Links/Rechts-Teilung liefe mit der Leserichtung mit statt quer dazu.
    let blend = k.key !== 'gold_mittel';
    let negR = kreisRadius(bc.neg || 0, maxRadius) * radiusSkala;
    let posR = kreisRadius(bc.pos || 0, maxRadius) * radiusSkala;
    let neutralR = kreisRadius(bc.neutral || 0, maxRadius) * radiusSkala;
    if (negR > 0) flaechenFormen.push({ r: negR, zeichne: () => zeichneHalbkreis(cx, cy, negR, winkel - HALF_PI, k.farbe, alphaSkala, blend) });
    if (posR > 0) flaechenFormen.push({ r: posR, zeichne: () => zeichneHalbkreis(cx, cy, posR, winkel + HALF_PI, k.farbe, alphaSkala, blend) });
    // Neutrale Valenz: ganzer flächiger Kreis statt Halbkreis — hat keine
    // Links/Rechts- bzw. Oben/Unten-Seite wie neg/pos.
    if (neutralR > 0) flaechenFormen.push({ r: neutralR, zeichne: () => zeichneVollkreis(cx, cy, neutralR, k.farbe, alphaSkala, blend) });
  });

  hatchFormen.sort((a, b) => b.r - a.r).forEach(f => f.zeichne());
  flaechenFormen.sort((a, b) => b.r - a.r).forEach(f => f.zeichne());

  if (groessterHatchRadius > 0) {
    // p5s ellipse() bleibt bei laufender Animation manchmal unsichtbar,
    // siehe zeichneHalbkreis — direkt über den Canvas-Context gezeichnet.
    drawingContext.fillStyle = `rgba(0, 0, 0, ${alphaSkala})`;
    drawingContext.beginPath();
    drawingContext.arc(cx, cy, 4, 0, TWO_PI);
    drawingContext.fill();
  }

  return groessterHatchRadius; // fuer Label-Platzierung durch den Aufrufer
}

// Pixel-Durchmesser je F-Wert-Punktgrösse (1..3, siehe FWERT_PUNKTGROESSE in
// datenbereinigung.js), sowie Ring-/Randabstände für zeichneFwertPunkte.
const FWERT_PUNKT_DURCHMESSER = { 1: 5, 2: 7.5, 3: 10 };
const FWERT_PUNKT_FARBE_RGB = hexZuRgb(FWERT_PUNKT_FARBE);
const FWERT_PUNKT_RAND_ABSTAND = 6; // Luft zwischen Kreisrand und erstem Punkte-Ring
const FWERT_PUNKT_RING_ABSTAND = 8; // Abstand zwischen zwei Punkte-Ringen, falls ein Drittel nicht in einen Ring passt

// F-Wert-Punkte ausserhalb des Kreisdiagramms: jede Annotation mit F-Wert
// (a.hasFwert) bekommt hier — anders als die aggregierten bandCounts — einen
// EIGENEN Punkt. Grösse nach F-Wert-Typ (FWERT_PUNKTGROESSE: 1 Raum löst
// Emotion aus, 2 Emotion färbt Raum, 3 Körper als Sensor), Farbe einheitlich
// (FWERT_PUNKT_FARBE). Position: eines von drei 120°-Dritteln rund um den
// Kreis, auf derselben Seite wie der Valenz-Halbkreis derselben Bewertung
// (siehe anordnung unten und zeichneKreiseFuerRun).
// Reichen die Punkte eines Drittels nicht auf einen Bogen, wachsen
// weitere, weiter aussen liegende Ringe nach (z.B. "Cannes", Kapitel 8, mit
// 87 F-Wert-Annotationen an einem einzigen Ort).
function zeichneFwertPunkte(cx, cy, kreisRadius, fwertAnnotationen, alphaSkala = 1, anordnung = 'seitlich') {
  if (!fwertAnnotationen.length || kreisRadius <= 0) return;

  const DRITTEL = TWO_PI / 3;
  // Gruppenmitten [negativ, positiv, neutral/unbewertet] je Anordnung. Sie
  // folgen der Teilung der Halbkreise in zeichneKreiseFuerRun, damit die
  // Punkte einer Valenz auf DERSELBEN Seite liegen wie ihre Fläche:
  //   'seitlich' (Karte, Halbkreise links/rechts): negativ oben-links,
  //     positiv oben-rechts, neutral unten — die beiden Valenz-Gruppen
  //     liegen als Drittel-Paar symmetrisch um die Senkrechte.
  //   'obenUnten' (Graph, Halbkreise oben/unten): positiv GENAU oben,
  //     negativ GENAU unten, neutral rechts daneben. Hier lassen sich die
  //     Mitten nicht aus einer gemeinsamen Drehung ableiten — oben und unten
  //     liegen 180° auseinander, drei gleiche Drittel aber nur 120°. Darum
  //     stehen sie hier fest, statt wie bei 'seitlich' aus einem Winkel
  //     berechnet zu werden.
  let mitten = anordnung === 'obenUnten'
    ? [HALF_PI, -HALF_PI, 0]
    : [-HALF_PI - DRITTEL / 2, -HALF_PI + DRITTEL / 2, HALF_PI];
  let gruppen = mitten.map(mitte => ({ mitte, formen: [] }));
  fwertAnnotationen.forEach(a => {
    let gruppe = a.valenz === -1 ? gruppen[0] : a.valenz === 1 ? gruppen[1] : gruppen[2];
    let groesse = FWERT_PUNKTGROESSE[a.fWertType] || 1;
    gruppe.formen.push({
      d: FWERT_PUNKT_DURCHMESSER[groesse],
      rgb: FWERT_PUNKT_FARBE_RGB,
    });
  });

  noStroke();
  gruppen.forEach(({ mitte, formen }) => {
    if (!formen.length) return;
    let ringRadius = kreisRadius + FWERT_PUNKT_RAND_ABSTAND;
    let rest = formen;
    while (rest.length) {
      let bogenlaenge = ringRadius * DRITTEL;
      let platz = 0;
      let anzahlImRing = 0;
      for (let f of rest) {
        let breite = f.d + 2; // Mindestabstand zwischen benachbarten Punkten
        if (anzahlImRing > 0 && platz + breite > bogenlaenge) break;
        platz += breite;
        anzahlImRing++;
      }
      let ringFormen = rest.slice(0, anzahlImRing);
      rest = rest.slice(anzahlImRing);

      // Etwas schmaler als das volle Drittel verteilt, damit Punkte an der
      // Drittel-Grenze nicht ins Nachbar-Drittel hineinragen.
      let spanne = DRITTEL * 0.8;
      let n = ringFormen.length;
      ringFormen.forEach((f, i) => {
        let winkelPunkt = n === 1 ? mitte : mitte - spanne / 2 + (i / (n - 1)) * spanne;
        let x = cx + Math.cos(winkelPunkt) * ringRadius;
        let y = cy + Math.sin(winkelPunkt) * ringRadius;
        // p5s ellipse() bleibt bei laufender Animation manchmal unsichtbar,
        // siehe zeichneHalbkreis — direkt über den Canvas-Context gezeichnet.
        drawingContext.fillStyle = `rgba(${f.rgb.r}, ${f.rgb.g}, ${f.rgb.b}, ${alphaSkala})`;
        drawingContext.beginPath();
        drawingContext.arc(x, y, f.d / 2, 0, TWO_PI);
        drawingContext.fill();
      });

      ringRadius += FWERT_PUNKT_RING_ABSTAND;
    }
  });
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

// Übersichtsrouten (Kapitel 02–18) auf der grossen, rausgezoomten Karte —
// echte Strassenrouten aus data-prep/05 bereinigen/baue-uebersichtsrouten.py,
// gedämpft in Goldton (Kategorie-Farbe gold_dunkel). Laufen in Kapitel-
// reihenfolge ab statt gemeinsam zu wachsen: der gesamte fortschritt (0..1)
// wird in gleich grosse Abschnitte pro Kapitel aufgeteilt — Kapitel 02
// zeichnet sich zuerst komplett, dann 03, usw. Ein Kapitel, dessen Abschnitt
// noch nicht erreicht ist, bleibt (Route + Startpunkt/Nummer) unsichtbar.
// Aufteilung des Übersichtsakts auf die Kapitel. Früher bekam jedes Kapitel
// gleich viel Scrollstrecke — dabei schwankte die Zeichengeschwindigkeit um
// das 27-fache: Kapitel 5 zog 1625 Routenpunkte durch dieselben 173vh wie
// Kapitel 18 seine 60, und Kapitel 2 stand mit seinem einzigen Punkt zwei
// Bildschirmhöhen lang still.
//
// Jetzt richtet sich die Scheibenbreite nach der Routenlänge. Ein fester
// Grundanteil wird trotzdem gleichmässig verteilt, damit auch ein kurzes
// Kapitel genug Strecke für Badge und Einstiegstext behält — ohne ihn bekäme
// Kapitel 2 mit einem von 10974 Punkten praktisch keine.
const OV_SCHEIBE_GRUNDANTEIL = 0.45; // Anteil des Akts, der gleichmässig verteilt wird
let ovScheiben = null;

function kapitelScheiben() {
  if (ovScheiben) return ovScheiben;
  let liste = Object.keys(uebersichtsRouten || {}).sort();
  if (!liste.length) return [];
  let laengen = liste.map(nr => uebersichtsRouten[nr].length);
  let summe = laengen.reduce((a, b) => a + b, 0) || 1;
  let grund = OV_SCHEIBE_GRUNDANTEIL / liste.length;
  let rest = 1 - OV_SCHEIBE_GRUNDANTEIL;
  let anteile = liste.map((nr, i) => grund + rest * laengen[i] / summe);
  // Am Ende Platz für das Nachglühen des LETZTEN Kapitels reservieren: seine
  // Scheibe endete sonst exakt bei 1.0, und weil der Aktfortschritt dort
  // geklemmt wird, läge sein Abkühlfenster jenseits des Erreichbaren — Punkt,
  // Nummer und Route von Kapitel 18 blieben dauerhaft in der Hoverfarbe.
  // Alle Scheiben werden dafür um denselben Faktor gestaucht (rund 0.2 %).
  let stauchung = 1 / (1 + anteile[anteile.length - 1] * OV_NACHGLUEHEN);
  let scheiben = [];
  let kum = 0;
  liste.forEach((nr, i) => {
    let anteil = anteile[i] * stauchung;
    scheiben.push({ nr, von: kum, bis: kum + anteil });
    kum += anteil;
  });
  ovScheiben = scheiben;
  return ovScheiben;
}

// Wie "heiss" ein Kapitel gerade ist: 1 während seiner eigenen Scheibe des
// Akts, danach auf 0. Route und Badge nehmen denselben Wert und wechseln
// dadurch gemeinsam von der Hoverfarbe (#C2511C) auf das Routengold.
//
// Der Wechsel fällt mit der Übergabe zusammen: sobald das nächste Kapitel
// aktiv wird, ist das vorherige gold. Das Nachglühen dauert nur so lange,
// dass kein harter Farbsprung entsteht. Auf 0 gesetzt springt die Farbe hart um.
const OV_NACHGLUEHEN = 0.05; // Anteil einer Scheibe für den Übergang

function kapitelHitze(fortschritt, scheibe) {
  if (!scheibe) return 0;
  let breite = scheibe.bis - scheibe.von;
  return 1 - constrain(map(fortschritt, scheibe.bis, scheibe.bis + breite * OV_NACHGLUEHEN, 0, 1), 0, 1);
}

function zeichneUebersichtsrouten(bbox, alpha, fortschritt) {
  noFill();
  strokeWeight(2);

  let kapitelListe = Object.entries(uebersichtsRouten).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  let n = kapitelListe.length;

  // Für die genaue Route des gezoomten Kapitels (weiter unten) gebraucht:
  // anders als die grobe Übersichtslinie (die pro Kapitel nur einen i/n-Slice
  // des Akts bekommt) nutzt das gezoomte Kapitel den vollen, unaufgeteilten
  // fortschritt — sonst hätte jedes Kapitel nur ~1/n des Akts zum Durchscrollen
  // seiner Annotationen (deutlich schneller/unruhiger als bei Kapitel 1, das
  // seinen eigenen vollen Scrollbereich hat). So bekommt jedes geöffnete
  // Kapitel den vollen Akt als eigene Reveal-Skala, unabhängig von seiner
  // Position in der Kapitelliste, und bleibt trotzdem exakt scrubbar.
  // Der Anfang des Akts gehört dem Einstiegstext (siehe
  // KAPITEL_EINSTIEG_SCROLL_ENDE) — die Annotationen des Kapitels verteilen
  // sich auf den Rest, damit die erste gleich beim Erscheinen der Route zu
  // sehen ist und nicht schon während des Textes weggescrollt wurde.
  let zoomedLokalerFortschritt = constrain(
    map(fortschritt, KAPITEL_EINSTIEG_SCROLL_ENDE, 1, 0, 1), 0, 1);
  let aktuelleAnnotationZoom = null; // für die Annotationsbox in draw() (siehe Rückgabewert unten)

  // Im Kapitel-Zoom (Klick auf «03» etc.) bleibt nur die Route des gezoomten
  // Kapitels (+ Kapitel 1, die separat über zeichneRoute läuft) eingeblendet
  // — alle anderen Übersichtsrouten blenden mit kapitelZoomAmount aus.
  kapitelListe.forEach(([kapitelNr, punkte], i) => {
    let scheibe = kapitelScheiben()[i];
    let lokalerFortschritt = scheibe
      ? constrain(map(fortschritt, scheibe.von, scheibe.bis, 0, 1), 0, 1) : 0;
    if (lokalerFortschritt <= 0) return;

    // kapitel-routen-uebersicht.json enthält seit
    // baue-uebersichtsrouten-aus-kapiteln.py exakt dieselben Punkte wie
    // routenPfadDetail des jeweiligen Kapitels — die Übersichtslinie IST also
    // die Kapitelroute. Sobald genau dieses Kapitel gezoomt ist, wird sie
    // trotzdem übersprungen und stattdessen unten aus den Kapiteldaten
    // gezeichnet: dieselbe Geometrie, aber mit mapOffsetX/mapOffsetY des
    // Kartenausschnitts statt zentriert — beide gleichzeitig ergäben zwei
    // gegeneinander versetzte Linien.
    if (kapitelNr === zoomedKapitel && kapitelZoomAmount > 0.001) return;

    let routenAlpha = (zoomedKapitel && kapitelNr !== zoomedKapitel)
      ? alpha * (1 - kapitelZoomAmount)
      : alpha;
    if (routenAlpha <= 0) return;
    // Während sie wächst, wird die Route in der Hoverfarbe gezeichnet und
    // kühlt danach auf Gold ab — so ist im Scrollen zu sehen, welche Linie
    // gerade entsteht und welche schon liegt.
    let hitze = zoomedKapitel ? 0 : kapitelHitze(fortschritt, scheibe);
    stroke(lerp(ROUTE_COLOR_RGB.r, FWERT_COLOR_RGB.r, hitze),
      lerp(ROUTE_COLOR_RGB.g, FWERT_COLOR_RGB.g, hitze),
      lerp(ROUTE_COLOR_RGB.b, FWERT_COLOR_RGB.b, hitze), routenAlpha);
    let anzahl = Math.max(1, Math.round(lokalerFortschritt * punkte.length));
    beginShape();
    for (let j = 0; j < anzahl; j++) {
      let p = lonLatToScreen(punkte[j][0], punkte[j][1], bbox, 0, 0); // zentrierte Übersichtskarte, kein mapOffsetX
      vertex(p.x, p.y);
    }
    endShape();
  });

  // Route des gezoomten Kapitels (aus datenFuerKapitel(), siehe
  // baue-kapitel-stationen.py/baue_kapitel03.py) — ersetzt die Übersichts-
  // linie für genau dieses Kapitel, sobald es gezoomt ist (gleiche Punkte,
  // anderer Offset, siehe oben). Nutzt
  // denselben fixen mapOffsetX/mapOffsetY wie der Kartenausschnitt (k.bild)
  // selbst, nicht den ch1-spezifischen kartenOffsetX-Blend.
  // Erscheint bewusst erst, NACHDEM der Kapitel-Einstiegstext (siehe
  // KAPITEL_EINSTIEG_SCROLL_ENDE weiter
  // unten in draw()) fertig ausgeblendet ist — exakt dasselbe Nacheinander
  // wie bei Kapitel 1 (dort per Scroll-Meilenstein: der Begleittext blendet
  // bis routeStart aus, erst ab dort wächst routeAmount los). Ohne dieses
  // Gate erschienen Route/Kreise/Annotationsbox gleichzeitig mit dem noch
  // sichtbaren Einstiegstext, statt sauber danach.
  let kapitelEinstiegAbgeschlossen = fortschritt >= KAPITEL_EINSTIEG_SCROLL_ENDE;
  if (zoomedKapitel && kapitelZoomAmount > 0.001 && kapitelEinstiegAbgeschlossen) {
    let daten = datenFuerKapitel(zoomedKapitel);
    // routenPfadDetail (falls vorhanden) statt routenPunkte: Letzteres ist
    // auf genau 1 Punkt pro Annotation/revealIndex komprimiert (siehe
    // baue-kapitel-stationen.py) — bei eng aufeinanderfolgenden Annotationen
    // (häufigster Fall) bleiben davon oft nur Start+Ziel übrig, der echte
    // OSM-Fussweg dazwischen (mit allen Abbiegungen) geht verloren und die
    // Linie sieht wie eine Luftlinie aus. routenPfadDetail behält die volle
    // Strassenform. routenPfadKumulativ (falls vorhanden, siehe
    // baue_stopandgo_pfade.py) bindet das Wachstum dieses dichten Pfads an
    // die Annotations-Reihenfolge zurück: pro Annotation ein Index in
    // routenPfadDetail, flach solange sich ortBasis nicht ändert (Stop),
    // springt beim Ortswechsel auf den vollen echten Fussweg zum nächsten
    // Ort (Go) — echtes Stop-and-go MIT Strassenform, nicht mehr nur
    // proportional zum Gesamt-Scrollfortschritt.
    let routenLinie = (daten && daten.routenPfadDetail && daten.routenPfadDetail.length > 1)
      ? daten.routenPfadDetail
      : (daten && daten.routenPunkte);
    if (routenLinie && routenLinie.length > 1) {
      // Exakt dieselbe Zeichenfunktion/Darstellung wie Kapitel 1s eigene
      // Route (zeichneRoute: Fade-Schweif, jüngere Segmente heller). Der
      // Fortschritt (zoomedLokalerFortschritt, oben im ersten forEach
      // mitgefasst) ist derselbe scroll-gebundene Wert wie für die grobe
      // Übersichtslinie dieses Kapitels — beim Hochscrollen sinkt er wieder,
      // die Route zieht sich also denselben Weg rückwärts zurück, statt nur
      // pauschal auszublenden. kapitelZoomAmount bleibt als zusätzlicher
      // Alpha-Multiplikator fürs Ein-/Ausblenden beim Öffnen/Schliessen.
      let kumulativ = daten && daten.routenPfadKumulativ;
      let upToIndex;
      if (kumulativ && kumulativ.length === (daten.annotationen || []).length) {
        // Kontinuierliche Annotations-Position (nicht gerundet) innerhalb
        // [0, annotationen.length-1] — linear zwischen den kumulativen
        // Pfad-Indizes zweier benachbarter Annotationen interpoliert, damit
        // der Ortswechsel-"Sprung" innerhalb seines Scroll-Abschnitts noch
        // weich (Punkt für Punkt den echten Fussweg entlang) wächst, statt
        // schlagartig aufzupoppen.
        let stelle = constrain(zoomedLokalerFortschritt * (kumulativ.length - 1), 0, kumulativ.length - 1);
        let i0 = Math.floor(stelle), i1 = Math.min(kumulativ.length - 1, i0 + 1);
        let frac = stelle - i0;
        upToIndex = Math.round(lerp(kumulativ[i0], kumulativ[i1], frac));
      } else {
        upToIndex = Math.round(zoomedLokalerFortschritt * (routenLinie.length - 1));
      }
      if (upToIndex >= 1) {
        // Strichstärke 10 wie Kapitel 1s Route in ihrer normalen (nicht
        // rausgezoomten) Ansicht — dort lerp(10, 2, zoomOutAmount), hier
        // gibt es keine entsprechende Rauszoom-Phase, also fix bei 10.
        zeichneRoute(routenLinie, upToIndex, bbox, 10, mapOffsetX, mapOffsetY, kapitelZoomAmount);
      }
    }

    // Wachsende Kreise + aktuelle Annotation — dasselbe System wie Kapitel 1
    // (zeichneKreiseOrtRuns/Annotationsbox in draw()), nur mit diesem
    // Kapitels eigenen Daten/annIndex statt stationenData. annIndex/
    // punktIndex analog zu Kapitel 1s Berechnung in draw() (dort direkt vor
    // dem Aufruf dieser Funktion), hier aber aus zoomedLokalerFortschritt
    // abgeleitet, da dieses Kapitel keine eigenen Scroll-Meilensteine hat.
    if (daten && daten.annotationen && daten.annotationen.length) {
      let annIndexZoom = Math.min(daten.annotationen.length - 1, Math.floor(zoomedLokalerFortschritt * daten.annotationen.length));
      let aktuelleAnnZoom = daten.annotationen[annIndexZoom];
      // annIndexZoom statt aktuelleAnnZoom.revealIndex: Letzteres ist bei
      // Kapitel 3 (handkuratiert) für die meisten Annotationen NICHT die
      // Array-Position (andere, hier nicht relevante Altsemantik), während
      // ortRuns[].revealIndex (siehe zeichneKreiseOrtRuns) verlässlich die
      // Array-Position ist — die beiden verglichenen Werte liefen dadurch
      // auseinander, Kreise erschienen zu spät oder gar nicht. annIndexZoom
      // ist für alle Kapitel (auch die automatisch gebauten) ohnehin schon
      // die Array-Position, also die korrekte Vergleichsbasis.
      let punktIndexZoom = aktuelleAnnZoom.vorRoutenstart ? 0 : annIndexZoom;
      zeichneKreiseOrtRuns(punktIndexZoom, annIndexZoom, bbox, mapOffsetX, mapOffsetY, daten);
      aktuelleAnnotationZoom = aktuelleAnnZoom;
    }
  }

  // Startpunkt (schwarz) + Kapitelnummer je Route — erscheint zusammen mit
  // der Route, sobald diese zu wachsen beginnt. Kapitel mit eigenem
  // Kartenausschnitt (siehe kapitelKarten) sind klickbar — Hover zeigt das
  // per Cursor/Farbe an, Klick zoomt in kapitel<NR>-karte.png (siehe
  // oeffneKapitelZoom/mousePressed).
  noStroke();
  textFont("'Source Sans 3', sans-serif"); // wie .annotation-tag (var(--sans)) und die Kreis-Labels
  textStyle(BOLD); // .annotation-tag ist font-weight: 700
  textAlign(LEFT, CENTER);
  textSize(11);
  kapitelHover = null;

  // Mehrere Kapitel können exakt denselben Startpunkt haben (z.B. "Wohnung
  // Duroy/Madeleine" für 02/10, oder "Redaktion La Vie Française" für
  // 07/11 — beide echte, wiederkehrende Orte, keine Datenfehler). Ohne
  // Versatz zeichnet das später gelistete Kapitel (höhere Nummer) sein
  // Badge exakt über das frühere, das dadurch unsichtbar UND unklickbar
  // wird — daher unten ein kleiner kreisförmiger Versatz pro Gruppe.
  // Gruppiert wird nach ABSTAND, nicht nach exakt gleicher Koordinate. Ein
  // Text-Vergleich der Zahlen hätte Kapitel 18 aus der Gruppe 08/09 fallen
  // lassen: sein Startpunkt liegt 0.24 m daneben (2.31921 gegen 2.3192132),
  // auf dem Bildschirm also exakt auf demselben Pixel. Es bekam dadurch
  // keinen Versatz und lag mittig unter den beiden anderen Badges.
  const DUP_TOLERANZ = 0.0003; // Grad, rund 25 m — deutlich unter dem kleinsten echten Abstand zweier Startpunkte (223 m)
  let startDupGruppen = {};
  let dupSchluessel = {};
  kapitelListe.forEach(([kapitelNr, punkte]) => {
    let [lon, lat] = punkte[0];
    let key = Object.keys(startDupGruppen).find(k => {
      let [kl, kb] = k.split(',').map(Number);
      return Math.abs(kl - lon) < DUP_TOLERANZ && Math.abs(kb - lat) < DUP_TOLERANZ;
    });
    if (!key) key = lon + ',' + lat;
    (startDupGruppen[key] = startDupGruppen[key] || []).push(kapitelNr);
    dupSchluessel[kapitelNr] = key;
  });

  kapitelListe.forEach(([kapitelNr, punkte], i) => {
    // Bewusst NICHT (mehr) an lokalerFortschritt (die i/n..(i+1)/n-Scheibe
    // dieses Kapitels am Gesamt-Akt) gekoppelt wie die Routenlinien oben:
    // die zeigen sich absichtlich nacheinander im Scrollverlauf, aber die
    // Start-Badges sind Klickziele, die von Anfang an alle gleichzeitig da
    // sein sollen — sonst liessen sich spät gelistete Kapitel (hohe i) erst
    // anklicken, nachdem man schon weit in den Akt gescrollt war, obwohl das
    // Kapitelregister links sie längst anzeigt.
    let labelAlpha = (zoomedKapitel && kapitelNr !== zoomedKapitel)
      ? alpha * (1 - kapitelZoomAmount)
      : alpha;
    // Unter 1/255 ist ein Alpha auf dem 8-Bit-Kanal ohnehin nicht mehr
    // darstellbar. Der frühere Test (<= 0) griff nie: kapitelZoomAmount wird
    // per lerp() nachgeführt und läuft nur asymptotisch gegen 1, labelAlpha
    // wurde also beliebig klein, aber nie 0. Die Badges der übrigen Kapitel
    // liefen dadurch im Kapitel-Zoom endlos weiter — und wurden sichtbar,
    // weil das fill() unten von p5 übersprungen wird, sobald labelAlpha von
    // Frame zu Frame gleich bleibt: zeichneKreiseOrtRuns (oben) schreibt über
    // zeichneKreisLabels direkt in drawingContext.fillStyle und umgeht p5s
    // Zwischenspeicher, das darauf folgende fillText() erbte dann dessen
    // volle Deckkraft (derselbe Fallstrick wie in zeichneOrtsveraenderung).
    if (labelAlpha < 1) return;

    let start = lonLatToScreen(punkte[0][0], punkte[0][1], bbox, 0, 0); // zentrierte Übersichtskarte, kein mapOffsetX
    // Für das gerade gezoomte Kapitel zum tatsächlichen Anfang der genauen
    // Route überblenden (routenPfadDetail/routenPunkte, mapOffsetX-Rahmen)
    // statt am Startpunkt der groben, mit offsetX=0 berechneten Übersichts-
    // linie stehen zu bleiben — der trifft im Kapitel-Zoom nicht exakt auf
    // den echten Routenanfang. kapitelZoomAmount blendet weich zwischen
    // beiden Positionen (0 = Übersicht, 1 = voll gezoomt).
    if (kapitelNr === zoomedKapitel && kapitelZoomAmount > 0.001) {
      let daten = datenFuerKapitel(kapitelNr);
      let routenLinie = (daten && daten.routenPfadDetail && daten.routenPfadDetail.length > 1)
        ? daten.routenPfadDetail
        : (daten && daten.routenPunkte);
      if (routenLinie && routenLinie.length > 0) {
        let praezise = lonLatToScreen(routenLinie[0][0], routenLinie[0][1], bbox, mapOffsetX, mapOffsetY);
        start = {
          x: lerp(start.x, praezise.x, kapitelZoomAmount),
          y: lerp(start.y, praezise.y, kapitelZoomAmount),
        };
      }
    }

    // Kreisförmiger Versatz für Kapitel mit identischem Startpunkt (siehe
    // startDupGruppen oben) — jedes Kapitel der Gruppe bekommt einen festen,
    // eigenen Platz auf einem kleinen Kreis um den echten Punkt, statt sich
    // mit den anderen zu überlagern.
    let dupGruppe = startDupGruppen[dupSchluessel[kapitelNr]];
    let dupAnker = null;
    let labelLinks = false; // Nummer nach links statt rechts setzen
    if (dupGruppe.length > 1) {
      let dupWinkel = (dupGruppe.indexOf(kapitelNr) / dupGruppe.length) * TWO_PI;
      const dupVersatz = 13; // px
      dupAnker = start; // echter Routenanfang, für die Verbindungslinie unten
      start = {
        x: start.x + cos(dupWinkel) * dupVersatz,
        y: start.y + sin(dupWinkel) * dupVersatz,
      };
      // Nummer auf die AUSSENSEITE des Versatzkreises setzen. Sonst steht sie
      // immer rechts vom Punkt und damit bei den linken Badges quer über der
      // Gruppenmitte — bei Kapitel 2 lagen die Nummern von 13 und 15 direkt
      // über und unter dessen Punkt und drückten ihn zwischen sich ein.
      labelLinks = cos(dupWinkel) < -0.01;
    }

    // Klickbar, sobald entweder ein eigener Kartenausschnitt (kapitelKarten)
    // ODER zumindest ein Spine-Panel (KAPITEL_MIT_SPINE_PANEL) vorhanden ist
    // — Kapitel ohne eigenen Ausschnitt (aktuell 02, 14, 15) zeigen beim
    // Zoom dann nur das Spine-Panel, die Karte bleibt auf der Übersicht.
    let klickbar = (!!kapitelKarten[kapitelNr] || KAPITEL_MIT_SPINE_PANEL.has(kapitelNr)) && !zoomedKapitel;
    let hover = klickbar && dist(mouseX, mouseY, start.x, start.y) < FOTO_MARKER_TREFFER_RADIUS;
    if (hover) kapitelHover = kapitelNr;

    // Punkt und Nummer nehmen dieselbe Hitze wie die Linie (siehe
    // kapitelHitze): voll in der Hoverfarbe, solange die eigene Route wächst,
    // danach gemeinsam mit ihr auf die normale Farbe abkühlend. Die
    // Punktgrösse bleibt normal, damit der echte Hover unterscheidbar bleibt.
    let scheibe = kapitelScheiben()[i];
    let lokalerFortschritt = scheibe
      ? constrain(map(fortschritt, scheibe.von, scheibe.bis, 0, 1), 0, 1) : 0;
    let hitze = (!zoomedKapitel && lokalerFortschritt > 0) ? kapitelHitze(fortschritt, scheibe) : 0;

    // fill(hexString, alpha) ist keine verlässliche p5-Signatur (bricht die
    // Farb-Auflösung ab) — deshalb RGB statt Hex+Alpha, wie überall sonst
    // im Sketch (z.B. ROUTE_COLOR_RGB).
    // Verbindungsstrich vom versetzten Badge zurück zum echten Routenanfang.
    // Ohne ihn wirkt ein Badge, dessen Versatzwinkel quer zur Route zeigt,
    // wie ein Punkt ohne Route — genau das passierte Kapitel 7, das sich die
    // Redaktion als Startpunkt mit 10 und 11 teilt und den Winkel 0 (nach
    // rechts) bekam, während die Linie dort nach oben wegläuft.
    if (dupAnker) {
      stroke(33, 43, 46, labelAlpha * 0.55);
      strokeWeight(1);
      line(dupAnker.x, dupAnker.y, start.x, start.y);
      noStroke();
    }

    if (hover) fill(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b, labelAlpha); // #C2511C
    else fill(lerp(33, FWERT_COLOR_RGB.r, hitze), lerp(43, FWERT_COLOR_RGB.g, hitze),
      lerp(46, FWERT_COLOR_RGB.b, hitze), labelAlpha); // #212B2E .. #C2511C
    ellipse(start.x, start.y, hover ? 11 : 8, hover ? 11 : 8);
    // p5s text() bleibt hier während des Scrollens (viele Frames/Sekunde,
    // wechselnde Werte) manchmal unsichtbar, obwohl der Canvas-Context
    // nachweislich korrekt gesetzt ist (siehe zeichneSpineHorizontal, gleicher
    // Bug/Workaround) — direkt über den Canvas-Context gezeichnet, fillStyle
    // kommt schon vom fill()-Aufruf oben.
    if (labelLinks) {
      textAlign(RIGHT, CENTER);
      drawingContext.textAlign = 'right';
      drawingContext.fillText(kapitelNr, start.x - 8, start.y);
      textAlign(LEFT, CENTER);
      drawingContext.textAlign = 'left';
    } else {
      drawingContext.fillText(kapitelNr, start.x + 8, start.y);
    }
  });

  // Kapitel 1 hat keine Übersichtsroute in uebersichtsRouten (eigene, separat
  // gezeichnete Route/Startpunkt) — Nummer wird hier eigens ergänzt, klickbar
  // wie die anderen, aber Klick scrollt zurück zu Kapitel 1 statt in ein Bild
  // zu zoomen (siehe scrolleZuKapitel1/mousePressed).
  //
  // Blendet im Kapitel-Zoom mit aus, nach derselben Regel wie 02–18 (siehe
  // labelAlpha oben). Vorher stand die 01 dort bewusst als Rückweg-Anker
  // stehen — sie war damit aber die einzige sichtbare Kapitelnummer in einer
  // Detailansicht, die sonst keine zeigt. Der Rückweg läuft weiterhin über
  // das Kapitelregister links, Escape und Hochscrollen.
  // Hover/Klick sitzen bewusst INNERHALB des Guards: ein unsichtbares
  // Klickziel auf der Kapitelkarte wäre schlimmer als gar keines.
  let ch1Alpha = zoomedKapitel ? alpha * (1 - kapitelZoomAmount) : alpha;
  if (ch1Alpha >= 1) {
    let ch1Start = lonLatToScreen(stationenData.routenPunkte[0][0], stationenData.routenPunkte[0][1], bbox, 0, 0); // zentrierte Übersichtskarte, kein mapOffsetX
    let ch1Hover = dist(mouseX, mouseY, ch1Start.x, ch1Start.y) < FOTO_MARKER_TREFFER_RADIUS;
    if (ch1Hover) kapitelHover = '01';
    if (ch1Hover) fill(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b, ch1Alpha); // #C2511C
    else fill(33, 43, 46, ch1Alpha); // #212B2E
    ellipse(ch1Start.x, ch1Start.y, ch1Hover ? 11 : 8, ch1Hover ? 11 : 8);
    drawingContext.fillText('01', ch1Start.x + 8, ch1Start.y); // siehe Kommentar oben (p5s text()-Bug)
  }

  textStyle(NORMAL);
  cursor(kapitelHover ? HAND : ARROW);


  // aktuelleAnnotationZoom: für die Annotationsbox in draw() (nur bei
  // Kapitel 02–18 relevant — Kapitel 1s eigene Annotation läuft weiterhin
  // über routeAmount/annIndex direkt in draw()).
  return { aktuelleAnnotationZoom };
}

// Scrollt zurück in die Kapitel-1-Ansicht (Ende des Rein-Zooms/Anfang der
// Route) — schliesst einen eventuell offenen Kapitel-Zoom gleich mit.
function scrolleZuKapitel1() {
  schliesseKapitelZoom();
  let trackEl = document.querySelector('.scroll-track');
  let ziel = trackEl.offsetHeight * SCROLL_MEILENSTEINE.zoomEnd;
  window.scrollTo({ top: ziel, behavior: 'smooth' });
}

// Öffnet den Kapitel-Zoom an der AKTUELLEN Scrollposition, ohne sie zu
// verändern. Alle Bedien-Wege (Kapitelregister, Klick auf einen Routen-
// Startpunkt) laufen deshalb über springeZuKapitelZoom, das vorher an den
// Anfang des uebersichtRouten-Akts springt — sonst öffnete sich das Kapitel
// mitten im Ablauf, mit schon ausgeblendetem Einstiegstext und fertig
// gezeichneter Route (siehe KAPITEL_EINSTIEG_SCROLL_ENDE).
//
// Kartenausschnitt + Route blenden sofort weich ein (kapitelZoomAmount,
// siehe draw()). Verlassen geschieht durch Hoch-scrollen (siehe
// uebersichtRoutenFortschritt<=0-Check in draw()), über Escape, oder über
// den "Alle"-Eintrag im Kapitel-Menübalken (springeZurUebersicht).
// Setzt voraus, dass die aktuelle Scrollposition bereits im uebersichtRouten-
// Akt liegt (siehe draw()) — sonst schliesst genau dieser Check den gerade
// geöffneten Zoom im nächsten Frame gleich wieder (Sprung von einer
// früheren Position, z.B. Kapitel 1s eigenem Kartenausschnitt, MUSS daher
// über springeZuKapitelZoom() laufen, nicht direkt über diese Funktion).
// Setzt den Ansichtsmodus (Karte/Grafik) + eine eventuell laufende
// Play-Animation zurück — bei jedem Kapitelwechsel aufgerufen, damit jede
// Kapitel-Ansicht frisch in der Kartenansicht startet (siehe
// oeffneKapitelZoom/schliesseKapitelZoom/springeZuKapitelZoom).
function setzeKapitelAnsichtZurueck() {
  kapitelAnsichtsModus = 'karte';
  grafikSpielt = false;
  grafikFortschritt = 0;
  grafikPlayAusblendStart = null;
  // Kapitelwechsel während laufender Sonifikation (Kapitel 1s Graph-
  // Play-Button, siehe toggleGrafikPlay) sauber abbrechen — sonst liefe der
  // Ton unabhängig von der (jetzt zurückgesetzten) Graph-Ansicht weiter.
  if (sonifikationSpieltGerade) beendeSonifikationAudio();
  // Startzeit für den zeitbasierten Fade des Kapitel-Einstiegstexts
  // (.kapitel-einstiegstext, siehe draw()) — bei jedem Kapitelwechsel neu,
  // auch beim Schliessen (dort harmlos, da dann kein zoomedKapitel matcht).
  kapitelEinstiegsStartMillis = millis();
}

function oeffneKapitelZoom(nr) {
  if (!kapitelKarten[nr] && !KAPITEL_MIT_SPINE_PANEL.has(nr)) return;
  zoomedKapitel = nr;
  setzeKapitelAnsichtZurueck();
}

function schliesseKapitelZoom() {
  zoomedKapitel = null;
  setzeKapitelAnsichtZurueck();
}

// Sprungziel der 02–18-Badges im Kapitel-Menübalken: springt (OHNE
// Scroll-Animation — bei "smooth" liefen mehrere draw()-Frames noch mit der
// alten Scrollposition, in denen der uebersichtRoutenFortschritt<=0-Check
// den gerade gesetzten zoomedKapitel sofort wieder auf null zurückgesetzt
// hätte) auf eine sichere Position kurz NACH dem Anfang des
// uebersichtRouten-Akts (statt wie früher in dessen Mitte — dort wäre die
// Route schon gut zur Hälfte gewachsen, sobald der Einstiegstext-Gate in
// zeichneUebersichtsrouten sie freigibt, statt bei der ersten Annotation zu
// beginnen wie bei Kapitel 1) und öffnet dort direkt den Kapitel-Zoom —
// funktioniert dadurch auch von jeder früheren Scrollposition aus (z.B. aus
// Kapitel 1s eigenem Kartenausschnitt heraus). 1% Abstand zum exakten
// Akt-Anfang reicht als Sicherheitsmarge gegen den <=0-Check, liegt aber für
// jedes Kapitel (auch annotationsarme) noch klar bei dessen erster
// Annotation (siehe zoomedLokalerFortschritt/annIndexZoom dort).
function springeZuKapitelZoom(nr) {
  if (!kapitelKarten[nr] && !KAPITEL_MIT_SPINE_PANEL.has(nr)) return;
  let trackEl = document.querySelector('.scroll-track');
  let start = SCROLL_MEILENSTEINE.uebersichtRoutenStart
    + 0.01 * (SCROLL_MEILENSTEINE.uebersichtRoutenEnd - SCROLL_MEILENSTEINE.uebersichtRoutenStart);
  window.scrollTo(0, trackEl.offsetHeight * start);
  oeffneKapitelZoom(nr);
}

// Sprungziel des "Alle"-Buttons im Kapitel-Menübalken: verlässt jede
// offene Kapitel-Ansicht (Kapitel 1 eigene ODER ein gezoomtes 02–18) und
// landet auf der neutralen Übersichtskarte — dieselbe sichere Position wie
// springeZuKapitelZoom, aber ohne dort ein Kapitel zu öffnen.
function springeZurUebersicht() {
  let trackEl = document.querySelector('.scroll-track');
  let mitte = (SCROLL_MEILENSTEINE.uebersichtRoutenStart + SCROLL_MEILENSTEINE.uebersichtRoutenEnd) / 2;
  window.scrollTo(0, trackEl.offsetHeight * mitte);
  schliesseKapitelZoom();
}
