/* =============================================================================
   dom-aufbau.js — Aufbau der HTML-Bedienelemente

   Alles, was beim Start EINMAL an DOM-Knoten erzeugt wird: das Kapitelregister
   und die drei Marker-Ebenen der Kapitel-1-Ansicht. Hier wird nur gebaut — die
   Bildschirmposition bekommen die Knoten erst in draw().
============================================================================= */

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
