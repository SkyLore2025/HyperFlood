// ==========================================================
// HyperFlood v0.3
// Global Search + Map Search + Click-to-Analyse + Drag Marker
// ==========================================================


// ----------------------------------------------------------
// DOM ELEMENTS
// ----------------------------------------------------------

const searchScreen = document.getElementById("searchScreen");
const mapScreen = document.getElementById("mapScreen");

const locationForm = document.getElementById("locationForm");
const locationInput = document.getElementById("locationInput");
const searchButton = document.getElementById("searchButton");

const statusBox = document.getElementById("status");
const resultsBox = document.getElementById("results");

const mapSearchForm = document.getElementById("mapSearchForm");
const mapSearchInput = document.getElementById("mapSearchInput");
const mapResults = document.getElementById("mapResults");

const homeButton = document.getElementById("homeButton");

const selectedLocation = document.getElementById("selectedLocation");
const latitudeDisplay = document.getElementById("latitude");
const longitudeDisplay = document.getElementById("longitude");


// ----------------------------------------------------------
// MAP VARIABLES
// ----------------------------------------------------------

let map = null;
let marker = null;


// Used to prevent an older reverse-geocoding request from
// overwriting a newer map click.
let reverseGeocodeRequest = 0;


// ==========================================================
// HELPER FUNCTIONS
// ==========================================================

function setStatus(message) {
    if (statusBox) {
        statusBox.textContent = message;
    }
}


function clearResults() {
    if (resultsBox) {
        resultsBox.innerHTML = "";
    }
}


function formatCoordinates(value) {
    return Number(value).toFixed(6);
}


// ==========================================================
// GLOBAL LOCATION SEARCH
// ==========================================================

async function searchLocation(query) {

    const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
            q: query,
            format: "jsonv2",
            addressdetails: "1",
            limit: "6"
        });

    const response = await fetch(url, {
        headers: {
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error("Location search failed.");
    }

    return await response.json();
}


// ==========================================================
// SCREEN 1 SEARCH RESULTS
// ==========================================================

function renderResults(results) {

    clearResults();

    if (!results || results.length === 0) {

        setStatus("No matching locations found.");

        return;
    }


    setStatus("Select a location from the results below.");


    results.forEach(place => {

        const resultButton = document.createElement("button");

        resultButton.type = "button";

        // Preserve the class used by the existing CSS.
        resultButton.className = "result-button";

        resultButton.textContent = place.display_name;


        resultButton.addEventListener("click", () => {

            selectLocation(place);

        });


        resultsBox.appendChild(resultButton);

    });
}


// ==========================================================
// SCREEN 2 SEARCH RESULTS
// ==========================================================

function renderMapResults(results) {

    if (!mapResults) {
        return;
    }


    mapResults.innerHTML = "";


    if (!results || results.length === 0) {

        mapResults.innerHTML =
            '<div class="map-search-message">No locations found.</div>';

        return;
    }


    results.forEach(place => {

        const resultButton = document.createElement("button");

        resultButton.type = "button";

        // Use the map result class from the existing version.
        resultButton.className = "map-result";

        resultButton.textContent = place.display_name;


        resultButton.addEventListener("click", () => {

            selectLocation(place);

            mapResults.innerHTML = "";

            if (mapSearchInput) {
                mapSearchInput.value = "";
            }

        });


        mapResults.appendChild(resultButton);

    });
}


// ==========================================================
// SELECT LOCATION FROM SEARCH
// ==========================================================

function selectLocation(place) {

    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);


    if (
        Number.isNaN(lat) ||
        Number.isNaN(lon)
    ) {

        console.error("Invalid coordinates.");

        return;
    }


    // Hide first screen.
    searchScreen.style.display = "none";

    // Show map screen.
    mapScreen.style.display = "block";


    // Initialise map only once.
    if (!map) {

        initializeMap(lat, lon);

    }


    // Update the analysis point.
    updateAnalysisPoint(
        lat,
        lon,
        place.display_name
    );


    // Move map to selected location.
    map.setView(
        [lat, lon],
        14
    );


    // Leaflet sometimes needs this after changing
    // from display:none to display:block.
    setTimeout(() => {

        map.invalidateSize();

    }, 150);
}


// ==========================================================
// INITIALISE MAP
// ==========================================================

function initializeMap(lat, lon) {

    map = L.map("map").setView(
        [lat, lon],
        14
    );


    // ------------------------------------------------------
    // OPENSTREETMAP BASE LAYER
    // ------------------------------------------------------

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            attribution:
                '&copy; OpenStreetMap contributors'
        }
    ).addTo(map);


    // ------------------------------------------------------
    // NEW FEATURE:
    // CLICK ANYWHERE ON THE MAP
    // ------------------------------------------------------

    map.on("click", async function(event) {

        const lat = event.latlng.lat;
        const lon = event.latlng.lng;


        // Immediately move marker.
        updateAnalysisPoint(
            lat,
            lon,
            "Identifying location..."
        );


        // Try to identify the clicked location.
        await reverseGeocode(
            lat,
            lon
        );

    });
}


// ==========================================================
// UPDATE ANALYSIS POINT
// ==========================================================

function updateAnalysisPoint(lat, lon, locationName) {

    // ------------------------------------------------------
    // CREATE MARKER IF IT DOES NOT EXIST
    // ------------------------------------------------------

    if (!marker) {

        marker = L.marker(
            [lat, lon],
            {
                draggable: true
            }
        ).addTo(map);


        // --------------------------------------------------
        // NEW FEATURE:
        // DRAG MARKER TO ANOTHER LOCATION
        // --------------------------------------------------

        marker.on("dragend", async function(event) {

            const position =
                event.target.getLatLng();


            const newLat =
                position.lat;

            const newLon =
                position.lng;


            // Update coordinates immediately.
            updateAnalysisPoint(
                newLat,
                newLon,
                "Identifying location..."
            );


            // Identify the new place.
            await reverseGeocode(
                newLat,
                newLon
            );

        });

    }

    else {

        // Marker already exists.
        // Move it to the new position.

        marker.setLatLng(
            [lat, lon]
        );

    }


    // ------------------------------------------------------
    // UPDATE LOCATION NAME
    // ------------------------------------------------------

    if (selectedLocation) {

        selectedLocation.textContent =
            locationName || "Selected map location";

    }


    // ------------------------------------------------------
    // UPDATE LATITUDE
    // ------------------------------------------------------

    if (latitudeDisplay) {

        latitudeDisplay.textContent =
            formatCoordinates(lat);

    }


    // ------------------------------------------------------
    // UPDATE LONGITUDE
    // ------------------------------------------------------

    if (longitudeDisplay) {

        longitudeDisplay.textContent =
            formatCoordinates(lon);

    }


    // ------------------------------------------------------
    // UPDATE MARKER POPUP
    // ------------------------------------------------------

    marker.bindPopup(
        `
        <strong>HyperFlood Analysis Point</strong>
        <br><br>
        Latitude: ${formatCoordinates(lat)}
        <br>
        Longitude: ${formatCoordinates(lon)}
        `
    );

}


// ==========================================================
// REVERSE GEOCODING
//
// Converts a clicked latitude/longitude into a place name.
// ==========================================================

async function reverseGeocode(lat, lon) {

    const currentRequest =
        ++reverseGeocodeRequest;


    try {

        const url =
            "https://nominatim.openstreetmap.org/reverse?" +
            new URLSearchParams({
                lat: lat,
                lon: lon,
                format: "jsonv2",
                zoom: "18",
                addressdetails: "1"
            });


        const response = await fetch(url, {

            headers: {
                Accept: "application/json"
            }

        });


        if (!response.ok) {

            throw new Error(
                "Reverse geocoding failed."
            );

        }


        const data =
            await response.json();


        // If the user clicked somewhere else while this
        // request was running, ignore this older response.

        if (
            currentRequest !== reverseGeocodeRequest
        ) {

            return;

        }


        if (
            data &&
            data.display_name
        ) {

            selectedLocation.textContent =
                data.display_name;

        }

        else {

            selectedLocation.textContent =
                "Custom map location";

        }

    }

    catch (error) {

        console.error(
            "Reverse geocoding error:",
            error
        );


        if (
            currentRequest === reverseGeocodeRequest
        ) {

            selectedLocation.textContent =
                "Custom map location";

        }

    }

}


// ==========================================================
// SCREEN 1 SEARCH FORM
// ==========================================================

locationForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const query =
            locationInput.value.trim();


        if (!query) {

            setStatus(
                "Please enter a location."
            );

            return;
        }


        searchButton.disabled = true;

        searchButton.textContent =
            "Searching...";


        setStatus(
            "Searching locations worldwide..."
        );


        clearResults();


        try {

            const results =
                await searchLocation(query);


            renderResults(results);

        }

        catch (error) {

            console.error(
                "Search error:",
                error
            );


            setStatus(
                "Unable to search locations. Please try again."
            );

        }

        finally {

            searchButton.disabled = false;

            searchButton.textContent =
                "Search";

        }

    }
);


// ==========================================================
// SCREEN 2 SEARCH FORM
// ==========================================================

if (mapSearchForm) {

    mapSearchForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const query =
                mapSearchInput.value.trim();


            if (!query) {

                return;

            }


            if (mapResults) {

                mapResults.innerHTML =
                    '<div class="map-search-message">Searching...</div>';

            }


            try {

                const results =
                    await searchLocation(query);


                renderMapResults(results);

            }

            catch (error) {

                console.error(
                    "Map search error:",
                    error
                );


                if (mapResults) {

                    mapResults.innerHTML =
                        '<div class="map-search-message">Unable to search.</div>';

                }

            }

        }
    );

}


// ==========================================================
// HOME BUTTON
// ==========================================================

if (homeButton) {

    homeButton.addEventListener(
        "click",
        function() {

            mapScreen.style.display =
                "none";


            searchScreen.style.display =
                "flex";


            clearResults();


            locationInput.value =
                "";


            setStatus(
                "Search for a location to begin."
            );


            if (mapResults) {

                mapResults.innerHTML =
                    "";

            }


            if (mapSearchInput) {

                mapSearchInput.value =
                    "";

            }

        }
    );

}


// ==========================================================
// CLOSE MAP SEARCH RESULTS WHEN CLICKING ELSEWHERE
// ==========================================================

document.addEventListener(
    "click",
    function(event) {

        if (!mapResults) {
            return;
        }


        const searchContainer =
            event.target.closest(
                ".map-search-container"
            );


        if (!searchContainer) {

            mapResults.innerHTML =
                "";

        }

    }
);


// ==========================================================
// HYPERFLOOD ANALYSIS HOOK
//
// IMPORTANT:
//
// Later, when we add NASA elevation, rainfall,
// soil/runoff, rivers and flood-risk calculations,
// we can call those functions from updateAnalysisPoint().
//
// That means EVERY method:
//
// Search
//      ↓
// Click map
//      ↓
// Drag marker
//      ↓
// New coordinates
//      ↓
// NASA analysis
//
// will use the same analysis pipeline.
// ==========================================================
