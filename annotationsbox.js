/* =============================================================================
   annotationsbox.js — Positionswahl der Annotationsbox

   Die Box weicht der Karte aus statt umgekehrt: annotationBoxPosition()
   bewertet vier Positionen nach Strafpunkten (verdeckte Kreise nach Radius,
   Route schwächer) und liefert die günstigste. Entschieden je Kapitel und
   Fenstergrösse, gecacht, damit die Box beim Scrollen nicht springt.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 5 von 7 Namen intern, 2 exportiert. Konvention: docs/architektur.md.
(function () {

// Vier Positionen in der Reihenfolge der Bevorzugung: oben links bleibt, bis
// dort Kreise oder Route daruntergeraten.
const ANNOTATION_BOX_POSITIONEN = ['oben-links', 'unten-links', 'oben-rechts', 'unten-rechts'];
const ANNOTATION_BOX_BREITE = 572;   // max-width 520px + 2x26px Innenabstand, siehe .annotation-text
const ANNOTATION_BOX_RAND_X = 0.05;  // left/right 5%, siehe .annotation-box
const ANNOTATION_BOX_RAND_OBEN = 0.10;
const ANNOTATION_BOX_RAND_UNTEN = 0.12;
const annotationBoxPositionCache = new Map(); // "kapitel|breite|hoehe" -> Position

function annotationBoxPosition(kapitelNr, daten, bbox) {
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
