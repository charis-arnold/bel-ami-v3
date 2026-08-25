/* =============================================================================
   fotomarker.js — Foto-Marker (Fotobank Huma-Num/FNP) und Bild-Popup

   Additive Ebene über der Karte: an jeder Fotokoordinate ein Sternchen, das
   bei Hover den Titel zeigt und beim Klick ein Popup öffnet. Hängt an keinem
   Erzählzustand — Bbox und Kartenoffset kommen als Parameter.

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

function zeichneFotoMarker(activeBbox, offsetX = mapOffsetX, offsetY = mapOffsetY, alphaMultiplier = 1, kartenZoomFaktor = 0) {
  if (alphaMultiplier <= 0) return; // keine Karte, also auch keine Marker
  // Grösse skaliert mit dem Zoom: 11 wie die Kapitelnummern in der Übersicht,
  // 20 im Kartenausschnitt — sonst wirkt das Sternchen dort winzig.
  let sternGroesse = lerp(11, 20, constrain(kartenZoomFaktor, 0, 1));
  fotoMarkerListe.forEach(f => {
    let pos = lonLatToScreen(f.lon, f.lat, activeBbox, offsetX, offsetY);
    let hover = dist(mouseX, mouseY, pos.x, pos.y) < FOTO_MARKER_TREFFER_RADIUS;

    noStroke();
    fill(hover
      ? color(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b, 255 * alphaMultiplier) // #C2511C
      : color(33, 43, 46, 255 * alphaMultiplier)); // #212B2E
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(hover ? sternGroesse * 1.2 : sternGroesse);
    drawingContext.fillText('*', pos.x, pos.y - 3); // -3 korrigiert die Glyphe optisch nach oben

    if (hover) {
      textFont(SCHRIFT_SANS); // wie .annotation-tag
      textStyle(BOLD);
      textSize(11);
      let label = f.titel || 'Foto ansehen';
      let tw = textWidth(label) + 16;
      fill(0, 200 * alphaMultiplier);
      rect(pos.x + 10, pos.y - 12, tw, 20, 4);
      fill(255, 255 * alphaMultiplier);
      textAlign(LEFT, CENTER);
      drawingContext.fillText(label, pos.x + 18, pos.y - 2);
    }
  });
  textStyle(NORMAL);
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
