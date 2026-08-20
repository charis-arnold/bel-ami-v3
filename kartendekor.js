/* =============================================================================
   kartendekor.js — Kartografische Beigaben: Massstabsleiste und Windrose

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Beide
   Funktionen sind reine Zeichenroutinen ohne Zugriff auf den Erzählzustand
   des Sketches: sie kennen weder zoomedKapitel noch die Scroll-Meilensteine,
   sondern bekommen alles, was sie brauchen, als Parameter übergeben — die
   sichtbare Bbox, den Kartenoffset und einen Alpha-Multiplikator.

   Abhängigkeiten: p5.js (width/height, push/pop, stroke/fill, textFont …,
   drawingContext) sowie haversineMeter(), das hier gleich mitwohnt, weil
   zeichneMassstabsleiste sein einziger Aufrufer ist.

   Wird in index.html VOR sketch.js geladen.
============================================================================= */

// ---------------------------------------------------------------------------
// Massstabsleiste (unten rechts) — Balken mit Meter-/Kilometerangabe, wie auf
// klassischen Kartendarstellungen. Skaliert live mit der aktuell sichtbaren
// Bbox (Übersicht bis Kapitel-Zoom), da lonLatToScreen Grad linear auf Pixel
// abbildet — für die kurze Ost-West-Ausdehnung eines Kartenausschnitts reicht
// die Haversine-Distanz bei mittlerer Breite als Näherung völlig aus.
// ---------------------------------------------------------------------------

function haversineMeter(lon1, lat1, lon2, lat2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// "Schöne" Rundwerte für die Balkenlänge (Meter) — deckt Übersichtskarte
// (mehrere km) bis engen Kapitel-Zoom (wenige hundert Meter) ab.
const MASSSTAB_SCHRITTE = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];

function zeichneMassstabsleiste(bbox, offsetX, alphaMultiplier = 1) {
  if (alphaMultiplier <= 0) return;
  let mapPixelWidth = width - offsetX;
  if (mapPixelWidth <= 0) return;
  let midLat = (bbox.north + bbox.south) / 2;
  let breiteMeter = haversineMeter(bbox.west, midLat, bbox.east, midLat);
  let meterProPixel = breiteMeter / mapPixelWidth;
  if (!isFinite(meterProPixel) || meterProPixel <= 0) return;

  // Grösster "schöner" Wert, dessen Balken noch unter ~160px bleibt.
  let ziel = MASSSTAB_SCHRITTE[0];
  for (let schritt of MASSSTAB_SCHRITTE) {
    if (schritt / meterProPixel <= 160) ziel = schritt;
    else break;
  }
  let balkenBreite = ziel / meterProPixel;
  let label = ziel >= 1000 ? `${ziel / 1000} km` : `${ziel} m`;

  let randX = 40, randY = 36, tickHoehe = 6;
  let x1 = width - randX - balkenBreite;
  let x2 = width - randX;
  let y = height - randY;

  push();
  stroke(26, 26, 26, 220 * alphaMultiplier);
  strokeWeight(2);
  line(x1, y, x2, y);
  line(x1, y - tickHoehe, x1, y);
  line(x2, y - tickHoehe, x2, y);
  noStroke();
  fill(26, 26, 26, 220 * alphaMultiplier);
  textFont("'Source Sans 3', sans-serif");
  textStyle(NORMAL);
  textSize(11);
  textAlign(CENTER, BOTTOM);
  drawingContext.fillText(label, (x1 + x2) / 2, y - tickHoehe - 4); // p5s text() bleibt bei laufender Animation manchmal unsichtbar, siehe zeichneSpineHorizontal
  pop();
}

// ---------------------------------------------------------------------------
// Windrose (oben rechts) — Haussmann-Paris Farbpalette. Läuft im p5-
// Standard-Winkelmodus (Grad, kein angleMode(RADIANS) im Projekt), daher
// hier bewusst ohne radians()-Umwandlung: cos()/sin() erwarten Grad.
// ---------------------------------------------------------------------------

function zeichneWindrose(x, y, groesse, alphaMultiplier = 1) {
  if (alphaMultiplier <= 0) return;

  const zinkgrau = '#9DA69D';
  const kalksteinCreme = '#212B2E';
  const schmiedeeisenSchwarz = '#9DA69D';
  const cafeRot = '#212B2E';
  const messingGold = '#212B2E';

  // Hilfsfunktion: zweigeteilter Zacken (Kite-Form). winkel: 0 = Norden
  // (oben), im Uhrzeigersinn — die -90 richtet das an p5s 0°=Osten aus.
  function zeichneZacke(winkel, radius, basisBreite, farbeLinks, farbeRechts) {
    const w = radians(winkel - 90);
    const spitzeX = radius * cos(w);
    const spitzeY = radius * sin(w);
    const basis1X = basisBreite * cos(w + HALF_PI);
    const basis1Y = basisBreite * sin(w + HALF_PI);
    const basis2X = basisBreite * cos(w - HALF_PI);
    const basis2Y = basisBreite * sin(w - HALF_PI);
    

    // Helle, dünne Kontur — sonst verschwindet z.B. schmiedeeisenSchwarz auf
    // der dunklen Startseiten-Karte fast komplett (nur die helle Zackenhälfte
    // bliebe sichtbar, die Zacke wirkt dann einseitig/"verzogen").
    stroke('#9DA69D');
    strokeWeight(0.75);
    fill(farbeLinks);
    triangle(0, 0, spitzeX, spitzeY, basis1X, basis1Y);
    fill(farbeRechts);
    triangle(0, 0, spitzeX, spitzeY, basis2X, basis2Y);
  }

  push();
  drawingContext.globalAlpha = alphaMultiplier;
  translate(x, y);

  const rHaupt = groesse;
  const rNeben = groesse * 0.6;

 // Äussere Ringe
  noStroke();
  fill(226, 230, 225, 40); // zinkgrau mit Transparenz (0–255, z.B. 40 = sehr leicht)
  circle(0, 0, rHaupt * 2 + 20);
  circle(0, 0, rHaupt * 2);

  // Haupt-Zacken: Nord, Ost, Süd, West
  const richtungenHaupt = [
    { winkel: 0, farbeLinks: cafeRot, farbeRechts: schmiedeeisenSchwarz },
    { winkel: 90, farbeLinks: kalksteinCreme, farbeRechts: schmiedeeisenSchwarz },
    { winkel: 180, farbeLinks: kalksteinCreme, farbeRechts: schmiedeeisenSchwarz },
    { winkel: 270, farbeLinks: kalksteinCreme, farbeRechts: schmiedeeisenSchwarz },
  ];
  const breite = groesse * 0.08;
  richtungenHaupt.forEach(r => zeichneZacke(r.winkel, rHaupt, breite, r.farbeLinks, r.farbeRechts));

  // Neben-Zacken: NO, SO, SW, NW
  const richtungenNeben = [45, 135, 225, 315];
  const breiteNeben = groesse * 0.05;
  richtungenNeben.forEach(w => zeichneZacke(w, rNeben, breiteNeben, messingGold, zinkgrau));

  // Zentrum
  stroke(messingGold);
  strokeWeight(1);
  fill(kalksteinCreme);
  circle(0, 0, groesse * 0.18);
  noStroke();
  fill(schmiedeeisenSchwarz);
  circle(0, 0, groesse * 0.05);

  // Beschriftung Haupthimmelsrichtungen — schmiedeeisenSchwarz/zinkgrau sind
  // inzwischen helle Zacken-Farben (siehe oben) und taugen als Text-Füllung
  // nicht mehr, daher eigene beschriftungsFarbe.
  // p5s text() bleibt bei laufender Animation manchmal unsichtbar (siehe
  // zeichneSpineHorizontal) — Fill hier direkt über den Canvas-Context, die
  // p5-Aufrufe oben (fill/textAlign/textSize/textFont/textStyle) setzen die
  // dafür nötigen Context-Eigenschaften weiterhin wie gewohnt.
  function zeichneBeschriftung(label, x, y) {
    drawingContext.fillText(label, x, y);
  }

  const beschriftungsFarbe = '#A4860A';
  noStroke();
  fill(beschriftungsFarbe);
  textAlign(CENTER, CENTER);
  textSize(groesse * 0.2);
  textFont("'Source Sans 3', sans-serif");
  textStyle(BOLD);
  zeichneBeschriftung('N', 0, -rHaupt - 16);
  zeichneBeschriftung('O', rHaupt + 16, 0);
  zeichneBeschriftung('S', 0, rHaupt + 16);
  zeichneBeschriftung('W', -rHaupt - 16, 0);

  // Beschriftung Nebenrichtungen — dieselbe -90-Ausrichtung wie die Zacken,
  // sonst landet z.B. "NO" geometrisch auf der SO-Position.
  fill(beschriftungsFarbe);
  textSize(groesse * 0.1);
  const offsetNeben = rNeben + 14;
  richtungenNeben.forEach((w, i) => {
    const label = ['NO', 'SO', 'SW', 'NW'][i];
    const a = radians(w - 90);
    zeichneBeschriftung(label, offsetNeben * cos(a), offsetNeben * sin(a));
  });

  pop();
}
