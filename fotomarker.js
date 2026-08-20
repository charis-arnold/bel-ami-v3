/* =============================================================================
   fotomarker.js — Foto-Marker (Fotobank Huma-Num/FNP) und Bild-Popup

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Eine
   eigenständige, additive Ebene über der Karte: an jeder Fotokoordinate ein
   Sternchen, das bei Hover den Titel zeigt und beim Klick ein Popup mit dem
   Bild öffnet. Die Ebene hängt an keinem Erzählzustand — sie bekommt die
   sichtbare Bbox und den Kartenoffset als Parameter und zeichnet sich in
   jeder Kartenansicht gleich.

   --- Abhängigkeiten NACH AUSSEN (alle erst zur Laufzeit) -------------------
   aus sketch.js:           lonLatToScreen, mapOffsetX/mapOffsetY (als
                            Default-Parameter von zeichneFotoMarker, erst beim
                            Aufruf ausgewertet), letzterFotoOffsetX/Y
   aus datenbereinigung.js: FWERT_COLOR_RGB
   aus p5:                  Zeichen- und Text-API, drawingContext, mouseX/mouseY

   --- Wer von aussen hierher greift ----------------------------------------
   preload()                 lädt fotomarker.json nach fotoMarkerListe
   bereinigeEingangsdaten()  ersetzt sie durch bereinigeFotoMarker(...)
   setup()                   befüllt die fünf fotoPopup*-Handles und hängt drei
                             Listener auf schliesseFotoPopup (Schliessen-Knopf,
                             Klick auf den Hintergrund, Escape)
   draw()                    schreibt letzteActiveBbox und ruft zeichneFotoMarker()
   mousePressed()            prüft die Marker auf Treffer und ruft oeffneFotoPopup()
   zeichneUebersichtsrouten() nutzt FOTO_MARKER_TREFFER_RADIUS für den
                             Hover-Test der Kapitel-Badges — dieselbe Distanz,
                             damit sich alle Klickziele der Karte gleich anfühlen

   NICHT hier: letzterFotoOffsetX / letzterFotoOffsetY. Sie gehören inhaltlich
   dazu, ihre Deklaration initialisiert sich aber aus mapOffsetX/mapOffsetY —
   also BEIM LADEN. In einer Datei, die vor sketch.js geladen wird, läge das
   vor deren Deklaration und wirft ReferenceError. Sie stehen deshalb weiter
   in sketch.js, direkt bei mapOffsetX/mapOffsetY.

   Der Foto-Teil von mousePressed() ist ebenfalls in sketch.js geblieben:
   mousePressed ist eine p5-Lifecycle-Funktion und behandelt zuerst die
   Kapitel-Badges, dann die Foto-Marker. Sie aufzuteilen hiesse, den
   Kontrollfluss umzubauen — eine Logikänderung, die diese Schritte vermeiden.

   Wird in index.html VOR sketch.js geladen. Kein Top-Level-Initialisierer
   dieser Datei ruft eine Funktion auf oder liest eine fremde Variable.
============================================================================= */

// DOM-Referenzen des Popups — in setup() aus dem Dokument geholt.
let fotoPopup, fotoPopupTitel, fotoPopupPlz, fotoPopupBild, fotoPopupBeschreibung;

// --- Foto-Marker (separate, additive Ebene — Fotobank Huma-Num/FNP) ---
let fotoMarkerListe = [];
let letzteActiveBbox = null;
// Trefferradius fürs Anklicken — auch von zeichneUebersichtsrouten (sketch.js)
// für die Kapitel-Badges genutzt, damit alle Klickziele der Karte dieselbe
// Grosszügigkeit haben.
const FOTO_MARKER_TREFFER_RADIUS = 12;

// ---------------------------------------------------------------------------
// Foto-Marker (Fotobank Huma-Num/FNP) — eigenständige, additive Ebene
// ---------------------------------------------------------------------------

function zeichneFotoMarker(activeBbox, offsetX = mapOffsetX, offsetY = mapOffsetY, alphaMultiplier = 1, kartenZoomFaktor = 0) {
  if (alphaMultiplier <= 0) return; // z.B. Kreisvergleich-Akt — keine Karte mehr, also auch keine Foto-Marker
  // Grösse skaliert mit dem Zoom: 11 (wie die Kapitelnummern) nur ganz
  // draussen in der Übersicht — dieselbe Fläche wirkt in einem eingezoomten
  // Kartenausschnitt (viel kleinerer geografischer Ausschnitt auf derselben
  // Canvas-Grösse, alles andere also visuell grösser) winzig. kartenZoomFaktor
  // (0 = Übersicht, 1 = voll in Kapitel-1- oder Kapitel-Kartenausschnitt
  // gezoomt, siehe Aufrufer) skaliert linear bis zur alten festen Grösse
  // (20/24, vor der "wie Kapitelnummern"-Angleichung) hoch.
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
    drawingContext.fillText('*', pos.x, pos.y - 3); // leichte optische Korrektur nach oben (Sternchen-Glyphe); p5s text() bleibt bei laufender Animation manchmal unsichtbar, siehe zeichneSpineHorizontal

    if (hover) {
      textFont("'Source Sans 3', sans-serif"); // wie .annotation-tag (var(--sans)) und die Kreis-Labels/Kapitelnummern
      textStyle(BOLD); // .annotation-tag ist font-weight: 700
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
