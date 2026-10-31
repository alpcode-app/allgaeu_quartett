// Allgäu Quartett – Web-Ansicht der Karten (statisch, läuft auf GitHub Pages)

const FARBEN = {
  A: "#164eaa", B: "#00787d", C: "#24783c", D: "#693ca0",
  E: "#c85f14", F: "#af2332", G: "#465569", H: "#962873",
};
const PISTENFARBE = { leicht: "var(--leicht)", mittel: "var(--mittel)", schwer: "var(--schwer)", Skiroute: "var(--route)", "ohne Angabe": "#8895aa" };

let _daten;
async function daten() {
  if (!_daten) _daten = fetch("data/karten.json").then((r) => r.json());
  return _daten;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function zahl(v, einheit) {
  const t = Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
  return einheit ? `${t} ${einheit}` : t;
}

// --- Übersicht --------------------------------------------------------------
async function uebersicht() {
  const d = await daten();
  const liste = document.getElementById("liste");
  const suche = document.getElementById("suche");
  function zeichne() {
    const q = suche.value.trim().toLowerCase();
    const gruppen = {};
    for (const k of d.karten) {
      if (q && !(`${k.name} ${k.ort} ${k.id}`.toLowerCase().includes(q))) continue;
      (gruppen[k.gruppe] ||= []).push(k);
    }
    liste.innerHTML = Object.entries(gruppen).map(([g, ks]) => `
      <section class="gruppe">
        <h2><span class="abz" style="background:${FARBEN[g]}">${g}</span>${esc(ks[0].gruppenname)}</h2>
        <div class="raster">
          ${ks.map((k) => `<a href="karte.html?id=${k.id}" title="${esc(k.name)}"><img src="${k.bild}" alt="${esc(k.name)}" loading="lazy"></a>`).join("")}
        </div>
      </section>`).join("") || "<p>Nichts gefunden.</p>";
  }
  suche.addEventListener("input", zeichne);
  zeichne();
}

// --- Wetter (Open-Meteo) ----------------------------------------------------
const WMO = {
  0: ["☀️", "klar"], 1: ["🌤️", "überwiegend klar"], 2: ["⛅", "teils bewölkt"], 3: ["☁️", "bedeckt"],
  45: ["🌫️", "Nebel"], 48: ["🌫️", "Reifnebel"], 51: ["🌦️", "leichter Niesel"], 53: ["🌦️", "Niesel"], 55: ["🌧️", "starker Niesel"],
  56: ["🌧️", "gefrierender Niesel"], 57: ["🌧️", "gefrierender Niesel"], 61: ["🌧️", "leichter Regen"], 63: ["🌧️", "Regen"],
  65: ["🌧️", "starker Regen"], 66: ["🌧️", "gefrierender Regen"], 67: ["🌧️", "gefrierender Regen"], 71: ["🌨️", "leichter Schneefall"],
  73: ["🌨️", "Schneefall"], 75: ["❄️", "starker Schneefall"], 77: ["🌨️", "Schneegriesel"], 80: ["🌦️", "Regenschauer"],
  81: ["🌧️", "Regenschauer"], 82: ["⛈️", "heftige Schauer"], 85: ["🌨️", "Schneeschauer"], 86: ["❄️", "starke Schneeschauer"],
  95: ["⛈️", "Gewitter"], 96: ["⛈️", "Gewitter mit Hagel"], 99: ["⛈️", "Gewitter mit Hagel"],
};
const wmo = (c) => WMO[c] || ["❔", "–"];

async function wetterAbfragen(k, hoehe) {
  const p = new URLSearchParams({
    latitude: k.lat, longitude: k.lon, elevation: hoehe, timezone: "Europe/Berlin", forecast_days: 3,
    current: "temperature_2m,weather_code,wind_speed_10m,snowfall",
    hourly: "snow_depth",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum",
  });
  const r = await fetch(`/wetter?${p}`);
  if (!r.ok) throw new Error(r.status);
  const j = await r.json();
  const jetzt = j.current.time.slice(0, 13);
  const i = Math.max(0, j.hourly.time.findIndex((t) => t.startsWith(jetzt)));
  return { ...j, schnee: j.hourly.snow_depth[i] };
}

async function wetter(k) {
  const box = document.getElementById("wetter");
  try {
    const [oben, unten] = await Promise.all([wetterAbfragen(k, k.gipfel), wetterAbfragen(k, k.tal)]);
    const ort = (titel, h, w) => {
      const [icon, text] = wmo(w.current.weather_code);
      const schnee = w.schnee == null ? "–" : `${Math.round(w.schnee * 100)} cm`;
      return `<div class="ort">
        <div class="klein">${titel} · ${h} m</div>
        <div><span class="icon">${icon}</span> <span class="temp">${Math.round(w.current.temperature_2m)}°</span></div>
        <div>${text}</div>
        <div class="klein">Wind ${Math.round(w.current.wind_speed_10m)} km/h · Schnee ${schnee}</div>
      </div>`;
    };
    const tage = oben.daily.time.map((t, i) => {
      const tag = i === 0 ? "Heute" : new Date(t).toLocaleDateString("de-DE", { weekday: "short" });
      const neu = oben.daily.snowfall_sum[i];
      return `<div><div>${tag}</div><div class="icon">${wmo(oben.daily.weather_code[i])[0]}</div>
        <div>${Math.round(oben.daily.temperature_2m_min[i])}° / ${Math.round(oben.daily.temperature_2m_max[i])}°</div>
        <div class="klein">${neu > 0 ? `❄ ${zahl(Math.round(neu * 10) / 10, "cm")}` : "kein Neuschnee"}</div></div>`;
    }).join("");
    box.innerHTML = `<h2>Wetter jetzt</h2><div class="wetter">${ort("Berg", k.gipfel, oben)}${ort("Tal", k.tal, unten)}</div>
      <div class="tage">${tage}</div>
      <p class="klein" style="margin:10px 0 0;color:var(--leise)">Modellwerte von Open-Meteo, keine Messung vor Ort. Vor dem Skitag den Schnee- und Liftbericht der Bergbahn prüfen.</p>`;
  } catch (e) {
    box.innerHTML = `<h2>Wetter jetzt</h2><p class="fehler">Wetter konnte gerade nicht geladen werden.</p>`;
  }
}

// --- Detailseite ------------------------------------------------------------
async function detail() {
  const d = await daten();
  const id = (new URLSearchParams(location.search).get("id") || location.hash.slice(1) || "A1").toUpperCase();
  const idx = Math.max(0, d.karten.findIndex((k) => k.id === id));
  const k = d.karten[idx];
  const farbe = FARBEN[k.gruppe];
  document.title = `${k.name} · Allgäu Quartett`;

  const werte = d.kategorien.map((kat, i) => {
    const alle = d.karten.map((x) => x.werte[i]);
    const max = Math.max(...alle);
    const platz = 1 + alle.filter((v) => v > k.werte[i]).length;
    return `<div class="wert ${k.werte[i] === max ? "best" : ""}">
      <span class="n">${esc(kat.name)}</span><span class="v">${zahl(k.werte[i], kat.einheit)}</span>
      <span class="balken"><span style="width:${Math.max(2, (100 * k.werte[i]) / max)}%;background:${farbe}"></span></span>
      <span class="platz">Platz ${platz} von ${alle.length}</span></div>`;
  }).join("");

  const summe = Object.values(k.pisten_osm).reduce((a, b) => a + b, 0);
  const pisten = summe ? `
    <div class="pistenbalken">${Object.entries(k.pisten_osm).map(([s, v]) =>
      `<span title="${s}" style="width:${(100 * v) / summe}%;background:${PISTENFARBE[s]}"></span>`).join("")}</div>
    <div class="legende">${Object.entries(k.pisten_osm).map(([s, v]) =>
      `<span><i style="background:${PISTENFARBE[s]}"></i>${s} ${zahl(v, "km")}</span>`).join("")}</div>
    <p class="klein" style="color:var(--leise);font-size:.82rem">Länge der in OpenStreetMap eingezeichneten Pistenlinien.</p>`
    : `<p>In OpenStreetMap sind hier keine Pisten eingezeichnet.</p>`;

  const lifte = k.lifte.length ? `<ul class="lifte">${k.lifte.map((l) =>
    `<li>${esc(l.name)} <span class="typ">· ${esc(l.typ)}${l.stillgelegt ? " · stillgelegt" : ""}</span></li>`).join("")}</ul>`
    : "<p>Keine Lifte eingetragen.</p>";

  const vor = d.karten[(idx + 1) % d.karten.length], zur = d.karten[(idx - 1 + d.karten.length) % d.karten.length];
  const such = encodeURIComponent(`${k.name} ${k.ort} Skigebiet`);

  document.getElementById("inhalt").innerHTML = `
    <div class="titel">
      <div><h1>${esc(k.name)}</h1><div class="ort">${esc(k.ort)} · Allgäuer Alpen</div></div>
      <span class="abz" style="background:${farbe}">${k.id}</span>
    </div>

    <div class="modell">
      <model-viewer id="mv" src="${k.modell}" poster="karten/${k.id}_3d.webp" alt="3D-Gelände ${esc(k.name)}"
        camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="1500" rotation-per-second="12deg"
        camera-orbit="35deg 62deg auto" min-camera-orbit="auto 15deg auto" max-camera-orbit="auto 88deg auto"
        interaction-prompt="none" shadow-intensity="0.6" exposure="1.05" environment-image="neutral" ar ar-modes="webxr scene-viewer quick-look">
        <div class="lade" slot="progress-bar"><span id="lade"></span></div>
      </model-viewer>
      <div class="hinweis">Wischen zum Drehen · zwei Finger zum Zoomen</div>
      <div class="knoepfe">
        <button class="knopf" id="dreh">⏸ Drehen</button>
        <button class="knopf" id="reset">⟲ Ansicht</button>
      </div>
    </div>

    <div class="box"><p class="highlight" style="margin:0">${esc(k.highlight)}</p></div>

    <div class="raster2">
      <div class="box"><h2>Kartenwerte</h2>${werte}</div>
      <div class="box" id="wetter"><h2>Wetter jetzt</h2><p>Wird geladen …</p></div>
    </div>

    <div class="raster2">
      <div class="box"><h2>Lifte (${k.lifte.length})</h2>${lifte}</div>
      <div class="box"><h2>Pisten nach Schwierigkeit</h2>${pisten}
        <h2 style="margin-top:16px">Höhenlage</h2>
        <p style="margin:0">Skigebiet ${k.tal}–${k.gipfel} m · Geländeausschnitt ${k.gelaende[0]}–${k.gelaende[1]} m</p>
      </div>
    </div>

    <div class="box"><h2>Die Karte</h2><img id="bild" class="kartenbild" src="${k.bild}" alt="Quartettkarte ${esc(k.name)}"></div>

    <div class="box"><h2>Mehr</h2>
      <p style="margin:0">
        <a href="https://www.openstreetmap.org/?mlat=${k.lat}&mlon=${k.lon}#map=14/${k.lat}/${k.lon}" target="_blank" rel="noopener">Pistenkarte (OpenStreetMap)</a> ·
        <a href="https://www.google.com/maps/dir/?api=1&destination=${k.lat},${k.lon}" target="_blank" rel="noopener">Anfahrt</a> ·
        <a href="https://duckduckgo.com/?q=${such}" target="_blank" rel="noopener">Bergbahn &amp; Liftstatus suchen</a> ·
        <a href="${k.modell}" download>3D-Modell (.glb) laden</a>
      </p>
    </div>

    <nav class="nav">
      <a href="karte.html?id=${zur.id}">← ${esc(zur.name)}</a>
      <a href="karte.html?id=${vor.id}">${esc(vor.name)} →</a>
    </nav>`;

  const mv = document.getElementById("mv");
  mv.addEventListener("progress", (e) => {
    const lade = document.getElementById("lade");
    lade.style.width = `${e.detail.totalProgress * 100}%`;
    lade.parentElement.style.opacity = e.detail.totalProgress >= 1 ? "0" : "1";
  });
  const dreh = document.getElementById("dreh");
  dreh.onclick = () => {
    mv.autoRotate = !mv.autoRotate;
    dreh.textContent = mv.autoRotate ? "⏸ Drehen" : "▶ Drehen";
  };
  document.getElementById("reset").onclick = () => { mv.cameraOrbit = "35deg 62deg auto"; mv.fieldOfView = "auto"; mv.jumpCameraToGoal(); };
  const bild = document.getElementById("bild");
  bild.onclick = () => bild.classList.toggle("gross");
  wetter(k);
}
