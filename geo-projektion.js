/* =============================================================================
   geo-projektion.js — Georeferenz und Projektion Grad → Bildschirm

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Die
   Grundschicht der ganzen Darstellung: Sie rechnet geografische Koordinaten
   in Canvas-Pixel um und bestimmt, welcher Ausschnitt eines Kartenbildes zu
   welcher Bbox gehört. Alles, was auf der Karte liegt — Routen, Ortskreise,
   Foto-Marker, die sieben Knoten des Schlussakts — geht durch
   lonLatToScreen().

   Die Abbildung ist bewusst linear (map() auf Grad, nicht echte
   Mercator-Projektion): über die Ost-West-Ausdehnung eines Pariser
   Kartenausschnitts ist der Fehler vernachlässigbar, und die Kartenbilder
   selbst kommen als fertige QGIS-Exporte mit bekannter Bbox.

   --- Abhängigkeiten NACH AUSSEN -------------------------------------------
   KEINE ausser p5 (width, height, map, constrain). Dieses Modul greift auf
   keine andere Projektdatei zu — es ist die unterste Schicht.

   --- Wer von aussen hierher greift ----------------------------------------
   lonLatToScreen()      sketch.js, ortsveraenderung.js, fotomarker.js,
                         annotationsbox.js
   mapOffsetX/mapOffsetY sketch.js, fotomarker.js, annotationsbox.js — teils
                         als Default-Parameter (offsetX = mapOffsetX), die
                         erst beim Aufruf ausgewertet werden
   coverCrop(), bboxToImgCrop(), cropToBbox(), startBbox, uebersichtBbox,
   ch1ImgBbox            nur sketch.js (Bildausschnitt-Berechnung in draw())

   Deshalb steht diese Datei in index.html GANZ VORNE, direkt nach
   datenbereinigung.js und vor allen anderen Modulen: sketch.js wertet
   mapOffsetX beim Laden aus (siehe letzterFotoOffsetX dort), und alle
   übrigen Module greifen zur Laufzeit hierher.

   NICHT hier: haversineMeter(). Die Funktion sitzt in kartendekor.js, wo
   zeichneMassstabsleiste() ihr einziger Aufrufer ist — sie berechnet echte
   Meterdistanzen für die Balkenlänge, nicht die Bildschirmprojektion.
============================================================================= */

// Georeferenz beider Übersichtskarten (Startseite und Überblickseite). Sie
// stammen aus demselben QGIS-Ausschnitt und haben auch dieselben Pixelmasse,
// teilen sich also eine Bbox. Exakte Werte aus QGIS (EPSG:3857:
// X 247907.651 .. 270857.651, Y 6244994.107 .. 6256724.107), umgerechnet mit
// derselben Web-Mercator-Formel wie die Kapitelkarten (siehe BASIS_3857/
// x2lon/y2lat in data-prep/05 bereinigen/schneide-kapitelkarten.py) — damit
// liegen Übersichts- und Kapitelkarten auf derselben Grundlage.
// Auf beiden Bildern gegengeprüft, indem bekannte Fixpunkte darauf projiziert
// wurden: Gare Saint-Lazare landet auf dem Gleisfächer, Concorde am
// Tuilerien-Rand, Madeleine auf ihrem Kirchenblock.
// startBbox — paris-startkarte-web.png. Exakte Georeferenz aus QGIS
// (EPSG:3857: X 247907.651 .. 270857.651, Y 6244994.107 .. 6256724.107).
//
// Zwischenzeitlich standen hier X 247340.000 / Y 6245109.800 (568 m weiter
// westlich, 116 m weiter nördlich). Gegenprobe: dieselbe Kapitelroute auf
// dasselbe Bild projiziert folgt mit den Werten unten exakt den Strassen,
// mit den anderen läuft sie quer durch die Häuserblöcke und schneidet die
// Tuilerien — auf 6000px Bildbreite ein Versatz von 148px. Falls doch ein
// Export mit jenem Ausschnitt existiert, gehören die Werte zu DEM Bild,
// nicht zu diesem.
let startBbox = { west: 2.2269923194085774, east: 2.4331556771226127, south: 48.82366665448583, north: 48.892993566082404 };
// uebersichtBbox — paris-ueberblickkarte-web.png, unverändert.
let uebersichtBbox = { west: 2.2269923194085774, east: 2.4331556771226127, south: 48.82366665448583, north: 48.892993566082404 };
let ch1ImgBbox = { west: 2.317834413581757, east: 2.352393886019969, south: 48.86683338890839, north: 48.881871498351956 };

let mapOffsetX = -250;
let mapOffsetY = 0;

function coverCrop(imgW, imgH, vAnchor = 0.5, hAnchor = 0.5, offsetX = mapOffsetX) {
  // Nutzt die effektive Breite (width - offsetX), nicht die reine
  // Canvas-Breite — sonst deckt die geografische Bbox nicht den ganzen,
  // durch den Offset verschobenen Canvas ab (grauer Rand rechts). offsetX
  // ist standardmässig mapOffsetX (Kapitel-1-Kartenausschnitt), die grosse,
  // zentrierte Übersichtskarte (bgImage) ruft explizit mit offsetX=0 auf.
  let canvasRatio = (width - offsetX) / height;
  let imgRatio = imgW / imgH;
  let coverW, coverH;
  if (imgRatio > canvasRatio) { coverH = imgH; coverW = imgH * canvasRatio; }
  else { coverW = imgW; coverH = imgW / canvasRatio; }
  // vAnchor/hAnchor verschieben den beschnittenen Ausschnitt innerhalb des
  // Bildes: 0 = oberster/linker Bildrand sichtbar (Rest wird unten/rechts
  // beschnitten), 1 = unterster/rechter Bildrand sichtbar, 0.5 = zentriert
  // (bisheriges Verhalten).
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
