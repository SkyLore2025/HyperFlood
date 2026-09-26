// HyperFlood v7 — server-side NASA POWER proxy for Vercel.
// This keeps NASA POWER calls off the browser, avoiding cross-origin/CORS issues.

const NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point";
const ALLOWED_YEARS = new Set([10, 20, 25]);

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(status).json(body);
}

async function requestPower(parameters, lat, lon, startYear, endYear) {
  const url = new URL(NASA_POWER_URL);
  url.searchParams.set("parameters", parameters);
  url.searchParams.set("community", "SB");
  url.searchParams.set("longitude", Number(lon).toFixed(5));
  url.searchParams.set("latitude", Number(lat).toFixed(5));
  url.searchParams.set("start", String(startYear));
  url.searchParams.set("end", String(endYear));
  url.searchParams.set("format", "JSON");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" }
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    // NASA should return JSON, but preserve a useful error if it does not.
  }

  if (!response.ok) {
    const message = data?.messages?.join?.(" ") || data?.message || text.slice(0, 300);
    throw new Error(`NASA POWER ${response.status}: ${message}`);
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed. Use GET." });
  }

  const lat = Number(req.query?.lat);
  const lon = Number(req.query?.lon);
  const years = Number(req.query?.years || 25);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return json(res, 400, { error: "Latitude must be a number between -90 and 90." });
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return json(res, 400, { error: "Longitude must be a number between -180 and 180." });
  }

  if (!ALLOWED_YEARS.has(years)) {
    return json(res, 400, { error: "Years must be 10, 20 or 25." });
  }

  // Use the last complete calendar year so the historical series is not
  // distorted by an incomplete current year.
  const endYear = new Date().getUTCFullYear() - 1;
  const startYear = endYear - years + 1;

  try {
    let power;
    let precipitationParameter = "PRECTOTCORR";

    try {
      // Request both variables in one documented NASA POWER call.
      power = await requestPower("T2M,PRECTOTCORR", lat, lon, startYear, endYear);
    } catch (combinedError) {
      // Some historical POWER configurations may not expose the corrected
      // precipitation parameter. Retry with the base precipitation field.
      console.warn("NASA POWER combined request failed:", combinedError.message);
      precipitationParameter = "PRECTOT";
      power = await requestPower("T2M,PRECTOT", lat, lon, startYear, endYear);
    }

    const parameters = power?.properties?.parameter || power?.parameter;
    if (!parameters?.T2M || !parameters?.[precipitationParameter]) {
      throw new Error("NASA POWER returned an unexpected response structure.");
    }

    return json(res, 200, {
      ok: true,
      source: "NASA POWER",
      startYear,
      endYear,
      precipitationParameter,
      parameters: {
        T2M: parameters.T2M,
        precipitation: parameters[precipitationParameter]
      }
    });
  } catch (error) {
    console.error("HyperFlood NASA proxy error:", error);
    return json(res, 502, {
      ok: false,
      error: "NASA POWER could not be reached or returned unusable data.",
      detail: error.message
    });
  }
}
