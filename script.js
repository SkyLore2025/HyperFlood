const locationForm = document.getElementById("locationForm");
const locationInput = document.getElementById("locationInput");
const searchButton = document.getElementById("searchButton");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const searchScreen = document.getElementById("searchScreen");
const mapScreen = document.getElementById("mapScreen");
const backButton = document.getElementById("backButton");
const selectedPlaceName = document.getElementById("selectedPlaceName");
const selectedPlaceLabel = document.getElementById("selectedPlaceLabel");
const coordinatesEl = document.getElementById("coordinates");
const mapLocationForm = document.getElementById("mapLocationForm");
const mapLocationInput = document.getElementById("mapLocationInput");
const mapSearchButton = document.getElementById("mapSearchButton");
const mapSearchResults = document.getElementById("mapSearchResults");

let map = null;
let marker = null;
let reverseGeocodeRequest = 0;

function setStatus(message) {
  statusEl.textContent = message;
}

function clearResults() {
  resultsEl.innerHTML = "";
}

function formatCoordinates(lat, lon) {
  return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function searchLocation(query) {
  clearResults();
  setStatus("Searching the world map…");
  searchButton.disabled = true;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");

    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) throw new Error(`Search failed (${response.status})`);

    const results = await response.json();

    if (!results.length) {
      setStatus("No matching places found. Try a more specific name.");
      return;
    }

    renderResults(results);
    setStatus(`${results.length} place${results.length === 1 ? "" : "s"} found. Select one to continue.`);
  } catch (error) {
    console.error(error);
    setStatus("The location search could not be completed. Please try again.");
  } finally {
    searchButton.disabled = false;
  }
}

function renderResults(results) {
  results.forEach((place) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result-button";

    const main = place.display_name?.split(",")[0] || "Unknown place";
    const detail = place.display_name || "";

    button.innerHTML = `
      <span class="result-main">${escapeHtml(main)}</span>
      <span class="result-detail">${escapeHtml(detail)}</span>
    `;

    button.addEventListener("click", () => selectLocation(place));
    resultsEl.appendChild(button);
  });
}

async function searchFromMap(query) {
  mapSearchButton.disabled = true;
  mapSearchButton.textContent = "Searching…";
  mapSearchResults.innerHTML = "";
  mapSearchResults.classList.add("hidden");

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");

    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Search failed (${response.status})`);
    const results = await response.json();

    mapSearchResults.classList.remove("hidden");
    if (!results.length) {
      mapSearchResults.innerHTML = '<div class="map-search-message">No matching places found.</div>';
      return;
    }

    results.forEach((place) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-result-button";
      const main = place.display_name?.split(",")[0] || "Unknown place";
      button.innerHTML = `<strong>${escapeHtml(main)}</strong><span>${escapeHtml(place.display_name || "")}</span>`;
      button.addEventListener("click", () => {
        selectLocation(place);
        mapLocationInput.value = main;
        mapSearchResults.classList.add("hidden");
        mapSearchResults.innerHTML = "";
      });
      mapSearchResults.appendChild(button);
    });
  } catch (error) {
    console.error(error);
    mapSearchResults.classList.remove("hidden");
    mapSearchResults.innerHTML = '<div class="map-search-message">Search unavailable. Please try again.</div>';
  } finally {
    mapSearchButton.disabled = false;
    mapSearchButton.textContent = "Search";
  }
}

function selectLocation(place) {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  const label = place.display_name || "Selected location";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  showMapScreen();
  updateAnalysisPoint(lat, lon, label);
  map.setView([lat, lon], 13);
}

function showMapScreen() {
  searchScreen.classList.add("hidden");
  mapScreen.classList.remove("hidden");

  if (!map) {
    initializeMap();
  }

  setTimeout(() => map.invalidateSize(), 100);
}

function initializeMap() {
  map = L.map("map", { zoomControl: true }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // CLICK ANYWHERE ON THE MAP TO CHANGE THE ANALYSIS LOCATION.
  map.on("click", async (event) => {
    const lat = event.latlng.lat;
    const lon = event.latlng.lng;

    updateAnalysisPoint(lat, lon, "Identifying location…");
    await reverseGeocode(lat, lon);
  });
}

function updateAnalysisPoint(lat, lon, label) {
  if (!marker) {
    marker = L.marker([lat, lon], { draggable: true }).addTo(map);

    // DRAG THE MARKER TO FINE-TUNE THE ANALYSIS LOCATION.
    marker.on("dragend", async (event) => {
      const position = event.target.getLatLng();
      const newLat = position.lat;
      const newLon = position.lng;

      updateAnalysisPoint(newLat, newLon, "Identifying location…");
      await reverseGeocode(newLat, newLon);
    });
  } else {
    marker.setLatLng([lat, lon]);
  }

  const shortName = label.split(",")[0] || "Selected location";

  selectedPlaceName.textContent = shortName;
  selectedPlaceLabel.textContent = label;
  coordinatesEl.textContent =
    `Latitude ${Number(lat).toFixed(5)} · Longitude ${Number(lon).toFixed(5)}`;

  marker.bindPopup(
    `<strong>HyperFlood Analysis Point</strong><br>${escapeHtml(shortName)}<br>${formatCoordinates(lat, lon)}`
  );
}

async function reverseGeocode(lat, lon) {
  const requestId = ++reverseGeocodeRequest;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");

    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) throw new Error(`Reverse search failed (${response.status})`);

    const data = await response.json();

    // Ignore an old response if the user has already selected another point.
    if (requestId !== reverseGeocodeRequest) return;

    const label = data.display_name || "Custom map location";
    selectedPlaceName.textContent = label.split(",")[0] || "Custom map location";
    selectedPlaceLabel.textContent = label;

    marker.bindPopup(
      `<strong>HyperFlood Analysis Point</strong><br>${escapeHtml(label.split(",")[0])}<br>${formatCoordinates(lat, lon)}`
    );
  } catch (error) {
    console.error(error);

    if (requestId === reverseGeocodeRequest) {
      selectedPlaceName.textContent = "Custom map location";
      selectedPlaceLabel.textContent = "Custom map location";
    }
  }
}

locationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = locationInput.value.trim();

  if (query.length < 2) {
    setStatus("Please enter a location name.");
    return;
  }

  searchLocation(query);
});

backButton.addEventListener("click", () => {
  mapScreen.classList.add("hidden");
  searchScreen.classList.remove("hidden");
  locationInput.focus();
});

mapLocationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = mapLocationInput.value.trim();
  if (query.length >= 2) searchFromMap(query);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".map-search-wrap")) {
    mapSearchResults.classList.add("hidden");
  }
});

// ==========================================================
// v0.4 ELEVATION & TERRAIN INTELLIGENCE
// ==========================================================

const terrainStatus = document.getElementById("terrainStatus");
const elevationValue = document.getElementById("elevationValue");
const elevationRange = document.getElementById("elevationRange");
const relativeElevation = document.getElementById("relativeElevation");
const slopeValue = document.getElementById("slopeValue");
const terrainClass = document.getElementById("terrainClass");
const positionClass = document.getElementById("positionClass");
const terrainFactor = document.getElementById("terrainFactor");
const terrainReason = document.getElementById("terrainReason");

let analysisCircle = null;
let terrainRequestId = 0;

function destinationPoint(lat, lon, northMeters, eastMeters) {
  const earthRadius = 6378137;
  const dLat = northMeters / earthRadius;
  const dLon = eastMeters / (earthRadius * Math.cos(lat * Math.PI / 180));
  return {
    lat: lat + dLat * 180 / Math.PI,
    lon: lon + dLon * 180 / Math.PI
  };
}

function buildTerrainGrid(lat, lon) {
  // Nine samples across an approximately 1 km x 1 km square.
  const d = 500;
  return [
    destinationPoint(lat, lon,  d, -d), // NW
    destinationPoint(lat, lon,  d,  0), // N
    destinationPoint(lat, lon,  d,  d), // NE
    destinationPoint(lat, lon,  0, -d), // W
    destinationPoint(lat, lon,  0,  0), // CENTER
    destinationPoint(lat, lon,  0,  d), // E
    destinationPoint(lat, lon, -d, -d), // SW
    destinationPoint(lat, lon, -d,  0), // S
    destinationPoint(lat, lon, -d,  d)  // SE
  ];
}

async function fetchTerrainElevations(points) {
  const latitudes = points.map(p => p.lat.toFixed(6)).join(",");
  const longitudes = points.map(p => p.lon.toFixed(6)).join(",");
  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", latitudes);
  url.searchParams.set("longitude", longitudes);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Elevation request failed (${response.status})`);
  const data = await response.json();
  if (!Array.isArray(data.elevation) || data.elevation.length !== points.length) {
    throw new Error("Elevation service returned incomplete data.");
  }
  return data.elevation.map(Number);
}

function calculateTerrainMetrics(elevations) {
  const center = elevations[4];
  const neighbours = elevations.filter((_, i) => i !== 4);
  const neighbourAverage = neighbours.reduce((a, b) => a + b, 0) / neighbours.length;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const relief = max - min;
  const relative = center - neighbourAverage;

  // Estimate the steepest centre-to-neighbour gradient.
  const distances = [707.1, 500, 707.1, 500, 0, 500, 707.1, 500, 707.1];
  let maxSlopeDeg = 0;
  elevations.forEach((elevation, i) => {
    if (i === 4) return;
    const rise = Math.abs(elevation - center);
    const angle = Math.atan(rise / distances[i]) * 180 / Math.PI;
    maxSlopeDeg = Math.max(maxSlopeDeg, angle);
  });

  let terrain = "Mostly flat";
  if (maxSlopeDeg >= 15) terrain = "Steep";
  else if (maxSlopeDeg >= 5) terrain = "Sloping";
  else if (maxSlopeDeg >= 2) terrain = "Gentle slope";

  let position = "Near local average";
  if (relative <= -3) position = "Low-lying";
  else if (relative >= 3) position = "Locally elevated";

  // Terrain-only susceptibility indicator, deliberately conservative.
  let factor = "LOW";
  let factorClass = "low";
  let reason = "The selected point is not substantially lower than its immediate surroundings.";

  if (relative <= -5 && maxSlopeDeg < 5) {
    factor = "HIGH";
    factorClass = "high";
    reason = `The point is about ${Math.abs(relative).toFixed(1)} m below the surrounding average and the local terrain is relatively gentle, which can favour water accumulation.`;
  } else if (relative <= -3 || (relative < 0 && maxSlopeDeg < 2) || relief <= 5) {
    factor = "MODERATE";
    factorClass = "moderate";
    reason = relative < 0
      ? `The point is about ${Math.abs(relative).toFixed(1)} m below the surrounding average; terrain may contribute to local water accumulation.`
      : "The surrounding terrain has low local relief, so drainage may depend strongly on waterways, soil and built drainage.";
  }

  return { center, min, max, relief, relative, maxSlopeDeg, terrain, position, factor, factorClass, reason };
}

function renderTerrainLoading() {
  if (!terrainStatus) return;
  terrainStatus.textContent = "Analysing 9 elevation samples around this point…";
  elevationValue.textContent = "…";
  elevationRange.textContent = "…";
  relativeElevation.textContent = "…";
  slopeValue.textContent = "…";
  terrainClass.textContent = "Analysing";
  positionClass.textContent = "Analysing";
  terrainFactor.className = "terrain-factor neutral";
  terrainFactor.querySelector("strong").textContent = "ANALYSING";
  terrainReason.textContent = "Comparing the selected point with its immediate surroundings.";
}

function renderTerrain(metrics) {
  terrainStatus.textContent = "Terrain analysis complete for the local analysis zone.";
  elevationValue.textContent = `${Math.round(metrics.center)} m`;
  elevationRange.textContent = `${Math.round(metrics.min)}–${Math.round(metrics.max)} m`;
  relativeElevation.textContent = `${metrics.relative >= 0 ? "+" : ""}${metrics.relative.toFixed(1)} m`;
  slopeValue.textContent = `${metrics.maxSlopeDeg.toFixed(1)}°`;
  terrainClass.textContent = metrics.terrain;
  positionClass.textContent = metrics.position;
  terrainFactor.className = `terrain-factor ${metrics.factorClass}`;
  terrainFactor.querySelector("strong").textContent = metrics.factor;
  terrainReason.textContent = metrics.reason;
}

function renderTerrainError() {
  if (!terrainStatus) return;
  terrainStatus.textContent = "Elevation data could not be loaded for this point.";
  elevationValue.textContent = "Unavailable";
  elevationRange.textContent = "—";
  relativeElevation.textContent = "—";
  slopeValue.textContent = "—";
  terrainClass.textContent = "—";
  positionClass.textContent = "—";
  terrainFactor.className = "terrain-factor neutral";
  terrainFactor.querySelector("strong").textContent = "UNAVAILABLE";
  terrainReason.textContent = "Try another point or retry later. Other HyperFlood map features remain available.";
}

async function analyseTerrain(lat, lon) {
  if (!map || !terrainStatus) return;
  const requestId = ++terrainRequestId;

  if (!analysisCircle) {
    analysisCircle = L.circle([lat, lon], {
      radius: 500,
      color: "#1769aa",
      weight: 2,
      opacity: 0.75,
      fillColor: "#27b7d9",
      fillOpacity: 0.10,
      interactive: false
    }).addTo(map);
  } else {
    analysisCircle.setLatLng([lat, lon]);
  }

  renderTerrainLoading();

  try {
    const points = buildTerrainGrid(lat, lon);
    const elevations = await fetchTerrainElevations(points);
    if (requestId !== terrainRequestId) return;
    renderTerrain(calculateTerrainMetrics(elevations));
  } catch (error) {
    console.error("Terrain analysis error:", error);
    if (requestId === terrainRequestId) renderTerrainError();
  }
}

// Hook terrain analysis into every existing way of selecting a point without
// changing the search, click, drag or reverse-geocoding behaviour above.
const originalUpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat, lon, label) {
  originalUpdateAnalysisPoint(lat, lon, label);
  analyseTerrain(lat, lon);
};

// ==========================================================
// v5 FIXED EARLY-WARNING PLACEHOLDER BAR
// The final warning engine will replace this placeholder text.
// ==========================================================
const warningToggleButtons = document.querySelectorAll(".warning-toggle");
const warningWindowTitle = document.getElementById("warningWindowTitle");
const warningStatus = document.getElementById("warningStatus");

warningToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    warningToggleButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    const selectedWindow = button.dataset.window;
    warningWindowTitle.textContent = `${selectedWindow} outlook`;
    warningStatus.textContent = `${selectedWindow} flood early-warning output will appear here when the final rainfall, drainage, soil/runoff and surface-water layers are connected.`;
  });
});


// Tiny blink on/off control. The bar starts blinking by default.
const warningBar = document.getElementById("warningBar");
const blinkToggle = document.getElementById("blinkToggle");
if (warningBar && blinkToggle) {
  blinkToggle.addEventListener("change", () => {
    warningBar.classList.toggle("blink-enabled", blinkToggle.checked);
  });
}

// Reserved for the final flood-warning engine.
// Later call setWarningSeverity("normal" | "low" | "moderate" | "high" | "severe")
// and the complete outlook bar will change colour automatically.
function setWarningSeverity(level = "normal") {
  if (!warningBar) return;
  const levels = ["normal", "low", "moderate", "high", "severe"];
  const safeLevel = levels.includes(level) ? level : "normal";
  levels.forEach(item => warningBar.classList.remove(`severity-${item}`));
  warningBar.classList.add(`severity-${safeLevel}`);
}

// ==========================================================
// v6 NASA EARTH SYSTEM TREND DETECTIVE
// Historical monthly NASA POWER data -> annual series -> linear trend.
// ==========================================================
const trendPeriod = document.getElementById("trendPeriod");
const trendStatus = document.getElementById("trendStatus");
const trendTabs = document.querySelectorAll(".trend-tab");
const trendChart = document.getElementById("trendChart");
const trendYears = document.getElementById("trendYears");
const trendSlope = document.getElementById("trendSlope");
const trendChange = document.getElementById("trendChange");
const trendSignificance = document.getElementById("trendSignificance");
const trendFinding = document.getElementById("trendFinding");
let trendVariable = "rain";
let trendData = null;
let trendRequestId = 0;
let currentAnalysisLat = null;
let currentAnalysisLon = null;

async function fetchNasaPowerMonthly(lat, lon, yearsBack) {
  const endYear = new Date().getUTCFullYear() - 1; // use complete calendar years only
  const startYear = endYear - yearsBack + 1;
  const url = new URL("https://power.larc.nasa.gov/api/temporal/monthly/point");
  url.searchParams.set("parameters", "PRECTOTCORR,T2M");
  url.searchParams.set("community", "AG");
  url.searchParams.set("longitude", Number(lon).toFixed(5));
  url.searchParams.set("latitude", Number(lat).toFixed(5));
  url.searchParams.set("start", String(startYear));
  url.searchParams.set("end", String(endYear));
  url.searchParams.set("format", "JSON");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NASA POWER request failed (${response.status})`);
  const json = await response.json();
  const params = json?.properties?.parameter;
  if (!params?.PRECTOTCORR || !params?.T2M) throw new Error("NASA POWER returned incomplete parameters.");
  return { startYear, endYear, params };
}

function monthlyToAnnual(power) {
  const rainByYear = {}, tempByYear = {};
  for (const [key, value] of Object.entries(power.params.PRECTOTCORR)) {
    if (!/^\d{6}$/.test(key) || Number(value) < -900) continue;
    const y = key.slice(0,4); (rainByYear[y] ||= []).push(Number(value));
  }
  for (const [key, value] of Object.entries(power.params.T2M)) {
    if (!/^\d{6}$/.test(key) || Number(value) < -900) continue;
    const y = key.slice(0,4); (tempByYear[y] ||= []).push(Number(value));
  }
  const years = [];
  for (let y=power.startYear; y<=power.endYear; y++) {
    const k=String(y), r=rainByYear[k], t=tempByYear[k];
    if (r?.length===12 && t?.length===12) {
      // POWER monthly PRECTOTCORR is mm/day. Convert each monthly mean rate
      // to approximate annual total using calendar days in that month.
      const annualRain = r.reduce((sum, rate, i) => sum + rate * new Date(y, i+1, 0).getDate(), 0);
      const annualTemp = t.reduce((a,b)=>a+b,0)/12;
      years.push({year:y, rain:annualRain, temp:annualTemp});
    }
  }
  return years;
}

function logGamma(z) {
  const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.984369578019571e-6,1.5056327351493116e-7];
  if(z<0.5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
  z-=1; let x=0.9999999999998099; for(let i=0;i<c.length;i++) x+=c[i]/(z+i+1);
  const t=z+c.length-0.5; return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);
}
function betaCF(a,b,x){ let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;if(Math.abs(d)<3e-7)d=3e-7;d=1/d;let h=d;for(let m=1;m<=100;m++){let m2=2*m,aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<3e-7)d=3e-7;c=1+aa/c;if(Math.abs(c)<3e-7)c=3e-7;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<3e-7)d=3e-7;c=1+aa/c;if(Math.abs(c)<3e-7)c=3e-7;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<3e-7)break;}return h;}
function regIncompleteBeta(x,a,b){if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log(1-x));return x<(a+1)/(a+b+2)?bt*betaCF(a,b,x)/a:1-bt*betaCF(b,a,1-x)/b;}
function linearTrend(rows, key) {
  const n=rows.length, xs=rows.map(r=>r.year), ys=rows.map(r=>r[key]);
  const mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
  let sxx=0,sxy=0,syy=0; for(let i=0;i<n;i++){const dx=xs[i]-mx,dy=ys[i]-my;sxx+=dx*dx;sxy+=dx*dy;syy+=dy*dy;}
  const slope=sxy/sxx, intercept=my-slope*mx, r=sxy/Math.sqrt(sxx*syy || 1);
  const df=n-2; let p=1;
  if(df>0 && Math.abs(r)<1){const t=Math.abs(r)*Math.sqrt(df/(1-r*r));p=regIncompleteBeta(df/(df+t*t),df/2,0.5);} else if(Math.abs(r)>=1) p=0;
  return {slope,intercept,r,p,total:slope*(xs[n-1]-xs[0])};
}

function drawTrendChart(rows, key, fit) {
  if(!trendChart) return; const ctx=trendChart.getContext("2d"), dpr=window.devicePixelRatio||1;
  const w=trendChart.clientWidth||320,h=trendChart.clientHeight||180; trendChart.width=w*dpr;trendChart.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const pad={l:42,r:12,t:14,b:28}, vals=rows.map(r=>r[key]); let min=Math.min(...vals),max=Math.max(...vals); const extra=(max-min||1)*.12;min-=extra;max+=extra;
  ctx.strokeStyle="#d9e4ea";ctx.lineWidth=1;ctx.fillStyle="#607783";ctx.font="10px sans-serif";
  for(let i=0;i<4;i++){const y=pad.t+(h-pad.t-pad.b)*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();const v=max-(max-min)*i/3;ctx.fillText(key==="rain"?Math.round(v):v.toFixed(1),4,y+3);}
  const xFor=i=>pad.l+(w-pad.l-pad.r)*i/(rows.length-1||1), yFor=v=>pad.t+(max-v)/(max-min)*(h-pad.t-pad.b);
  ctx.strokeStyle="#1683a5";ctx.lineWidth=2;ctx.beginPath();rows.forEach((r,i)=>{const x=xFor(i),y=yFor(r[key]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
  ctx.strokeStyle="#d36a28";ctx.setLineDash([5,4]);ctx.beginPath();rows.forEach((r,i)=>{const v=fit.intercept+fit.slope*r.year;const x=xFor(i),y=yFor(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle="#607783";ctx.fillText(String(rows[0].year),pad.l,h-8);const last=String(rows.at(-1).year);ctx.fillText(last,w-pad.r-ctx.measureText(last).width,h-8);
}

function renderTrend() {
  if(!trendData?.length) return;
  const key=trendVariable, fit=linearTrend(trendData,key), unit=key==="rain"?"mm/year":"°C/year", changeUnit=key==="rain"?"mm":"°C";
  trendYears.textContent=`${trendData[0].year}–${trendData.at(-1).year}`;
  trendSlope.textContent=`${fit.slope>=0?"+":""}${key==="rain"?fit.slope.toFixed(1):fit.slope.toFixed(3)} ${unit}`;
  trendChange.textContent=`${fit.total>=0?"+":""}${key==="rain"?fit.total.toFixed(0):fit.total.toFixed(2)} ${changeUnit}`;
  trendSignificance.textContent=fit.p<0.05?`Significant (p=${fit.p<0.001?"<0.001":fit.p.toFixed(3)})`:`Not significant (p=${fit.p.toFixed(3)})`;
  const direction=Math.abs(fit.slope)<1e-10?"flat":fit.slope>0?"up":"down";
  trendFinding.className=`trend-finding ${direction}`;
  const variable=key==="rain"?"annual precipitation":"annual mean temperature";
  const dir=fit.slope>0?"increasing":"decreasing";
  trendFinding.querySelector("strong").textContent=`${dir.toUpperCase()} ${variable.toUpperCase()}`;
  trendFinding.querySelector("p").textContent=`NASA POWER data show a ${dir} linear trend of ${Math.abs(fit.slope).toFixed(key==="rain"?1:3)} ${unit}. Over this period, the fitted change is ${Math.abs(fit.total).toFixed(key==="rain"?0:2)} ${changeUnit}. This trend is ${fit.p<0.05?"statistically significant":"not statistically significant"} at the p < 0.05 threshold.`;
  drawTrendChart(trendData,key,fit);
}

async function analyseHistoricalTrends(lat,lon){
  if(!trendStatus)return; const requestId=++trendRequestId; currentAnalysisLat=lat;currentAnalysisLon=lon;
  trendStatus.textContent="Contacting NASA POWER and building the historical time series…";
  trendFinding.className="trend-finding neutral";trendFinding.querySelector("strong").textContent="ANALYSING NASA DATA";trendFinding.querySelector("p").textContent="Aggregating monthly observations into complete annual values and calculating a linear trend.";
  try{const raw=await fetchNasaPowerMonthly(lat,lon,Number(trendPeriod.value));if(requestId!==trendRequestId)return;trendData=monthlyToAnnual(raw);if(trendData.length<5)throw new Error("Not enough complete annual observations.");trendStatus.textContent=`NASA historical analysis complete: ${trendData.length} complete years.`;renderTrend();}
  catch(e){console.error("NASA trend analysis error:",e);if(requestId!==trendRequestId)return;trendData=null;trendStatus.textContent="NASA historical data could not be loaded for this point.";trendYears.textContent=trendSlope.textContent=trendChange.textContent=trendSignificance.textContent="—";trendFinding.className="trend-finding neutral";trendFinding.querySelector("strong").textContent="DATA UNAVAILABLE";trendFinding.querySelector("p").textContent="Try again later or select another point. Terrain analysis and the rest of HyperFlood remain available.";}
}

trendTabs.forEach(btn=>btn.addEventListener("click",()=>{trendTabs.forEach(b=>b.classList.remove("active"));btn.classList.add("active");trendVariable=btn.dataset.variable;renderTrend();}));
trendPeriod?.addEventListener("change",()=>{if(currentAnalysisLat!==null)analyseHistoricalTrends(currentAnalysisLat,currentAnalysisLon);});
window.addEventListener("resize",()=>{if(trendData)renderTrend();});

// Add the v6 historical investigation to every search, map click and marker drag.
const v6UpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat,lon,label){v6UpdateAnalysisPoint(lat,lon,label);analyseHistoricalTrends(lat,lon);};
