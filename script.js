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
  setRoadmapState("terrain", "loading");

  try {
    const points = buildTerrainGrid(lat, lon);
    const elevations = await fetchTerrainElevations(points);
    if (requestId !== terrainRequestId) return;
    renderTerrain(calculateTerrainMetrics(elevations));
    setRoadmapState("terrain", "done");
  } catch (error) {
    console.error("Terrain analysis error:", error);
    if (requestId === terrainRequestId) {
      renderTerrainError();
      setRoadmapState("terrain", "error");
    }
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
// LIVE ANALYSIS ROADMAP
// Each active analysis starts with a rotating loader and changes
// to a tick only after its data has actually loaded.
// ==========================================================
const roadmapItems = {
  terrain: document.getElementById("roadmapTerrain"),
  trends: document.getElementById("roadmapTrends"),
  soil: document.getElementById("roadmapSoil"),
  rivers: document.getElementById("roadmapRivers"),
  recentRain: document.getElementById("roadmapRecentRain"),
  forecast: document.getElementById("roadmapForecast"),
  integration: document.getElementById("roadmapIntegration"),
  risk: document.getElementById("roadmapRisk")
};

function setRoadmapState(key, state) {
  const item = roadmapItems[key];
  if (!item) return;
  item.classList.remove("pending", "loading", "done", "error");
  item.classList.add(state);
  const stateLabel = item.querySelector(".roadmap-state");
  if (stateLabel) {
    stateLabel.setAttribute(
      "aria-label",
      state === "done" ? "Complete" : state === "loading" ? "Loading" : state === "error" ? "Unavailable" : "Waiting"
    );
  }
  if (key !== "integration" && typeof scheduleFloodPressureIntegration === "function") scheduleFloodPressureIntegration();
}

function resetRoadmapForPoint() {
  setRoadmapState("terrain", "loading");
  setRoadmapState("trends", "loading");
  setRoadmapState("soil", "loading");
  setRoadmapState("rivers", "loading");
  setRoadmapState("recentRain", "loading");
  setRoadmapState("forecast", "loading");
  setRoadmapState("integration", "loading");
  setRoadmapState("risk", "loading");
}

// ==========================================================
// v5 FIXED EARLY-WARNING BAR — final V14 engine hooks
// ==========================================================
const warningToggleButtons = document.querySelectorAll(".warning-toggle");
const warningWindowTitle = document.getElementById("warningWindowTitle");
const warningStatus = document.getElementById("warningStatus");
const warningLevel = document.getElementById("warningLevel");
const warningBar = document.getElementById("warningBar");
const blinkToggle = document.getElementById("blinkToggle");
let selectedWarningWindow = "24 hours";

function setWarningSeverity(level = "normal") {
  if (!warningBar) return;
  const levels = ["normal", "low", "moderate", "high", "severe"];
  const safeLevel = levels.includes(level) ? level : "normal";
  levels.forEach(item => warningBar.classList.remove(`severity-${item}`));
  warningBar.classList.add(`severity-${safeLevel}`);
}

warningToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    warningToggleButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedWarningWindow = button.dataset.window;
    warningWindowTitle.textContent = `${selectedWarningWindow} outlook`;
    renderSelectedWarningWindow();
  });
});

if (warningBar && blinkToggle) {
  blinkToggle.addEventListener("change", () => {
    warningBar.classList.toggle("blink-enabled", blinkToggle.checked);
  });
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
const baselineCard = document.getElementById("baselineCard");
const baselineText = document.getElementById("baselineText");
const baselineRainSummary = document.getElementById("baselineRainSummary");
const baselineTempSummary = document.getElementById("baselineTempSummary");
const baselinePeriodSummary = document.getElementById("baselinePeriodSummary");
const historicalContextRain = document.getElementById("historicalContextRain");
const historicalContextTemp = document.getElementById("historicalContextTemp");
const historicalContextPeriod = document.getElementById("historicalContextPeriod");
const historicalContextNote = document.getElementById("historicalContextNote");
const baselineMonthLabel = document.getElementById("baselineMonthLabel");
const baselineMonthlyAverage = document.getElementById("baselineMonthlyAverage");
const baseline7DayExpected = document.getElementById("baseline7DayExpected");
const baselineRecent7Day = document.getElementById("baselineRecent7Day");
const baselineForecast7Day = document.getElementById("baselineForecast7Day");
const baselineComparison = document.getElementById("baselineComparison");
let trendVariable = "rain";
let trendData = null;
let trendMonthly = null;
let trendRequestId = 0;
let currentAnalysisLat = null;
let currentAnalysisLon = null;

async function fetchNasaPowerMonthly(lat, lon, yearsBack) {
  // v7 uses the Vercel serverless proxy at /api/power instead of calling
  // NASA POWER directly from the browser. This avoids the browser-side
  // cross-origin problem that caused the v6 DATA UNAVAILABLE message.
  const url = new URL("/api/power", window.location.origin);
  url.searchParams.set("lat", Number(lat).toFixed(5));
  url.searchParams.set("lon", Number(lon).toFixed(5));
  url.searchParams.set("years", String(yearsBack));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller.signal
    });

    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}

    if (!response.ok || !json?.ok) {
      const message = json?.error || json?.detail || text.slice(0, 250);
      throw new Error(`Historical data request failed (${response.status})${message ? `: ${message}` : ""}`);
    }

    return {
      startYear: json.startYear,
      endYear: json.endYear,
      params: {
        T2M: json.parameters?.T2M || {},
        PRECTOTCORR: json.parameters?.precipitation || {}
      },
      rainParameter: json.precipitationParameter || "PRECTOTCORR"
    };
  } finally {
    clearTimeout(timer);
  }
}

function monthlyToAnnual(power) {
  const rainByYear = {}, tempByYear = {};

  for (const [key, value] of Object.entries(power.params.PRECTOTCORR || {})) {
    if (!/^\d{6}$/.test(key) || key.slice(4) === "13" || !Number.isFinite(Number(value)) || Number(value) < -900) continue;
    const y = key.slice(0, 4);
    (rainByYear[y] ||= []).push(Number(value));
  }

  for (const [key, value] of Object.entries(power.params.T2M || {})) {
    if (!/^\d{6}$/.test(key) || key.slice(4) === "13" || !Number.isFinite(Number(value)) || Number(value) < -900) continue;
    const y = key.slice(0, 4);
    (tempByYear[y] ||= []).push(Number(value));
  }

  const years = [];
  for (let y = power.startYear; y <= power.endYear; y++) {
    const k = String(y);
    const r = rainByYear[k];
    const t = tempByYear[k];

    if (r?.length === 12 && t?.length === 12) {
      // NASA POWER monthly precipitation is expressed as a mean daily rate.
      // Convert each month's rate to an approximate monthly accumulation.
      const annualRain = r.reduce(
        (sum, rate, i) => sum + rate * new Date(y, i + 1, 0).getDate(),
        0
      );
      const annualTemp = t.reduce((a, b) => a + b, 0) / 12;
      years.push({ year: y, rain: annualRain, temp: annualTemp });
    }
  }
  return years;
}

function monthlyClimatology(power) {
  const byMonth = Array.from({ length: 12 }, () => []);
  const params = power?.params?.PRECTOTCORR || {};
  for (const [key, value] of Object.entries(params)) {
    if (!/^\d{6}$/.test(key) || key.slice(4) === "13" || !Number.isFinite(Number(value)) || Number(value) < -900) continue;
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(4, 6));
    if (month < 1 || month > 12) continue;
    const days = new Date(year, month, 0).getDate();
    byMonth[month - 1].push(Number(value) * days);
  }
  return byMonth.map((values, index) => {
    if (!values.length) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const daysInCurrentMonth = new Date(new Date().getFullYear(), index + 1, 0).getDate();
    return { month: index + 1, meanMonthly: mean, expected7d: mean * 7 / daysInCurrentMonth, years: values.length };
  });
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

function trendSummaryFor(key) {
  if (!trendData?.length || trendData.length < 5) return null;
  const fit = linearTrend(trendData, key);
  const threshold = key === "rain" ? 0.1 : 0.005;
  const direction = Math.abs(fit.slope) < threshold ? "Broadly stable" : fit.slope > 0 ? "Increasing" : "Decreasing";
  const confidence = fit.p < 0.05 ? "statistically significant" : "not statistically significant";
  const unit = key === "rain" ? "mm/year" : "°C/year";
  const slope = `${fit.slope > 0 ? "+" : ""}${key === "rain" ? fit.slope.toFixed(1) : fit.slope.toFixed(3)} ${unit}`;
  return { fit, direction, confidence, slope, period: `${trendData[0].year}–${trendData.at(-1).year}` };
}

function updateHistoricalContextUI() {
  const rain = trendSummaryFor("rain");
  const temp = trendSummaryFor("temp");
  const period = rain?.period || temp?.period || null;
  const format = item => item ? `${item.direction}${item.direction === "Broadly stable" ? "" : ` · ${item.confidence === "statistically significant" ? "significant" : "not significant"}`}` : "Awaiting NASA data";
  if (baselineRainSummary) baselineRainSummary.textContent = format(rain);
  if (baselineTempSummary) baselineTempSummary.textContent = format(temp);
  if (baselinePeriodSummary) baselinePeriodSummary.textContent = period ? `Historical window: ${period} · ${trendData.length} complete annual values · NASA POWER` : `Selected historical period: ${trendPeriod?.value || 25} years · NASA POWER`;
  if (historicalContextRain) historicalContextRain.textContent = rain ? `${format(rain)} (${rain.slope})` : "Awaiting historical analysis";
  if (historicalContextTemp) historicalContextTemp.textContent = temp ? `${format(temp)} (${temp.slope})` : "Awaiting historical analysis";
  if (historicalContextPeriod) historicalContextPeriod.textContent = period ? `NASA historical window: ${period} (${trendData.length} complete years)` : `NASA historical window: ${trendPeriod?.value || 25}-year selection; waiting for valid trend data.`;
  if (historicalContextNote) {
    if (rain && temp) {
      historicalContextNote.textContent = `Over ${period}, precipitation is ${rain.direction.toLowerCase()} and temperature is ${temp.direction.toLowerCase()}. The same NASA record also establishes a seasonal rainfall baseline for the current month. Trend significance is shown separately; neither the trend nor baseline is directly added to the short-term flood-pressure score.`;
    } else {
      historicalContextNote.textContent = "Historical trends provide long-term context alongside today's conditions and forecast rainfall. They are not directly added to the flood-pressure score.";
    }
  }
}

function updateHistoricalRainfallBaseline() {
  if (!baselineMonthLabel || !baselineMonthlyAverage || !baseline7DayExpected) return;
  const monthIndex = new Date().getMonth();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const climate = trendMonthly?.[monthIndex];
  baselineMonthLabel.textContent = monthNames[monthIndex];
  if (!climate) {
    baselineMonthlyAverage.textContent = "—";
    baseline7DayExpected.textContent = "—";
    if (baselineRecent7Day) baselineRecent7Day.textContent = "—";
    if (baselineForecast7Day) baselineForecast7Day.textContent = "—";
    if (baselineComparison) baselineComparison.textContent = "Historical monthly baseline unavailable for this period.";
    return;
  }
  baselineMonthlyAverage.textContent = `${climate.meanMonthly.toFixed(1)} mm`;
  baseline7DayExpected.textContent = `${climate.expected7d.toFixed(1)} mm`;
  const recent = metricNumber?.(rain7d) ?? null;
  const forecast = metricNumber?.(forecast7d) ?? null;
  if (baselineRecent7Day) baselineRecent7Day.textContent = recent === null ? "Waiting" : `${recent.toFixed(1)} mm`;
  if (baselineForecast7Day) baselineForecast7Day.textContent = forecast === null ? "Waiting" : `${forecast.toFixed(1)} mm`;
  if (baselineComparison) {
    if (forecast === null) {
      baselineComparison.textContent = "Waiting for the 7-day forecast to compare with the historical baseline.";
    } else {
      const ratio = forecast / Math.max(climate.expected7d, 0.1);
      let label = "near the historical baseline";
      if (ratio >= 2) label = "well above the historical baseline";
      else if (ratio >= 1.25) label = "above the historical baseline";
      else if (ratio < 0.75) label = "below the historical baseline";
      baselineComparison.textContent = `The next 7 days are ${label} for ${monthNames[monthIndex]}, based on the selected ${trendData?.length || trendPeriod?.value || 25}-year NASA window. This is contextual comparison, not an added flood-risk score.`;
    }
  }
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
  if (baselineCard && baselineText) {
    baselineCard.className = `baseline-card ${fit.slope > 0 ? "up" : fit.slope < 0 ? "down" : "neutral"}`;
    baselineText.textContent = key === "rain"
      ? `Long-term precipitation is ${dir}. This is Earth-system context only; HyperFlood does not add the trend directly to today's flood-pressure score.`
      : `Long-term temperature is ${dir}. This changes the environmental baseline but is not treated as a direct short-term flood trigger.`;
  }
  updateHistoricalContextUI();
  updateHistoricalRainfallBaseline();
  drawTrendChart(trendData,key,fit);
}

async function analyseHistoricalTrends(lat,lon){
  if(!trendStatus)return; const requestId=++trendRequestId; currentAnalysisLat=lat;currentAnalysisLon=lon;
  trendStatus.textContent="Contacting NASA POWER and building the historical time series…";trendData=null;trendMonthly=null;updateHistoricalContextUI();updateHistoricalRainfallBaseline();
  setRoadmapState("trends", "loading");
  trendFinding.className="trend-finding neutral";trendFinding.querySelector("strong").textContent="ANALYSING NASA DATA";trendFinding.querySelector("p").textContent="Aggregating monthly observations into complete annual values and calculating a linear trend.";
  try{const raw=await fetchNasaPowerMonthly(lat,lon,Number(trendPeriod.value));if(requestId!==trendRequestId)return;trendData=monthlyToAnnual(raw);trendMonthly=monthlyClimatology(raw);if(trendData.length<5)throw new Error("Not enough complete annual observations.");trendStatus.textContent=`NASA historical analysis complete: ${trendData.length} complete years.`;renderTrend();setRoadmapState("trends", "done");}
  catch(e){console.error("NASA trend analysis error:",e);if(requestId!==trendRequestId)return;trendData=null;trendStatus.textContent="NASA historical data could not be loaded for this point.";trendYears.textContent=trendSlope.textContent=trendChange.textContent=trendSignificance.textContent="—";trendFinding.className="trend-finding neutral";trendFinding.querySelector("strong").textContent="DATA UNAVAILABLE";trendFinding.querySelector("p").textContent="The NASA proxy could not return usable historical data. Terrain analysis and the rest of HyperFlood remain available.";setRoadmapState("trends", "error");}
}

trendTabs.forEach(btn=>btn.addEventListener("click",()=>{trendTabs.forEach(b=>b.classList.remove("active"));btn.classList.add("active");trendVariable=btn.dataset.variable;renderTrend();}));
trendPeriod?.addEventListener("change",()=>{if(currentAnalysisLat!==null)analyseHistoricalTrends(currentAnalysisLat,currentAnalysisLon);});
window.addEventListener("resize",()=>{if(trendData)renderTrend();});

// Add the v6 historical investigation to every search, map click and marker drag.
const v6UpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat,lon,label){v6UpdateAnalysisPoint(lat,lon,label);analyseHistoricalTrends(lat,lon);};


// ==========================================================
// v9 — SOIL & RUNOFF INTELLIGENCE
// ==========================================================
const soilStatus = document.getElementById("soilStatus");
const surfaceWetness = document.getElementById("surfaceWetness");
const rootWetness = document.getElementById("rootWetness");
const infiltrationPotential = document.getElementById("infiltrationPotential");
const runoffPotential = document.getElementById("runoffPotential");
const runoffFinding = document.getElementById("runoffFinding");
const soilBadge = document.getElementById("soilBadge");
const soilSourceNote = document.getElementById("soilSourceNote");
let soilRequestId = 0;

function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

function soilClass(value) {
  if (value >= 0.70) return "high";
  if (value >= 0.45) return "moderate";
  return "low";
}

function calculateRunoffPrototype(soil, terrainText, positionText, slopeText) {
  const wet = clamp01(soil.surfaceWetness);
  const root = clamp01(soil.rootZoneWetness);
  const slope = Number.parseFloat(String(slopeText).replace("°", ""));

  // Wet soil increases runoff pressure because less additional rainfall can
  // be absorbed. This is intentionally a transparent heuristic, not a
  // calibrated hydrological model or flood probability.
  const wetnessPressure = wet * 55 + root * 20;
  const rainPressure = Math.min(20, Math.max(0, soil.precipitationApproxMm / 150 * 20));
  const lowlandPressure = /low-lying/i.test(positionText) ? 18 : /near local average/i.test(positionText) ? 7 : 0;
  const slopeDrainage = Number.isFinite(slope) ? Math.min(12, slope * 0.9) : 3;

  // Higher slope can move water away from the selected point, so it reduces
  // local accumulation pressure rather than simply increasing runoff risk.
  const drainageRelief = Math.min(10, slopeDrainage);
  const score = Math.max(0, Math.min(100, wetnessPressure + rainPressure + lowlandPressure - drainageRelief));

  let runoff = "LOW";
  let cls = "low";
  if (score >= 62) { runoff = "HIGH"; cls = "high"; }
  else if (score >= 38) { runoff = "MODERATE"; cls = "moderate"; }

  const infiltration = wet >= 0.75 ? "LOW" : wet >= 0.50 ? "MODERATE" : "HIGH";
  return { score, runoff, cls, infiltration };
}

function renderSoilLoading() {
  soilStatus.textContent = "Contacting NASA POWER for soil wetness data…";
  surfaceWetness.textContent = rootWetness.textContent = infiltrationPotential.textContent = runoffPotential.textContent = "…";
  soilBadge.className = "soil-badge neutral";
  soilBadge.textContent = "ANALYSING";
  runoffFinding.className = "runoff-finding neutral";
  runoffFinding.querySelector("strong").textContent = "ANALYSING SOIL PRESSURE";
  runoffFinding.querySelector("p").textContent = "Combining NASA soil wetness with the local terrain layer.";
}

function renderSoil(soil) {
  surfaceWetness.textContent = `${(soil.surfaceWetness * 100).toFixed(0)}%`;
  rootWetness.textContent = `${(soil.rootZoneWetness * 100).toFixed(0)}%`;
  const result = calculateRunoffPrototype(
    soil,
    terrainClass?.textContent || "",
    positionClass?.textContent || "",
    slopeValue?.textContent || ""
  );
  infiltrationPotential.textContent = result.infiltration;
  runoffPotential.textContent = result.runoff;
  soilBadge.className = `soil-badge ${result.cls}`;
  soilBadge.textContent = `${result.runoff} PRESSURE`;
  runoffFinding.className = `runoff-finding ${result.cls}`;
  runoffFinding.querySelector("strong").textContent = `${result.runoff} RUNOFF POTENTIAL`;

  const terrainPart = positionClass?.textContent === "Low-lying"
    ? " The point is locally low-lying, which can favour accumulation."
    : "";
  const slopePart = Number.parseFloat(String(slopeValue?.textContent || "")) >= 5
    ? " Local slope may help drain water away from the point."
    : " Local terrain is relatively gentle, so drainage may depend more on soil and waterways.";
  runoffFinding.querySelector("p").textContent =
    `NASA surface wetness is ${(soil.surfaceWetness * 100).toFixed(0)}% and root-zone wetness is ${(soil.rootZoneWetness * 100).toFixed(0)}%.${terrainPart}${slopePart} This derived index is an exploratory runoff-pressure signal, not a flood probability.`;
  soilStatus.textContent = `NASA POWER soil/runoff inputs available for ${soil.period}.`;
  soilSourceNote.textContent = `NASA POWER: surface soil wetness (0–5 cm) and root-zone wetness, with precipitation for ${soil.period}. Approx. monthly precipitation: ${soil.precipitationApproxMm.toFixed(0)} mm. Infiltration/runoff labels are derived by HyperFlood and are not direct NASA measurements.`;
}

function renderSoilError(error) {
  console.error("Soil/runoff analysis error:", error);
  soilStatus.textContent = "NASA soil wetness data could not be loaded for this point.";
  surfaceWetness.textContent = rootWetness.textContent = infiltrationPotential.textContent = runoffPotential.textContent = "—";
  soilBadge.className = "soil-badge neutral";
  soilBadge.textContent = "UNAVAILABLE";
  runoffFinding.className = "runoff-finding neutral";
  runoffFinding.querySelector("strong").textContent = "DATA UNAVAILABLE";
  runoffFinding.querySelector("p").textContent = "Terrain analysis and the NASA historical trend layer remain available. Try again later.";
}

async function fetchNasaSoil(lat, lon) {
  const url = new URL("/api/power", window.location.origin);
  url.searchParams.set("mode", "soil");
  url.searchParams.set("lat", Number(lat).toFixed(5));
  url.searchParams.set("lon", Number(lon).toFixed(5));
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || text.slice(0,250));
  return data;
}

async function analyseSoilRunoff(lat, lon) {
  const requestId = ++soilRequestId;
  renderSoilLoading();
  setRoadmapState("soil", "loading");
  try {
    const soil = await fetchNasaSoil(lat, lon);
    if (requestId !== soilRequestId) return;
    renderSoil(soil);
    setRoadmapState("soil", "done");
  } catch (error) {
    if (requestId === soilRequestId) {
      renderSoilError(error);
      setRoadmapState("soil", "error");
    }
  }
}

// Hook v9 after the v6 update wrapper so every search, click and marker drag
// refreshes the soil/runoff intelligence as well.
const v9UpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat, lon, label) {
  resetRoadmapForPoint();
  v9UpdateAnalysisPoint(lat, lon, label);
  analyseSoilRunoff(lat, lon);
};


// ==========================================================
// V10 RIVERS & DRAINAGE INTELLIGENCE
// Mapped waterway geometry comes from OpenStreetMap via our Vercel proxy.
// HyperFlood derives proximity context; this is not a hydraulic model.
// ==========================================================
const drainageStatus = document.getElementById("drainageStatus");
const drainageBadge = document.getElementById("drainageBadge");
const nearestWaterway = document.getElementById("nearestWaterway");
const waterwayDistance = document.getElementById("waterwayDistance");
const waterwayType = document.getElementById("waterwayType");
const waterwayCount = document.getElementById("waterwayCount");
const drainageFinding = document.getElementById("drainageFinding");
let drainageRequestId = 0;
let waterwayLayer = null;

function renderDrainageLoading() {
  if (!drainageStatus) return;
  drainageStatus.textContent = "Scanning mapped rivers and drainage channels within 5 km…";
  drainageBadge.className = "soil-badge neutral";
  drainageBadge.textContent = "LOADING";
  nearestWaterway.textContent = waterwayDistance.textContent = waterwayType.textContent = waterwayCount.textContent = "…";
  drainageFinding.className = "runoff-finding neutral";
  drainageFinding.querySelector("strong").textContent = "ANALYSING DRAINAGE";
  drainageFinding.querySelector("p").textContent = "Finding the nearest mapped river, stream, canal or drain and measuring its proximity to the selected point.";
}

function drainageClass(distanceM, found) {
  if (!found) return {label:"NO MAPPED WATERWAY", cls:"neutral", text:"No mapped river or drainage channel was returned within 5 km. This does not prove that no local drain exists."};
  if (distanceM <= 250) return {label:"VERY CLOSE", cls:"high", text:"A mapped waterway is very close to the selected point. Proximity can matter during high flow, but does not by itself indicate flood risk."};
  if (distanceM <= 750) return {label:"NEARBY", cls:"moderate", text:"A mapped waterway is nearby. Terrain, rainfall, channel capacity and flow direction determine whether that proximity increases flood exposure."};
  if (distanceM <= 2000) return {label:"MODERATE DISTANCE", cls:"low", text:"The nearest mapped waterway is within the wider local area. Its flood relevance depends on terrain and hydrologic connectivity."};
  return {label:"DISTANT", cls:"low", text:"The nearest mapped waterway found is relatively distant from the selected point within this 5 km scan."};
}

function clearWaterwayLayer() {
  if (waterwayLayer && map) { map.removeLayer(waterwayLayer); waterwayLayer = null; }
}

function renderDrainage(data) {
  clearWaterwayLayer();
  const n = data.nearest;
  const info = drainageClass(n?.distanceM ?? Infinity, !!n);
  nearestWaterway.textContent = n?.name || (n ? "Unnamed mapped waterway" : "None within 5 km");
  waterwayDistance.textContent = n ? (n.distanceM < 1000 ? `${Math.round(n.distanceM)} m` : `${(n.distanceM/1000).toFixed(2)} km`) : "> 5 km / unavailable";
  waterwayType.textContent = n?.type ? n.type.replaceAll("_", " ") : "—";
  waterwayCount.textContent = String(data.count ?? 0);
  drainageBadge.className = `soil-badge ${info.cls}`;
  drainageBadge.textContent = info.label;
  drainageFinding.className = `runoff-finding ${info.cls}`;
  drainageFinding.querySelector("strong").textContent = n ? `${info.label} WATERWAY PROXIMITY` : "NO MAPPED WATERWAY FOUND";
  drainageFinding.querySelector("p").textContent = info.text;
  drainageStatus.textContent = `Waterway scan complete for a 5 km radius. ${data.count || 0} mapped features returned.`;

  if (map && Array.isArray(data.features) && data.features.length) {
    waterwayLayer = L.layerGroup();
    data.features.forEach(f => {
      if (!Array.isArray(f.geometry) || f.geometry.length < 2) return;
      const line = L.polyline(f.geometry.map(p => [p.lat,p.lon]), {weight: 3, opacity: .7});
      line.bindTooltip(`${f.name || "Unnamed"} · ${(f.type || "waterway").replaceAll("_"," ")}`);
      waterwayLayer.addLayer(line);
    });
    waterwayLayer.addTo(map);
  }
}

function renderDrainageError(error) {
  console.error("Drainage analysis error:", error);
  clearWaterwayLayer();
  drainageStatus.textContent = "Mapped river/drainage data could not be loaded for this point.";
  drainageBadge.className = "soil-badge neutral";
  drainageBadge.textContent = "UNAVAILABLE";
  nearestWaterway.textContent = waterwayDistance.textContent = waterwayType.textContent = waterwayCount.textContent = "—";
  drainageFinding.className = "runoff-finding neutral";
  drainageFinding.querySelector("strong").textContent = "DATA UNAVAILABLE";
  drainageFinding.querySelector("p").textContent = "The other HyperFlood analyses remain available. Try this location again later.";
}

async function analyseRiversDrainage(lat, lon) {
  const requestId = ++drainageRequestId;
  renderDrainageLoading();
  setRoadmapState("rivers", "loading");
  try {
    const url = new URL("/api/waterways", window.location.origin);
    url.searchParams.set("lat", Number(lat).toFixed(5));
    url.searchParams.set("lon", Number(lon).toFixed(5));
    const response = await fetch(url, {headers:{Accept:"application/json"}, cache:"no-store"});
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Waterway service unavailable");
    if (requestId !== drainageRequestId) return;
    renderDrainage(data);
    setRoadmapState("rivers", "done");
  } catch (error) {
    if (requestId !== drainageRequestId) return;
    renderDrainageError(error);
    setRoadmapState("rivers", "error");
  }
}

// V10 wraps the stable V9 point-update flow. Existing terrain, trends and soil
// analyses are untouched; drainage is added as a fourth independent analysis.
const v10BaseUpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat, lon, label) {
  v10BaseUpdateAnalysisPoint(lat, lon, label);
  analyseRiversDrainage(lat, lon);
};

// V9 compact Analysis Roadmap accordion.
// Only one layer can be expanded at a time; analysis/loading continues in the background.
(function setupRoadmapAccordion() {
  const items = Array.from(document.querySelectorAll('.roadmap-accordion-item'));
  if (!items.length) return;

  function closeItem(item) {
    item.classList.remove('open');
    const button = item.querySelector(':scope > .roadmap-toggle');
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function openItem(item) {
    items.forEach(other => { if (other !== item) closeItem(other); });
    item.classList.add('open');
    const button = item.querySelector(':scope > .roadmap-toggle');
    if (button) button.setAttribute('aria-expanded', 'true');
  }

  items.forEach(item => {
    const button = item.querySelector(':scope > .roadmap-toggle');
    if (!button) return;
    button.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      items.forEach(closeItem);
      if (!wasOpen) openItem(item);
    });
  });
})();


// ==========================================================
// V11 RECENT PRECIPITATION — NASA POWER Daily API
// Added as an independent fifth analysis; V10 layers are unchanged.
// ==========================================================
const recentRainBadge = document.getElementById("recentRainBadge");
const recentRainStatus = document.getElementById("recentRainStatus");
const rain1d = document.getElementById("rain1d");
const rain3d = document.getElementById("rain3d");
const rain7d = document.getElementById("rain7d");
const rainWetDays = document.getElementById("rainWetDays");
const recentRainFinding = document.getElementById("recentRainFinding");
const recentRainSource = document.getElementById("recentRainSource");
let recentRainRequestId = 0;

function renderRecentRainLoading(){
  recentRainBadge.className="soil-badge neutral"; recentRainBadge.textContent="LOADING";
  recentRainStatus.textContent="Loading recent NASA precipitation…";
  rain1d.textContent=rain3d.textContent=rain7d.textContent=rainWetDays.textContent="…";
  recentRainFinding.className="runoff-finding neutral";
  recentRainFinding.querySelector("strong").textContent="RECENT RAINFALL PRESSURE";
  recentRainFinding.querySelector("p").textContent="Waiting for recent precipitation data.";
}
function rainPressure(total7){
  if(total7 >= 100) return {label:"VERY HIGH",cls:"high",text:"Substantial rainfall has accumulated over the latest seven available days. Combined with wet soil, runoff and drainage conditions, this can increase flood pressure."};
  if(total7 >= 50) return {label:"HIGH",cls:"high",text:"A notable seven-day rainfall accumulation is present. Soil wetness, terrain and drainage should be considered alongside it."};
  if(total7 >= 20) return {label:"MODERATE",cls:"moderate",text:"Recent rainfall is meaningful but not extreme by this prototype threshold. Local flood relevance depends on the other HyperFlood layers."};
  return {label:"LOW",cls:"low",text:"Recent seven-day rainfall accumulation is relatively low by this prototype threshold. This does not rule out highly localized rainfall or flooding."};
}
function renderRecentRain(data){
  const p=rainPressure(data.total7d);
  recentRainBadge.className=`soil-badge ${p.cls}`; recentRainBadge.textContent=p.label;
  recentRainStatus.textContent=`Latest available NASA daily precipitation: ${data.latestDate}.`;
  rain1d.textContent=`${data.latest1d.toFixed(1)} mm`;
  rain3d.textContent=`${data.total3d.toFixed(1)} mm`;
  rain7d.textContent=`${data.total7d.toFixed(1)} mm`;
  rainWetDays.textContent=`${data.wetDays7d} / 7`;
  recentRainFinding.className=`runoff-finding ${p.cls}`;
  recentRainFinding.querySelector("strong").textContent=`${p.label} RECENT RAINFALL PRESSURE`;
  recentRainFinding.querySelector("p").textContent=p.text;
  updateHistoricalRainfallBaseline();
  recentRainSource.textContent=`Source: NASA POWER Daily API (${data.parameter}); latest available day ${data.latestDate}. POWER meteorological data are not street-level observations. Rainfall-pressure labels are HyperFlood prototype interpretations.`;
}
function renderRecentRainError(error){
  console.error("Recent precipitation error:",error);
  recentRainBadge.className="soil-badge neutral"; recentRainBadge.textContent="UNAVAILABLE";
  recentRainStatus.textContent="Recent NASA precipitation could not be loaded for this point.";
  rain1d.textContent=rain3d.textContent=rain7d.textContent=rainWetDays.textContent="—";
  recentRainFinding.className="runoff-finding neutral";
  recentRainFinding.querySelector("strong").textContent="DATA UNAVAILABLE";
  recentRainFinding.querySelector("p").textContent="The other HyperFlood analyses remain available. Try this point again later.";
  updateHistoricalRainfallBaseline();
}
async function analyseRecentPrecipitation(lat,lon){
  const requestId=++recentRainRequestId; renderRecentRainLoading(); setRoadmapState("recentRain","loading");
  try{
    const url=new URL("/api/recent-rain",window.location.origin);
    url.searchParams.set("lat",Number(lat).toFixed(5)); url.searchParams.set("lon",Number(lon).toFixed(5));
    const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
    const data=await response.json();
    if(!response.ok || !data?.ok) throw new Error(data?.error || "Recent precipitation service unavailable");
    if(requestId!==recentRainRequestId) return; renderRecentRain(data); setRoadmapState("recentRain","done");
  }catch(error){ if(requestId!==recentRainRequestId) return; renderRecentRainError(error); setRoadmapState("recentRain","error"); }
}

// V11 wraps the stable V10 point-update flow. No existing analysis is modified.
const v11BaseUpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat,lon,label){
  v11BaseUpdateAnalysisPoint(lat,lon,label);
  analyseRecentPrecipitation(lat,lon);
};


// ==========================================================
// V12 FORECAST PRECIPITATION — supporting global forecast layer
// Existing V11 analyses remain unchanged.
// ==========================================================
const forecastBadge = document.getElementById("forecastBadge");
const forecastStatus = document.getElementById("forecastStatus");
const forecast24h = document.getElementById("forecast24h");
const forecast48h = document.getElementById("forecast48h");
const forecast7d = document.getElementById("forecast7d");
const forecastPeak = document.getElementById("forecastPeak");
const forecastFinding = document.getElementById("forecastFinding");
const forecastSource = document.getElementById("forecastSource");
let forecastRequestId = 0;

function renderForecastLoading(){
  forecastBadge.className="soil-badge neutral"; forecastBadge.textContent="LOADING";
  forecastStatus.textContent="Loading forecast precipitation…";
  forecast24h.textContent=forecast48h.textContent=forecast7d.textContent=forecastPeak.textContent="…";
  forecastFinding.className="runoff-finding neutral";
  forecastFinding.querySelector("strong").textContent="FORECAST RAINFALL PRESSURE";
  forecastFinding.querySelector("p").textContent="Waiting for forecast precipitation data.";
}
function forecastPressure(total24,total48,total7){
  if(total24>=50 || total48>=80 || total7>=150) return {label:"VERY HIGH",cls:"high",text:"The forecast shows substantial precipitation accumulation. Combined with wet soil, runoff potential and nearby drainage constraints, this can sharply increase flood pressure."};
  if(total24>=25 || total48>=50 || total7>=100) return {label:"HIGH",cls:"high",text:"A notable amount of precipitation is forecast. HyperFlood should interpret this together with recent rainfall, soil wetness, terrain and drainage."};
  if(total24>=10 || total48>=25 || total7>=50) return {label:"MODERATE",cls:"moderate",text:"Meaningful precipitation is forecast, but local flood relevance depends on the other HyperFlood layers and rainfall intensity."};
  return {label:"LOW",cls:"low",text:"Forecast precipitation accumulation is relatively low by this prototype threshold. Forecasts can change and localized rainfall may differ."};
}
function renderForecast(data){
  const p=forecastPressure(data.total24h,data.total48h,data.total7d);
  forecastBadge.className=`soil-badge ${p.cls}`; forecastBadge.textContent=p.label;
  forecastStatus.textContent=`Forecast generated from the latest available ${data.modelLabel || "global weather model"} data.`;
  forecast24h.textContent=`${data.total24h.toFixed(1)} mm`;
  forecast48h.textContent=`${data.total48h.toFixed(1)} mm`;
  forecast7d.textContent=`${data.total7d.toFixed(1)} mm`;
  forecastPeak.textContent=`${data.peakHourly.toFixed(1)} mm/h`;
  forecastFinding.className=`runoff-finding ${p.cls}`;
  forecastFinding.querySelector("strong").textContent=`${p.label} FORECAST RAINFALL PRESSURE`;
  forecastFinding.querySelector("p").textContent=p.text;
  updateHistoricalRainfallBaseline();
  forecastSource.textContent=`Forecast source: ${data.source}. ${data.modelLabel || "Global forecast model"}; ${data.hourCount} forecast hours analysed. This is modelled forecast precipitation, not a NASA observation or street-level measurement. Pressure labels are HyperFlood prototype interpretations.`;
}
function renderForecastError(error){
  console.error("Forecast precipitation error:",error);
  forecastBadge.className="soil-badge neutral"; forecastBadge.textContent="UNAVAILABLE";
  forecastStatus.textContent="Forecast precipitation could not be loaded for this point.";
  forecast24h.textContent=forecast48h.textContent=forecast7d.textContent=forecastPeak.textContent="—";
  forecastFinding.className="runoff-finding neutral";
  forecastFinding.querySelector("strong").textContent="DATA UNAVAILABLE";
  forecastFinding.querySelector("p").textContent="The other HyperFlood analyses remain available. Try this point again later.";
  updateHistoricalRainfallBaseline();
}
async function analyseForecastPrecipitation(lat,lon){
  const requestId=++forecastRequestId; renderForecastLoading(); setRoadmapState("forecast","loading");
  try{
    const url=new URL("/api/forecast-rain",window.location.origin);
    url.searchParams.set("lat",Number(lat).toFixed(5)); url.searchParams.set("lon",Number(lon).toFixed(5));
    const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
    const data=await response.json();
    if(!response.ok || !data?.ok) throw new Error(data?.error || "Forecast precipitation service unavailable");
    if(requestId!==forecastRequestId) return;
    renderForecast(data); setRoadmapState("forecast","done");
  }catch(error){
    if(requestId!==forecastRequestId) return;
    renderForecastError(error); setRoadmapState("forecast","error");
  }
}

const v12BaseUpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat,lon,label){
  v12BaseUpdateAnalysisPoint(lat,lon,label);
  analyseForecastPrecipitation(lat,lon);
};


// ==========================================================
// V13 FLOOD PRESSURE INTEGRATION
// Combines the already-working V12 layers. No new external API is introduced.
// The score is deliberately transparent and is NOT a flood probability.
// ==========================================================
const integrationBadge = document.getElementById("integrationBadge");
const integrationStatus = document.getElementById("integrationStatus");
const pressureScore = document.getElementById("pressureScore");
const pressureLevel = document.getElementById("pressureLevel");
const pressureEvidence = document.getElementById("pressureEvidence");
const pressureDriver = document.getElementById("pressureDriver");
const pressureBreakdown = document.getElementById("pressureBreakdown");
const integrationFinding = document.getElementById("integrationFinding");
let integrationTimer = null;

function parseMetric(el){
  const n = Number.parseFloat(String(el?.textContent || "").replace(/[^0-9.+-]/g,""));
  return Number.isFinite(n) ? n : null;
}
function integrationLevel(score){
  if(score >= 70) return {label:"VERY HIGH",cls:"high"};
  if(score >= 50) return {label:"HIGH",cls:"high"};
  if(score >= 30) return {label:"MODERATE",cls:"moderate"};
  return {label:"LOW",cls:"low"};
}
function contributionRow(label, points, max, note){
  const pct = max ? Math.max(0,Math.min(100,(points/max)*100)) : 0;
  return `<div class="pressure-row"><div class="pressure-row-head"><span>${label}</span><strong>${points.toFixed(0)} / ${max}</strong></div><div class="pressure-track"><span style="width:${pct.toFixed(0)}%"></span></div><small>${note}</small></div>`;
}
function renderIntegrationWaiting(){
  if(!integrationBadge) return;
  integrationBadge.className="soil-badge neutral"; integrationBadge.textContent="ANALYSING";
  integrationStatus.textContent="Waiting for terrain, soil, drainage, recent rainfall and forecast rainfall to finish.";
  pressureScore.textContent=pressureLevel.textContent=pressureEvidence.textContent=pressureDriver.textContent="…";
  pressureBreakdown.innerHTML="";
  integrationFinding.className="runoff-finding neutral";
  integrationFinding.querySelector("strong").textContent="COMBINING ENVIRONMENTAL EVIDENCE";
  integrationFinding.querySelector("p").textContent="The index will appear when the active short-term flood-pressure layers have completed.";
}
function calculateFloodPressureIntegration(){
  if(!integrationBadge) return;
  const required=["terrain","soil","rivers","recentRain","forecast"];
  const stillLoading=required.some(k=>roadmapItems[k]?.classList.contains("loading") || roadmapItems[k]?.classList.contains("pending"));
  if(stillLoading){ renderIntegrationWaiting(); setRoadmapState("integration","loading"); return; }

  const parts=[];
  // Terrain: low-lying/flat locations can favour local accumulation. Max 15.
  let terrainPts=0, terrainNote="Terrain data unavailable";
  if(roadmapItems.terrain?.classList.contains("done")){
    const pos=String(positionClass?.textContent||""); const slope=parseMetric(slopeValue);
    if(/low-lying/i.test(pos)) terrainPts+=10; else if(/near local average/i.test(pos)) terrainPts+=4;
    if(slope!==null && slope<2) terrainPts+=5; else if(slope!==null && slope<5) terrainPts+=2;
    terrainNote=`${pos || "Terrain position available"}${slope!==null?`, slope ${slope.toFixed(1)}°`:""}`;
    parts.push({label:"Terrain",points:Math.min(15,terrainPts),max:15,note:terrainNote});
  }
  // Soil/runoff: use the existing V9 derived class. Max 25.
  if(roadmapItems.soil?.classList.contains("done")){
    const r=String(runoffPotential?.textContent||"").toUpperCase();
    const p=r.includes("HIGH")?25:r.includes("MODERATE")?14:5;
    parts.push({label:"Soil + runoff",points:p,max:25,note:`Existing HyperFlood runoff potential: ${r || "available"}`});
  }
  // Drainage proximity: max 15.
  if(roadmapItems.rivers?.classList.contains("done")){
    const d=parseMetric(waterwayDistance); let metres=null;
    if(d!==null) metres=/km/i.test(String(waterwayDistance?.textContent||""))?d*1000:d;
    let p=0; if(metres!==null){ if(metres<=250)p=15; else if(metres<=750)p=10; else if(metres<=2000)p=5; else p=1; }
    parts.push({label:"River / drainage proximity",points:p,max:15,note:metres===null?"No mapped distance available":`Nearest mapped waterway: ${waterwayDistance.textContent}`});
  }
  // Recent rain: max 20, reaches max at 100 mm / 7d.
  if(roadmapItems.recentRain?.classList.contains("done")){
    const r7=parseMetric(rain7d) ?? 0; const p=Math.min(20,(Math.max(0,r7)/100)*20);
    parts.push({label:"Recent precipitation",points:p,max:20,note:`Latest 7-day accumulation: ${r7.toFixed(1)} mm`});
  }
  // Forecast: max 25, based on the strongest normalized forecast window.
  if(roadmapItems.forecast?.classList.contains("done")){
    const f24=parseMetric(forecast24h)??0, f48=parseMetric(forecast48h)??0, f7=parseMetric(forecast7d)??0;
    const norm=Math.max(f24/50,f48/80,f7/150); const p=Math.min(25,Math.max(0,norm)*25);
    parts.push({label:"Forecast precipitation",points:p,max:25,note:`24h ${f24.toFixed(1)} mm · 48h ${f48.toFixed(1)} mm · 7d ${f7.toFixed(1)} mm`});
  }

  const availableMax=parts.reduce((a,b)=>a+b.max,0);
  if(availableMax < 50 || parts.length < 3){
    integrationBadge.className="soil-badge neutral"; integrationBadge.textContent="LIMITED DATA";
    integrationStatus.textContent="Too few active layers returned usable evidence for a stable integrated signal.";
    pressureScore.textContent="—"; pressureLevel.textContent="LIMITED"; pressureEvidence.textContent=`${parts.length} / 5`; pressureDriver.textContent="—";
    pressureBreakdown.innerHTML=parts.map(p=>contributionRow(p.label,p.points,p.max,p.note)).join("");
    integrationFinding.className="runoff-finding neutral"; integrationFinding.querySelector("strong").textContent="INSUFFICIENT EVIDENCE"; integrationFinding.querySelector("p").textContent="Individual HyperFlood layers remain available. The integrated index requires at least three usable short-term evidence layers.";
    setRoadmapState("integration","error"); return;
  }
  // Normalize to 0–100 if a non-critical layer is unavailable rather than silently treating missing data as zero.
  const raw=parts.reduce((a,b)=>a+b.points,0); const score=Math.round(raw/availableMax*100); const level=integrationLevel(score);
  const driver=[...parts].sort((a,b)=>(b.points/b.max)-(a.points/a.max))[0];
  integrationBadge.className=`soil-badge ${level.cls}`; integrationBadge.textContent=level.label;
  integrationStatus.textContent="Integrated pressure signal calculated from the available active HyperFlood layers.";
  pressureScore.textContent=`${score} / 100`; pressureLevel.textContent=level.label; pressureEvidence.textContent=`${parts.length} / 5`; pressureDriver.textContent=driver?.label || "—";
  pressureBreakdown.innerHTML=parts.map(p=>contributionRow(p.label,p.points,p.max,p.note)).join("");
  integrationFinding.className=`runoff-finding ${level.cls}`; integrationFinding.querySelector("strong").textContent=`${level.label} FLOOD PRESSURE`;
  const top=[...parts].sort((a,b)=>(b.points/b.max)-(a.points/a.max)).slice(0,2).map(p=>p.label.toLowerCase()).join(" and ");
  integrationFinding.querySelector("p").textContent=`The strongest current contributions are ${top}. This score integrates environmental pressure signals; it is not a probability of flooding or an official warning.`;
  setRoadmapState("integration","done");
}
function scheduleFloodPressureIntegration(){
  clearTimeout(integrationTimer);
  integrationTimer=setTimeout(calculateFloodPressureIntegration,120);
}

const v13BaseUpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat,lon,label){
  renderIntegrationWaiting(); setRoadmapState("integration","loading");
  v13BaseUpdateAnalysisPoint(lat,lon,label);
  scheduleFloodPressureIntegration();
};


// ==========================================================
// V17 — HISTORICAL BASELINE LINKED DIRECTLY TO FINAL FLOOD EARLY-WARNING OUTLOOK
// Past → Present → Future → Action
// The warning is a transparent prototype decision-support signal.
// V17 adds a seasonal historical reference beside the live warning without adding
// arbitrary historical points to the short-term flood-pressure score.
// ==========================================================
const warningDetailStatus = document.getElementById("warningDetailStatus");
const warningBadge = document.getElementById("warningBadge");
const warningFinding = document.getElementById("warningFinding");
const warningOutlook = {
  "24 hours": { level: document.getElementById("detail24Level"), reason: document.getElementById("detail24Reason"), card: document.querySelector('[data-outlook-card="24"]') },
  "48 hours": { level: document.getElementById("detail48Level"), reason: document.getElementById("detail48Reason"), card: document.querySelector('[data-outlook-card="48"]') },
  "7 days": { level: document.getElementById("detail7Level"), reason: document.getElementById("detail7Reason"), card: document.querySelector('[data-outlook-card="7"]') }
};
let finalOutlook = null;
let finalOutlookTimer = null;

function outlookLevel(score) {
  if (score >= 80) return { label: "SEVERE", cls: "severe" };
  if (score >= 60) return { label: "HIGH", cls: "high" };
  if (score >= 40) return { label: "MODERATE", cls: "moderate" };
  if (score >= 20) return { label: "LOW", cls: "low" };
  return { label: "NORMAL", cls: "normal" };
}

function metricNumber(el) {
  if (!el) return null;
  const m = String(el.textContent || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

const warningBaselineValue = document.getElementById("warningBaselineValue");
const warningBaselineComparison = document.getElementById("warningBaselineComparison");

function historicalBaselineForWindow(windowName) {
  const monthIndex = new Date().getMonth();
  const climate = trendMonthly?.[monthIndex];
  if (!climate || !Number.isFinite(climate.expected7d)) return null;
  const days = windowName === "24 hours" ? 1 : windowName === "48 hours" ? 2 : 7;
  const expected = climate.expected7d * days / 7;
  return { expected, monthIndex, days };
}

function describeBaselineComparison(forecast, baseline) {
  if (!baseline || !Number.isFinite(forecast)) return { label: "Historical baseline unavailable", pct: null };
  const reference = Math.max(baseline.expected, 0.1);
  const pct = ((forecast - reference) / reference) * 100;
  let label = "near the historical seasonal baseline";
  if (pct >= 100) label = "well above the historical seasonal baseline";
  else if (pct >= 25) label = "above the historical seasonal baseline";
  else if (pct <= -25) label = "below the historical seasonal baseline";
  return { label, pct };
}

function updateWarningBaselineUI(windowName, forecast) {
  if (!warningBaselineValue || !warningBaselineComparison) return;
  const baseline = historicalBaselineForWindow(windowName);
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (!baseline) {
    warningBaselineValue.textContent = "Awaiting NASA historical baseline";
    warningBaselineComparison.textContent = "The seasonal reference will appear when the historical record is available.";
    return;
  }
  warningBaselineValue.textContent = `${baseline.expected.toFixed(1)} mm expected`;
  if (!Number.isFinite(forecast)) {
    warningBaselineComparison.textContent = `${monthNames[baseline.monthIndex]} seasonal reference · waiting for forecast rainfall.`;
    return;
  }
  const comparison = describeBaselineComparison(forecast, baseline);
  const sign = comparison.pct >= 0 ? "+" : "";
  warningBaselineComparison.textContent = `${forecast.toFixed(1)} mm forecast · ${sign}${comparison.pct.toFixed(0)}% vs ${monthNames[baseline.monthIndex]} historical reference`;
}

function buildWarningOutlook() {
  if (!warningDetailStatus) return;
  const ready = ["terrain", "soil", "rivers", "recentRain", "forecast"].filter(k => roadmapItems[k]?.classList.contains("done"));
  if (ready.length < 3 || !roadmapItems.integration?.classList.contains("done")) {
    finalOutlook = null;
    setRoadmapState("risk", "loading");
    warningBadge.className = "soil-badge neutral";
    warningBadge.textContent = "ANALYSING";
    warningDetailStatus.textContent = "Waiting for enough current and forecast evidence to build the final outlook.";
    warningFinding.className = "runoff-finding neutral";
    warningFinding.querySelector("strong").textContent = "WAITING FOR FLOOD OUTLOOK";
    warningFinding.querySelector("p").textContent = "HyperFlood needs at least three usable short-term evidence layers before publishing the prototype outlook.";
    warningLevel.textContent = "ANALYSING";
    warningStatus.textContent = "Waiting for the integrated flood-pressure layers to complete.";
    setWarningSeverity("normal");
    return;
  }

  const baseParts = [];
  let base = 0;
  // Present-condition component: terrain (15), soil/runoff (25), waterways (15), recent rain (20) = 75.
  const pos = String(positionClass?.textContent || "");
  const slope = metricNumber(slopeValue);
  let terrainPts = 0;
  if (/low-lying/i.test(pos)) terrainPts += 10; else if (/near local average/i.test(pos)) terrainPts += 4;
  if (slope !== null && slope < 2) terrainPts += 5; else if (slope !== null && slope < 5) terrainPts += 2;
  if (roadmapItems.terrain?.classList.contains("done")) {
    base += Math.min(15, terrainPts); baseParts.push({label:"terrain", points:Math.min(15,terrainPts), max:15});
  }

  if (roadmapItems.soil?.classList.contains("done")) {
    const r = String(runoffPotential?.textContent || "").toUpperCase();
    const pts = r.includes("HIGH") ? 25 : r.includes("MODERATE") ? 14 : 5;
    base += pts; baseParts.push({label:"soil/runoff", points:pts, max:25});
  }

  if (roadmapItems.rivers?.classList.contains("done")) {
    const d = metricNumber(waterwayDistance); const raw = String(waterwayDistance?.textContent || "");
    const metres = d === null ? null : /km/i.test(raw) ? d * 1000 : d;
    let pts = 0;
    if (metres !== null) pts = metres <= 250 ? 15 : metres <= 750 ? 10 : metres <= 2000 ? 5 : 1;
    base += pts; baseParts.push({label:"waterway proximity", points:pts, max:15});
  }

  if (roadmapItems.recentRain?.classList.contains("done")) {
    const r7 = metricNumber(rain7d) ?? 0;
    const pts = Math.min(20, Math.max(0, r7) / 100 * 20);
    base += pts; baseParts.push({label:"recent rainfall", points:pts, max:20});
  }

  const forecast24 = metricNumber(forecast24h) ?? 0;
  const forecast48 = metricNumber(forecast48h) ?? 0;
  const forecast7 = metricNumber(forecast7d) ?? 0;
  const windowForecast = {
    "24 hours": { value: forecast24, max: 50 },
    "48 hours": { value: forecast48, max: 80 },
    "7 days": { value: forecast7, max: 150 }
  };

  // Normalize present conditions to 0–75, then add forecast pressure as 0–25.
  // This deliberately keeps historical trends contextual rather than turning them into arbitrary risk points.
  const presentScore = baseParts.length ? base / baseParts.reduce((sum,p)=>sum+p.max,0) * 75 : 0;
  const result = {};
  for (const [window, f] of Object.entries(windowForecast)) {
    const forecastPoints = Math.min(25, Math.max(0, f.value) / f.max * 25);
    const score = Math.round(Math.min(100, presentScore + forecastPoints));
    const level = outlookLevel(score);
    const topPresent = [...baseParts].sort((a,b)=>(b.points/b.max)-(a.points/a.max)).slice(0,2).map(p=>p.label);
    let reason = topPresent.length ? `Current drivers: ${topPresent.join(" + ")}.` : "Current environmental evidence is limited.";
    if (forecastPoints >= 20) reason += ` Forecast rainfall adds strong pressure (${f.value.toFixed(1)} mm).`;
    else if (forecastPoints >= 10) reason += ` Forecast rainfall adds moderate pressure (${f.value.toFixed(1)} mm).`;
    else reason += ` Forecast rainfall adds limited pressure (${f.value.toFixed(1)} mm).`;
    const baseline = historicalBaselineForWindow(window);
    const comparison = describeBaselineComparison(f.value, baseline);
    if (baseline && comparison.pct !== null) {
      const sign = comparison.pct >= 0 ? "+" : "";
      reason += ` Forecast rainfall is ${comparison.label} (${sign}${comparison.pct.toFixed(0)}% versus the historical seasonal reference of ${baseline.expected.toFixed(1)} mm).`;
    } else {
      reason += ` Historical seasonal baseline is unavailable for this outlook window.`;
    }
    result[window] = {score, level, reason, forecast:f.value, baseline:baseline?.expected ?? null, baselinePct:comparison.pct};
  }
  finalOutlook = result;
  const selected = result[selectedWarningWindow] || result["24 hours"];
  warningBadge.className = `soil-badge ${selected.level.cls}`;
  warningBadge.textContent = selected.level.label;
  warningDetailStatus.textContent = `Prototype outlook calculated from ${ready.length} active short-term evidence layers. Historical NASA trends remain long-term context.`;
  warningFinding.className = `runoff-finding ${selected.level.cls}`;
  warningFinding.querySelector("strong").textContent = `${selected.level.label} FLOOD EARLY-WARNING OUTLOOK`;
  warningFinding.querySelector("p").textContent = `${selected.reason} This is a transparent screening signal, not a probability of flooding or an official warning.`;

  for (const [window, ui] of Object.entries(warningOutlook)) {
    const item = result[window];
    if (!item) continue;
    ui.level.textContent = item.level.label;
    ui.reason.textContent = `Score ${item.score}/100 · ${item.reason}`;
    ui.card.className = `outlook-card ${item.level.cls}${window === selectedWarningWindow ? " active" : ""}`;
  }

  warningLevel.textContent = selected.level.label;
  warningStatus.textContent = `${selected.reason} Prototype decision-support outlook.`;
  updateWarningBaselineUI(selectedWarningWindow, selected.forecast);
  setWarningSeverity(selected.level.cls);
  setRoadmapState("risk", "done");
}

function renderSelectedWarningWindow() {
  if (!finalOutlook) { buildWarningOutlook(); return; }
  const selected = finalOutlook[selectedWarningWindow] || finalOutlook["24 hours"];
  warningWindowTitle.textContent = `${selectedWarningWindow} outlook`;
  warningLevel.textContent = selected.level.label;
  warningStatus.textContent = `${selected.reason} Prototype decision-support outlook.`;
  setWarningSeverity(selected.level.cls);
  Object.entries(warningOutlook).forEach(([window, ui]) => {
    ui.card.classList.toggle("active", window === selectedWarningWindow);
  });
  warningBadge.className = `soil-badge ${selected.level.cls}`;
  warningBadge.textContent = selected.level.label;
  warningFinding.className = `runoff-finding ${selected.level.cls}`;
  warningFinding.querySelector("strong").textContent = `${selected.level.label} FLOOD EARLY-WARNING OUTLOOK`;
  warningFinding.querySelector("p").textContent = `${selected.reason} This is a transparent screening signal, not a probability of flooding or an official warning.`;
  updateWarningBaselineUI(selectedWarningWindow, selected.forecast);
}

function scheduleFinalOutlook() {
  clearTimeout(finalOutlookTimer);
  finalOutlookTimer = setTimeout(buildWarningOutlook, 180);
}

const v14BaseUpdateAnalysisPoint = updateAnalysisPoint;
updateAnalysisPoint = function(lat, lon, label) {
  finalOutlook = null;
  setRoadmapState("risk", "loading");
  warningLevel.textContent = "ANALYSING";
  warningStatus.textContent = "Analysing current environmental conditions and forecast rainfall…";
  updateWarningBaselineUI(selectedWarningWindow, null);
  setWarningSeverity("normal");
  v14BaseUpdateAnalysisPoint(lat, lon, label);
  scheduleFinalOutlook();
};

// Recalculate whenever one of the upstream layers changes state.
const originalSetRoadmapState = setRoadmapState;
setRoadmapState = function(key, state) {
  originalSetRoadmapState(key, state);
  if (["terrain","soil","rivers","recentRain","forecast","integration"].includes(key)) scheduleFinalOutlook();
};
