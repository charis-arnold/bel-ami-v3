/* =============================================================================
   kreisgrafik.js — Die Kreisdiagramme der Orte

   Je Ort ein Kreis: Grösse zählt die Erwähnungen, Form zeigt die Valenz.
   Unten schraffierte Gesamtkreise je Kategorie, darüber die Valenzflächen
   (Halbkreis neg/pos, Vollkreis neutral), aussen herum ein F-Wert-Punkt je
   Annotation. Winkel-Konvention und Abhängigkeiten: docs/architektur.md.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 32 von 42 Namen intern, 10 exportiert. Konvention: docs/architektur.md.
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

// Zeilenmass der Kreis-Labels; zeichneKreisLabels rutscht damit aus, die
// Erklärungs-Ebene rechnet damit ihren Platzbedarf aus.
const LABEL_HOEHE = 14;
const LABEL_ABSTAND = 4;

// Die echten Ortskreise dieses Frames — Grundlage der Erklärungs-Ebene, die
// sich an den grössten davon hängt. frameCount setzt die Liste selbst
// zurück, damit kein Aufrufer daran denken muss.
let gezeichneteKreise = [];
let kreisRegisterFrame = -1;

function merkeKreis(cx, cy, bandCounts, radius, fwertPunkte, skala = 1, maxRadius = 100) {
  if (kreisRegisterFrame !== frameCount) { gezeichneteKreise = []; kreisRegisterFrame = frameCount; }
  if (radius > 0) gezeichneteKreise.push({ cx, cy, bandCounts, radius, fwertPunkte, skala, maxRadius });
}

// Ein background()-Aufruf übermalt den bisherigen Frame — was vorher
// gemerkt wurde, ist nicht mehr zu sehen.
function vergissGezeichneteKreise() {
  gezeichneteKreise = [];
  kreisRegisterFrame = frameCount;
}

// Dämpft nur die neutrale Vollfläche, damit sie leiser wirkt als die
// Valenz-Halbkreise. Schraffur wäre mit den Gesamtkreisen verwechselbar.
const NEUTRAL_DAEMPFUNG = 0.35;

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
    // winkel PI wie in der Graph-Ansicht: positiv oben, negativ unten.
    let radius = groessterKreisRadius(bandCounts);
    zeichneKreiseFuerRun(pos.x, pos.y, bandCounts, 1, PI);
    let fwertAnnotationen = treffer.filter(a => a.hasFwert);
    merkeKreis(pos.x, pos.y, bandCounts, radius,
      zeichneFwertPunkte(pos.x, pos.y, radius, fwertAnnotationen, 1));
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
        stroke(0, 100 * alpha);
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
    // Alle drei Ansichten übergeben winkel PI: positiv oben, negativ unten.
    let blend = k.key !== 'gold_mittel';
    let negR = kreisRadius(bc.neg || 0, maxRadius) * radiusSkala;
    let posR = kreisRadius(bc.pos || 0, maxRadius) * radiusSkala;
    let neutralR = kreisRadius(bc.neutral || 0, maxRadius) * radiusSkala;
    if (negR > 0) flaechenFormen.push({ r: negR, zeichne: () => zeichneHalbkreis(cx, cy, negR, winkel - HALF_PI, k.farbe, alphaSkala, blend) });
    if (posR > 0) flaechenFormen.push({ r: posR, zeichne: () => zeichneHalbkreis(cx, cy, posR, winkel + HALF_PI, k.farbe, alphaSkala, blend) });
    // NEUTRAL_DAEMPFUNG macht die Fläche leiser als die Valenz-Halbkreise.
    if (neutralR > 0) flaechenFormen.push({ r: neutralR, zeichne: () => zeichneVollkreis(cx, cy, neutralR, k.farbe, alphaSkala * NEUTRAL_DAEMPFUNG, blend) });
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

// Mitte des 120°-Drittels je Valenzgruppe: neg unten, pos oben, neutral rechts.
// Einzige Quelle dieser Konvention — zeichneFwertPunkte() setzt die Punkte
// danach, demoBeschriftungen() zeigt mit den Hilfslinien darauf.
// Math.PI statt HALF_PI: siehe ACHTUNG zur Ladezeit oben.
const FWERT_GRUPPEN_WINKEL = { neg: Math.PI / 2, pos: -Math.PI / 2, neutral: 0 };

// Ein Punkt je Annotation mit F-Wert, Grösse nach Typ, Lage im 120°-Drittel
// der eigenen Valenz. Bei Andrang wachsen weitere Ringe nach aussen.
// Rückgabe: die gesetzten Punkte, an die sich die Erklärungs-Ebene hängt.
function zeichneFwertPunkte(cx, cy, radius, fwertAnnotationen, alphaSkala = 1) {
  let gesetzt = [];
  if (!fwertAnnotationen.length || radius <= 0) return gesetzt;

  push(); // noStroke() plus direkte fillStyle-Schreibzugriffe
  const DRITTEL = TWO_PI / 3;
  // Reihenfolge [neg, pos, neutral] — gruppen[0..2] unten wird so indiziert.
  // Fest notiert: 180° lassen sich nicht in 120°-Drittel drehen.
  let mitten = [FWERT_GRUPPEN_WINKEL.neg, FWERT_GRUPPEN_WINKEL.pos, FWERT_GRUPPEN_WINKEL.neutral];
  let gruppen = mitten.map(mitte => ({ mitte, formen: [] }));
  fwertAnnotationen.forEach(a => {
    let gruppe = a.valenz === -1 ? gruppen[0] : a.valenz === 1 ? gruppen[1] : gruppen[2];
    let groesse = FWERT_PUNKTGROESSE[a.fWertType] || 1;
    gruppe.formen.push({
      d: FWERT_PUNKT_DURCHMESSER[groesse],
      rgb: FWERT_PUNKT_FARBE_RGB,
      typ: a.fWertType,
    });
  });

  // Etwas schmaler als das volle Drittel, damit Punkte an der Grenze nicht
  // ins Nachbar-Drittel ragen.
  let maxSpanne = DRITTEL * 0.8;

  noStroke();
  gruppen.forEach(({ mitte, formen }) => {
    if (!formen.length) return;
    let ringRadius = radius + FWERT_PUNKT_RAND_ABSTAND;
    let rest = formen;
    while (rest.length) {
      // Platzbudget eines Rings: das volle Drittel.
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

      let spanne = maxSpanne;
      let n = ringFormen.length;
      ringFormen.forEach((f, i) => {
        let winkelPunkt = n === 1 ? mitte : mitte - spanne / 2 + (i / (n - 1)) * spanne;
        let x = cx + Math.cos(winkelPunkt) * ringRadius;
        let y = cy + Math.sin(winkelPunkt) * ringRadius;
        gesetzt.push({ x, y, typ: f.typ });
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
  return gesetzt;
}


// ---------------------------------------------------------------------------
// Demo-Kreisgrafik (Erklärung vor dem Zoom in Kapitel 1)
// ---------------------------------------------------------------------------

// Erfundene Zielwerte, keine Kapiteldaten. Drei klar unterscheidbare
// Bandgrössen (16/12/8). ACHTUNG alle drei Bänder müssen in dieselbe Richtung
// überwiegen, sonst füllt das negative Band eines anderen die untere Hälfte
// auf und die Ausbauchung ist nicht mehr zu sehen.
const DEMO_BAND_COUNTS = {
  gold_dunkel: { pos: 8, neg: 3, neutral: 3, unrated: 2 },
  gold_mittel: { pos: 8, neg: 1, neutral: 2, unrated: 1 },
  gold_hell: { pos: 4, neg: 2, neutral: 1, unrated: 1 },
};

// Umkehrung von valenzBucket(); unrated hat keinen Zahlenwert.
const DEMO_VALENZ = { pos: 1, neg: -1, neutral: 0, unrated: undefined };

// Ein F-Wert je Valenzgruppe, damit oben, unten und rechts je ein Punkt sitzt.
const DEMO_FWERTE = { pos: 'ort_loest_emotion_aus', neg: 'emotion_faerbt_raum', neutral: 'koerper_als_sensor' };

// Die Demo steht allein auf der Karte und darf grösser sein als die Kreise
// entlang der Route. maxRadius ist der Vorgabewert von kreisRadius().
const DEMO_RADIUS_SKALA = 2.2;
const DEMO_MAX_RADIUS = 100;
const DEMO_LABEL_ABSTAND = 45;

// Ruheplatz als Icon: oben rechts, links neben dem Kapitelregister (5vw
// breit, siehe .kapitel-register in style.css).
const IKON_REGISTER_BREITE = 0.05; // Anteil der Fensterbreite
const IKON_ABSTAND_RAND = 46;      // Luft zwischen Register und Icon-Mitte
const IKON_ABSTAND_OBEN = 78;
const IKON_RADIUS_SKALA = 0.45;

// Lage der zuletzt gezeichneten Demo-Grafik, für den Treffertest des Icons.
let letzteDemoLage = null;

// ikon 0 = Erklärplatz über den Begleittexten, 1 = Ruheplatz als Icon.
function demoKreisLage(ikon) {
  return {
    cx: lerp(width * 0.30, width * (1 - IKON_REGISTER_BREITE) - IKON_ABSTAND_RAND, ikon),
    cy: lerp(height * 0.34, IKON_ABSTAND_OBEN, ikon),
    skala: lerp(DEMO_RADIUS_SKALA, IKON_RADIUS_SKALA, ikon),
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

// Beschriftungen am Kreis, in drei Gruppen passend zu den Erklärungstexten in
// index.html (data-demo-gruppe): Grösse, Wölbung, F-Wert-Punkte. Alle Labels
// stehen auf einer Seite, die Hilfslinien zeigen auf die Stelle, die der Text
// meint. Gilt für die Demo-Grafik wie für jeden echten Ortskreis — was ein
// Kreis nicht zeigt (fehlendes Band, fehlende Valenz), bekommt kein Label.
function kreisBeschriftungen(cx, cy, bandCounts, aussen, skala, maxRadius, gruppenAlpha, fwertPunkte, links) {
  let labelX = links ? cx - aussen - DEMO_LABEL_ABSTAND : cx + aussen + DEMO_LABEL_ABSTAND;
  let eintrag = (gruppe, text, radius, winkel) => {
    let ankerY = cy + Math.sin(winkel) * radius;
    return {
      ankerX: cx + Math.cos(winkel) * radius, ankerY,
      x: labelX, y: ankerY, text, farbe: null,
      hilfslinie: true, links, alpha: gruppenAlpha[gruppe],
    };
  };
  // Fächer über eine Kreisseite, damit sich die Hilfslinien nicht kreuzen.
  let winkelBand = [-0.95, -0.35, 0.3];
  let bandAnzahl = key => {
    let b = bandCounts[key] || {};
    return (b.neg || 0) + (b.pos || 0) + (b.neutral || 0) + (b.unrated || 0);
  };
  let valenzAnzahl = bucket => KREIS_KATEGORIEN.reduce(
    (n, kat) => n + ((bandCounts[kat.key] || {})[bucket] || 0), 0);

  let labels = [];
  KREIS_KATEGORIEN.forEach((kat, i) => {
    let n = bandAnzahl(kat.key);
    if (n > 0) labels.push(eintrag(0, CATEGORY_LABELS[kat.key],
      kreisRadius(n, maxRadius) * skala, winkelBand[i]));
  });
  labels.push(eintrag(0, 'Kreisgrösse = Relevanz des Ortes für Duroys Empfindungen.', aussen, 0.85));

  if (valenzAnzahl('pos') > 0) labels.push(eintrag(1, 'Halbkreise (Wölbung gegen oben) = positiv', aussen * 0.7, -PI / 3));
  if (valenzAnzahl('neg') > 0) labels.push(eintrag(1, 'Halbkreise (Wölbung gegen unten) = negativ', aussen * 0.7, PI / 3));
  // Nicht auf Winkel 0: dort sitzt der neutrale F-Wert-Punkt, die Hilfslinie
  // liefe genau durch ihn.
  if (valenzAnzahl('neutral') > 0) labels.push(eintrag(1, 'Kreis = neutral', aussen * 0.45, 0.32));

  // Je F-Wert-Typ ein Label, angeheftet an einen wirklich gesetzten Punkt
  // dieses Typs — die Punktgrösse ist es, die den Typ unterscheidet.
  let schonBeschriftet = new Set();
  (fwertPunkte || []).forEach(p => {
    if (!p.typ || schonBeschriftet.has(p.typ)) return;
    schonBeschriftet.add(p.typ);
    labels.push({
      ankerX: p.x, ankerY: p.y, x: labelX, y: p.y,
      text: FWERT_LABELS[p.typ], farbe: null,
      hilfslinie: true, links, alpha: gruppenAlpha[2],
    });
  });

  // zeichneKreisLabels weicht nur nach unten aus: liegt der Kreis tief im
  // Bild, muss der Stapel vorher hoch, sonst fällt er unten heraus.
  let stapel = labels.length * (LABEL_HOEHE + LABEL_ABSTAND);
  let obenRaus = LABEL_HOEHE;
  let untenRaus = Math.max(obenRaus, height - stapel);
  labels.forEach(l => l.y = constrain(l.y, obenRaus, untenRaus));
  return labels;
}

// fortschritt 0..1 deckt die erfundenen Annotationen auf, alphaSkala blendet
// die ganze Grafik, gruppenAlpha die drei Beschriftungsgruppen, ikon 0..1
// schiebt sie vom Erklärplatz auf den Icon-Platz oben rechts.
function zeichneDemoKreisgrafik(fortschritt, alphaSkala, gruppenAlpha, ikon = 0) {
  letzteDemoLage = null;
  if (alphaSkala <= 0 || fortschritt <= 0) return;
  let sichtbar = DEMO_ANNOTATIONEN.slice(0, Math.round(fortschritt * DEMO_ANNOTATIONEN.length));
  if (!sichtbar.length) return;

  let { cx, cy, skala } = demoKreisLage(ikon);
  let bandCounts = zaehleBandCounts(sichtbar);
  let aussen = groessterKreisRadius(bandCounts, DEMO_MAX_RADIUS, skala);
  // winkel PI wie alle anderen Ansichten: positiv oben, negativ unten.
  zeichneKreiseFuerRun(cx, cy, bandCounts, alphaSkala, PI, skala, DEMO_MAX_RADIUS);
  let fwertPunkte = zeichneFwertPunkte(cx, cy, aussen, sichtbar.filter(a => a.hasFwert), alphaSkala);
  zeichneKreisLabels(kreisBeschriftungen(cx, cy, bandCounts, aussen, skala, DEMO_MAX_RADIUS,
    gruppenAlpha.map(a => a * alphaSkala), fwertPunkte, false));
  letzteDemoLage = { cx, cy, r: aussen, ikon, alpha: alphaSkala };
}

// Trefferfläche des Icons — nur wenn es auch wirklich als Icon dasteht und
// nicht gerade noch auf dem Weg dorthin ist.
function demoIkonGetroffen(mx, my) {
  let l = letzteDemoLage;
  if (!l || l.ikon < 0.99 || l.alpha <= 0.01) return false;
  return dist(mx, my, l.cx, l.cy) <= l.r + FWERT_PUNKT_RAND_ABSTAND + 8;
}

// ---------------------------------------------------------------------------
// Erklärungs-Ebene (Klick aufs Icon)
// ---------------------------------------------------------------------------

// Heller Schleier über der ganzen Ansicht; die Kreisgrafik bleibt darunter
// erkennbar, tritt aber hinter die Beschriftungen zurück.
const ERKLAERUNG_SCHLEIER = '#E2E6E1';
const ERKLAERUNG_SCHLEIER_ALPHA = 0.6;
const ERKLAERUNG_LABEL_BREITE = 360; // Platzbedarf des längsten Labels

// Legt den Schleier über die Ansicht und beschriftet den grössten Kreis des
// Frames mit allen drei Erklärungen zugleich. Steht keiner im Bild
// (Übersichts- und Schlussakt), erklärt die Demo-Grafik an ihrem alten Platz.
function zeichneKreisErklaerung() {
  push();
  noStroke();
  drawingContext.globalAlpha = ERKLAERUNG_SCHLEIER_ALPHA;
  drawingContext.fillStyle = ERKLAERUNG_SCHLEIER;
  drawingContext.fillRect(0, 0, width, height);
  pop();

  // Ein angeschnittener Kreis taugt nicht als Bezug: seine Beschriftungen
  // zeigten auf Stellen ausserhalb des Bildes. Nur wenn gar keiner ganz
  // drinsteht, zählt wieder das ganze Feld.
  let groesster = (liste) => liste.reduce((bisher, k) =>
    !bisher || k.radius > bisher.radius ? k : bisher, null);
  let ganzImBild = gezeichneteKreise.filter(k =>
    k.cx - k.radius > 0 && k.cx + k.radius < width &&
    k.cy - k.radius > 0 && k.cy + k.radius < height);
  let kreis = groesster(ganzImBild) || groesster(gezeichneteKreise);
  if (!kreis) {
    zeichneDemoKreisgrafik(1, 1, [1, 1, 1], 0);
    return;
  }
  // Passen die Labels rechts nicht mehr aufs Bild, klappen sie nach links.
  let links = kreis.cx + kreis.radius + DEMO_LABEL_ABSTAND + ERKLAERUNG_LABEL_BREITE > width;
  zeichneKreisLabels(kreisBeschriftungen(kreis.cx, kreis.cy, kreis.bandCounts, kreis.radius,
    kreis.skala, kreis.maxRadius, [1, 1, 1], kreis.fwertPunkte, links));
}

// --- Export ------------------------------------------------------------
// Zehn Namen. Leser: docs/architektur.md.
window.FWERT_PUNKT_DURCHMESSER = FWERT_PUNKT_DURCHMESSER;
window.leereBandCounts = leereBandCounts;
window.zeichneKreiseOrtRuns = zeichneKreiseOrtRuns;
window.zeichneKreiseFuerRun = zeichneKreiseFuerRun;
window.zeichneFwertPunkte = zeichneFwertPunkte;
window.zeichneDemoKreisgrafik = zeichneDemoKreisgrafik;
window.merkeKreis = merkeKreis;
window.vergissGezeichneteKreise = vergissGezeichneteKreise;
window.demoIkonGetroffen = demoIkonGetroffen;
window.zeichneKreisErklaerung = zeichneKreisErklaerung;

})(); // Ende der Modulkapselung, siehe Kommentar oben
