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
