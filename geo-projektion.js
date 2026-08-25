/* =============================================================================
   geo-projektion.js — Georeferenz und Projektion Grad → Bildschirm

   Unterste Schicht: rechnet Länge/Breite in Canvas-Pixel um und bestimmt den
   Bildausschnitt zu einer Bbox. Alles auf der Karte geht durch
   lonLatToScreen(). Bewusst lineare Abbildung statt echter Mercator-
   Projektion — über einen Pariser Ausschnitt ist der Fehler vernachlässigbar.
============================================================================= */

// ACHTUNG die beiden Übersichtskarten zeigen NICHT denselben Ausschnitt:
// gleiche Pixelmasse, aber um 568 m verschobene QGIS-Fenster. Je eigene Bbox
// nötig — mit gemeinsamen Werten lagen die Routen 46 px neben den Strassen.
// Hergang und Gegenprobe: docs/bugfix-log.md, Fix 2.

// paris-startkarte-web.png (Startseite und Schlusskarte).
// QGIS EPSG:3857: X 247340.000 .. 270290.000, Y 6245109.800 .. 6256840.000
let startBbox = { west: 2.221893023741224, east: 2.4280563814466545, south: 48.82435089471847, north: 48.89367804058055 };

// paris-ueberblickkarte-web.png (Übersichtsakt), Basis wie die Kapitelkarten.
// QGIS EPSG:3857: X 247907.651 .. 270857.651, Y 6244994.107 .. 6256724.107
let uebersichtBbox = { west: 2.2269923194085774, east: 2.4331556771226127, south: 48.82366665448583, north: 48.892993566082404 };

// kapitel01-qgis-karte-web.png. Wert ist geprüft und korrekt, aber sein
// QGIS-Ursprung ist nicht überliefert.

// ACHTUNG die .pgw-Weltdateien aus data-prep/export gehören NICHT zu diesem
// Bild — eingesetzt zögen sie die Route 1.5 km nach Osten. Siehe
// docs/cleanup-log.md, Schritt 10.
let ch1ImgBbox = { west: 2.317834413581757, east: 2.352393886019969, south: 48.86683338890839, north: 48.881871498351956 };

let mapOffsetX = -250;
let mapOffsetY = 0;

function coverCrop(imgW, imgH, vAnchor = 0.5, hAnchor = 0.5, offsetX = mapOffsetX) {
  // Effektive Breite (width - offsetX), sonst bleibt rechts ein grauer Rand.
  // Die zentrierte Übersichtskarte ruft explizit mit offsetX=0 auf.
  let canvasRatio = (width - offsetX) / height;
  let imgRatio = imgW / imgH;
  let coverW, coverH;
  if (imgRatio > canvasRatio) { coverH = imgH; coverW = imgH * canvasRatio; }
  else { coverW = imgW; coverH = imgW / canvasRatio; }
  // vAnchor/hAnchor verschieben den Ausschnitt im Bild: 0 = oben/links,
  // 1 = unten/rechts, 0.5 = zentriert.
  return { x: (imgW - coverW) * hAnchor, y: (imgH - coverH) * vAnchor, w: coverW, h: coverH };
}

function lonLatToScreen(lon, lat, bbox, offsetX = mapOffsetX, offsetY = mapOffsetY) {
  let x = map(lon, bbox.west, bbox.east, 0, width - offsetX) + offsetX;
  let y = map(lat, bbox.north, bbox.south, 0, height) + offsetY;
  return { x, y };
}

function bboxToImgCrop(bbox, refBbox, imgW, imgH) {
  let x0 = map(bbox.west, refBbox.west, refBbox.east, 0, imgW);
  let y0 = map(bbox.north, refBbox.north, refBbox.south, 0, imgH);
  let x1 = map(bbox.east, refBbox.west, refBbox.east, 0, imgW);
  let y1 = map(bbox.south, refBbox.north, refBbox.south, 0, imgH);
  x0 = constrain(x0, 0, imgW); y0 = constrain(y0, 0, imgH);
  x1 = constrain(x1, 0, imgW); y1 = constrain(y1, 0, imgH);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

function cropToBbox(crop, refBbox, imgW, imgH) {
  return {
    west: map(crop.x, 0, imgW, refBbox.west, refBbox.east),
    east: map(crop.x + crop.w, 0, imgW, refBbox.west, refBbox.east),
    north: map(crop.y, 0, imgH, refBbox.north, refBbox.south),
    south: map(crop.y + crop.h, 0, imgH, refBbox.north, refBbox.south),
  };
}
