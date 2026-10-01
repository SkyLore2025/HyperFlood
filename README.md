# HyperFlood V15 — Earth-System Trends to Hyperlocal Flood Outlook

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
