/* =============================================================================
   dom-aufbau.js — Aufbau der HTML-Bedienelemente

   Alles, was beim Start EINMAL an DOM-Knoten erzeugt wird: Kapitelregister
   links, Legendeninhalt rechts, die drei Marker-Ebenen der Kapitel-1-Ansicht,
   dazu der Akkordeon-Umschalter der Register. Hier wird nur gebaut — die
   Bildschirmposition bekommen die Knoten erst in draw().
============================================================================= */

// Öffnet ein Register exklusiv (Akkordeon). Die Klasse am gemeinsamen
// Container lässt in style.css den geschlossenen Tab mit ausfahren.
function oeffneRegister(box, andererBox, eigeneKlasse, andereKlasse) {
  const warOffen = box.classList.contains('offen');
  box.classList.toggle('offen', !warOffen);
  andererBox.classList.remove('offen');
  registerTabs.classList.toggle(eigeneKlasse, !warOffen);
  registerTabs.classList.remove(andereKlasse);
}

// Kapitelregister links: Plan/Graph, Leerzeile, "Alle", dann 01–18.
// 01 springt zurück in die Hauptgeschichte statt in einen Kapitel-Zoom.
function baueKapitelRegister() {
  // Lokal, gehen als Rückgabewert hinaus; gehalten werden sie in sketch.js.
  let modusZeile = document.createElement('div');
  modusZeile.className = 'kapitel-register-modus-zeile';

  let planEintrag = document.createElement('button');
  planEintrag.type = 'button';
  planEintrag.className = 'kapitel-register-modus-item';
  planEintrag.textContent = 'Plan';
  planEintrag.addEventListener('click', () => setzeKapitelAnsichtModus('karte'));
  modusZeile.appendChild(planEintrag);

  let graphEintrag = document.createElement('button');
  graphEintrag.type = 'button';
  graphEintrag.className = 'kapitel-register-modus-item';
  graphEintrag.textContent = 'Graph';
  graphEintrag.addEventListener('click', () => setzeKapitelAnsichtModus('grafik'));
  modusZeile.appendChild(graphEintrag);

  kapitelRegister.appendChild(modusZeile);

  let leerzeile = document.createElement('div');
  leerzeile.className = 'kapitel-register-leerzeile';
  kapitelRegister.appendChild(leerzeile);

  let alleEintrag = document.createElement('button');
  alleEintrag.type = 'button';
  alleEintrag.className = 'kapitel-register-item';
  alleEintrag.textContent = 'Alle';
  alleEintrag.addEventListener('click', springeZurUebersicht);
  kapitelRegister.appendChild(alleEintrag);

  let alleNummern = ['01', '03', ...WEITERE_KAPITEL_NUMMERN].sort();

  alleNummern.forEach(nr => {
    let eintrag = document.createElement('button');
    eintrag.type = 'button';
    eintrag.className = 'kapitel-register-item';
    eintrag.textContent = 'Kapitel ' + parseInt(nr, 10);
    eintrag.addEventListener('click', nr === '01' ? scrolleZuKapitel1 : () => springeZuKapitelZoom(nr));
    kapitelRegister.appendChild(eintrag);
    // Wird nur befüllt, nie neu zugewiesen — die Referenz bleibt stabil.
    kapitelRegisterEintraege[nr] = eintrag;
  });

  return { modusZeile, planEintrag, graphEintrag, leerzeile, alleEintrag };
}

// Legende rechts, aus KREIS_KATEGORIEN gebaut statt hart codiert, damit sie
// nie von den echten Kreisfarben abweicht.
function baueLegende() {
  let titel = document.createElement('div');
  titel.className = 'legende-titel';
  titel.textContent = 'Legende';
  legendeInhalt.appendChild(titel);

  KREIS_KATEGORIEN.forEach(k => {
    let zeile = document.createElement('div');
    zeile.className = 'legende-zeile';

    let kreis = document.createElement('span');
    kreis.className = 'legende-kreis';
    kreis.style.setProperty('--legende-farbe', `rgb(${k.farbe.join(', ')})`);
    zeile.appendChild(kreis);

    let label = document.createElement('span');
    label.className = 'legende-label';
    label.textContent = CATEGORY_LABELS[k.key] || k.key;
    zeile.appendChild(label);

    legendeInhalt.appendChild(zeile);
  });

  let hinweisSchraffur = document.createElement('p');
  hinweisSchraffur.className = 'legende-hinweis';
  hinweisSchraffur.textContent = 'Schraffur: alle Erwähnungen der Kategorie (auch neutral/unbewertet). Kreisgrösse = Anzahl.';
  legendeInhalt.appendChild(hinweisSchraffur);

  let valenzZeile = document.createElement('div');
  valenzZeile.className = 'legende-valenz';

  let valenzKreis = document.createElement('span');
  valenzKreis.className = 'legende-valenz-kreis';
  let beispielFarbe = KREIS_KATEGORIEN.find(k => k.key === 'gold_mittel') || KREIS_KATEGORIEN[0];
  valenzKreis.style.setProperty('--legende-farbe', `rgb(${beispielFarbe.farbe.join(', ')})`);
  valenzZeile.appendChild(valenzKreis);

  let valenzText = document.createElement('span');
  valenzText.className = 'legende-valenz-text';
  valenzText.textContent = LEGENDE_VALENZ_OBEN_UNTEN;
  valenzZeile.appendChild(valenzText);
      // Gehen als Rückgabewert hinaus; draw() setzt die Legende jeden Frame.
      legendeValenzText = valenzText;
      legendeValenzKreis = valenzKreis;

  legendeInhalt.appendChild(valenzZeile);

  // Die Zeile zum neutralen Vollkreis entfällt ganz, wenn dieser gar nicht
  // gezeichnet wird (siehe ZEIGE_NEUTRALE_WERTE in kreisgrafik.js) — eine
  // Legende soll nichts erklären, was im Bild nicht vorkommt.
  if (ZEIGE_NEUTRALE_WERTE) {
    let neutralZeile = document.createElement('div');
    neutralZeile.className = 'legende-valenz legende-valenz-mehr';

    let neutralKreis = document.createElement('span');
    neutralKreis.className = 'legende-valenz-kreis-voll';
    neutralKreis.style.setProperty('--legende-farbe', `rgb(${beispielFarbe.farbe.join(', ')})`);
    neutralZeile.appendChild(neutralKreis);

    let neutralText = document.createElement('span');
    neutralText.className = 'legende-valenz-text';
    neutralText.textContent = 'Ganzer Kreis: neutral bewertet';
    neutralZeile.appendChild(neutralText);

    legendeInhalt.appendChild(neutralZeile);
  }

  let fwertTitel = document.createElement('div');
  fwertTitel.className = 'legende-fwert-titel';
  fwertTitel.textContent = 'F-Wert';
  legendeInhalt.appendChild(fwertTitel);

  // Reihenfolge = Grösse 1..3, siehe FWERT_PUNKTGROESSE.
  [
    { groesse: 1, text: 'Raum löst Emotion aus' },
    { groesse: 2, text: 'Emotion färbt Raum' },
    { groesse: 3, text: 'Körper als Sensor' },
  ].forEach(({ groesse, text }) => {
    let zeile = document.createElement('div');
    zeile.className = 'legende-fwert-zeile';

    let punkt = document.createElement('span');
    punkt.className = 'legende-fwert-punkt';
    let d = FWERT_PUNKT_DURCHMESSER[groesse];
    punkt.style.width = d + 'px';
    punkt.style.height = d + 'px';
    punkt.style.backgroundColor = FWERT_PUNKT_FARBE;
    zeile.appendChild(punkt);

    let label = document.createElement('span');
    label.className = 'legende-label';
    label.textContent = text;
    zeile.appendChild(label);

    legendeInhalt.appendChild(zeile);
  });

  let fwertHinweis = document.createElement('p');
  fwertHinweis.className = 'legende-hinweis';
  fwertHinweis.textContent = LEGENDE_FWERT_OBEN_UNTEN;
  legendeInhalt.appendChild(fwertHinweis);

  // Drei Handles hinaus; alle drei wechseln mit der Ansicht.
  return {
    legendeValenzText: valenzText,
    legendeValenzKreis: valenzKreis,
    legendeFwertHinweis: fwertHinweis,
  };
}

function baueKartenMarkierungen() {
  stationenData.markierungen.filter(m => !m.deaktiviert).forEach(m => {
    let wrap = document.createElement('div');
    wrap.className = 'karten-markierung';
    let dot = document.createElement('div');
    dot.className = 'ortspunkt';
    let label = document.createElement('div');
    label.className = 'label';
    label.textContent = m.ort;
    wrap.appendChild(dot);
    wrap.appendChild(label);
    kartenMarkierungenEl.appendChild(wrap);
    markierungsEintraege.push({ el: wrap, lon: m.lon, lat: m.lat, revealIndex: m.revealIndex });
  });
}

function baueStationsMarker() {
  stationenData.route.forEach((station, i) => {
    if (i === 0) return;
    if (station.deaktiviert) return;
    let wrap = document.createElement('div');
    wrap.className = 'karten-markierung stations-marker';
    let dot = document.createElement('div');
    dot.className = 'ortspunkt';
    let label = document.createElement('div');
    label.className = 'label';
    label.textContent = station.ort;
    wrap.appendChild(dot);
    wrap.appendChild(label);
    kartenMarkierungenEl.appendChild(wrap);
    stationsMarker.push({ el: wrap, lon: station.lon, lat: station.lat, revealIndex: station.revealIndex });
  });
}

function baueZwischenMarker() {
  (stationenData.zwischenPunkte || []).filter(z => !z.deaktiviert).forEach(z => {
    let wrap = document.createElement('div');
    wrap.className = 'karten-markierung zwischen-marker';
    let dot = document.createElement('div');
    dot.className = 'ortspunkt';
    let label = document.createElement('div');
    label.className = 'label';
    label.textContent = z.name;
    wrap.appendChild(dot);
    wrap.appendChild(label);
    kartenMarkierungenEl.appendChild(wrap);
    zwischenMarker.push({ el: wrap, lon: z.lon, lat: z.lat, revealIndex: z.revealIndex });
  });
}
