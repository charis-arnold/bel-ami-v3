/* =============================================================================
   sonifikation.js — Kapitel als Tonstück, über Strudel

   Liefert NUR den Ton zum Play-Button der Graph-Ansicht; die Spine läuft
   parallel mit derselben Gesamtdauer. Zeitbasiert, nicht scroll-gekoppelt:
   der Zeitplan kommt aus Gehstrecke und Annotationsdichte je Station
   (kapitel01-sonifikation.json). Drei F-Wert-Kategorien = drei Layer in c-moll.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 17 von 21 Namen intern, 4 exportiert. Konvention: docs/architektur.md.
(function () {

// Dieselben zwei CDN-Quellen, die strudel.cc selbst lädt. @strudel/web bringt
// keine Samples mit; gm_*-Sounds brauchen ein Extrapaket und bleiben draussen.
const SONIFIKATION_SAMPLE_BAENKE = [
  ['https://strudel.b-cdn.net/piano.json', 'https://strudel.b-cdn.net/piano/'],
  ['https://strudel.b-cdn.net/vcsl.json', 'https://strudel.b-cdn.net/VCSL/'],
];

// VCSL hat keine Streicher/Klarinetten — Klavier/Orgel/Saxophon statt der
// ursprünglich gedachten Saint-Saëns-Besetzung.
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
  await initStrudel({
    prebake: () => Promise.all(
      SONIFIKATION_SAMPLE_BAENKE.map(([json, basis]) => samples(json, basis, { prebake: true }))
    ),
  });
  // ACHTUNG das Promise von initStrudel() kann einen Tick VOR der Registrierung
  // von n/s/note auflösen — ein n(...) direkt danach wirft "n is not defined".
  // Kurzes Polling statt festem sleep(). Nur per Test beobachtet, nicht
  // dokumentiert.
  let versuche = 0;
  while (typeof n !== 'function' && versuche < 50) {
    await new Promise(r => setTimeout(r, 10));
    versuche++;
  }
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

  stack(...layers).play();

  sonifikationSpieltGerade = true;

  sonifikationTimeoutId = setTimeout(() => {
    sonifikationTimeoutId = null;
    beendeSonifikationAudio();
  }, gesamtdauerSek * 1000);
}

// Wählt den Ton zur offenen Ansicht: Kapitel 1, wenn keines gezoomt ist.
// Ohne await, der Aufrufer wartet ohnehin nicht.
function spieleSonifikationFuer(kapitelNr) {
  if (kapitelNr) return spieleKapitelSonifikationAudio(kapitelNr);
  return spieleKapitel1SonifikationAudio();
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
function beendeSonifikationAudio() {
  if (typeof hush === 'function') hush();
  sonifikationSpieltGerade = false;
  if (sonifikationTimeoutId !== null) {
    clearTimeout(sonifikationTimeoutId);
    sonifikationTimeoutId = null;
  }
}


// --- Export ------------------------------------------------------------
// Vier Namen. Leser: docs/architektur.md.
window.SONIFIKATION_GESAMTDAUER_SEK = SONIFIKATION_GESAMTDAUER_SEK;
window.spieleSonifikationFuer = spieleSonifikationFuer;
window.beendeSonifikationAudio = beendeSonifikationAudio;

// Lesebindung statt Wertkopie: die Flagge fröre sonst auf false ein und der
// Ton liefe beim Ansichtswechsel weiter.
Object.defineProperty(window, 'sonifikationSpieltGerade', {
  get: function () { return sonifikationSpieltGerade; },
  configurable: true,
});

})(); // Ende der Modulkapselung, siehe Kommentar oben
