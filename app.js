import { NEIGHBORHOOD_POINTS } from "./neighborhood-points.js";

const DATA_URL = "https://data.cityofchicago.org/resource/igwz-8jzy.geojson?$limit=100";
const CHICAGO_CENTER = [41.84, -87.68];
const CLEAR_PASSWORD_HASH = "339319de11cc80f80baa79065f9dc62ad6bf16fb39768f701914296458099254";
const normalizeName = value => String(value).trim().toLowerCase().replace(/[^a-z0-9]/g,"");
const POINTS_BY_NAME = new Map(Object.entries(NEIGHBORHOOD_POINTS).map(([name,points])=>[normalizeName(name),points]));
const map = L.map("map", { zoomControl: false, minZoom: 9 }).setView(CHICAGO_CENTER, 10);
L.control.zoom({ position: "bottomleft" }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 19 }).addTo(map);

const els = Object.fromEntries(["search","results","panel","emptyState","detailState","areaName","ownerCard","claimForm","teamPicker","actionButton","actionHint","message","closePanel","notifyButton","leaderboardButton","clearBoardButton","gameMenu","leaderboardDialog","closeLeaderboard","leaderboardRows","clearBoardDialog","clearBoardForm","closeClearBoard","clearBoardPassword","clearBoardError","confirmClearBoard","connectionDot","connectionText"].map(id => [id, document.getElementById(id)]));
let areas = [], layerById = new Map(), claims = {}, selected = null, db = null, firebaseApi = null;
let deviceId = localStorage.getItem("claimChicagoDeviceId") || crypto.randomUUID();
let selectedTeam = localStorage.getItem("claimChicagoTeam") || "";
localStorage.setItem("claimChicagoDeviceId", deviceId);

const areaName = f => (f.properties.community || f.properties.name || f.properties.pri_neigh || "Unknown").trim();
const areaId = f => String(f.properties.area_num_1 || f.properties.area_numbe || areaName(f)).toLowerCase().replace(/[^a-z0-9]+/g,"-");
const pointsFor = feature => POINTS_BY_NAME.get(normalizeName(areaName(feature))) || 0;
const mine = claim => claim?.deviceId === deviceId;
const ownerColor = name => {
  const teamColors = { "Team 1":"#e45745", "Team 2":"#3f7fc4", "Team 3":"#2f9a74" };
  if (teamColors[name]) return teamColors[name];
  const palette = ["#8c62bd","#e18a2d","#d05f91","#7277d8","#8b8f32","#b56b3e"];
  let hash = 0;
  for (const char of String(name || "" ).trim().toLowerCase()) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
};
const styleFor = feature => { const claim=claims[areaId(feature)]; return { color: selected===areaId(feature)?"#172019":"#f7f3e9", weight:selected===areaId(feature)?3:1.4, fillColor:claim?ownerColor(claim.owner):"#9fb5a1", fillOpacity:claim ? 0.76 : 0.38 }; };

function setConnection(kind,text){ els.connectionDot.className=`dot ${kind}`; els.connectionText.textContent=text; }
function refreshStyles(){ layerById.forEach((layer,id)=>layer.setStyle(styleFor(areas.find(f=>areaId(f)===id)))); }
function renderTeamPicker(disabled=false){ document.querySelectorAll(".team-choice").forEach(button=>{button.classList.toggle("selected",button.dataset.team===selectedTeam);button.disabled=disabled;}); }
function renderLeaderboard(){
  const teams=["Team 1","Team 2","Team 3"].map(team=>{const teamClaims=Object.entries(claims).filter(([,claim])=>claim.owner===team);return{team,count:teamClaims.length,points:teamClaims.reduce((sum,[id])=>{const feature=areas.find(item=>areaId(item)===id);return sum+(feature?pointsFor(feature):0);},0)}}).sort((a,b)=>b.points-a.points||b.count-a.count||a.team.localeCompare(b.team));
  els.leaderboardRows.innerHTML=teams.map((entry,index)=>`<div class="leaderboard-row"><span class="rank">${index+1}</span><span class="team-dot" style="background:${ownerColor(entry.team)}"></span><span class="team-label"><strong>${entry.team}</strong><small>${entry.count===1?"1 neighborhood":`${entry.count} neighborhoods`}</small></span><span class="score-wrap"><strong class="team-score">${entry.points}</strong><small>pts</small></span></div>`).join("");
}
function renderPanel(){
  els.emptyState.hidden=!!selected; els.detailState.hidden=!selected; els.panel.classList.toggle("empty",!selected); if(!selected)return;
  const feature=areas.find(f=>areaId(f)===selected), claim=claims[selected]; els.areaName.textContent=areaName(feature);
  const points=pointsFor(feature); els.ownerCard.innerHTML=claim?`<span class="owner-color" style="background:${ownerColor(claim.owner)}"></span><div><strong>${mine(claim)?`Claimed by you · ${escapeHtml(claim.owner)}`:`Held by ${escapeHtml(claim.owner)}`}</strong><small>${points} ${points===1?"point":"points"} · ${new Date(claim.updatedAt).toLocaleString()}</small></div>`:`<div><strong>Available to claim</strong><small>Worth ${points} ${points===1?"point":"points"}</small></div>`;
  els.actionButton.textContent=claim?(mine(claim)?"Forfeit neighborhood":"Already claimed"):"Claim neighborhood"; els.actionButton.disabled=(!!claim&&!mine(claim))||(!claim&&!selectedTeam); els.actionButton.classList.toggle("danger",mine(claim));
  renderTeamPicker(!!claim); els.actionHint.textContent=claim&&!mine(claim)?"Only the current holder can forfeit it.":!claim&&!selectedTeam?"Choose a team to claim this neighborhood.":"Changes appear for everyone connected to the live map."; els.message.textContent="";
}
function selectArea(id,zoom=true){ selected=id; const layer=layerById.get(id); if(zoom&&layer)map.fitBounds(layer.getBounds(),{padding:[35,35],maxZoom:13}); renderPanel();refreshStyles();els.results.hidden=true; }
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function search(q){ const term=q.trim().toLowerCase(); const found=(term?areas.filter(f=>areaName(f).toLowerCase().includes(term)):areas).slice(0,10); els.results.innerHTML=found.map(f=>{const id=areaId(f),c=claims[id];return `<button class="result" data-id="${id}"><span>${escapeHtml(areaName(f))}</span><small>${pointsFor(f)} pts · ${c?mine(c)?"Yours":`Held · ${escapeHtml(c.owner)}`:"Available"}</small></button>`}).join(""); els.results.hidden=!term; }

async function initFirebase(){
  const config=window.CLAIM_CHICAGO_FIREBASE_CONFIG; if(!config){ claims=JSON.parse(localStorage.getItem("claimChicagoClaims")||"{}");setConnection("demo","Demo mode · add Firebase for shared updates");return; }
  try { const appApi=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"), dbApi=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"); const app=appApi.initializeApp(config);db=dbApi.getDatabase(app);firebaseApi=dbApi;
    dbApi.onValue(dbApi.ref(db,"claims"),snap=>{const before={...claims};claims=snap.val()||{};refreshStyles();renderPanel();renderLeaderboard();search(els.search.value);notifyChanges(before,claims);setConnection("live","Live · updates appear instantly");});
  } catch(e){ console.error(e);setConnection("demo","Connection failed · using this device only");claims=JSON.parse(localStorage.getItem("claimChicagoClaims")||"{}"); }
}
async function updateClaim(id,next){
  if(db){ const ref=firebaseApi.ref(db,`claims/${id}`); const result=await firebaseApi.runTransaction(ref,current=>{ if(next===null)return current?.deviceId===deviceId?null:undefined; return current?undefined:next; }); if(!result.committed)throw new Error("That neighborhood changed before your request finished. Try again."); }
  else { if(next&&claims[id])throw new Error("This neighborhood is already claimed."); if(next===null&&!mine(claims[id]))throw new Error("Only the current holder can forfeit this area."); if(next===null)delete claims[id];else claims[id]=next;localStorage.setItem("claimChicagoClaims",JSON.stringify(claims));refreshStyles();renderPanel(); }
}
async function hashText(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
async function clearBoard(event){
  event.preventDefault(); els.clearBoardError.textContent="";
  if(await hashText(els.clearBoardPassword.value)!==CLEAR_PASSWORD_HASH){els.clearBoardError.textContent="Incorrect password.";els.clearBoardPassword.select();return;}
  els.confirmClearBoard.disabled=true;
  try{if(db){await firebaseApi.set(firebaseApi.ref(db,"claims"),null);}else{claims={};localStorage.removeItem("claimChicagoClaims");refreshStyles();renderPanel();renderLeaderboard();search(els.search.value);}els.clearBoardDialog.close();els.clearBoardForm.reset();}
  catch(error){els.clearBoardError.textContent=`The board could not be cleared: ${error.message}`;}
  finally{els.confirmClearBoard.disabled=false;}
}
function notifyChanges(before,after){ if(Notification.permission!=="granted")return; Object.entries(after).forEach(([id,c])=>{if(!before[id]&&c.deviceId!==deviceId){const f=areas.find(x=>areaId(x)===id);if(f)new Notification(`${areaName(f)} was claimed`,{body:`${c.owner} now holds this neighborhood.`});}}); }

els.teamPicker.addEventListener("click",e=>{const button=e.target.closest("[data-team]");if(!button||button.disabled)return;selectedTeam=button.dataset.team;localStorage.setItem("claimChicagoTeam",selectedTeam);renderTeamPicker();renderPanel();});
els.claimForm.addEventListener("submit",async e=>{e.preventDefault();if(!selectedTeam&&!claims[selected])return;els.actionButton.disabled=true;try{const timestamp=Date.now();await updateClaim(selected,claims[selected]?null:{owner:selectedTeam,deviceId,updatedAt:timestamp,timestamp});renderLeaderboard();}catch(err){els.message.textContent=err.message;els.message.className="message error";}finally{renderPanel();}});
els.search.addEventListener("input",e=>search(e.target.value)); els.results.addEventListener("click",e=>{const b=e.target.closest("[data-id]");if(b)selectArea(b.dataset.id);});
document.addEventListener("click",e=>{if(!e.target.closest(".search-wrap"))els.results.hidden=true;});els.closePanel.addEventListener("click",()=>{selected=null;renderPanel();refreshStyles();map.setView(CHICAGO_CENTER,10);});
els.notifyButton.addEventListener("click",async()=>{ if(!("Notification" in window)){els.notifyButton.querySelector("b").textContent="Alerts unsupported";return;} const p=await Notification.requestPermission();els.notifyButton.querySelector("b").textContent=p==="granted"?"Alerts on":"Alerts blocked";els.gameMenu.open=false;});
els.leaderboardButton.addEventListener("click",()=>{renderLeaderboard();els.gameMenu.open=false;els.leaderboardDialog.showModal();});els.closeLeaderboard.addEventListener("click",()=>els.leaderboardDialog.close());els.leaderboardDialog.addEventListener("click",e=>{if(e.target===els.leaderboardDialog)els.leaderboardDialog.close();});
els.clearBoardButton.addEventListener("click",()=>{els.gameMenu.open=false;els.clearBoardError.textContent="";els.clearBoardPassword.value="";els.clearBoardDialog.showModal();els.clearBoardPassword.focus();});els.clearBoardForm.addEventListener("submit",clearBoard);els.closeClearBoard.addEventListener("click",()=>els.clearBoardDialog.close());els.clearBoardDialog.addEventListener("click",e=>{if(e.target===els.clearBoardDialog)els.clearBoardDialog.close();});
if("Notification" in window&&Notification.permission==="granted")els.notifyButton.querySelector("b").textContent="Alerts on";

async function init(){
  try { const response=await fetch(DATA_URL);if(!response.ok)throw new Error("Boundary request failed");const geo=await response.json();areas=geo.features.sort((a,b)=>areaName(a).localeCompare(areaName(b)));
    L.geoJSON(geo,{style:styleFor,onEachFeature:(f,l)=>{const id=areaId(f);layerById.set(id,l);l.bindTooltip(areaName(f),{sticky:true,direction:"top"});l.on({click:()=>selectArea(id,false),mouseover:()=>l.setStyle({weight:3}),mouseout:()=>refreshStyles()});}}).addTo(map);await initFirebase();refreshStyles();renderTeamPicker();renderLeaderboard();
  } catch(e){console.error(e);setConnection("demo","Could not load Chicago boundaries");els.emptyState.querySelector("p:not(.eyebrow)").textContent="The city boundary data could not load. Check your connection and refresh.";}
}
init();
