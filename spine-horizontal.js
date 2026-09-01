/* =============================================================================
   spine-horizontal.js — Graph-Ansicht: horizontale Spine + Play-Steuerung

   Alternative zur Kartenansicht: jedes Kapitel zeigt seine Orte als
   waagrechte Zeitleiste, deren Kreisgrafiken per Play-Animation mitwachsen.
   Umschalten über "Plan"/"Graph" im Kapitelregister, abspielen über den
   Play-Button, synchron zum Ton aus sonifikation.js.

   ACHTUNG Abhängigkeitszyklus mit sonifikation.js: beide greifen gegenseitig
   zu. Trägt nur, weil alle Zugriffe zur Laufzeit passieren — kein
   Top-Level-Initialisierer hier darf je eine fremde Funktion aufrufen.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 15 von 26 Namen intern, 11 exportiert. Konvention: docs/architektur.md.
(function () {

// Zustand der Play-Animation.
let grafikSpielt = false;       // läuft die Wachstums-Animation gerade?
let grafikStartZeit = 0;        // millis() bei Play-Start (bzw. rechnerisch zurückversetzt bei Resume)
let grafikFortschritt = 0;      // 0..1, letzter berechneter Animationsstand (bleibt bei Pause stehen)
// millis() beim Play-Klick: der Einstiegstext weicht hier dem Play statt dem
// Scrollen. null = noch kein Play in dieser Ansicht.
let grafikPlayAusblendStart = null;

// ---------------------------------------------------------------------------
// Spine in p5
// ---------------------------------------------------------------------------

// Spine-Daten: einmal berechnen und halten.
let spineEintraegep5 = [];  // { typ, text, rv, stationIdx, kreisId }
let spineEintraegeKapitel = {}; // Cache je Kapitelnummer (02–18), lazy befüllt beim ersten Zoom

// Baut die beiden Caches auf. kapitelNr ist letzterZoomKapitel, nicht
// zoomedKapitel: das Panel braucht beim Ausblenden noch seine Daten.
function stelleSpineDatenBereit(kapitelNr) {
  if (spineEintraegep5.length === 0 && stationenData.ortRuns) {
    spineEintraegep5 = baueSpineDaten(stationenData, ortRunsFuerSpine(stationenData));
  }
  if (kapitelNr && !spineEintraegeKapitel[kapitelNr]) {
    let daten = datenFuerKapitel(kapitelNr);
    if (daten && daten.ortRuns) {
      spineEintraegeKapitel[kapitelNr] = baueSpineDaten(daten, ortRunsFuerSpine(daten));
    }
  }
}

// Ohne Kapitelnummer die Einträge von Kapitel 1, sonst die des gezoomten
// Kapitels. Hält die beiden Caches modulintern.
function spineEintraegeFuer(kapitelNr) {
  return kapitelNr ? spineEintraegeKapitel[kapitelNr] : spineEintraegep5;
}

// Menübalken "Plan"/"Graph". Jeder Wechsel in die Graph-Ansicht beginnt bei
// 0, die Animation muss per Play gestartet werden.
function setzeKapitelAnsichtModus(modus) {
  if (kapitelAnsichtsModus === modus) return; // nur gelesen, nicht geschrieben
  setzeAnsichtsModus(modus);   // sketch.js
  setzeGrafikZurueck();        // eigener Zustand, siehe unten
}

// Setzt den Play-Zustand zurück und stoppt den Ton mit — sonst liefe er
// verwaist weiter. Gerufen bei Modus- und bei Kapitelwechsel.
function setzeGrafikZurueck() {
  if (sonifikationSpieltGerade) beendeSonifikationAudio();
  grafikSpielt = false;
  grafikFortschritt = 0;
  grafikPlayAusblendStart = null;
}

// Schrittgeschwindigkeit von Kapitel 1: dessen Audiostück, geteilt durch
// seine Spine-Einträge. Bezug für alle anderen Ansichten.
function dauerProSchritt() {
  return (SONIFIKATION_GESAMTDAUER_SEK * 1000) / (spineEintraegep5.length - 1 || 1);
}

// Kapitel 1 nutzt die Dauer des Audiostücks, 02–18 dieselbe Geschwindigkeit
// pro Spine-Eintrag — sonst wirken kurze Kapitel hastig durchgespult.
function aktuelleGrafikAnimationDauer() {
  // Im Elementmodell zählt die Zahl der Klänge, nicht die der Orte: Kapitel 2
  // spielt an einem einzigen Ort und bekäme über die Ortsformel unten 2,6 s
  // für 118 Elemente. Die Sonifikation gibt null zurück, wenn sie nicht
  // zuständig ist — dann gilt weiter die Ortsformel.
  let ausElementen = typeof sonifikationElementDauerMs === 'function'
    ? sonifikationElementDauerMs(zoomedKapitel) : null;
  if (ausElementen) return ausElementen;

  // Ohne Elementmodell zählt der Ortsvergleich Kapitel statt Spine-Einträge;
  // sonst bekäme er über zoomedKapitel === null die Dauer von Kapitel 1.
  if (laeuftOrtsvergleich()) return dauerProSchritt() * (OV_KAPITEL_ZAHL - 1);

  if (!zoomedKapitel) return SONIFIKATION_GESAMTDAUER_SEK * 1000;
  let eintraege = spineEintraegeKapitel[zoomedKapitel];
  let ni = eintraege ? eintraege.length : 1;
  return dauerProSchritt() * (ni - 1 || 1);
}

// Play/Pause der Spine-Animation, mit Ton synchron.
// ACHTUNG die Spine setzt bei Pause->Play fort, der Ton beginnt neu: Strudel
// kann nicht an einer beliebigen Stelle einsteigen.
function toggleGrafikPlay() {
  if (grafikFortschritt >= 1) grafikFortschritt = 0; // am Ende: von vorn
  grafikSpielt = !grafikSpielt;
  if (grafikSpielt) {
    // Nur beim ERSTEN Start merken, sonst blendet Pause/Weiter erneut aus.
    if (grafikPlayAusblendStart === null) grafikPlayAusblendStart = millis();
    grafikStartZeit = millis() - grafikFortschritt * aktuelleGrafikAnimationDauer();
    spieleSonifikationFuer(zoomedKapitel);
  } else if (sonifikationSpieltGerade) {
    beendeSonifikationAudio();
  }
}

function aktualisiereGrafikFortschritt() {
  if (!grafikSpielt) return;
  grafikFortschritt = constrain((millis() - grafikStartZeit) / aktuelleGrafikAnimationDauer(), 0, 1);
  if (grafikFortschritt >= 1) grafikSpielt = false; // Ende erreicht, Button springt zurück auf Play
}

// Fester Abstand je Ortspunkt, Gesamtbreite ist n * Abstand; reicht der
// Platz nicht, wird gestaucht. Rechts hält der Rand das Kapitelregister frei
// (5vw), links steht nur Luft — beide gleich breit, damit die Spine mittig
// im Bild bleibt.
const SPINE_PUNKT_ABSTAND = 70;
const SPINE_RAND_LINKS = 200;
const SPINE_RAND_RECHTS = 200;
// Vertikale Linie vom Ortspunkt nach unten zur (horizontalen) Beschriftung.
const SPINE_LABEL_LINIE_LAENGE = 16;
const SPINE_LABEL_TEXT_ABSTAND = 6;

// Label-Zeilen werden EINMAL je Kapitel und Breite aus dem Endstand
// berechnet, damit sie beim Scrollen stillstehen.
const SPINE_LABEL_HOEHE = 16;
const SPINE_LABEL_ZEILEN_ABSTAND = 30;
// Freizuhaltender Rand für die vertikale Lage der Spine. Unten mehr wegen
// Play-Button und Scroll-Fortschrittsbalken.
const SPINE_RAND_OBEN = 24;
const SPINE_RAND_UNTEN = 76;
const spineLayoutCache = new WeakMap(); // eintraege-Array -> { breite, hoehe, versatz, breiten, linienY }

function spineLayout(eintraege, daten, abstand, startX) {
  let vorhanden = spineLayoutCache.get(eintraege);
  if (vorhanden && vorhanden.breite === width && vorhanden.hoehe === height) return vorhanden;

  // Grösster Kreisradius am Kapitelende. Alle Labels liegen darunter, damit
  // kein später gewachsener Kreis sie überdeckt.
  let letzterIndex = daten.annotationen.length - 1;
  let maxRadius = 0;
  eintraege.forEach(e => {
    if (e.typ === 'rueckkehr') return; // zeichnet keinen eigenen Kreis
    let bc = zaehleAnnotationenLiveNachOrtBasis(wohnungFilterFuerOrt(e.ortBasis), letzterIndex, daten);
    maxRadius = Math.max(maxRadius, groessterKreisRadius(bc));
  });

  // Höchster Rückkehr-Bogen: Halbkreis über der Linie, Radius ist der halbe
  // Abstand zum Ursprungskreis. Bestimmt, wie tief die Linie liegen muss.
  let maxBogen = 0;
  eintraege.forEach((e, i) => {
    if (e.typ !== 'rueckkehr') return;
    maxBogen = Math.max(maxBogen, Math.abs(i - e.zielIndex) * abstand / 2);
  });

  // Dieselbe Schrift wie beim Zeichnen, sonst stimmen die Breiten nicht.
  textFont(SCHRIFT_SANS);
  textStyle(BOLD);
  textSize(13);

  // Jedes Label in die oberste Zeile, in der rechts noch Platz ist.
  let zeilenEnde = [];
  let versatz = [];
  let breiten = [];
  eintraege.forEach((e, i) => {
    let x = startX + i * abstand;
    breiten[i] = textWidth(e.text);
    let halbeBreite = breiten[i] / 2 + 4;
    let zeile = zeilenEnde.findIndex(ende => x - halbeBreite > ende);
    if (zeile === -1) {
      zeile = zeilenEnde.length;
      zeilenEnde.push(-Infinity);
    }
    zeilenEnde[zeile] = x + halbeBreite;
    versatz[i] = maxRadius + SPINE_LABEL_LINIE_LAENGE + zeile * (SPINE_LABEL_HOEHE + SPINE_LABEL_ZEILEN_ABSTAND);
  });

  // Linie so weit nach unten, dass oben Bögen und Kreise Platz haben und
  // unten die Labels. Passt beides, bleibt sie mittig.
  let oben = Math.max(maxRadius, maxBogen);
  let unten = Math.max(...versatz) + SPINE_LABEL_TEXT_ABSTAND + SPINE_LABEL_HOEHE;
  let frei = height - SPINE_RAND_OBEN - SPINE_RAND_UNTEN;
  let linienY;
  if (oben + unten <= frei) {
    linienY = constrain(height / 2, SPINE_RAND_OBEN + oben, height - SPINE_RAND_UNTEN - unten);
  } else {
    // Sehr niedriges Fenster: Überstand proportional auf beide Seiten.
    linienY = SPINE_RAND_OBEN + frei * (oben / (oben + unten));
  }

  let ergebnis = { breite: width, hoehe: height, versatz, breiten, linienY };
  spineLayoutCache.set(eintraege, ergebnis);
  return ergebnis;
}

// Zentrierte Zeitleiste, per fortschritt (0..1) enthüllt. Alle Kreise teilen
// einen Spielkopf; eine Rückkehr bekommt nur einen Bogen, keinen zweiten Kreis.
function zeichneSpineHorizontal(eintraege, fortschritt, daten = stationenData) {
  if (!eintraege.length) return;

  let n = eintraege.length;
  let verfuegbareBreite = width - SPINE_RAND_LINKS - SPINE_RAND_RECHTS;
  let abstand = n > 1 ? Math.min(SPINE_PUNKT_ABSTAND, verfuegbareBreite / (n - 1)) : SPINE_PUNKT_ABSTAND;
  let startX = SPINE_RAND_LINKS + (verfuegbareBreite - (n - 1) * abstand) / 2;
  // Lage und Label-Anordnung kommen fertig aus spineLayout (gecacht).
  let layout = spineLayout(eintraege, daten, abstand, startX);
  let linieY = layout.linienY;

  // Playhead entlang der n Einträge. Eintrag 0 ist schon vor dem Play da.
  let position = fortschritt * (n - 1 || 1);

  // Interpoliert zwischen den revealIndex-Werten. Letzter Wegpunkt ist das
  // Ende aller Annotationen, sonst wird der letzte Kreis nie voll.
  let rvWegpunkte = eintraege.map(e => e.rv);
  rvWegpunkte[n - 1] = daten.annotationen.length - 1;
  let globalAnnIndex;
  if (n === 1) {
    // Einziger Eintrag (z.B. Kapitel 2): ab -1 interpolieren, sonst steht der
    // Kreis ab fortschritt=0 sofort voll.
    globalAnnIndex = Math.round(lerp(-1, rvWegpunkte[0], fortschritt));
  } else {
    let i0 = Math.min(n - 1, Math.floor(position));
    let i1 = Math.min(n - 1, i0 + 1);
    globalAnnIndex = Math.round(lerp(rvWegpunkte[i0], rvWegpunkte[i1], position - i0));
  }

  if (position > 0) {
    noFill();
    stroke(ROUTE_COLOR_RGB.r, ROUTE_COLOR_RGB.g, ROUTE_COLOR_RGB.b, 255);
    strokeWeight(2);
    line(startX, linieY, startX + Math.min(n - 1, position) * abstand, linieY);
  }

  // Rückkehr-Bögen zuerst, damit sie unter Kreisen und Punkten liegen.
  eintraege.forEach((e, i) => {
    if (e.typ !== 'rueckkehr') return;
    let alphaSkala = constrain(position - (i - 1), 0, 1);
    if (alphaSkala <= 0) return;
    let x = startX + i * abstand;
    let zielX = startX + e.zielIndex * abstand;
    // Canvas-Pfad statt p5s arc(), siehe ACHTUNG unten bei fillText.
    drawingContext.strokeStyle = `rgba(${ROUTE_COLOR_RGB.r}, ${ROUTE_COLOR_RGB.g}, ${ROUTE_COLOR_RGB.b}, ${alphaSkala})`;
    drawingContext.lineWidth = 2;
    drawingContext.beginPath();
    drawingContext.arc((x + zielX) / 2, linieY, Math.abs(x - zielX) / 2, PI, TWO_PI);
    drawingContext.stroke();
  });

  // ACHTUNG nach Grösse zeichnen, nicht in Zeitleisten-Reihenfolge: bei
  // engem SPINE_PUNKT_ABSTAND deckt ein später gezeichneter kleinerer Kreis
  // sonst einen grösseren Nachbarn an.
  let kreisDaten = [];
  eintraege.forEach((e, i) => {
    if (e.typ === 'rueckkehr') return;
    let alphaSkala = constrain(position - (i - 1), 0, 1);
    if (alphaSkala <= 0) return;
    let x = startX + i * abstand;
    // Ein Scan für beides: Kreisflächen und F-Wert-Punkte.
    let filter = wohnungFilterFuerOrt(e.ortBasis);
    let treffer = sammleAnnotationenNachOrtBasis(filter, globalAnnIndex, daten);
    let bc = zaehleBandCounts(treffer);
    let fwertAnnotationen = treffer.filter(a => a.hasFwert);
    kreisDaten.push({ i, x, bc, fwertAnnotationen, radius: 0 });
  });

  // Grösse vorab bestimmen und sortieren. groessterKreisRadius ist dieselbe
  // Funktion, die zeichneKreiseFuerRun intern nutzt.
  kreisDaten.forEach(k => { k.radius = groessterKreisRadius(k.bc); });
  kreisDaten.sort((a, b) => b.radius - a.radius);

  let radiusNachIndex = new Map();
  kreisDaten.forEach(k => {
    // winkel PI: Halbkreise oben/unten statt links/rechts, positiv oben.
    // F-Wert-Punkte bekommen denselben Winkel.
    zeichneKreiseFuerRun(k.x, linieY, k.bc, 1, PI);
    merkeKreis(k.x, linieY, k.bc, k.radius,
      zeichneFwertPunkte(k.x, linieY, k.radius, k.fwertAnnotationen, 1));
    radiusNachIndex.set(k.i, k.radius);
  });

  textFont(SCHRIFT_SANS);
  textStyle(BOLD);
  textSize(13);
  textAlign(CENTER, TOP);

  // Durchgang 1: Ortspunkte und Zuführungslinien — nach allen Kreisen, damit
  // sie nie unter einem Nachbarkreis verschwinden.
  eintraege.forEach((e, i) => {
    let alphaSkala = constrain(position - (i - 1), 0, 1);
    if (alphaSkala <= 0) return;
    let x = startX + i * abstand;
    let radius = radiusNachIndex.get(i) || 0;

    // Ortspunkt als Canvas-Pfad, siehe ACHTUNG unten bei fillText.
    drawingContext.fillStyle = `rgba(0, 0, 0, ${alphaSkala})`;
    drawingContext.beginPath();
    drawingContext.arc(x, linieY, 2.5, 0, TWO_PI);
    drawingContext.fill();

    // Zuführungslinie vom Kreisrand hinunter zur festen Label-Zeile.
    stroke(0, 110 * alphaSkala);
    strokeWeight(1);
    line(x, linieY + (radius > 0 ? radius : 4), x, linieY + layout.versatz[i]);
    noStroke();
  });

  // Durchgang 2: Beschriftungen — nach allen Linien, damit keine Linie ein
  // fremdes Label durchschneidet. Jedes Label stellt sich dafür frei.
  eintraege.forEach((e, i) => {
    let alphaSkala = constrain(position - (i - 1), 0, 1);
    if (alphaSkala <= 0) return;
    let x = startX + i * abstand;
    let textY = linieY + layout.versatz[i] + SPINE_LABEL_TEXT_ABSTAND;
    let breite = layout.breiten[i];

    drawingContext.fillStyle = `rgba(226, 230, 225, ${alphaSkala})`;
    drawingContext.fillRect(x - breite / 2 - 3, textY - 2, breite + 6, SPINE_LABEL_HOEHE - 2);

    // ACHTUNG p5s text()/arc()/ellipse() bleiben bei laufender Animation
    // manchmal unsichtbar, obwohl der Context korrekt gesetzt ist. Deshalb
    // wird hier und an drei Stellen oben direkt über drawingContext
    // gezeichnet. Ursache ungeklärt, nur umgangen.
    drawingContext.fillStyle = `rgba(26, 26, 26, ${alphaSkala})`;
    drawingContext.fillText(e.text, x, textY);
  });

  textStyle(NORMAL);
}


// --- Export ------------------------------------------------------------
// Acht Funktionen als Wert.
window.setzeKapitelAnsichtModus = setzeKapitelAnsichtModus;
window.setzeGrafikZurueck = setzeGrafikZurueck;
window.toggleGrafikPlay = toggleGrafikPlay;
window.aktualisiereGrafikFortschritt = aktualisiereGrafikFortschritt;
window.aktuelleGrafikAnimationDauer = aktuelleGrafikAnimationDauer;
window.stelleSpineDatenBereit = stelleSpineDatenBereit;
window.spineEintraegeFuer = spineEintraegeFuer;
window.zeichneSpineHorizontal = zeichneSpineHorizontal;

// Lesebindung statt Wertkopie: sonst sieht draw() dauerhaft false/0/null.
['grafikSpielt', 'grafikFortschritt', 'grafikPlayAusblendStart'].forEach(function (name) {
  Object.defineProperty(window, name, {
    get: function () {
      return name === 'grafikSpielt' ? grafikSpielt
           : name === 'grafikFortschritt' ? grafikFortschritt
           : grafikPlayAusblendStart;
    },
    configurable: true,
  });
});

// Die beiden Caches gehen nicht hinaus, gelesen wird über
// spineEintraegeFuer() — sonst bliebe die Objektreferenz beschreibbar.

})(); // Ende der Modulkapselung, siehe Kommentar oben
