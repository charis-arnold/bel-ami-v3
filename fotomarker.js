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
function zeichneFotoMarker(activeBbox, offsetX = mapOffsetX, offsetY = mapOffsetY, hinweis = null) {
  // Aussen so gross wie der grösste F-Wert-Punkt, der Kern so gross wie der
  // kleinste. Abgeleitet statt fest, damit der Marker mitwandert, wenn sich
  // die Punktgrössen ändern. Wie jene skaliert er nicht mit dem Zoom.
  let punktGroessen = Object.values(FWERT_PUNKT_DURCHMESSER);
  let aussenRadius = Math.max(...punktGroessen) / 2;
  let kernRadius = Math.min(...punktGroessen) / 2;
  // Tooltip und Hinweis erst nach der Schleife, sonst überzeichnet sie ein
  // später gezeichneter Marker.
  let unterCursor = null;
  let hinweisLabel = null;

  push(); // schreibt fillStyle direkt, wie zeichneFwertPunkte in kreisgrafik.js
  noStroke();
  let scheibe = (x, y, r, rgb) => {
    drawingContext.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    drawingContext.beginPath();
    drawingContext.arc(x, y, r, 0, TWO_PI);
    drawingContext.fill();
  };
  fotoMarkerListe.forEach(f => {
    let pos = lonLatToScreen(f.lon, f.lat, activeBbox, offsetX, offsetY);
    let hover = dist(mouseX, mouseY, pos.x, pos.y) < FOTO_MARKER_TREFFER_RADIUS;
    // Farbe bleibt beim Hover gleich — ein Wechsel ins Orange brächte genau
    // die Verwechslung zurück, die FOTO_MARKER_FARBE vermeidet.
    let skala = hover ? 1.5 : 1;
    scheibe(pos.x, pos.y, aussenRadius * skala, FOTO_MARKER_FARBE_RGB);
    scheibe(pos.x, pos.y, kernRadius * skala, FOTO_MARKER_KERN_FARBE_RGB);

    if (hover) unterCursor = { titel: f.titel, pos };
    if (hinweis && f.titel === hinweis.titel) {
      // Auf die Seite mit mehr Platz, sonst läuft der Hinweis aus dem Bild.
      let links = pos.x > width / 2;
      hinweisLabel = {
        ankerX: pos.x, ankerY: pos.y,
        x: pos.x + (links ? -40 : 40), y: pos.y,
        text: hinweis.text, farbe: null,
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
