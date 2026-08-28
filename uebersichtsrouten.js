/* =============================================================================
   uebersichtsrouten.js — Übersichtsakt und Kapitel-Navigation

   Zeichnet im Übersichtsakt die Routen 02–18 nacheinander auf die rausgezoomte
   Karte, bei geöffnetem Kapitel stattdessen dessen genaue Route, Kreise und
   Annotation. Hält zoomedKapitel / kapitelZoomAmount / kapitelHover — nur hier
   geschrieben, nach aussen Lesebindung. Rest: docs/architektur.md.
============================================================================= */

// --- Modulkapselung ---------------------------------------------------
// 6 von 16 Namen intern, 10 exportiert. Konvention: docs/architektur.md.
(function () {

let zoomedKapitel = null;      // z.B. '03', oder null (Übersicht)
let kapitelZoomAmount = 0;     // 0 = Übersicht, 1 = voll in Kapitelausschnitt gezoomt
let kapitelHover = null;       // Kapitelnummer unter der Maus (fürs Cursor/Highlight)

// Teilt den Übersichtsakt in eine Scheibe je Kapitel, nach Routenlänge
// gewichtet (sonst 27-fache Tempo-Schwankung) plus festem Grundanteil.
const KAPITEL_SCHEIBE_GRUNDANTEIL = 0.45; // Anteil des Akts, der gleichmässig verteilt wird
let scheibenCache = null;

function kapitelScheiben() {
  if (scheibenCache) return scheibenCache;
  let liste = Object.keys(uebersichtsRouten || {}).sort();
  if (!liste.length) return [];
  let laengen = liste.map(nr => uebersichtsRouten[nr].length);
  let summe = laengen.reduce((a, b) => a + b, 0) || 1;
  let grund = KAPITEL_SCHEIBE_GRUNDANTEIL / liste.length;
  let rest = 1 - KAPITEL_SCHEIBE_GRUNDANTEIL;
  let anteile = liste.map((nr, i) => grund + rest * laengen[i] / summe);
  // Alle Scheiben leicht stauchen, damit das Abkühlfenster des letzten
  // Kapitels nicht hinter dem geklemmten Aktende liegt.
  let stauchung = 1 / (1 + anteile[anteile.length - 1] * KAPITEL_NACHGLUEHEN);
  let scheiben = [];
  let kum = 0;
  liste.forEach((nr, i) => {
    let anteil = anteile[i] * stauchung;
    scheiben.push({ nr, von: kum, bis: kum + anteil });
    kum += anteil;
  });
  scheibenCache = scheiben;
  return scheibenCache;
}

// 1 während der eigenen Scheibe, danach über KAPITEL_NACHGLUEHEN auf 0.
// Route und Badge wechseln gemeinsam von Hoverfarbe auf Routengold.
const KAPITEL_NACHGLUEHEN = 0.05; // Anteil einer Scheibe für den Übergang

function kapitelHitze(fortschritt, scheibe) {
  if (!scheibe) return 0;
  let breite = scheibe.bis - scheibe.von;
  return 1 - constrain(map(fortschritt, scheibe.bis, scheibe.bis + breite * KAPITEL_NACHGLUEHEN, 0, 1), 0, 1);
}

function zeichneUebersichtsrouten(bbox, alpha, fortschritt) {
  // Ausserhalb des Akts gibt es keine Hover-Ziele. Rücksetzer steht hier,
  // weil nur hier die Geometrie der Startpunkte bekannt ist.
  if (fortschritt <= 0) {
    kapitelHover = null;
    cursor(ARROW);
    return { aktuelleAnnotationZoom: null };
  }

  noFill();
  strokeWeight(2);

  let kapitelListe = Object.entries(uebersichtsRouten).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  let n = kapitelListe.length;

  // Geöffnetes Kapitel bekommt den vollen Akt als Reveal-Skala, nicht nur
  // seine Scheibe. Anfang gehört dem Einstiegstext.
  let zoomedLokalerFortschritt = constrain(
    map(fortschritt, KAPITEL_EINSTIEG_SCROLL_ENDE, 1, 0, 1), 0, 1);
  let aktuelleAnnotationZoom = null; // Rückgabewert für die Annotationsbox in draw()

  // Im Kapitel-Zoom blenden alle anderen Übersichtsrouten mit
  // kapitelZoomAmount aus.
  kapitelListe.forEach(([kapitelNr, punkte], i) => {
    let scheibe = kapitelScheiben()[i];
    let lokalerFortschritt = scheibe
      ? constrain(map(fortschritt, scheibe.von, scheibe.bis, 0, 1), 0, 1) : 0;
    if (lokalerFortschritt <= 0) return;

    // Übersichtslinie und Kapitelroute sind dieselben Punkte. Beim eigenen
    // Zoom hier überspringen, unten mit mapOffsetX gezeichnet — sonst doppelt.
    if (kapitelNr === zoomedKapitel && kapitelZoomAmount > 0.001) return;

    let routenAlpha = (zoomedKapitel && kapitelNr !== zoomedKapitel)
      ? alpha * (1 - kapitelZoomAmount)
      : alpha;
    if (routenAlpha <= 0) return;
    // Wachsende Route in Hoverfarbe, danach auf Gold abkühlend.
    let hitze = zoomedKapitel ? 0 : kapitelHitze(fortschritt, scheibe);
    stroke(lerp(ROUTE_COLOR_RGB.r, FWERT_COLOR_RGB.r, hitze),
      lerp(ROUTE_COLOR_RGB.g, FWERT_COLOR_RGB.g, hitze),
      lerp(ROUTE_COLOR_RGB.b, FWERT_COLOR_RGB.b, hitze), routenAlpha);
    let anzahl = Math.max(1, Math.round(lokalerFortschritt * punkte.length));
    beginShape();
    for (let j = 0; j < anzahl; j++) {
      let p = lonLatToScreen(punkte[j][0], punkte[j][1], bbox, 0, 0); // zentrierte Übersichtskarte, kein mapOffsetX
      vertex(p.x, p.y);
    }
    endShape();
  });

  // Genaue Route des gezoomten Kapitels, mit fixem mapOffsetX/Y statt dem
  // ch1-Blend. Erst nach dem Einstiegstext (KAPITEL_EINSTIEG_SCROLL_ENDE).
  let kapitelEinstiegAbgeschlossen = fortschritt >= KAPITEL_EINSTIEG_SCROLL_ENDE;
  if (zoomedKapitel && kapitelZoomAmount > 0.001 && kapitelEinstiegAbgeschlossen) {
    let daten = datenFuerKapitel(zoomedKapitel);
    // routenPfadDetail statt routenPunkte: Letzteres ist auf 1 Punkt je
    // Annotation komprimiert, die Linie sähe wie eine Luftlinie aus.
    let routenLinie = (daten && daten.routenPfadDetail && daten.routenPfadDetail.length > 1)
      ? daten.routenPfadDetail
      : (daten && daten.routenPunkte);
    if (routenLinie && routenLinie.length > 1) {
      // routenPfadKumulativ bindet das Wachstum an die Annotationsfolge
      // (Stop-and-go statt proportional zum Scrollfortschritt).
      let kumulativ = daten && daten.routenPfadKumulativ;
      let upToIndex;
      if (kumulativ && kumulativ.length === (daten.annotationen || []).length) {
        // Zwischen den kumulativen Pfad-Indizes interpolieren, damit der
        // Ortswechsel-Sprung weich wächst statt aufzupoppen.
        let stelle = constrain(zoomedLokalerFortschritt * (kumulativ.length - 1), 0, kumulativ.length - 1);
        let i0 = Math.floor(stelle), i1 = Math.min(kumulativ.length - 1, i0 + 1);
        let frac = stelle - i0;
        upToIndex = Math.round(lerp(kumulativ[i0], kumulativ[i1], frac));
      } else {
        upToIndex = Math.round(zoomedLokalerFortschritt * (routenLinie.length - 1));
      }
      if (upToIndex >= 1) {
        // Strichstärke 10 wie Kapitel 1s Route, hier ohne Rauszoom-Phase.
        zeichneRoute(routenLinie, upToIndex, bbox, 3, mapOffsetX, mapOffsetY, kapitelZoomAmount);
      }
    }

    // Wachsende Kreise und aktuelle Annotation wie bei Kapitel 1, aber aus
    // zoomedLokalerFortschritt statt aus eigenen Scroll-Meilensteinen.
    if (daten && daten.annotationen && daten.annotationen.length) {
      let annIndexZoom = Math.min(daten.annotationen.length - 1, Math.floor(zoomedLokalerFortschritt * daten.annotationen.length));
      let aktuelleAnnZoom = daten.annotationen[annIndexZoom];
      // ACHTUNG annIndexZoom, nicht revealIndex: bei Kapitel 3 ist
      // revealIndex nicht die Array-Position, ortRuns[].revealIndex aber
      // schon — die Kreise erscheinen sonst zu spät oder nie.
      let punktIndexZoom = aktuelleAnnZoom.vorRoutenstart ? 0 : annIndexZoom;
      zeichneKreiseOrtRuns(punktIndexZoom, annIndexZoom, bbox, mapOffsetX, mapOffsetY, daten);
      aktuelleAnnotationZoom = aktuelleAnnZoom;
    }
  }

  // Startpunkt und Kapitelnummer je Route. Kapitel mit eigener Ansicht sind
  // klickbar (kapitelHatEigeneAnsicht).
  noStroke();
  textFont(SCHRIFT_SANS); // wie .annotation-tag (var(--sans)) und die Kreis-Labels
  textStyle(BOLD); // .annotation-tag ist font-weight: 700
  textAlign(LEFT, CENTER);
  textSize(11);
  kapitelHover = null;

  // Mehrere Kapitel teilen sich Startpunkte (02/10, 07/11 — echte Orte,
  // keine Datenfehler); ohne Versatz überdeckt das höhere Badge das tiefere.
  // ACHTUNG nach ABSTAND gruppieren, nicht nach gleicher Koordinate: Kapitel
  // 18 liegt 0.24 m neben 08/09, auf dem Bildschirm derselbe Pixel.
  const DUP_TOLERANZ = 0.0003; // Grad, rund 25 m — kleinster echter Abstand ist 223 m
  let startDupGruppen = {};
  let dupSchluessel = {};
  kapitelListe.forEach(([kapitelNr, punkte]) => {
    let [lon, lat] = punkte[0];
    let key = Object.keys(startDupGruppen).find(k => {
      let [kl, kb] = k.split(',').map(Number);
      return Math.abs(kl - lon) < DUP_TOLERANZ && Math.abs(kb - lat) < DUP_TOLERANZ;
    });
    if (!key) key = lon + ',' + lat;
    (startDupGruppen[key] = startDupGruppen[key] || []).push(kapitelNr);
    dupSchluessel[kapitelNr] = key;
  });

  kapitelListe.forEach(([kapitelNr, punkte], i) => {
    // NICHT an lokalerFortschritt gekoppelt wie die Routenlinien: Badges
    // sind Klickziele und müssen von Anfang an alle da sein.
    let labelAlpha = (zoomedKapitel && kapitelNr !== zoomedKapitel)
      ? alpha * (1 - kapitelZoomAmount)
      : alpha;
    // ACHTUNG Schwelle 1, nicht 0: kapitelZoomAmount läuft per lerp() nur
    // asymptotisch, labelAlpha wird nie 0. Bei konstantem Alpha überspringt
    // p5 das fill(), und fillText() erbt die Deckkraft, die kreisgrafik.js
    // direkt in fillStyle geschrieben hat — Badges bleiben sichtbar.
    if (labelAlpha < 1) return;

    let start = lonLatToScreen(punkte[0][0], punkte[0][1], bbox, 0, 0); // zentrierte Übersichtskarte, kein mapOffsetX
    // Beim gezoomten Kapitel auf den echten Routenanfang überblenden — der
    // Startpunkt der Übersichtslinie trifft ihn im Zoom nicht.
    if (kapitelNr === zoomedKapitel && kapitelZoomAmount > 0.001) {
      let daten = datenFuerKapitel(kapitelNr);
      let routenLinie = (daten && daten.routenPfadDetail && daten.routenPfadDetail.length > 1)
        ? daten.routenPfadDetail
        : (daten && daten.routenPunkte);
      if (routenLinie && routenLinie.length > 0) {
        let praezise = lonLatToScreen(routenLinie[0][0], routenLinie[0][1], bbox, mapOffsetX, mapOffsetY);
        start = {
          x: lerp(start.x, praezise.x, kapitelZoomAmount),
          y: lerp(start.y, praezise.y, kapitelZoomAmount),
        };
      }
    }

    // Fester Platz auf einem kleinen Kreis um den echten Punkt, je Gruppe.
    let dupGruppe = startDupGruppen[dupSchluessel[kapitelNr]];
    let dupAnker = null;
    let labelLinks = false; // Nummer nach links statt rechts setzen
    if (dupGruppe.length > 1) {
      let dupWinkel = (dupGruppe.indexOf(kapitelNr) / dupGruppe.length) * TWO_PI;
      const dupVersatz = 13; // px
      dupAnker = start; // echter Routenanfang, für die Verbindungslinie unten
      start = {
        x: start.x + cos(dupWinkel) * dupVersatz,
        y: start.y + sin(dupWinkel) * dupVersatz,
      };
      // Nummer auf die Aussenseite, sonst steht sie bei den linken Badges
      // quer über der Gruppenmitte.
      labelLinks = cos(dupWinkel) < -0.01;
    }

    // Nur klickbar, solange kein anderes Kapitel offen ist.
    let klickbar = kapitelHatEigeneAnsicht(kapitelNr) && !zoomedKapitel;
    let hover = klickbar && dist(mouseX, mouseY, start.x, start.y) < FOTO_MARKER_TREFFER_RADIUS;
    if (hover) kapitelHover = kapitelNr;

    // Punkt und Nummer nehmen dieselbe Hitze wie die Linie.
    let scheibe = kapitelScheiben()[i];
    let lokalerFortschritt = scheibe
      ? constrain(map(fortschritt, scheibe.von, scheibe.bis, 0, 1), 0, 1) : 0;
    let hitze = (!zoomedKapitel && lokalerFortschritt > 0) ? kapitelHitze(fortschritt, scheibe) : 0;

    // Verbindungsstrich vom versetzten Badge zum echten Routenanfang, sonst
    // wirkt es wie ein Punkt ohne Route.
    if (dupAnker) {
      stroke(33, 43, 46, labelAlpha * 0.55);
      strokeWeight(1);
      line(dupAnker.x, dupAnker.y, start.x, start.y);
      noStroke();
    }

    // ACHTUNG fill(hexString, alpha) ist keine verlässliche p5-Signatur —
    // deshalb hier wie überall RGB statt Hex+Alpha.
    if (hover) fill(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b, labelAlpha); // #C2511C
    else fill(lerp(33, FWERT_COLOR_RGB.r, hitze), lerp(43, FWERT_COLOR_RGB.g, hitze),
      lerp(46, FWERT_COLOR_RGB.b, hitze), labelAlpha); // #212B2E .. #C2511C
    ellipse(start.x, start.y, hover ? 11 : 8, hover ? 11 : 8);
    // p5s text() bleibt beim Scrollen manchmal unsichtbar — direkt über den
    // Canvas-Context, fillStyle kommt vom fill() oben.
    if (labelLinks) {
      textAlign(RIGHT, CENTER);
      drawingContext.textAlign = 'right';
      drawingContext.fillText(kapitelNr, start.x - 8, start.y);
      textAlign(LEFT, CENTER);
      drawingContext.textAlign = 'left';
    } else {
      drawingContext.fillText(kapitelNr, start.x + 8, start.y);
    }
  });

  // Kapitel 1 hat keine Übersichtsroute — Nummer hier ergänzt, Klick scrollt
  // zurück statt zu zoomen. Blendet im Kapitel-Zoom mit aus wie 02–18.
  let ch1Alpha = zoomedKapitel ? alpha * (1 - kapitelZoomAmount) : alpha;
  if (ch1Alpha >= 1) {
    let ch1Start = lonLatToScreen(stationenData.routenPunkte[0][0], stationenData.routenPunkte[0][1], bbox, 0, 0); // zentrierte Übersichtskarte, kein mapOffsetX
    let ch1Hover = dist(mouseX, mouseY, ch1Start.x, ch1Start.y) < FOTO_MARKER_TREFFER_RADIUS;
    if (ch1Hover) kapitelHover = '01';
    if (ch1Hover) fill(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b, ch1Alpha); // #C2511C
    else fill(33, 43, 46, ch1Alpha); // #212B2E
    ellipse(ch1Start.x, ch1Start.y, ch1Hover ? 11 : 8, ch1Hover ? 11 : 8);
    drawingContext.fillText('01', ch1Start.x + 8, ch1Start.y); // siehe Kommentar oben (p5s text()-Bug)
  }

  textStyle(NORMAL);
  cursor(kapitelHover ? HAND : ARROW);


  // Für die Annotationsbox in draw(); Kapitel 1 läuft dort über annIndex.
  return { aktuelleAnnotationZoom };
}

// Zurück in die Kapitel-1-Ansicht; schliesst einen offenen Kapitel-Zoom mit.
function scrolleZuKapitel1() {
  schliesseKapitelZoom();
  let trackEl = document.querySelector('.scroll-track');
  let ziel = trackEl.offsetHeight * SCROLL_MEILENSTEINE.zoomEnd;
  window.scrollTo({ top: ziel, behavior: 'smooth' });
}

// Setzt Ansichtsmodus und Play-Animation zurück, damit jede Kapitel-Ansicht
// in der Kartenansicht startet. Kein Guard, anders als setzeKapitelAnsichtModus.
function setzeKapitelAnsichtZurueck() {
  // Jedes Modul setzt seinen eigenen Zustand zurück. Ton stoppt in
  // setzeGrafikZurueck() mit.
  setzeAnsichtsModus('karte');   // sketch.js
  setzeGrafikZurueck();          // spine-horizontal.js
  // Startzeit für den Einstiegstext-Fade, bei jedem Kapitelwechsel neu.
  starteKapitelEinstieg();       // sketch.js
}

// ACHTUNG genau einmal pro Frame ticken — deshalb ruft draw() direkt und
// nicht zeichneUebersichtsrouten(), die beim Ausblenden nicht mehr läuft.
function aktualisiereKapitelZoom() {
  kapitelZoomAmount = lerp(kapitelZoomAmount, zoomedKapitel ? 1 : 0, 0.08);
}

// ACHTUNG setzt voraus, dass die Scrollposition schon im uebersichtRouten-Akt liegt — 
// sonst schliesst der <=0-Check in draw() den Zoom im nächsten Frame
// wieder. Von aussen immer über springeZuKapitelZoom().
function oeffneKapitelZoom(nr) {
  if (!kapitelHatEigeneAnsicht(nr)) return;
  zoomedKapitel = nr; 
  setzeKapitelAnsichtZurueck();
}

function schliesseKapitelZoom() {
  zoomedKapitel = null;
  setzeKapitelAnsichtZurueck();
}

// Springt kurz hinter den Akt-Anfang und öffnet dort den Zoom, damit es von
// jeder Scrollposition aus geht. ACHTUNG ohne "smooth": sonst laufen Frames
// mit alter Position, und der <=0-Check setzt zoomedKapitel wieder auf null.
function springeZuKapitelZoom(nr) {
  if (!kapitelHatEigeneAnsicht(nr)) return;
  let trackEl = document.querySelector('.scroll-track');
  let start = SCROLL_MEILENSTEINE.uebersichtRoutenStart
    + 0.01 * (SCROLL_MEILENSTEINE.uebersichtRoutenEnd - SCROLL_MEILENSTEINE.uebersichtRoutenStart);
  loeseKapitel1Klemme(); // sonst zöge draw() sofort ans Kapitel-1-Ende zurück
  window.scrollTo(0, trackEl.offsetHeight * start);
  oeffneKapitelZoom(nr);
}

// "Alle"-Button. Zielt auf die MITTE des Akts (Routen gewachsen), nicht wie
// springeZuKapitelZoom auf den Anfang.
function springeZurUebersicht() {
  let trackEl = document.querySelector('.scroll-track');
  let mitte = (SCROLL_MEILENSTEINE.uebersichtRoutenStart + SCROLL_MEILENSTEINE.uebersichtRoutenEnd) / 2;
  loeseKapitel1Klemme(); // sonst zöge draw() sofort ans Kapitel-1-Ende zurück
  window.scrollTo(0, trackEl.offsetHeight * mitte);
  schliesseKapitelZoom();
}


// --- Export ------------------------------------------------------------
// Sieben Funktionen als Wert.
window.kapitelScheiben = kapitelScheiben;
window.zeichneUebersichtsrouten = zeichneUebersichtsrouten;
window.aktualisiereKapitelZoom = aktualisiereKapitelZoom;
window.scrolleZuKapitel1 = scrolleZuKapitel1;
window.schliesseKapitelZoom = schliesseKapitelZoom;
window.springeZuKapitelZoom = springeZuKapitelZoom;
window.springeZurUebersicht = springeZurUebersicht;

// Lesebindung statt Wertkopie: alle drei werden laufend umgeschaltet, eine
// Kopie nagelte die Leser auf null bzw. 0 fest. Schreiben von aussen wirkt nicht.
['zoomedKapitel', 'kapitelZoomAmount', 'kapitelHover'].forEach(function (name) {
  Object.defineProperty(window, name, {
    get: function () {
      return name === 'zoomedKapitel' ? zoomedKapitel
           : name === 'kapitelZoomAmount' ? kapitelZoomAmount
           : kapitelHover;
    },
    configurable: true,
  });
});

})(); // Ende der Modulkapselung, siehe Kommentar oben
