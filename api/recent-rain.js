const NASA_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";

function json(res,status,body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Cache-Control","public, s-maxage=1800, stale-while-revalidate=3600");
  return res.status(status).json(body);
}
function ymd(d){ return d.toISOString().slice(0,10).replaceAll("-",""); }
async function requestDaily(parameter,lat,lon,start,end){
  const u=new URL(NASA_DAILY_URL);
  u.searchParams.set("parameters",parameter); u.searchParams.set("community","AG");
  u.searchParams.set("longitude",Number(lon).toFixed(5)); u.searchParams.set("latitude",Number(lat).toFixed(5));
  u.searchParams.set("start",start); u.searchParams.set("end",end); u.searchParams.set("format","JSON"); u.searchParams.set("time-standard","UTC");
  const r=await fetch(u.toString(),{headers:{Accept:"application/json"}}); const t=await r.text();
  let d=null; try{d=JSON.parse(t)}catch(_){}
  if(!r.ok) throw new Error(`NASA POWER ${r.status}: ${d?.message || t.slice(0,250)}`);
  return d;
}
export default async function handler(req,res){
  if(req.method==="OPTIONS") return json(res,204,{});
  if(req.method!=="GET") return json(res,405,{error:"Method not allowed. Use GET."});
  const lat=Number(req.query?.lat), lon=Number(req.query?.lon);
  if(!Number.isFinite(lat)||lat < -90||lat > 90) return json(res,400,{error:"Latitude must be between -90 and 90."});
  if(!Number.isFinite(lon)||lon < -180||lon > 180) return json(res,400,{error:"Longitude must be between -180 and 180."});
  const end=new Date(); const start=new Date(end.getTime()-21*86400000);
  try{
    let data, parameter="PRECTOTCORR";
    try{ data=await requestDaily(parameter,lat,lon,ymd(start),ymd(end)); }
    catch(e){ parameter="PRECTOT"; data=await requestDaily(parameter,lat,lon,ymd(start),ymd(end)); }
    const values=data?.properties?.parameter?.[parameter] || data?.parameter?.[parameter];
    if(!values) throw new Error("NASA POWER returned no daily precipitation series.");
    const rows=Object.entries(values).filter(([k,v])=>/^\d{8}$/.test(k)&&Number.isFinite(Number(v))&&Number(v)>-900).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,value])=>({date,value:Math.max(0,Number(value))}));
    if(rows.length<7) throw new Error("Fewer than seven valid daily precipitation values were available.");
    const last7=rows.slice(-7), last3=rows.slice(-3), latest=rows.at(-1);
    const sum=a=>a.reduce((n,x)=>n+x.value,0);
    return json(res,200,{ok:true,source:"NASA POWER Daily API",parameter,latestDate:`${latest.date.slice(0,4)}-${latest.date.slice(4,6)}-${latest.date.slice(6,8)}`,latest1d:latest.value,total3d:sum(last3),total7d:sum(last7),wetDays7d:last7.filter(x=>x.value>=1).length,days:last7});
  }catch(error){
    console.error("HyperFlood recent precipitation proxy error:",error);
    return json(res,502,{ok:false,error:"NASA POWER recent precipitation could not be loaded.",detail:error.message});
  }
}
