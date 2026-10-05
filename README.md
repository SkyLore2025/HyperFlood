# HyperFlood V18 — Earth-System Trends to Hyperlocal Flood Outlook

HyperFlood connects long-term NASA precipitation and temperature trends (PAST) with present environmental layers, near-future rainfall forecasts, and an explainable prototype flood outlook (ACTION).

## Deploy
Deploy this folder to Vercel from GitHub. Keep the `api/` directory and `package.json` at the project root. Vercel auto-deployment can be connected to the GitHub repository.

## Data layers
- NASA POWER historical monthly temperature and precipitation trends (10/20/25-year selector).
- Copernicus DEM GLO-90 elevation via Open-Meteo.
- NASA POWER environmental/soil intelligence and recent daily precipitation.
- OpenStreetMap waterways via Overpass.
- Open-Meteo forecast precipitation.
- Transparent prototype flood-pressure and early-warning outlook.

## Important limitations
Historical trends are shown as long-term Earth-system context and are not added directly to the short-term flood-pressure score. Rainfall datasets are gridded products, not street-level measurements. The flood-pressure index and outlook are prototype decision-support indicators, not calibrated flood probabilities, official government warnings, or emergency alerts. Check official local alerts and emergency guidance.


## V16 historical baseline
The 25-year NASA POWER historical window now also establishes a seasonal rainfall baseline for the current month. HyperFlood shows the historical monthly average, a derived 7-day equivalent baseline, recent 7-day rainfall and forecast 7-day rainfall, with a contextual comparison. This baseline is informational only and does not alter the existing Flood Pressure Index or early-warning scoring.


## V17 change
The blinking Flood Early-Warning bar now directly links the selected forecast window to the 25-year NASA seasonal rainfall baseline. It shows the historical expected rainfall for that window and the forecast difference from that reference. The baseline is explanatory context and is not added as arbitrary points to the short-term Flood Pressure Index.


## V18 workspace layout
- Flood Early Warning moved from the bottom into a left sidebar.
- Collapsed warning state is a narrow, full-height vertical tab reading “FLOOD EARLY WARNING”.
- The warning tab keeps the existing blinking behavior and severity state; clicking it expands the complete warning panel.
- The right analysis panel can be hidden. When hidden, it becomes a compact 01–08 status rail showing the existing loading spinner / tick / unavailable state.
- Both sidebars preserve their existing functionality and analysis logic; this release changes the workspace presentation rather than the flood calculations.
