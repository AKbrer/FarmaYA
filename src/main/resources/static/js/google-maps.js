/* Mapa gratuito Leaflet + OpenStreetMap, sin clave ni facturación de Google. */
let farmayaLeafletPromise;
function loadLeaflet(){
  if(window.L?.map) return Promise.resolve(window.L);
  if(farmayaLeafletPromise) return farmayaLeafletPromise;
  farmayaLeafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-farmaya-leaflet]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.dataset.farmayaLeaflet='1';document.head.appendChild(css);
    }
    const finish=()=>{if(window.L?.map)resolve(window.L);else{farmayaLeafletPromise=null;reject(new Error('No se pudo cargar Leaflet. Comprueba la conexión a Internet.'));}};
    if(window.L?.map)return finish();
    const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.async=true;script.onload=finish;script.onerror=()=>{farmayaLeafletPromise=null;reject(new Error('No se pudo descargar Leaflet.'));};document.head.appendChild(script);
  });
  return farmayaLeafletPromise;
}
function farmayaGetPosition(){return new Promise((resolve,reject)=>{
  if(!navigator.geolocation)return reject(new Error('Este navegador no permite obtener la ubicación.'));
  navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),e=>reject(new Error(e.code===1?'Permiso de ubicación denegado. Puedes seleccionar el punto manualmente.':'No se pudo determinar la ubicación. Selecciona el punto manualmente.')),{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
});}
async function reverseGeocode(position){
  try{const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(position.lat)+'&lon='+encodeURIComponent(position.lng);const r=await fetch(u,{headers:{'Accept':'application/json'}});if(!r.ok)return null;const d=await r.json();const a=d.address||{};return {address:d.display_name||'',city:a.city||a.town||a.village||a.municipality||a.county||''};}catch(_){return null;}
}
