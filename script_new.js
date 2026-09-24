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
