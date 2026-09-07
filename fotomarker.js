/* =============================================================================
   fotomarker.js — Foto-Marker (Fotobank Huma-Num/FNP) und Bild-Popup

   Additive Ebene über der Karte: an jeder Fotokoordinate ein Punkt mit hellem
   Kern, der bei Hover den Titel zeigt und beim Klick ein Popup öffnet. Hängt
   an keinem Erzählzustand — Bbox, Kartenoffset und der optionale Hinweis
   kommen als Parameter.

   ACHTUNG letzterFotoOffsetX/Y lesen mapOffsetX/Y BEIM LADEN — diese Datei
   muss nach geo-projektion.js stehen, sonst ReferenceError.
============================================================================= */

// DOM-Referenzen des Popups, in setup() geholt.
let fotoPopup, fotoPopupTitel, fotoPopupPlz, fotoPopupBild, fotoPopupBeschreibung;

let fotoMarkerListe = [];
// Zustand des zuletzt gezeichneten Frames, alle drei in draw() gesetzt.
let letzteActiveBbox = null;
let letzterFotoOffsetX = mapOffsetX, letzterFotoOffsetY = mapOffsetY;
// Auch von uebersichtsrouten.js genutzt, damit alle Klickziele gleich gross sind.
const FOTO_MARKER_TREFFER_RADIUS = 12;

// Merkt sich Bbox und Offset des Frames für den Treffertest in mousePressed().
// Eigene Funktion, weil draw() sie unbedingt ruft, zeichneFotoMarker() nicht.

// ACHTUNG in der Graph-Ansicht bleibt der Merker frisch, obwohl dort keine
// Marker gezeichnet werden: ein Klick auf die Stelle, wo einer auf der Karte
// läge, öffnet sein Popup. mousePressed() prüft nur letzteActiveBbox, nicht
// den Ansichtsmodus. Ungelöst, siehe docs/cleanup-log.md.
function merkeKartenlage(bbox, offsetX, offsetY) {
  letzteActiveBbox = bbox;
  letzterFotoOffsetX = offsetX;
  letzterFotoOffsetY = offsetY;
}

// hinweis (optional): { titel, text, alpha } — hängt ein beschriftetes Label
// mit Zuführungslinie an genau den Marker mit diesem Titel. Zeitpunkt und
// Deckkraft bestimmt der Aufrufer, siehe draw() in sketch.js.
// Blendensymbol: voller Kreis, darin ein sechseckiges Loch und sechs gerade
// Spalten. Die Spalten sind die VERLÄNGERTEN Sechseckseiten — genau daraus
// entsteht der Drall, den eine Objektivblende hat. Radial gezogene Spalten
// ergäben ein Wagenrad.
//
// ACHTUNG ab hier wird auf den Kreis geclippt. Die Spalten laufen über den
// Rand hinaus (sie müssen ihn sicher erreichen, auch in der flachsten Ecke);
// ohne Clip zeichneten sie helle Striche auf die Karte.
function zeichneBlende(x, y, r, ringRgb, kernRgb) {
  const ECKEN = 6;
  // Verhältnisse nach der Vorlage eingestellt: Loch enger, Spalten schlanker
  // als beim ersten Wurf (0.46/0.17), sonst wirkte das Zeichen bei 16 px wie
  // ein Zahnrad. Weiter hinunter geht es nicht — bei 0.12 fällt die Spaltweite
  // in der Ruhegrösse unter ein Pixel und die Klemme unten greift.
  let innen = r * 0.42;
  let spalt = Math.max(1, r * 0.14);
  let dreh = -Math.PI / 2; // eine Sechseckecke nach oben
  let vx = i => x + innen * Math.cos(dreh + i * TWO_PI / ECKEN);
  let vy = i => y + innen * Math.sin(dreh + i * TWO_PI / ECKEN);
  let ctx = drawingContext;

  ctx.fillStyle = `rgb(${ringRgb.r}, ${ringRgb.g}, ${ringRgb.b})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.clip();

  let kern = `rgb(${kernRgb.r}, ${kernRgb.g}, ${kernRgb.b})`;
  ctx.fillStyle = kern;
  ctx.beginPath();
  for (let i = 0; i < ECKEN; i++) {
    if (i === 0) ctx.moveTo(vx(i), vy(i));
    else ctx.lineTo(vx(i), vy(i));
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = kern;
  ctx.lineWidth = spalt;
  ctx.lineCap = 'butt';
  for (let i = 0; i < ECKEN; i++) {
    let j = (i + 1) % ECKEN;
    let dx = vx(j) - vx(i), dy = vy(j) - vy(i);
    let len = Math.hypot(dx, dy) || 1;
    ctx.beginPath();
    ctx.moveTo(vx(j), vy(j));
    ctx.lineTo(vx(j) + dx / len * r * 2, vy(j) + dy / len * r * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function zeichneFotoMarker(activeBbox, offsetX = mapOffsetX, offsetY = mapOffsetY, hinweis = null) {
  // Das Blendensymbol braucht mehr Durchmesser als der frühere Punkt: sechs
  // Segmente und ein Sechseck in 10 px sind Matsch. 16 px ist die Grenze, ab
  // der die Spalten noch als Spalten lesen.
  //
  // ACHTUNG damit hält sich der Marker NICHT mehr an die Reihe der
  // F-Wert-Punkte (grösster 10 px), an die er vorher gebunden war. Das war
  // vertretbar, solange beide Punkte waren und sich nur in der Farbe
  // unterschieden — jetzt trägt die FORM den Unterschied, und die braucht
  // ihren Platz. Wie zuvor skaliert er nicht mit dem Zoom.
  let aussenRadius = 8;
  // Tooltip und Hinweis erst nach der Schleife, sonst überzeichnet sie ein
  // später gezeichneter Marker.
  let unterCursor = null;
  let hinweisLabel = null;

  push(); // schreibt fillStyle direkt, wie zeichneFwertPunkte in kreisgrafik.js
  noStroke();
  fotoMarkerListe.forEach(f => {
    let pos = lonLatToScreen(f.lon, f.lat, activeBbox, offsetX, offsetY);
    let hover = dist(mouseX, mouseY, pos.x, pos.y) < FOTO_MARKER_TREFFER_RADIUS;
    // Farbe bleibt beim Hover gleich — ein Wechsel ins Orange brächte genau
    // die Verwechslung zurück, die FOTO_MARKER_FARBE vermeidet.
    let skala = hover ? 1.5 : 1;
    zeichneBlende(pos.x, pos.y, aussenRadius * skala,
      FOTO_MARKER_FARBE_RGB, FOTO_MARKER_KERN_FARBE_RGB);

    if (hover) unterCursor = { titel: f.titel, pos };
    if (hinweis && f.titel === hinweis.titel) {
      // Auf die Seite mit mehr Platz, sonst läuft der Hinweis aus dem Bild.
      let links = pos.x > width / 2;
      // Fläche in der Markerfarbe, Schrift hell darauf — dieselbe Paarung
      // wie der Hover-Tooltip weiter unten. Der Hinweis erklärt die Bedienung
      // und soll deshalb als Element lesen, nicht als Ortsbeschriftung.
      let f = FOTO_MARKER_FARBE_RGB;
      hinweisLabel = {
        ankerX: pos.x, ankerY: pos.y,
        x: pos.x + (links ? -40 : 40), y: pos.y,
        text: hinweis.text,
        flaeche: `rgba(${f.r}, ${f.g}, ${f.b}, ${0.9 * hinweis.alpha})`,
        farbe: `rgba(255, 255, 255, ${hinweis.alpha})`,
        hilfslinie: true, links, alpha: hinweis.alpha,
      };
    }
  });
  pop();

  // Dieselbe Beschriftungsroutine wie die Ortsnamen und die
  // Kreisgrafik-Erklärung: gestrichelte Zuführungslinie inklusive.
  if (hinweisLabel) zeichneKreisLabels([hinweisLabel]);

  if (unterCursor) {
    push();
    noStroke();
    textFont(SCHRIFT_SANS); // wie .annotation-tag
    textStyle(BOLD);
    textSize(11);
    let label = unterCursor.titel || 'Foto ansehen';
    let tw = textWidth(label) + 16;
    // Dieselbe Farbe wie der Marker selbst, damit Punkt und Infobox als ein
    // Element lesen.
    fill(FOTO_MARKER_FARBE_RGB.r, FOTO_MARKER_FARBE_RGB.g, FOTO_MARKER_FARBE_RGB.b, 200);
    rect(unterCursor.pos.x + 10, unterCursor.pos.y - 12, tw, 20, 4);
    fill(255, 255);
    textAlign(LEFT, CENTER);
    drawingContext.fillText(label, unterCursor.pos.x + 18, unterCursor.pos.y - 2);
    pop();
  }
}

function oeffneFotoPopup(f) {
  fotoPopupTitel.textContent = f.titel || '';
  fotoPopupPlz.textContent = f.plz || '';
  fotoPopupBild.src = f.fotoUrl;
  fotoPopupBild.alt = f.titel || '';
  fotoPopupBeschreibung.textContent = f.beschreibung || '';
  fotoPopup.classList.add('offen');
}

function schliesseFotoPopup() {
  fotoPopup.classList.remove('offen');
}
