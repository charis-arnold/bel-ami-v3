/* =============================================================================
   spine-horizontal.js — Graph-Ansicht: horizontale Spine + Play-Steuerung

   Aus sketch.js herausgelöst (siehe docs/modularisierung-log.md). Die
   Alternative zur Kartenansicht: statt einer Route auf der Karte zeigt jedes
   Kapitel seine Orte als waagrechte Zeitleiste, deren Kreisgrafiken per
   Play-Animation mitwachsen. Umgeschaltet wird über "Plan"/"Graph" im
   Kapitelregister (setzeKapitelAnsichtModus), abgespielt über den
   Play-Button (toggleGrafikPlay), synchron zum Ton aus sonifikation.js.

   --- Abhängigkeiten NACH AUSSEN (alle erst zur Laufzeit) -------------------
   aus sketch.js:           kapitelAnsichtsModus, zoomedKapitel, stationenData,
                            datenFuerKapitel, zeichneKreiseFuerRun,
                            zeichneFwertPunkte
   aus datenbereinigung.js: ROUTE_COLOR_RGB, groessterKreisRadius,
                            wohnungFilterFuerOrt, sammleAnnotationenNachOrtBasis,
                            zaehleBandCounts, zaehleAnnotationenLiveNachOrtBasis,
                            baueSpineDaten, ortRunsFuerSpine
   aus sonifikation.js:     SONIFIKATION_GESAMTDAUER_SEK, sonifikationSpieltGerade,
                            beendeSonifikationAudio, spieleKapitel1SonifikationAudio,
                            spieleKapitelSonifikationAudio
   aus p5:                  width/height, Zeichen- und Text-API, drawingContext, millis

   --- Wer von aussen hierher greift ----------------------------------------
   setup()                      hängt toggleGrafikPlay an den Play-Button
   baueKapitelRegister()        ruft setzeKapitelAnsichtModus()
   draw()                       ruft stelleSpineDatenBereit() (befüllt
                                spineEintraegep5/spineEintraegeKapitel),
                                ruft aktualisiereGrafikFortschritt() und
                                zeichneSpineHorizontal(), liest grafikSpielt
                                und grafikPlayAusblendStart
   setzeKapitelAnsichtZurueck() setzt grafikSpielt/grafikFortschritt/
                                grafikPlayAusblendStart zurück
   sonifikation.js              liest spineEintraegeKapitel und ruft
                                aktuelleGrafikAnimationDauer()

   ACHTUNG — Abhängigkeitszyklus mit sonifikation.js: beide Dateien greifen
   gegenseitig aufeinander zu. Das trägt nur, weil ALLE Zugriffe in beiden
   Richtungen zur Laufzeit stattfinden. Kein Top-Level-Initialisierer dieser
   Datei darf je eine fremde Funktion aufrufen — sonst bricht die
   Ladereihenfolge. (Aktuell einziger nicht-literaler Initialisierer:
   new WeakMap() für spineLayoutCache.)

   NICHT hier: grafikPlayButton. Trägt dasselbe Präfix, ist aber ein
   DOM-Handle und wird ausschliesslich in setup()/draw() benutzt — steht
   daher bei den übrigen DOM-Referenzen in sketch.js.

   Wird in index.html VOR sketch.js geladen.
============================================================================= */

// Zustand der Play-Animation — aus sketch.js mitgewandert, wo sie zwischen
// den übrigen Zustandsvariablen standen.
let grafikSpielt = false;       // läuft die Wachstums-Animation gerade?
let grafikStartZeit = 0;        // millis() bei Play-Start (bzw. rechnerisch zurückversetzt bei Resume)
let grafikFortschritt = 0;      // 0..1, letzter berechneter Animationsstand (bleibt bei Pause stehen)
// millis() beim Play-Klick in der Graph-Ansicht. Der Kapitel-Einstiegstext
// blendet in der Kartenansicht über das Scrollen aus (siehe
// KAPITEL_EINSTIEG_SCROLL_START/ENDE) — in der Graph-Ansicht gibt es dafür
// keinen Scroll, dort weicht er stattdessen dem Play: sobald die Animation
// startet, blendet er weg und bleibt weg (auch bei Pause), bis das Kapitel
// oder der Ansichtsmodus wechselt. null = noch kein Play in dieser Ansicht.
let grafikPlayAusblendStart = null;

// ---------------------------------------------------------------------------
// Spine in p5
// ---------------------------------------------------------------------------

// Spine-Daten: einmal berechnen und dann halten (baueSpineDaten() lebt in
// datenbereinigung.js und gibt das Array zurück, siehe
// stelleSpineDatenBereit() gleich unten)
let spineEintraegep5 = [];  // { typ, text, rv, stationIdx, kreisId }
let spineEintraegeKapitel = {}; // Cache je Kapitelnummer (02–18), lazy befüllt beim ersten Zoom

// Baut die beiden Caches auf, sobald die Daten da sind. Von draw() einmal je
// Frame gerufen — vorher standen diese beiden Zuweisungen direkt in draw(),
// also schrieb sketch.js in den Zustand dieses Moduls hinein.
//
// kapitelNr ist das zuletzt gezoomte Kapitel (letzterZoomKapitel in
// sketch.js, nicht zoomedKapitel): Das generische Spine-Panel für 02–18 soll
// während des Ausblendens (kapitelZoomAmount -> 0) weiter die richtigen Daten
// zeigen, statt abrupt zu verschwinden. Kapitel 1 hat sein eigenes, live
// wachsendes Panel und läuft über spineEintraegep5.
//
// Die Hauptorte kommen dynamisch aus ortRunsFuerSpine(daten), nicht mehr aus
// einer je Kapitel von Hand gepflegten Liste (siehe KAPITEL_MIT_SPINE_PANEL
// in datenbereinigung.js).
function stelleSpineDatenBereit(kapitelNr) {
  if (spineEintraegep5.length === 0 && stationenData.ortRuns) {
    spineEintraegep5 = baueSpineDaten(stationenData, ortRunsFuerSpine(stationenData));
  }
  if (kapitelNr && !spineEintraegeKapitel[kapitelNr]) {
    let daten = datenFuerKapitel(kapitelNr);
    if (daten && daten.ortRuns) {
      spineEintraegeKapitel[kapitelNr] = baueSpineDaten(daten, ortRunsFuerSpine(daten));
    }
  }
}

// Ansichtsmodus direkt setzen (Menübalken-Einträge "Plan"/"Graph", siehe
// baueKapitelRegister) — setzt NICHT auf annIndex/Scroll auf, sondern
// startet/pausiert grafikFortschritt neu (siehe aktualisiereGrafikFortschritt).
// Jeder Wechsel IN die grafische Ansicht beginnt bei 0 (Animation muss aktiv
// per Play gestartet werden). Klick auf den bereits aktiven Modus tut nichts.
function setzeKapitelAnsichtModus(modus) {
  if (kapitelAnsichtsModus === modus) return;
  if (sonifikationSpieltGerade) beendeSonifikationAudio();
  kapitelAnsichtsModus = modus;
  grafikSpielt = false;
  grafikFortschritt = 0;
  grafikPlayAusblendStart = null;
}

// Gesamtdauer eines Graph-Play-Durchlaufs: für Kapitel 1 (eigene
// Sonifikationsdaten, kapitel01-sonifikation.json, wegstreckengewichtet)
// dieselbe SONIFIKATION_GESAMTDAUER_SEK wie das Audiostück (sonifikation.js),
// damit Ton und Wachstumsanimation der Spine zusammen laufen. 02–18 wachsen
// mit derselben WachstumsGESCHWINDIGKEIT (ms pro Spine-Eintrag) wie Kapitel
// 1, statt einer für alle Kapitel gleichen festen Gesamtdauer — sonst
// wirkten Kapitel mit weniger Einträgen als Kapitel 1 (18, mehr als jedes
// andere) hastiger durchgespult. Ihr Ton (spieleKapitelSonifikationAudio,
// sonifikation.js) übernimmt exakt diese Gesamtdauer und verteilt sie
// gleichmässig auf dieselben Spine-Schritte, bleibt dadurch immer synchron.
// Für Kapitel mit nur einem Eintrag (z.B. Kapitel 2) sorgt der
// n===1-Sonderfall in zeichneSpineHorizontal dafür, dass der einzige Kreis
// über diese Dauer tatsächlich sichtbar wächst, statt sofort auf vollem
// Stand zu stehen.
function aktuelleGrafikAnimationDauer() {
  if (!zoomedKapitel) return SONIFIKATION_GESAMTDAUER_SEK * 1000;
  let n1 = spineEintraegep5.length;
  let dauerProSchritt = (SONIFIKATION_GESAMTDAUER_SEK * 1000) / (n1 - 1 || 1);
  let eintraege = spineEintraegeKapitel[zoomedKapitel];
  let ni = eintraege ? eintraege.length : 1;
  return dauerProSchritt * (ni - 1 || 1);
}

// Play/Pause-Button der grafischen (Graph-)Ansicht — für JEDES Kapitel
// (1 wie 02–18) dieselbe Wachstums-Animation der Spine, bleibt dabei immer
// in der Graph-Ansicht (Resume statt Neustart bei Pause->Play über
// grafikStartZeit = jetzt - bereits-gelaufene-Zeit, damit
// aktualisiereGrafikFortschritt() nahtlos weiterzählt). Für JEDES Kapitel
// zusätzlich mit Ton: spieleKapitel1SonifikationAudio()/
// spieleKapitelSonifikationAudio(nr)/beendeSonifikationAudio()
// (sonifikation.js) starten/stoppen synchron zur Spine — kein Resume für
// den Ton (Strudel kann nicht an einer beliebigen Stelle einsteigen),
// Pause->Play beginnt den Ton daher jeweils neu, auch wenn die Spine an
// ihrer alten Stelle weiterwächst.
function toggleGrafikPlay() {
  if (grafikFortschritt >= 1) grafikFortschritt = 0; // am Ende: von vorn
  grafikSpielt = !grafikSpielt;
  if (grafikSpielt) {
    // Einstiegstext weicht dem Play — nur beim ERSTEN Start merken, damit ein
    // Pause/Weiter den schon ausgeblendeten Text nicht neu wegblenden lässt.
    if (grafikPlayAusblendStart === null) grafikPlayAusblendStart = millis();
    grafikStartZeit = millis() - grafikFortschritt * aktuelleGrafikAnimationDauer();
    if (!zoomedKapitel) spieleKapitel1SonifikationAudio();
    else spieleKapitelSonifikationAudio(zoomedKapitel);
  } else if (sonifikationSpieltGerade) {
    beendeSonifikationAudio();
  }
}

function aktualisiereGrafikFortschritt() {
  if (!grafikSpielt) return;
  grafikFortschritt = constrain((millis() - grafikStartZeit) / aktuelleGrafikAnimationDauer(), 0, 1);
  if (grafikFortschritt >= 1) grafikSpielt = false; // Ende erreicht, Button springt zurück auf Play
}

// Fester Abstand zwischen zwei Ortspunkten der Spine (siehe
// zeichneSpineHorizontal) — NICHT mehr über eine feste Spine-Breite auf n
// Einträge gestreckt, die Gesamtbreite ergibt sich also aus n * Abstand.
// Nur eine Obergrenze: reicht der Platz zwischen Kapitelregister (links,
// 5vw) und Legende-Box (rechts, 190px + Rand) bei vielen Einträgen nicht
// (Kapitel 1 z.B. 18 Einträge — mehr als jedes andere Kapitel), wird der
// Abstand in zeichneSpineHorizontal so weit gestaucht, dass die Spine nicht
// unter dem Kapitelregister/der Legende verschwindet. Ränder zusätzlich um
// den grössten möglichen Kreisradius (100px, siehe kreisRadius) vergrössert,
// damit auch der erste/letzte Kreis selbst bei maximaler Grösse nicht unter
// Kapitelregister/Legende gerät, nicht nur sein Mittelpunkt.
const SPINE_PUNKT_ABSTAND = 70;
const SPINE_RAND_LINKS = 200;
const SPINE_RAND_RECHTS = 340;
// Vertikale Linie vom Ortspunkt nach unten zur (horizontalen) Beschriftung.
const SPINE_LABEL_LINIE_LAENGE = 16;
const SPINE_LABEL_TEXT_ABSTAND = 6;

// ---------------------------------------------------------------------------
// Festes Label-Layout der Spine. Früher wurde die Zeilenzuteilung in JEDEM
// Frame neu berechnet — sortiert nach linienStartY, das mit dem wachsenden
// Kreisradius nach unten wandert. Dadurch tauschten benachbarte Labels beim
// Scrollen laufend die Zeile, und jedes Label rutschte zusätzlich mit seinem
// eigenen Kreis mit. Jetzt wird die Anordnung EINMAL je Kapitel (und Breite)
// aus dem Endstand berechnet: ein Zeilenraster unterhalb des grössten Kreises,
// den das Kapitel überhaupt erreicht, Zeilenzuteilung streng von links nach
// rechts. Die Beschriftungen stehen dadurch über den ganzen Scroll hinweg
// still — nur die Zuführungslinie wächst mit ihrem Kreis mit.
// ---------------------------------------------------------------------------
const SPINE_LABEL_HOEHE = 16;
const SPINE_LABEL_ZEILEN_ABSTAND = 6;
// Freizuhaltender Rand oben/unten für die vertikale Lage der Spine (siehe
// spineLayout). Unten mehr, weil dort der Play-Button (48px + 12px Abstand,
// siehe .grafik-play-button in style.css) und der Scroll-Fortschrittsbalken
// liegen.
const SPINE_RAND_OBEN = 24;
const SPINE_RAND_UNTEN = 76;
const spineLayoutCache = new WeakMap(); // eintraege-Array -> { breite, hoehe, versatz, breiten, linienY }

function spineLayout(eintraege, daten, abstand, startX) {
  let vorhanden = spineLayoutCache.get(eintraege);
  if (vorhanden && vorhanden.breite === width && vorhanden.hoehe === height) return vorhanden;

  // Grösster Kreisradius am Kapitelende — dieselbe Formel wie in
  // zeichneKreiseFuerRun, nur mit dem LETZTEN Annotationsindex statt dem
  // aktuellen. Alle Labels liegen darunter, damit kein später gewachsener
  // Kreis je eine Zuführungslinie oder eine Beschriftung überdeckt.
  let letzterIndex = daten.annotationen.length - 1;
  let maxRadius = 0;
  eintraege.forEach(e => {
    if (e.typ === 'rueckkehr') return; // zeichnet keinen eigenen Kreis
    let bc = zaehleAnnotationenLiveNachOrtBasis(wohnungFilterFuerOrt(e.ortBasis), letzterIndex, daten);
    maxRadius = Math.max(maxRadius, groessterKreisRadius(bc));
  });

  // Höchster Rückkehr-Bogen: die Bögen sind Halbkreise ÜBER der Spine-Linie
  // (siehe zeichneSpineHorizontal), ihr Radius ist der halbe Abstand zwischen
  // Rückkehrpunkt und Ursprungskreis. Bei Kapiteln mit weit zurückreichenden
  // Rückkehren (Kapitel 5, 7: über 400px) bestimmt dieser Wert, wie tief die
  // Linie liegen muss, damit oben nichts abgeschnitten wird.
  let maxBogen = 0;
  eintraege.forEach((e, i) => {
    if (e.typ !== 'rueckkehr') return;
    maxBogen = Math.max(maxBogen, Math.abs(i - e.zielIndex) * abstand / 2);
  });

  // Textmasse mit exakt der Schrift nehmen, in der die Labels später auch
  // gezeichnet werden (sonst stimmen die Kollisionsbreiten nicht).
  textFont("'Source Sans 3', sans-serif");
  textStyle(BOLD);
  textSize(11);

  // Zeilenzuteilung von links nach rechts: jedes Label kommt in die OBERSTE
  // Zeile, in der rechts vom zuletzt gesetzten Label noch Platz ist. Da die
  // Einträge in x-Reihenfolge durchlaufen werden, genügt je Zeile das rechte
  // Ende des jeweils letzten Labels als Vergleich.
  let zeilenEnde = [];
  let versatz = [];
  let breiten = [];
  eintraege.forEach((e, i) => {
    let x = startX + i * abstand;
    breiten[i] = textWidth(e.text);
    let halbeBreite = breiten[i] / 2 + 4;
    let zeile = zeilenEnde.findIndex(ende => x - halbeBreite > ende);
    if (zeile === -1) {
      zeile = zeilenEnde.length;
      zeilenEnde.push(-Infinity);
    }
    zeilenEnde[zeile] = x + halbeBreite;
    versatz[i] = maxRadius + SPINE_LABEL_LINIE_LAENGE + zeile * (SPINE_LABEL_HOEHE + SPINE_LABEL_ZEILEN_ABSTAND);
  });

  // Vertikale Lage der Spine-Linie. Bisher fest height/2 — dabei liefen die
  // hohen Rückkehr-Bögen oben aus dem Fenster. Jetzt: so weit nach unten wie
  // nötig, damit oben Bögen und Kreise vollständig Platz haben, aber nur so
  // weit, dass unten die Labels noch hineinpassen. Kapitel, bei denen beides
  // ohnehin passt, bleiben unverändert auf der Mitte stehen.
  let oben = Math.max(maxRadius, maxBogen);
  let unten = Math.max(...versatz) + SPINE_LABEL_TEXT_ABSTAND + SPINE_LABEL_HOEHE;
  let frei = height - SPINE_RAND_OBEN - SPINE_RAND_UNTEN;
  let linienY;
  if (oben + unten <= frei) {
    linienY = constrain(height / 2, SPINE_RAND_OBEN + oben, height - SPINE_RAND_UNTEN - unten);
  } else {
    // Passt selbst ganz nach unten geschoben nicht mehr (sehr niedriges
    // Fenster): Überstand proportional auf oben und unten verteilen, statt
    // ihn ganz auf einer Seite abzuschneiden.
    linienY = SPINE_RAND_OBEN + frei * (oben / (oben + unten));
  }

  let ergebnis = { breite: width, hoehe: height, versatz, breiten, linienY };
  spineLayoutCache.set(eintraege, ergebnis);
  return ergebnis;
}

// Horizontale Spine der grafischen Ansicht: zentriert auf den Browser,
// dieselben Einträge/Kreise wie das (jetzt entfallene) vertikale Panel, aber
// sequenziell per fortschritt (0..1, siehe grafikFortschritt) statt live am
// Scroll enthüllt. Die Kreisdiagramme wachsen dabei — analog zur Route in
// der Kartenansicht — mit der Erzählung: alle Kreise teilen sich denselben,
// aus fortschritt interpolierten "Spielkopf"-annIndex (globalAnnIndex
// unten), statt sofort im fertigen Endstand zu erscheinen. Kehrt die
// Erzählung zu einem Ort zurück (siehe baueSpineDaten: eigener
// typ 'rueckkehr' statt eines zweiten Kreises), wächst dadurch ganz von
// selbst der schon bestehende Kreis weiter — der Rückkehr-Punkt bekommt hier
// nur noch einen Bogen dorthin.
function zeichneSpineHorizontal(eintraege, fortschritt, daten = stationenData) {
  if (!eintraege.length) return;

  let n = eintraege.length;
  let verfuegbareBreite = width - SPINE_RAND_LINKS - SPINE_RAND_RECHTS;
  let abstand = n > 1 ? Math.min(SPINE_PUNKT_ABSTAND, verfuegbareBreite / (n - 1)) : SPINE_PUNKT_ABSTAND;
  let startX = SPINE_RAND_LINKS + (verfuegbareBreite - (n - 1) * abstand) / 2;
  // Vertikale Lage und Label-Anordnung kommen fertig aus spineLayout (einmal
  // je Kapitel/Fenstergrösse berechnet, danach aus dem Cache) — insbesondere
  // linienY, das die Spine so weit nach unten setzt, dass die hohen
  // Rückkehr-Bögen oben vollständig ins Fenster passen.
  let layout = spineLayout(eintraege, daten, abstand, startX);
  let linieY = layout.linienY;

  // position: wie weit der "Playhead" entlang der n Einträge (0..n-1) schon
  // ist. Eintrag i blendet weich ein, sobald position i-1..i durchläuft —
  // Eintrag 0 ist dadurch schon bei fortschritt=0 (Ruhezustand vor Play)
  // sichtbar, als Startpunkt der Linie.
  let position = fortschritt * (n - 1 || 1);

  // globalAnnIndex: interpoliert zwischen den revealIndex-Werten (rv) der
  // Einträge, an denen der Playhead gerade steht — alle Kreise wachsen so
  // gemeinsam mit derselben "Erzählzeit". Letzter Wegpunkt ist NICHT der rv
  // des letzten Eintrags selbst, sondern das Ende aller Annotationen —
  // sonst erreicht der letzte Kreis bei fortschritt=1 nie seinen vollen
  // Stand (rv markiert nur seinen ANFANG, nicht das Ende der Erzählung).
  let rvWegpunkte = eintraege.map(e => e.rv);
  rvWegpunkte[n - 1] = daten.annotationen.length - 1;
  let globalAnnIndex;
  if (n === 1) {
    // Nur ein einziger Eintrag (z.B. Kapitel 2, ein Ort): i0 und i1 würden
    // unten beide auf denselben Index 0 zeigen, dessen rv oben bereits fest
    // auf das ENDE aller Annotationen gesetzt ist — der Kreis stünde dadurch
    // ab fortschritt=0 sofort auf vollem Stand, statt zu wachsen. Stattdessen
    // ab "nichts gezählt" (-1) bis zum Ende interpolieren.
    globalAnnIndex = Math.round(lerp(-1, rvWegpunkte[0], fortschritt));
  } else {
    let i0 = Math.min(n - 1, Math.floor(position));
    let i1 = Math.min(n - 1, i0 + 1);
    globalAnnIndex = Math.round(lerp(rvWegpunkte[i0], rvWegpunkte[i1], position - i0));
  }

  if (position > 0) {
    noFill();
    stroke(ROUTE_COLOR_RGB.r, ROUTE_COLOR_RGB.g, ROUTE_COLOR_RGB.b, 255);
    strokeWeight(2);
    line(startX, linieY, startX + Math.min(n - 1, position) * abstand, linieY);
  }

  // Rückkehr-Bögen unter den Kreisen/Punkten zeichnen (gleicher Stil wie die
  // Route-Linie oben, Form: Halbkreisbogen über der Spine-Linie zwischen der
  // Rückkehr-Position und dem ursprünglichen Kreis desselben Orts).
  eintraege.forEach((e, i) => {
    if (e.typ !== 'rueckkehr') return;
    let alphaSkala = constrain(position - (i - 1), 0, 1);
    if (alphaSkala <= 0) return;
    let x = startX + i * abstand;
    let zielX = startX + e.zielIndex * abstand;
    // p5s arc() bleibt bei laufender Animation manchmal unsichtbar, siehe
    // zeichneHalbkreis — direkt über den Canvas-Context gezeichnet.
    drawingContext.strokeStyle = `rgba(${ROUTE_COLOR_RGB.r}, ${ROUTE_COLOR_RGB.g}, ${ROUTE_COLOR_RGB.b}, ${alphaSkala})`;
    drawingContext.lineWidth = 2;
    drawingContext.beginPath();
    drawingContext.arc((x + zielX) / 2, linieY, Math.abs(x - zielX) / 2, PI, TWO_PI);
    drawingContext.stroke();
  });

  // Kreise NICHT in Zeitleisten-Reihenfolge zeichnen, sondern nach Grösse
  // (grösster zuerst/unterste Ebene, kleinster zuletzt/oberste Ebene) — bei
  // eng benachbarten Punkten (fester SPINE_PUNKT_ABSTAND) überschneiden sich
  // Nachbarkreise stark, und ein in Zeitleisten-Reihenfolge SPÄTER
  // gezeichneter (aber kleinerer) Kreis würde sonst einen bereits
  // gezeichneten GRÖSSEREN Nachbarn unvollständig zudecken. Innerhalb jedes
  // einzelnen Kreises sorgt zeichneKreiseFuerRun bereits selbst für die
  // gleiche Regel (schraffiert unten, Valenz-Flächen oben, je nach Grösse).
  let kreisDaten = [];
  eintraege.forEach((e, i) => {
    if (e.typ === 'rueckkehr') return;
    let alphaSkala = constrain(position - (i - 1), 0, 1);
    if (alphaSkala <= 0) return;
    let x = startX + i * abstand;
    // Filter und Scan je EINMAL: aus derselben Trefferliste kommen die
    // Zählung für die Kreisflächen und die F-Wert-Punkte.
    let filter = wohnungFilterFuerOrt(e.ortBasis);
    let treffer = sammleAnnotationenNachOrtBasis(filter, globalAnnIndex, daten);
    let bc = zaehleBandCounts(treffer);
    let fwertAnnotationen = treffer.filter(a => a.hasFwert);
    kreisDaten.push({ i, x, bc, fwertAnnotationen, radius: 0 });
  });

  // Groesse vorab bestimmen (Aussenradius je bandCounts, ohne zu zeichnen)
  // und danach sortieren. groessterKreisRadius ist dieselbe Funktion, die
  // zeichneKreiseFuerRun intern benutzt — der Wert unten stimmt deshalb mit
  // dem gezeichneten Kreis überein.
  kreisDaten.forEach(k => { k.radius = groessterKreisRadius(k.bc); });
  kreisDaten.sort((a, b) => b.radius - a.radius);

  let radiusNachIndex = new Map();
  kreisDaten.forEach(k => {
    // winkel = PI: Halbkreise liegen hier OBEN/UNTEN statt links/rechts wie
    // auf der Karte — positiv nach oben, negativ nach unten (zeichneHalbkreis
    // bekommt winkel+HALF_PI für positiv, winkel-HALF_PI für negativ; im
    // Canvas zeigt -HALF_PI nach oben). Die F-Wert-Punkte bekommen denselben
    // Winkel, damit sie auf der Seite ihrer Valenz bleiben.
    zeichneKreiseFuerRun(k.x, linieY, k.bc, 1, PI);
    zeichneFwertPunkte(k.x, linieY, k.radius, k.fwertAnnotationen, 1, 'obenUnten');
    radiusNachIndex.set(k.i, k.radius);
  });

  textFont("'Source Sans 3', sans-serif");
  textStyle(BOLD);
  textSize(11);
  textAlign(CENTER, TOP);

  // Ortspunkt, Zuführungslinie und Beschriftung werden bewusst ERST HIER,
  // NACH allen Kreisen (unabhängig von deren Grösse-Reihenfolge oben)
  // gezeichnet, damit sie nie unter einem Nachbarkreis verschwinden. Die
  // Zeilenanordnung steht fest (siehe spineLayout) und ändert sich während
  // des Scrollens nicht mehr — nur die Linie wächst mit ihrem Kreis.
  // Durchgang 1: Ortspunkte und Zuführungslinien.
  eintraege.forEach((e, i) => {
    let alphaSkala = constrain(position - (i - 1), 0, 1);
    if (alphaSkala <= 0) return;
    let x = startX + i * abstand;
    let radius = radiusNachIndex.get(i) || 0;

    // Ortspunkt — p5s ellipse() bleibt bei laufender Animation manchmal
    // unsichtbar, siehe zeichneHalbkreis, daher direkt über den Context.
    drawingContext.fillStyle = `rgba(0, 0, 0, ${alphaSkala})`;
    drawingContext.beginPath();
    drawingContext.arc(x, linieY, 2.5, 0, TWO_PI);
    drawingContext.fill();

    // Zuführungslinie: vertikal vom Kreisrand (bzw. vom Ortspunkt, solange
    // der Kreis noch leer ist) hinunter zur festen Label-Zeile.
    stroke(0, 110 * alphaSkala);
    strokeWeight(1);
    line(x, linieY + (radius > 0 ? radius : 4), x, linieY + layout.versatz[i]);
    noStroke();
  });

  // Durchgang 2: Beschriftungen — NACH allen Linien, damit eine Linie auf dem
  // Weg zu einer tieferen Zeile ein fremdes Label nicht durchschneidet. Jedes
  // Label stellt sich dafür zusätzlich in der Hintergrundfarbe der
  // Grafikansicht frei. Kreise werden davon nie getroffen: die oberste
  // Label-Zeile liegt per Layout unterhalb des grössten Kreises, den das
  // Kapitel überhaupt erreicht.
  eintraege.forEach((e, i) => {
    let alphaSkala = constrain(position - (i - 1), 0, 1);
    if (alphaSkala <= 0) return;
    let x = startX + i * abstand;
    let textY = linieY + layout.versatz[i] + SPINE_LABEL_TEXT_ABSTAND;
    let breite = layout.breiten[i];

    drawingContext.fillStyle = `rgba(226, 230, 225, ${alphaSkala})`;
    drawingContext.fillRect(x - breite / 2 - 3, textY - 2, breite + 6, SPINE_LABEL_HOEHE - 2);

    // p5s text() bleibt hier während einer laufenden Play-Animation (viele
    // Frames/Sekunde, wechselnde Werte) manchmal unsichtbar, obwohl Font/
    // Farbe/Alpha/Ausrichtung im Canvas-Context nachweislich korrekt gesetzt
    // sind (mit drawingContext.fillText() an derselben Stelle sofort
    // sichtbar) — direkt über den Canvas-Context gezeichnet, um diesen Bug
    // zu umgehen; textAlign/textBaseline/font/fillStyle sind über die
    // p5-Aufrufe oben bereits auf dem Context gesetzt.
    drawingContext.fillStyle = `rgba(26, 26, 26, ${alphaSkala})`;
    drawingContext.fillText(e.text, x, textY);
  });

  textStyle(NORMAL);
}
