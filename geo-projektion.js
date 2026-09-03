/* =============================================================================
   geo-projektion.js — von Koordinaten zu Bildschirmpunkten

   Diese Datei beantwortet eine einzige Frage: Wo auf dem Bildschirm liegt ein
   Ort, von dem ich Längen- und Breitengrad kenne? Alles, was auf der Karte
   gezeichnet wird, fragt zuerst hier nach (lonLatToScreen).

   Gerechnet wird ganz einfach mit Dreisatz: Der linke Bildrand ist der
   westlichste Längengrad, der rechte der östlichste, dazwischen wird linear
   verteilt. Echte Weltkarten brauchen dafür kompliziertere Formeln
   (Mercator-Projektion), weil die Erde eine Kugel ist. Auf dem kleinen
   Ausschnitt von Paris ist der Unterschied so winzig, dass man ihn nicht sieht.

   Eine "Bbox" (bounding box) ist in dieser Datei immer dasselbe: ein Objekt
   mit den vier Rändern west, east, south, north in Grad.
============================================================================= */

// Zu jedem Kartenbild gehören die Koordinaten seiner vier Ränder. Nur damit
// weiss das Programm, welcher Punkt im Bild welchem Ort entspricht.
//
// ACHTUNG die beiden Übersichtskarten sehen gleich aus, zeigen aber NICHT
// denselben Ausschnitt: Sie sind gleich gross in Pixeln, in QGIS aber um 568 m
// gegeneinander verschoben exportiert worden. Jede braucht darum ihre eigenen
// Randwerte. Mit gemeinsamen Werten lagen die Routen 46 px neben den Strassen.
// Wie das gefunden wurde, steht in docs/bugfix-log.md, Fix 2.

// paris-startkarte-web.png (Startseite und Schlusskarte).
// QGIS EPSG:3857: X 247340.000 .. 270290.000, Y 6245109.800 .. 6256840.000
let startBbox = { west: 2.221893023741224, east: 2.4280563814466545, south: 48.82435089471847, north: 48.89367804058055 };

// paris-ueberblickkarte-web.png (Übersichtsakt), Basis wie die Kapitelkarten.
// QGIS EPSG:3857: X 247907.651 .. 270857.651, Y 6244994.107 .. 6256724.107
let uebersichtBbox = { west: 2.2269923194085774, east: 2.4331556771226127, south: 48.82366665448583, north: 48.892993566082404 };

// Der Bereich, den beide Übersichtskarten gemeinsam abdecken. Beim Überblenden
// von der einen auf die andere bleibt der gezeigte Ausschnitt in diesem
// Bereich. Sonst zeigten die beiden Bilder verschiedene Gegenden und das Bild
// würde beim Wechsel springen.
const UEBERSICHT_SCHNITT_BBOX = {
  west: Math.max(startBbox.west, uebersichtBbox.west),
  east: Math.min(startBbox.east, uebersichtBbox.east),
  south: Math.max(startBbox.south, uebersichtBbox.south),
  north: Math.min(startBbox.north, uebersichtBbox.north),
};

// Die Karte von Kapitel 1 (kapitel01-qgis-karte-web.png). Die Zahlen stimmen
// nachweislich, aber es ist nicht mehr aufgeschrieben, aus welchem
// QGIS-Export sie stammen.
//
// ACHTUNG die .pgw-Dateien in data-prep/export sehen aus, als gehörten sie zu
// diesem Bild — sie tun es nicht. Mit ihren Werten läge die ganze Route 1.5 km
// zu weit östlich. Siehe docs/cleanup-log.md, Schritt 10.
let ch1ImgBbox = { west: 2.317834413581757, east: 2.352393886019969, south: 48.86683338890839, north: 48.881871498351956 };

// Die Karte sitzt nicht mittig im Fenster, sondern 250 px nach links versetzt:
// rechts steht das Kapitelmenü, links soll trotzdem Paris zu sehen sein.
let mapOffsetX = -250;
let mapOffsetY = 0;

// Sucht den grössten Ausschnitt aus einem Bild, der das Fenster ganz ausfüllt,
// ohne das Bild zu verzerren. Dasselbe, was in CSS "background-size: cover"
// macht: lieber oben und unten (oder links und rechts) etwas abschneiden, als
// das Bild in die Länge ziehen.
function coverCrop(imgW, imgH, vAnchor = 0.5, hAnchor = 0.5, offsetX = mapOffsetX) {
  // Gerechnet wird mit der Breite, die die Karte wirklich einnimmt
  // (width - offsetX). Sonst bliebe rechts ein grauer Streifen frei.
  // Die mittig stehende Übersichtskarte ruft deshalb mit offsetX = 0 auf.
  let canvasRatio = (width - offsetX) / height;
  let imgRatio = imgW / imgH;
  let coverW, coverH;
  if (imgRatio > canvasRatio) { coverH = imgH; coverW = imgH * canvasRatio; }
  else { coverW = imgW; coverH = imgW / canvasRatio; }
  // vAnchor und hAnchor sagen, welcher Teil des Bildes übrig bleiben soll:
  // 0 = oben beziehungsweise links, 1 = unten beziehungsweise rechts,
  // 0.5 = die Mitte.
  return { x: (imgW - coverW) * hAnchor, y: (imgH - coverH) * vAnchor, w: coverW, h: coverH };
}

// Das Herzstück: Längengrad und Breitengrad hinein, x und y auf dem Bildschirm
// heraus. map() ist p5s Dreisatz — "lon liegt zwischen west und east, also
// liegt x im selben Verhältnis zwischen linkem und rechtem Rand".
// Beim y gehen north und south absichtlich verkehrt herum hinein: Auf dem
// Bildschirm zählt y nach unten, beim Breitengrad ist oben der grössere Wert.
function lonLatToScreen(lon, lat, bbox, offsetX = mapOffsetX, offsetY = mapOffsetY) {
  let x = map(lon, bbox.west, bbox.east, 0, width - offsetX) + offsetX;
  let y = map(lat, bbox.north, bbox.south, 0, height) + offsetY;
  return { x, y };
}

// Umgekehrter Weg, aber im Bild statt auf dem Bildschirm: Zu einem Gebiet
// (bbox) sucht die Funktion den passenden Ausschnitt im Kartenbild. refBbox
// sind die Ränder des ganzen Bildes, imgW und imgH seine Pixelmasse.
// constrain() sorgt dafür, dass der Ausschnitt nicht über das Bild hinausragt.
function bboxToImgCrop(bbox, refBbox, imgW, imgH) {
  let x0 = map(bbox.west, refBbox.west, refBbox.east, 0, imgW);
  let y0 = map(bbox.north, refBbox.north, refBbox.south, 0, imgH);
  let x1 = map(bbox.east, refBbox.west, refBbox.east, 0, imgW);
  let y1 = map(bbox.south, refBbox.north, refBbox.south, 0, imgH);
  x0 = constrain(x0, 0, imgW); y0 = constrain(y0, 0, imgH);
  x1 = constrain(x1, 0, imgW); y1 = constrain(y1, 0, imgH);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

// Und dasselbe rückwärts: zu einem Ausschnitt im Bild die Koordinaten seiner
// vier Ränder. Wird gebraucht, um zu wissen, welches Gebiet gerade zu sehen
// ist — die Kreise und Marker richten sich danach.
function cropToBbox(crop, refBbox, imgW, imgH) {
  return {
    west: map(crop.x, 0, imgW, refBbox.west, refBbox.east),
    east: map(crop.x + crop.w, 0, imgW, refBbox.west, refBbox.east),
    north: map(crop.y, 0, imgH, refBbox.north, refBbox.south),
    south: map(crop.y + crop.h, 0, imgH, refBbox.north, refBbox.south),
  };
}

// Schiebt ein Gebiet so zurecht, dass es ganz in einen erlaubten Rahmen passt,
// ohne seine Form zu ändern. Zwei Schritte: erst gleichmässig verkleinern, bis
// es hineinpasst, dann so weit schieben, dass keine Kante mehr übersteht.
// Gebraucht beim Kartenwechsel, damit der Ausschnitt in beiden Bildern liegt.
function passeBboxInRahmen(bbox, rahmen) {
  let breite = bbox.east - bbox.west;
  let hoehe = bbox.north - bbox.south;
  let f = Math.min(1, (rahmen.east - rahmen.west) / breite, (rahmen.north - rahmen.south) / hoehe);
  let mitteX = (bbox.west + bbox.east) / 2;
  let mitteY = (bbox.south + bbox.north) / 2;
  breite *= f;
  hoehe *= f;
  let b = { west: mitteX - breite / 2, east: mitteX + breite / 2, south: mitteY - hoehe / 2, north: mitteY + hoehe / 2 };
  // Nur so weit schieben, wie tatsächlich etwas übersteht. Max(0, …) heisst:
  // steht nichts über, ist der Wert 0 und es wird nicht geschoben.
  let dx = Math.max(0, rahmen.west - b.west) - Math.max(0, b.east - rahmen.east);
  let dy = Math.max(0, rahmen.south - b.south) - Math.max(0, b.north - rahmen.north);
  return { west: b.west + dx, east: b.east + dx, south: b.south + dy, north: b.north + dy };
}
