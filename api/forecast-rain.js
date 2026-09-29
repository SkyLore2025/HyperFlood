const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

function send(res,status,body){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=1800");
  return res.status(status).json(body);
}
function sum(values,n){ return values.slice(0,n).reduce((a,v)=>a+(Number.isFinite(v)?v:0),0); }

export default async function handler(req,res){
  if(req.method!=="GET") return send(res,405,{ok:false,error:"Method not allowed. Use GET."});
  const lat=Number(req.query?.lat), lon=Number(req.query?.lon);
  if(!Number.isFinite(lat)||lat < -90||lat > 90) return send(res,400,{ok:false,error:"Invalid latitude."});
  if(!Number.isFinite(lon)||lon < -180||lon > 180) return send(res,400,{ok:false,error:"Invalid longitude."});
  try{
    const url=new URL(FORECAST_URL);
    url.searchParams.set("latitude",lat.toFixed(5));
    url.searchParams.set("longitude",lon.toFixed(5));
    url.searchParams.set("hourly","precipitation");
    url.searchParams.set("forecast_hours","168");
    url.searchParams.set("precipitation_unit","mm");
    url.searchParams.set("timezone","UTC");
    const response=await fetch(url,{headers:{Accept:"application/json"}});
    const data=await response.json();
    if(!response.ok) throw new Error(data?.reason || `Forecast service returned ${response.status}`);
    const times=data?.hourly?.time || [], raw=data?.hourly?.precipitation || [];
    const values=raw.map(Number).map(v=>Number.isFinite(v)&&v>=0?v:0);
    if(values.length < 48) throw new Error("Too few forecast precipitation hours were returned.");
    const usable=Math.min(168,values.length);
    const seven=values.slice(0,usable);
    let peak=0, peakIndex=0;
    seven.forEach((v,i)=>{if(v>peak){peak=v;peakIndex=i;}});
    return send(res,200,{
      ok:true, source:"Open-Meteo Weather Forecast API", modelLabel:"best-match global forecast",
      latitude:data.latitude, longitude:data.longitude,
      total24h:sum(values,24), total48h:sum(values,48), total7d:sum(values,usable),
      peakHourly:peak, peakTime:times[peakIndex] || null, hourCount:usable
    });
  }catch(error){
    console.error("HyperFlood forecast proxy error:",error);
    return send(res,502,{ok:false,error:"Forecast precipitation could not be loaded.",detail:error.message});
  }
}
