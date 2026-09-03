/* =============================================================================
   sketch.js — p5-Zeichnung für Bel-Ami v3

   Der Scroll-Akt: preload/setup/draw plus die Zustandsvariablen, an denen die
   zehn Module hängen. draw() leitet aus der Scrollposition alle Phasen ab und
   ruft die Zeichenmodule in fester Reihenfolge.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 58 von 88 Namen intern, 30 exportiert. Konvention: docs/architektur.md.
(function () {

let stage, heroText, begleitTexte, kapitelEinstiegsTexte;
let scrollHinweisEl; // «Scrollen»: im Intro mit dem Titel, danach zu Beginn jedes Akts
let demoGruppenTexte; // die neun .begleittext mit data-demo-gruppe — ihre Fenster steuern auch die Stufen des Legendenaufbaus
let fotoHinweisText;  // der .begleittext mit data-foto-hinweis — sein Fenster und sein Zielmarker steuern den Bedienhinweis an der Karte

// Text des Bedienhinweises am Fotomarker. Auf welchen Marker er zeigt und
// wann, steht am Begleittext in index.html — hier nur der Wortlaut.
const FOTO_HINWEIS_TEXT = 'Diese Punkte lassen sich anklicken, um ein historisches Foto zu sehen.';
let annotationBoxEl; // #annotationBox — trägt die Positionsklasse (pos-oben-links etc.), siehe annotationBoxPosition()
let kapitelEndeEl, kapitelEndeWeiterEl, kapitelEndeTextEl; // Kapitelende: Buttonpaar und der Hinweis darüber (nur Kapitel 1), siehe draw()
let projekttextEl; // #projekttext, die Textfläche des Registers «Info»


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

// Hält einen Klick beim DOM-Element und lässt ihn nicht zu p5 durch.

// ACHTUNG stopPropagation muss am mousedown hängen, nicht am click: p5 löst
// mousePressed schon beim mousedown aus, der click kommt erst danach. Am
// click abgefangen liefe der Klick trotzdem durch die Prüfungen in
// mousePressed — er schlösse etwa den Einblender, in dem gerade gelesen wird.
function haltKlickAuf(el, beiKlick) {
  el.addEventListener('mousedown', ev => ev.stopPropagation());
  if (beiKlick) el.addEventListener('click', beiKlick);
}

// Setzt die Einstiegstext-Uhr neu, gerufen von uebersichtsrouten.js beim
// Kapitelwechsel.
function starteKapitelEinstieg() {
  kapitelEinstiegsStartMillis = millis();
}


// Der Einstiegstext blendet zeitbasiert ein, dann übernimmt das Scrollen: nach
// diesen Wegen beginnt er zu weichen und ist er weg, danach setzen Route und
// Annotationen ein. Kurz gehalten — steht der Text einmal, soll ein knapper
// Scroll genügen. Dasselbe Mass hat der Einstieg von Kapitel 1, dort über
// data-von/data-bis in index.html.
// Ausblendweg des «Scrollen»-Hinweises am Anfang eines Akts.
const SCROLL_HINWEIS_VH = 100;

const KAPITEL_EINSTIEG_HALT_VH = 26;
const KAPITEL_EINSTIEG_WEG_VH = 59;

// Ein Takt für alle: jede Annotation bekommt denselben Scrollweg wie die
// Einstiegstexte des Intros untereinander (dreizehn Schritte auf 1276vh).
// Daraus folgt, wie lang ein Kapitel ist — und wie lang die Strecke sein muss,
// die das längste fassen soll.
// ACHTUNG wer diese Zahl ändert, muss die Meilensteine nachrechnen: routeEnd
// und alles dahinter sowie die Höhe von .scroll-track hängen daran. Der
// Rechenweg steht in docs/architektur.md, «Ein Takt für alle Kapitel».
const KAPITEL_TAKT_VH = 98.2;

// Annotationszahl eines Kapitels, 0 wenn keines offen ist.
function annotationsZahl(kapitelNr) {
  let daten = datenFuerKapitel(kapitelNr);
  return daten && daten.annotationen ? daten.annotationen.length : 0;
}

// Länge des Kapitelakts in vh: Einstiegstext plus eine Taktlänge je Annotation.
function kapitelAktVh(kapitelNr) {
  return KAPITEL_EINSTIEG_WEG_VH + annotationsZahl(kapitelNr) * KAPITEL_TAKT_VH;
}

// Scrollmarke, an der ein geöffnetes Kapitel endet; dort steht seine Klemme.
function kapitelAktEnde(kapitelNr) {
  return SCROLL_MEILENSTEINE.uebersichtRoutenStart + kapitelAktVh(kapitelNr) / SCROLL_TRACK_VH;
}

// Anteile des Kapitelakts, zwischen denen der Einstiegstext ausblendet. Keine
// festen Zahlen mehr: der Akt ist je Kapitel verschieden lang, der Text soll
// aber überall gleich lange stehen.
function kapitelEinstiegHalt(kapitelNr) {
  return annotationsZahl(kapitelNr) ? KAPITEL_EINSTIEG_HALT_VH / kapitelAktVh(kapitelNr) : 0;
}
function kapitelEinstiegWeg(kapitelNr) {
  return annotationsZahl(kapitelNr) ? KAPITEL_EINSTIEG_WEG_VH / kapitelAktVh(kapitelNr) : 0;
}
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
let kapitelRegister; // Kapitelregister rechts (inkl. Plan/Graph + Alle), sichtbar während eines Kapitel-Zooms
let kapitelRegisterRahmen; // schneidet es an der Oberkante des Legendenbalkens ab
let registerSchnitt = -1;  // zuletzt gesetzte Unterkante, spart Stilschreiben
let kapitelRegisterEintraege = {}; // nr -> Eintrags-Element, fürs Aktiv-Highlighting in draw()
let planEintrag, graphEintrag; // "Plan"/"Graph"-Hälften oben im Register, fürs Aktiv-Highlighting in draw()
let modusZeile, leerzeile, alleEintrag; // Plan/Graph-Zeile + Abstandshalter + "Alle" — in der Übersicht (kein Kapitel gezoomt) blendet draw() modusZeile/leerzeile aus und markiert alleEintrag als aktiv

// Kapitel 1 endet, wo der Übersichtsakt beginnt: dort ist die Scrollposition
// festgehalten, die Überblickskarte kommt nur noch per Klick. Jeder Sprung
// dahinter löst die Klemme, ein Zurückscrollen in Kapitel 1 setzt sie neu.
let kapitel1Geklemmt = true;

// Gerufen von uebersichtsrouten.js aus den beiden Sprungzielen hinter
// Kapitel 1 ("Übersicht"/"Alle" und jeder Kapitel-Zoom).
// Zurück in Kapitel 1, gerufen aus scrolleZuKapitel1(). Gegenstück zu
// loeseKapitel1Klemme().
function klemmeKapitel1() {
  kapitel1Geklemmt = true;
}

function loeseKapitel1Klemme() {
  kapitel1Geklemmt = false;
}

// Die beiden Register am unteren Fensterrand (docs/Legende.pdf). Eingeklappt
// stehen nur ihre Reiter da; «Info» deckt ausgefahren alles zu.
let legendenLeisteOffen = false;
// Ausfahrgrad 0..1, je Frame an den Sollwert herangeführt.
let legendeAus = 0;
let infoAus = 0;
const REGISTER_TEMPO = 0.18;   // Anteil des Rests je Frame, wie kapitelZoomAmount

// Der Projekttext hat zwei Wege hinein: am Ende der Route geht er von selbst
// auf, und das Register «Info» holt ihn jederzeit zurück. Deshalb zwei Merker
// statt einem — sonst liesse sich der automatische nicht wegklicken, ohne den
// von Hand geöffneten mitzuschliessen.
let projekttextPerRegister = false; // über den Reiter geholt, bleibt bis zum nächsten Klick
let projekttextWeggeklickt = false; // der automatische wurde von Hand geschlossen
let projekttextOffen = false;     // je Frame aus den beiden abgeleitet

// Heller Schleier unter dem Legendenaufbau. Derselbe Ton wie der Grund der
// Registerleiste in kreisgrafik.js: die helle Karte bleibt darunter als
// Karte erkennbar, tritt aber hinter die Legende zurück.
const LEGENDE_SCHLEIER = '#E2E6E1';
const LEGENDE_SCHLEIER_ALPHA = 0.8;

// Zu heisst je nach Weg etwas anderes: den über den Reiter geholten einfach
// wieder weg, den automatischen für diesen Durchlauf abhaken.
function schliesseProjekttext() {
  if (projekttextPerRegister) projekttextPerRegister = false;
  else projekttextWeggeklickt = true;
}

// Register fahren geglättet aus. Am Ende auf den Sollwert einrasten, sonst
// bliebe die Fläche für immer knapp unter 1 bzw. knapp über 0 stehen.
function naehereRegister(wert, ziel) {
  let neu = lerp(wert, ziel, REGISTER_TEMPO);
  return Math.abs(ziel - neu) < 0.002 ? ziel : neu;
}

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

  // Nicht hier, und das mit Absicht: kreisvergleich-orte.json im Projektstamm
  // ist ein Prüf-Artefakt der Python-Pipeline (baue-sammelpunkte-handkuriert.py
  // vergleicht dagegen), keine Eingangsdatei. Nicht löschen.

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
  // .scroll-hinweis NICHT hier: er hängt nicht mehr allein am Titel, sondern
  // steht am Anfang jedes Akts wieder da, siehe draw().
  heroText = document.querySelectorAll('h1, h2, .lead');
  scrollHinweisEl = document.querySelector('.scroll-hinweis');
  begleitTexte = document.querySelectorAll('.begleittext');
  demoGruppenTexte = [...begleitTexte].filter(el => el.dataset.demoGruppe)
    .sort((a, b) => a.dataset.demoGruppe - b.dataset.demoGruppe);
  // Ein Begleittext trägt den Hinweis; sein data-Wert nennt den Fotomarker.
  fotoHinweisText = [...begleitTexte].find(el => el.dataset.fotoHinweis);
  kapitelEinstiegsTexte = document.querySelectorAll('.kapitel-einstiegstext');

  kartenMarkierungenEl = document.getElementById('kartenMarkierungen');
  kapitelEndeEl = document.getElementById('kapitelEnde');
  kapitelEndeTextEl = document.getElementById('kapitelEndeText');
  kapitelEndeWeiterEl = document.getElementById('kapitelEndeWeiter');
  haltKlickAuf(kapitelEndeWeiterEl, () => {
    // Kapitel 1 ist kein Zoom, hat aber dasselbe Kapitelende.
    let ziel = naechstesKapitel(zoomedKapitel || '01');
    if (ziel) springeZuKapitelZoom(ziel);
  });
  haltKlickAuf(document.getElementById('kapitelEndeUebersicht'), springeZurUebersicht);

  projekttextEl = document.getElementById('projekttext');
  // Klicks im Text bleiben im Text — daneben schliesst p5 den Einblender.
  haltKlickAuf(document.getElementById('projekttextInner'));
  annotationBoxEl = document.getElementById('annotationBox');
  annotationText = document.getElementById('annotationText');
  annotationInner = document.getElementById('annotationInner');
  annotationTag = document.getElementById('annotationTag');
  annotationBar = document.getElementById('annotationBar');
  kapitelRegister = document.getElementById('kapitelRegister');
  kapitelRegisterRahmen = document.getElementById('kapitelRegisterRahmen');
  grafikPlayButton = document.getElementById('grafikPlayButton');
  grafikPlayButton.addEventListener('click', toggleGrafikPlay);

  fotoPopup = document.getElementById('fotoPopup');
  fotoPopupTitel = document.getElementById('fotoPopupTitel');
  fotoPopupPlz = document.getElementById('fotoPopupPlz');
  fotoPopupBild = document.getElementById('fotoPopupBild');
  fotoPopupBeschreibung = document.getElementById('fotoPopupBeschreibung');
  document.getElementById('fotoPopupClose').addEventListener('click', schliesseFotoPopup);
  fotoPopup.addEventListener('click', e => { if (e.target === fotoPopup) schliesseFotoPopup(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      schliesseProjekttext();
      schliesseFotoPopup();
      schliesseKapitelZoom();
    }
  });

  let cnv = createCanvas(stage.offsetWidth, stage.offsetHeight);
  cnv.parent('scrollyStage');

  baueKartenMarkierungen();
  // ACHTUNG Destrukturierungs-ZUWEISUNG ohne const/let: die Handles sind oben
  // auf Modulebene deklariert. Ein `const { … } =` legte funktionslokale
  // Konstanten an, die Modulvariablen blieben undefined — der Menübalken
  // fiele still aus.
  //
  // Vorher schrieb dom-aufbau.js diese fünf direkt von aussen; jetzt baut es
  // und gibt zurück (siehe docs/best-practices-review.md, "Gruppe B").
  ({ modusZeile, planEintrag, graphEintrag, leerzeile, alleEintrag } = baueKapitelRegister());
  baueStationsMarker();
  baueZwischenMarker();
}

function windowResized() {
  resizeCanvas(stage.offsetWidth, stage.offsetHeight);
}

// Hält die Scrollposition an einer Marke fest und gibt sie zurück. Nach oben
// bleibt sie frei — der Weg zurück.
function klemmeScroll(marke) {
  let trackEl = document.querySelector('.scroll-track');
  window.scrollTo(0, trackEl.offsetHeight * marke);
  return marke;
}

function getScrollProgress() {
  let trackEl = document.querySelector('.scroll-track');
  return constrain(window.scrollY / trackEl.offsetHeight, 0, 1);
}

// Deckkraft eines scrollgebundenen Fensters: Rampe rein, Plateau, Rampe raus.
// Rampe höchstens 35% des Fensters, sonst erreicht ein kurzes Fenster nie
// volle Deckkraft. Auch die Beschriftungen am Demo-Kreis hängen daran.
function fadeDauerFuer(von, bis) {
  let fadeDauerMax = 0.187156; // 0.2 der ursprünglichen Strecke, auf die heutige umgerechnet
  return Math.min(fadeDauerMax, (bis - von) * 0.35);
}

function begleittextDeckkraft(progress, von, bis) {
  let fadeDauer = fadeDauerFuer(von, bis);
  return constrain(Math.min(
    map(progress, von, von + fadeDauer, 0, 1),
    map(progress, bis - fadeDauer, bis, 1, 0)), 0, 1);
}

// Wie begleittextDeckkraft, aber ohne das Ausblenden: der Legendenaufbau ist
// kumulativ wie im PDF — was einmal steht, bleibt stehen, bis der Schleier am
// Ende alles zusammen mitnimmt. Gleiche Einblenddauer, damit ein Schritt und
// sein Erklärtext gemeinsam kommen.
function legendenSchrittDeckkraft(progress, von, bis) {
  return constrain(map(progress, von, von + fadeDauerFuer(von, bis), 0, 1), 0, 1);
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
  // Zoomziel von Kapitel 1: nicht das ganze Kartenbild, sondern der Ausschnitt
  // um die Place de l'Opéra (KAPITEL1_AUSSCHNITT in geo-projektion.js). Das
  // Bild zeigt seit dem Neuexport ganz Paris.
  let targetCrop = bboxZuLeinwandCrop(KAPITEL1_AUSSCHNITT, ch1ImgBbox, ch1Image.width, ch1Image.height);
  let targetBbox = cropToBbox(targetCrop, ch1ImgBbox, ch1Image.width, ch1Image.height);

  let progress = getScrollProgress();
  // Ein offenes Kapitel endet mit seiner letzten Annotation: Scrollposition
  // wird nach unten festgehalten, nach oben bleibt sie frei — der Weg zurück.
  // Wo das liegt, sagt der gemeinsame Takt — bei kurzen Kapiteln deutlich vor
  // dem Ende der Strecke.
  if (zoomedKapitel) {
    let marke = kapitelAktEnde(zoomedKapitel);
    if (progress > marke) progress = klemmeScroll(marke);
  }
  // Nach oben endet jeder Akt an seinem Anfang: aus einem Kapitel oder der
  // Übersicht führt kein Scroll mehr zurück, nur das Kapitelmenü. Vorher fiel
  // man beim Hochscrollen unversehens in Kapitel 1.
  if ((zoomedKapitel || !kapitel1Geklemmt)
    && progress < SCROLL_MEILENSTEINE.uebersichtRoutenStart) {
    progress = klemmeScroll(SCROLL_MEILENSTEINE.uebersichtRoutenStart);
  }
  // Kapitel 1 endet genauso, nur liegt seine Grenze am Anfang des
  // Übersichtsakts. Gesetzt wird die Klemme allein von klemmeKapitel1(),
  // gerufen aus scrolleZuKapitel1() — nicht mehr durch Zurückscrollen.
  if (!zoomedKapitel && kapitel1Geklemmt && progress > SCROLL_MEILENSTEINE.uebersichtRoutenStart) {
    progress = klemmeScroll(SCROLL_MEILENSTEINE.uebersichtRoutenStart);
  }
  // Zweite Klemme, auf uebersichtRoutenEnd: die Überblickskarte endet dort,
  // der Ortsvergleich beginnt dort. Jede der beiden Ansichten bleibt auf ihrer
  // Seite, hinüber führt nur "Plan"/"Graph" im Register.
  if (!zoomedKapitel && !kapitel1Geklemmt) {
    let daneben = laeuftOrtsvergleich()
      ? progress < SCROLL_MEILENSTEINE.uebersichtRoutenEnd
      : progress > SCROLL_MEILENSTEINE.uebersichtRoutenEnd;
    if (daneben) progress = klemmeScroll(SCROLL_MEILENSTEINE.uebersichtRoutenEnd);
  }
  // Die Leiste misst den laufenden Akt, nicht die ganze Strecke: Hauptstrang
  // bis zum Ende von Kapitel 1, danach jedes Kapitel und die Übersicht für
  // sich. Sonst zeigte sie nach der Takt-Umstellung für denselben Weg je nach
  // Kapitel einen anderen Ausschlag — die Akte sind verschieden lang.
  let leisteVon = 0, leisteBis = SCROLL_MEILENSTEINE.uebersichtRoutenStart;
  if (zoomedKapitel) {
    leisteVon = SCROLL_MEILENSTEINE.uebersichtRoutenStart;
    leisteBis = kapitelAktEnde(zoomedKapitel);
  } else if (!kapitel1Geklemmt) {
    leisteVon = SCROLL_MEILENSTEINE.uebersichtRoutenStart;
    leisteBis = SCROLL_MEILENSTEINE.uebersichtRoutenEnd;
  }
  let leisteAnteil = constrain(map(progress, leisteVon, leisteBis, 0, 1), 0, 1);

  // Startkarte blendet vor dem Zoom auf die helle Überblickskarte über.
  let kartenwechsel = constrain(map(progress,
    SCROLL_MEILENSTEINE.kartenwechselStart, SCROLL_MEILENSTEINE.kartenwechselEnd, 0, 1), 0, 1);
  let fullCrop = coverCrop(bgImage.width, bgImage.height, 0.5, 0.5, 0); // grosse Karte bleibt zentriert, unabhängig von mapOffsetX
  // ACHTUNG der Ausschnitt muss in BEIDE Karten passen: sonst klemmt
  // bboxToImgCrop ihn an der Bildkante und streckt das Bild dabei um 2.5%.
  // Deshalb in die Schnittmenge beider Georeferenzen eingepasst.
  let fullBbox = passeBboxInRahmen(
    cropToBbox(fullCrop, startBbox, bgImage.width, bgImage.height), UEBERSICHT_SCHNITT_BBOX);

  let zoomAmount = constrain(map(progress, SCROLL_MEILENSTEINE.zoomStart, SCROLL_MEILENSTEINE.zoomEnd, 0, 1), 0, 1);
  // Solange Kapitel 1s Klemme steht, liegt die Karte in Kapitel 1; ein Klick
  // hinter das Kapitel schaltet auf die Überblickskarte um. Einen Rauszoom-Akt
  // gibt es nicht mehr, und der Sprung ist ohnehin ein Schnitt — deshalb
  // schaltet der Wert hart um, statt zu rampen. Route und Kreise bleiben
  // sichtbar: routeAmount hängt nicht am Zoom.
  let zoomOutAmount = kapitel1Geklemmt ? 0 : 1;
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
  // Der Akt hat zwei Längen: die Übersicht läuft über ihre feste Strecke, ein
  // geöffnetes Kapitel über die, die ihm der Takt zumisst — je nach Kapitel
  // kürzer oder länger.
  let aktEnde = zoomedKapitel ? kapitelAktEnde(zoomedKapitel) : SCROLL_MEILENSTEINE.uebersichtRoutenEnd;
  let uebersichtRoutenFortschritt = constrain(map(progress, SCROLL_MEILENSTEINE.uebersichtRoutenStart, aktEnde, 0, 1), 0, 1);

  // Übersichtswelt hinter Kapitel 1, in zwei Ansichten: Überblickskarte mit
  // allen Routen oder Ortsvergleich. Welche läuft, sagt der Menümodus; die
  // Klemme oben trennt nur ihre Scrollstrecken.
  // Kein Scrollmass mehr, sondern der Zustand: kein Kapitel offen und Kapitel 1
  // verlassen. Am Anfang des Akts steht der Fortschritt auf 0, die Übersicht
  // läuft aber schon — sonst fehlten dort Register und Menü.
  let inUebersicht = !zoomedKapitel && !kapitel1Geklemmt;
  let imOrtsvergleich = laeuftOrtsvergleich(); // uebersichtsrouten.js

  // Kapitel-Zoom öffnet sofort mit voller Route, nur zeitlich eingeblendet.
  aktualisiereKapitelZoom();

  let activeBbox = {
    west: lerp(fullBbox.west, targetBbox.west, zoomAmount),
    east: lerp(fullBbox.east, targetBbox.east, zoomAmount),
    south: lerp(fullBbox.south, targetBbox.south, zoomAmount),
    north: lerp(fullBbox.north, targetBbox.north, zoomAmount),
  };

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

  let kartenAlpha = 255 * (1 - zoomAmount);
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
  tint(255, 255 * zoomAmount);
  image(ch1Image, mapOffsetX, mapOffsetY, width - mapOffsetX, height, ch1Crop.x, ch1Crop.y, ch1Crop.w, ch1Crop.h);
  noTint();

  if (kapitelCrop && kapitelZoomAmount > 0.001) {
    let k = kapitelKarten[zoomedKapitel];
    tint(255, 255 * kapitelZoomAmount);
    image(k.bild, mapOffsetX, mapOffsetY, width - mapOffsetX, height, kapitelCrop.x, kapitelCrop.y, kapitelCrop.w, kapitelCrop.h);
    noTint();
  }

  let massstabOffsetX = (kapitelCrop && kapitelZoomAmount > 0.5) ? mapOffsetX : kartenOffsetX;
  // Beim Ausfahren des Legendenbalkens rückt sie mit hinein, wie im PDF: der
  // Ruheplatz liegt 76 px über dem unteren Rand, ganz offen kommen 78 dazu —
  // dann steht sie 4 px innerhalb der 158 px hohen Balkenoberkante.
  // Ein Frame Verzug gegenüber legendeAus, das erst weiter unten nachgeführt
  // wird — bei 60 Bildern in der Sekunde nicht zu sehen.
  zeichneMassstabsleiste(activeBbox, massstabOffsetX,
    Math.max(0, legendenLeisteHoehe(legendeAus) - 80));

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

  // Unbedingt aufrufen, auch ausserhalb des Akts: zeichneUebersichtsrouten()
  // setzt dann selbst kapitelHover und den Cursor zurück. Ob der Akt läuft,
  // sagt der dritte Wert — nicht der Fortschritt, der an seinem Anfang auf 0
  // steht, wo Startpunkte und Nummern schon dastehen sollen. Im Ortsvergleich
  // deckt die Ansicht die Karte ohnehin ab, und die Startpunkte fallen dort
  // zugleich als unsichtbare Klickziele weg.
  let uebersichtRoutenErgebnis = zeichneUebersichtsrouten(activeBbox,
    uebersichtRoutenFortschritt, !imOrtsvergleich && (!!zoomedKapitel || inUebersicht));
  aktuelleAnnotationZoom = uebersichtRoutenErgebnis.aktuelleAnnotationZoom;

  // ACHTUNG Sperre nötig: bei gezoomtem Kapitel zeigt activeBbox dessen Bbox,
  // nicht Kapitel 1s Gegend. Ohne sie liefe Kapitel 1s Route quer über den
  // fremden Kartenausschnitt.
  if (!zoomedKapitel) {
    // Strichstärke 3 -> 2 auf der Überblickskarte, wie die Übersichtsrouten.
    zeichneRoute(stationenData.routenPunkte, liniIndex, activeBbox, lerp(3, 2, zoomOutAmount), kartenOffsetX, kartenOffsetY, 1);
    // Kreise nur in Kapitel 1s eigenem Ausschnitt; auf der Überblickskarte
    // zeigt sie niemand. Route und Spine bleiben davon unberührt.
    if (zoomOutAmount <= 0) {
      zeichneKreiseOrtRuns(punktIndex, annIndex, activeBbox, kartenOffsetX, kartenOffsetY);
    }
  }

  // Hinter "Graph" liegen zwei Ansichten: im Kapitel die Spine, in der
  // Übersicht der Ortsvergleich. Beide decken Karte, Route und Kreise dieses
  // Frames vollständig ab.
  if (inKapitelGrafikAnsicht || imOrtsvergleich) {
    background(226, 230, 225); // #E2E6E1
    aktualisiereGrafikFortschritt(); // ein Playhead für beide Ansichten
  }
  if (inKapitelGrafikAnsicht) {
    let grafikEintraege = spineEintraegeFuer(zoomedKapitel);
    let grafikDaten = zoomedKapitel ? datenFuerKapitel(zoomedKapitel) : stationenData;
    zeichneSpineHorizontal(grafikEintraege || [], grafikFortschritt, grafikDaten);
  }
  // Zählt aus demselben Fortschritt die Kapitel durch, siehe ortsveraenderung.js.
  if (imOrtsvergleich) zeichneOrtsveraenderung(grafikFortschritt);

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

  // Die Demo-Kreisgrafik steht ab dem Kartenwechsel. Steht hier oben, weil
  // das Kapitelende darauf aufbaut.
  let demoAlpha = progress < SCROLL_MEILENSTEINE.kartenwechselEnd ? 0 : 1;

  // Der Projekttext geht am Ende der Route von selbst auf und bleibt, bis er
  // weggeklickt oder durchgescrollt ist. Zurückgescrollt zählt als neuer
  // Durchlauf, dann geht er wieder auf.
  let imProjekttextFenster = !zoomedKapitel
    && progress >= SCROLL_MEILENSTEINE.routeEnd
    && progress < SCROLL_MEILENSTEINE.kapitelEndeStart;
  if (progress < SCROLL_MEILENSTEINE.routeEnd) projekttextWeggeklickt = false;
  projekttextOffen = projekttextPerRegister || (imProjekttextFenster && !projekttextWeggeklickt);
  // Das Register «Legende» gehört zum Kapitelmenü und kommt mit ihm: davor, auf
  // der dunklen Startkarte und im Legendenaufbau, gibt es noch keine
  // Kreisgrafik zu erklären. «Info» steht dort allein. Steht hier oben, weil
  // der Ausfahrgrad gleich darauf aufbaut.
  let imRegisterbereich = inKapitelAnsicht || inUebersicht;
  if (!imRegisterbereich) legendenLeisteOffen = false;
  legendeAus = naehereRegister(legendeAus, legendenLeisteOffen ? 1 : 0);
  infoAus = naehereRegister(infoAus, projekttextOffen ? 1 : 0);

  // Kapitelende, in jedem Kapitel: die beiden Klickziele. In 02–18 steht der
  // Scroll dort geklemmt, Kapitel 1 hat dafür seine eigene Strecke zwischen
  // Projekttext und Klemme.

  // Nicht an eine Scrollmarke allein gebunden, sondern an "der Projekttext ist
  // zu": sonst zeigte der X-Weg die Kartenansicht ohne Hinweis und Buttons,
  // bis man bis zur Klemme durchgescrollt hätte.
  let kapitel1AmEnde = !zoomedKapitel && kapitel1Geklemmt && !projekttextOffen
    && progress >= SCROLL_MEILENSTEINE.routeEnd;
  // Schwelle aus der Annotationszahl, nicht fest: dieselbe Rechnung wie
  // annIndexZoom. Ein fester Wert läge je nach Kapitellänge daneben.
  let anzahl = annotationsZahl(zoomedKapitel);
  let kapitelLokalerFortschritt = constrain(map(uebersichtRoutenFortschritt,
    kapitelEinstiegWeg(zoomedKapitel), 1, 0, 1), 0, 1);
  let zoomAmEnde = !!zoomedKapitel && kapitelZoomAmount > 0.5
    && anzahl > 0 && kapitelLokalerFortschritt >= (anzahl - 1) / anzahl;
  // Nur in der Kartenansicht — in der Graph-Ansicht sitzt dort der Play-Button.
  // Ein Wert für beide Leser: das Buttonpaar und die Annotationsbox unten.
  let amKapitelEnde = (kapitel1AmEnde || zoomAmEnde) && kapitelAnsichtsModus === 'karte';
  if (kapitelEndeEl) {
    kapitelEndeEl.classList.toggle('sichtbar', amKapitelEnde);
    // Kapitel 18 hat keinen Nachfolger, dort bleibt nur "Übersicht".
    kapitelEndeWeiterEl.classList.toggle('versteckt', !naechstesKapitel(zoomedKapitel || '01'));
  }
  // Der Hinweis darüber gilt nur für Kapitel 1. Er hängt an derselben Klasse
  // wie das Buttonpaar statt an einem eigenen Scroll-Fenster — beide kommen
  // und gehen zusammen.
  if (kapitelEndeTextEl) kapitelEndeTextEl.classList.toggle('sichtbar', kapitel1AmEnde);

  // Am Kapitelende schweigt die Annotationsbox. Sie lüde zum Weiterlesen ein,
  // während Hinweis und Buttons daneben das Kapitel abschliessen — zwei
  // Signale, die sich widersprechen.
  if (amKapitelEnde) aktuelleAnnotation = null;

  if (aktuelleAnnotation) {
    annotationText.textContent = '«' + aktuelleAnnotation.text + '»';
    annotationText.style.opacity = 1;
    annotationInner.style.opacity = 1;
    annotationInner.style.background = 'rgba(226, 230, 225, 0.85)';
    let catColor = CATEGORY_COLORS[aktuelleAnnotation.category] || ROUTE_COLOR;
    let fwertColor = FWERT_COLOR;
    annotationBar.style.background = aktuelleAnnotation.hasFwert
      ? `linear-gradient(90deg, ${catColor}, ${fwertColor})`
      : catColor;
    annotationTag.textContent = CATEGORY_LABELS[aktuelleAnnotation.category] || '';
  } else {
    annotationText.style.opacity = 0;
    annotationInner.style.opacity = 0;
    annotationTag.textContent = '';
  }

  // Kapitelregister: in jeder Kapitel-Ansicht und in beiden
  // Übersichtsansichten, damit man von dort direkt weiterspringen kann.
  // imRegisterbereich fällt weiter oben an, siehe dort.
  kapitelRegister.classList.toggle('sichtbar', imRegisterbereich);

  // Plan/Graph gilt in beiden Welten: im Kapitel schaltet es zwischen Karte
  // und Spine, in der Übersicht zwischen Überblickskarte und Ortsvergleich.
  // "Alle" bleibt daneben der Eintrag der Übersicht.
  modusZeile.classList.toggle('versteckt', !imRegisterbereich);
  leerzeile.classList.toggle('versteckt', !imRegisterbereich);
  alleEintrag.classList.toggle('aktiv', inUebersicht);
  planEintrag.classList.toggle('aktiv', kapitelAnsichtsModus === 'karte');
  graphEintrag.classList.toggle('aktiv', kapitelAnsichtsModus === 'grafik');
  if (inKapitelAnsicht) {
    Object.entries(kapitelRegisterEintraege).forEach(([nr, eintrag]) => {
      eintrag.classList.toggle('aktiv', zoomedKapitel ? nr === zoomedKapitel : nr === '01');
    });
  } else if (inUebersicht) {
    // Kein Kapitel aktiv, sonst bliebe eine veraltete Hervorhebung stehen.
    Object.values(kapitelRegisterEintraege).forEach(eintrag => eintrag.classList.remove('aktiv'));
  }

  grafikPlayButton.classList.toggle('sichtbar', inKapitelGrafikAnsicht || imOrtsvergleich);
  grafikPlayButton.textContent = grafikSpielt ? '❚❚' : '▶';

  // Kartenbezogene DOM-Overlays blenden sich in der Graph-Ansicht per CSS
  // aus, siehe .scrolly-stage.grafik-ansicht in style.css.
  stage.classList.toggle('grafik-ansicht', inKapitelGrafikAnsicht || imOrtsvergleich);

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
  // Linear wie die Ausblendrampe der Begleittexte (begleittextDeckkraft): auf
  // der kurzen Überblendstrecke bliebe eine Kurve fast bis zum Schluss oben
  // und risse dann ab — der Titel läge dann über dem schon vollen ersten Text.
  let heroProgress = constrain(map(progress, SCROLL_MEILENSTEINE.heroFadeStart, SCROLL_MEILENSTEINE.heroFadeEnd, 0, 1), 0, 1);
  let heroOpacity = 1 - heroProgress;
  heroText.forEach(el => el.style.opacity = heroOpacity);

  // «Scrollen» steht am Anfang jedes Akts: im Intro mit dem Titel, danach zu
  // Beginn von Kapitel 1 (ab dem Zoomende), der Kapitel 02–18 und der
  // Überblickskarte. Es blendet über die ersten SCROLL_HINWEIS_VH aus, sobald
  // man losscrollt — in der Graph-Ansicht gar nicht, dort treibt der
  // Play-Knopf und der Hinweis wäre eine falsche Auskunft.
  let aktAnfang = (zoomedKapitel || inUebersicht)
    ? SCROLL_MEILENSTEINE.uebersichtRoutenStart : SCROLL_MEILENSTEINE.zoomEnd;
  let hinweisAkt = (progress < aktAnfang || inKapitelGrafikAnsicht || imOrtsvergleich) ? 0
    : 1 - constrain((progress - aktAnfang) * SCROLL_TRACK_VH / SCROLL_HINWEIS_VH, 0, 1);
  scrollHinweisEl.style.opacity = Math.max(heroOpacity, hinweisAkt);
  // Weiss auf der dunklen Startkarte, danach in der Tinte der Bedienelemente.
  scrollHinweisEl.classList.toggle('auf-hell', progress >= SCROLL_MEILENSTEINE.kartenwechselEnd);

  // Begleittexte: jedes <p class="begleittext"> blendet in seinem eigenen
  // data-von/data-bis-Fenster ein und aus. Neue Texte brauchen kein JS.
  begleitTexte.forEach(el => {
    let opacity = begleittextDeckkraft(progress, parseFloat(el.dataset.von), parseFloat(el.dataset.bis));
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
  let imUebersichtsakt = inUebersicht && !imOrtsvergleich;

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
        kapitelEinstiegHalt(zoomedKapitel), kapitelEinstiegWeg(zoomedKapitel), 0, 1), 0, 1);
      // Graph-Ansicht: zusätzlicher Ausblendweg ab dem Play-Klick, gleiche
      // Dauer wie das Einblenden.
      let ausblendenPlay = grafikPlayAusblendStart === null ? 1 :
        1 - constrain(map(millis() - grafikPlayAusblendStart, 0, KAPITEL_EINSTIEG_FADE_MS, 0, 1), 0, 1);
      opacity = Math.min(einblenden, ausblenden, ausblendenPlay) * kapitelZoomAmount;
    }
    el.style.opacity = opacity;
  });
  // Foto-Marker ganz zuletzt. Offset wie die sichtbare Karte: fixer
  // mapOffsetX/Y bei gezoomtem Kapitel, sonst kartenOffsetX/Y.
  let fotoOffsetX = (zoomedKapitel && kapitelZoomAmount > 0.001) ? mapOffsetX : kartenOffsetX;
  let fotoOffsetY = (zoomedKapitel && kapitelZoomAmount > 0.001) ? mapOffsetY : kartenOffsetY;
  // ACHTUNG die Lage nur merken, solange die Marker wirklich im Bild stehen:
  // hinter "Graph" deckt Spine bzw. Ortsvergleich sie zu, und der Treffertest
  // in mousePressed() öffnete sonst Fotos an unsichtbaren Stellen.
  let fotoMarkerSichtbar = !inKapitelGrafikAnsicht && !imOrtsvergleich;
  merkeKartenlage(fotoMarkerSichtbar ? activeBbox : null, fotoOffsetX, fotoOffsetY);
  // Der Bedienhinweis teilt sich das Scroll-Fenster mit seinem Kommentartext,
  // damit beide zusammen erscheinen und wieder gehen.
  let fotoHinweis = fotoHinweisText ? {
    titel: fotoHinweisText.dataset.fotoHinweis,
    text: FOTO_HINWEIS_TEXT,
    alpha: begleittextDeckkraft(progress,
      parseFloat(fotoHinweisText.dataset.von), parseFloat(fotoHinweisText.dataset.bis)),
  } : null;
  if (fotoMarkerSichtbar) zeichneFotoMarker(activeBbox, fotoOffsetX, fotoOffsetY, fotoHinweis);

  // Demo-Kreisgrafik: wächst über den Erklärungstexten heran und blendet mit
  // dem Zoom wieder aus, während die Kapitelkarte aufzieht. Ganz zuletzt
  // gezeichnet, damit sie über allen Ansichten liegt — auch über der
  // Graph-Ansicht, die den Rest des Frames überdeckt.
  let demoFortschritt = constrain(map(progress, SCROLL_MEILENSTEINE.demoStart, SCROLL_MEILENSTEINE.demoVoll, 0, 1), 0, 1);
  let demoAusblenden = constrain(map(progress, SCROLL_MEILENSTEINE.zoomStart, SCROLL_MEILENSTEINE.zoomEnd, 0, 1), 0, 1);
  // Der Schleier ist vor dem Kreis da: er steigt an, während nur der
  // Mittelpunkt mit seiner Ortsbeschriftung dasteht, und geht erst nach dem
  // letzten Legendenschritt wieder weg.
  let legendeSchleier = Math.min(
    constrain(map(progress, SCROLL_MEILENSTEINE.kartenwechselEnd, SCROLL_MEILENSTEINE.demoStart, 0, 1), 0, 1),
    constrain(map(progress, SCROLL_MEILENSTEINE.legendeSchleierAus, SCROLL_MEILENSTEINE.legendeEnde, 1, 0), 0, 1));
  if (legendeSchleier > 0) zeichneSchleier(LEGENDE_SCHLEIER, LEGENDE_SCHLEIER_ALPHA * legendeSchleier);

  // Monoton: jeder Schritt blendet mit seinem Erklärungstext ein und bleibt
  // dann stehen. Der Schleier geht getrennt davon in zeichneDemoKreisgrafik
  // ein — er nimmt am Ende die Beschriftungen mit, nicht aber die
  // Differenzierung des Kreises. Sonst fiele die Grafik beim Ausblenden auf
  // den schlichten Streifenkreis der ersten Stufe zurück.
  let legendeSchritte = demoGruppenTexte.map(el =>
    legendenSchrittDeckkraft(progress, parseFloat(el.dataset.von), parseFloat(el.dataset.bis)));

  zeichneDemoKreisgrafik(demoFortschritt, demoAlpha * (1 - demoAusblenden),
    legendeSchritte, legendeSchleier);

  // Zuoberst die beiden Register: erst der Legendenbalken, dann die
  // Info-Fläche, die beim Ausfahren alles zudeckt, die Reiter eingeschlossen.
  // Fortschrittsleiste zuerst, die Register darüber: ihre Reiter sitzen an
  // derselben Stelle am unteren Rand und sollen davor liegen. In der
  // Graph-Ansicht entfällt sie — dort treibt der Play-Knopf, nicht der Scroll,
  // und er sitzt an derselben Stelle.
  if (!inKapitelGrafikAnsicht && !imOrtsvergleich) zeichneScrollFortschritt(leisteAnteil);
  zeichneRegisterleiste(legendeAus, imRegisterbereich);
  zeichneInfoLeiste(infoAus, legendeAus);

  // Die DOM-Ebene geht schon beim Anfahren weg: sie liegt über dem Canvas und
  // stünde sonst hell auf der heraufziehenden Fläche. Der Text kommt umgekehrt
  // erst, wenn die Fläche ganz oben ist.
  // Das Kapitelmenü liegt als DOM über dem Canvas; der Rahmen schneidet es an
  // der Oberkante des ausgefahrenen Registers ab, damit es dahinter
  // verschwindet statt darauf zu stehen — beim flachen Legendenbalken wie bei
  // der Info-Fläche, die bis nach oben zieht. registerHoehe zählt die Reiter
  // mit: sie sitzen auf der Balkenkante und dürfen nie verdeckt sein. Nur bei
  // Änderung schreiben, sonst rechnet der Browser jeden Frame das Layout neu.
  let schnitt = Math.round(Math.max(registerHoehe(legendeAus), height * infoAus));
  if (schnitt !== registerSchnitt) {
    registerSchnitt = schnitt;
    kapitelRegisterRahmen.style.bottom = schnitt + 'px';
  }
  document.body.classList.toggle('legende-offen', legendeAus > 0.01);
  document.body.classList.toggle('projekttext-offen', infoAus > 0.01);
  projekttextEl.classList.toggle('offen', infoAus > 0.99);

  // Nach zeichneUebersichtsrouten, das den Cursor jeden Frame selbst setzt.
  if ((!projekttextOffen && kategorieZeileGetroffen(mouseX, mouseY))
    || reiterGetroffen(mouseX, mouseY)) cursor(HAND);
}

// ---------------------------------------------------------------------------
// Klicks auf dem Canvas
// ---------------------------------------------------------------------------
// Vier anklickbare Familien: die Klangsymbole der Legende und die beiden
// Reiter (kreisgrafik.js), die Kapitel-Startpunkte (uebersichtsrouten.js) und
// die Fotomarker (fotomarker.js). Der erste Treffer gewinnt. Die Startpunkte
// bringen ihren Treffer als kapitelHover schon mit, die anderen nur ihre Lage.

// Nicht hier: Kapitelregister (dom-aufbau.js) und Play-Knopf sind HTML mit
// eigenen Listenern.

function mousePressed() {
  // Zuerst die Klangsymbole der Legende. Sie stammen aus zwei Quellen: dem
  // Legendenaufbau im Onboarding und dem Legendenbalken. Getroffen wird nur,
  // was in diesem Frame gezeichnet wurde — deshalb reicht eine Prüfung für
  // beide. Der Projekttext deckt sie zu und geht vor.
  if (!projekttextOffen) {
    let kategorie = kategorieZeileGetroffen(mouseX, mouseY);
    if (kategorie) { spieleKategorieKlang(kategorie); return; }
  }
  // Sonst fängt der offene Projekttext jeden Klick ab.
  if (projekttextOffen) { schliesseProjekttext(); return; }
  // Die beiden Reiter. «Info» fährt über alles, deshalb geht der Balken zu.
  let reiter = reiterGetroffen(mouseX, mouseY);
  if (reiter === 'legende') { legendenLeisteOffen = !legendenLeisteOffen; return; }
  if (reiter === 'info') {
    legendenLeisteOffen = false;
    projekttextPerRegister = true;
    return;
  }
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

// --- Export ------------------------------------------------------------
// 30 Namen: 12 als Wert, 5 p5-Hooks, 13 als Lesebindung.

// Konstanten, Funktionen und die vier nur befüllten Container: Die Bindung
// ändert sich nie, deshalb Wertzuweisung.
window.WEITERE_KAPITEL_NUMMERN = WEITERE_KAPITEL_NUMMERN;
window.kapitelEinstiegWeg = kapitelEinstiegWeg;
window.kapitelRegisterEintraege = kapitelRegisterEintraege;
window.markierungsEintraege = markierungsEintraege;
window.stationsMarker = stationsMarker;
window.zwischenMarker = zwischenMarker;
window.datenFuerKapitel = datenFuerKapitel;
window.kapitelHatEigeneAnsicht = kapitelHatEigeneAnsicht;
window.setzeAnsichtsModus = setzeAnsichtsModus;
window.loeseKapitel1Klemme = loeseKapitel1Klemme;
window.klemmeKapitel1 = klemmeKapitel1;
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
// Für waehleAnsichtsModus() in uebersichtsrouten.js: solange die Klemme steht,
// gilt "Plan"/"Graph" der Kapitel-1-Ansicht, danach der Übersicht.
lesebindung('kapitel1Geklemmt', () => kapitel1Geklemmt);
lesebindung('kapitel1ZoomAmount', () => kapitel1ZoomAmount);
lesebindung('annotationText', () => annotationText);
lesebindung('kartenMarkierungenEl', () => kartenMarkierungenEl);
lesebindung('kapitelRegister', () => kapitelRegister);
lesebindung('modusZeile', () => modusZeile);
lesebindung('planEintrag', () => planEintrag);
lesebindung('graphEintrag', () => graphEintrag);
lesebindung('leerzeile', () => leerzeile);
lesebindung('alleEintrag', () => alleEintrag);

})(); // Ende der Modulkapselung, siehe Kommentar oben
