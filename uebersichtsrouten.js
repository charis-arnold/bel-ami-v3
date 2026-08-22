/* =============================================================================
   uebersichtsrouten.js — Alle 18 Routen auf der Übersichtskarte, und der Weg
   in ein einzelnes Kapitel hinein

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Zwei
   zusammengehörende Aufgaben:

   1. ZEICHNEN — zeichneUebersichtsrouten() malt im Übersichtsakt die Routen
      der Kapitel 02–18 nacheinander auf die rausgezoomte Karte. Jedes Kapitel
      bekommt eine eigene Scheibe der Scrollstrecke (kapitelScheiben, nach
      Routenlänge gewichtet) und glüht während seiner Scheibe in der
      Hoverfarbe nach (kapitelHitze). Ist ein Kapitel geöffnet, zeichnet
      dieselbe Funktion stattdessen dessen genaue Route, Kreise und aktuelle
      Annotation — und gibt Letztere an draw() zurück.

   2. NAVIGIEREN — der Zustand (zoomedKapitel, kapitelZoomAmount,
      kapitelHover) und die Wege hinein und heraus: Klick auf ein Badge oder
      einen Registereintrag (springeZuKapitelZoom), zurück zur Übersicht
      (springeZurUebersicht), zurück in Kapitel 1 (scrolleZuKapitel1),
      Escape/Hochscrollen (schliesseKapitelZoom).

   --- Geteilter Zustand: WICHTIG ------------------------------------------
   kapitelZoomAmount wird hier deklariert, aber AUSSCHLIESSLICH in draw()
   geschrieben (eine lerp()-Zeile je Frame). kapitelHover wird hier und in
   draw() gesetzt und in mousePressed() gelesen. zoomedKapitel wird nur hier
   geschrieben, aber im ganzen Projekt gelesen — auch in
   spine-horizontal.js. Die Variablen liegen im globalen Scope; bei einer
   Umstellung auf ES-Module bräuchte es dafür Setter oder eine gemeinsame
   Zustandsdatei.

   --- Abhängigkeiten NACH AUSSEN (alle erst zur Laufzeit) -----------------
   aus sketch.js (8):       uebersichtsRouten, kapitelKarten, stationenData,
                            datenFuerKapitel, zeichneRoute, kapitelAnsichtsModus,
                            kapitelEinstiegsStartMillis, KAPITEL_EINSTIEG_SCROLL_ENDE
   aus datenbereinigung.js: SCROLL_MEILENSTEINE, KAPITEL_MIT_SPINE_PANEL,
                            ROUTE_COLOR_RGB, FWERT_COLOR_RGB
   aus geo-projektion.js:   lonLatToScreen, mapOffsetX, mapOffsetY
   aus kreisgrafik.js:      zeichneKreiseOrtRuns
   aus fotomarker.js:       FOTO_MARKER_TREFFER_RADIUS (Hover-Radius der Badges —
                            dieselbe Distanz wie bei den Foto-Markern, damit
                            sich alle Klickziele der Karte gleich anfühlen)
   aus spine-horizontal.js: grafikSpielt, grafikFortschritt, grafikPlayAusblendStart
                            (setzeKapitelAnsichtZurueck stellt sie zurück)
   aus sonifikation.js:     sonifikationSpieltGerade, beendeSonifikationAudio

   --- Wer von aussen hierher greift --------------------------------------
   draw()           ruft zeichneUebersichtsrouten(), kapitelScheiben() und
                    aktualisiereKapitelZoom(), liest zoomedKapitel an rund
                    vierzig Stellen. Schreibt selbst nichts mehr hierher:
                    kapitelZoomAmount und kapitelHover werden ausschliesslich
                    in diesem Modul gesetzt.
   mousePressed()   liest kapitelHover, ruft springeZuKapitelZoom() und
                    scrolleZuKapitel1()
   setup()          hängt schliesseKapitelZoom an die Escape-Taste
   dom-aufbau.js    Kapitelregister: springeZurUebersicht, springeZuKapitelZoom,
                    scrolleZuKapitel1
   spine-horizontal.js liest zoomedKapitel (Animationsdauer, Tonauswahl)

   NICHT hier: letzterZoomKapitel. Der Name gehört sichtbar dazu, die Variable
   dient aber allein dem Spine-Panel-Cache in draw() — sie bleibt gesetzt,
   während ein Kapitel ausblendet, damit das Panel weiter die richtigen Daten
   zeigt. Sie steht deshalb weiter in sketch.js.

   Wird in index.html VOR sketch.js geladen. Kein Top-Level-Initialisierer
   wertet etwas aus.
============================================================================= */

let zoomedKapitel = null;      // z.B. '03', oder null (Übersicht)
let kapitelZoomAmount = 0;     // 0 = Übersicht, 1 = voll in Kapitelausschnitt gezoomt
let kapitelHover = null;       // Kapitelnummer unter der Maus (fürs Cursor/Highlight)

// Übersichtsrouten (Kapitel 02–18) auf der grossen, rausgezoomten Karte —
// echte Strassenrouten aus data-prep/05 bereinigen/baue-uebersichtsrouten.py,
// gedämpft in Goldton (Kategorie-Farbe gold_dunkel). Laufen in Kapitel-
// reihenfolge ab statt gemeinsam zu wachsen: der gesamte fortschritt (0..1)
// wird in gleich grosse Abschnitte pro Kapitel aufgeteilt — Kapitel 02
// zeichnet sich zuerst komplett, dann 03, usw. Ein Kapitel, dessen Abschnitt
// noch nicht erreicht ist, bleibt (Route + Startpunkt/Nummer) unsichtbar.
// Aufteilung des Übersichtsakts auf die Kapitel. Früher bekam jedes Kapitel
// gleich viel Scrollstrecke — dabei schwankte die Zeichengeschwindigkeit um
// das 27-fache: Kapitel 5 zog 1625 Routenpunkte durch dieselben 173vh wie
// Kapitel 18 seine 60, und Kapitel 2 stand mit seinem einzigen Punkt zwei
// Bildschirmhöhen lang still.
//
// Jetzt richtet sich die Scheibenbreite nach der Routenlänge. Ein fester
// Grundanteil wird trotzdem gleichmässig verteilt, damit auch ein kurzes
// Kapitel genug Strecke für Badge und Einstiegstext behält — ohne ihn bekäme
// Kapitel 2 mit einem von 10974 Punkten praktisch keine.
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
  // Am Ende Platz für das Nachglühen des LETZTEN Kapitels reservieren: seine
  // Scheibe endete sonst exakt bei 1.0, und weil der Aktfortschritt dort
  // geklemmt wird, läge sein Abkühlfenster jenseits des Erreichbaren — Punkt,
  // Nummer und Route von Kapitel 18 blieben dauerhaft in der Hoverfarbe.
  // Alle Scheiben werden dafür um denselben Faktor gestaucht (rund 0.2 %).
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

// Wie "heiss" ein Kapitel gerade ist: 1 während seiner eigenen Scheibe des
// Akts, danach auf 0. Route und Badge nehmen denselben Wert und wechseln
// dadurch gemeinsam von der Hoverfarbe (#C2511C) auf das Routengold.
//
// Der Wechsel fällt mit der Übergabe zusammen: sobald das nächste Kapitel
// aktiv wird, ist das vorherige gold. Das Nachglühen dauert nur so lange,
// dass kein harter Farbsprung entsteht. Auf 0 gesetzt springt die Farbe hart um.
const KAPITEL_NACHGLUEHEN = 0.05; // Anteil einer Scheibe für den Übergang

function kapitelHitze(fortschritt, scheibe) {
  if (!scheibe) return 0;
  let breite = scheibe.bis - scheibe.von;
  return 1 - constrain(map(fortschritt, scheibe.bis, scheibe.bis + breite * KAPITEL_NACHGLUEHEN, 0, 1), 0, 1);
}

function zeichneUebersichtsrouten(bbox, alpha, fortschritt) {
  noFill();
  strokeWeight(2);

  let kapitelListe = Object.entries(uebersichtsRouten).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  let n = kapitelListe.length;

  // Für die genaue Route des gezoomten Kapitels (weiter unten) gebraucht:
  // anders als die grobe Übersichtslinie (die pro Kapitel nur einen i/n-Slice
  // des Akts bekommt) nutzt das gezoomte Kapitel den vollen, unaufgeteilten
  // fortschritt — sonst hätte jedes Kapitel nur ~1/n des Akts zum Durchscrollen
  // seiner Annotationen (deutlich schneller/unruhiger als bei Kapitel 1, das
  // seinen eigenen vollen Scrollbereich hat). So bekommt jedes geöffnete
  // Kapitel den vollen Akt als eigene Reveal-Skala, unabhängig von seiner
  // Position in der Kapitelliste, und bleibt trotzdem exakt scrubbar.
  // Der Anfang des Akts gehört dem Einstiegstext (siehe
  // KAPITEL_EINSTIEG_SCROLL_ENDE) — die Annotationen des Kapitels verteilen
  // sich auf den Rest, damit die erste gleich beim Erscheinen der Route zu
  // sehen ist und nicht schon während des Textes weggescrollt wurde.
  let zoomedLokalerFortschritt = constrain(
    map(fortschritt, KAPITEL_EINSTIEG_SCROLL_ENDE, 1, 0, 1), 0, 1);
  let aktuelleAnnotationZoom = null; // für die Annotationsbox in draw() (siehe Rückgabewert unten)

  // Im Kapitel-Zoom (Klick auf «03» etc.) bleibt nur die Route des gezoomten
  // Kapitels (+ Kapitel 1, die separat über zeichneRoute läuft) eingeblendet
  // — alle anderen Übersichtsrouten blenden mit kapitelZoomAmount aus.
  kapitelListe.forEach(([kapitelNr, punkte], i) => {
    let scheibe = kapitelScheiben()[i];
    let lokalerFortschritt = scheibe
      ? constrain(map(fortschritt, scheibe.von, scheibe.bis, 0, 1), 0, 1) : 0;
    if (lokalerFortschritt <= 0) return;

    // kapitel-routen-uebersicht.json enthält seit
    // baue-uebersichtsrouten-aus-kapiteln.py exakt dieselben Punkte wie
    // routenPfadDetail des jeweiligen Kapitels — die Übersichtslinie IST also
    // die Kapitelroute. Sobald genau dieses Kapitel gezoomt ist, wird sie
    // trotzdem übersprungen und stattdessen unten aus den Kapiteldaten
    // gezeichnet: dieselbe Geometrie, aber mit mapOffsetX/mapOffsetY des
    // Kartenausschnitts statt zentriert — beide gleichzeitig ergäben zwei
    // gegeneinander versetzte Linien.
    if (kapitelNr === zoomedKapitel && kapitelZoomAmount > 0.001) return;

    let routenAlpha = (zoomedKapitel && kapitelNr !== zoomedKapitel)
      ? alpha * (1 - kapitelZoomAmount)
      : alpha;
    if (routenAlpha <= 0) return;
    // Während sie wächst, wird die Route in der Hoverfarbe gezeichnet und
    // kühlt danach auf Gold ab — so ist im Scrollen zu sehen, welche Linie
    // gerade entsteht und welche schon liegt.
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

  // Route des gezoomten Kapitels (aus datenFuerKapitel(), siehe
  // baue-kapitel-stationen.py/baue_kapitel03.py) — ersetzt die Übersichts-
  // linie für genau dieses Kapitel, sobald es gezoomt ist (gleiche Punkte,
  // anderer Offset, siehe oben). Nutzt
  // denselben fixen mapOffsetX/mapOffsetY wie der Kartenausschnitt (k.bild)
  // selbst, nicht den ch1-spezifischen kartenOffsetX-Blend.
  // Erscheint bewusst erst, NACHDEM der Kapitel-Einstiegstext (siehe
  // KAPITEL_EINSTIEG_SCROLL_ENDE weiter
  // unten in draw()) fertig ausgeblendet ist — exakt dasselbe Nacheinander
  // wie bei Kapitel 1 (dort per Scroll-Meilenstein: der Begleittext blendet
  // bis routeStart aus, erst ab dort wächst routeAmount los). Ohne dieses
  // Gate erschienen Route/Kreise/Annotationsbox gleichzeitig mit dem noch
  // sichtbaren Einstiegstext, statt sauber danach.
  let kapitelEinstiegAbgeschlossen = fortschritt >= KAPITEL_EINSTIEG_SCROLL_ENDE;
  if (zoomedKapitel && kapitelZoomAmount > 0.001 && kapitelEinstiegAbgeschlossen) {
    let daten = datenFuerKapitel(zoomedKapitel);
    // routenPfadDetail (falls vorhanden) statt routenPunkte: Letzteres ist
    // auf genau 1 Punkt pro Annotation/revealIndex komprimiert (siehe
    // baue-kapitel-stationen.py) — bei eng aufeinanderfolgenden Annotationen
    // (häufigster Fall) bleiben davon oft nur Start+Ziel übrig, der echte
    // OSM-Fussweg dazwischen (mit allen Abbiegungen) geht verloren und die
    // Linie sieht wie eine Luftlinie aus. routenPfadDetail behält die volle
    // Strassenform. routenPfadKumulativ (falls vorhanden, siehe
    // baue_stopandgo_pfade.py) bindet das Wachstum dieses dichten Pfads an
    // die Annotations-Reihenfolge zurück: pro Annotation ein Index in
    // routenPfadDetail, flach solange sich ortBasis nicht ändert (Stop),
    // springt beim Ortswechsel auf den vollen echten Fussweg zum nächsten
    // Ort (Go) — echtes Stop-and-go MIT Strassenform, nicht mehr nur
    // proportional zum Gesamt-Scrollfortschritt.
    let routenLinie = (daten && daten.routenPfadDetail && daten.routenPfadDetail.length > 1)
      ? daten.routenPfadDetail
      : (daten && daten.routenPunkte);
    if (routenLinie && routenLinie.length > 1) {
      // Exakt dieselbe Zeichenfunktion/Darstellung wie Kapitel 1s eigene
      // Route (zeichneRoute: Fade-Schweif, jüngere Segmente heller). Der
      // Fortschritt (zoomedLokalerFortschritt, oben im ersten forEach
      // mitgefasst) ist derselbe scroll-gebundene Wert wie für die grobe
      // Übersichtslinie dieses Kapitels — beim Hochscrollen sinkt er wieder,
      // die Route zieht sich also denselben Weg rückwärts zurück, statt nur
      // pauschal auszublenden. kapitelZoomAmount bleibt als zusätzlicher
      // Alpha-Multiplikator fürs Ein-/Ausblenden beim Öffnen/Schliessen.
      let kumulativ = daten && daten.routenPfadKumulativ;
      let upToIndex;
      if (kumulativ && kumulativ.length === (daten.annotationen || []).length) {
        // Kontinuierliche Annotations-Position (nicht gerundet) innerhalb
        // [0, annotationen.length-1] — linear zwischen den kumulativen
        // Pfad-Indizes zweier benachbarter Annotationen interpoliert, damit
        // der Ortswechsel-"Sprung" innerhalb seines Scroll-Abschnitts noch
        // weich (Punkt für Punkt den echten Fussweg entlang) wächst, statt
        // schlagartig aufzupoppen.
        let stelle = constrain(zoomedLokalerFortschritt * (kumulativ.length - 1), 0, kumulativ.length - 1);
        let i0 = Math.floor(stelle), i1 = Math.min(kumulativ.length - 1, i0 + 1);
        let frac = stelle - i0;
        upToIndex = Math.round(lerp(kumulativ[i0], kumulativ[i1], frac));
      } else {
        upToIndex = Math.round(zoomedLokalerFortschritt * (routenLinie.length - 1));
      }
      if (upToIndex >= 1) {
        // Strichstärke 10 wie Kapitel 1s Route in ihrer normalen (nicht
        // rausgezoomten) Ansicht — dort lerp(10, 2, zoomOutAmount), hier
        // gibt es keine entsprechende Rauszoom-Phase, also fix bei 10.
        zeichneRoute(routenLinie, upToIndex, bbox, 10, mapOffsetX, mapOffsetY, kapitelZoomAmount);
      }
    }

    // Wachsende Kreise + aktuelle Annotation — dasselbe System wie Kapitel 1
    // (zeichneKreiseOrtRuns/Annotationsbox in draw()), nur mit diesem
    // Kapitels eigenen Daten/annIndex statt stationenData. annIndex/
    // punktIndex analog zu Kapitel 1s Berechnung in draw() (dort direkt vor
    // dem Aufruf dieser Funktion), hier aber aus zoomedLokalerFortschritt
    // abgeleitet, da dieses Kapitel keine eigenen Scroll-Meilensteine hat.
    if (daten && daten.annotationen && daten.annotationen.length) {
      let annIndexZoom = Math.min(daten.annotationen.length - 1, Math.floor(zoomedLokalerFortschritt * daten.annotationen.length));
      let aktuelleAnnZoom = daten.annotationen[annIndexZoom];
      // annIndexZoom statt aktuelleAnnZoom.revealIndex: Letzteres ist bei
      // Kapitel 3 (handkuratiert) für die meisten Annotationen NICHT die
      // Array-Position (andere, hier nicht relevante Altsemantik), während
      // ortRuns[].revealIndex (siehe zeichneKreiseOrtRuns) verlässlich die
      // Array-Position ist — die beiden verglichenen Werte liefen dadurch
      // auseinander, Kreise erschienen zu spät oder gar nicht. annIndexZoom
      // ist für alle Kapitel (auch die automatisch gebauten) ohnehin schon
      // die Array-Position, also die korrekte Vergleichsbasis.
      let punktIndexZoom = aktuelleAnnZoom.vorRoutenstart ? 0 : annIndexZoom;
      zeichneKreiseOrtRuns(punktIndexZoom, annIndexZoom, bbox, mapOffsetX, mapOffsetY, daten);
      aktuelleAnnotationZoom = aktuelleAnnZoom;
    }
  }

  // Startpunkt (schwarz) + Kapitelnummer je Route — erscheint zusammen mit
  // der Route, sobald diese zu wachsen beginnt. Kapitel mit eigenem
  // Kartenausschnitt (siehe kapitelKarten) sind klickbar — Hover zeigt das
  // per Cursor/Farbe an, Klick zoomt in kapitel<NR>-karte.png (siehe
  // oeffneKapitelZoom/mousePressed).
  noStroke();
  textFont("'Source Sans 3', sans-serif"); // wie .annotation-tag (var(--sans)) und die Kreis-Labels
  textStyle(BOLD); // .annotation-tag ist font-weight: 700
  textAlign(LEFT, CENTER);
  textSize(11);
  kapitelHover = null;

  // Mehrere Kapitel können exakt denselben Startpunkt haben (z.B. "Wohnung
  // Duroy/Madeleine" für 02/10, oder "Redaktion La Vie Française" für
  // 07/11 — beide echte, wiederkehrende Orte, keine Datenfehler). Ohne
  // Versatz zeichnet das später gelistete Kapitel (höhere Nummer) sein
  // Badge exakt über das frühere, das dadurch unsichtbar UND unklickbar
  // wird — daher unten ein kleiner kreisförmiger Versatz pro Gruppe.
  // Gruppiert wird nach ABSTAND, nicht nach exakt gleicher Koordinate. Ein
  // Text-Vergleich der Zahlen hätte Kapitel 18 aus der Gruppe 08/09 fallen
  // lassen: sein Startpunkt liegt 0.24 m daneben (2.31921 gegen 2.3192132),
  // auf dem Bildschirm also exakt auf demselben Pixel. Es bekam dadurch
  // keinen Versatz und lag mittig unter den beiden anderen Badges.
  const DUP_TOLERANZ = 0.0003; // Grad, rund 25 m — deutlich unter dem kleinsten echten Abstand zweier Startpunkte (223 m)
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
    // Bewusst NICHT (mehr) an lokalerFortschritt (die i/n..(i+1)/n-Scheibe
    // dieses Kapitels am Gesamt-Akt) gekoppelt wie die Routenlinien oben:
    // die zeigen sich absichtlich nacheinander im Scrollverlauf, aber die
    // Start-Badges sind Klickziele, die von Anfang an alle gleichzeitig da
    // sein sollen — sonst liessen sich spät gelistete Kapitel (hohe i) erst
    // anklicken, nachdem man schon weit in den Akt gescrollt war, obwohl das
    // Kapitelregister links sie längst anzeigt.
    let labelAlpha = (zoomedKapitel && kapitelNr !== zoomedKapitel)
      ? alpha * (1 - kapitelZoomAmount)
      : alpha;
    // Unter 1/255 ist ein Alpha auf dem 8-Bit-Kanal ohnehin nicht mehr
    // darstellbar. Der frühere Test (<= 0) griff nie: kapitelZoomAmount wird
    // per lerp() nachgeführt und läuft nur asymptotisch gegen 1, labelAlpha
    // wurde also beliebig klein, aber nie 0. Die Badges der übrigen Kapitel
    // liefen dadurch im Kapitel-Zoom endlos weiter — und wurden sichtbar,
    // weil das fill() unten von p5 übersprungen wird, sobald labelAlpha von
    // Frame zu Frame gleich bleibt: zeichneKreiseOrtRuns (oben) schreibt über
    // zeichneKreisLabels direkt in drawingContext.fillStyle und umgeht p5s
    // Zwischenspeicher, das darauf folgende fillText() erbte dann dessen
    // volle Deckkraft (derselbe Fallstrick wie in zeichneOrtsveraenderung).
    if (labelAlpha < 1) return;

    let start = lonLatToScreen(punkte[0][0], punkte[0][1], bbox, 0, 0); // zentrierte Übersichtskarte, kein mapOffsetX
    // Für das gerade gezoomte Kapitel zum tatsächlichen Anfang der genauen
    // Route überblenden (routenPfadDetail/routenPunkte, mapOffsetX-Rahmen)
    // statt am Startpunkt der groben, mit offsetX=0 berechneten Übersichts-
    // linie stehen zu bleiben — der trifft im Kapitel-Zoom nicht exakt auf
    // den echten Routenanfang. kapitelZoomAmount blendet weich zwischen
    // beiden Positionen (0 = Übersicht, 1 = voll gezoomt).
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

    // Kreisförmiger Versatz für Kapitel mit identischem Startpunkt (siehe
    // startDupGruppen oben) — jedes Kapitel der Gruppe bekommt einen festen,
    // eigenen Platz auf einem kleinen Kreis um den echten Punkt, statt sich
    // mit den anderen zu überlagern.
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
      // Nummer auf die AUSSENSEITE des Versatzkreises setzen. Sonst steht sie
      // immer rechts vom Punkt und damit bei den linken Badges quer über der
      // Gruppenmitte — bei Kapitel 2 lagen die Nummern von 13 und 15 direkt
      // über und unter dessen Punkt und drückten ihn zwischen sich ein.
      labelLinks = cos(dupWinkel) < -0.01;
    }

    // Klickbar, sobald entweder ein eigener Kartenausschnitt (kapitelKarten)
    // ODER zumindest ein Spine-Panel (KAPITEL_MIT_SPINE_PANEL) vorhanden ist
    // — Kapitel ohne eigenen Ausschnitt (aktuell 02, 14, 15) zeigen beim
    // Zoom dann nur das Spine-Panel, die Karte bleibt auf der Übersicht.
    let klickbar = (!!kapitelKarten[kapitelNr] || KAPITEL_MIT_SPINE_PANEL.has(kapitelNr)) && !zoomedKapitel;
    let hover = klickbar && dist(mouseX, mouseY, start.x, start.y) < FOTO_MARKER_TREFFER_RADIUS;
    if (hover) kapitelHover = kapitelNr;

    // Punkt und Nummer nehmen dieselbe Hitze wie die Linie (siehe
    // kapitelHitze): voll in der Hoverfarbe, solange die eigene Route wächst,
    // danach gemeinsam mit ihr auf die normale Farbe abkühlend. Die
    // Punktgrösse bleibt normal, damit der echte Hover unterscheidbar bleibt.
    let scheibe = kapitelScheiben()[i];
    let lokalerFortschritt = scheibe
      ? constrain(map(fortschritt, scheibe.von, scheibe.bis, 0, 1), 0, 1) : 0;
    let hitze = (!zoomedKapitel && lokalerFortschritt > 0) ? kapitelHitze(fortschritt, scheibe) : 0;

    // fill(hexString, alpha) ist keine verlässliche p5-Signatur (bricht die
    // Farb-Auflösung ab) — deshalb RGB statt Hex+Alpha, wie überall sonst
    // im Sketch (z.B. ROUTE_COLOR_RGB).
    // Verbindungsstrich vom versetzten Badge zurück zum echten Routenanfang.
    // Ohne ihn wirkt ein Badge, dessen Versatzwinkel quer zur Route zeigt,
    // wie ein Punkt ohne Route — genau das passierte Kapitel 7, das sich die
    // Redaktion als Startpunkt mit 10 und 11 teilt und den Winkel 0 (nach
    // rechts) bekam, während die Linie dort nach oben wegläuft.
    if (dupAnker) {
      stroke(33, 43, 46, labelAlpha * 0.55);
      strokeWeight(1);
      line(dupAnker.x, dupAnker.y, start.x, start.y);
      noStroke();
    }

    if (hover) fill(FWERT_COLOR_RGB.r, FWERT_COLOR_RGB.g, FWERT_COLOR_RGB.b, labelAlpha); // #C2511C
    else fill(lerp(33, FWERT_COLOR_RGB.r, hitze), lerp(43, FWERT_COLOR_RGB.g, hitze),
      lerp(46, FWERT_COLOR_RGB.b, hitze), labelAlpha); // #212B2E .. #C2511C
    ellipse(start.x, start.y, hover ? 11 : 8, hover ? 11 : 8);
    // p5s text() bleibt hier während des Scrollens (viele Frames/Sekunde,
    // wechselnde Werte) manchmal unsichtbar, obwohl der Canvas-Context
    // nachweislich korrekt gesetzt ist (siehe zeichneSpineHorizontal, gleicher
    // Bug/Workaround) — direkt über den Canvas-Context gezeichnet, fillStyle
    // kommt schon vom fill()-Aufruf oben.
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

  // Kapitel 1 hat keine Übersichtsroute in uebersichtsRouten (eigene, separat
  // gezeichnete Route/Startpunkt) — Nummer wird hier eigens ergänzt, klickbar
  // wie die anderen, aber Klick scrollt zurück zu Kapitel 1 statt in ein Bild
  // zu zoomen (siehe scrolleZuKapitel1/mousePressed).
  //
  // Blendet im Kapitel-Zoom mit aus, nach derselben Regel wie 02–18 (siehe
  // labelAlpha oben). Vorher stand die 01 dort bewusst als Rückweg-Anker
  // stehen — sie war damit aber die einzige sichtbare Kapitelnummer in einer
  // Detailansicht, die sonst keine zeigt. Der Rückweg läuft weiterhin über
  // das Kapitelregister links, Escape und Hochscrollen.
  // Hover/Klick sitzen bewusst INNERHALB des Guards: ein unsichtbares
  // Klickziel auf der Kapitelkarte wäre schlimmer als gar keines.
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


  // aktuelleAnnotationZoom: für die Annotationsbox in draw() (nur bei
  // Kapitel 02–18 relevant — Kapitel 1s eigene Annotation läuft weiterhin
  // über routeAmount/annIndex direkt in draw()).
  return { aktuelleAnnotationZoom };
}

// Scrollt zurück in die Kapitel-1-Ansicht (Ende des Rein-Zooms/Anfang der
// Route) — schliesst einen eventuell offenen Kapitel-Zoom gleich mit.
function scrolleZuKapitel1() {
  schliesseKapitelZoom();
  let trackEl = document.querySelector('.scroll-track');
  let ziel = trackEl.offsetHeight * SCROLL_MEILENSTEINE.zoomEnd;
  window.scrollTo({ top: ziel, behavior: 'smooth' });
}

// Öffnet den Kapitel-Zoom an der AKTUELLEN Scrollposition, ohne sie zu
// verändern. Alle Bedien-Wege (Kapitelregister, Klick auf einen Routen-
// Startpunkt) laufen deshalb über springeZuKapitelZoom, das vorher an den
// Anfang des uebersichtRouten-Akts springt — sonst öffnete sich das Kapitel
// mitten im Ablauf, mit schon ausgeblendetem Einstiegstext und fertig
// gezeichneter Route (siehe KAPITEL_EINSTIEG_SCROLL_ENDE).
//
// Kartenausschnitt + Route blenden sofort weich ein (kapitelZoomAmount,
// siehe draw()). Verlassen geschieht durch Hoch-scrollen (siehe
// uebersichtRoutenFortschritt<=0-Check in draw()), über Escape, oder über
// den "Alle"-Eintrag im Kapitel-Menübalken (springeZurUebersicht).
// Setzt voraus, dass die aktuelle Scrollposition bereits im uebersichtRouten-
// Akt liegt (siehe draw()) — sonst schliesst genau dieser Check den gerade
// geöffneten Zoom im nächsten Frame gleich wieder (Sprung von einer
// früheren Position, z.B. Kapitel 1s eigenem Kartenausschnitt, MUSS daher
// über springeZuKapitelZoom() laufen, nicht direkt über diese Funktion).
// Setzt den Ansichtsmodus (Karte/Grafik) + eine eventuell laufende
// Play-Animation zurück — bei jedem Kapitelwechsel aufgerufen, damit jede
// Kapitel-Ansicht frisch in der Kartenansicht startet (siehe
// oeffneKapitelZoom/schliesseKapitelZoom/springeZuKapitelZoom).
function setzeKapitelAnsichtZurueck() {
  kapitelAnsichtsModus = 'karte';
  grafikSpielt = false;
  grafikFortschritt = 0;
  grafikPlayAusblendStart = null;
  // Kapitelwechsel während laufender Sonifikation (Kapitel 1s Graph-
  // Play-Button, siehe toggleGrafikPlay) sauber abbrechen — sonst liefe der
  // Ton unabhängig von der (jetzt zurückgesetzten) Graph-Ansicht weiter.
  if (sonifikationSpieltGerade) beendeSonifikationAudio();
  // Startzeit für den zeitbasierten Fade des Kapitel-Einstiegstexts
  // (.kapitel-einstiegstext, siehe draw()) — bei jedem Kapitelwechsel neu,
  // auch beim Schliessen (dort harmlos, da dann kein zoomedKapitel matcht).
  kapitelEinstiegsStartMillis = millis();
}

// Weiches Ein-/Ausblenden des Kapitel-Zooms. Ein Integrator, der GENAU
// EINMAL pro Frame ticken muss — deshalb ruft draw() ihn direkt auf und nicht
// zeichneUebersichtsrouten(): die läuft nur, solange der Übersichtsakt aktiv
// ist, und der Wert würde beim Ausblenden einfrieren. Gleiche Bauart wie
// aktualisiereGrafikFortschritt() in spine-horizontal.js.
// Läuft asymptotisch gegen sein Ziel, erreicht es also nie exakt (siehe den
// Kommentar zu labelAlpha in zeichneUebersichtsrouten).
function aktualisiereKapitelZoom() {
  kapitelZoomAmount = lerp(kapitelZoomAmount, zoomedKapitel ? 1 : 0, 0.08);
}

function oeffneKapitelZoom(nr) {
  if (!kapitelKarten[nr] && !KAPITEL_MIT_SPINE_PANEL.has(nr)) return;
  zoomedKapitel = nr;
  setzeKapitelAnsichtZurueck();
}

function schliesseKapitelZoom() {
  zoomedKapitel = null;
  setzeKapitelAnsichtZurueck();
}

// Sprungziel der 02–18-Badges im Kapitel-Menübalken: springt (OHNE
// Scroll-Animation — bei "smooth" liefen mehrere draw()-Frames noch mit der
// alten Scrollposition, in denen der uebersichtRoutenFortschritt<=0-Check
// den gerade gesetzten zoomedKapitel sofort wieder auf null zurückgesetzt
// hätte) auf eine sichere Position kurz NACH dem Anfang des
// uebersichtRouten-Akts (statt wie früher in dessen Mitte — dort wäre die
// Route schon gut zur Hälfte gewachsen, sobald der Einstiegstext-Gate in
// zeichneUebersichtsrouten sie freigibt, statt bei der ersten Annotation zu
// beginnen wie bei Kapitel 1) und öffnet dort direkt den Kapitel-Zoom —
// funktioniert dadurch auch von jeder früheren Scrollposition aus (z.B. aus
// Kapitel 1s eigenem Kartenausschnitt heraus). 1% Abstand zum exakten
// Akt-Anfang reicht als Sicherheitsmarge gegen den <=0-Check, liegt aber für
// jedes Kapitel (auch annotationsarme) noch klar bei dessen erster
// Annotation (siehe zoomedLokalerFortschritt/annIndexZoom dort).
function springeZuKapitelZoom(nr) {
  if (!kapitelKarten[nr] && !KAPITEL_MIT_SPINE_PANEL.has(nr)) return;
  let trackEl = document.querySelector('.scroll-track');
  let start = SCROLL_MEILENSTEINE.uebersichtRoutenStart
    + 0.01 * (SCROLL_MEILENSTEINE.uebersichtRoutenEnd - SCROLL_MEILENSTEINE.uebersichtRoutenStart);
  window.scrollTo(0, trackEl.offsetHeight * start);
  oeffneKapitelZoom(nr);
}

// Sprungziel des "Alle"-Buttons im Kapitel-Menübalken: verlässt jede
// offene Kapitel-Ansicht (Kapitel 1 eigene ODER ein gezoomtes 02–18) und
// landet auf der neutralen Übersichtskarte — dieselbe sichere Position wie
// springeZuKapitelZoom, aber ohne dort ein Kapitel zu öffnen.
function springeZurUebersicht() {
  let trackEl = document.querySelector('.scroll-track');
  let mitte = (SCROLL_MEILENSTEINE.uebersichtRoutenStart + SCROLL_MEILENSTEINE.uebersichtRoutenEnd) / 2;
  window.scrollTo(0, trackEl.offsetHeight * mitte);
  schliesseKapitelZoom();
}
