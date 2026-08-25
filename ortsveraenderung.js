/* =============================================================================
   ortsveraenderung.js — Schlussakt "Ortsveränderung"

   Sieben kapitelübergreifende Orte (VERGLEICHS_KNOTEN) wachsen als senkrechte
   Linien aus der Karte, kehren auf ihre echten Koordinaten zurück, die Ansicht
   zoomt auf sie — dann zählen die Kapitel 1..18 durch und die Kreise wachsen.
   Ablauf in den Phasenfenstern OV_* und SK_*, umgerechnet von ovPhase().
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 36 von 44 Namen intern, 8 exportiert. Konvention: docs/architektur.md.
(function () {

// Die sieben Orte des Schlussakts, je an ihrer echten Koordinate verankert.
// Orte mit mehreren Namen teilen sich einen Anker (Walter: Mitte der beiden).
const VERGLEICHS_KNOTEN = [
  { label: 'Redaktion La Vie Française', textSeite: 'rechts',
    text: 'Zwölf Kapitel führen hierher. Hier wird geschrieben, was Paris für wahr hält — und hier misst sich, wer er geworden ist. Der einzige Ort, der ihn weder hebt noch senkt.',
    daten: ['12 Kapitel', '240 Annotationen', '19 neg / 19 pos', '37 F-Werte'], lon: 2.34663, lat: 48.87224,
    namen: ['Redaktion La Vie Française'] },
  { label: 'Wohnung Duroy/Madeleine (17 Rue Fontaine)', textSeite: 'rechts',
    text: 'Er zieht in die Räume des Toten, an seinen Schreibtisch, zu seiner Frau. Was als Erbe beginnt, wird zur Zelle — am Ende zählt dieser Ort nur noch Verletzungen.',
    daten: ['9 Kapitel', '314 Annotationen', '+0.12 → −1.00', '72 F-Werte'], lon: 2.33417, lat: 48.88147,
    namen: ['Wohnung Forestier (17 Rue Fontaine)', 'Wohnung Duroy/Madeleine (17 Rue Fontaine)'] },
  { label: 'Rue Constantinople 127', textSeite: 'links-fix', versatz: { x: 0, y: 28 },
    text: 'Die Wohnung, die niemand kennt. Erst gehört sie der Lust, dann der Berechnung — dieselben vier Wände, in denen er Clotilde empfängt und Madeleine stellt.',
    daten: ['8 Kapitel', '166 Annotationen', '43 neg / 17 pos', '43 F-Werte'], lon: 2.31921, lat: 48.88037,
    namen: ['Rue Constantinople 127', 'Wohnung Du Roy (Rue Constantinople 127)'] },
  { label: 'Palais Walter, Faubourg Saint-Honoré', textSeite: 'links-fix', versatz: { x: -28, y: 0 },
    text: 'Der Gipfel, auf den er zielt, zieht selbst um — vom Boulevard ins Palais. Hier wird das Vermögen gemacht, das ihn trägt, und hier bricht Frau Walter vor einem Bild zusammen, das sein Gesicht hat.',
    daten: ['6 Kapitel', '251 Annotationen', '44 neg / 23 pos', '72 F-Werte'], lon: 2.31919, lat: 48.87126,
    namen: ['Boulevard Malesherbes (Walters Haus)', 'Palais Walter, Faubourg Saint-Honoré'] },
  { label: 'Georges Duroys Wohnung (Rue Boursault)', textSeite: 'links-fix', versatz: { x: 0, y: -12 },
    text: 'Ein Zimmer, das nach Armut riecht. Kein Ort des Romans wird härter empfunden — und keiner verschwindet so vollständig: Nach Kapitel 7 kehrt er nie zurück.',
    daten: ['5 Kapitel', '227 Annotationen', '86 neg / 27 pos', '98 F-Werte'], lon: 2.31879, lat: 48.88519,
    namen: ['Georges Duroys Wohnung (Rue Boursault)'] },
  { label: 'Place de la Madeleine', textSeite: 'oben-fix', versatz: { x: 28, y: 0 },
    text: 'Am Anfang geht er hungrig an den Terrassen vorbei und zählt seine Münzen. Am Ende läutet dieselbe Kirche für seine Hochzeit. Kein zweiter Ort kehrt sein Vorzeichen so vollständig um.',
    daten: ['2 Kapitel', '106 Annotationen', '−1.00 → +0.71', '52 F-Werte'], lon: 2.32439, lat: 48.86993,
    namen: ['Place de la Madeleine', 'Église de la Madeleine, Paris'] },
  // Sammelt die kapitelweise verschiedenen Boulevard-Namen zu einer Achse.
  // Label ist als einziges kein Kapitelname — die Gruppe hat keinen.
  { label: 'Grands Boulevards', textSeite: 'oben-fix',
    text: 'Die Bühne der Stadt. Erst steht er davor und sieht zu, wie andere sitzen; später sitzt er selbst, bestellt und wird gesehen.',
    daten: ['7 Kapitel', '114 Annotationen', '−0.50 → +0.50', '36 F-Werte'], lon: 2.33617, lat: 48.87124,
    namen: ['Boulevard des Italiens', 'Boulevard des Capucines', 'Boulevard Poissonnière',
      'Café Riche, Boulevard des Italiens, Paris', 'Café Tortoni, Boulevard des Italiens',
      'Café am Boulevard (Näherung Boulevard Poissonière)', 'Café-Chantant am Boulevard des Capucines',
      'Théâtre du Vaudeville, Boulevard des Capucines', 'Juwelierladen am Boulevard des Capucines',
      'Boulevard-Cafés (unterwegs), Paris'] },
];
// ── Schlussakt "Ortsveränderung" ───────────────────────────────────────────

// Anteile am letzten Akt. Die Fenster überlappen, damit nichts hart einsetzt.
const OV_LINIE_WACHSEN = [0.00, 0.18];
const OV_KARTE_AUS     = [0.12, 0.32];
const OV_LINIE_ZURUECK = [0.32, 0.46];
const OV_LABEL_EIN     = [0.18, 0.30];
const OV_ZOOM          = [0.32, 0.52];
const OV_KAPITEL       = [0.64, 1.00];
// Allerletzter Akt: Startkarte blendet ein, dann Rauszoom auf die Gesamtkarte.
// Die Kreise verblassen dabei, sonst liefen sie beim Rauszoomen ineinander.
const SK_EINBLENDEN = [0.00, 0.45];
const SK_RAUSZOOM   = [0.45, 1.00];
// Der Schlusstext kommt zuletzt und steht allein auf der Gesamtkarte.
const SK_TEXT       = [0.62, 0.90];

const OV_STAFFEL = 0.45;      // Anteil des Wachstumsfensters, über den die Linien versetzt starten
const OV_ZOOM_RAND = 0.18;    // Luft um die sieben Orte im Zielausschnitt
const OV_LINIE_BASIS = 70;    // Tiefe der ersten Linie
const OV_LINIE_SCHRITT = 64;  // zusätzliche Tiefe je weiterem Knoten

const OV_LABEL_MAX_BREITE = 200; // ab dieser Breite wird zweizeilig gesetzt
const OV_LABEL_ZEILE = 15;       // Zeilenhöhe der Ortsbeschriftung
const OV_LABEL_ABSTAND = 34;     // Luft zwischen Kreisrand und Ortsbeschriftung
const OV_LABEL_LUFT = 12;        // Mindestabstand zwischen Beschriftung und nächstem Kreis
// Erläuterungstext je Kreis, Serifenschrift wie die Einstiegstexte, kleiner.
const OV_TEXT_GROESSE = 11;
const OV_TEXT_ZEILE = 16;
const OV_TEXT_BREITE = 220;
const OV_TEXT_ABSTAND = 30;      // Luft zwischen Kreisrand und seitlichem Textblock
                                 // (je Knoten über textAbstand überschreibbar)
const OV_TEXT_ABSTAND_OBEN = 46; // mehr Luft bei den Blöcken über dem Kreis
// textSeite: 'links-fix' am linken Fensterrand, 'rechts' neben dem Kreis,
// 'oben-fix' darüber, ohne Angabe seitlich nach aussen. Text linksbündig.

// Fixierte Varianten zählen beim Zoom nicht mit — die Kreise sollen sich
// ihretwegen nicht verschieben.
const OV_TEXT_RAND = 24;         // Abstand vom Fensterrand bei fixierten Blöcken
// Zuführungslinie zur Textbox; die Box hängt versetzt, damit die Linie nicht
// durch den Text läuft.
const OV_LINIE_VERSATZ = 14;     // Abstand zwischen Linie und erster Textzeile

// Feinkorrektur einzelner Ortspunkte in Pixeln, fährt mit dem Schlusszoom ein.
// Schafft Luft, wo eine Beschriftung in den Nachbarkreis lief.
function ovVersatz(knoten, faktor) {
  let v = knoten.versatz;
  return v ? { x: (v.x || 0) * faktor, y: (v.y || 0) * faktor } : { x: 0, y: 0 };
}
// Datenzeile im Stil von .annotation-tag: serifenlos, fett, versal, gesperrt.
const OV_DATEN_GROESSE = 9.5;
const OV_DATEN_ZEILE = 14;
const OV_DATEN_ABSTAND = 12;   // Luft zwischen Fliesstext und Datenzeile
const OV_DATEN_TRENNER = '  ·  ';

// Bricht einen Fliesstext auf eine Maximalbreite um. Setzt voraus, dass
// Schrift und Grösse gesetzt sind (textWidth misst mit dem aktuellen Zustand).
function ovTextUmbruch(text, maxBreite) {
  let zeilen = [];
  let aktuell = '';
  (text || '').split(' ').forEach(wort => {
    let versuch = aktuell ? aktuell + ' ' + wort : wort;
    if (aktuell && textWidth(versuch) > maxBreite) {
      zeilen.push(aktuell);
      aktuell = wort;
    } else {
      aktuell = versuch;
    }
  });
  if (aktuell) zeilen.push(aktuell);
  return zeilen;
}

// Bricht eine lange Ortsbeschriftung auf zwei Zeilen: vor Klammer, sonst nach
// Komma, sonst am mittigsten Leerzeichen. Schrift muss vorher gesetzt sein.
function ovLabelZeilen(text) {
  if (textWidth(text) <= OV_LABEL_MAX_BREITE) return [text];
  let klammer = text.indexOf('(');
  if (klammer > 0) return [text.slice(0, klammer).trim(), text.slice(klammer).trim()];
  let komma = text.indexOf(',');
  if (komma > 0 && komma < text.length - 1) {
    return [text.slice(0, komma + 1).trim(), text.slice(komma + 1).trim()];
  }
  let mitte = text.length / 2, beste = -1, abstand = Infinity;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ') continue;
    if (Math.abs(i - mitte) < abstand) { abstand = Math.abs(i - mitte); beste = i; }
  }
  if (beste < 0) return [text];
  return [text.slice(0, beste).trim(), text.slice(beste + 1).trim()];
}

function ovPhase(p, fenster) {
  return constrain(map(p, fenster[0], fenster[1], 0, 1), 0, 1);
}

// Je Knoten und Kapitel vorberechnet — live wären es 126 Scans pro Frame.
let ovProKapitel = null;   // [knoten][kapitelNr] -> { bandCounts, fwerte }
let ovRohradien = null;    // Endstand-Rohradius je Knoten (ohne Deckel)
let ovErstesKapitel = null; // erste Kapitelnummer mit Inhalt, je Knoten
let ovLayout = null;       // { breite, hoehe, tiefen, kreisSkala, bbox }

function ovAddiere(ziel, quelle) {
  ['gold_dunkel', 'gold_mittel', 'gold_hell'].forEach(cat => {
    ['neg', 'pos', 'neutral', 'unrated'].forEach(v => { ziel[cat][v] += quelle[cat][v]; });
  });
}

function ovBaueDaten() {
  if (ovProKapitel) return;
  ovProKapitel = VERGLEICHS_KNOTEN.map(k => {
    let filter = new Set(k.namen);
    let proKapitel = {};
    let alleDaten = [['01', stationenData]].concat(
      Object.keys(uebersichtsRouten || {}).sort().map(nr => [nr, datenFuerKapitel(nr)]));
    alleDaten.forEach(([nr, daten]) => {
      if (!daten || !daten.annotationen || !daten.annotationen.length) return;
      let bis = daten.annotationen.length - 1;
      // Ein Scan für beides. Hier unkritisch: ovBaueDaten() läuft nur einmal.
      let treffer = sammleAnnotationenNachOrtBasis(filter, bis, daten);
      proKapitel[nr] = {
        bandCounts: zaehleBandCounts(treffer),
        fwerte: treffer.filter(a => a.hasFwert),
      };
    });
    return proKapitel;
  });
  ovRohradien = ovProKapitel.map(proKapitel => {
    let summe = leereBandCounts();
    Object.values(proKapitel).forEach(k => ovAddiere(summe, k.bandCounts));
    // Infinity statt des 100px-Deckels — sonst wären am Ende fast alle Orte
    // gleich gross. Verkleinert wird gemeinsam über kreisSkala.
    return groessterKreisRadius(summe, Infinity);
  });
  // Erstes Kapitel, in dem der Ort überhaupt vorkommt — daran hängt das
  // Einblenden seiner Textbox (siehe zeichneOrtsveraenderung).
  ovErstesKapitel = ovProKapitel.map(proKapitel => {
    let erstes = 18;
    Object.keys(proKapitel).sort().forEach(nr => {
      if (groessterKreisRadius(proKapitel[nr].bandCounts, Infinity) > 0) erstes = Math.min(erstes, parseInt(nr, 10));
    });
    return erstes;
  });
  ovLayout = null;
}

// Summe bis einschliesslich Kapitel maxNr, plus die Nummer des letzten
// Kapitels, das beigetragen hat (steht unter dem Kreis).
function ovStand(index, maxNr) {
  let summe = leereBandCounts();
  let fwerte = [];
  let letztes = null;
  Object.keys(ovProKapitel[index]).sort().forEach(nr => {
    if (parseInt(nr, 10) > maxNr) return;
    let k = ovProKapitel[index][nr];
    ovAddiere(summe, k.bandCounts);
    fwerte = fwerte.concat(k.fwerte);
    let n = (summe.gold_dunkel.neg + summe.gold_dunkel.pos + summe.gold_dunkel.neutral + summe.gold_dunkel.unrated)
      + (summe.gold_mittel.neg + summe.gold_mittel.pos + summe.gold_mittel.neutral + summe.gold_mittel.unrated)
      + (summe.gold_hell.neg + summe.gold_hell.pos + summe.gold_hell.neutral + summe.gold_hell.unrated);
    if (n > 0 && k.fwerte.length + 1 > 0) letztes = nr;
  });
  return { bandCounts: summe, fwerte, letztes };
}

// Zielausschnitt des Schlusszooms: alle sieben Orte plus Rand, aufs
// Canvas-Seitenverhältnis gebracht, dazu die grösstmögliche Kreis-Skala.
function ovBerechneLayout() {
  if (ovLayout && ovLayout.breite === width && ovLayout.hoehe === height) return ovLayout;

  const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + radians(lat) / 2));
  const mercLat = (y) => degrees(2 * Math.atan(Math.exp(y)) - Math.PI / 2);
  const RAND = 12; // Mindestluft zum Fensterrand

  // Beschriftungsbreiten messen: sie können breiter sein als ihr Kreis und
  // bestimmen mit, wie weit ein Ort vom Rand weg muss.
  textFont(SCHRIFT_SANS);
  textStyle(BOLD);
  textSize(13);
  let labelZeilen = VERGLEICHS_KNOTEN.map(k => ovLabelZeilen(k.label.toUpperCase()));
  let labelHalb = labelZeilen.map(z => Math.max(...z.map(t => textWidth(t))) / 2);
  textStyle(NORMAL);

  // Erläuterungstexte umbrechen — in ihrer eigenen Schrift gemessen.
  textFont(SCHRIFT_SERIF);
  textSize(OV_TEXT_GROESSE);
  let textZeilen = VERGLEICHS_KNOTEN.map(k => ovTextUmbruch(k.text, OV_TEXT_BREITE));
  textFont(SCHRIFT_SANS);
  textStyle(BOLD);
  textSize(OV_DATEN_GROESSE);
  // Zwei feste Zeilen: Kapitel/Annotationen oben, Valenz/F-Werte darunter —
  // so steht die Gefühlsangabe bei jedem Ort an derselben Stelle.
  let datenZeilen = VERGLEICHS_KNOTEN.map(k => {
    if (!k.daten || !k.daten.length) return [];
    let oben = k.daten.slice(0, 2).join(OV_DATEN_TRENNER).toUpperCase();
    let unten = k.daten.slice(2).join(OV_DATEN_TRENNER).toUpperCase();
    return ovTextUmbruch(oben, OV_TEXT_BREITE).concat(unten ? ovTextUmbruch(unten, OV_TEXT_BREITE) : []);
  });
  textStyle(NORMAL);
  textFont(SCHRIFT_SERIF);
  textSize(OV_TEXT_GROESSE);

  // Höhe unter dem Kreis: nur Ortsbeschriftung und Kapitelzeile.
  let untenHoehe = labelZeilen.map(z => OV_LABEL_ABSTAND + (z.length - 1) * OV_LABEL_ZEILE + 16 + 7);
  let textBreite = textZeilen.map(z => z.length ? Math.max(...z.map(t => textWidth(t))) : 0);
  // Halbe Texthöhe — der Block steht mittig auf der Kreishöhe.
  let textHalbHoehe = textZeilen.map(z => z.length ? (z.length - 1) * OV_TEXT_ZEILE / 2 : 0);

  let lons = VERGLEICHS_KNOTEN.map(k => k.lon);
  let lats = VERGLEICHS_KNOTEN.map(k => k.lat);
  let w0 = Math.min(...lons), o0 = Math.max(...lons);
  let s0 = Math.min(...lats), n0 = Math.max(...lats);

  // Bbox für einen gegebenen Rand bauen: Rand auf die Ankerspanne, dann auf
  // das Canvas-Seitenverhältnis aufziehen.
  //
  // ACHTUNG Seitenverhältnis in MERCATOR-Einheiten, nicht in Grad — sonst
  // wird der Ausschnitt auf Pariser Höhe um Faktor 1.52 horizontal gestreckt.
  let baueBbox = (rand) => {
    let dLon = (o0 - w0) * rand, dLat = (n0 - s0) * rand;
    let west = w0 - dLon, ost = o0 + dLon, sued = s0 - dLat, nord = n0 + dLat;
    let xW = radians(west), xO = radians(ost);
    let yS = mercY(sued), yN = mercY(nord);
    let sv = width / height;
    if ((xO - xW) / (yN - yS) < sv) {
      let zu = ((yN - yS) * sv - (xO - xW)) / 2;
      west = degrees(xW - zu); ost = degrees(xO + zu);
    } else {
      let zu = ((xO - xW) / sv - (yN - yS)) / 2;
      sued = mercLat(yS - zu); nord = mercLat(yN + zu);
    }
    return { west, east: ost, south: sued, north: nord };
  };

  // Grösster Faktor, bei dem sich weder Kreise berühren noch eine
  // Beschriftung in den Kreis darunter läuft.

  // ACHTUNG zweite Bedingung nötig, weil der Text unter dem Kreis NICHT
  // mitskaliert: dy >= r_oben*s + untenHoehe_oben + r_unten*s, also
  // s <= (dy - untenHoehe_oben) / (r_oben + r_unten).
  let skalaFuer = (bbox, pos) => {
    let skala = 1;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        let d = dist(pos[i].x, pos[i].y, pos[j].x, pos[j].y);
        skala = Math.min(skala, d / ((ovRohradien[i] + ovRohradien[j]) * 1.06));

        let oben = pos[i].y < pos[j].y ? i : j;
        let unten = oben === i ? j : i;
        let dy = Math.abs(pos[i].y - pos[j].y);
        let dx = Math.abs(pos[i].x - pos[j].x);
        // Trifft die Beschriftung des oberen den unteren überhaupt seitlich?
        if (dx < labelHalb[oben] + ovRohradien[unten] * skala) {
          // OV_LABEL_LUFT: sonst berühren sich Beschriftung und Kreis exakt,
          // weil die Bedingung mit Gleichheit erfüllt wird.
          let erlaubt = (dy - untenHoehe[oben] - OV_LABEL_LUFT) / (ovRohradien[oben] + ovRohradien[unten]);
          if (erlaubt > 0) skala = Math.min(skala, erlaubt);
        }
      }
    }
    return skala;
  };

  // Überstand über den Fensterrand in px: Kreisradius nach allen Seiten, unten
  // zusätzlich Beschriftung und Kapitelzeile, seitlich die halbe Labelbreite.

  // Erläuterungstext nach AUSSEN — er wandert so nie über die Bildmitte, wo
  // die meisten Nachbarkreise liegen.
  let textRechts = pos => pos.x < width / 2;
  let ueberstand = (pos, skala) => {
    let max = 0;
    pos.forEach((p, i) => {
      let r = ovRohradien[i] * skala;
      let eigen = Math.max(r, labelHalb[i]);
      // Am Fensterrand fixierte Blöcke bleiben aussen vor: sie stehen fest und
      // dürfen den Zoom nicht aufziehen.
      let fix = !!VERGLEICHS_KNOTEN[i].textSeite;
      let block = fix ? eigen : r + OV_TEXT_ABSTAND + textBreite[i];
      let links = textRechts(p) ? eigen : block;
      let rechts = textRechts(p) ? block : eigen;
      max = Math.max(max,
        RAND - (p.y - Math.max(r, textHalbHoehe[i])),      // oben
        (p.y + r + untenHoehe[i]) - (height - RAND),        // unten
        (p.y + textHalbHoehe[i]) - (height - RAND),         // Textblock nach unten
        RAND - (p.x - links),
        (p.x + rechts) - (width - RAND));
    });
    return max;
  };

  // Rand aufziehen, bis alles passt. Grösserer Rand heisst kleinere Kreise,
  // deshalb konvergiert das.
  let rand = OV_ZOOM_RAND;
  let mitVersatz = (bbox) => VERGLEICHS_KNOTEN.map(k => {
    let p = lonLatToScreen(k.lon, k.lat, bbox, 0, 0);
    let v = ovVersatz(k, 1); // das Layout rechnet mit dem Endzustand
    return { x: p.x + v.x, y: p.y + v.y };
  });
  let bbox = baueBbox(rand);
  let pos = mitVersatz(bbox);
  let kreisSkala = skalaFuer(bbox, pos);
  for (let versuch = 0; versuch < 20 && ueberstand(pos, kreisSkala) > 0.5; versuch++) {
    rand *= 1.15;
    bbox = baueBbox(rand);
    pos = mitVersatz(bbox);
    kreisSkala = skalaFuer(bbox, pos);
  }

  // Tiefe der senkrechten Linien in der Zwischenphase: gestaffelt nach der
  // Höhenlage der Anker, gedeckelt auf die Fensterhöhe.
  let reihenfolge = pos.map((p, i) => ({ i, y: p.y })).sort((a, b) => a.y - b.y).map(a => a.i);
  let tiefen = [];
  reihenfolge.forEach((idx, rang) => { tiefen[idx] = OV_LINIE_BASIS + rang * OV_LINIE_SCHRITT; });
  let maxTiefe = Math.max(...tiefen);
  let platz = height - 90;
  if (maxTiefe > platz) tiefen = tiefen.map(t => t * platz / maxTiefe);

  ovLayout = { breite: width, hoehe: height, bbox, kreisSkala, tiefen, reihenfolge, rand,
    labelZeilen, textZeilen, datenZeilen };
  return ovLayout;
}

// Zielausschnitt für den Schlusszoom — draw() blendet activeBbox dorthin.
function ovZoomBbox() {
  if (!ovProKapitel) return null;
  return ovBerechneLayout().bbox;
}

// p = Fortschritt im Akt (0..1), bbox = die gerade gültige Kartenbbox.
// textFaktor blendet NUR die Schrift aus, die Kreise bleiben stehen.
function zeichneOrtsveraenderung(bbox, p, alpha, textFaktor = 1) {
  if (alpha <= 0 || !stationenData || !stationenData.annotationen) return;
  ovBaueDaten();
  let layout = ovBerechneLayout();

  let pZoomPhase = ovPhase(p, OV_ZOOM);
  let pWachsen = ovPhase(p, OV_LINIE_WACHSEN);
  let pZurueck = ovPhase(p, OV_LINIE_ZURUECK);
  let pLabel = ovPhase(p, OV_LABEL_EIN);
  let pKapitel = ovPhase(p, OV_KAPITEL);
  let maxKapitel = Math.max(1, Math.min(18, Math.ceil(pKapitel * 18)));
  let kreisAlpha = pKapitel > 0 ? 1 : 0;

  let n = VERGLEICHS_KNOTEN.length;

  textFont(SCHRIFT_SANS);
  textAlign(CENTER, CENTER);

  VERGLEICHS_KNOTEN.forEach((k, i) => {
    let anker = lonLatToScreen(k.lon, k.lat, bbox, 0, 0);
    let v = ovVersatz(k, pZoomPhase);
    anker = { x: anker.x + v.x, y: anker.y + v.y };
    // Gestaffelter Start: der Knoten mit dem obersten Anker beginnt zuerst.
    let rang = layout.reihenfolge.indexOf(i);
    let start = (rang / n) * OV_STAFFEL;
    let wachsen = constrain(map(pWachsen, start, start + (1 - OV_STAFFEL), 0, 1), 0, 1);
    let tiefe = layout.tiefen[i] * wachsen * (1 - pZurueck);
    let cy = anker.y + tiefe;

    if (tiefe > 0.5) {
      stroke(ROUTE_COLOR_RGB.r, ROUTE_COLOR_RGB.g, ROUTE_COLOR_RGB.b, alpha);
      strokeWeight(1.5);
      line(anker.x, anker.y, anker.x, cy);
      noStroke();
    }

    // Ortspunkt am unteren Ende der Linie — er wandert hinunter und wieder
    // zurück auf seinen echten Ort.
    drawingContext.fillStyle = `rgba(${ROUTE_COLOR_RGB.r}, ${ROUTE_COLOR_RGB.g}, ${ROUTE_COLOR_RGB.b}, ${alpha / 255})`;
    drawingContext.beginPath();
    drawingContext.arc(anker.x, cy, 3.5, 0, TWO_PI);
    drawingContext.fill();

    let radius = 0;
    let stand = null;
    if (kreisAlpha > 0) {
      stand = ovStand(i, maxKapitel);
        // Innerhalb des Blocks: bei unsichtbarem Kreis muss radius 0 bleiben,
        // daran hängt der Abstand der Beschriftung darunter.
        radius = groessterKreisRadius(stand.bandCounts, Infinity, layout.kreisSkala);
        zeichneKreiseFuerRun(anker.x, cy, stand.bandCounts, (alpha / 255) * kreisAlpha,
          PI, layout.kreisSkala, Infinity);
        zeichneFwertPunkte(anker.x, cy, radius, stand.fwerte, (alpha / 255) * kreisAlpha, 'obenUnten');
    }

    // Reihenfolge von oben nach unten: Kreis, Ortsbeschriftung, Kapitelzähler.
    let rand = radius > 0 ? radius : 6;

    let zeilen = layout.labelZeilen[i];
    if (pLabel > 0) {
      textStyle(BOLD);
      textSize(13);
      // ACHTUNG fillStyle direkt setzen, nicht über fill(): p5 überspringt die
      // Zuweisung bei gleichbleibendem Wert. zeichneFwertPunkte schreibt oben
      // direkt in fillStyle und umgeht den Zwischenspeicher — der Ortsname
      // wurde dadurch rot, sobald sich seine Deckkraft nicht mehr änderte.
      drawingContext.fillStyle = `rgba(33, 43, 46, ${alpha * pLabel * textFaktor / 255})`;
      zeilen.forEach((zeile, z) => {
        drawingContext.fillText(zeile, anker.x, cy + rand + OV_LABEL_ABSTAND + z * OV_LABEL_ZEILE);
      });
    }

    // Kapitelzähler darunter — rutscht bei zweizeiliger Beschriftung mit.
    if (kreisAlpha > 0 && stand) {
      textStyle(NORMAL);
      textSize(11);
      drawingContext.fillStyle = `rgba(90, 90, 90, ${alpha * kreisAlpha * textFaktor / 255})`;
      drawingContext.fillText(stand.letztes ? `Kapitel ${stand.letztes}` : 'Kapitel –',
        anker.x, cy + rand + OV_LABEL_ABSTAND + (zeilen.length - 1) * OV_LABEL_ZEILE + 16);
    }

    // Erläuterung seitlich neben dem Kreis, linksbündig und nach aussen.

    // Die Textbox erscheint, wenn dieser Ort seine erste Annotation bekommt —
    // die Texte kommen dadurch nacheinander statt alle auf einmal.
    let erstes = ovErstesKapitel[i];
    let pTextbox = constrain(map(pKapitel * 18, erstes - 1, erstes, 0, 1), 0, 1);
    let erlaeuterung = layout.textZeilen[i];
    if (pTextbox > 0 && erlaeuterung && erlaeuterung.length) {
      textFont(SCHRIFT_SERIF);
      textStyle(NORMAL);
      textSize(OV_TEXT_GROESSE);
      textAlign(LEFT, CENTER);
      drawingContext.textAlign = 'left';
      drawingContext.fillStyle = `rgba(33, 43, 46, ${alpha * pTextbox * textFaktor * 0.85 / 255})`;
      let breite = Math.max(...erlaeuterung.map(t => textWidth(t)));
      // Am ENDRADIUS aufgehängt, nicht am laufenden — sonst schöbe der
      // wachsende Kreis den Text Kapitel für Kapitel vor sich her.
      let endRand = ovRohradien[i] * layout.kreisSkala;
      let abstand = k.textAbstand || OV_TEXT_ABSTAND;
      let linksBuendig, start;
      let linie = null; // [x1, y1, x2, y2] — Zuführung vom Ortspunkt zur Box
      if (k.textSeite === 'oben-fix') {
        // Senkrechte Linie vom Kreis nach oben; die Box hängt rechts davon,
        // ihr oberer Rand am Ende der Linie.
        let datenHoehe = layout.datenZeilen[i].length
          ? OV_DATEN_ABSTAND + layout.datenZeilen[i].length * OV_DATEN_ZEILE : 0;
        start = cy - endRand - OV_TEXT_ABSTAND_OBEN - datenHoehe
          - (erlaeuterung.length - 1) * OV_TEXT_ZEILE;
        linksBuendig = anker.x + OV_LINIE_VERSATZ;
        linie = [anker.x, cy - endRand, anker.x, start - OV_TEXT_ZEILE / 2];
      } else {
        // Waagrechte Linie auf Punkthöhe, Box darunter. Sie spannt über die
        // Boxbreite, damit der Text frei bleibt.
        let rechtsDavon = k.textSeite === 'rechts' ? true
          : anker.x < width / 2;
        if (k.textSeite === 'links-fix') linksBuendig = OV_TEXT_RAND;
        else linksBuendig = rechtsDavon
          ? anker.x + endRand + abstand
          : anker.x - endRand - abstand - breite;
        let nachRechts = linksBuendig > anker.x;
        linie = [anker.x + (nachRechts ? endRand : -endRand), cy,
          nachRechts ? linksBuendig + breite : linksBuendig, cy];
        start = cy + OV_LINIE_VERSATZ + OV_TEXT_ZEILE / 2;
      }

      if (linie) {
        stroke(33, 43, 46, alpha * pTextbox * textFaktor * 0.5);
        strokeWeight(1);
        line(linie[0], linie[1], linie[2], linie[3]);
        noStroke();
      }
      erlaeuterung.forEach((zeile, z) => {
        drawingContext.fillText(zeile, linksBuendig, start + z * OV_TEXT_ZEILE);
      });

      // Datenzeile darunter. letterSpacing kennt nicht jeder Browser, wo es
      // fehlt wird es ignoriert.
      let daten = layout.datenZeilen[i];
      if (daten && daten.length) {
        textFont(SCHRIFT_SANS);
        textStyle(BOLD);
        textSize(OV_DATEN_GROESSE);
        drawingContext.letterSpacing = '0.06em';
        drawingContext.fillStyle = `rgba(33, 43, 46, ${alpha * pTextbox * textFaktor * 0.7 / 255})`;
        let dStart = start + (erlaeuterung.length - 1) * OV_TEXT_ZEILE + OV_DATEN_ABSTAND + OV_DATEN_ZEILE;
        daten.forEach((zeile, z) => {
          drawingContext.fillText(zeile, linksBuendig, dStart + z * OV_DATEN_ZEILE);
        });
        drawingContext.letterSpacing = '0px';
        textStyle(NORMAL);
      }

      textFont(SCHRIFT_SANS);
      textSize(11);
      textAlign(CENTER, CENTER);
      drawingContext.textAlign = 'center';
    }
  });

  textAlign(LEFT, CENTER); // zurücksetzen — andere Zeichenfunktionen erwarten das
  textStyle(NORMAL);
}


// --- Export ------------------------------------------------------------
// Acht Namen, alle nur von sketch.js gelesen.
window.OV_KARTE_AUS = OV_KARTE_AUS;
window.OV_ZOOM = OV_ZOOM;
window.SK_EINBLENDEN = SK_EINBLENDEN;
window.SK_RAUSZOOM = SK_RAUSZOOM;
window.SK_TEXT = SK_TEXT;
window.ovPhase = ovPhase;
window.ovZoomBbox = ovZoomBbox;
window.zeichneOrtsveraenderung = zeichneOrtsveraenderung;

})(); // Ende der Modulkapselung, siehe Kommentar oben
