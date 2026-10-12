// HyperFlood V19 — historical seasonal window centred on the query date.
// Calculates 31-day rainfall climatology and daily rainfall/temperature extremes
// from NASA POWER daily data. The historical values are contextual, not a flood score.
const NASA_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const ALLOWED_YEARS = new Set([10, 20, 25]);

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(status).json(body);
}

async function requestDaily(parameters, community, lat, lon, start, end) {
  const url = new URL(NASA_DAILY_URL);
  url.searchParams.set("parameters", parameters);
  url.searchParams.set("community", community);
  url.searchParams.set("longitude", Number(lon).toFixed(5));
  url.searchParams.set("latitude", Number(lat).toFixed(5));
  url.searchParams.set("start", String(start));
  url.searchParams.set("end", String(end));
  url.searchParams.set("format", "JSON");
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const bodyText = await response.text();
  let data = null;
  try { data = JSON.parse(bodyText); } catch (_) {}
  if (!response.ok) {
    const message = data?.messages?.join?.(" ") || data?.message || bodyText.slice(0, 250);
    throw new Error(`NASA POWER daily ${response.status}: ${message}`);
  }
  return data;
}

function getParameterMap(data) {
  return data?.properties?.parameter || data?.parameter || null;
}

function validValue(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > -900 ? n : null;
}

function dateKey(date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth()+1).padStart(2,"0")}${String(date.getUTCDate()).padStart(2,"0")}`;
}

function centerDateForYear(year, month, day) {
  const safeDay = month === 2 && day === 29 && new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1 ? 28 : day;
  return new Date(Date.UTC(year, month - 1, safeDay));
}

function buildSeasonalSummary(params, startYear, endYear, month, day) {
  const rain = params.PRECTOTCORR || params.PRECTOT || {};
  const tmax = params.T2M_MAX || {};
  const tmin = params.T2M_MIN || {};
  const windowTotals = [];
  const dailyRain = [];
  const dailyHighTemps = [];
  const dailyLowTemps = [];
  const dailyMeanTemps = [];

  for (let year = startYear; year <= endYear; year++) {
    const center = centerDateForYear(year, month, day);
    const from = new Date(center); from.setUTCDate(from.getUTCDate() - 15);
    const to = new Date(center); to.setUTCDate(to.getUTCDate() + 15);
    let total = 0, rainDays = 0;
    for (let cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = dateKey(cursor);
      const r = validValue(rain[key]);
      const hi = validValue(tmax[key]);
      const lo = validValue(tmin[key]);
      if (r !== null) { total += Math.max(0, r); rainDays++; dailyRain.push(Math.max(0, r)); }
      if (hi !== null) dailyHighTemps.push(hi);
      if (lo !== null) dailyLowTemps.push(lo);
      if (hi !== null && lo !== null) dailyMeanTemps.push((hi + lo) / 2);
    }
    if (rainDays >= 25) windowTotals.push(total * 31 / rainDays);
  }

  if (!windowTotals.length || !dailyRain.length || !dailyHighTemps.length || !dailyLowTemps.length) {
    throw new Error("NASA POWER daily data did not contain enough valid observations for the ±15-day seasonal window.");
  }

  const mean31DayRain = windowTotals.reduce((a,b)=>a+b,0) / windowTotals.length;
  const meanDailyTemp = dailyMeanTemps.length ? dailyMeanTemps.reduce((a,b)=>a+b,0)/dailyMeanTemps.length : null;
  return {
    ok: true,
    source: "NASA POWER daily",
    startYear,
    endYear,
    queryMonth: month,
    queryDay: day,
    windowDays: 31,
    windowLabel: "15 days before through 15 days after the query date",
    yearsAnalysed: windowTotals.length,
    mean31DayRain,
    expected7d: mean31DayRain * 7 / 31,
    highest24hRain: Math.max(...dailyRain),
    lowest24hRain: Math.min(...dailyRain),
    highestDailyMaxTemp: Math.max(...dailyHighTemps),
    lowestDailyMinTemp: Math.min(...dailyLowTemps),
    meanDailyTemp
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed. Use GET." });
  const lat = Number(req.query?.lat);
  const lon = Number(req.query?.lon);
  const years = Number(req.query?.years || 25);
  const now = new Date();
  const month = Number(req.query?.month || (now.getUTCMonth() + 1));
  const day = Number(req.query?.day || now.getUTCDate());
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return json(res, 400, { ok:false, error:"Latitude must be between -90 and 90." });
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return json(res, 400, { ok:false, error:"Longitude must be between -180 and 180." });
  if (!ALLOWED_YEARS.has(years)) return json(res, 400, { ok:false, error:"Years must be 10, 20 or 25." });
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) return json(res, 400, { ok:false, error:"Month/day query date is invalid." });

  const endYear = new Date().getUTCFullYear() - 1;
  const startYear = endYear - years + 1;
  // Include neighbouring calendar years because a ±15-day window can cross New Year.
  const fetchStartYear = startYear - 1;
  const fetchEndYear = endYear + 1;
  const start = `${fetchStartYear}0101`;
  const end = `${fetchEndYear}1231`;

  try {
    let data;
    let lastError;
    const parameterSets = ["PRECTOTCORR,T2M_MAX,T2M_MIN", "PRECTOT,T2M_MAX,T2M_MIN"];
    for (const community of ["AG", "SB"]) {
      for (const parameterSet of parameterSets) {
        try {
          data = await requestDaily(parameterSet, community, lat, lon, start, end);
          const params = getParameterMap(data);
          const rainKey = parameterSet.startsWith("PRECTOTCORR") ? "PRECTOTCORR" : "PRECTOT";
          if (params?.[rainKey] && params?.T2M_MAX && params?.T2M_MIN) {
            const summary = buildSeasonalSummary({ ...params, [rainKey]: params[rainKey] }, startYear, endYear, month, day);
            summary.precipitationParameter = rainKey;
            return json(res, 200, summary);
          }
          lastError = new Error(`NASA POWER daily response did not include ${parameterSet} for community ${community}.`);
        } catch (error) { lastError = error; }
      }
    }
    throw lastError || new Error("NASA POWER daily data unavailable.");
  } catch (error) {
    console.error("HyperFlood seasonal baseline error:", error);
    return json(res, 502, { ok:false, error:"NASA POWER daily seasonal data could not be loaded.", detail:error.message });
  }
}
