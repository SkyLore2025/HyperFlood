const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
  return res.status(status).json(body);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R=6371000, rad=x=>x*Math.PI/180;
  const dLat=rad(lat2-lat1), dLon=rad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

function pointSegmentDistanceMeters(lat, lon, a, b) {
  // Local equirectangular projection is accurate enough for this 5 km scan.
  const R=6371000, k=Math.PI/180, c=Math.cos(lat*k);
  const ax=(a.lon-lon)*k*R*c, ay=(a.lat-lat)*k*R;
  const bx=(b.lon-lon)*k*R*c, by=(b.lat-lat)*k*R;
  const vx=bx-ax, vy=by-ay;
  const t=Math.max(0,Math.min(1, -(ax*vx+ay*vy)/(vx*vx+vy*vy || 1)));
  return Math.hypot(ax+t*vx, ay+t*vy);
}

function distanceToGeometry(lat, lon, geometry=[]) {
  if (!geometry.length) return Infinity;
  if (geometry.length===1) return haversine(lat,lon,geometry[0].lat,geometry[0].lon);
  let best=Infinity;
  for(let i=1;i<geometry.length;i++) best=Math.min(best,pointSegmentDistanceMeters(lat,lon,geometry[i-1],geometry[i]));
  return best;
}

export default async function handler(req,res){
  if(req.method!=="GET") return send(res,405,{ok:false,error:"Use GET."});
  const lat=Number(req.query?.lat), lon=Number(req.query?.lon);
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180) return send(res,400,{ok:false,error:"Valid lat/lon required."});
  const radius=5000;
  const q=`[out:json][timeout:18];(way["waterway"~"^(river|stream|canal|drain|ditch)$"](around:${radius},${lat},${lon}););out tags geom;`;
  let data=null,lastError=null;
  for(const endpoint of OVERPASS_ENDPOINTS){
    try{
      const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json","User-Agent":"HyperFlood-Education-Prototype/10"},body:new URLSearchParams({data:q}).toString()});
      if(!r.ok) throw new Error(`Overpass ${r.status}`);
      data=await r.json(); break;
    }catch(e){lastError=e;}
  }
  if(!data) return send(res,502,{ok:false,error:"Mapped waterway service unavailable.",detail:lastError?.message});
  const features=(data.elements||[]).filter(e=>Array.isArray(e.geometry)&&e.geometry.length).map(e=>({
    id:e.id, name:e.tags?.name||null, type:e.tags?.waterway||"waterway",
    distanceM:distanceToGeometry(lat,lon,e.geometry),
    geometry:e.geometry.map(p=>({lat:p.lat,lon:p.lon}))
  })).sort((a,b)=>a.distanceM-b.distanceM);
  const nearest=features[0] ? {id:features[0].id,name:features[0].name,type:features[0].type,distanceM:Math.round(features[0].distanceM)} : null;
  return send(res,200,{ok:true,source:"OpenStreetMap via Overpass",radiusM:radius,count:features.length,nearest,features:features.slice(0,30)});
}
