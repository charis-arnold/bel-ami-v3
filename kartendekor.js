/* =============================================================================
   kartendekor.js — Route, Massstabsleiste und Windrose

   Reine Zeichenroutinen ohne Zugriff auf den Erzählzustand: sie bekommen
   sichtbare Bbox, Kartenoffset, Alpha und beim Routenzug den Endindex als
   Parameter. haversineMeter wohnt hier mit, weil zeichneMassstabsleiste sein
   einziger Aufrufer ist.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 10 von 13 Namen intern, 3 exportiert. Konvention: docs/architektur.md.
(function () {

// ---------------------------------------------------------------------------
// Massstabsleiste unten rechts, skaliert live mit der sichtbaren Bbox.
// Haversine bei mittlerer Breite reicht als Näherung für einen Ausschnitt.
// ---------------------------------------------------------------------------

function haversineMeter(lon1, lat1, lon2, lat2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Rundwerte für die Balkenlänge in Metern, Übersicht bis Kapitel-Zoom.
const MASSSTAB_SCHRITTE = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];

function zeichneMassstabsleiste(bbox, offsetX, offsetY = 0) {
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

  // randY hält die Leiste über den beiden Registerreitern am unteren Rand
  // (LEISTE_REITER_H = 30 in kreisgrafik.js) frei.
  let randX = 40, randY = 76, tickHoehe = 6;
  let x1 = width - randX - balkenBreite;
  let x2 = width - randX;
  let y = height - randY - offsetY;

  push();
  stroke(26, 26, 26, 220);
  strokeWeight(2);
  line(x1, y, x2, y);
  line(x1, y - tickHoehe, x1, y);
  line(x2, y - tickHoehe, x2, y);
  noStroke();
  fill(26, 26, 26, 220);
  textFont(SCHRIFT_SANS);
  textStyle(NORMAL);
  textSize(11);
  textAlign(CENTER, BOTTOM);
  drawingContext.fillText(label, (x1 + x2) / 2, y - tickHoehe - 4); // fillText: p5s text() bleibt bei Animation manchmal unsichtbar
  pop();
}

// ---------------------------------------------------------------------------
// Fortschrittsleiste am unteren Rand
// ---------------------------------------------------------------------------

// Wie weit man im laufenden Akt ist, 0..1. Liegt im Canvas und nicht im DOM:
// die Reiter der beiden Register sitzen an derselben Stelle und müssen davor
// liegen — als DOM-Element läge die Leiste immer darüber. Wer danach zeichnet,
// deckt sie zu; genau das tun der Legendenbalken und die Info-Fläche.
const FORTSCHRITT_RAND = 24;   // Abstand links und rechts
const FORTSCHRITT_UNTEN = 16;  // Unterkante zum Fensterrand
const FORTSCHRITT_HOEHE = 4;
const FORTSCHRITT_GRUND = 'rgba(0, 0, 0, 0.08)';

function zeichneScrollFortschritt(anteil) {
  let breite = width - 2 * FORTSCHRITT_RAND;
  if (breite <= 0) return;
  let y = height - FORTSCHRITT_UNTEN - FORTSCHRITT_HOEHE;
  push(); // schreibt fillStyle direkt, wie die Massstabsleiste oben
  noStroke();
  drawingContext.fillStyle = FORTSCHRITT_GRUND;
  drawingContext.fillRect(FORTSCHRITT_RAND, y, breite, FORTSCHRITT_HOEHE);
  drawingContext.fillStyle = ROUTE_COLOR;
  drawingContext.fillRect(FORTSCHRITT_RAND, y, breite * constrain(anteil, 0, 1), FORTSCHRITT_HOEHE);
  pop();
}

// ---------------------------------------------------------------------------
// Windrose oben rechts. Winkel werden in Grad notiert (0 = Norden) und mit
// radians(winkel - 90) auf p5s Radiant-Modus und 0°=Osten umgerechnet.
//
// ACHTUNG derzeit ohne Aufrufer: der Aufruf in draw() (sketch.js) ist
// auskommentiert, weil oben rechts das Kreisgrafik-Icon steht. Funktion und
// Export bleiben absichtlich stehen.
// ---------------------------------------------------------------------------

function zeichneWindrose(x, y, groesse, alphaMultiplier = 1) {
  if (alphaMultiplier <= 0) return;

  const zinkgrau = '#9DA69D';
  const kalksteinCreme = '#212B2E';
  const schmiedeeisenSchwarz = '#9DA69D';
  const cafeRot = '#212B2E';
  const messingGold = '#212B2E';

  // Zweigeteilter Zacken. winkel: 0 = Norden, im Uhrzeigersinn.
  function zeichneZacke(winkel, radius, basisBreite, farbeLinks, farbeRechts) {
    const w = radians(winkel - 90);
    const spitzeX = radius * cos(w);
    const spitzeY = radius * sin(w);
    const basis1X = basisBreite * cos(w + HALF_PI);
    const basis1Y = basisBreite * sin(w + HALF_PI);
    const basis2X = basisBreite * cos(w - HALF_PI);
    const basis2Y = basisBreite * sin(w - HALF_PI);
    

    // Helle Kontur, sonst wirkt die Zacke auf der dunklen Startkarte
    // einseitig — die dunkle Hälfte verschwindet.
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
  fill(226, 230, 225, 40); // #E2E6E1, sehr leicht
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

  // Eigene Farbe, weil die Zacken-Konstanten dafür zu hell sind.
  // fillText direkt: p5s text() bleibt bei Animation manchmal unsichtbar.
  function zeichneBeschriftung(label, x, y) {
    drawingContext.fillText(label, x, y);
  }

  const beschriftungsFarbe = '#A4860A';
  noStroke();
  fill(beschriftungsFarbe);
  textAlign(CENTER, CENTER);
  textSize(groesse * 0.2);
  textFont(SCHRIFT_SANS);
  textStyle(BOLD);
  zeichneBeschriftung('N', 0, -rHaupt - 16);
  zeichneBeschriftung('O', rHaupt + 16, 0);
  zeichneBeschriftung('S', 0, rHaupt + 16);
  zeichneBeschriftung('W', -rHaupt - 16, 0);

  // Dieselbe -90-Ausrichtung wie die Zacken, sonst landet "NO" auf SO.
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



// ---------------------------------------------------------------------------
// Die Route: eine Farbe, nach hinten verblassend. Gezeichnet wird in einen
// eigenen Puffer, weil nur dort Deckkraft geschrieben statt gemischt wird.

// Jede Stufe wird DECKEND gezogen und überschreibt die vorherige; den Verlauf
// macht ein Waschgang davor (erase = destination-out).

// ACHTUNG nicht mit halbdurchsichtigen Strichen direkt aufs Canvas: wo zwei
// einander berühren, addiert Porter-Duff ihre Deckkraft — an Stufengrenzen,
// an den Kappen und überall, wo die Route sich selbst kreuzt.
const ROUTE_STUFEN = 20;
const ROUTE_MIN_ALPHA = 45;
const ROUTE_MAX_ALPHA = 255;

// Schweiflänge in Bildschirmpixeln, nicht in Wegpunkten: an Indizes gebunden
// hängt sie an der Abtastung des Pfads und fällt je Kapitel um Faktor 13
// verschieden aus. 400px lassen auch im kürzesten Kapitel (18, rund 770px
// Route) noch eine Hälfte auf der Mindestdeckkraft stehen.
const ROUTE_SCHWEIF_PX = 400;

let routenPuffer = null; // Vollbildpuffer, siehe zeichneRoute

// Zielwert der Stufe k (0 = älteste, ROUTE_STUFEN-1 = Spitze). Linear wie
// bisher; die Waschstärken unten leiten sich daraus ab.
function routenStufenAlpha(k) {
  return ROUTE_MIN_ALPHA + (ROUTE_MAX_ALPHA - ROUTE_MIN_ALPHA) * k / (ROUTE_STUFEN - 1);
}

function routenPufferBereit() {
  if (routenPuffer && (routenPuffer.width !== width || routenPuffer.height !== height)) {
    routenPuffer.remove();
    routenPuffer = null;
  }
  if (!routenPuffer) routenPuffer = createGraphics(width, height);
  routenPuffer.clear();
  return routenPuffer;
}

// Zerlegt den projizierten Pfad von der Spitze rückwärts in ROUTE_STUFEN Züge
// gleicher Bogenlänge; alles jenseits des Schweifs bildet die älteste Stufe.
// Grenzen werden ins Segment interpoliert, damit benachbarte Züge exakt
// aneinander anschliessen.
function routenStufenZuege(p, letzterPunkt) {
  let abstand = new Array(letzterPunkt + 1);
  abstand[letzterPunkt] = 0;
  for (let i = letzterPunkt - 1; i >= 0; i--) {
    abstand[i] = abstand[i + 1] + dist(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y);
  }
  let stufenLaenge = ROUTE_SCHWEIF_PX / (ROUTE_STUFEN - 1);
  let zuege = new Array(ROUTE_STUFEN);
  let stufe = ROUTE_STUFEN - 1;
  let zug = [p[letzterPunkt]];
  for (let i = letzterPunkt - 1; i >= 0; i--) {
    let grenze = (ROUTE_STUFEN - stufe) * stufenLaenge;
    while (stufe > 0 && abstand[i] >= grenze) {
      let segLaenge = abstand[i] - abstand[i + 1];
      let t = segLaenge > 0 ? (grenze - abstand[i + 1]) / segLaenge : 0;
      let gp = { x: lerp(p[i + 1].x, p[i].x, t), y: lerp(p[i + 1].y, p[i].y, t) };
      zug.push(gp);
      zuege[stufe] = zug;
      stufe--;
      zug = [gp];
      grenze = (ROUTE_STUFEN - stufe) * stufenLaenge;
    }
    zug.push(p[i]);
  }
  zuege[stufe] = zug;
  return zuege;
}

function zeichneRoute(punkte, upToIndex, bbox, strichstaerke = 2, offsetX = mapOffsetX, offsetY = mapOffsetY, alphaMultiplier = 1) {
  if (upToIndex < 1 || alphaMultiplier <= 0) return;
  let letzterPunkt = Math.min(upToIndex, punkte.length - 1);
  if (letzterPunkt < 1) return;

  let p = [];
  let links = Infinity, oben = Infinity, rechts = -Infinity, unten = -Infinity;
  for (let i = 0; i <= letzterPunkt; i++) {
    let q = lonLatToScreen(punkte[i][0], punkte[i][1], bbox, offsetX, offsetY);
    p.push(q);
    links = Math.min(links, q.x); rechts = Math.max(rechts, q.x);
    oben = Math.min(oben, q.y); unten = Math.max(unten, q.y);
  }
  let rand = strichstaerke + 2;
  let zuege = routenStufenZuege(p, letzterPunkt);

  let pg = routenPufferBereit();
  let schonGezeichnet = false;
  for (let k = 0; k < ROUTE_STUFEN; k++) {
    if (!zuege[k] || zuege[k].length < 2) continue;
    // Kurze Routen fangen erst bei einer höheren Stufe an; bis dahin ist der
    // Puffer leer und es gibt nichts zu waschen.
    if (schonGezeichnet) {
      // Nimmt allem bisher Gezeichneten den Anteil, der die vorige Stufe auf
      // ihren Zielwert bringt. Nur über dem Routenrahmen statt Vollbild.

      // ACHTUNG fill() muss VOR erase() stehen: erase() tauscht nur den
      // Farbwert, es schaltet die Füllung nicht ein. Sonst malt das Rechteck
      // nichts und der Verlauf bleibt ganz aus.
      pg.push();
      pg.noStroke();
      pg.fill(255);
      pg.erase(255 * (1 - routenStufenAlpha(k - 1) / routenStufenAlpha(k)));
      pg.rect(links - rand, oben - rand, rechts - links + 2 * rand, unten - oben + 2 * rand);
      pg.noErase();
      pg.pop();
    }
    pg.push();
    pg.noFill();
    pg.strokeWeight(strichstaerke);
    pg.strokeCap(ROUND);
    pg.strokeJoin(ROUND);
    pg.stroke(ROUTE_COLOR_RGB.r, ROUTE_COLOR_RGB.g, ROUTE_COLOR_RGB.b, ROUTE_MAX_ALPHA);
    pg.beginShape();
    zuege[k].forEach(q => pg.vertex(q.x, q.y));
    pg.endShape();
    pg.pop();
    schonGezeichnet = true;
  }

  // alphaMultiplier erst beim Auflegen, nicht im Puffer: so übersteht der
  // Puffer die Einblendung eines Kapitels ohne Neuaufbau.
  if (alphaMultiplier < 1) tint(255, 255 * alphaMultiplier);
  image(pg, 0, 0);
  if (alphaMultiplier < 1) noTint();
}


// --- Export ------------------------------------------------------------
// Drei Zeichenfunktionen. Leser: docs/architektur.md.
window.zeichneMassstabsleiste = zeichneMassstabsleiste;
window.zeichneScrollFortschritt = zeichneScrollFortschritt;
window.zeichneWindrose = zeichneWindrose;
window.zeichneRoute = zeichneRoute;

})(); // Ende der Modulkapselung, siehe Kommentar oben
