/* =============================================================================
   kreisgrafik.js — Die Kreisdiagramme der Orte

   Je Ort ein Kreis: Grösse zählt die Erwähnungen, Form zeigt die Valenz.
   Unten schraffierte Gesamtkreise je Kategorie, darüber die Valenzflächen
   (Halbkreis neg/pos, Vollkreis neutral), aussen herum ein F-Wert-Punkt je
   Annotation. Winkel-Konvention und Abhängigkeiten: docs/architektur.md.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 103 von 116 Namen intern, 13 exportiert. Konvention: docs/architektur.md.
// ACHTUNG Ladezeit: hexZuRgb() und baueDemoAnnotationen() laufen schon in der
// IIFE — diese Datei muss nach datenbereinigung.js stehen, sonst ReferenceError.
// p5s Konstanten (PI, HALF_PI) gibt es hier noch nicht, die setzt p5 erst beim
// Start des Sketches. Auf Modulebene deshalb nur Math.PI.
(function () {

// ACHTUNG p5s text()/arc()/ellipse() bleiben bei laufender Animation
// manchmal unsichtbar — deshalb wird hier direkt in drawingContext
// gezeichnet. Das lässt p5s Farb-Zwischenspeicher veralten; nur pop()
// gleicht ihn wieder ab, ctx.restore() nicht. Jede Zeichenfunktion klammert.

// Zeilenabstand der Schraffur in den Gesamtkreisen.
const HATCH_SPACING = 3;

// Zeilenmass der Kreis-Labels; zeichneKreisLabels rutscht damit aus, der
// Legendenaufbau rechnet damit seinen Platzbedarf aus.
const LABEL_HOEHE = 14;
const LABEL_ABSTAND = 4;
// Schriftgrad aller Beschriftungen im Canvas: Ortsnamen, Legendentitel,
// Blockzeilen, Valenz- und Wahrnehmungslabels.
// ACHTUNG .annotation-tag in style.css führt denselben Wert als font-size —
// die Kategorienzeile der Annotationsbox ist DOM, nicht Canvas. Wird der Wert
// hier geändert, muss er dort mit, sonst laufen die beiden auseinander.
const LABEL_GROESSE = 13;

// ---------------------------------------------------------------------------
// Kreise
// ---------------------------------------------------------------------------

// Waagrechte Schraffur in die gesetzte Clip-Fläche; Gesamtkreise und
// Legendenfeld teilen sie sich. Aufrufer klammert mit push()/pop().
function schraffiere(x0, x1, y0, y1, farbe, alphaSkala) {
  const ctx = drawingContext;
  ctx.strokeStyle = farbe;
  ctx.globalAlpha = 0.55 * alphaSkala;
  ctx.lineWidth = 1.8;
  // ACHTUNG die Zeilen sitzen auf EINEM Raster für die ganze Fläche, nicht ab
  // der Oberkante der jeweiligen Form. Sonst begänne jeder Kreis auf seiner
  // eigenen Höhe: zwei Schraffuren übereinander fielen versetzt ineinander und
  // deckten sich gegenseitig zu — 1.8 px Strich auf 3 px Abstand lassen keine
  // Lücke mehr, die Fläche sähe gefüllt aus statt gestreift.
  for (let ly = Math.ceil(y0 / HATCH_SPACING) * HATCH_SPACING; ly <= y1; ly += HATCH_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x0, ly);
    ctx.lineTo(x1, ly);
    ctx.stroke();
  }
}

function drawHatchedCircle(cx, cy, r, color, alphaSkala = 1) {
  if (r <= 0) return;
  push(); // schreibt strokeStyle direkt, siehe ACHTUNG oben
  const ctx = drawingContext;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  schraffiere(cx - r, cx + r, cy - r, cy + r, color, alphaSkala);
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

  // Erst alle Orte sammeln, dann in EINEM Durchgang zeichnen: die Kreise
  // benachbarter Orte überlappen einander, ortweise gezeichnet läge die
  // Schraffur des späteren über den Flächen des früheren.
  let formen = [];
  let nachtrag = [];

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
    // winkel PI wie in der Graph-Ansicht: positiv oben, negativ unten.
    let radius = groessterKreisRadius(bandCounts);
    formen = formen.concat(sammleKreisFormen(pos.x, pos.y, bandCounts, 1, PI));
    nachtrag.push({ pos, radius, fwerte: treffer.filter(a => a.hasFwert) });
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

  zeichneKreisFormen(formen);
  // Mittelpunkte und F-Wert-Punkte danach: sie gehören über jede Fläche,
  // auch über die eines Nachbarortes.
  nachtrag.forEach(n => {
    if (n.radius > 0) zeichneMittelpunkt(n.pos.x, n.pos.y);
    zeichneFwertPunkte(n.pos.x, n.pos.y, n.radius, n.fwerte, 1);
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
  beschriftungsSchrift(LABEL_GROESSE);
  textAlign(LEFT, CENTER);

  let platziert = [];

  kandidaten
    .map(k => ({ ...k, w: textWidth(k.text) }))
    // links: der Text endet am Ankerplatz, statt dort zu beginnen.
    .map(k => k.links ? { ...k, x: k.x - k.w } : k)
    .sort((a, b) => a.y - b.y)
    .forEach(k => {
      let y = k.y;
      let ueberlappt = true;
      while (ueberlappt) {
        ueberlappt = platziert.some(p =>
          y < p.y + LABEL_HOEHE + LABEL_ABSTAND && y + LABEL_HOEHE + LABEL_ABSTAND > p.y &&
          k.x < p.x + p.w && k.x + k.w > p.x
        );
        if (ueberlappt) y += LABEL_HOEHE + LABEL_ABSTAND;
      }
      platziert.push({ x: k.x, y, w: k.w });

      let alpha = k.alpha === undefined ? 1 : k.alpha;
      // hilfslinie erzwingt die Linie auch ohne Ausweichen (Demo-Grafik).
      if (k.hilfslinie || Math.abs(y - k.y) > 1) {
        stroke(0, 255 * alpha);
        strokeWeight(0.8);
        drawingContext.setLineDash([2, 3]);
        line(k.ankerX, k.ankerY, k.links ? k.x + k.w + 4 : k.x - 4, y);
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
// Uhrzeigersinn).
// ACHTUNG deckend gezeichnet, ohne Multiply und ohne festen Alpha-Abschlag.
// Beides zusammen verschob die Farbe gegenüber KREIS_KATEGORIEN — die Legende
// zeigte daneben einen anderen Ton als der Kreis. alphaSkala bleibt: es blendet
// die ganze Grafik ein und aus.
function zeichneHalbkreis(cx, cy, r, winkelMitte, farbeRgb, alphaSkala = 1) {
  if (r <= 0) return;
  push();
  let ctx = drawingContext;
  ctx.fillStyle = `rgba(${farbeRgb[0]}, ${farbeRgb[1]}, ${farbeRgb[2]}, ${alphaSkala})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, winkelMitte - HALF_PI, winkelMitte + HALF_PI);
  ctx.closePath();
  ctx.fill();
  pop();
}

// winkel: feste Basis der Valenz-Teilung (PI für Karte/Graph, Default
// -HALF_PI für die Ortsveränderung). radiusSkala/maxRadius nur dort genutzt.

// ACHTUNG kein Rückgabewert. Radius holt groessterKreisRadius() — dessen
// letzte zwei Parameter stehen UMGEKEHRT zu denen hier.
// nurHaelften: weitere Kategorien, die allein ihre Valenzhälften beisteuern
// und keine Schraffur. Der Legendenaufbau baut damit Band um Band auf, ohne
// dass der Aussenradius mitwächst — sie laufen aber in derselben Reihenfolge
// und im selben Gleichstand-Versatz mit wie alles andere.
//
// Sammelt nur, zeichnet nicht: über die Reihenfolge muss zusammen mit allen
// anderen Orten entschieden werden, siehe zeichneKreisFormen().
function sammleKreisFormen(cx, cy, bandCounts, alphaSkala = 1, winkel = -HALF_PI, radiusSkala = 1, maxRadius = 100, nurHaelften = null) {
  let formen = [];
  let neu = (art, r, farbe) => formen.push({ art, r, farbe, cx, cy, winkel, alphaSkala });

  KREIS_KATEGORIEN.forEach(k => {
    let bc = bandCounts[k.key] || {};
    let n = (bc.neg || 0) + (bc.pos || 0) + (bc.neutral || 0) + (bc.unrated || 0);
    let hatchR = kreisRadius(n, maxRadius) * radiusSkala;
    if (hatchR > 0) neu('schraffur', hatchR, k.farbe);

    // Alle drei Ansichten übergeben winkel PI: positiv oben, negativ unten.
    let negR = kreisRadius(bc.neg || 0, maxRadius) * radiusSkala;
    let posR = kreisRadius(bc.pos || 0, maxRadius) * radiusSkala;
    if (negR > 0) neu('unten', negR, k.farbe);
    if (posR > 0) neu('oben', posR, k.farbe);
    // Neutrale Nennungen bekommen keine eigene Fläche. Als ganzer Kreis legten
    // sie sich über beide Hälften und machten die Mitte unlesbar. Gezählt
    // werden sie trotzdem: in der Schraffur, und damit in der Kreisgrösse.
  });

  (nurHaelften || []).forEach(e => {
    let negR = kreisRadius((e.bc && e.bc.neg) || 0, maxRadius) * radiusSkala;
    let posR = kreisRadius((e.bc && e.bc.pos) || 0, maxRadius) * radiusSkala;
    if (negR > 0) neu('unten', negR, e.kat.farbe);
    if (posR > 0) neu('oben', posR, e.kat.farbe);
  });

  // Gleich viele Annotationen ergeben denselben Radius. Zwei deckungsgleiche
  // Formen derselben Art wären eine: die obere verdeckte die untere ganz. Jede
  // weitere wächst deshalb um ein paar Pixel und schaut als Rand darum hervor.
  // ACHTUNG damit steht sie bis zu KREIS_GLEICHSTAND_VERSATZ über dem Radius,
  // den groessterKreisRadius() meldet — die Beschriftungen und der
  // Wahrnehmungsbogen rücken also nicht mit. Bei 6 px Luft (siehe
  // FWERT_PUNKT_RAND_ABSTAND) bleibt genug Abstand.
  // Nur je Art: oben und unten liegen ohnehin auf verschiedenen Seiten der
  // Mitte, dort wäre der Versatz eine Verfälschung ohne Nutzen.
  let gleiche = {};
  formen.forEach(f => {
    let schluessel = f.art + '|' + f.r.toFixed(3);
    let schon = gleiche[schluessel] || 0;
    gleiche[schluessel] = schon + 1;
    f.r += schon * KREIS_GLEICHSTAND_VERSATZ * radiusSkala;
  });
  return formen;
}

// Zwei Ebenen, in beiden gross zuunterst und klein zuoberst: erst alle
// Schraffuren, dann alle Valenzflächen. Reine Grössenordnung über beide hinweg
// brachte kleine Schraffuren VOR die Flächen — ihre Linien lagen dann quer
// über den ausgefüllten Hälften und machten sie unruhig.
// ACHTUNG die Liste kommt über ALLE Orte zugleich herein. Ortweise gezeichnet
// legte die Schraffur des nächsten Ortes sich über die Flächen des vorigen,
// sobald zwei Kreise einander überlappen — und auf der Karte tun sie das.
function zeichneKreisFormen(formen) {
  let ebene = f => f.art === 'schraffur' ? 0 : 1;
  push(); // schreibt direkt in fill-/strokeStyle, siehe ACHTUNG oben
  formen.sort((a, b) => ebene(a) - ebene(b) || b.r - a.r).forEach(f => {
    if (f.art === 'schraffur') drawHatchedCircle(f.cx, f.cy, f.r, rgbZuHex(f.farbe), f.alphaSkala);
    else zeichneHalbkreis(f.cx, f.cy, f.r, f.winkel + (f.art === 'oben' ? HALF_PI : -HALF_PI), f.farbe, f.alphaSkala);
  });
  pop();
}

// Schwarzer Punkt in der Ortsmitte, immer zuoberst.
function zeichneMittelpunkt(cx, cy, alphaSkala = 1) {
  push(); // Canvas-Pfad, siehe ACHTUNG oben
  drawingContext.fillStyle = `rgba(0, 0, 0, ${alphaSkala})`;
  drawingContext.beginPath();
  drawingContext.arc(cx, cy, 4, 0, TWO_PI);
  drawingContext.fill();
  pop();
}

// Ein einzelner Ort: sammeln und gleich zeichnen. Für alle Ansichten, die
// jeweils nur einen Kreis auf einmal setzen (Legendenaufbau, Ortsvergleich,
// Spine). Die Karte geht über sammleKreisFormen(), siehe zeichneKreiseOrtRuns.
function zeichneKreiseFuerRun(cx, cy, bandCounts, alphaSkala = 1, winkel = -HALF_PI, radiusSkala = 1, maxRadius = 100, nurHaelften = null) {
  zeichneKreisFormen(sammleKreisFormen(cx, cy, bandCounts, alphaSkala, winkel, radiusSkala, maxRadius, nurHaelften));
  if (groessterKreisRadius(bandCounts, maxRadius, radiusSkala) > 0) zeichneMittelpunkt(cx, cy, alphaSkala);
}

// Ringabstände der F-Wert-Punkte; die Durchmesser selbst stehen als
// FWERT_PUNKT_DURCHMESSER in datenbereinigung.js, weil fotomarker.js sie
// ebenfalls liest.
// Versatz für deckungsgleiche Formen: gleich viele Annotationen ergeben
// denselben Radius, und ohne diesen Abstand sähe man nur die oberste.
const KREIS_GLEICHSTAND_VERSATZ = 3;

const FWERT_PUNKT_RAND_ABSTAND = 6; // Luft zwischen Kreisrand und erstem Punkte-Ring
const FWERT_PUNKT_RING_ABSTAND = 8; // Abstand zwischen zwei Punkte-Ringen, falls ein Abschnitt nicht in einen Ring passt
const FWERT_PUNKT_LUECKE = 2;       // Mindestabstand zwischen benachbarten Punkten

// Mitte des 120°-Drittels je Valenzgruppe: neg unten, pos oben, neutral rechts.
// Einzige Quelle dieser Konvention — zeichneFwertPunkte() setzt die Punkte
// danach, und der Wahrnehmungsbogen der Legende zeigt auf dieselben Stellen.
// Math.PI statt HALF_PI: siehe ACHTUNG zur Ladezeit oben.
// Jede Valenzgruppe bekommt einen Bogenabschnitt von 100°, dazwischen 20°
// Luft — 3 × 100° + 3 × 20° ergeben die vollen 360°. Neutral zeigt nach
// rechts, positiv nach links oben, negativ nach links unten (Bildschirmwinkel:
// 0 = rechts, im Uhrzeigersinn). Siehe docs/topografie-der-gefuehle-grafik.pdf.
// Math.PI statt radians(): die Konstanten entstehen beim Laden des Moduls,
// p5-Globals stehen da noch nicht sicher bereit.
const FWERT_GRUPPEN_SPANNE = Math.PI * 100 / 180;
const FWERT_GRUPPEN_LUECKE = Math.PI * 20 / 180;
const FWERT_GRUPPEN_VERSATZ = FWERT_GRUPPEN_SPANNE + FWERT_GRUPPEN_LUECKE;
const FWERT_GRUPPEN_WINKEL = { neg: FWERT_GRUPPEN_VERSATZ, pos: -FWERT_GRUPPEN_VERSATZ, neutral: 0 };

// Ein Punkt je Annotation mit F-Wert, Grösse nach Typ, Lage im 120°-Drittel
// der eigenen Valenz. Bei Andrang wachsen weitere Ringe nach aussen.

function zeichneFwertPunkte(cx, cy, radius, fwertAnnotationen, alphaSkala = 1) {
  if (!fwertAnnotationen.length || radius <= 0) return;

  push(); // noStroke() plus direkte fillStyle-Schreibzugriffe
  // Reihenfolge [neg, pos, neutral] — gruppen[0..2] unten wird so indiziert.
  let mitten = [FWERT_GRUPPEN_WINKEL.neg, FWERT_GRUPPEN_WINKEL.pos, FWERT_GRUPPEN_WINKEL.neutral];
  let gruppen = mitten.map(mitte => ({ mitte, formen: [] }));
  fwertAnnotationen.forEach(a => {
    let gruppe = a.valenz === -1 ? gruppen[0] : a.valenz === 1 ? gruppen[1] : gruppen[2];
    let groesse = FWERT_PUNKTGROESSE[a.fWertType] || 1;
    gruppe.formen.push({
      d: FWERT_PUNKT_DURCHMESSER[groesse],
      rgb: FWERT_COLOR_RGB,
      typ: a.fWertType,
    });
  });

  noStroke();
  gruppen.forEach(({ mitte, formen }) => {
    if (!formen.length) return;
    let ringRadius = radius + FWERT_PUNKT_RAND_ABSTAND;
    let rest = formen;
    while (rest.length) {
      // Platzbudget eines Rings: der ganze Bogenabschnitt. Die 20° Luft zu
      // den Nachbarn hält die Gruppen auseinander, auch wenn er voll wird.
      let bogenlaenge = ringRadius * FWERT_GRUPPEN_SPANNE;
      let platz = 0;
      let anzahlImRing = 0;
      for (let f of rest) {
        let breite = f.d + FWERT_PUNKT_LUECKE;
        if (anzahlImRing > 0 && platz + breite > bogenlaenge) break;
        platz += breite;
        anzahlImRing++;
      }
      let ringFormen = rest.slice(0, anzahlImRing);
      rest = rest.slice(anzahlImRing);

      // Die Punkte wachsen aus der Mitte ihres Abschnitts heraus: die Reihe ist
      // nur so breit, wie sie sein muss, und sitzt mittig auf `mitte`. Früher
      // spannte sie sich über die vollen 100° — schon zwei Punkte standen dann
      // an den Rändern und stiessen an die Nachbargruppe. So bleibt zwischen
      // den drei Gruppen sichtbar Platz, auch wenn eine gut gefüllt ist.
      let winkelBreiten = ringFormen.map(f => (f.d + FWERT_PUNKT_LUECKE) / ringRadius);
      let reiheBreite = winkelBreiten.reduce((a, b) => a + b, 0);
      let kante = mitte - reiheBreite / 2;
      ringFormen.forEach((f, i) => {
        let winkelPunkt = kante + winkelBreiten[i] / 2;
        kante += winkelBreiten[i];
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


// ---------------------------------------------------------------------------
// Demo-Kreisgrafik (Erklärung vor dem Zoom in Kapitel 1)
// ---------------------------------------------------------------------------

// Erfundene Zielwerte, keine Kapiteldaten. Drei klar unterscheidbare
// Bandgrössen (16/10/8).
//
// ACHTUNG alle drei Bänder müssen in dieselbe Richtung überwiegen, sonst füllt
// das negative Band eines anderen die untere Hälfte auf und die Ausbauchung
// ist nicht mehr zu sehen.
//
// ACHTUNG auch die pos-Werte müssen sich unterscheiden (8/6/4). Der
// Legendenaufbau zeigt je Kategorie nur die beiden Valenzhälften, und deren
// Radius hängt allein an pos bzw. neg — bei gleichem pos-Wert läge der neue
// Halbkreis genau auf dem vorigen, und der Schritt wäre nicht zu sehen.
const DEMO_BAND_COUNTS = {
  gold_dunkel: { pos: 8, neg: 3, neutral: 3, unrated: 2 },
  gold_mittel: { pos: 6, neg: 1, neutral: 2, unrated: 1 },
  gold_hell: { pos: 4, neg: 2, neutral: 1, unrated: 1 },
};

// Umkehrung von valenzBucket(); unrated hat keinen Zahlenwert.
const DEMO_VALENZ = { pos: 1, neg: -1, neutral: 0, unrated: undefined };

// Ein F-Wert je Valenzgruppe, damit oben, unten und rechts je ein Punkt sitzt.
const DEMO_FWERTE = { pos: 'ort_loest_emotion_aus', neg: 'emotion_faerbt_raum', neutral: 'koerper_als_sensor' };

// Die Demo steht allein auf der Karte und darf grösser sein als die Kreise
// entlang der Route. maxRadius ist der Vorgabewert von kreisRadius().
const DEMO_MAX_RADIUS = 100;

// Tinte der Legende: Schrift, Striche und Klammern in beiden Fassungen, der
// Registerleiste wie dem Legendenaufbau. Dasselbe Blaugrau trägt das
// Kapitelmenü (--menue in style.css). Die Ortsbeschriftungen auf der Karte
// bleiben davon unberührt, sie setzen ihre Farbe in zeichneKreisLabels selbst.
const LEGENDE_TINTE = '#3A5058';

// Lage der Kategorienzeilen im Legendenblock. Der Legendenaufbau und die
// Registerleiste tragen sie ein, siehe kategorieZeileGetroffen().

// ACHTUNG die Liste wird je Frame beim ERSTEN Eintrag geleert, nicht beim
// Zeichnen des Blocks. Der Block wird nämlich zweimal pro Frame gezeichnet,
// wenn der Legendenbalken während des Onboardings offen ist — einmal für den
// Balken, einmal für die Legende im Bild. Beim zweiten Mal geleert, wären die
// Flächen weg, bevor mousePressed() sie lesen kann.
let letzteKategorieZeilen = [];
let kategorieZeilenFrame = -1;

// Oberkante des Begleittexts. Aus seinen CSS-Werten gerechnet, nicht gemessen:
// getBoundingClientRect() je Frame wäre ein erzwungenes Layout, und die
// Zeilenzahl wechselt ohnehin mit jeder Stufe — gerechnet wird darum immer mit
// der längsten (vierzeiligen).
// ACHTUNG spiegelt .begleittext[data-demo-gruppe] in style.css (top 78 %,
// translateY(-50 %), font-size clamp(16px, 3vw, 30px), line-height 1.5).
// Ändert sich dort etwas, muss es hier nachgezogen werden, sonst rutscht die
// Legende in den Text.
const LEGENDE_TEXT_MITTE = 0.78;
const BEGLEITTEXT_ZEILENHOEHE = 1.5;
const BEGLEITTEXT_ZEILEN_MAX = 4;
function begleittextHalbeHoehe() {
  let schrift = Math.min(30, Math.max(16, width * 0.03));
  return schrift * BEGLEITTEXT_ZEILENHOEHE * BEGLEITTEXT_ZEILEN_MAX / 2;
}
function begleittextOben() {
  return height * LEGENDE_TEXT_MITTE - begleittextHalbeHoehe();
}

// Luft über der Kopfzeile des Legendenaufbaus. Genauso viel, wie unter dem
// Begleittext frei bleibt — dadurch sitzt die ganze Komposition aus Titel,
// Kreis, Blockzeile und Text mittig im Fenster.
function legendenKopfraum() {
  return height - (height * LEGENDE_TEXT_MITTE + begleittextHalbeHoehe());
}

// Höhe der Blockzeile: Kategorienblock, Sonifikationsbox, Luft zum
// Begleittext. Wächst sie, bleibt dem Kreis weniger Raum (demoKreisLage).
function blockZeileHoehe() {
  return LEGENDE_TITEL_ABSTAND + 2 * LEGENDE_ZEILE
    + LEGENDE_BLOCK_ABSTAND + LEGENDE_TITEL_ABSTAND + LEGENDE_BLOCK_LUFT;
}

// Radius des fertig aufgebauten Demo-Kreises bei Massstab 1. Hängt nur an
// DEMO_BAND_COUNTS, wird deshalb einmal berechnet und gemerkt.
let einheitsRadiusCache = null;
function demoEinheitsRadius() {
  if (einheitsRadiusCache === null) {
    einheitsRadiusCache = groessterKreisRadius(DEMO_BAND_COUNTS, DEMO_MAX_RADIUS, 1);
  }
  return einheitsRadiusCache;
}

// Der Kreis steht im Viewport zentriert. Der Massstab fällt auf kleinen
// Fenstern mit, sonst reicht der Platz unter dem Kreis nicht mehr für die
// beiden Legendenblöcke.
function demoKreisLage() {
  // Über dem Begleittext liegen von oben nach unten: der Kreisgrössen-Text,
  // der Kreis mit seinem Bogen und der Kategorienblock. Der Kreis nimmt, was
  // dazwischen frei bleibt — kein fester Massstab, sondern der Zielradius
  // geteilt durch den Radius, den derselbe Kreis bei Massstab 1 hätte.
  let raum = begleittextOben() - legendenKopfraum() - blockZeileHoehe();
  // Zweimal LEGENDE_BOGEN_ABSTAND: einmal für den Bogen selbst, einmal als
  // Luft zwischen ihm und dem Kategorienblock darunter.
  let ziel = Math.min(width * 0.26,
    Math.max(40, (raum - LEGENDE_ECKE - 2 * LEGENDE_BOGEN_ABSTAND) / 2));
  return {
    cx: width * 0.5,
    cy: legendenKopfraum() + LEGENDE_ECKE + ziel,
    skala: ziel / demoEinheitsRadius(),
  };
}

// Aufdeck-Reihenfolge: reihum durch die Bänder, damit alle drei gemeinsam
// wachsen. Der Scroll-Fortschritt deckt davon einen Präfix auf, genau wie
// annIndex bei den echten Kreisen.
function baueDemoAnnotationen() {
  let vorraete = KREIS_KATEGORIEN.map(kat =>
    Object.keys(DEMO_VALENZ).flatMap(bucket =>
      Array.from({ length: DEMO_BAND_COUNTS[kat.key][bucket] || 0 },
        () => ({ category: kat.key, valenz: DEMO_VALENZ[bucket] }))));

  let reihenfolge = [];
  while (vorraete.some(v => v.length)) {
    vorraete.forEach(v => { if (v.length) reihenfolge.push(v.shift()); });
  }
  // Die jeweils erste Annotation einer Valenzgruppe trägt deren F-Wert.
  Object.keys(DEMO_FWERTE).forEach(bucket => {
    let treffer = reihenfolge.find(a => a.valenz === DEMO_VALENZ[bucket]);
    if (treffer) { treffer.hasFwert = true; treffer.fWertType = DEMO_FWERTE[bucket]; }
  });
  return reihenfolge;
}

const DEMO_ANNOTATIONEN = baueDemoAnnotationen();

// ---------------------------------------------------------------------------
// Legendenaufbau (Onboarding)
// ---------------------------------------------------------------------------


const LEGENDE_ZEILE = 22;           // Zeilenabstand in den beiden Blöcken
const LEGENDE_TITEL_ABSTAND = 26;   // Überschrift zur ersten Zeile
const LEGENDE_FELD = 15;            // Kantenlänge der Kategorienfelder
const LEGENDE_FELD_LUECKE = 4;      // Luft zwischen Farbfeld und Schraffurfeld
const LEGENDE_KLANG_IKON = 13;      // Kantenlänge des Lautsprechers vor der Zeile
const LEGENDE_KLANG_LUECKE = 8;     // Luft zwischen Lautsprecher und Farbfeld
const LEGENDE_MARKE_SPALTE = 26;    // Feld- bzw. Punktspalte zum Text
const LEGENDE_BLOCK_LUECKE = 40;    // Luft zwischen den beiden Blöcken
const LEGENDE_BLOCK_LUFT = 22;      // Blockzeile zur Oberkante des Begleittexts
const LEGENDE_BLOCK_ABSTAND = 26;   // Luft zwischen Kategorien- und Sonifikationsbox
const LEGENDE_RAND_LINKS = 46;      // Titel und linker Block zum Fensterrand
const LEGENDE_TEXTZEILE = 17;       // Zeilenabstand im Kreisgrössen-Block
const LEGENDE_TEXT_ABSTAND = 60;    // Kreisrand zum Text rechts
const LEGENDE_ECKE = 46;            // Höhe des Knicks über dem Kreisscheitel
const LEGENDE_KLAMMER_TIEFE = 90;   // Wie weit die Valenzklammern nach links greifen
const LEGENDE_BOGEN_ABSTAND = 30;   // Bogenradius über dem Kreisrand
const LEGENDE_RING_RADIUS = 7;      // offene Ringe auf dem Bogen
const LEGENDE_MITTELPUNKT = 4;      // dunkler Punkt in der Kreismitte, wie in zeichneKreiseFuerRun
const LEGENDE_STRICHEL = [3, 4];    // Strichelmass von Klammern und Bogen
const LEGENDE_SICHTBAR = 0.002;     // darunter lohnt das Zeichnen nicht
const LEGENDE_TINTE_RGB = hexZuRgb(LEGENDE_TINTE);

// Zeilen des Blocks «Körper und Raum»
const LEGENDE_FWERT_ZEILEN = Object.keys(FWERT_PUNKTGROESSE)
  .sort((a, b) => FWERT_PUNKTGROESSE[b] - FWERT_PUNKTGROESSE[a])
  .map(typ => ({ text: FWERT_LABELS[typ], punkt: FWERT_PUNKT_DURCHMESSER[FWERT_PUNKTGROESSE[typ]] }));

// Der Kreis differenziert sich mit der Legende: erst
// gestreift, dann mit Valenzhälften, dann mit den drei Bändern.
function stufenBandCounts(bandCounts, mitKategorie, valenzen) {
  // Was noch keine Stufe benannt hat, bleibt Schraffur: der Kreis wächst nicht
  // mehr, es füllt sich nur, was schon erklärt ist.
  let aufteilen = bc => {
    let raus = { neg: 0, pos: 0, neutral: 0, unrated: 0 };
    Object.keys(raus).forEach(bucket => {
      let n = bc[bucket] || 0;
      if (bucket !== 'unrated' && valenzen.includes(bucket)) raus[bucket] = n;
      else raus.unrated += n;
    });
    return raus;
  };

  // Ohne Kategorie: ein einziges Band. Die Mengen werden
  // auf das grösste Band heruntergerechnet statt summiert — die Summe ergäbe
  // einen grösseren Kreis, und der Aussenradius soll über alle Stufen stehen
  // bleiben. gold_mittel, weil zeichneKreiseFuerRun genau dieses Band deckend
  // zeichnet statt im Multiply; ein einzelnes Band soll nicht nachdunkeln.
  /*if (!mitKategorie) {
    let summe = { neg: 0, pos: 0, neutral: 0, unrated: 0 };
    let groesstesBand = 0;
    KREIS_KATEGORIEN.forEach(kat => {
      let b = bandCounts[kat.key] || {};
      let n = 0;
      Object.keys(summe).forEach(bucket => {
        summe[bucket] += b[bucket] || 0;
        n += b[bucket] || 0;
      });
      groesstesBand = Math.max(groesstesBand, n);
    });
    let gesamt = summe.neg + summe.pos + summe.neutral + summe.unrated;
    if (!gesamt) return {};
    let f = groesstesBand / gesamt;
    return { gold_mittel: aufteilen({
      neg: summe.neg * f, pos: summe.pos * f,
      neutral: summe.neutral * f, unrated: summe.unrated * f,
    }) };
  }*/

  // Mit Kategorie: das erste Band echt. Die weiteren kommen nicht hierher,
  // sondern als blosse Valenzhälften dazu (nurHaelften) — bei
  // DEMO_BAND_COUNTS ist das erste zugleich das grösste, der Aussenradius
  // bleibt dadurch über alle Stufen stehen.
  let erste = KREIS_KATEGORIEN[0];
  return bandCounts[erste.key] ? { [erste.key]: aufteilen(bandCounts[erste.key]) } : {};
}

// Ein weiteres Band bringt nur seine beiden Valenzhälften mit: kein
// Schraffurkreis, keine neutrale Fläche. Ein voller Ring je Kategorie machte
// die Mitte zu dicht — mit drei Bändern lägen dort acht Kreise übereinander.
// Dieselbe Regel gilt über VALENZEN auch für das erste Band.
// Winkel wie in zeichneKreiseFuerRun (winkel PI): positiv oben, negativ unten.
// Ein Zustand des Demo-Kreises: das erste Band ganz, jedes weitere nur mit
// seinen Valenzhälften. kategorien 0 = noch gar keine, dann ein tonloses Band.
function zeichneDemoStufe(cx, cy, bandCounts, kategorien, valenzen, alphaSkala, skala) {
  if (alphaSkala <= LEGENDE_SICHTBAR) return;
  // Die weiteren Bänder gehen als reine Hälften in DENSELBEN Aufruf. Vorher
  // zeichnete eine eigene Schleife sie danach: dort griffen weder die
  // Grössenordnung noch der Versatz bei gleichem Radius, zwei gleich grosse
  // Hälften lagen deckungsgleich übereinander.
  let weitere = KREIS_KATEGORIEN.slice(1, kategorien)
    .map(kat => ({ kat, bc: bandCounts[kat.key] }))
    .filter(e => e.bc);
  zeichneKreiseFuerRun(cx, cy, stufenBandCounts(bandCounts, kategorien > 0, valenzen),
    alphaSkala, PI, skala, DEMO_MAX_RADIUS, weitere);
}

// Schrift aller Canvas-Beschriftungen: wie .annotation-tag (var(--sans)),
// font-weight 700. Messen und Zeichnen müssen dieselbe nehmen, sonst stimmen
// Blockbreite und Titelkante nicht mehr mit dem überein, was danebensteht —
// deshalb an einer Stelle.
function beschriftungsSchrift(groesse) {
  textFont(SCHRIFT_SANS);
  textSize(groesse);
  textStyle(BOLD);
}

// Gestrichelte Linien der Legende. Kapselt das setLineDash-Paar, das sonst in
// jeder der drei Zeichenroutinen stünde.
function legendenStrich(farbe, alpha, zeichnen) {
  push();
  noFill();
  stroke(farbe.r, farbe.g, farbe.b, 255 * alpha);
  strokeWeight(0.9);
  drawingContext.setLineDash(LEGENDE_STRICHEL);
  zeichnen();
  drawingContext.setLineDash([]);
  pop();
}

// Breite eines Texts in der Beschriftungsschrift. Kapselt das push/pop, damit
// Messen und Zeichnen denselben Zustand sehen.
function beschriftungsBreite(text, groesse = LABEL_GROESSE) {
  push();
  beschriftungsSchrift(groesse);
  let breite = textWidth(text);
  pop();
  return breite;
}

// Kopf der Legende, im PDF auf jeder Seite gleich. Lage gibt der Aufrufer
// vor — im Legendenaufbau steht er auf der Zeile von «Anteil positiver
// Gefühle».
function zeichneLegendenTitel(x, y, alpha) {
  if (alpha <= LEGENDE_SICHTBAR) return;
  push();
  noStroke();
  textAlign(LEFT, CENTER);
  beschriftungsSchrift(LABEL_GROESSE);
  fill(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b, 255 * alpha);
  text(LEGENDE_TITEL, x, y);
  // Zurückgenommen wie im PDF: der Untertitel benennt nur, was das Bild ist.
  // Gleiche Grösse, unterschieden über Gewicht und Deckkraft.
  textStyle(NORMAL);
  fill(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b, 140 * alpha);
  text(LEGENDE_UNTERTITEL, x, y + LEGENDE_TEXTZEILE);
  pop();
}

// Schritt 1: der Kreisgrössen-Text rechts oben, angebunden mit einem Knick
// über dem Kreisscheitel. Steht ausserhalb von zeichneKreisLabels, weil er
// mehrzeilig ist — dort bekäme jede Zeile eine eigene Hilfslinie.
function zeichneKreisgroessenBlock(cx, cy, aussen, alpha) {
  let x = cx + aussen + LEGENDE_TEXT_ABSTAND;
  let ecke = cy - aussen - LEGENDE_ECKE;
  legendenStrich(LEGENDE_TINTE_RGB, alpha, () => {
    line(cx, cy - aussen, cx, ecke);
    line(cx, ecke, x - 8, ecke);
  });
  push();
  noStroke();
  textAlign(LEFT, CENTER);
  beschriftungsSchrift(LABEL_GROESSE);
  LEGENDE_KREISGROESSE.forEach((zeile, i) => {
    // Die ersten drei Zeilen benennen die Regel, die letzten beiden erläutern
    // sie — im PDF derselbe Gewichtswechsel.
    textStyle(i < 3 ? BOLD : NORMAL);
    fill(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b, 255 * alpha);
    text(zeile, x, ecke + i * LEGENDE_TEXTZEILE);
  });
  pop();
}

// Schritte 2 und 3: je eine nach rechts offene Klammer über einer Kreishälfte.
// richtung -1 = obere (positiv), +1 = untere (negativ). Die Mittellinie
// gehört beiden und wird von demoLegende einmal gezogen — zweimal übereinander
// dunkelte sie nach, solange sich die beiden Schritte überblenden.
function zeichneValenzKlammer(cx, cy, aussen, richtung, alpha) {
  let links = cx - aussen - LEGENDE_KLAMMER_TIEFE;
  let y = cy + richtung * aussen;
  legendenStrich(LEGENDE_TINTE_RGB, alpha, () => {
    line(links, y, cx, y);
    line(links, y, links, cy);
  });
}

// Einzug der Felder: Kategorienzeilen tragen vorweg den Lautsprecher, der
// ihren Klang abspielt. Punkt- und Textzeilen fangen am Blockrand an.
function legendenFeldSpalte(zeilen) {
  return zeilen.some(z => z.kategorie) ? LEGENDE_KLANG_IKON + LEGENDE_KLANG_LUECKE : 0;
}

// Wo der Text eines Blocks beginnt: Kategorienzeilen tragen zwei Felder
// nebeneinander — gefüllt und schraffiert —, die Punktzeilen nur eine Marke.
function legendenTextSpalte(zeilen) {
  let feldX = legendenFeldSpalte(zeilen);
  if (zeilen.some(z => z.feld)) return feldX + LEGENDE_MARKE_SPALTE + LEGENDE_FELD + LEGENDE_FELD_LUECKE;
  if (zeilen.some(z => z.punkt)) return LEGENDE_MARKE_SPALTE;
  return 0; // reine Textzeile, etwa der Hinweis der Sonifikationsbox
}

// Kleiner Lautsprecher: Korpus, Trichter, zwei Schallbögen. Trägt die Tinte
// der Beschriftung, damit er als Bedienzeichen und nicht als Farbe gilt.
function zeichneKlangIkon(x, y, alpha) {
  let h = LEGENDE_KLANG_IKON;
  let r = LEGENDE_TINTE_RGB;
  push();
  noStroke();
  fill(r.r, r.g, r.b, 255 * alpha);
  rect(x, y + h * 0.34, h * 0.30, h * 0.32);
  beginShape();
  vertex(x + h * 0.30, y + h * 0.34);
  vertex(x + h * 0.56, y + h * 0.10);
  vertex(x + h * 0.56, y + h * 0.90);
  vertex(x + h * 0.30, y + h * 0.66);
  endShape(CLOSE);
  noFill();
  stroke(r.r, r.g, r.b, 255 * alpha);
  strokeWeight(1.2);
  arc(x + h * 0.56, y + h / 2, h * 0.52, h * 0.62, -PI / 3, PI / 3);
  arc(x + h * 0.56, y + h / 2, h * 0.92, h * 1.02, -PI / 3, PI / 3);
  pop();
}

// Zweites Feld je Kategorie: dieselbe Farbe als Schraffur. Es zeigt, wie der
// noch unbestimmte Anteil derselben Kategorie im Kreis aussieht.
function zeichneSchraffurFeld(x, y, farbe, alphaSkala) {
  push();
  const ctx = drawingContext;
  ctx.beginPath();
  ctx.rect(x, y, LEGENDE_FELD, LEGENDE_FELD);
  ctx.clip();
  schraffiere(x, x + LEGENDE_FELD, y, y + LEGENDE_FELD,
    `rgb(${farbe[0]}, ${farbe[1]}, ${farbe[2]})`, alphaSkala);
  pop();
}

// Breite eines Blocks: Textspalte plus längste Zeile. Nur der rechte Block
// braucht sie, um am Fensterrand zu enden.
function legendenBlockBreite(titel, zeilen) {
  let spalte = legendenTextSpalte(zeilen);
  return Math.max(beschriftungsBreite(titel),
    ...zeilen.map(z => spalte + beschriftungsBreite(z.text)));
}

// Schritte 4 und 5: ein Block mit Überschrift und Zeilen. Eine Zeile trägt
// entweder ein Farbfeld (Kategorien) oder einen Punkt (Körper und Raum).
// alpha gilt für die Überschrift; eine Zeile kann mit z.alpha ihre eigene
// mitbringen — die Kategorien kommen einzeln, mit dem Band, das sie benennen.
function zeichneLegendenBlock(x, y, titel, zeilen, alpha) {
  if (alpha <= LEGENDE_SICHTBAR) return;
  push();
  noStroke();
  textAlign(LEFT, CENTER);
  beschriftungsSchrift(LABEL_GROESSE);
  fill(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b, 255 * alpha);
  text(titel, x, y);
  let textSpalte = legendenTextSpalte(zeilen);
  let feldX = x + legendenFeldSpalte(zeilen);
  zeilen.forEach((z, i) => {
    let a = z.alpha === undefined ? alpha : z.alpha;
    if (a <= LEGENDE_SICHTBAR) return;
    let zy = y + LEGENDE_TITEL_ABSTAND + i * LEGENDE_ZEILE;
    if (z.kategorie) zeichneKlangIkon(x, zy - LEGENDE_KLANG_IKON / 2, a);
    if (z.feld) {
      fill(z.feld[0], z.feld[1], z.feld[2], 255 * a);
      rect(feldX, zy - LEGENDE_FELD / 2, LEGENDE_FELD, LEGENDE_FELD);
      zeichneSchraffurFeld(feldX + LEGENDE_FELD + LEGENDE_FELD_LUECKE,
        zy - LEGENDE_FELD / 2, z.feld, a);
    } else if (z.punkt) {
      fill(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b, 255 * a);
      circle(x + LEGENDE_FELD / 2, zy, z.punkt);
    }
    fill(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b, 255 * a);
    text(z.text, x + textSpalte, zy);
    // Klickfläche ist allein der Lautsprecher, nicht die ganze Zeile.
    if (z.kategorie) {
      if (kategorieZeilenFrame !== frameCount) {
        letzteKategorieZeilen = [];
        kategorieZeilenFrame = frameCount;
      }
      letzteKategorieZeilen.push({
        kategorie: z.kategorie,
        x0: x - 3, x1: x + LEGENDE_KLANG_IKON + 3,
        y0: zy - LEGENDE_ZEILE / 2, y1: zy + LEGENDE_ZEILE / 2,
      });
    }
  });
  pop();
}

// Stufen 6 bis 8 (PDF-Seiten 7 bis 9): je ein gestrichelter Bogenabschnitt mit
// einem offenen Ring in seiner Mitte — genau dort sitzen die F-Wert-Punkte
// (FWERT_GRUPPEN_WINKEL). Ein Bogen je Gruppe statt eines vollen Kreises: die
// Lücken zeigen, dass die Punkte in drei Abschnitten liegen, nicht rundum.
// alphas nennt je Valenzgruppe die Deckkraft; gibt die sichtbaren Ringe für
// die Beschriftung zurück.
function zeichneWahrnehmungsbogen(cx, cy, aussen, alphas,
    abstand = LEGENDE_BOGEN_ABSTAND, ringR = LEGENDE_RING_RADIUS) {
  let r = aussen + abstand;
  let ringe = Object.entries(FWERT_GRUPPEN_WINKEL)
    .map(([bucket, winkel]) => ({
      bucket, winkel, alpha: alphas[bucket] || 0,
      x: cx + Math.cos(winkel) * r, y: cy + Math.sin(winkel) * r,
    }))
    .filter(ring => ring.alpha > LEGENDE_SICHTBAR);
  ringe.forEach(ring => {
    legendenStrich(FWERT_COLOR_RGB, ring.alpha, () => arc(cx, cy, r * 2, r * 2,
      ring.winkel - FWERT_GRUPPEN_SPANNE / 2, ring.winkel + FWERT_GRUPPEN_SPANNE / 2, OPEN));
    push();
    noFill();
    stroke(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b, 255 * ring.alpha);
    strokeWeight(1.4);
    circle(ring.x, ring.y, ringR * 2);
    pop();
  });
  return ringe;
}

// Baut die Legende um den Demo-Kreis auf. Zeichnet alles mit eigener Geometrie
// selbst und gibt die Beschriftungen als Kandidaten zurück — zeichneKreisLabels
// wird genau einmal aufgerufen, sonst weichen sich die Labels nicht aus.
function demoLegende(cx, cy, aussen, gruppenAlpha, kreisDa) {
  let [aOrt, aGroesse, aPos, aNeg, aMittel, aHell, aWpos, aWneg, aWneutral] = gruppenAlpha;
  let labels = [];
  let rechts = cx + aussen + LEGENDE_TEXT_ABSTAND;
  let linksX = cx - aussen - LEGENDE_KLAMMER_TIEFE - 10;
  let hinzu = (alpha, links, ankerX, ankerY, text, farbe, hilfslinie) => labels.push({
    ankerX, ankerY, x: links ? linksX : rechts, y: ankerY,
    text, farbe: farbe || null, hilfslinie, links, alpha,
  });

  // Schritt 0 (PDF-Seite 1): der Mittelpunkt und sein Name stehen da, bevor
  // der Kreis wächst. Sobald er da ist, zeichnet zeichneKreiseFuerRun den
  // Punkt selbst — hier bliebe er sonst ein zweites Mal darüberliegen.
  // Über «Positive Wahrnehmung» und linksbündig zu dieser Beschriftung: deren
  // Zeile ergibt sich aus dem Winkel und Radius, auf dem
  // zeichneWahrnehmungsbogen ihren Ring setzt. Drei Zeilen darüber — zwei
  // trägt der Kopf selbst (Titel und Unterzeile), die dritte ist der Abstand
  // zur Beschriftung. Bei zwei Zeilen blieben darunter nur 9 px.
  let obersteZeile = cy + Math.sin(FWERT_GRUPPEN_WINKEL.pos) * (aussen + LEGENDE_BOGEN_ABSTAND);
  zeichneLegendenTitel(
    Math.max(LEGENDE_RAND_LINKS, linksX - beschriftungsBreite(WAHRNEHMUNG_LABELS.pos)),
    obersteZeile - 3 * LEGENDE_TEXTZEILE, aOrt);

  if (aOrt > LEGENDE_SICHTBAR) {
    if (!kreisDa) {
      push();
      noStroke();
      fill(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b, 255 * aOrt);
      circle(cx, cy, LEGENDE_MITTELPUNKT * 2);
      pop();
    }
    hinzu(aOrt, false, cx, cy, LEGENDE_ORTSBESCHRIFTUNG, null, true);
  }

  if (aGroesse > LEGENDE_SICHTBAR) zeichneKreisgroessenBlock(cx, cy, aussen, aGroesse);

  // Schritte 2 und 3: erst die obere Hälfte, dann die untere (PDF-Seiten 3
  // und 4). Die Klammer ist die Hilfslinie; eine zweite liefe daneben her.
  let klammer = cx - aussen - LEGENDE_KLAMMER_TIEFE;
  let valenz = Math.max(aPos, aNeg);
  if (valenz > LEGENDE_SICHTBAR) {
    legendenStrich(LEGENDE_TINTE_RGB, valenz, () => line(klammer, cy, cx, cy));
  }
  if (aPos > LEGENDE_SICHTBAR) {
    zeichneValenzKlammer(cx, cy, aussen, -1, aPos);
    hinzu(aPos, true, klammer, cy - aussen / 2, LEGENDE_VALENZ.pos, null, false);
  }
  if (aNeg > LEGENDE_SICHTBAR) {
    zeichneValenzKlammer(cx, cy, aussen, 1, aNeg);
    hinzu(aNeg, true, klammer, cy + aussen / 2, LEGENDE_VALENZ.neg, null, false);
  }

  // Stufen 2, 4 und 5 (PDF-Seiten 3, 5 und 6): jede Bandzeile kommt mit dem
  // Band, das sie benennt. Stufe 2 bringt zugleich die Überschrift mit.
  // Klangname in Klammern: die Zeile ist anklickbar und spielt ihn ab. Name
  // und Klang aus einer Quelle (ELEMENT_INSTRUMENTE in sonifikation.js).
  let kategorieZeilen = KREIS_KATEGORIEN.map((kat, i) => {
    let instr = ELEMENT_INSTRUMENTE[kat.key];
    return {
      text: CATEGORY_LABELS[kat.key] + (instr ? ` (${instr.name})` : ''),
      feld: kat.farbe, kategorie: kat.key,
      alpha: [aPos, aMittel, aHell][i],
    };
  });
  // Stufe 6 (PDF-Seite 7) bringt den zweiten Block ganz, mit allen drei Zeilen.
  let fwertZeilen = LEGENDE_FWERT_ZEILEN.map(z => ({ ...z, alpha: aWpos }));

  // Beide Blöcke nebeneinander auf einer Zeile zwischen Kreis und Begleittext
  // — dort, wo die Bänder und Punkte liegen, die sie benennen. Die Breite des
  // zweiten wird auch dann schon eingerechnet, wenn er noch gar nicht sichtbar
  // ist; sonst spränge der erste zur Seite, sobald der zweite dazukommt.
  // Dritte Box unter dem Kategorienblock: sie sagt, dass die Zeilen darüber
  // klingen. Ihr Hinweis trägt keine Marke, steht also ohne Einzug.
  let sonifikationZeilen = [{ text: LEGENDE_SONIFIKATION_HINWEIS, alpha: aPos }];

  let bKat = legendenBlockBreite(LEGENDE_BLOCK_TITEL.kategorien, kategorieZeilen);
  let bFwert = legendenBlockBreite(LEGENDE_BLOCK_TITEL.fwerte, fwertZeilen);
  let bSon = legendenBlockBreite(LEGENDE_BLOCK_TITEL.sonifikation, sonifikationZeilen);
  let blockY = begleittextOben() - blockZeileHoehe();
  // Die Sonifikationsbox kann breiter sein als die beiden darüber — dann
  // richtet sich die Mitte nach ihr, sonst stünde sie rechts heraus.
  let blockX = (width - Math.max(bKat + LEGENDE_BLOCK_LUECKE + bFwert, bSon)) / 2;

  zeichneLegendenBlock(blockX, blockY, LEGENDE_BLOCK_TITEL.kategorien, kategorieZeilen, aPos);
  zeichneLegendenBlock(blockX + bKat + LEGENDE_BLOCK_LUECKE, blockY,
    LEGENDE_BLOCK_TITEL.fwerte, fwertZeilen, aWpos);
  zeichneLegendenBlock(blockX,
    blockY + LEGENDE_TITEL_ABSTAND + 2 * LEGENDE_ZEILE + LEGENDE_BLOCK_ABSTAND,
    LEGENDE_BLOCK_TITEL.sonifikation, sonifikationZeilen, aPos);

  // Stufen 6 bis 8: ein Bogenabschnitt je Wahrnehmung. neutral sitzt rechts,
  // positiv und negativ auf der Klammerseite.
  zeichneWahrnehmungsbogen(cx, cy, aussen,
    { pos: aWpos, neg: aWneg, neutral: aWneutral }).forEach(ring =>
      hinzu(ring.alpha, ring.bucket !== 'neutral', ring.x, ring.y,
        WAHRNEHMUNG_LABELS[ring.bucket],
        `rgba(${FWERT_COLOR_RGB.r}, ${FWERT_COLOR_RGB.g}, ${FWERT_COLOR_RGB.b}, ${ring.alpha})`, true));
  return labels;
}

// fortschritt 0..1 deckt die erfundenen Annotationen auf, alphaSkala blendet
// die ganze Grafik, schritte die neun Legendenstufen (monoton, siehe draw()),
// schleier blendet allein die Beschriftungen wieder aus.
function zeichneDemoKreisgrafik(fortschritt, alphaSkala, schritte, schleier) {
  if (alphaSkala <= 0) return;
  let [, , aPos, aNeg, aMittel, aHell] = schritte;
  let sichtbar = DEMO_ANNOTATIONEN.slice(0, Math.round(fortschritt * DEMO_ANNOTATIONEN.length));
  let { cx, cy, skala } = demoKreisLage();
  // Endradius, nicht der des halb aufgedeckten Kreises: sonst wanderte die
  // ganze Legende mit, während der Kreis heranwächst.
  let aussen = demoEinheitsRadius() * skala;

  if (sichtbar.length) {
    let bandCounts = zaehleBandCounts(sichtbar);
    // winkel PI wie alle anderen Ansichten: positiv oben, negativ unten.
    // Höchstens zwei Stufen überblenden sich, deshalb reicht das Gegenpaar.
    // Nur pos und neg: neutrale Nennungen zeichnet zeichneKreiseFuerRun als
    // Vollkreis, und der legte sich beim Schritt «Anteil negativer Gefühle»
    // als geschlossene Scheibe über beide Hälften. Sie bleiben deshalb in der
    // Schraffur — der Aussenradius zählt sie ohnehin mit, er bleibt stehen.
    const VALENZEN = ['pos', 'neg'];
    let stufe = (kategorien, valenzen, a) => zeichneDemoStufe(cx, cy, bandCounts,
      kategorien, valenzen, alphaSkala * a, skala);
    stufe(0, [], 1 - aPos);
    stufe(1, ['pos'], aPos * (1 - aNeg));
    stufe(1, VALENZEN, aNeg * (1 - aMittel));
    stufe(2, VALENZEN, aMittel * (1 - aHell));
    stufe(3, VALENZEN, aHell);
    // Keine gefüllten F-Wert-Punkte in der Demo: dort stehen die offenen Ringe
    // des Wahrnehmungsbogens für dieselbe Sache und zeigen sie deutlicher.
  }
  zeichneKreisLabels(demoLegende(cx, cy, aussen,
    schritte.map(a => a * alphaSkala * schleier), sichtbar.length > 0));
}

// ---------------------------------------------------------------------------
// Schleier
// ---------------------------------------------------------------------------

// Deckt die ganze Fläche ein. Der Legendenaufbau im Onboarding legt ihn hell
// unter die Legende (LEGENDE_SCHLEIER in sketch.js).
function zeichneSchleier(farbe, alphaSkala) {
  push();
  noStroke();
  drawingContext.globalAlpha = alphaSkala;
  drawingContext.fillStyle = farbe;
  drawingContext.fillRect(0, 0, width, height);
  pop();
}

// Treffer auf einem Klangsymbol der Legende, sonst null. Gilt für jede
// Fassung der Legende: Aufbau im Onboarding wie Registerleiste.
function kategorieZeileGetroffen(mx, my) {
  let treffer = letzteKategorieZeilen.find(z =>
    mx >= z.x0 && mx <= z.x1 && my >= z.y0 && my <= z.y1);
  return treffer ? treffer.kategorie : null;
}

// ---------------------------------------------------------------------------
// Register am unteren Fensterrand (docs/Legende.pdf)
// ---------------------------------------------------------------------------

// Zwei Register nebeneinander, beide fahren von unten aus. «Legende» bringt
// einen flachen Balken mit den fünf Gruppen der Legende, «Info» fährt über die
// ganze Seite und trägt am Ende den Projekttext (#projekttext im DOM).
const LEISTE_HOEHE = 158;           // Höhe des offenen Legendenbalkens
const LEISTE_RAND = 26;             // Innenabstand links und rechts
const LEISTE_OBEN = 24;             // Oberkante des Balkens zur ersten Zeile
const LEISTE_LUECKE = 42;           // Luft zwischen den Gruppen
// Jeder Reiter ist so breit, wie sein Wort braucht: Rand, Beschriftung, Luft,
// Doppelpfeil, Rand. Gemessen an der eigenen Schrift, damit kein Wortmass fest
// im Code steht — «LEGENDE» ergibt so 106 px, «INFO» 81 px.
const LEISTE_REITER_RAND = 14;      // vor der Beschriftung
const LEISTE_REITER_LUFT = 10;      // zwischen Beschriftung und Pfeil
const LEISTE_REITER_PFEIL = 10;     // Breite des Doppelpfeils
const LEISTE_REITER_RAND_R = 19;    // hinter dem Pfeil
const LEISTE_REITER_H = 30;
const LEISTE_REITER_LUECKE = 6;     // Fuge zwischen den beiden Reitern
const LEISTE_REITER_INFO = 'Info';  // Beschriftung des zweiten Registers
const LEISTE_GRUND = hexZuRgb('#E2E6E1');
// Der Projekttext liegt dunkel auf, damit die helle Serifenschrift trägt —
// im selben Blaugrau wie die Legendentinte und das Kapitelmenü.
const INFO_GRUND = '#3A5058';
const INFO_ALPHA = 0.94;
// Schrift des offenen Reiters, wie .kapitel-register-item.aktiv in style.css.
const LEISTE_AKTIV_TINTE = hexZuRgb('#C6D2D7');
const LEISTE_KREIS_R = 34;          // Beispielkreis der Gruppe «Kreisgrösse»
const LEISTE_VALENZ_R = 30;         // Halbkreise der Gruppe «Anteil»
const LEISTE_WAHRNEHMUNG_R = 12;    // Kreis des Wahrnehmungsbogens
const LEISTE_BOGEN_ABSTAND = 18;    // enger als im Vollbild, der Balken ist flach
const LEISTE_RING_R = 4.5;          // die drei offenen Ringe auf dem Bogen

let letzteReiterLagen = [];

// Wie weit der Legendenbalken gerade ins Bild ragt; der Massstab rückt darüber.
function legendenLeisteHoehe(aus) { return LEISTE_HOEHE * aus; }

// Oberkante des Legendenbalkens — darauf sitzen beide Reiter, auch der von
// «Info», der seine eigene Fläche gar nicht kennt. Eingeklappt also direkt am
// unteren Fensterrand, über der Fortschrittsleiste (zeichneScrollFortschritt
// in kartendekor.js läuft davor).
function leisteOberkante(legendeAus) { return height - LEISTE_HOEHE * legendeAus; }

// Wie weit die Register vom unteren Rand her Platz belegen: der Balken und die
// Reiter darüber. Das Kapitelmenü wird daran abgeschnitten (siehe draw() in
// sketch.js), damit es weder auf dem Balken noch auf einem Reiter steht.
function registerHoehe(legendeAus) { return LEISTE_HOEHE * legendeAus + LEISTE_REITER_H; }

// Reiter mit Doppelpfeil. Beide sitzen rechts auf der Oberkante des
// Legendenbalkens, eingeklappt also direkt am unteren Fensterrand.
function reiterBreite(titel) {
  return LEISTE_REITER_RAND + beschriftungsBreite(titel) + LEISTE_REITER_LUFT
    + LEISTE_REITER_PFEIL + LEISTE_REITER_RAND_R;
}

// Der offene Reiter steht negativ da, wie ein aktives Kapitel im Menü: dunkle
// Platte, helle Schrift. negativ = true heisst, die dunkle Fläche liegt schon
// darunter (der Info-Reiter auf seiner eigenen) — dann entfällt die Platte,
// sonst zeichnete sie sich mit voller Deckung als Rechteck darauf ab.
function zeichneReiter(name, x, oben, titel, breite, offen, negativ = false) {
  let mitte = oben - LEISTE_REITER_H / 2;
  let tinte = (offen || negativ) ? LEISTE_AKTIV_TINTE : LEGENDE_TINTE_RGB;
  letzteReiterLagen.push({ name, x0: x, y0: oben - LEISTE_REITER_H, x1: x + breite, y1: oben });
  push();
  noStroke();
  if (!negativ) {
    let grund = offen ? LEGENDE_TINTE_RGB : LEISTE_GRUND;
    fill(grund.r, grund.g, grund.b);
    rect(x, oben - LEISTE_REITER_H, breite, LEISTE_REITER_H);
  }
  fill(tinte.r, tinte.g, tinte.b);
  beschriftungsSchrift(LABEL_GROESSE);
  textAlign(LEFT, CENTER);
  text(titel, x + LEISTE_REITER_RAND, mitte);
  // Doppelpfeil: zeigt nach unten zum Einklappen, nach oben zum Aufklappen.
  let px = x + breite - LEISTE_REITER_RAND_R - LEISTE_REITER_PFEIL / 2, r = offen ? 1 : -1;
  stroke(tinte.r, tinte.g, tinte.b);
  strokeWeight(1.6);
  noFill();
  [-3, 2].forEach(v => {
    line(px - 5, mitte + v * r - 1 * r, px, mitte + v * r + 3 * r);
    line(px, mitte + v * r + 3 * r, px + 5, mitte + v * r - 1 * r);
  });
  pop();
}

// Gruppe 2: leerer Beispielkreis mit dem Kreisgrössen-Text daneben.
function leisteKreisgroesse(x, mitte) {
  push();
  noFill();
  stroke(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b);
  strokeWeight(1);
  circle(x + LEISTE_KREIS_R, mitte, LEISTE_KREIS_R * 2);
  noStroke();
  fill(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b);
  beschriftungsSchrift(LABEL_GROESSE);
  textAlign(LEFT, CENTER);
  let tx = x + LEISTE_KREIS_R * 2 + 18;
  let oben = mitte - (LEGENDE_KREISGROESSE.length - 1) * LEGENDE_TEXTZEILE / 2;
  LEGENDE_KREISGROESSE.forEach((z, i) => text(z, tx, oben + i * LEGENDE_TEXTZEILE));
  pop();
  return LEISTE_KREIS_R * 2 + 18 + Math.max(...LEGENDE_KREISGROESSE.map(beschriftungsBreite));
}

// Gruppe 3: die beiden Valenzhälften, jede in einem gestrichelten Kasten.
function leisteValenz(x, mitte) {
  let cx = x + LEISTE_VALENZ_R;
  let oben = LEISTE_VALENZ_R, unten = LEISTE_VALENZ_R * 0.72;
  push();
  noStroke();
  fill(150, 150, 150);
  arc(cx, mitte, oben * 2, oben * 2, PI, TWO_PI, OPEN);
  arc(cx, mitte, unten * 2, unten * 2, 0, PI, OPEN);
  pop();
  legendenStrich(LEGENDE_TINTE_RGB, 1, () => {
    rect(cx - oben, mitte - oben, oben * 2, oben);
    rect(cx - unten, mitte, unten * 2, unten);
    line(cx - oben, mitte, cx + oben, mitte);
  });
  push();
  noStroke();
  fill(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b);
  beschriftungsSchrift(LABEL_GROESSE);
  textAlign(LEFT, CENTER);
  let tx = cx + oben + 16;
  text(LEGENDE_VALENZ.pos, tx, mitte - oben / 2);
  text(LEGENDE_VALENZ.neg, tx, mitte + unten / 2);
  pop();
  return oben * 2 + 16 + Math.max(beschriftungsBreite(LEGENDE_VALENZ.pos), beschriftungsBreite(LEGENDE_VALENZ.neg));
}

// Gruppe 5: der Wahrnehmungsbogen mit seinen drei Ringpunkten, beschriftet.
function leisteWahrnehmung(x, mitte) {
  let breit = Math.max(...Object.values(WAHRNEHMUNG_LABELS).map(beschriftungsBreite));
  let bogen = LEISTE_WAHRNEHMUNG_R + LEISTE_BOGEN_ABSTAND;
  let cx = x + breit + 24 + bogen;
  let ringe = zeichneWahrnehmungsbogen(cx, mitte, LEISTE_WAHRNEHMUNG_R,
    { pos: 1, neg: 1, neutral: 1 }, LEISTE_BOGEN_ABSTAND, LEISTE_RING_R);
  push();
  noStroke();
  beschriftungsSchrift(LABEL_GROESSE);
  ringe.forEach(ring => {
    let links = ring.x < cx;
    textAlign(links ? RIGHT : LEFT, CENTER);
    fill(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b);
    let lx = links ? ring.x - 12 : ring.x + 12;
    text(WAHRNEHMUNG_LABELS[ring.bucket], lx, ring.y);
    legendenStrich(FWERT_COLOR_RGB, 1, () => line(links ? lx + 3 : ring.x + 3, ring.y, links ? ring.x - 3 : lx - 3, ring.y));
  });
  pop();
  return breit * 2 + 48 + bogen * 2;
}

// Der ganze Balken, aus 0..1 ausgefahren, mit seinem Reiter auf der Oberkante.
// Der Inhalt fährt mit hinaus und wird solange vom Fensterrand beschnitten;
// die Klickfläche merkt sich zeichneReiter(). sichtbar false heisst: das
// Register gibt es hier noch nicht (siehe draw() in sketch.js).
function zeichneRegisterleiste(aus, sichtbar) {
  letzteReiterLagen = [];
  if (!sichtbar) return;
  let oben = leisteOberkante(aus);
  if (aus > LEGENDE_SICHTBAR) {
    push();
    noStroke();
    fill(LEISTE_GRUND.r, LEISTE_GRUND.g, LEISTE_GRUND.b);
    rect(0, oben, width, LEISTE_HOEHE);
    pop();

    let mitte = oben + LEISTE_OBEN + (LEISTE_HOEHE - LEISTE_OBEN * 2) / 2;
    let blockY = oben + LEISTE_OBEN;
    let kategorieZeilen = KREIS_KATEGORIEN.map(kat => {
      let instr = ELEMENT_INSTRUMENTE[kat.key];
      return {
        text: CATEGORY_LABELS[kat.key] + (instr ? ` (${instr.name})` : ''),
        feld: kat.farbe, kategorie: kat.key, alpha: 1,
      };
    });
    let fwertZeilen = LEGENDE_FWERT_ZEILEN.map(z => ({ ...z, alpha: 1 }));

    let x = LEISTE_RAND;
    zeichneLegendenBlock(x, blockY, LEGENDE_BLOCK_TITEL.kategorien, kategorieZeilen, 1);
    x += legendenBlockBreite(LEGENDE_BLOCK_TITEL.kategorien, kategorieZeilen) + LEISTE_LUECKE;
    x += leisteKreisgroesse(x, mitte) + LEISTE_LUECKE;
    x += leisteValenz(x, mitte) + LEISTE_LUECKE;

    // Senkrechte Trennlinie zwischen den beiden Hälften, wie im PDF.
    push();
    stroke(LEGENDE_TINTE_RGB.r, LEGENDE_TINTE_RGB.g, LEGENDE_TINTE_RGB.b);
    strokeWeight(2);
    line(x, oben + LEISTE_OBEN, x, oben + LEISTE_HOEHE - LEISTE_OBEN);
    pop();
    x += LEISTE_LUECKE;

    zeichneLegendenBlock(x, blockY, LEGENDE_BLOCK_TITEL.fwerte, fwertZeilen, 1);
    x += legendenBlockBreite(LEGENDE_BLOCK_TITEL.fwerte, fwertZeilen) + LEISTE_LUECKE;
    leisteWahrnehmung(x, mitte);
  }
  // Nur der eigene Reiter; den von «Info» zeichnet zeichneInfoLeiste, weil er
  // über der Fläche liegen muss.
  let titel = LEGENDE_UNTERTITEL.toUpperCase(), breite = reiterBreite(titel);
  zeichneReiter('legende', infoReiterX() - breite - LEISTE_REITER_LUECKE, oben,
    titel, breite, aus > 0.5);
}

// Linke Kante des Info-Reiters; er steht rechtsbündig, der Legendenreiter
// hängt sich links an ihn.
function infoReiterX() {
  return width - LEISTE_RAND - reiterBreite(LEISTE_REITER_INFO.toUpperCase());
}

// «Info» fährt über die ganze Seite: eine dunkle Fläche von unten herauf, auf
// der am Ende der Projekttext steht (siehe draw() in sketch.js). Zuletzt
// gezeichnet, sie deckt den Legendenreiter zu — der eigene Reiter kommt danach
// obendrauf und erscheint dort negativ, damit die Fläche wieder zugeht.
function zeichneInfoLeiste(aus, legendeAus) {
  let offen = aus > LEGENDE_SICHTBAR;
  if (offen) {
    push();
    noStroke();
    drawingContext.globalAlpha = INFO_ALPHA;
    drawingContext.fillStyle = INFO_GRUND;
    drawingContext.fillRect(0, height - height * aus, width, height * aus);
    pop();
    letzteReiterLagen = []; // der Legendenreiter liegt jetzt darunter
  }
  let titel = LEISTE_REITER_INFO.toUpperCase();
  zeichneReiter('info', infoReiterX(), leisteOberkante(legendeAus), titel,
    reiterBreite(titel), offen, offen);
}

// Name des getroffenen Reiters («legende» oder «info»), sonst null.
function reiterGetroffen(mx, my) {
  let l = letzteReiterLagen.find(r => mx >= r.x0 && mx <= r.x1 && my >= r.y0 && my <= r.y1);
  return l ? l.name : null;
}


// --- Export ------------------------------------------------------------
// Dreizehn Namen. Leser: docs/architektur.md.
window.leereBandCounts = leereBandCounts;
window.zeichneSchleier = zeichneSchleier;
window.zeichneKreisLabels = zeichneKreisLabels;
window.zeichneKreiseOrtRuns = zeichneKreiseOrtRuns;
window.zeichneKreiseFuerRun = zeichneKreiseFuerRun;
window.zeichneFwertPunkte = zeichneFwertPunkte;
window.zeichneDemoKreisgrafik = zeichneDemoKreisgrafik;
window.kategorieZeileGetroffen = kategorieZeileGetroffen;
window.zeichneRegisterleiste = zeichneRegisterleiste;
window.zeichneInfoLeiste = zeichneInfoLeiste;
window.reiterGetroffen = reiterGetroffen;
window.legendenLeisteHoehe = legendenLeisteHoehe;
window.registerHoehe = registerHoehe;

})(); // Ende der Modulkapselung, siehe Kommentar oben
