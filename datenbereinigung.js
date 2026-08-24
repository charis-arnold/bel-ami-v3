/* =============================================================================
   datenbereinigung.js — Datenbereinigung (reines JS)
   CAS Generative Data Design: Datenaufbereitung (Python, siehe data-prep/)
   → Datenbereinigung (hier, reines JS) → Zeichnen (sketch.js, p5).
   Enthält ausschliesslich reine Datenfunktionen — keine p5-Zeichenaufrufe.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 12 von 38 Namen intern, 26 im Exportblock am Dateiende.
// Konvention: docs/architektur.md.
//
// Ladereihenfolge kritisch: Skript 1 in index.html, und kreisgrafik.js
// (Skript 3) liest hexZuRgb und FWERT_PUNKT_FARBE beim Laden. Die IIFE
// läuft sofort, der Export steht am Dateiende — beide liegen auf window,
// bevor Skript 2 beginnt. Diese Datei nach hinten schieben bricht
// kreisgrafik.js.
(function () {

const CATEGORY_COLORS = { gold_dunkel: '#63561F', gold_mittel: '#917712', gold_hell: '#BF9E16' };
const CATEGORY_LABELS = { gold_dunkel: 'Raum & Umwelt', gold_mittel: 'Stimmung & Emotion', gold_hell: 'Soziales' };
const ROUTE_COLOR = '#63561F';

// Wandelt einen Hex-Farbstring ('#rrggbb') in einzelne r/g/b-Komponenten um —
// wird gebraucht, damit ROUTE_COLOR (ein Hex-String) auch dort als einzige
// Quelle dient, wo die Route mit variablem Alpha gezeichnet wird (p5's
// stroke() nimmt Hex+Alpha nicht gemeinsam entgegen).
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
const FWERT_COLOR_RGB = hexZuRgb(FWERT_COLOR); // z.B. für den Fotomarker-Asterisk (fill() mit variablem Alpha, siehe zeichneFotoMarker)
const FWERT_COLORS = {
  ort_loest_emotion_aus: '#AB3F0C',
  emotion_faerbt_raum: '#C2511C',
  koerper_als_sensor: '#A03705',
};

// Punktgrösse (1 = klein … 3 = gross) der F-Wert-Punkte ausserhalb des
// Kreisdiagramms je F-Wert-Typ (siehe zeichneFwertPunkte, kreisgrafik.js).
// Ein
// vierter, sehr seltener Typ (persoenliche_sehnsucht, gesamthaft nur 1
// Annotation) hat keine eigene Grösse — fällt beim Aufrufer auf 1 zurück.
const FWERT_PUNKTGROESSE = {
  ort_loest_emotion_aus: 1, // Raum löst Emotion aus
  emotion_faerbt_raum: 2,   // Emotion färbt Raum
  koerper_als_sensor: 3,    // Körper als Sensor
};

// Farbe aller F-Wert-Punkte (einheitlich, unabhängig von Grösse/Typ) — nicht
// zu verwechseln mit FWERT_COLORS oben, das für die Annotationsleiste bleibt.
const FWERT_PUNKT_FARBE = '#AB3F0C';

const KREIS_KATEGORIEN = [
  { key: 'gold_dunkel', farbe: [142, 117, 42] },
  { key: 'gold_mittel', farbe: [206, 169, 62] },
  { key: 'gold_hell', farbe: [202, 179, 122] },
];

// Reine Existenz-Prüfung ("hat Kapitel X überhaupt ein Spine-Panel?", gelesen
// von springeZuKapitelZoom/oeffneKapitelZoom in uebersichtsrouten.js und vom
// Kapitelregister). Kapitel 01 nicht enthalten: es hat sein eigenes Panel.
// Welche Orte darin stehen, entscheidet für alle Kapitel ortRunsFuerSpine()
// weiter unten, aus denselben ortRuns wie die Kartenkreise.
const KAPITEL_MIT_SPINE_PANEL = new Set([
  '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18',
]);

// "Wohnung Duroy" und mehrere Mini-Erwähnungen direkt daneben (Lokal mit
// festen Preisen, Straße nahe, Boulevard, Rue Notre-Dame de Lorette / Paris)
// werden zu einem gemeinsamen Punkt zusammengefasst, damit Route und Spine
// nur einen wachsenden Kreis zeigen statt mehrerer fast übereinanderliegender
// Mini-Kreise. "Rue Notre-Dame de Lorette" selbst bleibt bewusst ein eigener,
// separater Punkt (bekommt seine eigene, leicht nach Osten versetzte
// Koordinate).
//
// Die Zuordnung erfolgt NICHT über den ortBasis-Text, sondern über die
// Position in der Erzählreihenfolge (ai): alle station-0-Annotationen VOR
// der Annotation "Daraufhin ging er die Rue Notre-Dame de Lorette
// hinunter." (id 8) lassen den Sammelpunkt wachsen, alle AB dieser
// Annotation (auch "Rue Notre-Dame de Lorette / Paris", id 12, die textlich
// erst danach kommt) lassen "Rue Notre-Dame de Lorette" wachsen.
const WOHNUNG_SAMMELPUNKT_ANKER = 'Lokal in der Nähe der Rue Notre-Dame de Lorette';
const RUE_NOTRE_DAME_DE_LORETTE_ORT = 'Rue Notre-Dame de Lorette';
const WOHNUNG_SPLIT_ANNOTATION_ID = 8; // "Daraufhin ging er die Rue Notre-Dame de Lorette hinunter."
const WOHNUNG_SAMMELPUNKT_ABSORBIERTE_ORTRUNS = new Set([
  'Lokal mit festen Preisen nahe Rue Notre-Dame de Lorette',
  'Straße nahe Rue Notre-Dame de Lorette',
  'Boulevard',
  'Rue Notre-Dame de Lorette / Paris',
]);

// Reihenfolge-Position (ai) der Split-Annotation — alles davor gehört zum
// Sammelpunkt, alles ab hier zu "Rue Notre-Dame de Lorette".
function wohnungSplitAi(daten = stationenData) {
  let ai = daten.annotationen.findIndex(a => a.id === WOHNUNG_SPLIT_ANNOTATION_ID);
  return ai === -1 ? Infinity : ai;
}

const WOHNUNG_VOR_SPLIT_FILTER = (a, ai) => a.station === 0 && ai < wohnungSplitAi();
const RUE_NOTRE_DAME_FILTER = (a, ai) => a.station === 0 && ai >= wohnungSplitAi();

// Wählt für "Lokal in der Nähe…" bzw. "Rue Notre-Dame de Lorette" den
// passenden Positions-Filter; für einen Ort, bei dem laut GEDANKEN_ZIEL_ORT
// noch ein oder mehrere gedachte Orte mitzählen sollen, ein Set aus ihm
// selbst plus diesen; für alle anderen Orte den ortBasis-String selbst
// (Standardverhalten von zaehleAnnotationenLiveNachOrtBasis).
function wohnungFilterFuerOrt(ort) {
  if (ort === WOHNUNG_SAMMELPUNKT_ANKER) return WOHNUNG_VOR_SPLIT_FILTER;
  if (ort === RUE_NOTRE_DAME_DE_LORETTE_ORT) return RUE_NOTRE_DAME_FILTER;
  let gedankenQuellen = Object.keys(GEDANKEN_ZIEL_ORT).filter(quelle => GEDANKEN_ZIEL_ORT[quelle] === ort);
  if (gedankenQuellen.length > 0) return new Set([ort, ...gedankenQuellen]);
  return ort;
}

// Die fünf gedachten/erinnerten Orte in Kapitel 1. Nur die WERTE werden
// gelesen (Object.values unten) — die Schlüssel stehen als Herkunftsangabe
// da, welcher ortBasis-Text im Datensatz dahintersteckt.
const GEDANKEN_FILTER = {
  'Champs-Élysées / Avenue du Bois de Boulogne': 'Champs-Élysées / Avenue du Bois de Boulogne',
  'Afrika (Erinnerung, Militärdienst)': 'Afrika',
  'Bois de Boulogne, Paris': 'Bois de Boulogne',
  'Parc Monceau, Paris': 'Parc Monceau',
  'imaginierter Sommergarten, Paris': 'imaginierter Sommergarten',
};

// Diese fünf ortRuns bekommen keinen eigenen Kreis auf Karte/Spine (siehe
// zeichneKreiseOrtRuns, kreisgrafik.js). Sie zählen bei dem echten Ort mit,
// an dem Duroy in diesem Moment tatsächlich steht — siehe GEDANKEN_ZIEL_ORT
// und wohnungFilterFuerOrt.
const GEDANKEN_ORTRUN_UNTERDRUECKT = new Set(
  Object.values(GEDANKEN_FILTER).filter(v => typeof v === 'string')
);

// Wohin eine gedachte/erinnerte/erträumte Annotation für die Kreiszählung
// zählt: der jeweils letzte ECHTE Ort vor ihr innerhalb derselben
// "station"-Gruppe (aus kapitel01-stationen.json annotationen[].station
// ermittelt) — Duroy ist an diesem Ort physisch anwesend, während ihm der
// gedachte Ort durch den Kopf geht.
//   'Champs-Élysées / Avenue du Bois de Boulogne' (station 100, ai 67):
//     zwischen Rue La Fayette und Boulevard des Italiens → Boulevard
//     Poissonnière (letzter echter Ort davor).
//   'Afrika' (station 101, ai 145-147): zwischen Place de la Madeleine und
//     Boulevard des Capucines → Place de la Madeleine.
//   'Bois de Boulogne'/'Parc Monceau'/'imaginierter Sommergarten' (station 5,
//     ai 245-247): zwischen Café Américain und Bal Musard → Café Américain.
const GEDANKEN_ZIEL_ORT = {
  'Champs-Élysées / Avenue du Bois de Boulogne': 'Boulevard Poissonnière',
  'Afrika': 'Place de la Madeleine',
  'Bois de Boulogne': 'Café Américain',
  'Parc Monceau': 'Café Américain',
  'imaginierter Sommergarten': 'Café Américain',
};

// Unterdrückt dieser Ort seinen eigenen Auftritt? Betrifft die absorbierten
// Wohnung-Mini-Erwähnungen und die Gedanken-Orte (siehe
// GEDANKEN_ORTRUN_UNTERDRUECKT/GEDANKEN_ZIEL_ORT — die zählen bei ihrem
// echten Ort mit, bekommen aber keinen eigenen Eintrag).
//
// Das Kapitel-1-Gate ist der heikle Teil: Beide Sets sind reine Namenslisten
// ohne Kapitelbezug (siehe deren eigene Kommentare). Ohne die Prüfung
// daten === stationenData würde ein automatisch gebautes Kapitel, das
// zufällig denselben ortBasis-Namen für einen eigenen, echten Ort verwendet
// (z.B. Kapitel 3s "Parc Monceau"), fälschlich mit unterdrückt.
//
// Zwei Leser: ortRunsFuerSpine (Spine) und ortRunSichtbar (Kartenkreise),
// beide weiter unten.
function istKapitel1Unterdrueckt(ort, daten) {
  if (daten !== stationenData) return false;
  return WOHNUNG_SAMMELPUNKT_ABSORBIERTE_ORTRUNS.has(ort)
      || GEDANKEN_ORTRUN_UNTERDRUECKT.has(ort);
}

// Liefert die ortRun-Namen, die einen eigenen Spine-Eintrag bekommen: jeden
// Kartenkreis (siehe ortRunSichtbar/zeichneKreiseOrtRuns), unter Ausschluss
// der oben beschriebenen Fälle.
function ortRunsFuerSpine(daten) {
  return new Set(
    (daten.ortRuns || [])
      .map(r => r.ort)
      .filter(ort => !istKapitel1Unterdrueckt(ort, daten))
  );
}

// Benannte Scroll-Meilensteine, Anteil 0..1 der gesamten Scrollstrecke
// (9300vh, .scroll-track in index.html). Die krummen Werte kommen daher,
// dass die Strecke mehrfach verlängert wurde und jeder Wert dabei so
// umgerechnet wurde, dass seine absolute vh-Position gleich blieb. Wer die
// Strecke erneut ändert, muss genauso umrechnen, sonst verschieben sich
// alle Akte.
const SCROLL_MEILENSTEINE = {
  heroFadeStart: 0.011829, heroFadeEnd: 0.035485,
  // Zwischen heroFadeEnd und zoomStart 700vh zusätzliche Lesezeit — der
  // Begleittext ("1885 wächst Paris…", data-von/data-bis in index.html)
  // bleibt dadurch noch auf der Startseite lesbar und blendet erst während
  // dieses Zoom-Übergangs wieder aus (sein data-bis fällt mit zoomEnd
  // zusammen).
  zoomStart: 0.110753, zoomEnd: 0.158065,
  // Spine blendet gleichzeitig mit dem Zoom-Beginn ein.
  spineFadeStart: 0.113118, spineFadeEnd: 0.16043,
  // Zwischen zoomEnd und routeStart 550vh zusätzliche Lesezeit — der
  // Kapitel-Einstiegstext (.begleittext-dunkel, eigenes data-von/data-bis
  // pro Kapitel in index.html) blendet mit dem Kartenausschnitt ein
  // (data-von = zoomEnd) und wieder aus, sobald Route/Annotationen
  // beginnen (data-bis = routeStart).
  routeStart: 0.252689, routeEnd: 0.370968,
  // Akt: nach Abschluss der Route zurück auf die Gesamtkarte zoomen.
  zoomOutStart: 0.370968, zoomOutEnd: 0.418279,
  // Akt: Übersichtsrouten (Kapitel 02–18) bauen sich auf. Breite (2933vh)
  // so bemessen, dass auch das annotationsreichste Kapitel (Kapitel 8,
  // 400 Annotationen) im gleichen Tempo (~7.3vh/Annotation) durchläuft wie
  // Kapitel 1 (1100vh / 150 Annotationen).
  uebersichtRoutenStart: 0.418279, uebersichtRoutenEnd: 0.733656,
  // Schlussakt Ortsveränderung (2000vh): Übersichtskarte blendet aus, danach
  // wachsen die Kreise der sieben Orte (VERGLEICHS_KNOTEN) mit jedem
  // erreichten Kapitel 1..18.
  // kreisVergleichFadeEnd liest niemand — das Ausblenden steuert OV_KARTE_AUS
  // in ortsveraenderung.js. Der Schlüssel steht nur noch hier.
  kreisVergleichStart: 0.733656, kreisVergleichFadeEnd: 0.750967,
  kreisVergleichEnd: 0.94871,
  // Akt: die Startkarte kommt zurück. Sie blendet hinter den sieben Kreisen
  // ein, danach fährt die Ansicht aus deren Ausschnitt auf die Gesamtkarte
  // zurück — der Bogen schliesst dort, wo er begonnen hat.
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

// Übersichtsrouten (Kapitel 02–18, echte Strassenrouten via OSMnx aus den
// GeoJSONs berechnet, siehe data-prep/05 bereinigen/baue-uebersichtsrouten.py).
// Kapitel ohne verwertbare Route (z.B. 15 — Empfang bei den Walters, ein
// einziger Innenraum-Schauplatz ohne Koordinaten-Streuung) werden hier
// herausgefiltert, damit sketch.js nur echte Linien zeichnet.
// Behält jedes Kapitel mit mindestens EINEM Routenpunkt, nicht erst ab zwei:
// Kapitel 2 spielt an einem einzigen Ort (Wohnung Forestier) und hätte sonst
// auch Kapitelpunkt, Scheibenaufteilung und Einstiegstext verloren, die alle
// am selben Objekt hängen. Die Zeichenwege kommen mit einem Punkt zurecht —
// die Linienschleife zeichnet dann nichts, Badge und Hover lesen punkte[0].
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

// Flaechenproportional statt radiusproportional (Standard bei proportional
// symbol maps): die Flaeche eines Kreises soll linear mit n wachsen, also
// muss der Radius mit sqrt(n) wachsen. Verhindert, dass grosse Unterschiede
// (z.B. 31 vs. 12 Annotationen) am Deckel optisch verschwinden, wie es bei
// einer linearen r = BASIS + n*MULT-Formel mit niedrigem Deckel passiert.
// maxRadius: Obergrenze, damit sehr grosse Kreise die Karte nicht sprengen.
// Der Schlussakt (VERGLEICHS_KNOTEN in ortsveraenderung.js) übergibt bewusst
// Infinity und skaliert selbst: dort summieren sich alle 18 Kapitel auf, die
// Orte liefen sonst reihum in den Deckel und wären am Ende gleich gross —
// genau dort, wo der Vergleich Unterschiede zeigen soll.
function kreisRadius(n, maxRadius = 100) {
  const BASIS = 6, K = 11.5;
  return n > 0 ? Math.min(maxRadius, BASIS + K * Math.sqrt(n)) : 0;
}

// Grösster Radius über alle drei Kategorien — der Aussenradius des ganzen
// Kreisdiagramms. Die schraffierten Gesamtkreise (alle Erwähnungen einer
// Kategorie, siehe zeichneKreiseFuerRun) sind die äussersten Formen; ihr
// Maximum ist deshalb der Rand, an dem aussen die F-Wert-Punkte ansetzen.
//
// maxRadius und radiusSkala bedeuten dasselbe wie in zeichneKreiseFuerRun
// (kreisgrafik.js), das intern dieselbe Funktion ruft. Wer den Radius VOR
// dem Zeichnen braucht (Spine-Layout, Annotationsbox, Ortsveränderung),
// holt ihn hier — zeichneKreiseFuerRun gibt nichts zurück.
//
// ACHTUNG, umgekehrte Reihenfolge: zeichneKreiseFuerRun() nimmt die beiden
// als (…, radiusSkala, maxRadius), hier stehen sie als (…, maxRadius,
// radiusSkala) — maxRadius wird häufiger überschrieben (Infinity im
// Schlussakt), radiusSkala fast nie.
function groessterKreisRadius(bandCounts, maxRadius = 100, radiusSkala = 1) {
  let groesster = 0;
  KREIS_KATEGORIEN.forEach(kat => {
    let b = bandCounts[kat.key] || {};
    let n = (b.neg || 0) + (b.pos || 0) + (b.neutral || 0) + (b.unrated || 0);
    groesster = Math.max(groesster, kreisRadius(n, maxRadius) * radiusSkala);
  });
  return groesster;
}

// Manche ortRuns-Einträge tragen den Namen eines späteren Halteorts, werden
// aber schon an einer früheren Stelle im Text (mit deren revealIndex/Koordinate)
// nur erwähnt/vorausgedacht, nicht real besucht (z.B. "Folies Bergère" wird im
// Café Napolitain-Gespräch erwähnt, aber erst viel später real erreicht).
// Solche vorzeitigen Erwähnungen bekommen auf der Route keinen eigenen Kreis,
// da die Station an ihrem echten Halt ohnehin schon einen Kreis zeichnet.
function istVorzeitigeErwaehnung(r, daten = stationenData) {
  let halteort = (daten.halteorte || []).find(h => h.name === r.ort);
  return !!halteort && halteort.revealIndex !== r.revealIndex;
}

// Bekommt dieser ortRun beim aktuellen Scrollstand einen eigenen Kartenkreis?
// Bündelt alle vier Ausschlussgründe. Gelesen von zeichneKreiseOrtRuns
// (kreisgrafik.js).
//
// punktIndex: Position auf der Route (steuert das Erscheinen).
// annIndex:   Position in der Annotationsfolge (steuert den Wohnung-Split).
// Beide sind getrennt nötig — Kapitel 1 lässt sie auseinanderlaufen.
function ortRunSichtbar(r, punktIndex, annIndex, daten = stationenData) {
  if (punktIndex < r.revealIndex) return false;
  if (istVorzeitigeErwaehnung(r, daten)) return false;
  if (istKapitel1Unterdrueckt(r.ort, daten)) return false;
  // Zeitabhängig und deshalb nicht im gemeinsamen Kern: Die Rue Notre-Dame de
  // Lorette gehört bis zum Wohnungswechsel zum Sammelpunkt und bekommt erst
  // danach einen eigenen Kreis.
  if (daten === stationenData && r.ort === RUE_NOTRE_DAME_DE_LORETTE_ORT
      && annIndex < wohnungSplitAi(daten)) return false;
  return true;
}

// a.valenz (1/-1/0/fehlt) auf denselben Bucket abgebildet wie die
// Python-Pipeline (valenz_bucket() in baue-kapitel-stationen.py). Muss
// übereinstimmen: die vorberechneten bandCounts kommen von dort, die
// live gezählten entstehen hier.
function valenzBucket(v) {
  if (v === 1) return 'pos';
  if (v === -1) return 'neg';
  if (v === 0) return 'neutral';
  return 'unrated';
}

// Rohe Annotationen (nicht aggregiert), die zu filter/annIndex passen —
// dieselbe Trefferlogik wie zaehleAnnotationenLiveNachOrtBasis (die daraus
// die bandCounts aufsummiert), aber als Liste statt als Zählung. Wird u.a.
// für die F-Wert-Punkte gebraucht, die pro Annotation (nicht aggregiert)
// ausserhalb des Kreisdiagramms sitzen (siehe zeichneFwertPunkte in
// kreisgrafik.js) — jede Annotation dort braucht ihre eigene Valenz/ihren
// eigenen fWertType, den eine reine Zählung nicht mehr hergibt.
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

// Zählt eine BEREITS gefilterte Trefferliste zu bandCounts zusammen. Getrennt
// vom Sammeln, damit Aufrufer, die beides brauchen — Zählung für die
// Kreisflächen UND rohe Liste für die F-Wert-Punkte — nur einmal über
// daten.annotationen laufen (zeichneKreiseOrtRuns in kreisgrafik.js,
// zeichneSpineHorizontal in spine-horizontal.js, je Ortskreis und Frame).
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

// Sammeln und Zählen in einem Aufruf — für Stellen, die NUR die Zählung
// brauchen und die Trefferliste nicht weiterverwenden (annotationBoxPosition,
// spineLayout; beide gecacht, der eine Scan fällt dort nicht ins Gewicht).
function zaehleAnnotationenLiveNachOrtBasis(filter, annIndex, daten = stationenData) {
  return zaehleBandCounts(sammleAnnotationenNachOrtBasis(filter, annIndex, daten));
}

// ---------------------------------------------------------------------------
// Spine-Daten
// ---------------------------------------------------------------------------

// daten: ein bereinigtes stationenData-Objekt (Kapitel 1 oder ein anderes
// Kapitel). hauptorte: Set der ortRun-Namen, die einen Spine-Eintrag
// bekommen sollen.
//
// Läuft über daten.annotationen, nicht über die zu je einem Kreis pro Ort
// zusammengeführten daten.ortRuns: nur dort ist erkennbar, ob ein Ort nach
// einer Unterbrechung noch einmal auftaucht. So eine Rückkehr bekommt in
// zeichneSpineHorizontal (spine-horizontal.js) keinen zweiten Kreis, sondern
// einen Bogen zurück zum ersten. Jeder zusammenhängende Lauf gleicher
// ortBasis wird zu genau einem Eintrag.
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
// 26 Namen — die grösste Schnittstelle im Projekt. Acht Module lesen daraus:
// kreisgrafik, ortsveraenderung, spine-horizontal, annotationsbox,
// dom-aufbau, fotomarker, uebersichtsrouten, sketch.

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
