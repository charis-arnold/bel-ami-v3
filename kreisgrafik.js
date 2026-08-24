/* =============================================================================
   kreisgrafik.js — Die Kreisdiagramme der Orte

   Das Bildzeichen des Projekts: An jedem Ort steht ein Kreis, dessen Grösse
   zählt, wie oft er erwähnt wird, und dessen Form zeigt, wie er empfunden
   wird.

   Zwei Ebenen je Kreis, jede nach Radius sortiert (grösste zuunterst):
     unten  schraffierte Gesamtkreise je Kategorie (alle Erwähnungen,
            auch neutrale und unbewertete)
     oben   vollflächige Valenzformen — Halbkreis für negativ/positiv,
            ganzer Kreis für neutral
   Aussen herum die F-Wert-Punkte: je Annotation mit F-Wert ein eigener Punkt,
   gruppiert in 120°-Dritteln auf der Seite seiner Valenz, bei Bedarf in
   mehreren Ringen.

   Winkel-Konvention, NICHT an die Laufrichtung der Route gebunden: Karten-
   ("Plan") wie Graph-Ansicht teilen waagrecht, positiv oben, negativ unten —
   beide zeigen dieselben Kreise und sollen sich gleich lesen lassen. Nur der
   Schlussakt Ortsveränderung (ortsveraenderung.js) teilt senkrecht, negativ
   links, positiv rechts, weil dort unter jedem Kreis Beschriftung und
   Kapitelzeile stehen. Steuerung: winkel-Parameter von zeichneKreiseFuerRun(),
   anordnung von zeichneFwertPunkte().

   --- Abhängigkeiten NACH AUSSEN (Laufzeit) --------------------------------
   aus datenbereinigung.js (11): KREIS_KATEGORIEN, kreisRadius,
     groessterKreisRadius, FWERT_PUNKTGROESSE, FWERT_PUNKT_FARBE, hexZuRgb,
     sammleAnnotationenNachOrtBasis, zaehleBandCounts, wohnungFilterFuerOrt,
     ortRunSichtbar, WOHNUNG_SAMMELPUNKT_ANKER
   aus geo-projektion.js (3): lonLatToScreen, mapOffsetX, mapOffsetY
   aus sketch.js (2): stationenData, kapitel1ZoomAmount (blendet das
     Startpunkt-Label ein)
   aus p5: Zeichen- und Text-API, drawingContext

   --- Warum direkt in drawingContext, und was das kostet -------------------
   p5s text()/arc()/ellipse() bleiben bei laufender Animation (viele Frames
   pro Sekunde, wechselnde Werte) manchmal unsichtbar, obwohl fillStyle,
   globalAlpha und composite nachweislich korrekt gesetzt sind. Text und
   Flächen deshalb direkt über den Canvas-Context. Ursache ungeklärt, nur
   umgangen — derselbe Workaround steht in spine-horizontal.js.

   Der Preis: p5 führt über Füll- und Strichfarbe einen Zwischenspeicher,
   _setFill() überspringt die Zuweisung bei gleicher Farbe. Eine
   Direktzuweisung an drawingContext.fillStyle lässt den Zwischenspeicher
   veralten, ein späteres fill() wird dann übersprungen. pop() heilt das:
   p5 gleicht dort _cachedFillStyle/_cachedStrokeStyle wieder mit dem Canvas
   ab (p5 1.9.0, Renderer2D.pop). ctx.save()/restore() tut das NICHT.

   Deshalb steht jede der sechs zeichnenden Funktionen hier zwischen push()
   und pop() — auch drawHatchedCircle, das nur strokeStyle anfasst.

   --- ACHTUNG: Auswertung beim LADEN ---------------------------------------
   const FWERT_PUNKT_FARBE_RGB = hexZuRgb(FWERT_PUNKT_FARBE);
   Ruft eine fremde Funktion beim Laden. Diese Datei MUSS deshalb nach
   datenbereinigung.js stehen — sonst ReferenceError. Einziger nicht-literaler
   Top-Level-Initialisierer hier.

   --- Wer von aussen hierher greift ----------------------------------------
   sketch.js              zeichneKreiseOrtRuns (Kapitel-1-Route)
   uebersichtsrouten.js   zeichneKreiseOrtRuns (Kapitel-Zoom 02–18)
   ortsveraenderung.js    zeichneKreiseFuerRun, zeichneFwertPunkte, leereBandCounts
   spine-horizontal.js    zeichneKreiseFuerRun, zeichneFwertPunkte
   dom-aufbau.js          FWERT_PUNKT_DURCHMESSER (Legendenaufbau)

   Das sind genau die fünf Namen des Exportblocks am Dateiende. Skript 3 von
   12 in index.html: nach geo-projektion.js die zweite gemeinsame Grundlage
   mehrerer Module.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 8 von 13 Namen intern, 5 im Exportblock am Dateiende.
// Konvention: docs/architektur.md.
// Ladezeit-Abhängigkeit auf datenbereinigung.js: FWERT_PUNKT_FARBE_RGB =
// hexZuRgb(...) läuft beim Ausführen der IIFE, siehe Kopf.
(function () {

// Zeilenabstand der Schraffur in den Gesamtkreisen.
const HATCH_SPACING = 3;

// ---------------------------------------------------------------------------
// Kreise
// ---------------------------------------------------------------------------

function drawHatchedCircle(cx, cy, r, color, alphaSkala = 1) {
  if (r <= 0) return;
  push(); // schreibt strokeStyle direkt, siehe Kopf
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
    // Vier Ausschlussgründe (Route noch nicht so weit, vorzeitige Erwähnung,
    // Kapitel-1-Unterdrückung, Wohnung-Split) — Aussagen über die Daten,
    // deshalb in datenbereinigung.js entschieden, nicht hier.
    if (!ortRunSichtbar(r, punktIndex, annIndex, daten)) return;
    let pos = lonLatToScreen(r.lon, r.lat, activeBbox, offsetX, offsetY);
    let filter = wohnungFilterFuerOrt(r.ort);
    // EIN Durchlauf über daten.annotationen für beides: bandCounts und
    // dieselbe Trefferliste für die F-Wert-Punkte weiter unten. Alle ortRuns
    // wachsen mit annIndex, nicht nur die Hauptorte — jede Annotation soll
    // irgendwo auf der Karte eine sichtbare Änderung auslösen, statt dass
    // Nebenerwähnungen als fertiger Kreis auf einmal aufploppen.
    let treffer = sammleAnnotationenNachOrtBasis(filter, annIndex, daten);
    let bandCounts = zaehleBandCounts(treffer);
    // winkel PI und 'obenUnten' wie in der Graph-Ansicht
    // (zeichneSpineHorizontal), siehe Winkel-Konvention im Kopf.
    let radius = groessterKreisRadius(bandCounts);
    zeichneKreiseFuerRun(pos.x, pos.y, bandCounts, 1, PI);
    let fwertAnnotationen = treffer.filter(a => a.hasFwert);
    zeichneFwertPunkte(pos.x, pos.y, radius, fwertAnnotationen, 1, 'obenUnten');
    if (radius > 0) {
      // Beschriftung mit demselben Begriff wie in der Spine (r.ort). Erst
      // sammeln, Kollisionen nach der Schleife (zeichneKreisLabels): mehrere
      // Kreise können dieselbe Koordinate teilen, z.B. Aussenraum/
      // Innenraum-Paare.
      // Der Kreis des Routen-Startpunkts ist schon auf der Startseite zu
      // sehen, seine Beschriftung soll dort noch fehlen und erst mit dem
      // Kapitel-1-Ausschnitt einblenden — Deckkraft daher an
      // kapitel1ZoomAmount statt fest 1.
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

// Platziert die Labels und löst Überlagerungen auf: von oben nach unten
// sortiert, jedes Label rutscht nach unten, solange es die Bounding-Box eines
// schon platzierten überlappt. Ab spürbarem Versatz zieht eine gestrichelte
// Linie zum zugehörigen Kreis.
function zeichneKreisLabels(kandidaten) {
  // Alpha 0 (z.B. der Routen-Startpunkt auf der Startseite) fällt ganz raus:
  // kein Platz im Kollisions-Layout, keine Hilfslinie.
  kandidaten = kandidaten.filter(k => (k.alpha === undefined ? 1 : k.alpha) > 0.002);
  if (kandidaten.length === 0) return;

  push(); // sechs Zeichenzustände plus direkte fillStyle-Schreibzugriffe
  noStroke();
  fill(33, 43, 46, 255); // #212B2E, wie die Kapitelnummern
  textFont("'Source Sans 3', sans-serif"); // wie .annotation-tag (var(--sans)) und die Spine-Labels
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
      // Direkt statt über fill(): gezeichnet wird unten ohnehin über
      // fillText, und die Farbe wechselt je Label (alpha).
      drawingContext.fillStyle = k.farbe
        ? k.farbe
        : `rgba(33, 43, 46, ${alpha})`;
      // p5s text() bleibt beim Scrollen manchmal unsichtbar, siehe Kopf.
      drawingContext.fillText(k.text, k.x, y);
    });

  pop();
}

// Vollflächiger Halbkreis über exakt 180°: die beiden Radiuslinien liegen
// genau gegenüber und bilden zusammen den Durchmesser, daher kein sichtbarer
// Keil-Rand. winkelMitte = Bildschirm-Winkel der Mitte der Wölbung
// (p5-Konvention: 0 = rechts, wächst im Uhrzeigersinn).
// Deckkraft 0.75. blend=true (Multiply) für gold_hell/gold_dunkel,
// blend=false (deckende Basis) für gold_mittel, siehe Aufrufer.
// Als Canvas-Pfad statt über p5s arc(), siehe Kopf.
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

// Neutrale Valenz: gleiche Deckkraft/Blend-Logik wie zeichneHalbkreis, aber
// ganze Fläche — neutral hat keine Links/Rechts- bzw. Oben/Unten-Seite.
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

// winkel: feste Basis für die Aufteilung der Valenz-Halbkreise, NICHT aus der
// Routenrichtung abgeleitet. Karten- (zeichneKreiseOrtRuns) und Graph-Ansicht
// (zeichneSpineHorizontal) übergeben beide PI für pos=oben/neg=unten; bei
// einer Reihe nebeneinander liegender Spine-Kreise würde eine
// Links/Rechts-Teilung Nachbarn überlappen. Der Default -HALF_PI
// (neg=links/pos=rechts) bleibt dem Schlussakt Ortsveränderung, wo unter
// jedem Kreis Beschriftung und Kapitelzeile stehen.
// radiusSkala/maxRadius: nur die Ortsveränderung nutzt sie — dort werden die
// Radien ohne Deckel berechnet und danach gemeinsam so weit verkleinert, dass
// die senkrecht gestaffelten Kreise ins Fenster passen. Die Skalierung greift
// am fertigen Radius, nicht über eine Canvas-Transformation: so behalten
// Schraffur-Abstand und Strichstärken ihre normale Grösse.
// Kein Rückgabewert. Wer die Grösse braucht, holt sie mit
// groessterKreisRadius(bandCounts, maxRadius, radiusSkala) — derselben
// Funktion, die auch hier intern läuft. ACHTUNG: deren letzte zwei Parameter
// stehen in UMGEKEHRTER Reihenfolge zu denen hier.
function zeichneKreiseFuerRun(cx, cy, bandCounts, alphaSkala = 1, winkel = -HALF_PI, radiusSkala = 1, maxRadius = 100) {
  // Zwei Ebenen, jede für sich nach Radius geordnet (kleinste zuoberst,
  // mittlere danach, grösste zuunterst): unten die schraffierten
  // Gesamt-Kreise (neg+pos+neutral+unrated) der 3 Kategorien, darüber die
  // flächigen Valenz-Formen (neg/pos als Halbkreis, neutral als ganzer
  // Kreis). Die Ebenen selbst bleiben in dieser Reihenfolge FEST (schraffiert
  // immer unten) — sonst könnte eine flächenmässig kleinere Schraffur einer
  // Kategorie eine grössere Valenz-Fläche einer ANDEREN Kategorie zudecken,
  // die Kreisgrafik wirkte dann unvollständig (schraffiert statt farbig).
  push(); // schreibt unten direkt in fillStyle (Mittelpunkt)
  let hatchFormen = [];
  let flaechenFormen = [];
  // Dieselbe Funktion, die auch die Aufrufer benutzen, wenn sie die Grösse
  // VOR dem Zeichnen brauchen.
  let aussenRadius = groessterKreisRadius(bandCounts, maxRadius, radiusSkala);

  KREIS_KATEGORIEN.forEach(k => {
    let bc = bandCounts[k.key] || {};
    let n = (bc.neg || 0) + (bc.pos || 0) + (bc.neutral || 0) + (bc.unrated || 0);
    let hatchR = kreisRadius(n, maxRadius) * radiusSkala;
    if (hatchR > 0) {
      let hex = '#' + k.farbe.map(v => v.toString(16).padStart(2, '0')).join('');
      hatchFormen.push({ r: hatchR, zeichne: () => drawHatchedCircle(cx, cy, hatchR, hex, alphaSkala) });
    }

    // blend=true (Multiply) für gold_hell/gold_dunkel, blend=false (deckende
    // Fläche) für gold_mittel.
    let blend = k.key !== 'gold_mittel';
    let negR = kreisRadius(bc.neg || 0, maxRadius) * radiusSkala;
    let posR = kreisRadius(bc.pos || 0, maxRadius) * radiusSkala;
    let neutralR = kreisRadius(bc.neutral || 0, maxRadius) * radiusSkala;
    if (negR > 0) flaechenFormen.push({ r: negR, zeichne: () => zeichneHalbkreis(cx, cy, negR, winkel - HALF_PI, k.farbe, alphaSkala, blend) });
    if (posR > 0) flaechenFormen.push({ r: posR, zeichne: () => zeichneHalbkreis(cx, cy, posR, winkel + HALF_PI, k.farbe, alphaSkala, blend) });
    if (neutralR > 0) flaechenFormen.push({ r: neutralR, zeichne: () => zeichneVollkreis(cx, cy, neutralR, k.farbe, alphaSkala, blend) });
  });

  hatchFormen.sort((a, b) => b.r - a.r).forEach(f => f.zeichne());
  flaechenFormen.sort((a, b) => b.r - a.r).forEach(f => f.zeichne());

  if (aussenRadius > 0) {
    // Mittelpunkt. Als Canvas-Pfad statt über p5s ellipse(), siehe Kopf.
    drawingContext.fillStyle = `rgba(0, 0, 0, ${alphaSkala})`;
    drawingContext.beginPath();
    drawingContext.arc(cx, cy, 4, 0, TWO_PI);
    drawingContext.fill();
  }
  pop();
}

// Pixel-Durchmesser je F-Wert-Punktgrösse (1..3, siehe FWERT_PUNKTGROESSE in
// datenbereinigung.js), sowie Ring-/Randabstände für zeichneFwertPunkte.
const FWERT_PUNKT_DURCHMESSER = { 1: 5, 2: 7.5, 3: 10 };
const FWERT_PUNKT_FARBE_RGB = hexZuRgb(FWERT_PUNKT_FARBE);
const FWERT_PUNKT_RAND_ABSTAND = 6; // Luft zwischen Kreisrand und erstem Punkte-Ring
const FWERT_PUNKT_RING_ABSTAND = 8; // Abstand zwischen zwei Punkte-Ringen, falls ein Drittel nicht in einen Ring passt

// F-Wert-Punkte ausserhalb des Kreisdiagramms: anders als die aggregierten
// bandCounts bekommt hier jede Annotation mit F-Wert (a.hasFwert) einen
// EIGENEN Punkt. Grösse nach F-Wert-Typ (FWERT_PUNKTGROESSE: 1 Raum löst
// Emotion aus, 2 Emotion färbt Raum, 3 Körper als Sensor), Farbe einheitlich.
// Position: eines von drei 120°-Dritteln rund um den Kreis, auf derselben
// Seite wie der Valenz-Halbkreis derselben Bewertung.
// Reichen die Punkte eines Drittels nicht auf einen Bogen, wachsen weitere
// Ringe nach aussen (z.B. "Cannes", Kapitel 8: 87 F-Wert-Annotationen an
// einem einzigen Ort).
function zeichneFwertPunkte(cx, cy, radius, fwertAnnotationen, alphaSkala = 1, anordnung = 'seitlich') {
  if (!fwertAnnotationen.length || radius <= 0) return;

  push(); // noStroke() plus direkte fillStyle-Schreibzugriffe
  const DRITTEL = TWO_PI / 3;
  // Gruppenmitten [negativ, positiv, neutral/unbewertet] je Anordnung, der
  // Teilung der Halbkreise in zeichneKreiseFuerRun folgend, damit die Punkte
  // einer Valenz auf DERSELBEN Seite liegen wie ihre Fläche:
  //   'seitlich' (Ortsveränderung, Halbkreise links/rechts): negativ
  //     oben-links, positiv oben-rechts, neutral unten — die beiden
  //     Valenz-Gruppen symmetrisch um die Senkrechte.
  //   'obenUnten' (Karte und Graph, Halbkreise oben/unten): positiv GENAU
  //     oben, negativ GENAU unten, neutral rechts daneben. Fest notiert statt
  //     aus einer gemeinsamen Drehung abgeleitet: oben und unten liegen 180°
  //     auseinander, drei gleiche Drittel aber nur 120°.
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

      // Schmaler als das volle Drittel, damit Punkte an der Grenze nicht ins
      // Nachbar-Drittel ragen.
      let spanne = DRITTEL * 0.8;
      let n = ringFormen.length;
      ringFormen.forEach((f, i) => {
        let winkelPunkt = n === 1 ? mitte : mitte - spanne / 2 + (i / (n - 1)) * spanne;
        let x = cx + Math.cos(winkelPunkt) * ringRadius;
        let y = cy + Math.sin(winkelPunkt) * ringRadius;
        // Als Canvas-Pfad statt über p5s ellipse(), siehe Kopf.
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
// Fünf Namen. Wer sie liest: Header-Block "Wer von aussen hierher greift".
window.FWERT_PUNKT_DURCHMESSER = FWERT_PUNKT_DURCHMESSER;
window.leereBandCounts = leereBandCounts;
window.zeichneKreiseOrtRuns = zeichneKreiseOrtRuns;
window.zeichneKreiseFuerRun = zeichneKreiseFuerRun;
window.zeichneFwertPunkte = zeichneFwertPunkte;

})(); // Ende der Modulkapselung, siehe Kommentar oben
