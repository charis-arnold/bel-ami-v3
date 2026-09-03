/* =============================================================================
   sonifikation.js — Kapitel als Tonstück, über Strudel

   Liefert NUR den Ton zum Play-Button der Graph-Ansicht; die Spine läuft
   parallel mit derselben Gesamtdauer. Zeitbasiert, nicht scroll-gekoppelt.

   Zwei Modelle nebeneinander:
   - Stationsmodell (Kapitel 02–18, und Kapitel 1 bei MODUS 'stationen'):
     eine Tonstufe je Station, drei F-Wert-Kategorien als drei Layer in
     c-moll. Zeitplan aus Gehstrecke und Annotationsdichte je Station
     (kapitel01-sonifikation.json).
   - Elementmodell (Prototyp, nur Kapitel 1): ein Klang je Element, drei
     Gefühlskategorien als Instrumente, Tonhöhe aus dem Kreisradius. Siehe
     den Block "Prototyp" weiter unten.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 39 von 46 Namen intern, 7 exportiert. Konvention: docs/architektur.md.
(function () {

// Dieselben zwei CDN-Quellen, die strudel.cc selbst lädt. @strudel/web bringt
// keine Samples mit; gm_*-Sounds brauchen ein Extrapaket und bleiben draussen.
const SONIFIKATION_SAMPLE_BAENKE = [
  ['https://strudel.b-cdn.net/piano.json', 'https://strudel.b-cdn.net/piano/'],
  ['https://strudel.b-cdn.net/vcsl.json', 'https://strudel.b-cdn.net/VCSL/'],
];

// VCSL hat keine Streicher/Klarinetten — Klavier/Orgel/Saxophon statt der
// ursprünglich gedachten Saint-Saëns-Besetzung. Was die Bank sehr wohl hat:
// Harfe, Xylophon, Glockenspiel, Pauke, Glasharmonika, Orgelpedal. Das
// Elementmodell weiter unten spielt darauf.
const SONIFIKATION_INSTRUMENTE = {
  ort_loest_emotion_aus: { sound: 'piano', attack: 0.02, release: 0.6, octave: 3 },
  emotion_faerbt_raum: { sound: 'pipeorgan_quiet', attack: 0.25, release: 1.2, octave: 4 },
  koerper_als_sensor: { sound: 'sax', attack: 0.12, release: 0.8, octave: 4 },
};

// Gesamtdauer des Stücks — bewusst hier (nicht in Python) als gestalterischer
// Wert; erste Annahme, per Ohr anzupassen.
const SONIFIKATION_GESAMTDAUER_SEK = 45;

// Dauer je Station: Basiswert plus Anteile aus Gehstrecke und Annotationen.
// Die beiden Skalen sind Stellschrauben, keine gemessenen Grössen.
const SONIFIKATION_GEWICHT_BASIS = 3;
const SONIFIKATION_GEWICHT_STRECKEN_SKALA = 200; // Meter pro Gewichtspunkt
const SONIFIKATION_GEWICHT_ANNOTATION_SKALA = 0.6; // Gewichtspunkte pro Annotation


// --- Prototyp: ein Klang je Element (nur Kapitel 1) --------------------
//
// Dreht die Zuordnung des Stationsmodells um. Dort tragen die drei
// F-WERT-TYPEN die Instrumente; hier tragen sie die drei GEFÜHLSKATEGORIEN,
// und die F-Werte bekommen als Instrument 4 eine eigene Stimme. Damit klingt
// die Tonebene so, wie die Grafik gebaut ist: die Bänder sind die
// Kategorien, die Punkte am Rand sind die F-Werte.
//
// Jedes Element klingt einmal. Die Tonhöhe folgt dem Kreisradius, den es
// gerade erzeugt — und weil der Radius mit der Wurzel wächst, springt ein
// junger Kreis hörbar, während ein voller nur noch kriecht.

// Umschalter zum Vergleichen: 'stationen' spielt die bisherige Fassung —
// Kapitel 1 aus kapitel01-sonifikation.json, 02–18 aus den Spine-Einträgen.
const SONIFIKATION_MODUS = 'elemente';

// Spieldauer im Elementmodell. Nicht die Zahl der Orte zählt, sondern die
// der Klänge: Kapitel 2 spielt an einem einzigen Ort und bekäme über die
// Ortsformel 2,6 s für 118 Elemente, also 45 Klänge je Sekunde.

// ACHTUNG die Dauer gilt auch für die Grafik. aktuelleGrafikAnimationDauer()
// (spine-horizontal.js) fragt hier an, sonst liefen Bild und Ton auseinander
// — im Elementmodell hängt jeder Klang an seinem Element.

// Die Wurzel hält die Spanne zusammen: linear bekäme Kapitel 5 mit seinen 321
// Elementen 96 s, so sind es 66. Kapitel 1 bleibt die Marke mit 45 s.
const ELEMENT_DAUER_BEZUG = 150; // Elemente in Kapitel 1

// Woran die Zeitpunkte hängen:
// 'spine'   — an dem Moment, in dem das Element im Bild erscheint. Ton und
//             Grafik laufen exakt synchron. Preis: die Spine verteilt ihre
//             Zeit auf Orte, nicht auf Elemente. Die 50 Elemente der Folies
//             Bergère fallen deshalb in die letzten 2,6 s.
// 'element' — alle Elemente gleich weit auseinander (0,3 s).
// 'puls'    — Abstände auf ein Pulsraster gerundet, also ein echtes Metrum.

// ACHTUNG 'element' und 'puls' laufen dem Bild davon, und zwar deutlich: die
// Folies Bergère brauchen metrisch mindestens 10 s statt 2,6 s. Gemessen bis
// 12 s Versatz am Schluss. Beide sind zum Hören da, nicht zum Zeigen.
const SONIFIKATION_ZEITBASIS = 'spine';

// Nur für 'puls': Rasterweite in Sekunden.
const SONIFIKATION_PULS_SEK = 0.25;

// Nachklang nach dem letzten Element; die Spine steht dann schon still.
const SONIFIKATION_NACHKLANG_SEK = 2;

// Tonvorrat. g-moll ist die Tonart der «Danse macabre» (1874) — von dort
// kommt auch das Xylophon der F-Werte.

// ACHTUNG Skalenstufen statt freier MIDI-Werte: die Stufen tragen die
// Melodie, dafür fallen die Vierteltonschritte der ersten Fassung weg. Das
// ist der bewusste Tausch «feine Schritte gegen Melodie».
const ELEMENT_TONART = 'minor';

// Woran sich die Stufenleiter misst:
// 'kapitel' — am grössten Kreis des ganzen Kapitels. Ein kleiner Ort bleibt
//             unten, ein grosser steigt hoch; Kreisgrösse ist über das ganze
//             Stück hinweg hörbar. Preis: die meisten Orte in Kapitel 1
//             haben zwei bis sieben Elemente je Band und bekommen damit zwei
//             bis drei Stufen — zu wenig für eine Linie.
// 'ort'     — an dem, was der Ort selbst erreicht, und die Phrase wird so
//             lang wie er Elemente hat (höchstens eine Oktave). Jeder Besuch
//             bekommt eine eigene Linie. Preis: gleiche Tonhöhe sagt nicht
//             mehr gleiche Kreisgrösse.
const ELEMENT_STUFENBEZUG = 'ort';

// Instrument 1–3, je eine Gefühlskategorie. Angeschlagene Instrumente statt
// Wellenformen: sie klingen von selbst ab und lassen Luft zwischen den
// Tönen — ohne die gibt es keine Melodie, nur Fläche. Die Oktave folgt der
// Farbreihe, dunkles Band tief, helles Band hoch.
// name steht hier und nicht in der Legende: Klang und Bezeichnung gehören
// zusammen, sonst driften sie auseinander. kreisgrafik.js liest ihn.
const ELEMENT_INSTRUMENTE = {
  gold_dunkel: { sound: 'harp', oktave: 3, name: 'Harfe' },              // Raum und Umwelt
  gold_mittel: { sound: 'vibraphone_soft', oktave: 4, name: 'Vibraphon' }, // Stimmung und Emotion
  gold_hell: { sound: 'glockenspiel', oktave: 5, name: 'Glockenspiel' },  // Gesellschaft und Soziales
};

// Instrument 4: das Xylophon der «Danse macabre». Feste Stufen aus dem
// g-moll-Dreiklang, damit die 63 Anschläge zu jeder Melodie passen.
// persoenliche_sehnsucht fehlt in FWERT_PUNKTGROESSE und kommt in Kapitel 1
// genau einmal vor — der seltenste Ton des Stücks.
const ELEMENT_FWERT_SOUND = 'xylophone_soft_pp';
const ELEMENT_FWERT_OKTAVE = 5;
const ELEMENT_FWERT_GRAD = {
  ort_loest_emotion_aus: 0,
  emotion_faerbt_raum: 2,
  koerper_als_sensor: 4,
  persoenliche_sehnsucht: 7,
};

// Bassstimme unter der Melodie: die Pedalregister der Orgelsymphonie (1886,
// dasselbe Jahr wie der «Carnaval des animaux»). Sie trägt das Wummern, das
// die Schraffur allein nicht mehr leisten kann, seit die Kategorien
// angeschlagen statt gehalten spielen — ein Ton je Ortsbesuch, nicht je
// Element. Nur Dreiklangstufen, damit nichts gegen die Melodie steht.

// ACHTUNG maxSek muss bleiben: ein Ortsbesuch dauert in Kapitel 2 die vollen
// 41 s, und ein Sample hält das nicht — der Bass wäre nach dem ersten Ton
// weg. Ausserdem füllt das Nachschlagen die Stellen, an denen gar kein
// Element wächst: Kapitel 9 hat bei 36,8 s eine Lücke von 5,3 s, weil dort
// ein Ort mit einem einzigen Element eine volle Abschnittsdauer belegt.
const ELEMENT_BASS = { sound: 'pipeorgan_quiet_pedal', oktave: 2, grade: [0, 2, 4], maxSek: 3 };

// Stufenumfang und Klangfarbe je Rolle. Die Melodiestimmen bekommen eine
// Oktave: jeder Ort fängt unten an und steigt — das ergibt je Ort eine
// Phrase, in Kapitel 1 also vierzehn.
const ELEMENT_ROLLEN = {
  melodie: { grade: [0, 7], attack: 0.01, release: 1.4, gain: 0.55, room: 0.35 },
  neg: { grade: [0, 5], attack: 0.01, release: 2.4, gain: 0.45, room: 0.45 },
  pos: { grade: [0, 7], attack: 0.01, release: 1.6, gain: 0.40, room: 0.30 },
  fwert: { grade: [0, 0], attack: 0.01, release: 0.7, gain: 0.30, room: 0.25 },
  bass: { grade: [0, 0], attack: 0.6, release: 3.5, gain: 0.32, room: 0.5 },
};

// Die schwere Hälfte hat ein eigenes Fell: Pauke statt Kategorieinstrument.
// Die helle bekommt die Glasharmonika aus dem «Aquarium».
const ELEMENT_NEG = { sound: 'timpani', oktave: 2 };
const ELEMENT_POS = { sound: 'wineglass', oktave: 5 };


let sonifikationDaten = null;
let sonifikationBereit = false;
let sonifikationSpieltGerade = false;

// Zeitplan in Sekunden ab Start, nur modulintern für den Audio-Aufbau.
let sonifikationSpielplan = null;

async function ladeSonifikationDaten() {
  if (sonifikationDaten) return sonifikationDaten;
  let antwort = await fetch('kapitel01-sonifikation.json');
  sonifikationDaten = await antwort.json();
  return sonifikationDaten;
}

function baueSpielplan(stationen) {
  let gewichte = stationen.map(s =>
    SONIFIKATION_GEWICHT_BASIS
    + (s.wegstreckeVorherM + s.wegstreckeEigenM) / SONIFIKATION_GEWICHT_STRECKEN_SKALA
    + s.anzahlAnnotationen * SONIFIKATION_GEWICHT_ANNOTATION_SKALA
  );
  let summeGewichte = gewichte.reduce((a, b) => a + b, 0);

  let ende = 0;
  let revealIndexVorher = 0;
  return stationen.map((s, i) => {
    let dauer = (gewichte[i] / summeGewichte) * SONIFIKATION_GESAMTDAUER_SEK;
    let start = ende;
    ende += dauer;
    let eintrag = {
      station: s.station, ort: s.ort, start, ende, dauer,
      revealIndexVorher,
      revealIndexEigen: s.revealIndexMax,
    };
    revealIndexVorher = s.revealIndexMax;
    return eintrag;
  });
}

// Gain-Folge je Kategorie, auf maxAnzahl normiert. Dieselben @-Gewichte wie
// die Notenfolge, sonst laufen Gain- und Notenwechsel auseinander.
function baueGainFolge(stationen, spielplan, kategorie, maxAnzahl) {
  return stationen
    .map((s, i) => {
      let n = s.fWertAnteile[kategorie] || 0;
      let wert = n > 0 ? (n / maxAnzahl).toFixed(2) : '0';
      return `${wert}@${spielplan[i].dauer.toFixed(3)}`;
    })
    .join(' ');
}

// ACHTUNG initStrudel() muss im Klick-Handler laufen (Autoplay-Policy) und
// gibt in @strudel/web@1.0.3 nichts zurück — setcps/cpm sind von aussen nicht
// erreichbar. Tempo liegt deshalb fest bei cps=0.5, die Gesamtdauer wird
// über .slow() gesteuert.
const SONIFIKATION_STANDARD_CPS = 0.5;

async function stelleSonifikationBereit() {
  if (sonifikationBereit) return;

  // ACHTUNG initStrudel() überschreibt 16 globale Namen, die p5 belegt —
  // darunter fill() und color(). Danach zeichnet p5 alles weiss. Deshalb p5s
  // Fassungen sichern und nach der Initialisierung zurücklegen.
  // Hergang und Messung: docs/bugfix-log.md.
  let p5Namen = Object.getOwnPropertyNames(p5.prototype).filter(k => typeof window[k] === 'function');
  let p5Fassung = {};
  p5Namen.forEach(k => { p5Fassung[k] = window[k]; });

  await initStrudel({
    prebake: () => Promise.all(
      SONIFIKATION_SAMPLE_BAENKE.map(([json, basis]) => samples(json, basis, { prebake: true }))
    ),
  });
  // ACHTUNG das Promise von initStrudel() kann einen Tick VOR der Registrierung
  // von n/s/note auflösen — ein n(...) direkt danach wirft "n is not defined".
  // Kurzes Polling statt festem sleep(). Nur per Test beobachtet, nicht
  // dokumentiert.
  // note() zusätzlich, weil der Prototyp darauf steht statt auf n().
  let versuche = 0;
  while ((typeof n !== 'function' || typeof note !== 'function') && versuche < 50) {
    await new Promise(r => setTimeout(r, 10));
    versuche++;
  }

  // Erst jetzt zurücklegen: die Zuweisungen kommen im selben Schub wie n().
  p5Namen.forEach(k => { if (window[k] !== p5Fassung[k]) window[k] = p5Fassung[k]; });

  sonifikationBereit = true;
}

let sonifikationTimeoutId = null;

// Gemeinsamer Wiedergabe-Kern: beide Aufrufer bauen nur notenFolge und
// gainFolgen, gespielt wird hier auf denselben drei Layern.
function spieleSchichten(notenFolge, gainFolgenProKategorie, slowFaktor, gesamtdauerSek) {
  let layers = Object.entries(SONIFIKATION_INSTRUMENTE).map(([kategorie, instr]) =>
    n(notenFolge)
      .scale(`c${instr.octave}:minor`)
      .s(instr.sound)
      .gain(gainFolgenProKategorie[kategorie])
      .attack(instr.attack)
      .release(instr.release)
      .room(0.3)
      .slow(slowFaktor)
  );

  starteWiedergabe(stack(...layers), gesamtdauerSek);
}

// Start plus Selbstabschaltung. Beide Modelle teilen sich das, damit der
// Play-Zustand an einer einzigen Stelle gesetzt wird.
function starteWiedergabe(pattern, gesamtdauerSek) {
  pattern.play();

  sonifikationSpieltGerade = true;

  sonifikationTimeoutId = setTimeout(() => {
    sonifikationTimeoutId = null;
    beendeSonifikationAudio();
  }, gesamtdauerSek * 1000);
}

// Wählt den Ton zur offenen Ansicht: Kapitel 1, wenn keines gezoomt ist.
// Ohne await, der Aufrufer wartet ohnehin nicht.
function spieleSonifikationFuer(kapitelNr) {
  if (SONIFIKATION_MODUS === 'elemente') return spieleElementAudio(kapitelNr);
  if (kapitelNr) return spieleKapitelSonifikationAudio(kapitelNr);
  return spieleKapitel1SonifikationAudio();
}

// ---------------------------------------------------------------------------
// Elementmodell (Prototyp, Kapitel 1)
// ---------------------------------------------------------------------------

// Fortschritt 0..1 je Annotation: wo im Ablauf sie im Bild erscheint.
// Umkehrung der Interpolation aus zeichneSpineHorizontal(), dort wächst
// globalAnnIndex stückweise linear zwischen den rv-Werten der Spine.

// ACHTUNG in Fortschritt statt in Sekunden, weil die Spieldauer erst aus der
// Zahl der Elemente folgt — und die steht erst fest, wenn diese Zuordnung
// gelaufen ist. Sekunden macht daraus erst spieleElementAudio().

// ACHTUNG das Hochziehen des letzten rv-Werts muss mit: die Spine setzt ihn
// auf die letzte Annotation ("sonst wird der letzte Kreis nie voll"). Ohne
// dieselbe Zeile laufen Ton und Bild auf den letzten Metern auseinander.
function elementFortschritte(daten, eintraege) {
  let anzahl = daten.annotationen.length;
  let n = eintraege.length;
  let rv = eintraege.map(e => e.rv);
  rv[n - 1] = anzahl - 1;

  let werte = [];
  let seg = 0;
  for (let ai = 0; ai < anzahl; ai++) {
    if (SONIFIKATION_ZEITBASIS === 'element') {
      werte[ai] = ai / Math.max(1, anzahl - 1);
      continue;
    }
    if (n === 1) {
      // Einziger Eintrag (Kapitel 2): die Spine interpoliert dort ab -1,
      // damit der Kreis nicht sofort voll steht. Dieselbe Umkehrung.
      werte[ai] = (ai + 1) / Math.max(1, rv[0] + 1);
      continue;
    }
    while (seg < n - 2 && ai > rv[seg + 1]) seg++;
    let spanne = rv[seg + 1] - rv[seg];
    let position = seg + (spanne > 0 ? (ai - rv[seg]) / spanne : 0);
    werte[ai] = Math.min(1, Math.max(0, position / (n - 1)));
  }
  return werte;
}

// Ein Eintrag je Element, in Erzählreihenfolge, mit dem Kreisstand, den es
// gerade erzeugt. Keine neue Datei nötig: alles steht in den
// kapitelXX-stationen.json, die auch das Bild liest.
let elementCache = {};

function elementeFuerKapitel(kapitelNr) {
  let ortsvergleich = laeuftOrtsvergleich(); // uebersichtsrouten.js
  let schluessel = ortsvergleich ? 'alle' : (kapitelNr || '01');
  if (elementCache[schluessel]) return elementCache[schluessel];
  let gebaut = ortsvergleich ? baueOrtsvergleichElemente() : baueKapitelElemente(kapitelNr);
  // Nur Fertiges merken: sind die Spine-Daten noch nicht aufgebaut, soll der
  // nächste Aufruf es erneut versuchen statt für immer null zu liefern.
  if (gebaut) elementCache[schluessel] = gebaut;
  return gebaut;
}

function baueKapitelElemente(kapitelNr) {
  let daten = kapitelNr ? datenFuerKapitel(kapitelNr) : stationenData;
  let eintraege = spineEintraegeFuer(kapitelNr);
  if (!daten || !daten.annotationen || !eintraege || !eintraege.length) return null;

  // sammleAnnotationenNachOrtBasis() gibt Objekte zurück, gebraucht wird die
  // Erzählposition — einmal vorwärts aufgebaut statt 150-mal indexOf.
  let aiVon = new Map();
  daten.annotationen.forEach((a, ai) => aiVon.set(a, ai));

  // Welcher Kreis nimmt welches Element auf. Genau die Zuordnung, die
  // zeichneSpineHorizontal() für seine Kreise benutzt, samt Wohnung-Split
  // und Gedanken-Orten — deshalb dieselben zwei Funktionen und keine eigene
  // Ortslogik. Rückkehr-Einträge brauchen keinen eigenen Durchgang: der
  // Filter des Erstbesuchs fängt auch die späteren Annotationen ein.
  let letzteAi = daten.annotationen.length - 1;
  let kreisVonAi = new Map();
  eintraege.forEach((e, i) => {
    if (e.typ !== 'location') return;
    sammleAnnotationenNachOrtBasis(wohnungFilterFuerOrt(e.ortBasis), letzteAi, daten)
      .forEach(a => { if (aiVon.has(a)) kreisVonAi.set(aiVon.get(a), i); });
  });

  let fortschritte = elementFortschritte(daten, eintraege);
  let folge = [];
  daten.annotationen.forEach((a, ai) => {
    if (!a.category || !kreisVonAi.has(ai)) return;
    folge.push({ annotation: a, kreis: kreisVonAi.get(ai), fortschritt: fortschritte[ai] });
  });
  return baueElementeAus(folge);
}

// Der Ortsvergleich spielt dieselben Elemente, nur kommen Zuordnung und
// Zeitpunkte aus ortsveraenderung.js statt aus der Spine: die sieben Orte
// tragen die Kreise, das Kapitel treibt die Zeit.
function baueOrtsvergleichElemente() {
  let folge = ortsvergleichAnnotationen();
  return folge && folge.length ? baueElementeAus(folge) : null;
}

// Laufender Stand je Kreis und Kategorie: dieselben Zahlen, aus denen
// zaehleBandCounts() im Bild die Radien macht. valenz -1/1 wie valenzBucket.
// Beide Ansichten liefern dieselbe Folge und unterscheiden sich nur in der
// Zeitrechnung — deshalb steht das Zählen hier nur einmal.
function baueElementeAus(folge) {
  let stand = new Map();
  let elemente = folge.map(({ annotation: a, kreis, fortschritt }) => {
    if (!stand.has(kreis)) stand.set(kreis, {});
    let proKategorie = stand.get(kreis);
    let z = proKategorie[a.category] || (proKategorie[a.category] = { gesamt: 0, neg: 0, pos: 0 });
    z.gesamt++;
    if (a.valenz === -1) z.neg++;
    if (a.valenz === 1) z.pos++;
    let gesamtAmKreis = 0;
    Object.keys(proKategorie).forEach(k => { gesamtAmKreis += proKategorie[k].gesamt; });
    return {
      fortschritt,
      kategorie: a.category,
      kreis,
      // Alle Kategorien zusammen: die Grösse, die der Kreis im Bild zeigt.
      kreisGesamt: gesamtAmKreis,
      // Radius NACH diesem Element: der Klang meldet den Stand, den er macht.
      schraffur: kreisRadius(z.gesamt),
      neg: a.valenz === -1 ? kreisRadius(z.neg) : 0,
      pos: a.valenz === 1 ? kreisRadius(z.pos) : 0,
      fWertType: a.hasFwert ? a.fWertType : null,
    };
  });
  return elemente.length ? elemente : null;
}

// Radius -> Skalenstufe. Unten der Radius des ersten Elements, oben der
// grösste Radius, den DIESE Stimme wirklich erreicht.

// ACHTUNG je Stimme normiert, nicht global: sonst bliebe «Gesellschaft und
// Soziales» mit seinen elf Elementen in den untersten drei Stufen kleben und
// hätte gar keine Linie. Preis: gleich grosse Kreise zweier Kategorien
// klingen nicht gleich hoch.
function elementGrad(radius, bezug, grade) {
  let r0 = kreisRadius(1);
  // Bei 'ort' reicht die Phrase nur so weit, wie der Ort Elemente hat: sonst
  // spränge ein Ort mit zwei Elementen über die ganze Oktave.
  let oben = ELEMENT_STUFENBEZUG === 'ort'
    ? grade[0] + Math.min(grade[1] - grade[0], Math.max(0, bezug.anzahl - 1))
    : grade[1];
  let t = bezug.max > r0 ? (radius - r0) / (bezug.max - r0) : 0;
  return grade[0] + Math.round(Math.min(1, Math.max(0, t)) * (oben - grade[0]));
}

// Sieben Stimmen auf einem gemeinsamen Raster aus einem Schritt je Element;
// wo eine Stimme schweigt, steht '~'. Der Bass läuft daneben in eigenen
// Schritten — einer je Ortsbesuch, damit er wirklich stehen bleibt.
function baueElementStimmen(elemente, gewichte) {
  // Bezugsgrössen je Stimme, bei 'ort' zusätzlich je Kreis.
  let bezug = {};
  let schluessel = (name, kreis) => ELEMENT_STUFENBEZUG === 'ort' ? name + '#' + kreis : name;
  let merke = (name, kreis, r) => {
    let b = bezug[schluessel(name, kreis)] || (bezug[schluessel(name, kreis)] = { max: 0, anzahl: 0 });
    b.max = Math.max(b.max, r);
    b.anzahl++;
  };
  elemente.forEach(e => {
    merke('melodie_' + e.kategorie, e.kreis, e.schraffur);
    if (e.neg > 0) merke('neg', e.kreis, e.neg);
    if (e.pos > 0) merke('pos', e.kreis, e.pos);
  });

  let stimmen = {};
  let hole = (name, sound, oktave, rolle) => {
    if (!stimmen[name]) stimmen[name] = { sound, oktave, rolle, grade: elemente.map(() => '~') };
    return stimmen[name];
  };

  elemente.forEach((e, i) => {
    let instr = ELEMENT_INSTRUMENTE[e.kategorie];
    if (!instr) return;
    let name = 'melodie_' + e.kategorie;
    hole(name, instr.sound, instr.oktave, 'melodie').grade[i] =
      elementGrad(e.schraffur, bezug[schluessel(name, e.kreis)], ELEMENT_ROLLEN.melodie.grade);
    // Negativ und positiv je EINE Stimme über alle Kategorien: ein Element
    // hat genau eine Valenz, zwei Kategorien können sich im selben Schritt
    // also nicht ins Gehege kommen.
    if (e.neg > 0) {
      hole('neg', ELEMENT_NEG.sound, ELEMENT_NEG.oktave, 'neg').grade[i] =
        elementGrad(e.neg, bezug[schluessel('neg', e.kreis)], ELEMENT_ROLLEN.neg.grade);
    }
    if (e.pos > 0) {
      hole('pos', ELEMENT_POS.sound, ELEMENT_POS.oktave, 'pos').grade[i] =
        elementGrad(e.pos, bezug[schluessel('pos', e.kreis)], ELEMENT_ROLLEN.pos.grade);
    }
    let fwertGrad = e.fWertType ? ELEMENT_FWERT_GRAD[e.fWertType] : undefined;
    if (fwertGrad !== undefined) {
      hole('fwert', ELEMENT_FWERT_SOUND, ELEMENT_FWERT_OKTAVE, 'fwert').grade[i] = fwertGrad;
    }
  });

  // Ein Bassschritt je zusammenhängendem Besuch. Die Stufe kommt aus der
  // Kreisgrösse am Ende des Besuchs — das ist der Stand, den das Bild beim
  // Weitergehen stehen lässt.
  let maxGesamt = elemente.reduce((m, e) => Math.max(m, e.kreisGesamt), 1);
  let bass = { grade: [], gewichte: [] };
  elemente.forEach((e, i) => {
    if (i > 0 && e.kreis === elemente[i - 1].kreis) {
      bass.gewichte[bass.gewichte.length - 1] += gewichte[i];
      bass.grade[bass.grade.length - 1] = ELEMENT_BASS.grade[
        Math.min(ELEMENT_BASS.grade.length - 1,
          Math.floor((e.kreisGesamt / maxGesamt) * ELEMENT_BASS.grade.length))];
      return;
    }
    bass.grade.push(ELEMENT_BASS.grade[0]);
    bass.gewichte.push(gewichte[i]);
  });

  // Lange Besuche in gleich lange Anschläge zerlegen, Stufe bleibt: ein
  // Orgelpunkt, der weiteratmet. Die Summe ändert sich dabei nicht, das
  // Raster der übrigen Stimmen bleibt also unberührt.
  let orgelpunkt = { grade: [], gewichte: [] };
  bass.gewichte.forEach((w, i) => {
    let teile = Math.max(1, Math.ceil(w / ELEMENT_BASS.maxSek));
    for (let k = 0; k < teile; k++) {
      orgelpunkt.grade.push(bass.grade[i]);
      orgelpunkt.gewichte.push(w / teile);
    }
  });

  return { stimmen, bass: orgelpunkt };
}

// n() + scale() statt note(): die Skalenstufen halten alle sieben Stimmen in
// derselben Tonart, und gebrochene MIDI-Werte braucht es damit nicht mehr.
function elementSchicht(grade, gewichte, sound, oktave, rolle, slowFaktor) {
  return n(grade.map((wert, i) => wert + '@' + gewichte[i].toFixed(3)).join(' '))
    .scale('g' + oktave + ':' + ELEMENT_TONART)
    .s(sound)
    .gain(rolle.gain)
    .attack(rolle.attack)
    .release(rolle.release)
    .room(rolle.room)
    .slow(slowFaktor);
}

// Spieldauer aus der Zahl der Elemente, siehe ELEMENT_DAUER_BEZUG.
function elementDauerSek(kapitelNr) {
  let elemente = elementeFuerKapitel(kapitelNr);
  if (!elemente) return null;
  return SONIFIKATION_GESAMTDAUER_SEK * Math.sqrt(elemente.length / ELEMENT_DAUER_BEZUG);
}

// Für spine-horizontal.js: dieselbe Dauer in Millisekunden, oder null, wenn
// das Elementmodell nicht zuständig ist — dann gilt dort die Ortsformel.
function sonifikationElementDauerMs(kapitelNr) {
  if (SONIFIKATION_MODUS !== 'elemente') return null;
  // Der Ortsvergleich braucht keine Spine-Daten, seine Kreise sind die Orte.
  if (!laeuftOrtsvergleich()) stelleSpineDatenBereit(kapitelNr || undefined);
  let sek = elementDauerSek(kapitelNr);
  return sek ? sek * 1000 : null;
}

// Fortschritt mal Dauer ergibt Sekunden. Das Pulsraster greift erst hier,
// weil es in Sekunden misst und die Dauer vorher nicht feststeht.
function elementZeiten(elemente, gesamtdauerSek) {
  let zeiten = elemente.map(e => e.fortschritt * gesamtdauerSek);
  if (SONIFIKATION_ZEITBASIS !== 'puls') return zeiten;

  // Jeden Abstand auf ganze Pulse runden, mindestens einen. Bewusst ohne
  // Rückskalierung: die Stauchung würde den Versatz nur woandershin
  // schieben, statt ihn hörbar zu lassen.
  let gerastert = [zeiten[0]];
  for (let i = 1; i < zeiten.length; i++) {
    let schritte = Math.max(1, Math.round((zeiten[i] - zeiten[i - 1]) / SONIFIKATION_PULS_SEK));
    gerastert[i] = gerastert[i - 1] + schritte * SONIFIKATION_PULS_SEK;
  }
  return gerastert;
}

// Ohne Kapitelnummer Kapitel 1, sonst das gezoomte — wie überall sonst.
async function spieleElementAudio(kapitelNr) {
  await stelleSonifikationBereit();
  if (!laeuftOrtsvergleich()) stelleSpineDatenBereit(kapitelNr || undefined);
  let elemente = elementeFuerKapitel(kapitelNr);
  if (!elemente) return;

  // Schrittgewichte in Sekunden: Abstand zum nächsten Element, der letzte
  // Schritt trägt den Nachklang. Das kumulierte Gewicht eines Schritts ist
  // damit genau sein Zeitpunkt — deshalb stimmt die Synchronität ohne
  // weiteres Zutun. Die Untergrenze fängt gleichzeitige Elemente ab.

  // ACHTUNG jeden Schritt aus der ERREICHTEN Position rechnen, nicht aus der
  // Sollzeit des Vorgängers: hebt die Untergrenze einen Abstand an, holt der
  // nächste Schritt das wieder auf. Sonst summiert sich der Zuschlag über das
  // ganze Stück und der Ton hinkt am Ende nach — im Ortsvergleich um 0.18 s.
  let zeiten = elementZeiten(elemente, elementDauerSek(kapitelNr));
  let gewichte = [];
  let gesetzt = zeiten[0];
  zeiten.forEach((z, i) => {
    let ziel = i + 1 < zeiten.length ? zeiten[i + 1] : gesetzt + SONIFIKATION_NACHKLANG_SEK;
    let schritt = Math.max(0.02, ziel - gesetzt);
    gewichte.push(schritt);
    gesetzt += schritt;
  });

  let gebaut = baueElementStimmen(elemente, gewichte);

  // ACHTUNG Vorlauf als Pause voranstellen: das erste Element klingt sonst
  // sofort, während das Bild es erst zu seinem eigenen Zeitpunkt zeigt — der
  // ganze Ton liefe um zeiten[0] vor. Im Ortsvergleich sind das 0.8 s, weil
  // die sieben Orte erst ab Annotation 16 von Kapitel 1 vorkommen.
  if (zeiten[0] > 0.001) {
    gewichte.unshift(zeiten[0]);
    Object.values(gebaut.stimmen).forEach(stimme => stimme.grade.unshift('~'));
    gebaut.bass.grade.unshift('~');
    gebaut.bass.gewichte.unshift(zeiten[0]);
  }

  let gesamtdauerSek = gewichte.reduce((a, b) => a + b, 0);
  let slowFaktor = gesamtdauerSek / (1 / SONIFIKATION_STANDARD_CPS);
  let layers = Object.values(gebaut.stimmen).map(st =>
    elementSchicht(st.grade, gewichte, st.sound, st.oktave, ELEMENT_ROLLEN[st.rolle], slowFaktor));
  layers.push(elementSchicht(gebaut.bass.grade, gebaut.bass.gewichte,
    ELEMENT_BASS.sound, ELEMENT_BASS.oktave, ELEMENT_ROLLEN.bass, slowFaktor));

  starteWiedergabe(stack(...layers), gesamtdauerSek);
}



// Reiner Audio-Start. Die Spine läuft unabhängig parallel und nutzt dieselbe
// SONIFIKATION_GESAMTDAUER_SEK, deshalb bleiben beide Uhren synchron.
async function spieleKapitel1SonifikationAudio() {
  await stelleSonifikationBereit();
  let daten = await ladeSonifikationDaten();
  let stationen = daten.stationen;
  let maxAnzahl = Math.max(...stationen.map(s => s.anzahlAnnotationen));

  sonifikationSpielplan = baueSpielplan(stationen);

  // Eine Tonstufe je Station, Länge über die @-Gewichte aus baueSpielplan.
  // .slow() dehnt den einen Zyklus auf SONIFIKATION_GESAMTDAUER_SEK.
  let notenFolge = sonifikationSpielplan.map((e, i) => `${i}@${e.dauer.toFixed(3)}`).join(' ');
  let slowFaktor = SONIFIKATION_GESAMTDAUER_SEK / (1 / SONIFIKATION_STANDARD_CPS);

  let gainFolgenProKategorie = {};
  Object.keys(SONIFIKATION_INSTRUMENTE).forEach(kategorie => {
    gainFolgenProKategorie[kategorie] = baueGainFolge(stationen, sonifikationSpielplan, kategorie, maxAnzahl);
  });

  spieleSchichten(notenFolge, gainFolgenProKategorie, slowFaktor, SONIFIKATION_GESAMTDAUER_SEK);
}

// Kapitel 02–18 lesen dieselben Spine-Einträge wie die Graph-Ansicht, Ton
// und Bild teilen so die Struktur ohne eigene Python-Datei.

// 'rueckkehr'-Schritte bleiben stumm ('~'): eine Rückkehr lässt den alten
// Kreis weiterwachsen, was sich sequenziell nicht nachbilden liesse.
async function spieleKapitelSonifikationAudio(nr) {
  await stelleSonifikationBereit();
  let daten = datenFuerKapitel(nr);
  let eintraege = spineEintraegeFuer(nr);
  if (!daten || !eintraege || !eintraege.length) return;

  let annotationen = daten.annotationen;
  let fWertAnteileJeSchritt = eintraege.map((e, j) => {
    let bis = j + 1 < eintraege.length ? eintraege[j + 1].rv - 1 : annotationen.length - 1;
    let anteile = { ort_loest_emotion_aus: 0, emotion_faerbt_raum: 0, koerper_als_sensor: 0 };
    for (let ai = e.rv; ai <= bis; ai++) {
      let a = annotationen[ai];
      if (a && a.hasFwert && a.fWertType in anteile) anteile[a.fWertType]++;
    }
    return { anteile, anzahl: Math.max(0, bis - e.rv + 1) };
  });
  let maxAnzahl = Math.max(1, ...fWertAnteileJeSchritt.map(s => s.anzahl));

  let melodieIndex = 0;
  let notenFolge = eintraege.map(e => e.typ === 'rueckkehr' ? '~' : String(melodieIndex++)).join(' ');

  let gainFolgenProKategorie = {};
  Object.keys(SONIFIKATION_INSTRUMENTE).forEach(kategorie => {
    gainFolgenProKategorie[kategorie] = eintraege.map((e, j) =>
      e.typ === 'rueckkehr' ? '0' : (fWertAnteileJeSchritt[j].anteile[kategorie] / maxAnzahl).toFixed(2)
    ).join(' ');
  });

  // aktuelleGrafikAnimationDauer() (spine-horizontal.js) liest zoomedKapitel
  // selbst — hier korrekt, weil der Aufruf nur aus toggleGrafikPlay kommt.
  let gesamtdauerSek = aktuelleGrafikAnimationDauer() / 1000;
  let slowFaktor = gesamtdauerSek / (1 / SONIFIKATION_STANDARD_CPS);

  spieleSchichten(notenFolge, gainFolgenProKategorie, slowFaktor, gesamtdauerSek);
}

// Nur der Audio-Teil. Play-Zustand und Button gehören der Graph-Ansicht
// (toggleGrafikPlay, spine-horizontal.js) und bleiben unangetastet.
// Ein einzelner Anschlag zum Anhören, für die anklickbaren Kategorienzeilen
// der Legende. Neben der Wiedergabe: ohne Kapitel und ohne Fortschritt.

// ACHTUNG er beendet, was gerade läuft: ein Strudel-Muster lässt sich nur über
// hush() anhalten, und das trifft alle Stimmen. Läuft die Sonifikation, bricht
// ein Klick auf eine Kategorie sie also ab.
const KATEGORIE_KLANG_SEK = 2;

async function spieleKategorieKlang(kategorie) {
  let instr = ELEMENT_INSTRUMENTE[kategorie];
  if (!instr) return;
  await stelleSonifikationBereit();
  beendeSonifikationAudio();
  let rolle = ELEMENT_ROLLEN.melodie;
  starteWiedergabe(
    n('0').scale(`g${instr.oktave}:${ELEMENT_TONART}`).s(instr.sound)
      .gain(rolle.gain).attack(rolle.attack).release(rolle.release).room(rolle.room)
      .slow(KATEGORIE_KLANG_SEK / (1 / SONIFIKATION_STANDARD_CPS)),
    KATEGORIE_KLANG_SEK);
}

function beendeSonifikationAudio() {
  if (typeof hush === 'function') hush();
  sonifikationSpieltGerade = false;
  if (sonifikationTimeoutId !== null) {
    clearTimeout(sonifikationTimeoutId);
    sonifikationTimeoutId = null;
  }
}


// --- Export ------------------------------------------------------------
// Sieben Namen. Leser: docs/architektur.md.
window.SONIFIKATION_GESAMTDAUER_SEK = SONIFIKATION_GESAMTDAUER_SEK;
window.ELEMENT_INSTRUMENTE = ELEMENT_INSTRUMENTE;
window.spieleKategorieKlang = spieleKategorieKlang;
window.spieleSonifikationFuer = spieleSonifikationFuer;
window.sonifikationElementDauerMs = sonifikationElementDauerMs;
window.beendeSonifikationAudio = beendeSonifikationAudio;

// Lesebindung statt Wertkopie: die Flagge fröre sonst auf false ein und der
// Ton liefe beim Ansichtswechsel weiter.
Object.defineProperty(window, 'sonifikationSpieltGerade', {
  get: function () { return sonifikationSpieltGerade; },
  configurable: true,
});

})(); // Ende der Modulkapselung, siehe Kommentar oben
