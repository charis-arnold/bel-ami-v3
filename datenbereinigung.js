/* =============================================================================
   datenbereinigung.js — Datenbereinigung (reines JS)
   CAS Generative Data Design: Datenaufbereitung (Python, siehe data-prep/)
   → Datenbereinigung (hier, reines JS) → Zeichnen (sketch.js, p5).
   Enthält ausschliesslich reine Datenfunktionen — keine p5-Zeichenaufrufe.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 12 von 38 Namen intern, 26 exportiert. Konvention: docs/architektur.md.
// ACHTUNG Skript 1 in index.html. kreisgrafik.js liest hexZuRgb beim Laden
// — diese Datei nach hinten schieben bricht kreisgrafik.js.
(function () {

const CATEGORY_COLORS = { gold_dunkel: '#63561F', gold_mittel: '#917712', gold_hell: '#BF9E16' };
const CATEGORY_LABELS = { gold_dunkel: 'Raum & Umwelt', gold_mittel: 'Stimmung & Emotion', gold_hell: 'Soziales' };
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

const FWERT_COLOR = '#C2511C';
const FWERT_COLOR_RGB = hexZuRgb(FWERT_COLOR); // z.B. Fotomarker-Asterisk
const FWERT_COLORS = {
  ort_loest_emotion_aus: '#AB3F0C',
  emotion_faerbt_raum: '#C2511C',
  koerper_als_sensor: '#A03705',
};

// Punktgrösse 1..3 je F-Wert-Typ. Der seltene vierte Typ
// (persoenliche_sehnsucht, 1 Annotation) fehlt und fällt auf 1 zurück.
const FWERT_PUNKTGROESSE = {
  ort_loest_emotion_aus: 1, // Raum löst Emotion aus
  emotion_faerbt_raum: 2,   // Emotion färbt Raum
  koerper_als_sensor: 3,    // Körper als Sensor
};

// Einheitlich für alle F-Wert-Punkte. Nicht FWERT_COLORS oben, das ist die
// Annotationsleiste.
const FWERT_PUNKT_FARBE = '#AB3F0C';

const KREIS_KATEGORIEN = [
  { key: 'gold_dunkel', farbe: [142, 117, 42] },
  { key: 'gold_mittel', farbe: [206, 169, 62] },
  { key: 'gold_hell', farbe: [202, 179, 122] },
];

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

// Anteil 0..1 der Scrollstrecke (9300vh, .scroll-track in index.html).
// ACHTUNG bei geänderter Streckenlänge alle Werte umrechnen, sonst
// verschieben sich die Akte gegeneinander.
const SCROLL_MEILENSTEINE = {
  heroFadeStart: 0.011829, heroFadeEnd: 0.035485,
  // 700vh Lesezeit davor: der Begleittext bleibt auf der Startseite lesbar.
  zoomStart: 0.110753, zoomEnd: 0.158065,
  // Spine blendet gleichzeitig mit dem Zoom-Beginn ein.
  spineFadeStart: 0.113118, spineFadeEnd: 0.16043,
  // 550vh Lesezeit davor für den Kapitel-Einstiegstext.
  routeStart: 0.252689, routeEnd: 0.370968,
  // Akt: nach Abschluss der Route zurück auf die Gesamtkarte zoomen.
  zoomOutStart: 0.370968, zoomOutEnd: 0.418279,
  // Übersichtsrouten 02–18. 2933vh breit, damit auch Kapitel 8 auf
  // ~7.3vh/Annotation kommt wie Kapitel 1.
  uebersichtRoutenStart: 0.418279, uebersichtRoutenEnd: 0.733656,
  // Schlussakt Ortsveränderung (2000vh): Kreise der sieben VERGLEICHS_KNOTEN
  // wachsen mit jedem Kapitel. kreisVergleichFadeEnd liest niemand.
  kreisVergleichStart: 0.733656, kreisVergleichFadeEnd: 0.750967,
  kreisVergleichEnd: 0.94871,
  // Die Startkarte kommt zurück und zoomt auf die Gesamtkarte raus.
  startkarteStart: 0.94871,
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
  const BASIS = 6, K = 11.5;
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
// 26 Namen, die grösste Schnittstelle im Projekt. Leser: docs/architektur.md.

// Farben, Kategorien, Punktgrössen
window.CATEGORY_COLORS = CATEGORY_COLORS;
window.CATEGORY_LABELS = CATEGORY_LABELS;
window.KREIS_KATEGORIEN = KREIS_KATEGORIEN;
window.ROUTE_COLOR = ROUTE_COLOR;
window.ROUTE_COLOR_RGB = ROUTE_COLOR_RGB;
window.FWERT_COLOR = FWERT_COLOR;
window.FWERT_COLOR_RGB = FWERT_COLOR_RGB;
window.FWERT_COLORS = FWERT_COLORS;
window.FWERT_PUNKTGROESSE = FWERT_PUNKTGROESSE;
window.FWERT_PUNKT_FARBE = FWERT_PUNKT_FARBE;

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
window.kreisRadius = kreisRadius;
window.groessterKreisRadius = groessterKreisRadius;

// Orte, Sichtbarkeit, Spine-Aufbau
window.wohnungFilterFuerOrt = wohnungFilterFuerOrt;
window.ortRunSichtbar = ortRunSichtbar;
window.ortRunsFuerSpine = ortRunsFuerSpine;
window.baueSpineDaten = baueSpineDaten;

})(); // Ende der Modulkapselung, siehe Kommentar oben
