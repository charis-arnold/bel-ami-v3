/* =============================================================================
   kreisgrafik.js — Die Kreisdiagramme der Orte

   Je Ort ein Kreis: Grösse zählt die Erwähnungen, Form zeigt die Valenz.
   Unten schraffierte Gesamtkreise je Kategorie, darüber die Valenzflächen
   (Halbkreis neg/pos, Vollkreis neutral), aussen herum ein F-Wert-Punkt je
   Annotation. Winkel-Konvention und Abhängigkeiten: docs/architektur.md.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 8 von 13 Namen intern, 5 exportiert. Konvention: docs/architektur.md.
// ACHTUNG Ladezeit: hexZuRgb() läuft schon in der IIFE — diese Datei muss
// nach datenbereinigung.js stehen, sonst ReferenceError.
(function () {

// ACHTUNG p5s text()/arc()/ellipse() bleiben bei laufender Animation
// manchmal unsichtbar — deshalb wird hier direkt in drawingContext
// gezeichnet. Das lässt p5s Farb-Zwischenspeicher veralten; nur pop()
// gleicht ihn wieder ab, ctx.restore() nicht. Jede Zeichenfunktion klammert.

// EIN/AUS für alle neutralen Teile: F-Wert-Punkte und Vollkreise. Rein
// visuell — Daten, Zählungen und Kreisgrösse bleiben unberührt.
const ZEIGE_NEUTRALE_WERTE = true;

// Neutral meint die dritte F-Wert-Gruppe als Ganzes: valenz 0 und unbewertet.
// Über !== 1 && !== -1, damit auch ein unerwarteter Wert neutral zählt.
function istNeutraleValenz(valenz) {
  return valenz !== 1 && valenz !== -1;
}

// Liefert eine gefilterte Kopie; die Liste des Aufrufers bleibt vollständig.
function sichtbareFwertAnnotationen(annotationen) {
  if (ZEIGE_NEUTRALE_WERTE) return annotationen;
  return annotationen.filter(a => !istNeutraleValenz(a.valenz));
}

// Zeilenabstand der Schraffur in den Gesamtkreisen.
const HATCH_SPACING = 3;

// ---------------------------------------------------------------------------
// Kreise
// ---------------------------------------------------------------------------

function drawHatchedCircle(cx, cy, r, color, alphaSkala = 1) {
  if (r <= 0) return;
  push(); // schreibt strokeStyle direkt, siehe ACHTUNG oben
  const ctx = drawingContext;
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
  pop();
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

function leereBandCounts() {
  return {
    gold_dunkel: { neg: 0, pos: 0, neutral: 0, unrated: 0 },
    gold_mittel: { neg: 0, pos: 0, neutral: 0, unrated: 0 },
    gold_hell: { neg: 0, pos: 0, neutral: 0, unrated: 0 },
  };
}

function zeichneKreiseOrtRuns(punktIndex, annIndex, activeBbox, offsetX = mapOffsetX, offsetY = mapOffsetY, daten = stationenData) {
  let runs = daten.ortRuns || [];
  let labelKandidaten = [];

  runs.forEach(r => {
    // Wer einen Kreis bekommt, entscheidet datenbereinigung.js — vier
    // Ausschlussgründe, alle Aussagen über die Daten.
    if (!ortRunSichtbar(r, punktIndex, annIndex, daten)) return;
    let pos = lonLatToScreen(r.lon, r.lat, activeBbox, offsetX, offsetY);
    let filter = wohnungFilterFuerOrt(r.ort);
    // EIN Durchlauf für beides: bandCounts und dieselbe Trefferliste für
    // die F-Wert-Punkte unten.
    let treffer = sammleAnnotationenNachOrtBasis(filter, annIndex, daten);
    let bandCounts = zaehleBandCounts(treffer);
    // winkel PI und 'obenUnten' wie in der Graph-Ansicht.
    let radius = groessterKreisRadius(bandCounts);
    zeichneKreiseFuerRun(pos.x, pos.y, bandCounts, 1, PI);
    let fwertAnnotationen = treffer.filter(a => a.hasFwert);
    zeichneFwertPunkte(pos.x, pos.y, radius, fwertAnnotationen, 1, 'obenUnten');
    if (radius > 0) {
      // Erst sammeln, Kollisionen nach der Schleife (zeichneKreisLabels).
      // Der Routen-Startpunkt blendet erst mit dem Kapitel-1-Ausschnitt ein.
      let istRoutenStart = daten === stationenData && r.ort === WOHNUNG_SAMMELPUNKT_ANKER;
      labelKandidaten.push({
        ankerX: pos.x, ankerY: pos.y,
        x: pos.x, y: pos.y + 15,
        text: r.ort.toUpperCase(), // .annotation-tag ist text-transform: uppercase
        farbe: null,
        alpha: istRoutenStart ? kapitel1ZoomAmount : 1,
      });
    }
  });

  zeichneKreisLabels(labelKandidaten);
}

// Platziert die Labels von oben nach unten und rutscht bei Überlappung
// nach unten. Ab spürbarem Versatz zieht eine gestrichelte Linie zum Kreis.
function zeichneKreisLabels(kandidaten) {
  // Alpha 0 fällt ganz raus: kein Platz im Layout, keine Hilfslinie.
  kandidaten = kandidaten.filter(k => (k.alpha === undefined ? 1 : k.alpha) > 0.002);
  if (kandidaten.length === 0) return;

  push(); // sechs Zeichenzustände plus direkte fillStyle-Schreibzugriffe
  noStroke();
  fill(33, 43, 46, 255); // #212B2E, wie die Kapitelnummern
  textFont(SCHRIFT_SANS); // wie .annotation-tag (var(--sans)) und die Spine-Labels
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
      // Direkt statt fill(): die Farbe wechselt je Label (alpha).
      drawingContext.fillStyle = k.farbe
        ? k.farbe
        : `rgba(33, 43, 46, ${alpha})`;
      // Siehe ACHTUNG oben.
      drawingContext.fillText(k.text, k.x, y);
    });

  pop();
}

// winkelMitte = Bildschirmwinkel der Wölbungsmitte (0 = rechts, im
// Uhrzeigersinn). blend=true (Multiply) für gold_hell/gold_dunkel.
function zeichneHalbkreis(cx, cy, r, winkelMitte, farbeRgb, alphaSkala = 1, blend = false) {
  if (r <= 0) return;
  push();
  let ctx = drawingContext;
  if (blend) ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${farbeRgb[0]}, ${farbeRgb[1]}, ${farbeRgb[2]}, ${0.75 * alphaSkala})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, winkelMitte - HALF_PI, winkelMitte + HALF_PI);
  ctx.closePath();
  ctx.fill();
  pop();
}

// Neutral hat keine Seite, deshalb ganze Fläche statt Halbkreis.
function zeichneVollkreis(cx, cy, r, farbeRgb, alphaSkala = 1, blend = false) {
  if (r <= 0) return;
  push();
  let ctx = drawingContext;
  if (blend) ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${farbeRgb[0]}, ${farbeRgb[1]}, ${farbeRgb[2]}, ${0.75 * alphaSkala})`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TWO_PI);
  ctx.fill();
  pop();
}

// winkel: feste Basis der Valenz-Teilung (PI für Karte/Graph, Default
// -HALF_PI für die Ortsveränderung). radiusSkala/maxRadius nur dort genutzt.

// ACHTUNG kein Rückgabewert. Radius holt groessterKreisRadius() — dessen
// letzte zwei Parameter stehen UMGEKEHRT zu denen hier.
function zeichneKreiseFuerRun(cx, cy, bandCounts, alphaSkala = 1, winkel = -HALF_PI, radiusSkala = 1, maxRadius = 100) {
  // Schraffur immer unten, Valenzflächen darüber; innerhalb jeder Ebene
  // grösste zuunterst. Sonst deckt eine Schraffur fremde Flächen zu.
  push(); // schreibt unten direkt in fillStyle (Mittelpunkt)
  let hatchFormen = [];
  let flaechenFormen = [];
  // Dieselbe Funktion, die auch die Aufrufer vor dem Zeichnen benutzen.
  let aussenRadius = groessterKreisRadius(bandCounts, maxRadius, radiusSkala);

  KREIS_KATEGORIEN.forEach(k => {
    let bc = bandCounts[k.key] || {};
    let n = (bc.neg || 0) + (bc.pos || 0) + (bc.neutral || 0) + (bc.unrated || 0);
    let hatchR = kreisRadius(n, maxRadius) * radiusSkala;
    if (hatchR > 0) {
      let hex = '#' + k.farbe.map(v => v.toString(16).padStart(2, '0')).join('');
      hatchFormen.push({ r: hatchR, zeichne: () => drawHatchedCircle(cx, cy, hatchR, hex, alphaSkala) });
    }

    // gold_mittel als deckende Basis, die beiden anderen im Multiply.
    let blend = k.key !== 'gold_mittel';
    let negR = kreisRadius(bc.neg || 0, maxRadius) * radiusSkala;
    let posR = kreisRadius(bc.pos || 0, maxRadius) * radiusSkala;
    let neutralR = kreisRadius(bc.neutral || 0, maxRadius) * radiusSkala;
    if (negR > 0) flaechenFormen.push({ r: negR, zeichne: () => zeichneHalbkreis(cx, cy, negR, winkel - HALF_PI, k.farbe, alphaSkala, blend) });
    if (posR > 0) flaechenFormen.push({ r: posR, zeichne: () => zeichneHalbkreis(cx, cy, posR, winkel + HALF_PI, k.farbe, alphaSkala, blend) });
    if (ZEIGE_NEUTRALE_WERTE && neutralR > 0) flaechenFormen.push({ r: neutralR, zeichne: () => zeichneVollkreis(cx, cy, neutralR, k.farbe, alphaSkala, blend) });
  });

  hatchFormen.sort((a, b) => b.r - a.r).forEach(f => f.zeichne());
  flaechenFormen.sort((a, b) => b.r - a.r).forEach(f => f.zeichne());

  if (aussenRadius > 0) {
    // Mittelpunkt. Canvas-Pfad, siehe ACHTUNG oben.
    drawingContext.fillStyle = `rgba(0, 0, 0, ${alphaSkala})`;
    drawingContext.beginPath();
    drawingContext.arc(cx, cy, 4, 0, TWO_PI);
    drawingContext.fill();
  }
  pop();
}

// Pixel-Durchmesser je Punktgrösse (FWERT_PUNKTGROESSE), plus Ringabstände.
const FWERT_PUNKT_DURCHMESSER = { 1: 5, 2: 7.5, 3: 10 };
const FWERT_PUNKT_FARBE_RGB = hexZuRgb(FWERT_PUNKT_FARBE);
const FWERT_PUNKT_RAND_ABSTAND = 6; // Luft zwischen Kreisrand und erstem Punkte-Ring
const FWERT_PUNKT_RING_ABSTAND = 8; // Abstand zwischen zwei Punkte-Ringen, falls ein Drittel nicht in einen Ring passt

// Ein Punkt je Annotation mit F-Wert, Grösse nach Typ, Lage im 120°-Drittel
// der eigenen Valenz. Bei Andrang wachsen weitere Ringe nach aussen.
function zeichneFwertPunkte(cx, cy, radius, fwertAnnotationen, alphaSkala = 1, anordnung = 'seitlich') {
  // Schalter am gemeinsamen Eingang aller drei Aufrufer, nicht in den Aufrufern.
  fwertAnnotationen = sichtbareFwertAnnotationen(fwertAnnotationen);
  if (!fwertAnnotationen.length || radius <= 0) return;

  push(); // noStroke() plus direkte fillStyle-Schreibzugriffe
  const DRITTEL = TWO_PI / 3;
  // Gruppenmitten [neg, pos, neutral], passend zur Halbkreis-Teilung.
  // 'obenUnten' fest notiert: 180° lassen sich nicht in 120°-Drittel drehen.
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
    let ringRadius = radius + FWERT_PUNKT_RAND_ABSTAND;
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

      // Schmaler als das Drittel, sonst ragen Punkte ins Nachbar-Drittel.
      let spanne = DRITTEL * 0.8;
      let n = ringFormen.length;
      ringFormen.forEach((f, i) => {
        let winkelPunkt = n === 1 ? mitte : mitte - spanne / 2 + (i / (n - 1)) * spanne;
        let x = cx + Math.cos(winkelPunkt) * ringRadius;
        let y = cy + Math.sin(winkelPunkt) * ringRadius;
        // Canvas-Pfad, siehe ACHTUNG oben.
        drawingContext.fillStyle = `rgba(${f.rgb.r}, ${f.rgb.g}, ${f.rgb.b}, ${alphaSkala})`;
        drawingContext.beginPath();
        drawingContext.arc(x, y, f.d / 2, 0, TWO_PI);
        drawingContext.fill();
      });

      ringRadius += FWERT_PUNKT_RING_ABSTAND;
    }
  });
  pop();
}


// --- Export ------------------------------------------------------------
// Fünf Namen. Leser: docs/architektur.md.
window.FWERT_PUNKT_DURCHMESSER = FWERT_PUNKT_DURCHMESSER;
window.leereBandCounts = leereBandCounts;
window.zeichneKreiseOrtRuns = zeichneKreiseOrtRuns;
window.zeichneKreiseFuerRun = zeichneKreiseFuerRun;
window.zeichneFwertPunkte = zeichneFwertPunkte;

})(); // Ende der Modulkapselung, siehe Kommentar oben
