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

let map = null;
let marker = null;

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

function selectLocation(place) {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  const label = place.display_name || "Selected location";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  selectedPlaceName.textContent = label.split(",")[0];
  selectedPlaceLabel.textContent = label;
  coordinatesEl.textContent = `Latitude ${formatCoordinates(lat, lon).split(", ")[0]} · Longitude ${formatCoordinates(lat, lon).split(", ")[1]}`;

  searchScreen.classList.add("hidden");
  mapScreen.classList.remove("hidden");

  if (!map) {
    map = L.map("map", { zoomControl: true }).setView([lat, lon], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
  } else {
    map.setView([lat, lon], 13);
  }

  if (marker) marker.remove();

  marker = L.marker([lat, lon]).addTo(map);
  marker.bindPopup(`<strong>${escapeHtml(label.split(",")[0])}</strong><br>${formatCoordinates(lat, lon)}`).openPopup();

  setTimeout(() => map.invalidateSize(), 100);
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
