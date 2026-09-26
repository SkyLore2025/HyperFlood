# HyperFlood v7

HyperFlood is a prototype for global, hyperlocal flood intelligence using a selected map point, terrain analysis and NASA Earth-system historical trends.

## What changed in v7

Version 7 moves the NASA POWER historical-data request to a Vercel serverless function:

Browser → `/api/power` → NASA POWER

This is the key architectural change from v6. The browser no longer calls NASA POWER directly.

## Files

- `index.html` — frontend
- `style.css` — frontend styling
- `script.js` — map, search, terrain and historical trend logic
- `api/power.js` — Vercel serverless NASA POWER proxy
- `package.json` — pins Node.js 24.x for the Vercel deployment

## Deployment

This project should be deployed on Vercel rather than GitHub Pages if you want the `/api/power` function to run.

1. Upload/push this folder to a GitHub repository.
2. Import that repository into Vercel.
3. Use the default/static deployment settings.
4. Ensure the Vercel Node.js runtime is 24.x.
5. Open the Vercel project URL.
6. Search for a place and check the NASA Earth System Trend Detective section.

GitHub Pages can still host the static files, but it cannot execute `api/power.js`; the v7 historical analysis therefore expects the Vercel deployment URL.

## NASA POWER request

The proxy requests monthly `T2M` and `PRECTOTCORR` data for the last complete 10, 20 or 25 years. If the corrected precipitation parameter is unavailable, it retries with `PRECTOT`.

The frontend aggregates complete monthly observations into annual precipitation and annual mean temperature, then calculates a simple linear trend and two-sided significance test.

## Scientific note

The historical trend layer is a climate/meteorological trend investigation, not a street-level flood forecast. NASA POWER data should not be presented as street-level rainfall measurements. HyperFlood's hyperlocal component comes from the selected analysis point and the combination of multiple environmental layers planned for later versions.
