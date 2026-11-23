import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';

const root=document.querySelector('#game'),loading=document.querySelector('#loading'),statusEl=document.querySelector('#status');
const scoreEl=document.querySelector('#score'),ammoEl=document.querySelector('#ammo'),healthEl=document.querySelector('#health');
const errorPanel=document.querySelector('#errorPanel');
let renderer,scene,camera,clock,playerRig,worldYaw=0,pitch=-.12,ammo=30,kills=0,health=100,armor=0,medkits=1;
// Personagem humanoide procedural original do Ilha de Combate; não carrega mais o GLB antigo.
const HUMAN_ROLE_CLIPS={idle:'Idle',walk:'Walk',run:'Walk',cast:'Boxing',hit:'Argue'};
const weapons=[
 {name:'FUZIL AR',category:'FUZIL',lengthCm:82,mag:30,damage:34,rate:.105,spread:.012,reload:1.45,modes:['SINGLE','BURST','AUTO'],range:105},
 {name:'SMG',category:'SUBMETRALHADORA',lengthCm:52,mag:40,damage:19,rate:.075,spread:.021,reload:1.35,modes:['SINGLE','AUTO'],range:62},
 {name:'SNIPER',category:'PRECISÃO',lengthCm:108,mag:8,damage:92,rate:.78,spread:.0015,reload:2.05,modes:['SINGLE'],range:180},
 {name:'ESCOPETA',category:'ESCOPETA',lengthCm:88,mag:6,damage:12,rate:.72,spread:.055,reload:1.85,modes:['SINGLE'],pellets:8,range:28},
 {name:'PISTOLA',category:'PISTOLA',lengthCm:29,mag:15,damage:25,rate:.22,spread:.018,reload:1.15,modes:['SINGLE'],range:48},
 {name:'METRALHADORA',category:'LEVE',lengthCm:98,mag:60,damage:22,rate:.095,spread:.025,reload:2.25,modes:['AUTO'],range:92}
];
let weaponIndex=0,weaponAmmo=[30,40,8,6,15,60],reserveAmmo=[120,160,32,36,75,180],scopeLevel=0,sprintHeld=false,fireMode='AUTO',burstRemaining=0,attachmentLevel=0;
function currentWeapon(){return weapons[weaponIndex]}
function setFireMode(next){const modes=currentWeapon().modes;fireMode=modes.includes(next)?next:modes[modes.length-1];const el=document.querySelector('#fireMode');if(el)el.textContent='MODO: '+fireMode;}
function cycleFireMode(){const modes=currentWeapon().modes;const i=modes.indexOf(fireMode);setFireMode(modes[(i+1)%modes.length]);statusEl.textContent='DISPARO '+fireMode;}
function refreshAmmo(){ammo=weaponAmmo[weaponIndex];ammoEl.textContent='MUNIÇÃO '+ammo;document.querySelector('#ammoLarge').textContent=ammo;document.querySelector('#ammoMag').textContent=currentWeapon().mag;document.querySelector('#ammoReserve').textContent=reserveAmmo[weaponIndex];document.querySelector('#weaponSwitch').textContent='ARMA: '+currentWeapon().name;setFireMode(fireMode);refreshInventory()}
function refreshInventory(){
 const panel=document.querySelector('#inventoryPanel');if(!panel)return;
 document.querySelector('#inventoryWeapons').innerHTML=weapons.map((w,i)=>'<div class="inventory-slot '+(i===weaponIndex?'equipped':'')+'"><b>'+(i+1)+'. '+w.name+'</b><span>'+weaponAmmo[i]+'/'+w.mag+' • reserva '+reserveAmmo[i]+'</span><small>'+w.category+' • DANO '+w.damage+' • '+w.rate.toFixed(2)+'s/tiro • '+w.lengthCm+' cm</small></div>').join('');
 document.querySelector('#inventorySupplies').textContent='Kits: '+medkits+' • Colete: '+Math.round(armor)+'% • Mira: '+scopeLevel+'x • Acessórios: '+attachmentLevel;
}
function toggleInventory(){
 const panel=document.querySelector('#inventoryPanel');const open=panel.classList.toggle('visible');
 document.querySelector('#inventoryToggle').textContent=open?'FECHAR MOCHILA':'MOCHILA';
 refreshInventory();
}
function switchWeapon(){if(reloadTimer>0)return;weaponIndex=(weaponIndex+1)%weapons.length;burstRemaining=0;setFireMode(fireMode);if(playerRig)addRifle(playerRig,weaponIndex);refreshAmmo();statusEl.textContent='EQUIPADO: '+currentWeapon().name}

const playerVelocity=new THREE.Vector3(),cameraLook=new THREE.Vector3(),_shotOrigin=new THREE.Vector3();
let safeRing=null,zoneElapsed=0,zoneDamageClock=0,lootItems=[];const worldObstacles=[];
const keys={forward:0,side:0},bullets=[],enemies=[],effects=[];const bulletGeometry=new THREE.CylinderGeometry(.012,.012,.72,5),bulletMaterial=new THREE.MeshBasicMaterial({color:0xffdf91,transparent:true,opacity:.92});let dustClock=0,recoil=0,aiming=false,aimBlend=0,hitMarkerTimer=0,fireHeld=false,fireCooldown=0,reloadTimer=0,movementMode='stand';
const BASE='https://raw.githubusercontent.com/NoLimitNexus/game-models/main/';
const defaultSettings={general:100,red:100,two:100,four:100,awm:100,look:100,autoFire:true,invertY:false,minimap:true,hudScale:100,hudOpacity:100,quality:'medium',shadows:false,vibration:false};
let gameSettings={...defaultSettings};
try{gameSettings={...defaultSettings,...JSON.parse(localStorage.getItem('ic-game-settings')||'{}')}}catch{}
let hudEditing=false,hudDrag=null;
function saveGameSettings(){try{localStorage.setItem('ic-game-settings',JSON.stringify(gameSettings));}catch{}}
function applyGraphicsSettings(){if(!renderer)return;const mobile=innerWidth<700;const q={low:{ratio:mobile?.76:.9,shadows:false},medium:{ratio:mobile?.9:1,shadows:true},high:{ratio:mobile?.98:1.2},ultra:{ratio:mobile?1.05:1.4}}[gameSettings.quality]||{ratio:mobile?.76:.9,shadows:false};renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio));renderer.shadowMap.enabled=!!gameSettings.shadows&&!!q.shadows;renderer.shadowMap.needsUpdate=true;renderer.setSize(innerWidth,innerHeight);}
function applyHudSettings(){const hud=document.querySelector('#hud');if(!hud)return;hud.style.setProperty('--hud-scale',gameSettings.hudScale/100);hud.style.setProperty('--hud-opacity',gameSettings.hudOpacity/100);const map=document.querySelector('.minimap');if(map)map.style.display=gameSettings.minimap?'':'none';}
function initSettings(){
 const panel=document.querySelector('#settingsPanel'),open=()=>{panel.classList.add('open');panel.setAttribute('aria-hidden','false')},close=()=>{panel.classList.remove('open');panel.setAttribute('aria-hidden','true');if(hudEditing)toggleHudEditor(false)};
 document.querySelector('#openSettings').onclick=open;document.querySelector('#lobbySettings').onclick=open;document.querySelector('#closeSettings').onclick=close;document.querySelector('#settingsDone').onclick=close;
 panel.addEventListener('click',e=>{if(e.target===panel)close()});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('selected',x===b));document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===b.dataset.tab))});
 const ranges={general:'general',red:'red','2x':'two','4x':'four',awm:'awm',look:'look',hudscale:'hudScale',hudopacity:'hudOpacity'};
 Object.entries(ranges).forEach(([id,key])=>{const el=document.querySelector('#set-'+id);if(!el)return;el.value=gameSettings[key];const out=document.querySelector('#v-'+id);if(out)out.textContent=el.value+(key==='hudScale'||key==='hudOpacity'?'%':'');el.oninput=()=>{gameSettings[key]=Number(el.value);if(out)out.textContent=el.value+(key==='hudScale'||key==='hudOpacity'?'%':'');saveGameSettings();applyHudSettings()}});
 const checks={autofire:'autoFire',invert:'invertY',minimap:'minimap',shadows:'shadows',vibration:'vibration'};
 Object.entries(checks).forEach(([id,key])=>{const el=document.querySelector('#set-'+id);el.checked=!!gameSettings[key];el.onchange=()=>{gameSettings[key]=el.checked;saveGameSettings();applyHudSettings();applyGraphicsSettings()}});
 const quality=document.querySelector('#set-quality');quality.value=gameSettings.quality;quality.onchange=()=>{gameSettings.quality=quality.value;saveGameSettings();applyGraphicsSettings()};
 document.querySelector('#editHud').onclick=()=>toggleHudEditor(!hudEditing);
 document.querySelector('#resetHud').onclick=()=>{document.querySelectorAll('[data-hud-id]').forEach(el=>{el.style.left='';el.style.top='';el.style.right='';el.style.bottom='';el.style.position=''});try{localStorage.removeItem('ic-hud-layout')}catch{}};
 try{const saved=JSON.parse(localStorage.getItem('ic-hud-layout')||'{}');document.querySelectorAll('[data-hud-id]').forEach(el=>{const p=saved[el.dataset.hudId];if(p){el.style.position='fixed';el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.right='auto';el.style.bottom='auto'}})}catch{}
 const hud=document.querySelector('#hud');
 hud.addEventListener('pointerdown',e=>{if(!hudEditing)return;const el=e.target.closest('[data-hud-id]');if(!el)return;e.preventDefault();e.stopPropagation();const r=el.getBoundingClientRect();hudDrag={el,id:el.dataset.hudId,dx:e.clientX-r.left,dy:e.clientY-r.top};el.setPointerCapture?.(e.pointerId)});
 hud.addEventListener('pointermove',e=>{if(!hudDrag)return;e.preventDefault();const el=hudDrag.el;const x=Math.max(0,Math.min(innerWidth-el.offsetWidth,e.clientX-hudDrag.dx)),y=Math.max(0,Math.min(innerHeight-el.offsetHeight,e.clientY-hudDrag.dy));el.style.position='fixed';el.style.left=x+'px';el.style.top=y+'px';el.style.right='auto';el.style.bottom='auto'});
 const end=()=>{if(!hudDrag)return;let saved={};try{saved=JSON.parse(localStorage.getItem('ic-hud-layout')||'{}')}catch{}const r=hudDrag.el.getBoundingClientRect();saved[hudDrag.id]={x:r.left,y:r.top};try{localStorage.setItem('ic-hud-layout',JSON.stringify(saved))}catch{}hudDrag=null};hud.addEventListener('pointerup',end);hud.addEventListener('pointercancel',end);
 applyHudSettings();
}
function getAimSensitivity(){return [gameSettings.red,gameSettings.two,gameSettings.four,gameSettings.awm][Math.min(3,scopeLevel)]/100}
function getCameraSensitivity(){return (gameSettings.general/100)*(aiming?getAimSensitivity():(gameSettings.look/100))}
function toggleHudEditor(force){hudEditing=force;document.querySelector('#hud')?.classList.toggle('hud-editing',force);document.querySelector('#editHud').textContent=force?'CONCLUIR EDIÇÃO':'MOVER HUD';}


function mat(color,roughness=.86,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
const surfaceMaps={};
function makeSurfaceMap(kind){
 if(surfaceMaps[kind])return surfaceMaps[kind];
 const size=256,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');
 if(kind==='plaster'){
  ctx.fillStyle='#b9b4a4';ctx.fillRect(0,0,size,size);
  for(let i=0;i<5200;i++){const v=105+Math.random()*115;ctx.fillStyle='rgba('+Math.floor(v)+','+Math.floor(Math.max(0,v-5))+','+Math.floor(Math.max(0,v-15))+','+(.025+Math.random()*.09)+')';ctx.fillRect(Math.random()*size,Math.random()*size,1+Math.random()*3,1+Math.random()*3)}
  for(let i=0;i<18;i++){ctx.strokeStyle='rgba(75,70,58,.10)';ctx.lineWidth=1+Math.random()*2;ctx.beginPath();const x=Math.random()*size,y=Math.random()*size;ctx.moveTo(x,y);ctx.lineTo(x+(Math.random()-.5)*28,y+12+Math.random()*38);ctx.stroke()}
 }else if(kind==='roof'){
  ctx.fillStyle='#493b35';ctx.fillRect(0,0,size,size);
  const colors=['#715044','#805a49','#62473d','#8a6250'];
  for(let row=0;row<12;row++)for(let col=0;col<8;col++){const x=col*34+(row%2)*17,y=row*22;ctx.fillStyle=colors[(row*3+col)%colors.length];ctx.beginPath();ctx.roundRect(x+1,y+1,32,20,4);ctx.fill();ctx.strokeStyle='rgba(30,24,20,.45)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='rgba(255,225,190,.12)';ctx.fillRect(x+4,y+3,22,2)}
 }else{
  ctx.fillStyle='#705139';ctx.fillRect(0,0,size,size);
  for(let i=0;i<90;i++){ctx.strokeStyle=i%3?'rgba(38,24,14,.18)':'rgba(220,180,125,.16)';ctx.lineWidth=1+Math.random()*2;const y=Math.random()*size;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(70,y-5,160,y+7,size,y+(Math.random()-.5)*8);ctx.stroke()}
 }
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(innerWidth<700?2:8,renderer?.capabilities?.getMaxAnisotropy?.()||2);surfaceMaps[kind]=t;return t;
}
function box(parent,w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function addTextureGround(){
 const mobile=innerWidth<700,size=mobile?512:1024,speckles=mobile?14000:92000;
 const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');
 const grad=ctx.createLinearGradient(0,0,size,size);grad.addColorStop(0,'#71894c');grad.addColorStop(.52,'#637c42');grad.addColorStop(1,'#536f3e');ctx.fillStyle=grad;ctx.fillRect(0,0,1024,1024);
 for(let i=0;i<speckles;i++){const x=Math.random()*size,y=Math.random()*size,v=55+Math.random()*105,a=.035+Math.random()*.16;ctx.fillStyle='rgba('+Math.floor(v*.72)+','+Math.floor(v)+','+Math.floor(v*.46)+','+a+')';ctx.beginPath();ctx.ellipse(x,y,1+Math.random()*4,.7+Math.random()*2,Math.random()*3,0,Math.PI*2);ctx.fill()}
 for(let i=0;i<(mobile?55:180);i++){const x=Math.random()*size,y=Math.random()*size,r=8+Math.random()*35;const g=ctx.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,'rgba(42,65,35,.16)');g.addColorStop(1,'rgba(42,65,35,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(24,24);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(mobile?2:8,renderer.capabilities.getMaxAnisotropy());return t;
}
function addPalm(x,z,s=1){
 const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12*s,.24*s,4.2*s,12),mat(0x79543a));trunk.position.y=2.1*s;trunk.rotation.z=-.08;trunk.castShadow=true;g.add(trunk);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,leaf=new THREE.Mesh(new THREE.ConeGeometry(.3*s,3.1*s,7),mat(i%2?0x274e34:0x315f3a));leaf.position.set(Math.sin(a)*.95*s,4.05*s,Math.cos(a)*.95*s);leaf.rotation.z=Math.cos(a)*.95;leaf.rotation.x=-Math.sin(a)*.95;leaf.castShadow=true;g.add(leaf)}
 g.position.set(x,0,z);scene.add(g);
}
function addHouse(x,z,rotation=0,style=0,twoStorey=false){
 const g=new THREE.Group();
 const palettes=[
  {wall:0xd1c4a7,trim:0xf0e5ce,roof:0x714b3d,wood:0x65452f,glass:0x6da5ad,accent:0x9a7956},
  {wall:0xc3c9bd,trim:0xe7e6d8,roof:0x46515a,wood:0x594b3c,glass:0x77aeb8,accent:0x7a897d},
  {wall:0xd8b58d,trim:0xf2d7b5,roof:0x86543b,wood:0x69462f,glass:0x76aeb5,accent:0xa27a50},
  {wall:0xb8c3b9,trim:0xe0e2d7,roof:0x555047,wood:0x514638,glass:0x7da9ad,accent:0x788b7e}
 ];
 const p=palettes[Math.abs(style)%palettes.length],wall=mat(p.wall,.96),trim=mat(p.trim,.9),wood=mat(p.wood,.88),roof=mat(p.roof,.82),glass=new THREE.MeshStandardMaterial({color:p.glass,roughness:.16,metalness:.22}),accent=mat(p.accent,.9);
 wall.map=makeSurfaceMap('plaster');wall.map.repeat.set(2.2,1.3);wall.bumpMap=wall.map;wall.bumpScale=.045;wall.needsUpdate=true;roof.map=makeSurfaceMap('roof');roof.map.repeat.set(1.5,1.5);roof.bumpMap=roof.map;roof.bumpScale=.035;roof.needsUpdate=true;wood.map=makeSurfaceMap('wood');wood.map.repeat.set(1,1.4);wood.bumpMap=wood.map;wood.bumpScale=.025;wood.needsUpdate=true;
 const floor=mat(style%2?0x877b68:0x9b8c73,.98),interior=mat(0xc2b69e,.96),darkWood=mat(0x59432f,.9),metal=mat(0x454b49,.58,.35);
 // Fundação elevada, paredes claras e rodapé de pedra.
 box(g,6.65,.24,5.85,mat(0x77766c),0,.12,0);
 box(g,6.12,.16,5.28,floor,0,.29,0);
 box(g,6.08,.32,.24,accent,0,.48,-2.52);box(g,6.08,.32,.24,accent,0,.48,2.52);
 box(g,.24,.32,5.05,accent,-2.92,.48,0);box(g,.24,.32,5.05,accent,2.92,.48,0);
 // Paredes: frente com vão de porta e traseira com duas janelas de verdade.
 box(g,.95,2.62,.22,wall,-2.55,1.93,-2.52);box(g,1.66,2.62,.22,wall,0,1.93,-2.52);box(g,.95,2.62,.22,wall,2.55,1.93,-2.52);
 box(g,.22,2.62,5.05,wall,-2.92,1.93,0);box(g,.22,2.62,5.05,wall,2.92,1.93,0);
 // Paredes frontais recortadas para janelas reais nos dois lados da entrada.
 for(const sx of [-1,1]){
  const cx=sx*2.12;
  box(g,1.55,.58,.22,wall,cx,.78,2.52);
  box(g,1.55,.72,.22,wall,cx,2.88,2.52);
  box(g,.38,1.32,.22,wall,cx-sx*.585,1.93,2.52);
  box(g,.38,1.32,.22,wall,cx+sx*.585,1.93,2.52);
 }
 box(g,2.95,.62,.22,wall,0,3.25,2.52);
 // Porta de madeira com moldura e puxador.
 const doorPivot=new THREE.Group();doorPivot.position.set(-1.02,0,2.64);doorPivot.rotation.y=-.82;g.add(doorPivot);
 box(doorPivot,1.02,2.12,.13,wood,.51,1.36,0);box(doorPivot,.82,1.88,.035,accent,.51,1.36,.08);
 for(let k=0;k<3;k++)box(doorPivot,.7,.035,.045,trim,.51,.78+k*.48,.11);
 const knob=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),metal);knob.position.set(.88,1.35,.13);doorPivot.add(knob);
 // Janelas frontais com vidro, caixilho, peitoril e venezianas.
 for(const sx of [-1,1]){
  const wx=sx*2.52;
  box(g,.72,1.12,.055,wood,wx,1.92,2.66);box(g,.58,.96,.035,glass,wx,1.92,2.70);
  box(g,.045,.98,.045,trim,wx,1.92,2.73);box(g,.62,.045,.045,trim,wx,1.92,2.73);
  box(g,.82,.09,.22,wood,wx,1.34,2.73);
  for(let k=0;k<3;k++)box(g,.62,.035,.035,accent,wx,1.62+k*.13,2.75);
 }
 box(g,1.55,.16,.5,trim,0,.12,2.92);box(g,1.82,.13,.58,accent,0,.07,3.13);
 // Janelas traseiras: vãos com vidro, caixilho, divisórias e venezianas.
 for(const sx of [-1,1]){
  const wx=sx*1.52;
  box(g,1.38,.16,.24,wall,wx,2.75,-2.52);
  box(g,1.38,.16,.24,wall,wx,.99,-2.52);
  box(g,.16,1.6,.24,wall,wx- .69,1.87,-2.52);
  box(g,.16,1.6,.24,wall,wx+ .69,1.87,-2.52);
  box(g,1.18,1.38,.055,wood,wx,1.87,-2.61);
  box(g,1.02,1.2,.035,glass,wx,1.87,-2.65);
  box(g,.055,1.18,.045,trim,wx,1.87,-2.68);
  box(g,1.02,.055,.045,trim,wx,1.87,-2.68);
  box(g,.055,1.2,.045,wood,wx-.34,1.87,-2.69);box(g,.055,1.2,.045,wood,wx+.34,1.87,-2.69);
  box(g,1.42,.12,.3,wood,wx,1.05,-2.68);
  box(g,1.42,.1,.24,trim,wx,2.69,-2.6);
 }
 // Detalhes de fachada: pilares, vigas, luminária e pequenas marcas de desgaste.
 for(const sx of [-1,1]){
  box(g,.13,2.55,.16,trim,sx*2.78,1.92,2.65);
  box(g,.16,.18,.16,wood,sx*2.78,3.22,2.65);
 }
 box(g,6.08,.12,.12,trim,0,2.82,2.65);
 box(g,.24,.36,.18,metal,0,2.55,2.72);
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshStandardMaterial({color:0xffd58a,emissive:0x8d5722,emissiveIntensity:.22}));lamp.position.set(0,2.35,2.78);g.add(lamp);
 // Mobiliário interno, distribuído sem bloquear o corredor de entrada.
 box(g,1.65,.22,.88,darkWood,-1.55,.53,-1.25);box(g,1.48,.16,.72,interior,-1.55,.72,-1.25);
 box(g,.13,.58,.13,darkWood,-2.2,.29,-1.55);box(g,.13,.58,.13,darkWood,-.9,.29,-1.55);
 box(g,.9,.72,.52,wood,1.82,.66,-1.58);box(g,.96,.12,.58,trim,1.82,1.05,-1.58);
 box(g,1.15,.12,.72,darkWood,.2,.82,-.55);
 for(const sx of [-.27,.67])for(const sz of [-.95,-.45])box(g,.09,.75,.09,darkWood,.2+sx,.38,-.55+sz);
 box(g,1.25,.12,.32,wood,-1.65,1.18,.25);
 for(let k=0;k<3;k++)box(g,.08,.48,.3,darkWood,-2.18+k*.48,.88,.25);
 // Segundo pavimento em casas selecionadas: paredes, laje, janelas e sacada.
 const roofLift=twoStorey?2.78:0;
 if(twoStorey){
  box(g,6.18,.2,5.35,floor,0,3.12,0);
  box(g,6.08,2.55,.22,wall,0,4.48,-2.52);box(g,6.08,2.55,.22,wall,0,4.48,2.52);
  box(g,.22,2.55,5.05,wall,-2.92,4.48,0);box(g,.22,2.55,5.05,wall,2.92,4.48,0);
  for(const sx of [-1,1]){
   const wx=sx*1.52;
   box(g,1.32,1.35,.05,glass,wx,4.55,2.66);box(g,1.48,1.5,.08,wood,wx,4.55,2.62);
   box(g,.06,1.42,.06,trim,wx,4.55,2.7);box(g,1.35,.06,.06,trim,wx,4.55,2.7);
   box(g,1.32,1.35,.05,glass,wx,4.55,-2.62);box(g,1.48,1.5,.08,wood,wx,4.55,-2.58);
   box(g,.06,1.42,.06,trim,wx,4.55,-2.7);box(g,1.35,.06,.06,trim,wx,4.55,-2.7);
  }
  box(g,2.45,.14,1.05,wood,0,3.25,3.35);
  for(const sx of [-1,1])box(g,.1,.95,.1,trim,sx*1.05,3.75,3.75);
  box(g,2.15,.1,.1,wood,0,4.18,3.75);
  // Escada externa em degraus como elemento arquitetônico visível.
  for(let k=0;k<9;k++)box(g,1.05,.12,.38,accent,-2.15, .18+k*.27,2.85-k*.38);
 }
 // Telhado inclinado com telhas em faixas, beirais e cumeeira.
 const roofA=new THREE.Mesh(new THREE.BoxGeometry(3.58,.2,6.15),roof);roofA.position.set(-1.52,3.16+roofLift,0);roofA.rotation.z=-.48;roofA.castShadow=true;roofA.receiveShadow=true;g.add(roofA);
 const roofB=new THREE.Mesh(new THREE.BoxGeometry(3.58,.2,6.15),roof);roofB.position.set(1.52,3.16+roofLift,0);roofB.rotation.z=.48;roofB.castShadow=true;roofB.receiveShadow=true;g.add(roofB);
 for(let side of [-1,1])for(let row=0;row<7;row++){
  const z=-2.7+row*.9;
  const tile=new THREE.Mesh(new THREE.BoxGeometry(3.25,.035,.055),accent);tile.position.set(side*-1.52,3.22+roofLift-Math.abs(z)*.0,z);tile.rotation.z=side*-.48;g.add(tile);
 }
 box(g,.22,.22,6.25,trim,0,3.98+roofLift,0);
 box(g,.14,.12,6.15,metal,-3.1,2.78+roofLift,0);box(g,.14,.12,6.15,metal,3.1,2.78+roofLift,0);
 box(g,.62,.85,.62,accent,-1.75,3.55+roofLift,-1.2);box(g,.72,.14,.72,metal,-1.75,4.02+roofLift,-1.2);
 // Varanda, guarda-corpo e escada de acesso.
 box(g,2.5,.16,1.42,wood,0,.22,3.55);
 for(const sx of [-1,1])box(g,.12,1.05,.12,trim,sx*1.08,.78,4.12);
 box(g,2.2,.12,.12,wood,0,1.28,4.12);
 for(let k=0;k<3;k++)box(g,.12,.07,.42,accent,0,.12+k*.11,3.3+k*.14);
 g.scale.setScalar(1.38);g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);
 worldObstacles.push({type:'house',x,z,rotation,halfWidth:4.18,halfDepth:3.62,twoStorey});
}
function addRoadNetwork(){
 // Estradas de terra batida com acostamento, conectando os pequenos bairros.
 const roadMat=mat(0x887c62,.98),edgeMat=mat(0xb5a17a,.98),trackMat=mat(0x655b49,1);
 const paths=[
  [[-112,58],[-78,38],[-42,18],[-8,2],[28,-10],[65,-28],[108,-58]],
  [[-82,-88],[-55,-54],[-25,-25],[5,4],[35,42],[62,76],[94,102]],
  [[-105,4],[-68,0],[-32,-4],[8,-3],[48,5],[88,18]]
 ];
 for(const pts of paths){
  const curve=new THREE.CatmullRomCurve3(pts.map(([x,z])=>new THREE.Vector3(x,.045,z)));
  const road=new THREE.Mesh(new THREE.TubeGeometry(curve,100,3.15,8,false),roadMat);
  road.scale.y=.08;road.receiveShadow=true;scene.add(road);
  const left=new THREE.Mesh(new THREE.TubeGeometry(curve,100,3.55,8,false),edgeMat);
  left.scale.y=.025;left.position.y=-.025;left.receiveShadow=true;scene.add(left);
  // Marcas de rodas sutis ao longo do caminho.
  for(let t=.08;t<.96;t+=.075){
   const pt=curve.getPoint(t),tan=curve.getTangent(t),angle=Math.atan2(tan.x,tan.z);
   for(const side of [-1,1]){
    const rut=new THREE.Mesh(new THREE.BoxGeometry(.16,.018,2.2),trackMat);
    rut.position.set(pt.x+Math.cos(angle)*side*1.25,.075,pt.z-Math.sin(angle)*side*1.25);
    rut.rotation.y=angle;scene.add(rut);
   }
  }
 }
}
function addSettlementDetails(){
 const concrete=mat(0x777d79,.95),metal=mat(0x3d494d,.52,.58),wood=mat(0x76563a,.9),paint=mat(0xd5c6a0,.88);concrete.map=makeSurfaceMap('plaster');concrete.map.repeat.set(2,1);concrete.needsUpdate=true;wood.map=makeSurfaceMap('wood');wood.needsUpdate=true;
 // Galpão industrial com portas largas e telhado metálico.
 function warehouse(x,z,rot=0){
  const g=new THREE.Group();
  box(g,10,.24,8,concrete,0,.12,0);
  box(g,10,3.8,.28,mat(0x777f7d),0,2,-3.85);
  box(g,.28,3.8,7.7,mat(0x68716f),-4.85,2,0);
  box(g,.28,3.8,7.7,mat(0x68716f),4.85,2,0);
  box(g,2.1,3.8,.28,mat(0x777f7d),-3.95,2,3.85);
  box(g,2.1,3.8,.28,mat(0x777f7d),3.95,2,3.85);
  box(g,5.7,.18,.34,metal,0,3.92,3.9);
  box(g,5.2,3.1,.12,metal,0,1.75,4.02);
  for(let i=0;i<5;i++)box(g,.055,3,.08,paint,-2.05+i*1.02,1.75,4.1);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(10.5,.24,8.5),metal);roof.position.y=4.05;roof.castShadow=true;g.add(roof);
  for(let i=0;i<9;i++)box(g,10.2,.035,.035,paint,0,4.19,-3.7+i*.9);
  g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);worldObstacles.push({x,z,radius:6.25});
 }
 warehouse(48,26,.35);warehouse(-64,-38,-.45);
 // Pequeno posto de abastecimento e cobertura.
 const station=new THREE.Group();
 box(station,8,.22,6,concrete,0,.12,0);
 const canopy=box(station,9,.22,6.5,mat(0xb6b7a9,.55,.25),0,4.1,0);
 for(const x of [-3.7,3.7])for(const z of [-2.5,2.5])box(station,.2,4,.2,metal,x,2,z);
 for(const x of [-2.2,0,2.2]){
  const pump=new THREE.Group();
  box(pump,.82,1.35,.65,mat(0xe0dfd2,.55,.18),0,.72,0);
  box(pump,.66,.35,.08,mat(0x263b42,.35,.35),0,1.02,.36);
  box(pump,.09,.8,.08,metal,.36,.9,-.15);
  pump.position.set(x,.2,0);station.add(pump);
 }
 station.position.set(72,-6,0);scene.add(station);worldObstacles.push({x:72,z:-6,radius:5.1});
 // Cercas de madeira, postes e luminárias para marcar os assentamentos.
 for(const [cx,cz] of [[-12,-12],[22,9],[68,35],[-76,-42],[42,54]]){
  for(let i=0;i<8;i++){
   const x=cx-8+i*2.3;
   box(scene, .12,1.05,.12,wood,x,.52,cz-8);
   if(i<7)box(scene,2.3,.09,.12,wood,x+1.1,.48,cz-8);
   if(i<7)box(scene,2.3,.09,.12,wood,x+1.1,.82,cz-8);
  }
  for(const side of [-1,1]){
   const pole=new THREE.Group();
   box(pole,.12,3.4,.12,metal,0,1.7,0);box(pole,.8,.12,.12,metal,.32,3.25,0);
   const lamp=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshBasicMaterial({color:0xffe1a1}));
   lamp.position.set(.68,3.2,0);pole.add(lamp);
   pole.position.set(cx+side*10,0,cz+7);scene.add(pole);
  }
 }
 // Caixas, barris e paletes decorativos junto aos galpões.
 for(const [x,z] of [[43,30],[51,31],[-60,-42],[-68,-34],[70,-2],[74,-2]]){
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,1.05,12),mat(0x596d68,.55,.5));
  barrel.position.set(x,.53,z);barrel.castShadow=true;scene.add(barrel);
  box(scene,.95,.72,.9,wood,x+1.5,.36,z+.6);
 }
}
function addWorldDetail(){
 // Vegetação em instâncias: mais densidade visual com poucas chamadas de desenho.
 const dummy=new THREE.Object3D();
 const grassGeo=new THREE.ConeGeometry(.075,.62,4);
 const grassMat=new THREE.MeshStandardMaterial({color:0x526d43,roughness:1});
 const grass=new THREE.InstancedMesh(grassGeo,grassMat,innerWidth<700?1250:2600);
 let n=0;for(let i=0;i<(innerWidth<700?1250:2600);i++){const a=Math.random()*Math.PI*2,r=8+Math.random()*111,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x,z)>120)continue;dummy.position.set(x,.25,z);dummy.rotation.set((Math.random()-.5)*.18,Math.random()*Math.PI,0);const h=.55+Math.random()*.9;dummy.scale.set(.7,h,.7);dummy.updateMatrix();grass.setMatrixAt(n++,dummy.matrix)}grass.count=n;grass.instanceMatrix.needsUpdate=true;scene.add(grass);
 const bushGeo=new THREE.IcosahedronGeometry(1,1),bushMat=new THREE.MeshStandardMaterial({color:0x294b32,roughness:1});
 const bushes=new THREE.InstancedMesh(bushGeo,bushMat,innerWidth<700?210:420);n=0;
 for(let i=0;i<(innerWidth<700?210:420);i++){const a=Math.random()*Math.PI*2,r=12+Math.random()*105;dummy.position.set(Math.cos(a)*r,.55,Math.sin(a)*r);const q=.45+Math.random()*.8;dummy.scale.set(q*.9,q*.65,q);dummy.rotation.set(Math.random()*.3,Math.random()*6,Math.random()*.3);dummy.updateMatrix();bushes.setMatrixAt(n++,dummy.matrix)}bushes.count=n;bushes.instanceMatrix.needsUpdate=true;bushes.castShadow=true;scene.add(bushes);
 // Pedras maiores na costa para quebrar o horizonte plano.
 const cliffGeo=new THREE.DodecahedronGeometry(1,1),cliffMat=new THREE.MeshStandardMaterial({color:0x68766a,roughness:1});
 const cliffs=new THREE.InstancedMesh(cliffGeo,cliffMat,88);
 for(let i=0;i<88;i++){const a=i/88*Math.PI*2,r=127+Math.random()*8;dummy.position.set(Math.cos(a)*r,1.1,Math.sin(a)*r);const q=2+Math.random()*5;dummy.scale.set(q,q*(.7+Math.random()*.8),q*.8);dummy.rotation.set(Math.random()*.4,Math.random()*6,Math.random()*.4);dummy.updateMatrix();cliffs.setMatrixAt(i,dummy.matrix)}cliffs.instanceMatrix.needsUpdate=true;cliffs.castShadow=true;scene.add(cliffs);
 // Nuvens volumétricas simples no horizonte.
 const cloudGeo=new THREE.SphereGeometry(1,10,7),cloudMat=new THREE.MeshBasicMaterial({color:0xf4fbff,transparent:true,opacity:.62,depthWrite:false});
 const clouds=new THREE.InstancedMesh(cloudGeo,cloudMat,54);
 for(let i=0;i<54;i++){const a=i/9*Math.PI*2,r=205+(i%4)*18;dummy.position.set(Math.cos(a)*r,38+(i%5)*5,Math.sin(a)*r);dummy.scale.set(9+(i%3)*5,2.5+(i%2),5+(i%4)*2);dummy.rotation.y=a;dummy.updateMatrix();clouds.setMatrixAt(i,dummy.matrix)}clouds.instanceMatrix.needsUpdate=true;scene.add(clouds);
}
function buildWorld(){
 scene.background=new THREE.Color(0x8eaebd);scene.fog=new THREE.FogExp2(0xa8b7b0,.00105);
 scene.add(new THREE.HemisphereLight(0xdce9f0,0x354235,1.38));
 const ambient=new THREE.AmbientLight(0xdce2df,.18);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffe8ce,2.65);sun.position.set(-42,78,34);sun.castShadow=!!gameSettings.shadows&&gameSettings.quality!=='low';sun.shadow.mapSize.set(innerWidth<700?512:1024,innerWidth<700?512:1024);sun.shadow.camera.left=-165;sun.shadow.camera.right=165;sun.shadow.camera.top=165;sun.shadow.camera.bottom=-165;sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;sun.shadow.radius=innerWidth<700?2:3;sun.shadow.camera.near=1;sun.shadow.camera.far=260;scene.add(sun);
 const fill=new THREE.DirectionalLight(0x9db5c4,.42);fill.position.set(55,28,-48);scene.add(fill);
 const groundMap=addTextureGround();const groundMaterial=new THREE.MeshStandardMaterial({map:groundMap,roughness:.98});groundMaterial.bumpMap=groundMap;groundMaterial.bumpScale=.055;const ground=new THREE.Mesh(new THREE.PlaneGeometry(800,800),groundMaterial);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const beach=new THREE.Mesh(new THREE.RingGeometry(119,141,192),new THREE.MeshStandardMaterial({color:0xd9c18c,roughness:.95}));beach.rotation.x=-Math.PI/2;beach.position.y=.035;scene.add(beach);
 const waterMat=new THREE.MeshStandardMaterial({color:0x168aa6,roughness:.24,metalness:.12,transparent:false});
 const water=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100,1,1),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-.28;scene.add(water);
 waterMat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\\nvarying vec3 vWaterWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\\n vWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz; transformed.y += sin(vWaterWorld.x*.035+vWaterWorld.z*.022)*.018 + cos(vWaterWorld.z*.04-vWaterWorld.x*.018)*.012;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\\nvarying vec3 vWaterWorld;').replace('#include <color_fragment>','#include <color_fragment>\\n float ripple=0.5+0.5*sin(vWaterWorld.x*.22+vWaterWorld.z*.16); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.72,.78),ripple*.10);');};
 for(let i=0;i<18;i++){const a=i*2.399,r=22+(i%8)*3.3;addPalm(Math.cos(a)*r,Math.sin(a)*r,.75+(i%4)*.1)}
 for(let i=0;i<34;i++){const a=i*2.399,r=52+(i%13)*5.1;addPalm(Math.cos(a)*r,Math.sin(a)*r,.85+(i%5)*.12)}
 addHouse(-12,-12,.2,0,true);addHouse(14,-18,-.3,1,true);addHouse(22,9,.8,2,true);addHouse(-25,15,-.5,3,true);
 addHouse(68,35,.4,2,true);addHouse(-76,-42,-.7,1);addHouse(38,-88,.2,0);addHouse(-92,72,1.1,3);addHouse(102,5,-.4,2);
 // Novas casas distribuídas pela ilha para criar mais áreas de exploração.
 addHouse(42,54,.65,1);addHouse(-48,68,-.25,2,true);addHouse(84,-58,1.35,3);addHouse(-58,-76,.45,0);
 addHouse(6,82,-.8,2,true);addHouse(-104,18,.3,1);addHouse(108,78,-.55,0);addHouse(-8,-96,1.05,3);
 for(let i=0;i<34;i++){const a=i*2.4,r=9+(i%6)*4;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.55+(i%4)*.22,1),mat(i%2?0x58644d:0x7b8069));rock.position.set(Math.cos(a)*r,.3,Math.sin(a)*r);rock.scale.y=.65;rock.castShadow=true;rock.receiveShadow=true;scene.add(rock)}
 addRoadNetwork();
 addSettlementDetails();
 addWorldDetail();
 addCombatLandmarks();
 addSafeZone();addLootDrops();
}
function addSafeZone(){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.012,8,256),new THREE.MeshBasicMaterial({color:0x54dfff,transparent:true,opacity:.82}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.18;ring.scale.set(120,120,120);scene.add(ring);safeRing=ring;
}
function addLootDrops(){
 // Caixas e itens distribuídos junto às casas e pontos de exploração.
 const drops=[
  [12,5,'medkit'],[-32,42,'armor'],[55,-34,'ammo'],[-70,-12,'medkit'],[78,66,'armor'],
  [-10,-8,'weapon',0],[17,-15,'scope'],[25,12,'medkit'],[-28,18,'weapon',1],
  [65,38,'ammo'],[-73,-45,'scope'],[41,-85,'weapon',2],[-89,70,'medkit'],
  [99,8,'armor'],[44,57,'weapon',1],[-46,71,'ammo'],[82,-61,'scope'],
  [-56,-79,'weapon',0],[8,85,'medkit'],[-101,21,'ammo'],[106,80,'weapon',2],[-6,-99,'scope'],[31,-48,'weapon',3],[-92,-55,'weapon',4],[88,42,'weapon',5],[5,48,'attachment'],[-48,-18,'attachment'],[102,-24,'attachment'],
  // Suprimentos dentro das casas: recompensam a exploração dos interiores.
  [-12,-12,'ammo'],[14,-18,'medkit'],[22,9,'armor'],[-25,15,'weapon',1],[68,35,'scope'],[-76,-42,'ammo'],[38,-88,'attachment'],[42,54,'medkit']
 ];
 drops.forEach(([x,z,type,weaponSlot],i)=>{
  const group=new THREE.Group();
  const colors={medkit:0x42d879,armor:0x4ca8ff,ammo:0xf3c64e,weapon:0xd9823b,scope:0xb78cff,attachment:0x5de0cf};
  const color=colors[type]||0xf3c64e,base=mat(type==='medkit'?0x315c42:0x514b3f,.72),trim=mat(color,.42,.22);
  box(group,.72,.48,.62,base,0,.26,0);
  box(group,.76,.09,.66,trim,0,.5,0);
  if(type==='weapon'){
   box(group,.82,.09,.12,trim,0,.68,0);box(group,.16,.25,.14,base,.23,.56,0);
  }else if(type==='attachment'){
   box(group,.48,.12,.16,trim,0,.68,0);box(group,.12,.25,.12,base,.18,.56,0);
  }else if(type==='scope'){
   const tube=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.48,12),trim);tube.rotation.z=Math.PI/2; tube.position.y=.68;group.add(tube);
   const lens=new THREE.Mesh(new THREE.CircleGeometry(.105,16),new THREE.MeshBasicMaterial({color:0x8cecff}));lens.position.set(.245,.68,0);lens.rotation.y=Math.PI/2;group.add(lens);
  }else{
   box(group,.12,.3,.08,trim,0,.7,0);
   if(type==='medkit')box(group,.32,.1,.08,trim,0,.7,0);
  }
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.58,.025,6,20),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5}));
  halo.rotation.x=Math.PI/2;halo.position.y=.07;group.add(halo);
  group.position.set(x,0,z);scene.add(group);
  lootItems.push({group,type,weaponSlot,taken:false});
 });
}
function refreshVitals(){
 healthEl.textContent='VIDA '+health;document.querySelector('#healthValue').textContent=health;refreshInventory();
 document.querySelector('#healthFill').style.width=health+'%';
 document.querySelector('#armorText').textContent='COLETE '+Math.round(armor);
 document.querySelector('#medkit').textContent='✚ KIT ('+medkits+')';
}
function useMedkit(){
 if(medkits<=0||health>=100)return;
 medkits--;health=Math.min(100,health+45);refreshVitals();statusEl.textContent='KIT MÉDICO USADO';
}
function takeLoot(){
 if(!playerRig)return;
 const p=playerRig.holder.position;
 let nearest=null,best=4;
 for(const item of lootItems){if(item.taken)continue;const d=Math.hypot(item.group.position.x-p.x,item.group.position.z-p.z);if(d<best){best=d;nearest=item}}
 if(!nearest)return;
 nearest.taken=true;scene.remove(nearest.group);
 if(nearest.type==='medkit')medkits++;
 else if(nearest.type==='armor')armor=Math.min(100,armor+50);
 else if(nearest.type==='ammo')reserveAmmo[weaponIndex]+=30;
 else if(nearest.type==='scope'){scopeLevel=Math.min(3,scopeLevel+1);statusEl.textContent='MIRA '+scopeLevel+'X COLETADA';}
 else if(nearest.type==='attachment'){attachmentLevel=Math.min(3,attachmentLevel+1);statusEl.textContent='ACESSÓRIO EQUIPADO';}
 else if(nearest.type==='weapon'){weaponIndex=nearest.weaponSlot??((weaponIndex+1)%weapons.length);weaponAmmo[weaponIndex]=Math.min(currentWeapon().mag,weaponAmmo[weaponIndex]+currentWeapon().mag);reserveAmmo[weaponIndex]+=currentWeapon().mag*2;statusEl.textContent=currentWeapon().name+' ENCONTRADO';}
 refreshAmmo();refreshVitals();
 if(nearest.type==='medkit')statusEl.textContent='KIT ENCONTRADO';
 else if(nearest.type==='armor')statusEl.textContent='COLETE REFORÇADO';
 else if(nearest.type==='ammo')statusEl.textContent='MUNIÇÃO DE RESERVA COLETADA';
 else if(nearest.type==='attachment')statusEl.textContent='ACESSÓRIO: ESTABILIDADE +';
}
function updateSafeZone(dt){
 if(document.querySelector('#hud').style.display==='none')return;
 zoneElapsed+=dt;
 const radius=Math.max(24,120-zoneElapsed*.42);
 if(safeRing){safeRing.scale.set(radius,radius,radius);const pulse=.72+Math.sin(zoneElapsed*3)*.1;safeRing.material.opacity=pulse}
 document.querySelector('#zoneText').textContent='ZONA '+Math.round(radius)+'m';
 const p=playerRig.holder.position;
 if(Math.hypot(p.x,p.z)>radius){zoneDamageClock-=dt;if(zoneDamageClock<=0){zoneDamageClock=1;const raw=7,blocked=Math.min(armor,raw*.5);armor-=blocked;health=Math.max(0,health-(raw-blocked));refreshVitals();statusEl.textContent='FORA DA ZONA SEGURA'}}else zoneDamageClock=0;
 let closest=Infinity;
 for(const item of lootItems){if(item.taken)continue;closest=Math.min(closest,Math.hypot(item.group.position.x-p.x,item.group.position.z-p.z))}
 const lootButton=document.querySelector('#loot');lootButton.style.display=closest<4?'block':'none';
}
function addCombatLandmarks(){
 // Posto avançado, caixas de suprimentos e barreiras para dar escala ao mapa.
 const concrete=mat(0x777e79,.94),crate=mat(0x756044,.88),edge=mat(0x3d493f,.9),metal=mat(0x343d40,.56,.55);
 function supply(x,z){
  const g=new THREE.Group();box(g,1.35,1.05,1.2,crate,0,.53,0);
  for(let y=.18;y<1;y+=.22)box(g,1.38,.035,1.23,edge,0,y,0);
  box(g,.16,.12,1.24,metal,-.48,.53,0);box(g,.16,.12,1.24,metal,.48,.53,0);
  g.position.set(x,0,z);scene.add(g);
 }
 function barrier(x,z,rot=0){const b=new THREE.Group();box(b,3.4,1.05,.55,concrete,0,.52,0);box(b,3.5,.13,.62,mat(0xaaa18a),0,1.04,0);b.position.set(x,0,z);b.rotation.y=rot;scene.add(b)}
 supply(8,-7);supply(10,-7);supply(-17,11);supply(42,28);
 barrier(4,-11,.15);barrier(18,-4,-.5);barrier(-20,20,.8);
 // Torre de observação simples com plataforma, escada e cobertura.
 const tower=new THREE.Group(),wood=mat(0x594634,.9),roof=mat(0x303b3d,.82);
 for(const x of [-1.35,1.35])for(const z of [-1.15,1.15]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.16,5.3,.16),wood);leg.position.set(x,2.65,z);leg.castShadow=true;tower.add(leg)}
 box(tower,3.2,.2,2.8,wood,0,4.25,0);box(tower,3.5,.16,3.1,roof,0,5.55,0);
 for(const x of [-1.35,1.35])box(tower,.12,1.1,.12,wood,x,4.85,0);
 tower.position.set(-42,0,-35);scene.add(tower);
}
function addRifle(rig,index=0){
 const hand=rig.bones.get('mixamorigRightHand')||rig.bones.get('RightHand')||rig.bones.get('handslotr')||rig.bones.get('handslot.r');
 if(!hand){console.warn('Mão direita não encontrada: arma não montada');return;}
 if(rig.weaponPivot){rig.weaponPivot.parent?.remove(rig.weaponPivot);rig.weaponPivot=null;}
 const specs=[
  {kind:'rifle',length:.82,width:.12,stock:.23,barrel:.43},
  {kind:'smg',length:.57,width:.105,stock:.13,barrel:.27},
  {kind:'sniper',length:1.08,width:.105,stock:.29,barrel:.68},
  {kind:'shotgun',length:.88,width:.14,stock:.22,barrel:.47},
  {kind:'pistol',length:.31,width:.095,stock:.09,barrel:.15},
  {kind:'lmg',length:.96,width:.15,stock:.25,barrel:.54}
 ];
 const spec=specs[index]||specs[0],g=new THREE.Group();g.name='weapon-'+spec.kind;
 const steel=new THREE.MeshStandardMaterial({color:0x303941,roughness:.38,metalness:.72});
 const dark=new THREE.MeshStandardMaterial({color:0x11171b,roughness:.66,metalness:.2});
 const polymer=new THREE.MeshStandardMaterial({color:0x343b35,roughness:.82});
 const gripMat=new THREE.MeshStandardMaterial({color:0x594632,roughness:.88});
 const part=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o};
 const L=spec.length,body=Math.max(.14,L*.43),barrelLen=spec.barrel;
 if(spec.kind==='pistol'){
  part(spec.width,.13,.17,steel,0,0,-.035);
  part(spec.width*.78,.24,.105,polymer,0,-.16,.035);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,barrelLen,8),steel);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.005,-.17-barrelLen*.48);g.add(barrel);
 }else{
  part(spec.width*.8,.13,spec.stock,polymer,0,-.015,L*.34);
  part(spec.width,.145,body,steel,0,0,-.015);
  part(spec.width*.82,.12,Math.max(.16,L*.35),polymer,0,-.012,-L*.32);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(spec.width*.12,spec.width*.14,barrelLen,8),steel);
  barrel.rotation.x=Math.PI/2;barrel.position.set(0,.012,-L*.39-barrelLen*.48);g.add(barrel);
  part(.045,.035,L*.48,dark,0,.105,-L*.22);
  part(.07,.19,.105,dark,0,-.145,-.04);
  const fore=part(.075,.16,.09,gripMat,0,-.145,-L*.29);fore.rotation.x=-.12;
  if(spec.kind==='sniper'){
   const scope=new THREE.Mesh(new THREE.CylinderGeometry(.047,.047,.22,10),dark);scope.rotation.x=Math.PI/2;scope.position.set(0,.19,-.12);g.add(scope);
   part(.075,.09,.2,dark,0,.19,-.22);part(.14,.055,.12,polymer,0,-.025,L*.44);
  }else if(spec.kind==='shotgun'){
   const tube=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,L*.48,8),dark);tube.rotation.x=Math.PI/2;tube.position.set(spec.width*.25,-.105,-L*.27);g.add(tube);
  }else if(spec.kind==='lmg'){
   part(.17,.12,.24,dark,0,-.19,-.06);part(.15,.22,.18,polymer,0,-.18,-.08);
  }else{
   const mag=part(.075,.2,.12,dark,0,-.16,-.04);mag.rotation.x=-.12;
   if(spec.kind==='rifle'){const sight=new THREE.Mesh(new THREE.BoxGeometry(.065,.08,.13),dark);sight.position.set(0,.17,-.13);g.add(sight)}
  }
 }
 const muzzle=new THREE.Object3D();muzzle.position.set(0,.012,spec.kind==='pistol'?-.17-barrelLen*.96:-L*.39-barrelLen*.96);g.add(muzzle);
 g.scale.setScalar(.68);g.position.set(.015,-.045,.035);g.rotation.set(-.08,0,0);hand.add(g);
 rig.weaponPivot=g;rig.weaponMuzzle=muzzle;rig.weaponSpec=spec;
}
function makeHumanoidModel(){
 const root=new THREE.Group();root.name='IlhaHumanoid_OwnModel';
 const bones=new Map();
 const skin=new THREE.MeshStandardMaterial({color:0xb98265,roughness:.82}),skinLight=new THREE.MeshStandardMaterial({color:0xc99173,roughness:.84});
 const shirt=new THREE.MeshStandardMaterial({color:0x526b58,roughness:.94}),shirtDark=new THREE.MeshStandardMaterial({color:0x35483d,roughness:.92});
 const pants=new THREE.MeshStandardMaterial({color:0x303b3d,roughness:.96}),pantsLight=new THREE.MeshStandardMaterial({color:0x46504b,roughness:.95});
 const boots=new THREE.MeshStandardMaterial({color:0x292b2a,roughness:.88}),sole=new THREE.MeshStandardMaterial({color:0x171a1a,roughness:.95});
 const belt=new THREE.MeshStandardMaterial({color:0x292b27,roughness:.78}),metal=new THREE.MeshStandardMaterial({color:0x9c895d,metalness:.55,roughness:.42});
 const hair=new THREE.MeshStandardMaterial({color:0x30251f,roughness:.95}),eyes=new THREE.MeshStandardMaterial({color:0x211b18,roughness:.45});
 const bone=(name,parent,x,y,z)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);bones.set(name,b);return b};
 const ellipsoid=(parent,name,x,y,z,sx,sy,sz,material)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),material);m.name=name;m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 const capsule=(parent,name,length,radius,material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(new THREE.CapsuleGeometry(radius,Math.max(.01,length-2*radius),6,10),material);m.name=name;m.position.set(x,y-length*.5,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 const hips=bone('mixamorigHips',root,0,.99,0);
 ellipsoid(hips,'pelvis',0,0,0,.205,.145,.13,skin);
 ellipsoid(hips,'combat_belt',0,-.018,.006,.218,.055,.145,belt);
 box(hips,.1,.075,.025,metal,0,-.02,.145);
 const spine=bone('mixamorigSpine',hips,0,.12,0);
 capsule(spine,'abdomen',.28,.115,skin,0,-.01,0);
 ellipsoid(spine,'shirt_waist',0,-.015,0,.205,.15,.137,shirt);
 const spine1=bone('mixamorigSpine1',spine,0,.17,0);
 ellipsoid(spine1,'chest',0,.045,0,.235,.205,.135,skin);
 ellipsoid(spine1,'shirt_torso',0,.035,-.002,.252,.218,.15,shirt);
 const spine2=bone('mixamorigSpine2',spine1,0,.16,0);
 ellipsoid(spine2,'upper_chest',0,.015,0,.225,.14,.13,skin);
 ellipsoid(spine2,'shirt_upper',0,.015,0,.24,.15,.148,shirt);
 // Gola, costuras e bolsos discretos.
 ellipsoid(spine2,'shirt_collar',0,.12,.005,.105,.055,.105,shirtDark);
 box(spine2,.018,.24,.012,shirtDark,0,-.005,.151);
 for(const sx of [-1,1]){
  box(spine2,.13,.11,.025,shirtDark,sx*.145,.025,.145);
  box(spine2,.13,.018,.03,shirt,sx*.145,-.035,.16);
 }
 const neck=bone('mixamorigNeck',spine2,0,.13,0);
 capsule(neck,'neck_mesh',.13,.052,skin,0,.025,0);
 const head=bone('mixamorigHead',neck,0,.115,0);
 ellipsoid(head,'head_mesh',0,.055,0,.112,.145,.105,skinLight);
 ellipsoid(head,'nose',0,.035,.099,.025,.035,.028,skin);
 ellipsoid(head,'hair_cap',0,.145,-.012,.116,.067,.108,hair);
 ellipsoid(head,'hair_back',0,.065,-.075,.105,.105,.06,hair);
 // Boné tático de tecido: copa, aba frontal e costura central.
 const capMat=new THREE.MeshStandardMaterial({color:0x354a3b,roughness:.96});
 ellipsoid(head,'cap_crown',0,.19,-.012,.12,.075,.112,capMat);
 const capBrim=new THREE.Mesh(new THREE.BoxGeometry(.19,.025,.15),capMat);capBrim.position.set(0,.155,.105);capBrim.rotation.x=-.08;capBrim.castShadow=true;head.add(capBrim);
 // Mochila compacta presa às costas, com alças visíveis sobre os ombros.
 const packMat=new THREE.MeshStandardMaterial({color:0x343f37,roughness:.98});
 ellipsoid(spine1,'combat_backpack',0,.025,-.185,.175,.235,.095,packMat);
 box(spine1,.19,.07,.035,shirtDark,0,-.16,-.205);
 for(const side of [-1,1]){box(spine2,.045,.31,.035,packMat,side*.145,-.015,-.09);box(spine1,.09,.09,.035,pantsLight,side*.18,-.12,-.16)}
 for(const side of [-1,1]){
  ellipsoid(head,'ear',side*.112,.055,0,.022,.042,.025,skin);
  ellipsoid(head,'eye',side*.043,.083,.091,.012,.012,.008,eyes);
  ellipsoid(head,'brow',side*.043,.105,.091,.022,.008,.009,hair);
  const upper=bone(side<0?'mixamorigLeftArm':'mixamorigRightArm',spine2,side*.205,.075,0);
  ellipsoid(spine2,'shoulder',side*.205,.045,0,.09,.095,.09,shirt);
  capsule(upper,'upper_arm',.31,.064,skin,0,-.015,0);
  capsule(upper,'shirt_sleeve',.205,.078,shirt,0,-.015,0);
  const fore=bone(side<0?'mixamorigLeftForeArm':'mixamorigRightForeArm',upper,0,-.30,0);
  capsule(fore,'forearm',.285,.052,skin,0,-.005,0);
  capsule(fore,'forearm_sleeve',.20,.066,shirt,0,-.005,0);
  ellipsoid(fore,'sleeve_cuff',0,-.19,0,.067,.045,.067,shirtDark);
  const hand=bone(side<0?'mixamorigLeftHand':'mixamorigRightHand',fore,0,-.275,0);
  ellipsoid(hand,'palm',0,-.035,.005,.052,.07,.035,skin);
  ellipsoid(hand,'glove_cuff',0,-.018,0,.06,.035,.042,belt);
  for(let f=0;f<4;f++)capsule(hand,'finger',.065,.009,skin,(f-1.5)*.021,-.095,.008);
  capsule(hand,'thumb',.06,.012,skin,side*.052,-.045,.012);
  const upLeg=bone(side<0?'mixamorigLeftUpLeg':'mixamorigRightUpLeg',hips,side*.105,-.055,0);
  capsule(upLeg,'thigh',.445,.095,skin,0,-.015,0);
  capsule(upLeg,'cargo_trouser',.455,.108,pants,0,-.015,-.003);
  ellipsoid(upLeg,'cargo_pocket',side*.075,-.23,.085,.075,.11,.025,pantsLight);
  const leg=bone(side<0?'mixamorigLeftLeg':'mixamorigRightLeg',upLeg,0,-.43,0);
  capsule(leg,'calf',.415,.064,skin,0,-.005,0);
  capsule(leg,'lower_trouser',.415,.078,pants,0,-.005,-.002);
  ellipsoid(leg,'knee_pad',0,-.045,.066,.078,.085,.025,pantsLight);
  const foot=bone(side<0?'mixamorigLeftFoot':'mixamorigRightFoot',leg,0,-.395,.015);
  ellipsoid(foot,'ankle_boot',0,-.012,.025,.075,.07,.09,boots);
  ellipsoid(foot,'boot_toe',0,-.035,.095,.082,.052,.13,boots);
  ellipsoid(foot,'boot_sole',0,-.078,.075,.084,.018,.14,sole);
  const toe=bone(side<0?'mixamorigLeftToeBase':'mixamorigRightToeBase',foot,0,-.01,.12);
  ellipsoid(toe,'toe_mesh',0,0,.025,.07,.035,.055,boots);
 }
 root.updateMatrixWorld(true);
 return {root,bones};
}
async function createFighter(isEnemy=false,index=0){
 const built=makeHumanoidModel(),model=built.root,holder=new THREE.Group();holder.name=isEnemy?'enemy-humanoid':'player-humanoid';holder.add(model);
 const bones=built.bones,mixer=null,actions=new Map();
 let current=null,playing='Idle',animClock=0;
 const rig={
  holder,root:model,bones,baseRootY:0,
  lib:{role(role){return {clip:role==='run'||role==='walk'?'Walk':role==='hit'?'Hit_A':'Idle',loop:true}}},
  get playing(){return playing},
  playRole(role,opts={}){playing=role==='run'||role==='walk'?'Walk':role==='hit'?'Hit_A':'Idle';return Promise.resolve(true)},
  stanceMode:'stand',_stanceApplied:[],_stanceBlend:0,
  update(dt){
   animClock+=dt;
   for(const item of this._stanceApplied)this.bones.get(item.name)?.quaternion.multiply(item.inverse);
   this._stanceApplied.length=0;
   const moving=playing==='Walk'&&this.stanceMode==='stand',phase=animClock*(moving?9:1.8),swing=moving?Math.sin(phase)*.48:Math.sin(phase)*.018;
   for(const [name,value] of [['mixamorigLeftUpLeg',swing],['mixamorigRightUpLeg',-swing],['mixamorigLeftArm',-swing*.72],['mixamorigRightArm',swing*.72]]){
    const b=this.bones.get(name);if(b)b.rotation.x=value;
   }
   const target=this.stanceMode==='crouch'||this.stanceMode==='prone'?1:0;
   this._stanceBlend=THREE.MathUtils.damp(this._stanceBlend,target,10,dt);
   const prone=this.stanceMode==='prone',crouch=this.stanceMode==='crouch';
   const pose=[
    ['mixamorigHips',prone?.82:crouch?.42:0,0,0],
    ['mixamorigSpine',prone?.48:crouch?-.10:0,0,0],
    ['mixamorigSpine1',prone?.22:crouch?-.08:0,0,0],
    ['mixamorigLeftUpLeg',prone?-.42:crouch?-.52:0,0,0],
    ['mixamorigRightUpLeg',prone?-.42:crouch?-.52:0,0,0],
    ['mixamorigLeftLeg',prone?.18:crouch?1.02:0,0,0],
    ['mixamorigRightLeg',prone?.18:crouch?1.02:0,0,0],
    ['mixamorigLeftArm',prone?-.22:crouch?-.08:0,0,0],
    ['mixamorigRightArm',prone?-.22:crouch?-.08:0,0,0]
   ];
   for(const [name,x,y,z] of pose){const b=this.bones.get(name);if(!b)continue;const delta=new THREE.Quaternion().setFromEuler(new THREE.Euler(x*this._stanceBlend,y*this._stanceBlend,z*this._stanceBlend,'XYZ'));b.quaternion.multiply(delta);this._stanceApplied.push({name,inverse:delta.clone().invert()})}
  },
  setHeight(h){const b=new THREE.Box3().setFromObject(model),v=b.max.y-b.min.y;if(v>0)holder.scale.setScalar(h/v)}
 };
 addRifle(rig);scene.add(holder);await rig.playRole('idle');return rig;
}
function getHouseAtPosition(position){
 for(const o of worldObstacles){if(o.type!=='house')continue;const dx=position.x-o.x,dz=position.z-o.z,c=Math.cos(o.rotation),sn=Math.sin(o.rotation),lx=dx*c-dz*sn,lz=dx*sn+dz*c;if(Math.abs(lx)<4.0&&Math.abs(lz)<3.45)return {obstacle:o,lx,lz,c,sn};}
 return null;
}
function resolvePlayerObstacles(){
 const p=playerRig.holder.position,radius=.58;
 for(const o of worldObstacles){
  if(o.type==='house'){
   const dx=p.x-o.x,dz=p.z-o.z,c=Math.cos(o.rotation),sn=Math.sin(o.rotation);
   let lx=dx*c-dz*sn,lz=dx*sn+dz*c,changed=false;
   if(Math.abs(lx)<o.halfWidth+radius&&Math.abs(lz)<o.halfDepth+radius){
    // Abertura frontal ampliada proporcionalmente à escala da construção.
    if(lz>o.halfDepth-radius&&Math.abs(lx)>1.55-radius){lz=o.halfDepth+radius;changed=true;}
    else if(lz< -o.halfDepth+radius){lz=-o.halfDepth-radius;changed=true;}
    else if(lx>o.halfWidth-radius){lx=o.halfWidth+radius;changed=true;}
    else if(lx< -o.halfWidth+radius){lx=-o.halfWidth-radius;changed=true;}
   }
   if(changed){p.x=o.x+lx*c+lz*sn;p.z=o.z-lx*sn+lz*c;}
   continue;
  }
  let dx=p.x-o.x,dz=p.z-o.z,distance=Math.hypot(dx,dz),minimum=o.radius+radius;
  if(distance<minimum){if(distance<.001){dx=1;dz=0;distance=1}const nx=dx/distance,nz=dz/distance;p.x=o.x+nx*minimum;p.z=o.z+nz*minimum;const into=playerVelocity.x*nx+playerVelocity.z*nz;if(into<0){playerVelocity.x-=into*nx;playerVelocity.z-=into*nz}}
 }
}
function play(rig,role,speed=1){if(!rig)return;const clip=rig.lib.role(role)?.clip;if(clip&&rig.playing!==clip)rig.playRole(role,{fade:.22,speed}).catch(()=>{})}
function setMovementMode(mode){
 movementMode=mode;sprintHeld=false;
 const crouch=document.querySelector('#crouch'),prone=document.querySelector('#prone'),sprint=document.querySelector('#sprint');
 crouch?.classList.toggle('active',mode==='crouch');prone?.classList.toggle('active',mode==='prone');crouch?.setAttribute('aria-pressed',String(mode==='crouch'));prone?.setAttribute('aria-pressed',String(mode==='prone'));sprint?.classList.remove('active');
 if(playerRig)playerRig.stanceMode=mode;
 statusEl.textContent=mode==='crouch'?'AGACHADO':mode==='prone'?'DEITADO':'EM COMBATE';
}
function applyBodyMotion(rig,forwardSpeed,lateralSpeed,dt){
 if(!rig)return;
 const holder=rig.holder;
 const run=THREE.MathUtils.clamp(Math.abs(forwardSpeed)/5.4,0,1);
 const stance=rig.stanceMode==='prone' ? -.10 : rig.stanceMode==='crouch' ? -.035 : 0;
 const targetPitch=-run*.055+stance;
 const targetRoll=THREE.MathUtils.clamp(-lateralSpeed*.018,-.07,.07);
 const blend=1-Math.exp(-8*dt);
 holder.rotation.x=THREE.MathUtils.lerp(holder.rotation.x,targetPitch,blend);
 holder.rotation.z=THREE.MathUtils.lerp(holder.rotation.z,targetRoll,blend);
}
function addParticle(position,color=0xffb34d,speed=3,size=.09,life=.35){
 if(effects.length>(innerWidth<700?28:75))return;
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,6,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));
 mesh.position.copy(position);scene.add(mesh);
 const velocity=new THREE.Vector3((Math.random()-.5)*speed,(Math.random()*.85)*speed,(Math.random()-.5)*speed);
 effects.push({mesh,velocity,life,maxLife:life,gravity:5,kind:'particle'});
}
function burst(position,count=9,color=0xffa33d,speed=4){
 for(let i=0;i<count;i++)addParticle(position,color,speed,.045+Math.random()*.045,.22+Math.random()*.24);
}
function muzzleFlash(position,direction){
 if(innerWidth<700)return;
 const group=new THREE.Group();
 const glow=new THREE.Mesh(new THREE.SphereGeometry(.19,8,8),new THREE.MeshBasicMaterial({color:0xffc45b,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
 glow.scale.set(.75,.75,1.8);glow.position.copy(position).add(direction.clone().multiplyScalar(.3));group.add(glow);scene.add(group);
 const light=new THREE.PointLight(0xffa43c,5,7,2);light.position.copy(glow.position);scene.add(light);
 effects.push({mesh:group,light,life:.075,maxLife:.075,kind:'flash'});
 burst(glow.position,5,0xffd27a,2.2);
}
function updateEffects(dt){
 for(let i=effects.length-1;i>=0;i--){
  const fx=effects[i];fx.life-=dt;
  if(fx.kind==='particle'){
   fx.velocity.y-=fx.gravity*dt;fx.mesh.position.addScaledVector(fx.velocity,dt);
   const k=Math.max(0,fx.life/fx.maxLife);fx.mesh.material.opacity=k;fx.mesh.scale.setScalar(.45+k*.55);
  }else if(fx.kind==='flash'){
   const k=Math.max(0,fx.life/fx.maxLife);fx.mesh.scale.setScalar(.55+k*.7);fx.light.intensity=5*k;
  }
  if(fx.life<=0){scene.remove(fx.mesh);fx.mesh.traverse?.(o=>{if(o.material)o.material.dispose()});if(fx.mesh.material)fx.mesh.material.dispose();if(fx.light)scene.remove(fx.light);effects.splice(i,1)}
 }
}
async function spawnEnemy(x,z,i){const rig=await createFighter(true,i);rig.holder.position.set(x,0,z);enemies.push({rig,hp:100,alive:true,attack:0,anim:'idle'});return rig}
async function init(){
 renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance',stencil:false,depth:true,preserveDrawingBuffer:false});
 // Perfil gráfico equilibrado: imagem mais nítida sem sobrecarregar o Safari no iPhone.
 const mobileQuality=innerWidth<700;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobileQuality?.68:1.25));
 renderer.setSize(innerWidth,innerHeight);
 renderer.shadowMap.enabled=!!gameSettings.shadows&&gameSettings.quality!=='low';
 renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.setScissorTest(false);
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.08;
 renderer.info.autoReset=true;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 applyGraphicsSettings();
 renderer.setClearColor(0x9bcbe4,1);
 root.appendChild(renderer.domElement);
 scene=new THREE.Scene();clock=new THREE.Clock();buildWorld();camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,900);camera.position.set(.7,2.35,4.8);cameraLook.set(0,1.45,-1.2);camera.lookAt(cameraLook);
 loading.textContent='CARREGANDO PERSONAGEM 3D…';
 loading.textContent='CARREGANDO OPERADOR HUMANO 3D…';
 playerRig=await createFighter(false,0);playerRig.holder.position.set(0,0,0);playerRig.holder.rotation.y=Math.PI;
 // Mantém a cabeça visível: a câmera agora acompanha o personagem em terceira pessoa.
 const spots=[[62,18],[-70,36],[18,78],[-42,-88],[98,-52]];
 await Promise.all(spots.map((p,i)=>spawnEnemy(p[0],p[1],i)));
 setupControls();initSettings();addEventListener('resize',resize);
 document.querySelector('#playGame').addEventListener('click',()=>{
  const lobby=document.querySelector('#lobby');lobby.classList.add('leaving');
  document.querySelector('#hud').style.display='block';
  setTimeout(()=>lobby.remove(),550);
  statusEl.textContent='EM COMBATE';
 });
 loading.style.display='none';
 document.querySelector('#hint').textContent='Joystick: andar • Deslize a tela: olhar ao redor • Botões: pular e atirar';
 renderer.setAnimationLoop(animate);
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);const mobile=innerWidth<700;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?(gameSettings.quality==='low'?.9:1.1):1.5))}
const joy=document.querySelector('#joystick'),stick=document.querySelector('#stick');let joyId=null,cameraPointerId=null,lastPointerX=0,lastPointerY=0,lookDeltaX=0,lookDeltaY=0;
function setJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),k=Math.min(1,48/(l||1));keys.side=dx*k/48;keys.forward=-dy*k/48;stick.style.transform=`translate(${keys.side*48}px,${-keys.forward*48}px)`}
function setupControls(){
 joy.addEventListener('pointerdown',e=>{e.preventDefault();joyId=e.pointerId;joy.setPointerCapture(joyId);setJoy(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)setJoy(e)});
 const endJoy=()=>{joyId=null;keys.side=keys.forward=0;stick.style.transform='translate(0,0)'};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
 // Câmera por gesto contínuo: qualquer arrasto iniciado na metade direita da tela
 // controla a visão; os botões de ação continuam independentes.
 const surface=root;
 surface.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(e.target.closest('#joystick,.actions,.sprint-btn')||e.clientX<innerWidth*.40)return;
  e.preventDefault();cameraPointerId=e.pointerId;lastPointerX=e.clientX;lastPointerY=e.clientY;
  surface.setPointerCapture(e.pointerId);
 });
 surface.addEventListener('pointermove',e=>{
  if(e.pointerId!==cameraPointerId)return;
  e.preventDefault();
  const dx=e.clientX-lastPointerX,dy=e.clientY-lastPointerY;
  // A sensibilidade acompanha a densidade da tela para manter o mesmo giro no celular.
  lookDeltaX+=THREE.MathUtils.clamp(dx,-140,140);lookDeltaY+=THREE.MathUtils.clamp(dy,-110,110);lastPointerX=e.clientX;lastPointerY=e.clientY;
 });
 const endCameraDrag=e=>{if(e.pointerId===cameraPointerId)cameraPointerId=null};
 surface.addEventListener('pointerup',endCameraDrag);surface.addEventListener('pointercancel',endCameraDrag);
 surface.addEventListener('lostpointercapture',endCameraDrag);
 document.querySelector('#jump').onclick=()=>{if((playerRig.jumpV||0)<=0.02&&playerRig.holder.position.y<=.03&&movementMode!=='prone'){setMovementMode('stand');playerRig.jumpV=5.8}};
  document.querySelector('#crouch').onclick=()=>setMovementMode(movementMode==='crouch'?'stand':'crouch');
  document.querySelector('#prone').onclick=()=>setMovementMode(movementMode==='prone'?'stand':'prone');
 const sprintButton=document.querySelector('#sprint');
 if(sprintButton){sprintButton.addEventListener('pointerdown',e=>{e.preventDefault();sprintHeld=true;sprintButton.classList.add('active');sprintButton.setPointerCapture(e.pointerId)});const stopSprint=()=>{sprintHeld=false;sprintButton.classList.remove('active')};sprintButton.addEventListener('pointerup',stopSprint);sprintButton.addEventListener('pointercancel',stopSprint);sprintButton.addEventListener('lostpointercapture',stopSprint)}
 const aimButton=document.querySelector('#aim');
 aimButton.setAttribute('aria-pressed','false');
 aimButton.onclick=()=>{aiming=!aiming;aimButton.classList.toggle('active',aiming);aimButton.setAttribute('aria-pressed',String(aiming));document.querySelector('#crosshair')?.classList.toggle('aiming',aiming);statusEl.textContent=aiming?'MIRA PRECISA':'EM COMBATE'};
 const fireButton=document.querySelector('#fire');
 fireButton.addEventListener('pointerdown',e=>{e.preventDefault();fireHeld=true;fireButton.setPointerCapture(e.pointerId);shoot();if(fireMode==='BURST')burstRemaining=2});
 const stopFire=()=>{fireHeld=false};fireButton.addEventListener('pointerup',stopFire);fireButton.addEventListener('pointercancel',stopFire);fireButton.addEventListener('lostpointercapture',stopFire);
 document.querySelector('#reload').onclick=reloadWeapon;
 document.querySelector('#medkit').onclick=useMedkit;
 document.querySelector('#weaponSwitch').onclick=switchWeapon;
 document.querySelector('#fireMode').onclick=cycleFireMode;
 document.querySelector('#inventoryToggle').onclick=toggleInventory;
 document.querySelector('#loot').onclick=takeLoot;
}
function reloadWeapon(){
 if(reloadTimer>0||ammo>=currentWeapon().mag||reserveAmmo[weaponIndex]<=0)return;
 fireHeld=false;burstRemaining=0;reloadTimer=currentWeapon().reload;statusEl.textContent='RECARREGANDO '+currentWeapon().name;
 document.querySelector('#reload').classList.add('active');
}
function shoot(){
 if(reloadTimer>0||fireCooldown>0)return;
 if(ammo<=0){statusEl.textContent=reserveAmmo[weaponIndex]>0?'RECARREGUE':'SEM MUNIÇÃO';fireHeld=false;burstRemaining=0;return}
 ammo--;weaponAmmo[weaponIndex]=ammo;refreshAmmo();
 fireCooldown=currentWeapon().rate*(aiming?.86:1);
 const dir=new THREE.Vector3();camera.getWorldDirection(dir);
 const movement=THREE.MathUtils.clamp(playerVelocity.length()/7.1,0,1);
 const aimAccuracy=aiming?Math.max(.1,.22-scopeLevel*.028):1;
 const movementPenalty=1+movement*(aiming?.72:1.35);
 const recoilPenalty=1+recoil*1.8;
 const spread=currentWeapon().spread*aimAccuracy*movementPenalty*recoilPenalty*(1-attachmentLevel*.085);
 const cameraRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
 const cameraUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
 playerRig.weaponMuzzle?.getWorldPosition(_shotOrigin);const origin=playerRig.weaponMuzzle?_shotOrigin.clone():playerRig.holder.position.clone().add(new THREE.Vector3(0,1.42,0)).add(dir.clone().multiplyScalar(.8));
 for(let n=0;n<(currentWeapon().pellets||1);n++){
  const shotDir=dir.clone().addScaledVector(cameraRight,(Math.random()-.5)*spread).addScaledVector(cameraUp,(Math.random()-.5)*spread).normalize();
  if(bullets.length>36)continue;const mesh=new THREE.Mesh(bulletGeometry,bulletMaterial);
  mesh.position.copy(origin).add(shotDir.clone().multiplyScalar(.48));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),shotDir);scene.add(mesh);
  bullets.push({mesh,dir:shotDir,life:currentWeapon().range/72,damage:currentWeapon().damage,travelled:0,range:currentWeapon().range});
 }
 muzzleFlash(origin,dir);document.querySelector('#crosshair')?.classList.add('firing');setTimeout(()=>document.querySelector('#crosshair')?.classList.remove('firing'),85);
 const recoilByWeapon=[.085,.065,.19,.17,.048,.125];recoil=Math.min(.55,recoil+(aiming?.055:.085)*(recoilByWeapon[weaponIndex]||.085)/.085*(currentWeapon().pellets?1.35:1));
 statusEl.textContent=ammo===0?(reserveAmmo[weaponIndex]>0?'RECARREGUE':'SEM MUNIÇÃO'):(aiming?'MIRA PRECISA':'DISPARANDO');
}
let radarClock=0;
function updateRadar(){
 const radar=document.querySelector('#radarDots');if(!radar||!playerRig)return;
 radar.innerHTML='';
 for(const enemy of enemies){
  if(!enemy.alive)continue;
  const dx=enemy.rig.holder.position.x-playerRig.holder.position.x;
  const dz=enemy.rig.holder.position.z-playerRig.holder.position.z;
  const distance=Math.hypot(dx,dz);if(distance>105)continue;
  const dot=document.createElement('i');dot.className='radar-dot';
  dot.style.left=(50+THREE.MathUtils.clamp(dx/105*45,-45,45))+'%';
  dot.style.top=(50+THREE.MathUtils.clamp(dz/105*45,-45,45))+'%';
  radar.appendChild(dot);
 }
}
function animate(){
 const dt=Math.min(clock.getDelta(),.04),p=playerRig.holder;
 if(scene.fog&&scene.fog.isFogExp2){scene.fog.density=.00145+Math.sin(clock.elapsedTime*.035)*.00008;}
 worldYaw-=lookDeltaX*.0048*getCameraSensitivity();
 // Controle vertical progressivo, com faixa ampla para acompanhar alvos acima e abaixo.
 pitch=THREE.MathUtils.clamp(pitch-lookDeltaY*.0038*getCameraSensitivity()*(gameSettings.invertY?-1:1),-.78,.78);
 lookDeltaX=lookDeltaY=0;
 const forward=new THREE.Vector3(Math.sin(worldYaw),0,-Math.cos(worldYaw)),right=new THREE.Vector3(Math.cos(worldYaw),0,Math.sin(worldYaw));
 const move=forward.clone().multiplyScalar(keys.forward).add(right.clone().multiplyScalar(keys.side));if(move.lengthSq()>1)move.normalize();
 const canSprint=sprintHeld&&keys.forward>.22&&!aiming&&movementMode==='stand';
  const moveSpeed=movementMode==='prone'?.95:movementMode==='crouch'?1.85:aiming?2.65:canSprint?7.1:5.35;
  const targetVelocity=move.clone().multiplyScalar(moveSpeed);
  const acceleration=movementMode==='prone'?7:movementMode==='crouch'?8:canSprint?11:9;
  playerVelocity.lerp(targetVelocity,1-Math.exp(-acceleration*dt));
  p.position.addScaledVector(playerVelocity,dt);resolvePlayerObstacles();p.position.x=THREE.MathUtils.clamp(p.position.x,-124,124);p.position.z=THREE.MathUtils.clamp(p.position.z,-124,124);
 const grounded=p.position.y<=.001;
  const moving=playerVelocity.length()>.16;
  if(moving){dustClock-=dt;if(dustClock<=0){dustClock=movementMode==='prone'?.34:playerVelocity.length()>4.2?.12:.24;const foot=p.position.clone().add(new THREE.Vector3((Math.random()-.5)*.55,.12,(Math.random()-.5)*.55));for(let n=0;n<(movementMode==='prone'?1:3);n++)addParticle(foot,0xc6b58a,1.1,.055,.3)}
   const desiredYaw=aiming?worldYaw+Math.PI:Math.atan2(playerVelocity.x,playerVelocity.z);
   const turn=THREE.MathUtils.euclideanModulo(desiredYaw-p.rotation.y+Math.PI,Math.PI*2)-Math.PI;
   p.rotation.y+=turn*Math.min(1,(aiming?14:11)*dt);
   const role=canSprint?'run':'walk';play(playerRig,role,canSprint?1.28:movementMode==='prone'?.48:movementMode==='crouch'?.68:aiming?.78:1.02);
  }else{
   const faceYaw=worldYaw+Math.PI,turn=THREE.MathUtils.euclideanModulo(faceYaw-p.rotation.y+Math.PI,Math.PI*2)-Math.PI;
   p.rotation.y+=turn*Math.min(1,(aiming||fireHeld?12:5)*dt);play(playerRig,fireHeld?'cast':'idle');
  }
  playerRig.jumpV=(playerRig.jumpV||0)-15*dt;p.position.y=Math.max(0,p.position.y+(playerRig.jumpV||0)*dt);if(p.position.y===0&&playerRig.jumpV<0)playerRig.jumpV=0;
  applyBodyMotion(playerRig,playerVelocity.dot(forward),playerVelocity.dot(right),dt);playerRig.update(dt);if(playerRig.weaponPivot){playerRig.weaponKick=Math.max(0,(playerRig.weaponKick||0)-dt*1.35);playerRig.weaponPivot.rotation.x=-.08-(playerRig.weaponKick||0);}
 for(const e of enemies){if(!e.alive)continue;const ep=e.rig.holder,delta=p.position.clone().sub(ep.position);const dist=delta.length();if(dist>2.3){delta.normalize();ep.position.addScaledVector(delta,1.35*dt);ep.rotation.y=Math.atan2(delta.x,delta.z);if(e.anim!=='run'){e.anim='run';play(e.rig,'run')}}else{if(e.anim!=='idle'){e.anim='idle';play(e.rig,'idle')}e.attack+=dt;if(e.attack>1.5){e.attack=0;const raw=4,blocked=Math.min(armor,raw*.5);armor-=blocked;health=Math.max(0,health-(raw-blocked));refreshVitals();statusEl.textContent='SOB ATAQUE';setTimeout(()=>{if(health>0)statusEl.textContent='PRONTO'},450)}}applyBodyMotion(e.rig,dist>2.3?1.35:0,0,dt);e.rig.update(dt);if(e.rig.weaponPivot){e.rig.weaponKick=Math.max(0,(e.rig.weaponKick||0)-dt*.9);e.rig.weaponPivot.rotation.x=-.08-(e.rig.weaponKick||0)}}
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.mesh.position.addScaledVector(b.dir,72*dt);b.life-=dt;let hit=false;for(const e of enemies){if(e.alive){const base=e.rig.holder.position,head=base.clone().add(new THREE.Vector3(0,1.72,0)),torso=base.clone().add(new THREE.Vector3(0,.96,0));const headHit=b.mesh.position.distanceTo(head)<.42,bodyHit=b.mesh.position.distanceTo(torso)<.72;if(headHit||bodyHit){const falloff=Math.max(.52,1-(b.travelled/Math.max(1,b.range))*.42),dealt=b.damage*falloff*(headHit?2.15:1);e.hp-=dealt;hitMarkerTimer=.18;document.querySelector('#crosshair')?.classList.add('hit');burst(b.mesh.position,headHit?16:10,headHit?0xffe16b:0xffa34d,4.8);statusEl.textContent=headHit?'TIRO NA CABEÇA!':'ACERTO';hit=true;if(e.hp<=0){e.alive=false;burst(e.rig.holder.position.clone().add(new THREE.Vector3(0,1,0)),22,0xffd06b,5);scene.remove(e.rig.holder);e.rig.dispose();kills++;scoreEl.textContent=String(kills);document.querySelector('#remainingEnemies').textContent=String(enemies.filter(x=>x.alive).length)}break}}}b.travelled+=72*dt;if(hit||b.life<=0||b.travelled>=b.range){scene.remove(b.mesh);bullets.splice(i,1)}}
 fireCooldown=Math.max(0,fireCooldown-dt);
 if(burstRemaining>0&&fireCooldown<=0&&reloadTimer<=0){shoot();burstRemaining--;}
 else if(gameSettings.autoFire&&fireMode==='AUTO'&&fireHeld&&fireCooldown<=0&&reloadTimer<=0&&currentWeapon().modes.includes('AUTO'))shoot();
 if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){reloadTimer=0;const need=currentWeapon().mag-weaponAmmo[weaponIndex],loaded=Math.min(need,reserveAmmo[weaponIndex]);weaponAmmo[weaponIndex]+=loaded;reserveAmmo[weaponIndex]-=loaded;refreshAmmo();document.querySelector('#reload').classList.remove('active');statusEl.textContent='PRONTO'}}
 recoil=Math.max(0,recoil-dt*(aiming?.72:.9));
  aimBlend=THREE.MathUtils.damp(aimBlend,aiming?1:0,13,dt);
  const forwardView=new THREE.Vector3(Math.sin(worldYaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(worldYaw)*Math.cos(pitch));
  const rightView=new THREE.Vector3(Math.cos(worldYaw),0,Math.sin(worldYaw));
  const stanceHeight=movementMode==='prone' ? .40 : movementMode==='crouch' ? .91 : 1.46;
  const movingBob=playerVelocity.length()>.25?Math.sin(clock.elapsedTime*(aiming?7.5:10.5))*.025*(aiming?.35:1)*(movementMode==='stand'?1:.25):0;
  const aimForward=THREE.MathUtils.lerp(1.35,2.15,aimBlend);
  const lookTarget=p.position.clone().add(new THREE.Vector3(0,stanceHeight+movingBob+recoil*.72,0)).add(forwardView.clone().multiplyScalar(aimForward));
  const cameraDistance=THREE.MathUtils.lerp(sprintHeld&&!aiming?5.0:4.8,3.18,aimBlend);
  const shoulder=THREE.MathUtils.lerp(.62,.22,aimBlend);
  let desiredCamera=lookTarget.clone().add(forwardView.clone().multiplyScalar(-cameraDistance)).add(rightView.multiplyScalar(shoulder));
  const interior=getHouseAtPosition(p.position);
  if(interior){
   // Dentro de construções, aproxima e limita a câmera ao espaço interno para não atravessar paredes/telhado.
   const dx=desiredCamera.x-interior.obstacle.x,dz=desiredCamera.z-interior.obstacle.z;
   let lx=dx*interior.c-dz*interior.sn,lz=dx*interior.sn+dz*interior.c;
   lx=THREE.MathUtils.clamp(lx,-3.0,3.0);lz=THREE.MathUtils.clamp(lz,-2.55,2.55);
   desiredCamera.set(interior.obstacle.x+lx*interior.c+lz*interior.sn,THREE.MathUtils.clamp(desiredCamera.y,.42,2.42),interior.obstacle.z-lx*interior.sn+lz*interior.c);
  }
  const smooth=1-Math.exp(-15*dt);camera.position.lerp(desiredCamera,smooth);cameraLook.lerp(lookTarget,smooth);camera.lookAt(cameraLook);
  const wantedFov=THREE.MathUtils.lerp(sprintHeld&&!aiming?70:66,Math.max(36,48-scopeLevel*3.5),aimBlend);if(Math.abs(camera.fov-wantedFov)>.08){camera.fov=THREE.MathUtils.lerp(camera.fov,wantedFov,smooth);camera.updateProjectionMatrix();}
  const crosshair=document.querySelector('#crosshair');if(crosshair){const movementBloom=THREE.MathUtils.clamp(playerVelocity.length()/7.1,0,1)*(aiming?.18:.34);const bloomScale=THREE.MathUtils.clamp((aiming?.72:1)+movementBloom+recoil*.7,.68,1.55);crosshair.style.scale=String(bloomScale);}
 updateSafeZone(dt);
 if(hitMarkerTimer>0){hitMarkerTimer-=dt;if(hitMarkerTimer<=0)document.querySelector('#crosshair')?.classList.remove('hit')}updateEffects(dt);radarClock-=dt;if(radarClock<=0){radarClock=.35;updateRadar()}renderer.render(scene,camera);
}
init().catch(err=>{console.error(err);loading.style.display='none';errorPanel.style.display='grid';document.querySelector('#errorMessage').textContent='Não foi possível carregar os modelos 3D. Confira a internet e tente novamente.'});
