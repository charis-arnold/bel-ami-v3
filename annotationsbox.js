/* =============================================================================
   annotationsbox.js — Positionswahl der Annotationsbox

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Ein reines
   Layout-Problem: Die Annotationsbox stand fest oben links und deckte dort je
   nach Kapitel bis zu sechs Ortskreise zu. Statt der Karte weicht jetzt die
   Box aus — annotationBoxPosition() bewertet vier mögliche Positionen nach
   Strafpunkten (verdeckte Kreise zählen nach Radius, die Route schwächer) und
   liefert den günstigsten zurück. Entschieden wird je Kapitel UND
   Fenstergrösse, das Ergebnis landet im Cache, damit die Box beim Scrollen
   nicht springt.

   Gezeichnet wird hier nichts — die Funktion liefert nur einen der vier
   Positionsnamen aus ANNOTATION_BOX_POSITIONEN; draw() setzt daraus die
   CSS-Klasse (pos-oben-links etc.) am #annotationBox-Element.

   --- Abhängigkeiten NACH AUSSEN (alle erst zur Laufzeit) -------------------
   aus sketch.js:           annotationText (für getComputedStyle — die Boxhöhe
                            wird aus der echten Schriftgrösse geschätzt),
                            lonLatToScreen, mapOffsetX/mapOffsetY
   aus datenbereinigung.js: groessterKreisRadius, wohnungFilterFuerOrt,
                            zaehleAnnotationenLiveNachOrtBasis
   aus p5:                  width/height, drawingContext (nur zum Textmessen)

   Keine Abhängigkeit auf kartendekor.js, ortsveraenderung.js,
   spine-horizontal.js oder fotomarker.js — und umgekehrt greift keines dieser
   Module hierher.

   --- Wer von aussen hierher greift ----------------------------------------
   draw()  ruft annotationBoxPosition() und schaltet die Klassen anhand von
           ANNOTATION_BOX_POSITIONEN

   Wird in index.html VOR sketch.js geladen. Einziger Top-Level-Initialisierer
   ist new Map() für den Cache — kein Zugriff auf fremde Variablen beim Laden.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 5 von 7 Namen intern, 2 im Exportblock am Dateiende.
// Konvention: docs/architektur.md. Lädt eigenständig.
(function () {

// ---------------------------------------------------------------------------
// Position der Annotationsbox. Sie stand fest oben links und deckte dort je
// nach Kapitel bis zu sechs Ortskreise zu. Statt die Kartenausschnitte dagegen
// zu verschieben (was nur bedingt geht — nach rechts stossen viele Kapitel an
// den rechten Rand, und ein vertikales Verschieben wirkt gar nicht: die Karten
// sind mit Seitenverhältnis 2.45 breiter als jedes übliche Browserfenster und
// werden deshalb seitlich beschnitten, nicht oben/unten) weicht jetzt die Box
// aus.
//
// Vier Positionen in der Reihenfolge der Bevorzugung: die Box bleibt oben
// links, solange dort nichts Wichtiges liegt, und rückt erst weiter, wenn
// Kreise oder Route darunter geraten. Entschieden wird je Kapitel UND
// Fenstergrösse (der seitliche Beschnitt hängt am Fensterformat, die Kreise
// liegen also nicht auf jedem Bildschirm gleich) und dann zwischengespeichert,
// damit die Box beim Scrollen nicht springt.
// ---------------------------------------------------------------------------
const ANNOTATION_BOX_POSITIONEN = ['oben-links', 'unten-links', 'oben-rechts', 'unten-rechts'];
const ANNOTATION_BOX_BREITE = 572;   // max-width 520px + 2x26px Innenabstand, siehe .annotation-text
const ANNOTATION_BOX_RAND_X = 0.05;  // left/right 5%, siehe .annotation-box
const ANNOTATION_BOX_RAND_OBEN = 0.10;
const ANNOTATION_BOX_RAND_UNTEN = 0.12;
const annotationBoxPositionCache = new Map(); // "kapitel|breite|hoehe" -> Position

function annotationBoxPosition(kapitelNr, daten, bbox) {
  let schluessel = `${kapitelNr}|${Math.round(width)}|${Math.round(height)}`;
  if (annotationBoxPositionCache.has(schluessel)) return annotationBoxPositionCache.get(schluessel);

  // Boxhöhe aus dem LÄNGSTEN Annotationstext dieses Kapitels — die Box wächst
  // mit dem Text, und ausweichen muss sie für ihren grössten Zustand.
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

  // Kreise im Endstand und die Route. groessterKreisRadius liefert denselben
  // Aussenradius, den zeichneKreiseFuerRun zeichnen würde — hier aber ohne zu
  // zeichnen, denn gebraucht wird nur, wo die Kreise liegen und wie gross sie
  // sind.
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

    // Ein zugedeckter Kreis wiegt nach seinem Radius — ein grosser Kreis
    // (viele Annotationen) zu verdecken ist schlimmer als ein kleiner.
    let strafe = 0;
    kreise.forEach(k => {
      let dx = Math.max(x0 - k.x, 0, k.x - x1);
      let dy = Math.max(y0 - k.y, 0, k.y - y1);
      if (dx * dx + dy * dy < k.r * k.r) strafe += k.r;
    });
    // Die Route zählt schwächer mit: eine Linie unter der Box stört weniger
    // als ein verdeckter Kreis, soll aber den Ausschlag geben, wenn zwei
    // Positionen sonst gleichauf liegen.
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
// Zwei Namen, beide nur von sketch.js: draw() ruft annotationBoxPosition()
// und schaltet die CSS-Klassen anhand von ANNOTATION_BOX_POSITIONEN.
window.ANNOTATION_BOX_POSITIONEN = ANNOTATION_BOX_POSITIONEN;
window.annotationBoxPosition = annotationBoxPosition;

})(); // Ende der Modulkapselung, siehe Kommentar oben
