/* =============================================================================
   kreisgrafik.js — Die Kreisdiagramme der Orte

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Das
   Bildzeichen des ganzen Projekts: An jedem Ort steht ein Kreis, dessen
   Grösse zählt, wie oft er erwähnt wird, und dessen Form zeigt, wie er
   empfunden wird.

   Zwei Ebenen je Kreis, jede nach Radius sortiert (grösste zuunterst):
     unten  schraffierte Gesamtkreise je Kategorie (alle Erwähnungen,
            auch neutrale und unbewertete)
     oben   vollflächige Valenzformen — Halbkreis für negativ/positiv,
            ganzer Kreis für neutral
   Aussen herum die F-Wert-Punkte: je Annotation mit F-Wert ein eigener Punkt,
   gruppiert in 120°-Dritteln auf der Seite seiner Valenz, bei Bedarf in
   mehreren Ringen.

   Die Winkel-Konvention ist bewusst NICHT an die Laufrichtung der Route
   gebunden: In Karten- ("Plan") wie Graph-Ansicht teilt dieselbe waagrechte
   Linie positiv (oben) von negativ (unten) — beide Ansichten zeigen
   dieselben Kreise und sollen sich gleich lesen lassen. Nur der Schlussakt
   Ortsveränderung (ortsveraenderung.js) teilt weiterhin senkrecht (negativ
   links, positiv rechts), weil dort unter jedem Kreis Beschriftung und
   Kapitelzeile stehen. Steuerung über den winkel-Parameter von
   zeichneKreiseFuerRun() bzw. anordnung von zeichneFwertPunkte().

   --- Abhängigkeiten NACH AUSSEN (Laufzeit) --------------------------------
   aus datenbereinigung.js (15): KREIS_KATEGORIEN, kreisRadius,
     groessterKreisRadius, FWERT_PUNKTGROESSE,
     FWERT_PUNKT_FARBE, hexZuRgb, zaehleAnnotationenLiveNachOrtBasis,
     sammleAnnotationenNachOrtBasis, wohnungFilterFuerOrt, wohnungSplitAi,
     istVorzeitigeErwaehnung, WOHNUNG_SAMMELPUNKT_ANKER,
     WOHNUNG_SAMMELPUNKT_ABSORBIERTE_ORTRUNS, GEDANKEN_ORTRUN_UNTERDRUECKT,
     RUE_NOTRE_DAME_DE_LORETTE_ORT
   aus geo-projektion.js (3): lonLatToScreen, mapOffsetX, mapOffsetY
   aus sketch.js (2): stationenData, kapitel1ZoomAmount (blendet das
     Startpunkt-Label ein)
   aus p5: Zeichen- und Text-API, drawingContext

   --- ACHTUNG: Auswertung beim LADEN ---------------------------------------
   const FWERT_PUNKT_FARBE_RGB = hexZuRgb(FWERT_PUNKT_FARBE);
   Diese Zeile ruft eine fremde Funktion beim Laden auf. Diese Datei MUSS
   deshalb nach datenbereinigung.js stehen — sonst ReferenceError. Sie ist der
   einzige nicht-literale Top-Level-Initialisierer hier.

   --- Wer von aussen hierher greift ----------------------------------------
   sketch.js              zeichneKreiseOrtRuns (Kapitel-1-Route und Kapitel-Zoom)
   ortsveraenderung.js    zeichneKreiseFuerRun, zeichneFwertPunkte, leereBandCounts
   spine-horizontal.js    zeichneKreiseFuerRun, zeichneFwertPunkte
   dom-aufbau.js          FWERT_PUNKT_DURCHMESSER (Legendenaufbau)

   Damit ist dies nach geo-projektion.js die zweite gemeinsame Grundlage
   mehrerer Module — es steht in index.html entsprechend weit vorne.
============================================================================= */

// Zeilenabstand der Schraffur in den Gesamtkreisen (siehe drawHatchedCircle).
const HATCH_SPACING = 3;

// ---------------------------------------------------------------------------
// Kreise
// ---------------------------------------------------------------------------

function drawHatchedCircle(cx, cy, r, color, alphaSkala = 1) {
  if (r <= 0) return;
  const ctx = drawingContext;
  ctx.save();
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
  ctx.restore();
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
    if (punktIndex < r.revealIndex) return;
    if (istVorzeitigeErwaehnung(r, daten)) return;
    // Die folgenden drei Ausnahmen gehören zu Kapitel-1-eigenen Mechanismen
    // (Gedanken-Spalte, Wohnung/Rue-Notre-Dame-Split) und dürfen nur dort
    // greifen: sie sind reine Namens-Sets ohne Kapitelbezug, und mehrere
    // automatisch gebaute Kapitel (z.B. Kapitel 3) verwenden zufällig
    // denselben ortBasis-Namen (z.B. "Parc Monceau") für einen eigenen,
    // echten Ort — ohne diesen Kapitel-1-Filter würde dessen Kreis
    // faelschlich komplett unterdrückt.
    if (daten === stationenData) {
      if (WOHNUNG_SAMMELPUNKT_ABSORBIERTE_ORTRUNS.has(r.ort)) return;
      if (GEDANKEN_ORTRUN_UNTERDRUECKT.has(r.ort)) return;
      if (r.ort === RUE_NOTRE_DAME_DE_LORETTE_ORT && annIndex < wohnungSplitAi(daten)) return;
    }
    // Alle ortRuns wachsen live mit annIndex (nicht nur die Hauptorte) —
    // so löst wirklich jede Annotation irgendwo auf der Karte eine
    // sichtbare Änderung aus, statt dass Nebenerwähnungen als fertiger,
    // fest vorberechneter Kreis auf einmal aufploppen.
    let pos = lonLatToScreen(r.lon, r.lat, activeBbox, offsetX, offsetY);
    let filter = wohnungFilterFuerOrt(r.ort);
    let bandCounts = zaehleAnnotationenLiveNachOrtBasis(filter, annIndex, daten);
    // Winkel PI und Anordnung 'obenUnten' — dieselbe Aufteilung wie in der
    // Graph-Ansicht (siehe zeichneSpineHorizontal): positiv oben, negativ
    // unten, F-Wert-Punkte entsprechend. Die Kartenansicht ("Plan") und die
    // Graph-Ansicht zeigen dieselben Kreise; stünden die Halbkreise hier
    // links/rechts und dort oben/unten, müsste man beim Umschalten die
    // Bildsprache neu lesen.
    let radius = groessterKreisRadius(bandCounts);
    zeichneKreiseFuerRun(pos.x, pos.y, bandCounts, 1, PI);
    let fwertAnnotationen = sammleAnnotationenNachOrtBasis(filter, annIndex, daten).filter(a => a.hasFwert);
    zeichneFwertPunkte(pos.x, pos.y, radius, fwertAnnotationen, 1, 'obenUnten');
    if (radius > 0) {
      // Label mit demselben Begriff wie in der Spine (r.ort) — erst
      // sammeln, Kollisionen erst nach der Schleife auflösen (siehe
      // zeichneKreisLabels), da sich mehrere Kreise dieselbe Koordinate
      // teilen können (z.B. Aussenraum/Innenraum-Paare).
      // Der Kreis des Routen-Startpunkts ("Lokal in der Nähe der Rue
      // Notre-Dame de Lorette", revealIndex 0) ist schon auf der Startseite
      // zu sehen — seine Beschriftung soll dort aber noch fehlen und erst
      // mit dem Kapitel-1-Kartenausschnitt einblenden. Deckkraft daher am
      // Zoomstand (kapitel1ZoomAmount) statt fest 1. Farbe wie alle anderen
      // Labels (#212B2E); vorher stand hier fest #9DA69D.
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

// Zeichnet die Kreis-Labels und löst dabei Überlagerungen auf: Kandidaten
// (sortiert von oben nach unten) werden nacheinander platziert, ein Label
// wird nach unten versetzt, sobald es die Bounding-Box eines bereits
// platzierten Labels überlappen würde (z.B. bei Aussenraum/Innenraum-Paaren,
// die dieselbe Koordinate teilen). Bei nennenswertem Versatz zeigt eine
// gestrichelte Linie an, zu welchem Kreis das Label gehört.
function zeichneKreisLabels(kandidaten) {
  // Vollständig transparente Kandidaten (alpha 0, z.B. der Routen-Startpunkt
  // auf der Startseite) fallen ganz raus — sie sollen auch keinen Platz im
  // Kollisions-Layout belegen und keine Hilfslinie ziehen.
  kandidaten = kandidaten.filter(k => (k.alpha === undefined ? 1 : k.alpha) > 0.002);
  if (kandidaten.length === 0) return;

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
      // Direkt statt über fill() — siehe zeichneOrtsveraenderung: p5s
      // Füllfarben-Zwischenspeicher wird von den direkt gesetzten
      // fillStyle-Zuweisungen in zeichneKreiseFuerRun/zeichneFwertPunkte
      // umgangen und liefert sonst die zuletzt dort gesetzte Farbe.
      drawingContext.fillStyle = k.farbe
        ? k.farbe
        : `rgba(33, 43, 46, ${alpha})`;
      // p5s text() bleibt hier während des Scrollens (viele Frames/Sekunde,
      // wechselnde Werte) manchmal unsichtbar, obwohl der Canvas-Context
      // nachweislich korrekt gesetzt ist (siehe zeichneSpineHorizontal,
      // gleicher Bug/Workaround) — direkt über den Canvas-Context gezeichnet,
      // fillStyle kommt schon vom fill()-Aufruf oben.
      drawingContext.fillText(k.text, k.x, y);
    });
}

// Vollflächiger Halbkreis (PIE-Modus über exakt 180°, daher ohne sichtbaren
// Keil-Rand — die beiden Radiuslinien am Rand liegen genau gegenüber und
// bilden zusammen den Durchmesser). winkelMitte = Bildschirm-Winkel der
// Mitte der Wölbung (p5-Konvention: 0 = rechts, wächst im Uhrzeigersinn).
// Deckkraft (0.75) und Multiply-Blend wie im alten Entwurf
// (kapitel01-embed.js/addBand) — blend=true für gold_hell/gold_dunkel,
// blend=false (normale, deckende Basis) für gold_mittel; siehe Aufrufer.
// p5s arc()/ellipse() bleiben bei laufender Animation (viele Frames/
// Sekunde, wechselnde Werte) manchmal unsichtbar, obwohl alle Canvas-
// Context-Eigenschaften (fillStyle/globalAlpha/composite) nachweislich
// korrekt gesetzt sind — derselbe Bug wie bei p5s text(), siehe
// zeichneSpineHorizontal. Beide Formen deshalb direkt über den
// Canvas-Context gezeichnet statt über p5s arc()/ellipse().
function zeichneHalbkreis(cx, cy, r, winkelMitte, farbeRgb, alphaSkala = 1, blend = false) {
  if (r <= 0) return;
  let ctx = drawingContext;
  if (blend) ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${farbeRgb[0]}, ${farbeRgb[1]}, ${farbeRgb[2]}, ${0.75 * alphaSkala})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, winkelMitte - HALF_PI, winkelMitte + HALF_PI);
  ctx.closePath();
  ctx.fill();
  if (blend) ctx.globalCompositeOperation = 'source-over';
}

// Vollflächiger Kreis für neutrale Valenz — dieselbe Deckkraft/Blend-Logik
// wie zeichneHalbkreis (s.o.), aber als ganze Fläche statt Halbkreis:
// neutral hat keine Links/Rechts- bzw. Oben/Unten-Seite wie neg/pos.
function zeichneVollkreis(cx, cy, r, farbeRgb, alphaSkala = 1, blend = false) {
  if (r <= 0) return;
  let ctx = drawingContext;
  if (blend) ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${farbeRgb[0]}, ${farbeRgb[1]}, ${farbeRgb[2]}, ${0.75 * alphaSkala})`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TWO_PI);
  ctx.fill();
  if (blend) ctx.globalCompositeOperation = 'source-over';
}

// winkel: feste (NICHT von der Routenrichtung abgeleitete) Basis für die
// Aufteilung der Valenz-Halbkreise, siehe unten. Karten- ("Plan", siehe
// zeichneKreiseOrtRuns) und Graph-Ansicht (zeichneSpineHorizontal) übergeben
// beide PI ("nach links ausgerichtet") für pos=oben/neg=unten — dieselben
// Kreise sollen sich in beiden Ansichten gleich lesen lassen, und bei einer
// Reihe nebeneinander liegender Spine-Kreise würde eine Links/Rechts-Teilung
// benachbarte Kreise gegenseitig überlappen. Der Default -HALF_PI ("nach oben
// ausgerichtet", neg=links/pos=rechts) bleibt für den Schlussakt
// Ortsveränderung, wo unter jedem Kreis Beschriftung und Kapitelzeile stehen.
// radiusSkala/maxRadius: nur die Ortsveränderung nutzt sie (siehe
// zeichneOrtsveraenderung) — dort werden die Radien ohne Deckel berechnet und
// danach gemeinsam so weit verkleinert, dass die senkrecht gestaffelten Kreise
// ins Fenster passen. Die Skalierung greift am fertigen Radius, nicht über
// eine Canvas-Transformation: so behalten Schraffur-Abstand und Strichstärken
// ihre normale Grösse.
// Rückgabewert: keiner. Wer die Grösse des Kreises braucht, holt sie mit
// groessterKreisRadius(bandCounts, maxRadius, radiusSkala) — derselben
// Funktion, die auch hier intern läuft. Deren beide letzte Parameter stehen
// in UMGEKEHRTER Reihenfolge zu denen hier. Vorher gab zeichneKreiseFuerRun()
// den Radius zurück; das machte ihn nur beim Zeichnen verfügbar und zwang
// vier Stellen dazu, die Formel nachzubauen.
function zeichneKreiseFuerRun(cx, cy, bandCounts, alphaSkala = 1, winkel = -HALF_PI, radiusSkala = 1, maxRadius = 100) {
  // Zwei Ebenen, jede für sich nach Radius geordnet (kleinste zuoberst,
  // mittlere danach, grösste zuunterst): unten die schraffierten
  // Gesamt-Kreise (neg+pos+neutral+unrated) der 3 Kategorien, darüber die
  // flächigen Valenz-Formen (neg/pos als Halbkreis, neutral als ganzer
  // Kreis). Die Ebenen selbst bleiben in dieser Reihenfolge FEST (schraffiert
  // immer unten) — sonst könnte eine flächenmässig kleinere Schraffur einer
  // Kategorie eine grössere Valenz-Fläche einer ANDEREN Kategorie zudecken,
  // die Kreisgrafik wirkte dann unvollständig (schraffiert statt farbig).
  let hatchFormen = [];
  let flaechenFormen = [];
  // Aussenradius vorab, nicht mehr nebenbei in der Schleife: dieselbe
  // Funktion, die auch die Aufrufer benutzen, wenn sie die Grösse VOR dem
  // Zeichnen brauchen (groessterKreisRadius in datenbereinigung.js).
  let aussenRadius = groessterKreisRadius(bandCounts, maxRadius, radiusSkala);

  KREIS_KATEGORIEN.forEach(k => {
    let bc = bandCounts[k.key] || {};
    let n = (bc.neg || 0) + (bc.pos || 0) + (bc.neutral || 0) + (bc.unrated || 0);
    let hatchR = kreisRadius(n, maxRadius) * radiusSkala;
    if (hatchR > 0) {
      let hex = '#' + k.farbe.map(v => v.toString(16).padStart(2, '0')).join('');
      hatchFormen.push({ r: hatchR, zeichne: () => drawHatchedCircle(cx, cy, hatchR, hex, alphaSkala) });
    }

    // blend=true (Multiply) für gold_hell/gold_dunkel, blend=false (normale,
    // deckende Fläche) für gold_mittel — wie im alten Entwurf
    // (kapitel01-embed.js/addBand). winkel bewusst NICHT an die lokale
    // Laufrichtung der Route angelehnt, sondern fest: die Trennlinie
    // zwischen neg/pos dreht sich nie mit der Route mit. Karten- wie
    // Graph-Ansicht (winkel PI): positiv oben, negativ unten. Nur die
    // Ortsveränderung nutzt den Default -HALF_PI: negativ links, positiv
    // rechts.
    let blend = k.key !== 'gold_mittel';
    let negR = kreisRadius(bc.neg || 0, maxRadius) * radiusSkala;
    let posR = kreisRadius(bc.pos || 0, maxRadius) * radiusSkala;
    let neutralR = kreisRadius(bc.neutral || 0, maxRadius) * radiusSkala;
    if (negR > 0) flaechenFormen.push({ r: negR, zeichne: () => zeichneHalbkreis(cx, cy, negR, winkel - HALF_PI, k.farbe, alphaSkala, blend) });
    if (posR > 0) flaechenFormen.push({ r: posR, zeichne: () => zeichneHalbkreis(cx, cy, posR, winkel + HALF_PI, k.farbe, alphaSkala, blend) });
    // Neutrale Valenz: ganzer flächiger Kreis statt Halbkreis — hat keine
    // Links/Rechts- bzw. Oben/Unten-Seite wie neg/pos.
    if (neutralR > 0) flaechenFormen.push({ r: neutralR, zeichne: () => zeichneVollkreis(cx, cy, neutralR, k.farbe, alphaSkala, blend) });
  });

  hatchFormen.sort((a, b) => b.r - a.r).forEach(f => f.zeichne());
  flaechenFormen.sort((a, b) => b.r - a.r).forEach(f => f.zeichne());

  if (aussenRadius > 0) {
    // p5s ellipse() bleibt bei laufender Animation manchmal unsichtbar,
    // siehe zeichneHalbkreis — direkt über den Canvas-Context gezeichnet.
    drawingContext.fillStyle = `rgba(0, 0, 0, ${alphaSkala})`;
    drawingContext.beginPath();
    drawingContext.arc(cx, cy, 4, 0, TWO_PI);
    drawingContext.fill();
  }
}

// Pixel-Durchmesser je F-Wert-Punktgrösse (1..3, siehe FWERT_PUNKTGROESSE in
// datenbereinigung.js), sowie Ring-/Randabstände für zeichneFwertPunkte.
const FWERT_PUNKT_DURCHMESSER = { 1: 5, 2: 7.5, 3: 10 };
const FWERT_PUNKT_FARBE_RGB = hexZuRgb(FWERT_PUNKT_FARBE);
const FWERT_PUNKT_RAND_ABSTAND = 6; // Luft zwischen Kreisrand und erstem Punkte-Ring
const FWERT_PUNKT_RING_ABSTAND = 8; // Abstand zwischen zwei Punkte-Ringen, falls ein Drittel nicht in einen Ring passt

// F-Wert-Punkte ausserhalb des Kreisdiagramms: jede Annotation mit F-Wert
// (a.hasFwert) bekommt hier — anders als die aggregierten bandCounts — einen
// EIGENEN Punkt. Grösse nach F-Wert-Typ (FWERT_PUNKTGROESSE: 1 Raum löst
// Emotion aus, 2 Emotion färbt Raum, 3 Körper als Sensor), Farbe einheitlich
// (FWERT_PUNKT_FARBE). Position: eines von drei 120°-Dritteln rund um den
// Kreis, auf derselben Seite wie der Valenz-Halbkreis derselben Bewertung
// (siehe anordnung unten und zeichneKreiseFuerRun).
// Reichen die Punkte eines Drittels nicht auf einen Bogen, wachsen
// weitere, weiter aussen liegende Ringe nach (z.B. "Cannes", Kapitel 8, mit
// 87 F-Wert-Annotationen an einem einzigen Ort).
function zeichneFwertPunkte(cx, cy, radius, fwertAnnotationen, alphaSkala = 1, anordnung = 'seitlich') {
  if (!fwertAnnotationen.length || radius <= 0) return;

  const DRITTEL = TWO_PI / 3;
  // Gruppenmitten [negativ, positiv, neutral/unbewertet] je Anordnung. Sie
  // folgen der Teilung der Halbkreise in zeichneKreiseFuerRun, damit die
  // Punkte einer Valenz auf DERSELBEN Seite liegen wie ihre Fläche:
  //   'seitlich' (Ortsveränderung, Halbkreise links/rechts): negativ
  //     oben-links, positiv oben-rechts, neutral unten — die beiden
  //     Valenz-Gruppen liegen als Drittel-Paar symmetrisch um die Senkrechte.
  //   'obenUnten' (Karte UND Graph, Halbkreise oben/unten): positiv GENAU oben,
  //     negativ GENAU unten, neutral rechts daneben. Hier lassen sich die
  //     Mitten nicht aus einer gemeinsamen Drehung ableiten — oben und unten
  //     liegen 180° auseinander, drei gleiche Drittel aber nur 120°. Darum
  //     stehen sie hier fest, statt wie bei 'seitlich' aus einem Winkel
  //     berechnet zu werden.
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

      // Etwas schmaler als das volle Drittel verteilt, damit Punkte an der
      // Drittel-Grenze nicht ins Nachbar-Drittel hineinragen.
      let spanne = DRITTEL * 0.8;
      let n = ringFormen.length;
      ringFormen.forEach((f, i) => {
        let winkelPunkt = n === 1 ? mitte : mitte - spanne / 2 + (i / (n - 1)) * spanne;
        let x = cx + Math.cos(winkelPunkt) * ringRadius;
        let y = cy + Math.sin(winkelPunkt) * ringRadius;
        // p5s ellipse() bleibt bei laufender Animation manchmal unsichtbar,
        // siehe zeichneHalbkreis — direkt über den Canvas-Context gezeichnet.
        drawingContext.fillStyle = `rgba(${f.rgb.r}, ${f.rgb.g}, ${f.rgb.b}, ${alphaSkala})`;
        drawingContext.beginPath();
        drawingContext.arc(x, y, f.d / 2, 0, TWO_PI);
        drawingContext.fill();
      });

      ringRadius += FWERT_PUNKT_RING_ABSTAND;
    }
  });
}
