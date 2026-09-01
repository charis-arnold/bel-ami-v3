/* =============================================================================
   datenbereinigung.js — Datenbereinigung (reines JS)
   CAS Generative Data Design: Datenaufbereitung (Python, siehe data-prep/)
   → Datenbereinigung (hier, reines JS) → Zeichnen (sketch.js, p5).
   Enthält ausschliesslich reine Datenfunktionen — keine p5-Zeichenaufrufe.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 14 von 52 Namen intern, 38 exportiert. Konvention: docs/architektur.md.
// ACHTUNG Skript 1 in index.html. kreisgrafik.js liest hexZuRgb beim Laden
// — diese Datei nach hinten schieben bricht kreisgrafik.js.
(function () {

// Wortlaut wie in docs/topografie-der-gefuehle-grafik.pdf. Gelesen von der
// Legende (kreisgrafik.js) und der Annotationsleiste (sketch.js) — beide
// müssen dasselbe Wort zeigen.
const CATEGORY_LABELS = {
  gold_dunkel: 'Raum und Umwelt',
  gold_mittel: 'Stimmung und Emotion',
  gold_hell: 'Gesellschaft und Soziales',
};
const ROUTE_COLOR = '#63561F';

// Hex-Farbstring zu r/g/b. Nötig, weil p5s stroke() Hex und Alpha nicht
// gemeinsam annimmt, die Route aber variables Alpha braucht.
function hexZuRgb(hex) {
  let bereinigt = hex.replace('#', '');
  return {
    r: parseInt(bereinigt.substring(0, 2), 16),
    g: parseInt(bereinigt.substring(2, 4), 16),
    b: parseInt(bereinigt.substring(4, 6), 16),
  };
}
const ROUTE_COLOR_RGB = hexZuRgb(ROUTE_COLOR);

// Gegenrichtung: r/g/b-Tripel zu Hexstring. Nötig, wo eine Farbe als String
// gebraucht wird — der CSS-Verlauf der Annotationsleiste, der strokeStyle des
// Icons, drawHatchedCircle.
function rgbZuHex(rgb) {
  return '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');
}

// Ein einziges Orange für alles, was F-Wert heisst: die Punkte an den Kreisen,
// ihre Beschriftungen in der Legende, die Kapitelpunkte und die Routen-Hitze im
// Übersichtsakt, der Balken der Annotationsbox. Früher standen hier drei
// Abstufungen je F-Wert-Typ und ein eigener, dunklerer Ton für die Punkte —
// dadurch zeigte die Legende eine andere Farbe als die Karte daneben.
const FWERT_COLOR = '#C2511C';
const FWERT_COLOR_RGB = hexZuRgb(FWERT_COLOR);

// Punktgrösse 1..3 je F-Wert-Typ. Der seltene vierte Typ
// (persoenliche_sehnsucht, 1 Annotation) fehlt und fällt auf 1 zurück.
const FWERT_PUNKTGROESSE = {
  ort_loest_emotion_aus: 1, // Raum löst Emotion aus
  emotion_faerbt_raum: 2,   // Emotion färbt Raum
  koerper_als_sensor: 3,    // Körper als Sensor
};

// Pixel-Durchmesser je Punktgrösse. Steht hier neben FWERT_PUNKTGROESSE, weil
// beide dasselbe Mass in zwei Schritten ausdrücken; gelesen von kreisgrafik.js
// (die Punkte selbst) und fotomarker.js (leitet daraus seine Markergrösse ab).
const FWERT_PUNKT_DURCHMESSER = { 1: 5, 2: 7.5, 3: 10 };

// Ausformulierte Namen der drei F-Wert-Typen, Gegenstück zu CATEGORY_LABELS.
// Wortlaut wie im PDF, ohne das frühere Präfix «Wechselwirkung:».
const FWERT_LABELS = {
  ort_loest_emotion_aus: 'Der Raum löst die Emotion aus',
  emotion_faerbt_raum: 'Die Emotion beeinflusst die Raumwahrnehmung',
  koerper_als_sensor: 'Der Körper spürt',
};

// Die drei Valenzgruppen der F-Wert-Punkte, benannt wie im PDF.
// ACHTUNG das PDF schreibt «Neutral Wahrnehmung» — Tippfehler, hier bewusst
// korrigiert. Nicht «zurückkorrigieren», wenn jemand gegen das PDF abgleicht.
const WAHRNEHMUNG_LABELS = {
  pos: 'Positive Wahrnehmung',
  neg: 'Negative Wahrnehmung',
  neutral: 'Neutrale Wahrnehmung',
};

// Überschriften der beiden Legendenblöcke. Im PDF steht «GEFÜHLSKATEGORIEN»
// nur in der Textebene und ist weiss gerendert, also unsichtbar; hier wird sie
// sichtbar gezeichnet, spiegelbildlich zu «KÖRPER UND RAUM».
const LEGENDE_BLOCK_TITEL = {
  kategorien: 'GEFÜHLSKATEGORIEN',
  fwerte: 'KÖRPER UND RAUM',
};

// Beschriftungen rund um den Legendenkreis, ebenfalls wortgetreu aus dem PDF.
// Die Kreisgrösse steht mehrzeilig, damit der Block rechts nicht überbreit wird.
const LEGENDE_KREISGROESSE = [
  'Kreisgrösse:',
  'Anzahl Gefühlsäusserungen',
  'an diesem Ort',
  'Der Kreis wächst mit jedem',
  'geäusserten Gefühl.',
];
const LEGENDE_VALENZ = { pos: 'Anteil positiver Gefühle', neg: 'Anteil negativer Gefühle' };
const LEGENDE_ORTSBESCHRIFTUNG = 'ORTSBESCHRIFTUNG';

// Kopf der Legende, im PDF auf jeder Seite gleich.
const LEGENDE_TITEL = 'TOPOGRAFIE DER GEFÜHLE';
const LEGENDE_UNTERTITEL = 'Legende';

// Fotomarker: dunkles Blaugrau, bewusst NICHT aus der Orange-Reihe. Sonst
// stünden auf derselben Karte drei runde orange Zeichen mit drei Bedeutungen
// — F-Wert-Punkte, Kapitelpunkte und Fotomarker.
const FOTO_MARKER_FARBE = '#3A5058';
const FOTO_MARKER_FARBE_RGB = hexZuRgb(FOTO_MARKER_FARBE);
// Heller Kern im Marker, damit er auch auf dunklem Untergrund als Ring liest.
// Derselbe Ton wie der Grund der Graph-Ansicht, aber eine eigene Entscheidung.
const FOTO_MARKER_KERN_FARBE = '#E2E6E1';
const FOTO_MARKER_KERN_FARBE_RGB = hexZuRgb(FOTO_MARKER_KERN_FARBE);

// Schriften fürs Canvas. Spiegeln --sans/--serif in style.css; p5 kennt die
// CSS-Variablen nicht, deshalb hier als Literal.
const SCHRIFT_SANS = "'Source Sans 3', sans-serif";
const SCHRIFT_SERIF = "'Source Serif 4', serif";

// Harmonische Reihe: gleiche Sättigung und Helligkeit, Hue wandert 44°–50°.
// Die Schlüssel bleiben, daran hängt zaehleBandCounts.
const KREIS_KATEGORIEN = [
  { key: 'gold_dunkel', farbe: [198, 162, 43] },
  { key: 'gold_mittel', farbe: [188, 148, 143] },
  { key: 'gold_hell', farbe: [52, 64, 92] },
];

// Dieselben drei Farben als Hexstrings, für die Aufrufer, die keine Tripel
// nehmen (Annotationsleiste in sketch.js, Icon in kreisgrafik.js).
// ACHTUNG abgeleitet, nicht zweitgeschrieben: als eigene Liste driften die
// beiden Schreibweisen auseinander, sobald jemand nur eine davon anfasst.
const CATEGORY_COLORS = Object.fromEntries(
  KREIS_KATEGORIEN.map(kat => [kat.key, rgbZuHex(kat.farbe)]));

// Hat Kapitel X ein Spine-Panel? Kapitel 01 fehlt, es hat sein eigenes.
// Welche Orte darin stehen, entscheidet ortRunsFuerSpine() weiter unten.
const KAPITEL_MIT_SPINE_PANEL = new Set([
  '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18',
]);

// "Wohnung Duroy" und vier Mini-Erwähnungen daneben werden zu einem Punkt
// zusammengefasst; "Rue Notre-Dame de Lorette" bleibt ein eigener.
// ACHTUNG die Zuordnung läuft über die Erzählposition (ai), nicht über den
// ortBasis-Text: vor Annotation id 8 Sammelpunkt, ab id 8 die Strasse.
const WOHNUNG_SAMMELPUNKT_ANKER = 'Lokal in der Nähe der Rue Notre-Dame de Lorette';
const RUE_NOTRE_DAME_DE_LORETTE_ORT = 'Rue Notre-Dame de Lorette';
const WOHNUNG_SPLIT_ANNOTATION_ID = 8; // "Daraufhin ging er die Rue Notre-Dame de Lorette hinunter."
const WOHNUNG_SAMMELPUNKT_ABSORBIERTE_ORTRUNS = new Set([
  'Lokal mit festen Preisen nahe Rue Notre-Dame de Lorette',
  'Straße nahe Rue Notre-Dame de Lorette',
  'Boulevard',
  'Rue Notre-Dame de Lorette / Paris',
]);

// Erzählposition der Split-Annotation, siehe ACHTUNG oben.
function wohnungSplitAi(daten = stationenData) {
  let ai = daten.annotationen.findIndex(a => a.id === WOHNUNG_SPLIT_ANNOTATION_ID);
  return ai === -1 ? Infinity : ai;
}

const WOHNUNG_VOR_SPLIT_FILTER = (a, ai) => a.station === 0 && ai < wohnungSplitAi();
const RUE_NOTRE_DAME_FILTER = (a, ai) => a.station === 0 && ai >= wohnungSplitAi();

// Liefert je Ort den passenden Filter: Positions-Filter beim Wohnung-Split,
// Set aus Ort plus zugehörigen Gedanken-Orten, sonst der ortBasis-String.
function wohnungFilterFuerOrt(ort) {
  if (ort === WOHNUNG_SAMMELPUNKT_ANKER) return WOHNUNG_VOR_SPLIT_FILTER;
  if (ort === RUE_NOTRE_DAME_DE_LORETTE_ORT) return RUE_NOTRE_DAME_FILTER;
  let gedankenQuellen = Object.keys(GEDANKEN_ZIEL_ORT).filter(quelle => GEDANKEN_ZIEL_ORT[quelle] === ort);
  if (gedankenQuellen.length > 0) return new Set([ort, ...gedankenQuellen]);
  return ort;
}

// Die fünf gedachten Orte in Kapitel 1. Nur die Werte werden gelesen, die
// Schlüssel nennen den ortBasis-Text im Datensatz.
const GEDANKEN_FILTER = {
  'Champs-Élysées / Avenue du Bois de Boulogne': 'Champs-Élysées / Avenue du Bois de Boulogne',
  'Afrika (Erinnerung, Militärdienst)': 'Afrika',
  'Bois de Boulogne, Paris': 'Bois de Boulogne',
  'Parc Monceau, Paris': 'Parc Monceau',
  'imaginierter Sommergarten, Paris': 'imaginierter Sommergarten',
};

// Diese fünf bekommen keinen eigenen Kreis; sie zählen beim echten Ort mit,
// an dem Duroy gerade steht (GEDANKEN_ZIEL_ORT).
const GEDANKEN_ORTRUN_UNTERDRUECKT = new Set(
  Object.values(GEDANKEN_FILTER).filter(v => typeof v === 'string')
);

// Wohin eine gedachte Annotation zählt: zum letzten echten Ort davor in
// derselben station-Gruppe, wo Duroy physisch steht.
const GEDANKEN_ZIEL_ORT = {
  'Champs-Élysées / Avenue du Bois de Boulogne': 'Boulevard Poissonnière',
  'Afrika': 'Place de la Madeleine',
  'Bois de Boulogne': 'Café Américain',
  'Parc Monceau': 'Café Américain',
  'imaginierter Sommergarten': 'Café Américain',
};

// Unterdrückt dieser Ort seinen eigenen Auftritt? Betrifft die absorbierten
// Wohnung-Erwähnungen und die Gedanken-Orte.

// ACHTUNG das Gate daten === stationenData muss bleiben: beide Sets sind
// reine Namenslisten ohne Kapitelbezug, sonst verschluckt z.B. Kapitel 3
// seinen echten "Parc Monceau".
function istKapitel1Unterdrueckt(ort, daten) {
  if (daten !== stationenData) return false;
  return WOHNUNG_SAMMELPUNKT_ABSORBIERTE_ORTRUNS.has(ort)
      || GEDANKEN_ORTRUN_UNTERDRUECKT.has(ort);
}

// ortRun-Namen mit eigenem Spine-Eintrag: jeder Kartenkreis, ohne die oben
// unterdrückten.
function ortRunsFuerSpine(daten) {
  return new Set(
    (daten.ortRuns || [])
      .map(r => r.ort)
      .filter(ort => !istKapitel1Unterdrueckt(ort, daten))
  );
}

// Anteil 0..1 der Scrollstrecke (7343vh, .scroll-track in index.html).
// ACHTUNG bei geänderter Streckenlänge alle Werte umrechnen, sonst
// verschieben sich die Akte gegeneinander.
const SCROLL_MEILENSTEINE = {
  heroFadeStart: 0.014981, heroFadeEnd: 0.044941,
  // 960vh davor für den zwölfteiligen Intro-Crawl (.begleittext in
  // index.html), 80vh je Text, danach 874vh Legendenaufbau.
  // Zoomdauer unverändert 440vh.
  zoomStart: 0.303691, zoomEnd: 0.363612,
  // Crossfade Startkarte -> helle Überblickskarte, 80vh.
  kartenwechselStart: 0.173798, kartenwechselEnd: 0.184693,
  // Demo-Kreisgrafik: wächst über den Kreisgrössen-Schritt heran und schrumpft
  // ab zoomStart auf den Icon-Platz oben rechts. Davor steht nur der
  // Mittelpunkt mit seiner Ortsbeschriftung da (PDF-Seite 1); der Schleier
  // blendet in dieser Zeit ein, also von kartenwechselEnd bis demoStart.
  demoStart: 0.195587, demoVoll: 0.206482,
  // Legendenaufbau: neun Stufen à 80vh (PDF-Seiten 1-9), gesteuert von den neun
  // data-demo-gruppe-Texten in index.html. Ab legendeSchleierAus blendet der
  // Schleier über 80vh aus, erst danach beginnt der Zoom.
  legendeSchleierAus: 0.288614, legendeEnde: 0.299509,
  // Spine blendet gleichzeitig mit dem Zoom-Beginn ein.
  spineFadeStart: 0.143266, spineFadeEnd: 0.203187,
  // 200vh Lesezeit davor für den Kapitel-Einstiegstext.
  routeStart: 0.390849, routeEnd: 0.540651,
  // Kapitel-1-Ende: ab routeEnd der Projekttext-Einblender (140vh), ab
  // kapitelEndeStart die Kartenansicht mit Hinweis und den beiden Buttons
  // (100vh bis zur Klemme).
  kapitelEndeStart: 0.559717,
  // Übersichtsrouten 02–18. 2933vh breit, damit auch Kapitel 8 auf
  // ~7.3vh/Annotation kommt wie Kapitel 1.

  // ACHTUNG uebersichtRoutenStart ist zugleich die Klemme am Ende von
  // Kapitel 1: weiter scrollt draw() nicht. Einen Rauszoom-Akt gibt es nicht
  // mehr, in den Übersichtsakt führt nur noch ein Klick auf "Übersicht" oder
  // "Alle".

  // ACHTUNG uebersichtRoutenEnd ist die zweite Klemme und zugleich das Ende
  // der Strecke: dahinter liegen nur noch 200vh Auslauf, damit die Marke
  // überhaupt erreichbar bleibt. Der Ortsvergleich hat keine eigene Strecke
  // mehr — er läuft über den Play-Knopf, nicht über den Scroll.
  uebersichtRoutenStart: 0.573335, uebersichtRoutenEnd: 0.972764,
};

// ---------------------------------------------------------------------------
// Datenbereinigung (läuft einmal in setup(), bevor gezeichnet wird)
// ---------------------------------------------------------------------------

function bereinigeStationenDaten(rohdaten) {
  const arrayFuer = (wert) => Array.isArray(wert) ? wert : Object.values(wert || {});

  rohdaten.route = arrayFuer(rohdaten.route);
  rohdaten.gedanken = arrayFuer(rohdaten.gedanken);
  rohdaten.markierungen = arrayFuer(rohdaten.markierungen);
  rohdaten.routenPunkte = arrayFuer(rohdaten.routenPunkte);
  rohdaten.annotationen = arrayFuer(rohdaten.annotationen).filter(a => !a.deaktiviert);
  rohdaten.ortRuns = arrayFuer(rohdaten.ortRuns);

  return rohdaten;
}

function bereinigeFotoMarker(rohdaten) {
  return Array.isArray(rohdaten) ? rohdaten : Object.values(rohdaten || {});
}

// Filtert Kapitel ohne Routenpunkte. Schwelle bei EINEM Punkt, nicht zwei —
// am selben Objekt hängen auch Kapitelpunkt, Scheibe und Einstiegstext.
function bereinigeUebersichtsrouten(rohdaten) {
  let bereinigt = {};
  Object.entries(rohdaten || {}).forEach(([kapitel, punkte]) => {
    if (Array.isArray(punkte) && punkte.length > 0) bereinigt[kapitel] = punkte;
  });
  return bereinigt;
}

// ---------------------------------------------------------------------------
// Kreis-Radius / Kreispunkte
// ---------------------------------------------------------------------------

// Flächenproportional (sqrt), Standard bei proportional symbol maps: die
// Fläche wächst linear mit n. maxRadius deckelt, der Schlussakt gibt Infinity.
function kreisRadius(n, maxRadius = 100) {
  const BASIS = 6, K = 15.5;
  return n > 0 ? Math.min(maxRadius, BASIS + K * Math.sqrt(n)) : 0;
}

// Aussenradius des ganzen Kreisdiagramms, an dem die F-Wert-Punkte ansetzen.

// ACHTUNG umgekehrte Parameterreihenfolge: zeichneKreiseFuerRun() nimmt
// (…, radiusSkala, maxRadius), hier steht (…, maxRadius, radiusSkala).
function groessterKreisRadius(bandCounts, maxRadius = 100, radiusSkala = 1) {
  let groesster = 0;
  KREIS_KATEGORIEN.forEach(kat => {
    let b = bandCounts[kat.key] || {};
    let n = (b.neg || 0) + (b.pos || 0) + (b.neutral || 0) + (b.unrated || 0);
    groesster = Math.max(groesster, kreisRadius(n, maxRadius) * radiusSkala);
  });
  return groesster;
}

// Ein Ort, der im Text nur vorab erwähnt wird, bekommt noch keinen Kreis —
// den zeichnet die Station an seinem echten Halt.
function istVorzeitigeErwaehnung(r, daten = stationenData) {
  let halteort = (daten.halteorte || []).find(h => h.name === r.ort);
  return !!halteort && halteort.revealIndex !== r.revealIndex;
}

// Bekommt dieser ortRun beim aktuellen Scrollstand einen Kartenkreis?
// punktIndex steuert das Erscheinen, annIndex den Wohnung-Split.
function ortRunSichtbar(r, punktIndex, annIndex, daten = stationenData) {
  if (punktIndex < r.revealIndex) return false;
  if (istVorzeitigeErwaehnung(r, daten)) return false;
  if (istKapitel1Unterdrueckt(r.ort, daten)) return false;
  // Zeitabhängig, deshalb nicht in istKapitel1Unterdrueckt.
  if (daten === stationenData && r.ort === RUE_NOTRE_DAME_DE_LORETTE_ORT
      && annIndex < wohnungSplitAi(daten)) return false;
  return true;
}

// ACHTUNG muss mit valenz_bucket() in baue-kapitel-stationen.py
// übereinstimmen: vorberechnete bandCounts kommen von dort, live gezählte
// entstehen hier.
function valenzBucket(v) {
  if (v === 1) return 'pos';
  if (v === -1) return 'neg';
  if (v === 0) return 'neutral';
  return 'unrated';
}

// Rohe Trefferliste statt Zählung. Die F-Wert-Punkte brauchen je Annotation
// Valenz und fWertType, was eine Aggregation nicht mehr hergibt.
function sammleAnnotationenNachOrtBasis(filter, annIndex, daten = stationenData) {
  let ortBasisWerte = filter instanceof Set ? filter : new Set([filter]);
  return daten.annotationen.filter((a, ai) => {
    if (ai > annIndex) return false;
    let treffer = typeof filter === 'function' ? filter(a, ai)
      : typeof filter === 'number' ? a.id === filter
      : ortBasisWerte.has(a.ortBasis || a.ort || '');
    return treffer && a.category;
  });
}

// Zählt eine bereits gefilterte Trefferliste zusammen. Getrennt vom Sammeln,
// damit Aufrufer mit beidem nur einmal über daten.annotationen laufen.
function zaehleBandCounts(annotationen) {
  let ergebnis = {
    gold_dunkel: { unrated: 0, neg: 0, pos: 0, neutral: 0 },
    gold_mittel: { unrated: 0, neg: 0, pos: 0, neutral: 0 },
    gold_hell: { unrated: 0, neg: 0, pos: 0, neutral: 0 },
  };
  annotationen.forEach(a => {
    ergebnis[a.category][valenzBucket(a.valenz)]++;
  });
  return ergebnis;
}

// Sammeln und Zählen in einem Aufruf, für Stellen ohne Bedarf an der Liste.
function zaehleAnnotationenLiveNachOrtBasis(filter, annIndex, daten = stationenData) {
  return zaehleBandCounts(sammleAnnotationenNachOrtBasis(filter, annIndex, daten));
}

// ---------------------------------------------------------------------------
// Spine-Daten
// ---------------------------------------------------------------------------

// Ein Eintrag je zusammenhängendem Besuch. Läuft über daten.annotationen,
// nicht über daten.ortRuns: nur dort ist eine Rückkehr erkennbar.
function baueSpineDaten(daten, hauptorte) {
  let eintraege = [];
  let indexNachOrt = new Map(); // ortBasis-Name -> Index in eintraege
  let laufenderOrt = null; // welcher zusammenhängende Besuch gerade läuft

  (daten.annotationen || []).forEach((a, ai) => {
    let ort = a.ortBasis || a.ort || '';
    if (!hauptorte.has(ort)) { laufenderOrt = null; return; }

    if (laufenderOrt === ort) return; // derselbe Besuch läuft weiter, kein neuer Eintrag
    laufenderOrt = ort;

    if (indexNachOrt.has(ort)) {
      eintraege.push({ typ: 'rueckkehr', text: ort, rv: ai, zielIndex: indexNachOrt.get(ort) });
    } else {
      indexNachOrt.set(ort, eintraege.length);
      eintraege.push({ typ: 'location', text: ort, rv: ai, ortBasis: ort });
    }
  });

  return eintraege;
}


// --- Export ------------------------------------------------------------
// 32 Namen, die grösste Schnittstelle im Projekt. Leser: docs/architektur.md.

// Farben, Kategorien, Punktgrössen
window.CATEGORY_COLORS = CATEGORY_COLORS;
window.CATEGORY_LABELS = CATEGORY_LABELS;
window.KREIS_KATEGORIEN = KREIS_KATEGORIEN;
window.ROUTE_COLOR = ROUTE_COLOR;
window.ROUTE_COLOR_RGB = ROUTE_COLOR_RGB;
window.FWERT_COLOR = FWERT_COLOR;
window.FWERT_COLOR_RGB = FWERT_COLOR_RGB;
window.FWERT_PUNKTGROESSE = FWERT_PUNKTGROESSE;
window.FWERT_PUNKT_DURCHMESSER = FWERT_PUNKT_DURCHMESSER;
window.FWERT_LABELS = FWERT_LABELS;
window.WAHRNEHMUNG_LABELS = WAHRNEHMUNG_LABELS;
window.LEGENDE_BLOCK_TITEL = LEGENDE_BLOCK_TITEL;
window.LEGENDE_KREISGROESSE = LEGENDE_KREISGROESSE;
window.LEGENDE_VALENZ = LEGENDE_VALENZ;
window.LEGENDE_ORTSBESCHRIFTUNG = LEGENDE_ORTSBESCHRIFTUNG;
window.LEGENDE_TITEL = LEGENDE_TITEL;
window.LEGENDE_UNTERTITEL = LEGENDE_UNTERTITEL;
window.FOTO_MARKER_FARBE_RGB = FOTO_MARKER_FARBE_RGB;
window.FOTO_MARKER_KERN_FARBE_RGB = FOTO_MARKER_KERN_FARBE_RGB;
window.SCHRIFT_SANS = SCHRIFT_SANS;
window.SCHRIFT_SERIF = SCHRIFT_SERIF;

// Stammdaten: welche Kapitel, welche Scroll-Marken, welcher Sammelpunkt
window.KAPITEL_MIT_SPINE_PANEL = KAPITEL_MIT_SPINE_PANEL;
window.SCROLL_MEILENSTEINE = SCROLL_MEILENSTEINE;
window.WOHNUNG_SAMMELPUNKT_ANKER = WOHNUNG_SAMMELPUNKT_ANKER;

// Eingangsdaten bereinigen (nur preload/setup in sketch.js)
window.bereinigeStationenDaten = bereinigeStationenDaten;
window.bereinigeFotoMarker = bereinigeFotoMarker;
window.bereinigeUebersichtsrouten = bereinigeUebersichtsrouten;

// Annotationen sammeln und zählen (die heissen Pfade, siehe draw())
window.sammleAnnotationenNachOrtBasis = sammleAnnotationenNachOrtBasis;
window.zaehleBandCounts = zaehleBandCounts;
window.zaehleAnnotationenLiveNachOrtBasis = zaehleAnnotationenLiveNachOrtBasis;

// Kreisgeometrie und Farbumrechnung
window.hexZuRgb = hexZuRgb;
window.rgbZuHex = rgbZuHex;
window.kreisRadius = kreisRadius;
window.groessterKreisRadius = groessterKreisRadius;

// Orte, Sichtbarkeit, Spine-Aufbau
window.wohnungFilterFuerOrt = wohnungFilterFuerOrt;
window.ortRunSichtbar = ortRunSichtbar;
window.ortRunsFuerSpine = ortRunsFuerSpine;
window.baueSpineDaten = baueSpineDaten;

})(); // Ende der Modulkapselung, siehe Kommentar oben
