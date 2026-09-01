/* =============================================================================
   annotationsbox.js — Positionswahl der Annotationsbox

   Die Box weicht der Karte aus statt umgekehrt: annotationBoxPosition()
   bewertet oben links und unten links nach Strafpunkten (verdeckte Kreise
   nach Radius, Route schwächer) und liefert die günstigere. Entschieden je
   Kapitel und Fenstergrösse, gecacht, damit die Box beim Scrollen nicht
   springt. ANNOTATION_BOX_FEST übergeht die Rechnung für zwei Kapitel.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 6 von 8 Namen intern, 2 exportiert. Konvention: docs/architektur.md.
(function () {

// Die Box steht immer links, oben oder unten — dort ist Platz, und der Blick
// findet sie an einer festen Kante wieder. Oben bleibt sie, bis dort Kreise
// oder Route daruntergeraten.

// ACHTUNG die Reihenfolge ist die der Bevorzugung: bei Gleichstand gewinnt
// der frühere Eintrag, siehe die Schwelle in der Schleife unten.
const ANNOTATION_BOX_POSITIONEN = ['oben-links', 'unten-links'];
const ANNOTATION_BOX_BREITE = 572;   // max-width 520px + 2x26px Innenabstand, siehe .annotation-text
const ANNOTATION_BOX_RAND_X = 0.05;  // left/right 5%, siehe .annotation-box
const ANNOTATION_BOX_RAND_OBEN = 0.10;
const ANNOTATION_BOX_RAND_UNTEN = 0.12;
const annotationBoxPositionCache = new Map(); // "kapitel|breite|hoehe" -> Position

// Handkorrektur je Kapitel: wo die Strafpunktrechnung eine Lage wählt, die im
// Bild nicht überzeugt, steht sie hier fest. Werte aus ANNOTATION_BOX_POSITIONEN
// — ein anderer Text setzt gar keine Klasse, siehe draw() in sketch.js.

// Nur noch diese zwei: seit die Box auf die beiden linken Lagen beschränkt
// ist, trifft die Rechnung die übrigen von selbst. Kapitel 4 wählt sie auf
// jedem Fenster anders als gewünscht, Kapitel 9 kippt mit der Fenstergrösse.
const ANNOTATION_BOX_FEST = {
  '04': 'oben-links',
  '09': 'oben-links',
};

function annotationBoxPosition(kapitelNr, daten, bbox) {
  if (ANNOTATION_BOX_FEST[kapitelNr]) return ANNOTATION_BOX_FEST[kapitelNr];

  let schluessel = `${kapitelNr}|${Math.round(width)}|${Math.round(height)}`;
  if (annotationBoxPositionCache.has(schluessel)) return annotationBoxPositionCache.get(schluessel);

  // Höhe aus dem längsten Annotationstext: ausweichen muss sie im Maximum.
  let stil = getComputedStyle(annotationText);
  let zeilenHoehe = parseFloat(stil.fontSize) * 1.35;
  drawingContext.save();
  drawingContext.font = `${stil.fontSize} ${stil.fontFamily}`;
  let maxZeilen = 1;
  (daten.annotationen || []).forEach(a => {
    let breite = drawingContext.measureText('«' + (a.text || '') + '»').width;
    maxZeilen = Math.max(maxZeilen, Math.ceil(breite / 520));
  });
  drawingContext.restore();
  let boxHoehe = 25 + (maxZeilen + 1) * zeilenHoehe + 24; // +1 Zeile Reserve für den Umbruch

  // Kreise im Endstand und die Route — gebraucht wird nur Lage und Grösse.
  let letzterIndex = daten.annotationen.length - 1;
  let kreise = [];
  (daten.ortRuns || []).forEach(r => {
    let bc = zaehleAnnotationenLiveNachOrtBasis(wohnungFilterFuerOrt(r.ort), letzterIndex, daten);
    let radius = groessterKreisRadius(bc);
    if (radius <= 0) return;
    let p = lonLatToScreen(r.lon, r.lat, bbox, mapOffsetX, mapOffsetY);
    kreise.push({ x: p.x, y: p.y, r: radius });
  });
  let routenPunkte = (daten.routenPfadDetail || daten.routenPunkte || []).map(
    p => lonLatToScreen(p[0], p[1], bbox, mapOffsetX, mapOffsetY));

  let bester = ANNOTATION_BOX_POSITIONEN[0];
  let besteStrafe = Infinity;
  ANNOTATION_BOX_POSITIONEN.forEach(position => {
    let links = position.endsWith('links');
    let x0 = links ? ANNOTATION_BOX_RAND_X * width : width * (1 - ANNOTATION_BOX_RAND_X) - ANNOTATION_BOX_BREITE;
    let y0 = position.startsWith('oben') ? ANNOTATION_BOX_RAND_OBEN * height
      : height * (1 - ANNOTATION_BOX_RAND_UNTEN) - boxHoehe;
    let x1 = x0 + ANNOTATION_BOX_BREITE, y1 = y0 + boxHoehe;

    // Ein zugedeckter Kreis wiegt nach Radius: gross zu verdecken ist schlimmer.
    let strafe = 0;
    kreise.forEach(k => {
      let dx = Math.max(x0 - k.x, 0, k.x - x1);
      let dy = Math.max(y0 - k.y, 0, k.y - y1);
      if (dx * dx + dy * dy < k.r * k.r) strafe += k.r;
    });
    // Die Route zählt schwächer — sie gibt nur bei Gleichstand den Ausschlag.
    if (routenPunkte.length) {
      let drin = routenPunkte.filter(p => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1).length;
      strafe += (drin / routenPunkte.length) * 80;
    }
    if (strafe < besteStrafe - 0.001) { besteStrafe = strafe; bester = position; }
  });

  annotationBoxPositionCache.set(schluessel, bester);
  return bester;
}


// --- Export ------------------------------------------------------------
// Zwei Namen. Leser: docs/architektur.md.
window.ANNOTATION_BOX_POSITIONEN = ANNOTATION_BOX_POSITIONEN;
window.annotationBoxPosition = annotationBoxPosition;

})(); // Ende der Modulkapselung, siehe Kommentar oben
