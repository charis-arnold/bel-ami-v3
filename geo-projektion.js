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
   datenbereinigung.js und vor allen anderen Modulen: fotomarker.js wertet
   mapOffsetX/mapOffsetY beim Laden aus (siehe letzterFotoOffsetX dort), und
   alle übrigen Module greifen zur Laufzeit hierher.

   NICHT hier: haversineMeter(). Die Funktion sitzt in kartendekor.js, wo
   zeichneMassstabsleiste() ihr einziger Aufrufer ist — sie berechnet echte
   Meterdistanzen für die Balkenlänge, nicht die Bildschirmprojektion.
============================================================================= */

// Georeferenz der beiden Übersichtskarten (Startseite und Überblickseite).
//
// ACHTUNG — die beiden Bilder zeigen NICHT denselben Ausschnitt. Sie haben
// dieselben Pixelmasse (6000 x 3067) und dieselbe Ausdehnung (22950 x 11730 m),
// stammen aber aus zwei QGIS-Exporten mit um 568 m verschobenem Kartenfenster.
// Sie brauchen deshalb JE EINE EIGENE Bbox. Bis 20.08.2026 trugen beide
// dieselben Werte (die der Überblickskarte); die Routen lagen dadurch auf der
// Start- und Schlusskarte um 568 m — 148 px im Bild, rund 46 px auf dem
// Bildschirm — neben den Strassen. Siehe docs/bugfix-log.md, Fix 2.
//
// Beide Werte sind aus QGIS in EPSG:3857 abgelesen und mit derselben
// Web-Mercator-Formel umgerechnet wie die Kapitelkarten (x2lon/y2lat, siehe
// data-prep/05 bereinigen/schneide-kapitelkarten.py).
//
// Gegenprobe für beide Bilder, mit einem Fixpunkt, der keine Auslegung
// zulässt: die Place de l'Étoile, deren zwölf Avenuen strahlenförmig von
// einem Punkt ausgehen (2.2950 / 48.8738). Auf jedem der beiden Bilder trifft
// NUR die jeweils zugehörige Bbox das Sternzentrum; die andere landet rund
// 148 px westlich davon in einem Häuserblock.

// startBbox — paris-startkarte-web.png (Startseite UND Schlusskarte, siehe
// currentBgBbox in draw()). QGIS EPSG:3857:
// X 247340.000 .. 270290.000, Y 6245109.800 .. 6256840.000
let startBbox = { west: 2.221893023741224, east: 2.4280563814466545, south: 48.82435089471847, north: 48.89367804058055 };

// uebersichtBbox — paris-ueberblickkarte-web.png (Übersichtsakt mit allen 18
// Routen). QGIS EPSG:3857:
// X 247907.651 .. 270857.651, Y 6244994.107 .. 6256724.107
// Identisch mit BASIS_3857 in schneide-kapitelkarten.py: dieses Bild liegt auf
// derselben Grundlage wie die geschnittenen Kapitelkarten.
let uebersichtBbox = { west: 2.2269923194085774, east: 2.4331556771226127, south: 48.82366665448583, north: 48.892993566082404 };

// ch1ImgBbox — kapitel01-qgis-karte-web.png (Kapitel-1-Kartenausschnitt).
//
// Anders als bei den beiden Bboxen darüber ist der QGIS-Ursprung dieses Werts
// NICHT überliefert. Rückgerechnet ergibt er X 258020.147 .. 261867.290,
// Y 6252295.939 .. 6254841.177 — keine runden Zahlen, während dieselbe
// Rückrechnung bei startBbox/uebersichtBbox exakt die oben notierten
// Ausschnitte trifft. Der Wert stammt also nicht aus einem in QGIS
// abgelesenen Ausschnitt; wie er entstanden ist, ist nicht festgehalten.
//
// Überprüft und korrekt am 20.08.2026, nach derselben Methode wie oben
// (Gegenprobe an eindeutigen Fixpunkten), hier mit zwei Plätzen aus den
// echten Kapitel-1-Daten: Place de la Madeleine (2.324236 / 48.869718) trifft
// den Platz zwischen Boulevard Malesherbes, Rue Royale und Rue Boissy
// d'Anglas; Place de l'Opéra (2.330905 / 48.871706) trifft das Opernhaus
// zwischen Rue Scribe, Rue Gluck und Rue Auber. Alle 18 ortRuns von Kapitel 1
// liegen im Bild.
//
// Die beiden .pgw-Weltdateien in data-prep/export (gelöscht in d69a78b)
// gehören NICHT zu diesem Bild: sie beschreiben ein rund 10 % weiteres, mit
// dem Mittelpunkt 1138 m östlich und 412 m südlich versetztes Kartenfenster.
// Ihre Werte hier einzusetzen zöge die Route rund 1.5 km nach Osten.
//
// Wird kapitel01-qgis-karte-web.png je neu exportiert, gehören die exakten
// QGIS-Koordinaten (X min/max, Y min/max in EPSG:3857) hierher — im selben
// Format wie bei startBbox/uebersichtBbox. Ohne sie lässt sich der Wert nicht
// nachziehen, sondern nur wieder empirisch gegenprüfen.
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
