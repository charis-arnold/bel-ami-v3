/* =============================================================================
   ortsveraenderung.js — Schlussakt "Ortsveränderung"

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Der letzte
   Akt der Erzählung: sieben kapitelübergreifende Orte (VERGLEICHS_KNOTEN)
   wachsen als senkrechte Linien aus der Karte, die Karte blendet aus, die
   Punkte kehren auf ihre echten Koordinaten zurück, die Ansicht zoomt auf den
   Ausschnitt, der alle sieben fasst — und während die Kapitel 1..18
   durchzählen, wachsen ihre Kreisgrafiken auf den Endstand.

   Der Ablauf steckt in den Phasenfenstern OV_* (Ortsveränderung) und SK_*
   (Schlusskarte); ovPhase() rechnet den Aktfortschritt in den Stand eines
   einzelnen Fensters um.

   --- Abhängigkeiten NACH AUSSEN (alle erst zur Laufzeit) -------------------
   aus sketch.js:          stationenData, uebersichtsRouten, datenFuerKapitel,
                           leereBandCounts, lonLatToScreen, zeichneKreiseFuerRun,
                           zeichneFwertPunkte
   aus datenbereinigung.js: KREIS_KATEGORIEN, ROUTE_COLOR_RGB, kreisRadius,
                           sammleAnnotationenNachOrtBasis,
                           zaehleAnnotationenLiveNachOrtBasis
   aus p5:                 width/height, Zeichen- und Text-API, drawingContext

   --- Wer von aussen hierher greift ----------------------------------------
   draw() in sketch.js, an sieben Stellen: fünf ovPhase()-Aufrufe mit
   SK_EINBLENDEN / SK_RAUSZOOM / SK_TEXT / OV_KARTE_AUS / OV_ZOOM, dazu
   ovZoomBbox() und zeichneOrtsveraenderung().

   Wird in index.html VOR sketch.js geladen. Kein Top-Level-Initialisierer
   dieser Datei ruft eine Funktion auf — beim Laden wird nichts ausgewertet.
============================================================================= */

// Die sieben kapitelübergreifenden Orte der Ortsveränderung (Schlussakt,
// siehe zeichneOrtsveraenderung). Jeder ist an seiner echten Koordinate
// verankert; die senkrechte Linie darunter ist eine Zwischenphase, an deren
// Ende die Punkte wieder auf ihrem Ort liegen.
//
// Orte mit mehreren Namen teilen sich einen Anker: Rue Fontaine (Forestiers
// Wohnung, dann Duroys) und Rue Constantinople sind ohnehin dieselbe Adresse,
// die Madeleine-Varianten liegen 51 m auseinander. Die beiden Walter-Adressen
// sind 465 m getrennt — der Anker liegt in ihrer Mitte.
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
  // Einziger öffentlicher Ort neben der Madeleine, der über mehrere Kapitel
  // trägt — aber nur, wenn man die kapitelweise vergebenen Einzelnamen wieder
  // zusammenführt: derselbe Boulevard heisst je nach Kapitel "Boulevard des
  // Italiens", "Café Riche", "Café Tortoni" oder "Café am Boulevard". Einzeln
  // steht jeder davon in genau einem Kapitel, zusammen sind es sieben.
  // Bewusst NICHT dabei: die ÄUSSEREN Boulevards (Weinstube und verdächtige
  // Lokale, lat 48.883 — eine andere Achse im Norden), der Boulevard
  // Malesherbes (das ist das Haus Walter, eigener Knoten) und der Boulevard
  // des Batignolles. Das Label ist als einziges kein Kapitelname: für die
  // Gruppe gibt es keinen, "Grands Boulevards" ist der historische Name der
  // Achse.
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
// Ablauf über den letzten Akt (kreisVergleichStart..1.0), als Anteile davon.
// Die Phasen überlappen bewusst, damit nichts hart einsetzt.
//   1. Die senkrechten Linien wachsen gestaffelt nach unten — erst hier,
//      wenn die letzte Übersichtsroute fertig gezeichnet ist.
//   2. Die Karte blendet aus. Die ROUTEN bleiben stehen: auf sie sollen die
//      Ortspunkte gleich zu liegen kommen.
//   3. Die Linien schrumpfen wieder, die Punkte landen auf ihrem echten Ort.
//   4. Die Ortsbeschriftung blendet ein — sobald die Linien ausgewachsen
//      sind und bevor sie zurückschrumpfen. Sie hängt am unteren Ende der
//      Linie und fährt beim Schrumpfen mit dem Punkt nach oben.
//   5. Zoom auf den Ausschnitt, der alle sieben Orte fasst — dadurch rücken
//      sie weit genug auseinander, dass die Kreise sich nicht überlagern.
//      Läuft GLEICHZEITIG mit dem Schrumpfen der Linien an: die Punkte
//      fahren nach oben zurück, während die Karte sich unter ihnen aufzieht,
//      statt beides nacheinander abzuspulen.
//   6. Die Kreise wachsen, während unter ihnen die Kapitel durchzählen.
const OV_LINIE_WACHSEN = [0.00, 0.18];
const OV_KARTE_AUS     = [0.12, 0.32];
const OV_LINIE_ZURUECK = [0.32, 0.46];
const OV_LABEL_EIN     = [0.18, 0.30];
const OV_ZOOM          = [0.32, 0.52];
const OV_KAPITEL       = [0.64, 1.00];
// Allerletzter Akt: die Startkarte kommt zurück. Erst blendet sie hinter den
// sieben Kreisen ein, danach fährt die Ansicht aus deren Ausschnitt auf die
// Gesamtkarte zurück. Die Kreise verblassen dabei — beim Rauszoomen behalten
// sie ihre Pixelgrösse, während die Karte darunter schrumpft, und würden
// sonst ineinanderlaufen.
const SK_EINBLENDEN = [0.00, 0.45];
const SK_RAUSZOOM   = [0.45, 1.00];
// Der Schlusstext kommt zuletzt: erst die Karte, dann die Zoomfahrt, dann das
// Wort. Er steht am Ende allein auf der Gesamtkarte.
const SK_TEXT       = [0.62, 0.90];

const OV_STAFFEL = 0.45;      // Anteil des Wachstumsfensters, über den die Linien versetzt starten
const OV_ZOOM_RAND = 0.18;    // Luft um die sieben Orte im Zielausschnitt
const OV_LINIE_BASIS = 70;    // Tiefe der ersten Linie
const OV_LINIE_SCHRITT = 64;  // zusätzliche Tiefe je weiterem Knoten

const OV_LABEL_MAX_BREITE = 200; // ab dieser Breite wird zweizeilig gesetzt
const OV_LABEL_ZEILE = 15;       // Zeilenhöhe der Ortsbeschriftung
const OV_LABEL_ABSTAND = 34;     // Luft zwischen Kreisrand und Ortsbeschriftung
const OV_LABEL_LUFT = 12;        // Mindestabstand zwischen Beschriftung und nächstem Kreis
// Erläuterungstext unter jedem Kreis: dieselbe Serifenschrift wie die
// Einstiegstexte, nur viel kleiner. Er erzählt die gefühlte Veränderung des
// Orts und nennt die Zahlen dahinter.
const OV_TEXT_GROESSE = 11;
const OV_TEXT_ZEILE = 16;
const OV_TEXT_BREITE = 220;
const OV_TEXT_ABSTAND = 30;      // Luft zwischen Kreisrand und seitlichem Textblock
                                 // (je Knoten über textAbstand überschreibbar)
const OV_TEXT_ABSTAND_OBEN = 46; // mehr Luft bei den Blöcken über dem Kreis
// textSeite legt fest, wo der Erläuterungsblock steht:
//   'links-fix' — am linken Fensterrand
//   'rechts'    — direkt neben dem Kreis, Seite vorgegeben
//   'oben-fix'  — über dem Kreis, linke Textkante auf dessen Achse
//   ohne Angabe — seitlich neben dem Kreis, nach aussen von der Bildmitte
//                 gewählt
// (Die Gegenstücke 'rechts-fix' und 'links' waren nie in Gebrauch und wurden
// entfernt, siehe Schritt 11 im Cleanup-Log — wer sie braucht, muss die
// jeweilige Verzweigung wieder ergänzen.)
// Alle fixierten Varianten werden bei der Zoomberechnung NICHT mitgezählt:
// sie stehen fest, und die Kreise sollen sich ihretwegen nicht verschieben.
// Der Text ist in jedem Fall linksbündig gesetzt.
const OV_TEXT_RAND = 24;         // Abstand vom Fensterrand bei fixierten Blöcken
// Zuführungslinie vom Ortspunkt zur Textbox. Die Box hängt versetzt an ihrem
// Ende, damit die Linie nicht durch den Text läuft: bei den seitlichen Blöcken
// unterhalb der waagrechten Linie, beim oberen rechts neben der senkrechten.
const OV_LINIE_VERSATZ = 14;     // Abstand zwischen Linie und erster Textzeile

// versatz: Feinkorrektur einzelner Ortspunkte in Bildschirmpixeln. Sie fährt
// zusammen mit dem Schlusszoom ein (OV_ZOOM) — in genau dem Moment blendet die
// Route aus, die Punkte müssen also nicht mehr exakt auf ihr liegen. Sie
// schafft Luft, wo die Beschriftung eines Kreises in den Nachbarkreis lief:
// Palais Walter und Place de la Madeleine rücken waagrecht auseinander,
// Rue Boursault und Rue Constantinople senkrecht.
function ovVersatz(knoten, faktor) {
  let v = knoten.versatz;
  return v ? { x: (v.x || 0) * faktor, y: (v.y || 0) * faktor } : { x: 0, y: 0 };
}
const OV_TEXT_FONT = "'Source Serif 4', serif";
// Datenzeile unter dem Fliesstext — im Stil der Kategorien in der
// Annotationsbox (.annotation-tag): serifenlos, fett, versal, gesperrt.
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

// Bricht eine lange Ortsbeschriftung auf zwei Zeilen. Bevorzugte Trennstellen
// in dieser Reihenfolge: vor einer Klammer ("GEORGES DUROYS WOHNUNG" /
// "(RUE BOURSAULT)"), nach einem Komma ("PALAIS WALTER," / "FAUBOURG
// SAINT-HONORÉ"), sonst am Leerzeichen, das der Mitte am nächsten liegt.
// Setzt voraus, dass Schrift und Grösse der Beschriftung bereits gesetzt sind
// (textWidth misst mit dem aktuellen Zustand).
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

// Je Knoten und Kapitel vorberechnet: bandCounts und F-Wert-Annotationen.
// Der Schlussakt zählt die Kapitel durch (1..18) und summiert dabei auf —
// das live über alle 18 Kapitel zu scannen wären 126 Durchläufe pro Frame.
// Einmal gebaut, danach nur noch aufaddiert.
let ovProKapitel = null;   // [knoten][kapitelNr] -> { bandCounts, fwerte }
let ovRohradien = null;    // Endstand-Rohradius je Knoten (ohne Deckel)
let ovErstesKapitel = null; // erste Kapitelnummer mit Inhalt, je Knoten
let ovLayout = null;       // { breite, hoehe, tiefen, kreisSkala, bbox }

function ovAddiere(ziel, quelle) {
  ['gold_dunkel', 'gold_mittel', 'gold_hell'].forEach(cat => {
    ['neg', 'pos', 'neutral', 'unrated'].forEach(v => { ziel[cat][v] += quelle[cat][v]; });
  });
}

function ovRadiusAus(bandCounts) {
  let r = 0;
  KREIS_KATEGORIEN.forEach(kat => {
    let b = bandCounts[kat.key] || {};
    r = Math.max(r, kreisRadius((b.neg || 0) + (b.pos || 0) + (b.neutral || 0) + (b.unrated || 0), Infinity));
  });
  return r;
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
      proKapitel[nr] = {
        bandCounts: zaehleAnnotationenLiveNachOrtBasis(filter, bis, daten),
        fwerte: sammleAnnotationenNachOrtBasis(filter, bis, daten).filter(a => a.hasFwert),
      };
    });
    return proKapitel;
  });
  ovRohradien = ovProKapitel.map(proKapitel => {
    let summe = leereBandCounts();
    Object.values(proKapitel).forEach(k => ovAddiere(summe, k.bandCounts));
    return ovRadiusAus(summe);
  });
  // Erstes Kapitel, in dem der Ort überhaupt vorkommt — daran hängt das
  // Einblenden seiner Textbox (siehe zeichneOrtsveraenderung).
  ovErstesKapitel = ovProKapitel.map(proKapitel => {
    let erstes = 18;
    Object.keys(proKapitel).sort().forEach(nr => {
      if (ovRadiusAus(proKapitel[nr].bandCounts) > 0) erstes = Math.min(erstes, parseInt(nr, 10));
    });
    return erstes;
  });
  ovLayout = null;
}

// Summe bis einschliesslich Kapitel maxNr ('18' = alles). Liefert zusätzlich
// die Nummer des letzten Kapitels, das überhaupt beigetragen hat — sie steht
// im Schlussakt unter dem Kreis.
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

// Zielausschnitt des Schlusszooms: alle sieben Orte plus Rand, auf das
// Seitenverhältnis des Canvas gebracht. Dazu die Kreis-Skala, bei der sich in
// diesem Ausschnitt keine zwei Kreise berühren — dadurch stehen die Kreise am
// Ende deutlich grösser als in der gestaffelten Zwischenphase.
function ovBerechneLayout() {
  if (ovLayout && ovLayout.breite === width && ovLayout.hoehe === height) return ovLayout;

  const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + radians(lat) / 2));
  const mercLat = (y) => degrees(2 * Math.atan(Math.exp(y)) - Math.PI / 2);
  const RAND = 12; // Mindestluft zum Fensterrand

  // Beschriftungsbreiten einmal messen — sie bestimmen mit, wie weit ein Ort
  // vom seitlichen Rand entfernt stehen muss ("GEORGES DUROYS WOHNUNG (RUE
  // BOURSAULT)" ist deutlich breiter als sein Kreis).
  textFont("'Source Sans 3', sans-serif");
  textStyle(BOLD);
  textSize(13);
  let labelZeilen = VERGLEICHS_KNOTEN.map(k => ovLabelZeilen(k.label.toUpperCase()));
  let labelHalb = labelZeilen.map(z => Math.max(...z.map(t => textWidth(t))) / 2);
  textStyle(NORMAL);

  // Erläuterungstexte umbrechen — in ihrer eigenen Schrift gemessen.
  textFont(OV_TEXT_FONT);
  textSize(OV_TEXT_GROESSE);
  let textZeilen = VERGLEICHS_KNOTEN.map(k => ovTextUmbruch(k.text, OV_TEXT_BREITE));
  textFont("'Source Sans 3', sans-serif");
  textStyle(BOLD);
  textSize(OV_DATEN_GROESSE);
  // Zwei feste Zeilen statt freiem Umbruch: Kapitel und Annotationen oben,
  // die Valenz (neg/pos bzw. der Verlauf) und die F-Werte darunter. So steht
  // die Gefühlsangabe bei jedem Ort an derselben Stelle.
  let datenZeilen = VERGLEICHS_KNOTEN.map(k => {
    if (!k.daten || !k.daten.length) return [];
    let oben = k.daten.slice(0, 2).join(OV_DATEN_TRENNER).toUpperCase();
    let unten = k.daten.slice(2).join(OV_DATEN_TRENNER).toUpperCase();
    return ovTextUmbruch(oben, OV_TEXT_BREITE).concat(unten ? ovTextUmbruch(unten, OV_TEXT_BREITE) : []);
  });
  textStyle(NORMAL);
  textFont(OV_TEXT_FONT);
  textSize(OV_TEXT_GROESSE);

  // Höhe unterhalb des Kreises: nur noch Ortsbeschriftung und Kapitelzeile.
  // Der Erläuterungstext steht seitlich (siehe unten) und braucht hier keinen
  // Platz mehr.
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
  // Das Verhältnis wird in MERCATOR-Einheiten gebildet, nicht in Grad: die
  // Karten sind EPSG:3857, dort entspricht ein Breitengrad auf Pariser Höhe
  // dem 1/cos(48.87°) = 1.52-fachen eines Längengrads. Mit demselben
  // Meterfaktor für beide Achsen kam ein um genau diesen Faktor horizontal
  // gestreckter Ausschnitt heraus.
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

  // Kreis-Skala: grösster Faktor, bei dem sich weder zwei Kreise berühren NOCH
  // die Beschriftung eines Kreises in den darunterliegenden läuft.
  //
  // Die zweite Bedingung ist nötig, weil Ortsname und Kapitelzeile unter dem
  // Kreis hängen und NICHT mitskalieren: je grösser die Kreise, desto eher
  // stösst der Text des oberen an den unteren. Für ein senkrecht gestapeltes
  // Paar (waagrecht so nah, dass der Text den unteren Kreis trifft) gilt
  //   dy >= r_oben * s + untenHoehe_oben + r_unten * s
  // und damit s <= (dy - untenHoehe_oben) / (r_oben + r_unten).
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

  // Überstand über den Fensterrand, in px. Berücksichtigt, was um den
  // Ankerpunkt herum tatsächlich Platz braucht: der Kreis nach allen Seiten,
  // unten zusätzlich Ortsbeschriftung und Kapitelzeile, seitlich die halbe
  // Beschriftungsbreite. Ein Rand, der nur die Anker umschliesst, reicht
  // nicht — die Kreise ragen um ihren Radius darüber hinaus.
  // Der Erläuterungstext steht seitlich, und zwar nach AUSSEN: Kreise in der
  // linken Bildhälfte bekommen ihn rechts, Kreise rechts bekommen ihn links.
  // So wandert er nie über die Bildmitte, wo die meisten Nachbarkreise liegen.
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

  // Rand so weit aufziehen, bis alles hineinpasst. Grösserer Rand heisst
  // kleinere Kreise (die Skala hängt an den Pixelabständen), das Verfahren
  // konvergiert deshalb.
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

// Zeichnet den Schlussakt. p = Fortschritt im Akt (0..1), bbox = die gerade
// gültige (bereits Richtung ovZoomBbox geblendete) Kartenbbox.
// textFaktor blendet NUR die Schrift aus, nicht die Kreise: sobald die
// Schlusskarte einblendet, verschwinden Erläuterung, Ortsbeschriftung und
// Kapitelzähler, während die Kreisgrafiken noch stehen und erst mit dem
// Rauszoomen verblassen.
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

  textFont("'Source Sans 3', sans-serif");
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
      radius = zeichneKreiseFuerRun(anker.x, cy, stand.bandCounts, (alpha / 255) * kreisAlpha,
        PI, layout.kreisSkala, Infinity);
      zeichneFwertPunkte(anker.x, cy, radius, stand.fwerte, (alpha / 255) * kreisAlpha);
    }

    // Reihenfolge von oben nach unten: Kreis, Ortsbeschriftung, Kapitelzähler.
    let rand = radius > 0 ? radius : 6;

    let zeilen = layout.labelZeilen[i];
    if (pLabel > 0) {
      textStyle(BOLD);
      textSize(13);
      // fillStyle DIREKT setzen, nicht über p5s fill(): p5 merkt sich die
      // zuletzt gesetzte Füllfarbe und überspringt die Zuweisung, wenn der
      // Wert gleich bleibt. zeichneFwertPunkte oben schreibt fillStyle aber
      // direkt (F-Wert-Rot) und umgeht diesen Zwischenspeicher — der
      // Ortsname wurde dadurch rot gezeichnet, sobald sich seine Deckkraft
      // von Frame zu Frame nicht änderte.
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

    // Erläuterung SEITLICH neben dem Kreis, immer linksbündig gesetzt und
    // mittig auf seiner Höhe. Sie steht nach aussen: Kreise links der
    // Bildmitte bekommen sie rechts und umgekehrt. Dieselbe Serifenschrift
    // wie die Einstiegstexte, nur viel kleiner; sie blendet mit der
    // Ortsbeschriftung ein.
    // Die Textbox erscheint dann, wenn dieser Ort seine ERSTE Annotation
    // bekommt — also genau in dem Kapitelschritt, in dem seine Kreisgrafik
    // zum ersten Mal etwas zeigt. Die Redaktion, die Madeleine und die
    // Boulevards starten in Kapitel 1, die Rue Boursault in 3, die Rue
    // Constantinople in 5, Rue Fontaine und Palais Walter in 6 — die Texte
    // erscheinen dadurch nacheinander statt alle auf einmal.
    // pKapitel * 18 ist die laufende, ungerundete Position des Kapitelzählers.
    let erstes = ovErstesKapitel[i];
    let pTextbox = constrain(map(pKapitel * 18, erstes - 1, erstes, 0, 1), 0, 1);
    let erlaeuterung = layout.textZeilen[i];
    if (pTextbox > 0 && erlaeuterung && erlaeuterung.length) {
      textFont(OV_TEXT_FONT);
      textStyle(NORMAL);
      textSize(OV_TEXT_GROESSE);
      textAlign(LEFT, CENTER);
      drawingContext.textAlign = 'left';
      drawingContext.fillStyle = `rgba(33, 43, 46, ${alpha * pTextbox * textFaktor * 0.85 / 255})`;
      let breite = Math.max(...erlaeuterung.map(t => textWidth(t)));
      // Der Textblock hängt am ENDRADIUS, nicht am laufenden: sonst schöbe
      // ihn der wachsende Kreis Kapitel für Kapitel vor sich her. So steht er
      // von Anfang an fest, und der Kreis wächst in seine endgültige Grösse
      // hinein, ohne den Text zu bewegen.
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
        // Waagrechte Linie auf Höhe des Ortspunkts; die Box hängt darunter.
        // Links endet die Linie am linken Boxrand, rechts am rechten — so
        // spannt sie einmal über die Boxbreite und der Text bleibt frei.
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

      // Datenzeile darunter — Zahlen und F-Werte im Stil der Kategorien in
      // der Annotationsbox. letterSpacing kennt nicht jeder Browser; wo es
      // fehlt, wird es schlicht ignoriert.
      let daten = layout.datenZeilen[i];
      if (daten && daten.length) {
        textFont("'Source Sans 3', sans-serif");
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

      textFont("'Source Sans 3', sans-serif");
      textSize(11);
      textAlign(CENTER, CENTER);
      drawingContext.textAlign = 'center';
    }
  });

  textAlign(LEFT, CENTER); // zurücksetzen — andere Zeichenfunktionen erwarten das
  textStyle(NORMAL);
}
