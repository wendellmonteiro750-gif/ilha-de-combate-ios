import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';

const root=document.querySelector('#game'),loading=document.querySelector('#loading'),statusEl=document.querySelector('#status');
const scoreEl=document.querySelector('#score'),ammoEl=document.querySelector('#ammo'),healthEl=document.querySelector('#health');
const errorPanel=document.querySelector('#errorPanel');
let renderer,scene,camera,clock,playerRig,worldYaw=0,pitch=-.12,ammo=30,kills=0,health=100,armor=0,medkits=1;
const HUMAN_MODEL_URL='https://raw.githubusercontent.com/memoriesrohit/avatar-studio/2fd9ec82fbe1613d40ae38aadcca3f410725f740/models/andre_casual.glb';
let humanModelPromise=null;
const HUMAN_ROLE_CLIPS={idle:'Idle',walk:'Walk',run:'Walk',jump:'Idle',cast:'Boxing',hit:'Argue'};
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
function setFireMode(next){const modes=currentWeapon().modes;fireMode=modes.includes(next)?next:modes[modes.length-1];const el=document.querySelector('#fireMode');if(el){el.textContent='☷';el.title='Modo de disparo: '+fireMode;el.setAttribute('aria-label','Modo de disparo: '+fireMode)}}
function cycleFireMode(){const modes=currentWeapon().modes;const i=modes.indexOf(fireMode);setFireMode(modes[(i+1)%modes.length]);statusEl.textContent='DISPARO '+fireMode;}
function refreshAmmo(){ammo=weaponAmmo[weaponIndex];ammoEl.textContent='MUNIÇÃO '+ammo;document.querySelector('#ammoLarge').textContent=ammo;document.querySelector('#ammoMag').textContent=currentWeapon().mag;document.querySelector('#ammoReserve').textContent=reserveAmmo[weaponIndex];document.querySelector('#weaponSwitch').textContent='▣';document.querySelector('#weaponSwitch').title='Trocar arma: '+currentWeapon().name;document.querySelector('#weaponSwitch').setAttribute('aria-label','Trocar arma: '+currentWeapon().name);setFireMode(fireMode);refreshInventory()}
function refreshInventory(){
 const panel=document.querySelector('#inventoryPanel');if(!panel)return;
 document.querySelector('#inventoryWeapons').innerHTML=weapons.map((w,i)=>'<div class="inventory-slot '+(i===weaponIndex?'equipped':'')+'"><b>'+(i+1)+'. '+w.name+'</b><span>'+weaponAmmo[i]+'/'+w.mag+' • reserva '+reserveAmmo[i]+'</span><small>'+w.category+' • DANO '+w.damage+' • '+w.rate.toFixed(2)+'s/tiro • '+w.lengthCm+' cm</small></div>').join('');
 document.querySelector('#inventorySupplies').textContent='Kits: '+medkits+' • Colete: '+Math.round(armor)+'% • Mira: '+scopeLevel+'x • Acessórios: '+attachmentLevel;
}
function toggleInventory(){
 const panel=document.querySelector('#inventoryPanel');const open=panel.classList.toggle('visible');
 document.querySelector('#inventoryToggle').textContent='▤';document.querySelector('#inventoryToggle').title=open?'Fechar mochila':'Abrir mochila';document.querySelector('#inventoryToggle').setAttribute('aria-label',open?'Fechar mochila':'Abrir mochila');
 refreshInventory();
}
function switchWeapon(){if(reloadTimer>0)return;weaponIndex=(weaponIndex+1)%weapons.length;burstRemaining=0;setFireMode(fireMode);if(playerRig)addRifle(playerRig,weaponIndex);refreshAmmo();statusEl.textContent='EQUIPADO: '+currentWeapon().name}

const playerVelocity=new THREE.Vector3(),cameraLook=new THREE.Vector3(),_shotOrigin=new THREE.Vector3();
let safeRing=null,zoneElapsed=0,zoneDamageClock=0,lootItems=[];const worldObstacles=[];
const keys={forward:0,side:0},bullets=[],enemies=[],effects=[];const bulletGeometry=new THREE.CylinderGeometry(.012,.012,.72,5),bulletMaterial=new THREE.MeshBasicMaterial({color:0xffdf91,transparent:true,opacity:.92});let dustClock=0,recoil=0,aiming=false,aimBlend=0,hitMarkerTimer=0,fireHeld=false,fireCooldown=0,reloadTimer=0,firePoseTimer=0,movementMode='stand';
const BASE='https://raw.githubusercontent.com/NoLimitNexus/game-models/main/';
const defaultSettings={general:100,red:100,two:100,four:100,awm:100,look:100,autoFire:true,invertY:false,minimap:true,hudScale:100,hudOpacity:100,quality:'medium',shadows:false,vibration:false};
let gameSettings={...defaultSettings};
try{gameSettings={...defaultSettings,...JSON.parse(localStorage.getItem('ic-game-settings')||'{}')}}catch{}
let hudEditing=false,hudDrag=null;
function saveGameSettings(){try{localStorage.setItem('ic-game-settings',JSON.stringify(gameSettings));}catch{}}
function applyGraphicsSettings(){if(!renderer)return;const mobile=innerWidth<700;const q={low:{ratio:mobile?.78:1,shadows:false},medium:{ratio:mobile?.92:1.15,shadows:true},high:{ratio:mobile?1.05:1.35,shadows:true},ultra:{ratio:mobile?1.15:1.6,shadows:true}}[gameSettings.quality]||{ratio:mobile?.92:1.15,shadows:true};renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio));renderer.shadowMap.enabled=!mobile&&!!gameSettings.shadows&&!!q.shadows;renderer.shadowMap.needsUpdate=true;renderer.setSize(innerWidth,innerHeight);}
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
function addHouse(x,z,rotation=0,style=0){
 const g=new THREE.Group();
 const palettes=[
  {wall:0xc9b995,trim:0xeee0bd,roof:0x704638,wood:0x654832,glass:0x80b9c4},
  {wall:0xb8c0b2,trim:0xe0dfce,roof:0x45515a,wood:0x594b3c,glass:0x83b9c5},
  {wall:0xd0a779,trim:0xf0d1a5,roof:0x79513a,wood:0x63432e,glass:0x83b6bd},
  {wall:0x9fada2,trim:0xd8d9c8,roof:0x554d43,wood:0x514638,glass:0x8ab8bd}
 ];
 const p=palettes[Math.abs(style)%palettes.length],wall=mat(p.wall,.94),trim=mat(p.trim,.88),wood=mat(p.wood,.9),roof=mat(p.roof,.78),glass=new THREE.MeshStandardMaterial({color:p.glass,roughness:.22,metalness:.12});
 // Fundação, piso e paredes em módulos: a fachada deixa portas e janelas legíveis.
 box(g,6.5,.22,5.7,mat(0x777467),0,.11,0);
 box(g,6.05,.16,5.25,mat(0x9b8d72),0,.29,0);
 box(g,6.05,2.65,.22,wall,0,1.62,-2.52);
 box(g,.22,2.65,5.05,wall,-2.92,1.62,0);
 box(g,.22,2.65,5.05,wall,2.92,1.62,0);
 // Fachada frontal com abertura central para a porta.
 box(g,1.8,2.65,.22,wall,-2.02,1.62,2.52);
 box(g,1.8,2.65,.22,wall,2.02,1.62,2.52);
 box(g,2.2,.72,.22,wall,0,2.59,2.52);
 // Porta, moldura, maçaneta e degraus.
 box(g,1.12,2.12,.12,wood,0,1.36,2.64);
 box(g,.94,1.94,.035,mat(0x806044),0,1.36,2.72);
 const knob=new THREE.Mesh(new THREE.SphereGeometry(.045,8,8),mat(0xd4b36a,.32,.7));knob.position.set(.36,1.35,2.77);g.add(knob);
 box(g,1.55,.16,.48,trim,0,.12,2.92);box(g,1.85,.13,.58,mat(0x817c6c),0,.07,3.12);
 // Janelas com peitoris, caixilhos e vidro.
 for(const sx of [-1,1]){
  box(g,1.05,.92,.08,wood,sx*2.02,1.78,2.66);
  box(g,.87,.73,.035,glass,sx*2.02,1.8,2.71);
  box(g,.07,.82,.045,trim,sx*2.02,1.8,2.74);
  box(g,1.0,.07,.045,trim,sx*2.02,1.8,2.74);
  box(g,1.22,.12,.22,wood,sx*2.02,1.28,2.75);
  box(g,1.2,.12,.18,trim,sx*2.02,2.31,2.68);
  // Persianas simples e reforços de fachada.
  for(let k=0;k<3;k++)box(g,1.0,.035,.055,wood,sx*2.02,1.55+k*.18,2.75);
 }
 // Telhado de duas águas, beirais e cumeeira.
 const roofA=new THREE.Mesh(new THREE.BoxGeometry(3.55,.18,6.15),roof);
 roofA.position.set(-1.52,3.12,0);roofA.rotation.z=-.48;roofA.castShadow=true;roofA.receiveShadow=true;g.add(roofA);
 const roofB=new THREE.Mesh(new THREE.BoxGeometry(3.55,.18,6.15),roof);
 roofB.position.set(1.52,3.12,0);roofB.rotation.z=.48;roofB.castShadow=true;roofB.receiveShadow=true;g.add(roofB);
 box(g,.2,.2,6.2,trim,0,3.94,0);
 // Calha, chaminé, unidade de ventilação e detalhes externos.
 box(g,.12,.12,5.9,mat(0x4a4b46,.55,.25),-3.05,2.78,0);
 box(g,.12,.12,5.9,mat(0x4a4b46,.55,.25),3.05,2.78,0);
 box(g,.62,.85,.62,mat(0x806f5b),-1.75,3.55,-1.2);
 box(g,.72,.14,.72,mat(0x4a4a45),-1.75,4.02,-1.2);
 box(g,.72,.42,.34,mat(0xc5c9c1,.65,.2),2.2,2.75,-1.75);
 for(let k=0;k<4;k++)box(g,.55,.025,.36,mat(0x59615e,.6,.3),2.2,2.62+k*.07,-1.75);
 // Pequena varanda lateral com pilares.
 box(g,2.3,.16,1.35,wood,0,.22,3.55);
 for(const sx of [-1,1])box(g,.12,2.25,.12,trim,sx*1.02,1.3,4.05);
 box(g,2.2,.12,.12,wood,0,2.35,4.05);
 // Detalhes de reboco e cantoneiras.
 for(const sx of [-1,1])box(g,.12,2.7,.12,trim,sx*2.94,1.62,2.58);
 g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);worldObstacles.push({x,z,radius:4.35});
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
 const concrete=mat(0x777d79,.95),metal=mat(0x3d494d,.52,.58),wood=mat(0x76563a,.9),paint=mat(0xd5c6a0,.88);
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
 const grass=new THREE.InstancedMesh(grassGeo,grassMat,950);
 let n=0;for(let i=0;i<950;i++){const a=Math.random()*Math.PI*2,r=8+Math.random()*111,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x,z)>120)continue;dummy.position.set(x,.25,z);dummy.rotation.set((Math.random()-.5)*.18,Math.random()*Math.PI,0);const h=.55+Math.random()*.9;dummy.scale.set(.7,h,.7);dummy.updateMatrix();grass.setMatrixAt(n++,dummy.matrix)}grass.count=n;grass.instanceMatrix.needsUpdate=true;scene.add(grass);
 const bushGeo=new THREE.IcosahedronGeometry(1,1),bushMat=new THREE.MeshStandardMaterial({color:0x294b32,roughness:1});
 const bushes=new THREE.InstancedMesh(bushGeo,bushMat,145);n=0;
 for(let i=0;i<145;i++){const a=Math.random()*Math.PI*2,r=12+Math.random()*105;dummy.position.set(Math.cos(a)*r,.55,Math.sin(a)*r);const q=.45+Math.random()*.8;dummy.scale.set(q*.9,q*.65,q);dummy.rotation.set(Math.random()*.3,Math.random()*6,Math.random()*.3);dummy.updateMatrix();bushes.setMatrixAt(n++,dummy.matrix)}bushes.count=n;bushes.instanceMatrix.needsUpdate=true;bushes.castShadow=true;scene.add(bushes);
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
 scene.background=new THREE.Color(0x849ba2);scene.fog=new THREE.FogExp2(0x9aa9a5,.0019);
 scene.add(new THREE.HemisphereLight(0xd8e0df,0x394338,1.15));
 const ambient=new THREE.AmbientLight(0xdce2df,.18);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffe3c2,2.45);sun.position.set(-42,78,34);sun.castShadow=!!gameSettings.shadows&&gameSettings.quality!=='low';sun.shadow.mapSize.set(innerWidth<700?768:1024,innerWidth<700?768:1024);sun.shadow.camera.left=-165;sun.shadow.camera.right=165;sun.shadow.camera.top=165;sun.shadow.camera.bottom=-165;sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;sun.shadow.radius=innerWidth<700?2:3;sun.shadow.camera.near=1;sun.shadow.camera.far=260;scene.add(sun);
 const fill=new THREE.DirectionalLight(0x9db5c4,.42);fill.position.set(55,28,-48);scene.add(fill);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.MeshStandardMaterial({map:addTextureGround(),roughness:.96}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const beach=new THREE.Mesh(new THREE.RingGeometry(119,141,192),new THREE.MeshStandardMaterial({color:0xd9c18c,roughness:.95}));beach.rotation.x=-Math.PI/2;beach.position.y=.035;scene.add(beach);
 const waterMat=new THREE.MeshStandardMaterial({color:0x168aa6,roughness:.24,metalness:.12,transparent:false});
 const water=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100,1,1),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-.28;scene.add(water);
 waterMat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWaterWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\n vWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz; transformed.y += sin(vWaterWorld.x*.035+vWaterWorld.z*.022)*.018 + cos(vWaterWorld.z*.04-vWaterWorld.x*.018)*.012;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWaterWorld;').replace('#include <color_fragment>','#include <color_fragment>\n float ripple=0.5+0.5*sin(vWaterWorld.x*.22+vWaterWorld.z*.16); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.72,.78),ripple*.10);');};
 for(let i=0;i<18;i++){const a=i*2.399,r=22+(i%8)*3.3;addPalm(Math.cos(a)*r,Math.sin(a)*r,.75+(i%4)*.1)}
 for(let i=0;i<34;i++){const a=i*2.399,r=52+(i%13)*5.1;addPalm(Math.cos(a)*r,Math.sin(a)*r,.85+(i%5)*.12)}
 addHouse(-12,-12,.2,0);addHouse(14,-18,-.3,1);addHouse(22,9,.8,2);addHouse(-25,15,-.5,3);
 addHouse(68,35,.4,2);addHouse(-76,-42,-.7,1);addHouse(38,-88,.2,0);addHouse(-92,72,1.1,3);addHouse(102,5,-.4,2);
 // Novas casas distribuídas pela ilha para criar mais áreas de exploração.
 addHouse(42,54,.65,1);addHouse(-48,68,-.25,2);addHouse(84,-58,1.35,3);addHouse(-58,-76,.45,0);
 addHouse(6,82,-.8,2);addHouse(-104,18,.3,1);addHouse(108,78,-.55,0);addHouse(-8,-96,1.05,3);
 for(let i=0;i<34;i++){const a=i*2.4,r=9+(i%6)*4;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.55+(i%4)*.22,1),mat(i%2?0x58644d:0x7b8069));rock.position.set(Math.cos(a)*r,.3,Math.sin(a)*r);rock.scale.y=.65;rock.castShadow=true;rock.receiveShadow=true;scene.add(rock)}
 addRoadNetwork();
 addSettlementDetails();
 addWorldDetail();
 addCombatLandmarks();
 addCoastalLandmarks();
 addSafeZone();addLootDrops();
}
function addCoastalLandmarks(){
 // Novo cais de madeira na enseada norte, com píer, postes e barco encalhado.
 const timber=mat(0x76563a,.92),darkTimber=mat(0x493b2e,.95),metal=mat(0x3d494d,.58,.42);
 const dock=new THREE.Group();
 box(dock,5.2,.32,28,timber,0,.05,0);
 for(let z=-12;z<=12;z+=4){
  for(const x of [-2.25,2.25])box(dock,.22,1.25,.22,darkTimber,x,-.48,z);
  for(const x of [-2.45,2.45])box(dock,.12,.72,.12,timber,x,.48,z);
  box(dock,.16,.14,.16,metal,0,.26,z);
 }
 for(const x of [-2.45,2.45])box(dock,.18,.16,28,timber,x,.62,0);
 dock.position.set(-18,0,105);dock.rotation.y=-.12;scene.add(dock);
 worldObstacles.push({x:-18,z:92,radius:3.8});
 // Barco de pesca com casco, cabine, janelas e defensas.
 const boat=new THREE.Group(),hull=mat(0x263e48,.5,.35),paint=mat(0xe0d8c3,.72),glass=new THREE.MeshStandardMaterial({color:0x5b9ba8,roughness:.22,metalness:.2});
 const hullMesh=new THREE.Mesh(new THREE.CylinderGeometry(.15,1.35,8,8,1,false),hull);hullMesh.rotation.z=Math.PI/2;hullMesh.scale.set(1,.62,.72);hullMesh.position.y=.65;boat.add(hullMesh);
 box(boat,3.6,.65,2.2,paint,0,1.15,0);box(boat,1.7,1.05,1.55,paint,-.35,1.9,-.05);
 box(boat,.08,.72,1.15,glass,.55,1.95,.02);box(boat,.08,.72,1.15,glass,-1.15,1.95,.02);
 const mast=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,2.1,8),metal);mast.position.set(-.25,3.45,-.1);boat.add(mast);
 for(const z of [-1.1,1.1]){const f=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),mat(0x343a3c));f.position.set(1.45,.95,z);boat.add(f)}
 boat.position.set(-24,-.18,121);boat.rotation.y=.3;scene.add(boat);
 // Farol costeiro com base de pedra, faixas, janelas e cobertura.
 const lighthouse=new THREE.Group(),stone=mat(0xb8b5a5,.92),white=mat(0xe2dfd1,.8),red=mat(0x9d493c,.82);
 const base=new THREE.Mesh(new THREE.CylinderGeometry(3.5,4.1,1.1,12),stone);base.position.y=.55;lighthouse.add(base);
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.45,13,16),white);shaft.position.y=7.4;shaft.castShadow=true;lighthouse.add(shaft);
 for(const y of [3.2,8.2,12.7]){const stripe=new THREE.Mesh(new THREE.CylinderGeometry(2.05-(y-3)*.035,2.2-(y-3)*.035,.72,16),red);stripe.position.y=y;lighthouse.add(stripe)}
 const gallery=new THREE.Mesh(new THREE.CylinderGeometry(2.45,2.1,.32,16),metal);gallery.position.y=14;lighthouse.add(gallery);
 const lantern=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,2.2,12),new THREE.MeshStandardMaterial({color:0x8ab8bd,roughness:.2,metalness:.25,transparent:true,opacity:.72}));lantern.position.y=15.2;lighthouse.add(lantern);
 const cap=new THREE.Mesh(new THREE.ConeGeometry(1.9,1.55,12),red);cap.position.y=17.05;lighthouse.add(cap);
 const beacon=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8),new THREE.MeshBasicMaterial({color:0xffe6a0}));beacon.position.y=15.25;lighthouse.add(beacon);
 lighthouse.position.set(76,0,-82);scene.add(lighthouse);worldObstacles.push({x:76,z:-82,radius:4.5});
 // Pátio de carga: contêineres coloridos, travas, faixas e pilhas de caixas.
 const colors=[0x526c70,0x8a5142,0x6b7550],containerMats=colors.map(c=>mat(c,.82));
 const yard=new THREE.Group();
 for(let i=0;i<3;i++){
  const x=(i-1)*7;
  box(yard,6,2.7,2.7,containerMats[i],x,1.35,0);
  for(let k=0;k<7;k++)box(yard,.045,2.45,.055,metal,x-2.7+k*.9,1.35,1.39);
  for(const sx of [-1,1])box(yard,.13,2.75,.13,metal,x+sx*2.88,1.35,0);
  box(yard,5.7,.08,.08,metal,x,2.74,0);
 }
 box(yard,24,.12,13,mat(0x686b61),0,.03,0);
 yard.position.set(-4,0,-59);yard.rotation.y=.12;scene.add(yard);
 worldObstacles.push({x:-4,z:-59,radius:12});
 for(const [x,z] of [[-13,-52],[7,-52],[11,-66]]){box(scene,1.1,1.2,1.1,mat(0x785c3e),x,.6,z);box(scene,1.14,.08,1.14,metal,x,1.22,z)}
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
  [-56,-79,'weapon',0],[8,85,'medkit'],[-101,21,'ammo'],[106,80,'weapon',2],[-6,-99,'scope'],[31,-48,'weapon',3],[-92,-55,'weapon',4],[88,42,'weapon',5],[5,48,'attachment'],[-48,-18,'attachment'],[102,-24,'attachment']
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
 document.querySelector('#medkit').textContent='✚';document.querySelector('#medkit').title='Kit médico: '+medkits+' restante(s)';document.querySelector('#medkit').setAttribute('aria-label','Kit médico: '+medkits+' restante(s)');
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
 const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(0,.012,spec.kind==='pistol'?-.17-barrelLen*.96:-L*.39-barrelLen*.96);g.add(muzzle);
 const leftHandGrip=new THREE.Object3D();leftHandGrip.name='left-hand-grip';leftHandGrip.position.set(0,-.145,spec.kind==='pistol'?.015:-L*.29);g.add(leftHandGrip);
 const leftReloadGrip=new THREE.Object3D();leftReloadGrip.name='left-hand-reload';leftReloadGrip.position.set(0,spec.kind==='pistol' ? -.245 : -.235,spec.kind==='pistol' ? .045 : -.055);g.add(leftReloadGrip);
 g.scale.setScalar(.78);g.position.set(.105,-.105,-.115);g.rotation.set(-.20,.14,-.10);hand.add(g);
 rig.weaponPivot=g;rig.weaponMuzzle=muzzle;rig.weaponLeftGrip=leftHandGrip;rig.weaponLeftReloadGrip=leftReloadGrip;rig.weaponSpec=spec;rig.leftGripOrientationOffset=null;rig.weaponBasePosition=g.position.clone();rig.weaponBaseRotation=g.rotation.clone();
}
async function createFighter(isEnemy=false,index=0){
 if(!humanModelPromise)humanModelPromise=new GLTFLoader().loadAsync(HUMAN_MODEL_URL);
 const source=await humanModelPromise;
 // Descobre os nomes reais dos clips do GLB; não presume nomes como "Idle" e "Walk".
 const clips=source.animations||[];
 const findClip=pattern=>clips.find(a=>pattern.test(a.name));
 const idleClip=findClip(/idle|stand|breath/i)||clips[0];
 const walkClip=findClip(/walk|walking|locomotion/i)||idleClip;
 const runClip=findClip(/sprint|running|run|jog/i)||walkClip;
 const jumpClip=findClip(/jump|leap|fall/i)||walkClip||idleClip;
 if(idleClip)HUMAN_ROLE_CLIPS.idle=idleClip.name;
 if(walkClip)HUMAN_ROLE_CLIPS.walk=walkClip.name;
 if(runClip)HUMAN_ROLE_CLIPS.run=runClip.name;
 if(jumpClip)HUMAN_ROLE_CLIPS.jump=jumpClip.name;
 const model=SkeletonUtils.clone(source.scene),holder=new THREE.Group();holder.add(model);
 model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model),height=Math.max(.1,bounds.max.y-bounds.min.y);
 holder.scale.setScalar(1.82/height);model.position.y=-bounds.min.y;
 const bones=new Map(),palette=['#35483d','#5a4938','#3c4b5d','#4c3d35','#4b5144','#51443b'],outfitColor=isEnemy?palette[index%palette.length]:'#17191d';
 model.traverse(o=>{
  if(o.isBone)bones.set(o.name,o);
  if(o.isMesh){
   o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
   const label=(o.name+' '+(o.material?.name||'')).toLowerCase();
   if(/outfit|shirt|jacket|top|trouser|pants|shoe/.test(label)){
    if(Array.isArray(o.material))o.material=o.material.map(m=>{const c=m.clone();c.color.multiply(new THREE.Color(outfitColor));return c});
    else if(o.material){o.material=o.material.clone();o.material.color.multiply(new THREE.Color(outfitColor))}
   }
  }
 });
 // Normaliza os nomes dos ossos para rigs Mixamo com prefixos diferentes.
 const normalizedBones=[...bones.entries()].map(([name,bone])=>[name.toLowerCase().replace(/[^a-z0-9]/g,''),bone]);
 const boneAliases={
  mixamorigHips:[/hips$/, /pelvis$/],
  mixamorigSpine2:[/spine2$/, /spine02$/, /chest$/],
  mixamorigSpine1:[/spine1$/, /spine01$/, /chest1$/],
  mixamorigSpine:[/spine$/, /spine0[0]?$/],
  mixamorigHead:[/head$/],
  mixamorigLeftUpLeg:[/leftupleg$/, /leftthigh$/, /thighleft$/],
  mixamorigRightUpLeg:[/rightupleg$/, /rightthigh$/, /thighright$/],
  mixamorigLeftLeg:[/leftleg$/, /leftlowerleg$/, /leftcalf$/, /leftknee$/],
  mixamorigRightLeg:[/rightleg$/, /rightlowerleg$/, /rightcalf$/, /rightknee$/],
  mixamorigLeftArm:[/leftarm$/, /leftupperarm$/, /leftuparm$/],
  mixamorigRightArm:[/rightarm$/, /rightupperarm$/, /rightuparm$/],
  mixamorigLeftForeArm:[/leftforearm$/, /leftlowerarm$/, /leftelbow$/],
  mixamorigRightForeArm:[/rightforearm$/, /rightlowerarm$/, /rightelbow$/],
  mixamorigLeftHand:[/lefthand$/],
  mixamorigRightHand:[/righthand$/]
 };
 for(const [alias,patterns] of Object.entries(boneAliases)){
  if(bones.has(alias))continue;
  const found=normalizedBones.find(([name])=>patterns.some(pattern=>pattern.test(name)));
  if(found)bones.set(alias,found[1]);
 }
 const mixer=new THREE.AnimationMixer(model),actions=new Map();
 for(const sourceClip of source.animations){const clip=sourceClip.clone();for(const track of clip.tracks){if(/Hips.*position/i.test(track.name)){for(let k=0;k<track.values.length;k+=3){track.values[k]=0;track.values[k+2]=0;}}}actions.set(clip.name,mixer.clipAction(clip));}
 let current=null,playing='';
 const rig={
  holder,root:model,bones,isPlayer:!isEnemy,baseRootY:model.position.y,
  lib:{role(role){return {clip:HUMAN_ROLE_CLIPS[role]||'Idle',loop:true}}},
  get playing(){return playing},
  playRole(role,opts={}){
   const clip=HUMAN_ROLE_CLIPS[role]||HUMAN_ROLE_CLIPS.idle;
   const next=actions.get(clip)||actions.get(HUMAN_ROLE_CLIPS.idle)||actions.values().next().value;
   if(!next)return Promise.resolve(false);
   const speed=opts.speed||1;
   if(current===next){next.timeScale=speed;return Promise.resolve(true)}
   next.reset();next.enabled=true;next.setEffectiveWeight(1);next.timeScale=speed;next.setLoop(THREE.LoopRepeat,Infinity);next.play();
   if(current)next.crossFadeFrom(current,opts.fade??.2,false);
   current=next;playing=clip;return Promise.resolve(true);
  },
  stanceMode:'stand',
  _stanceApplied:[],
  _ikRestore:[],
  _stanceBlend:0,
  gaitPhase:0,
  update(dt){
   for(const item of this._ikRestore)item.bone.quaternion.copy(item.quaternion);
   this._ikRestore.length=0;
   for(let i=this._stanceApplied.length-1;i>=0;i--){const item=this._stanceApplied[i];this.bones.get(item.name)?.quaternion.multiply(item.inverse)}
   this._stanceApplied.length=0;
   mixer.update(dt);
   const locomotion=THREE.MathUtils.clamp(this.locomotionBlend||0,0,1);
   this.gaitPhase=(this.gaitPhase||0)+dt*(this.sprintBlend?13.5:8.5)*(.25+locomotion*.75);
   const gait=Math.sin(this.gaitPhase),opposite=Math.sin(this.gaitPhase+Math.PI);
   const stepLift=Math.max(0,Math.cos(this.gaitPhase)),oppositeLift=Math.max(0,Math.cos(this.gaitPhase+Math.PI));
   this.root.position.y=this.baseRootY+Math.abs(Math.sin(this.gaitPhase*2))*locomotion*(this.sprintBlend?.035:.018);
   const crouchFactor=this.stanceMode==='crouch'?.42:this.stanceMode==='prone'?.08:1;
   // A animação do GLB já movimenta as pernas; a camada procedural só corrige a passada para evitar duplicação exagerada.
   const gaitAmount=locomotion*crouchFactor*(this.sprintBlend?.42:.30);
   for(const [name,angle] of [['mixamorigLeftUpLeg',gait*(this.sprintBlend?.78:.62)],['mixamorigRightUpLeg',opposite*(this.sprintBlend?.78:.62)],['mixamorigLeftLeg',Math.max(0,-gait)*(this.sprintBlend?1.05:.82)+stepLift*.10],['mixamorigRightLeg',Math.max(0,-opposite)*(this.sprintBlend?1.05:.82)+oppositeLift*.10]]){
    const bone=this.bones.get(name);if(!bone||gaitAmount<.001)continue;
    const delta=new THREE.Quaternion().setFromEuler(new THREE.Euler(angle*gaitAmount,0,0,'XYZ'));
    bone.quaternion.multiply(delta);this._stanceApplied.push({name,inverse:delta.clone().invert()});
   }
   const target=this.stanceMode==='crouch'||this.stanceMode==='prone'?1:0;
   this._stanceBlend=THREE.MathUtils.damp(this._stanceBlend,target,10,dt);
   const prone=this.stanceMode==='prone',crouch=this.stanceMode==='crouch';
   const ready=this.isPlayer?1:.72,aim=THREE.MathUtils.clamp(this.weaponAimBlend||0,0,1),combatPose=Math.max(aim,THREE.MathUtils.clamp(this.weaponFireBlend||0,0,1));
   const fire=THREE.MathUtils.clamp(this.weaponFireBlend||0,0,1),run=THREE.MathUtils.clamp(this.weaponRunBlend||0,0,1),reload=THREE.MathUtils.clamp(this.reloadBlend||0,0,1);
   const firePhase=this.firePosePhase||0;
   const readyTarget=this.isPlayer?(run?.64:1):.72;
   this.weaponReadyBlend=THREE.MathUtils.damp(this.weaponReadyBlend??.72,readyTarget,12,dt);
   const armReady=this.weaponReadyBlend,elbowReady=THREE.MathUtils.clamp(armReady+aim*.12,0,1);
   const reloadPhase=Math.sin((1-reload)*Math.PI);
   const firePulse=fire*(.12+.10*Math.sin(firePhase*18));
   const moveBob=Math.sin(this.gaitPhase*2)*(locomotion*(.018+.018*run));
   const reloadReach=Math.sin((1-reload)*Math.PI)*reload;
   const pose=[
    ['mixamorigHips',prone ? .82 : crouch ? .42 : -(this.jumpBlend||0)*.16,0,0],
    ['mixamorigSpine',prone ? .48 : crouch ? -.10 : -.30*combatPose-.12*aim+ .10*run-(this.jumpBlend||0)*.08+moveBob*.35,0,-(this.lateralMotion||0)*(.10-.045*aim)],
    ['mixamorigSpine1',prone ? .22 : crouch ? -.08 : -.22*combatPose-.07*aim+.06*run-(this.jumpBlend||0)*.04+moveBob*.25,0,(this.lateralMotion||0)*(.055-.025*aim)],
    ['mixamorigSpine2',prone ? .10 : crouch ? -.04 : -.12*combatPose-.035*aim,0,0],
    ['mixamorigNeck',0,0,0],
    ['mixamorigHead',-(this.aimPitch||0)*.32,0,0],
    ['mixamorigLeftUpLeg',prone ? -.62 : crouch ? -.58 : -(this.jumpBlend||0)*.34,0,0],
    ['mixamorigRightUpLeg',prone ? -.62 : crouch ? -.58 : -(this.jumpBlend||0)*.28,0,0],
    ['mixamorigLeftLeg',prone ? .42 : crouch ? 1.12 : (this.jumpBlend||0)*.62,0,0],
    ['mixamorigRightLeg',prone ? .42 : crouch ? 1.12 : (this.jumpBlend||0)*.54,0,0],
    // Postura de combate: ombros avançados e cotovelos flexionados para sustentar a arma.
    // Agachar/deitar não deve fazer o operador soltar o fuzil.
    ['mixamorigLeftArm',(prone?-.92:crouch?-1.12:-1.18)*armReady-(this.jumpBlend||0)*.06, .035*aim, .20*armReady+.10*run],
    ['mixamorigLeftForeArm',-.20*elbowReady-.08*reloadPhase*reload-.12*reloadReach,0,-.16*elbowReady],
    ['mixamorigLeftHand',.10*armReady,0,.025*aim],
    // A mão direita continua presa à empunhadura; o cotovelo acompanha a posição de tiro.
    ['mixamorigRightArm',(prone?-.88:crouch?-1.06:-1.10)*armReady-(this.jumpBlend||0)*.06, -.025*aim, -.20*armReady-.08*run],
    ['mixamorigRightForeArm',-.22*elbowReady-.10*reloadPhase*reload-firePulse+.035*reloadReach,0,.08*elbowReady],
    ['mixamorigRightHand',-.07*armReady,0,-.025*fire]
   ];
   for(const [name,x,y,z] of pose){
    const bone=this.bones.get(name);if(!bone)continue;
    const torsoPose=/mixamorig(Spine(1|2)?|Neck|Head)$/.test(name);
    const armPose=/mixamorig(Left|Right)(Arm|ForeArm|Hand)$/.test(name);
    const poseBlend=armPose?this.weaponReadyBlend:torsoPose?combatPose:this._stanceBlend;
    if(poseBlend>0){
     // Blend the full authored angle. Previously stanceBlend was zero while standing,
     // cancelling the weapon-ready arm pose even when weaponReadyBlend was active.
     const delta=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ'));
     const applied=new THREE.Quaternion().slerp(delta,poseBlend);
     bone.quaternion.multiply(applied);
     this._stanceApplied.push({name,inverse:applied.clone().invert()});
    }
   }
   // Fecha os dedos ao redor da empunhadura e do guarda-mão.
   for(const [name,bone] of this.bones){
    const finger=name.match(/mixamorig(Right|Left)Hand(Index|Middle|Ring|Pinky|Thumb)([123])/);
    if(!finger)continue;
    const side=finger[1],digit=finger[2],segment=Number(finger[3]);
    const curl=(side==='Right'?.34:.28)*(digit==='Thumb'?.72:1)*(segment===1?1:segment===2?.88:.72);
    const delta=new THREE.Quaternion().setFromEuler(new THREE.Euler(curl,0,digit==='Thumb'?(side==='Right'?.12:-.12):0,'XYZ'));
    bone.quaternion.multiply(delta);this._stanceApplied.push({name,inverse:delta.clone().invert()});
   }
   // IK de duas mãos: a direita ancora a arma junto ao ombro; a esquerda
   // alcança o guarda-mão calculado na própria geometria da arma.
   if(this.weaponPivot&&this.weaponSpec){
    const solveHand=(upper,fore,hand,target)=>{
     if(!upper||!fore||!hand)return;
     model.updateMatrixWorld(true);
     const shoulder=upper.getWorldPosition(new THREE.Vector3());
     const elbow=fore.getWorldPosition(new THREE.Vector3());
     const wrist=hand.getWorldPosition(new THREE.Vector3());
     const upperLength=shoulder.distanceTo(elbow),foreLength=elbow.distanceTo(wrist);
     const toTarget=target.clone().sub(shoulder),distance=toTarget.length();
     if(upperLength<1e-4||foreLength<1e-4||distance<1e-4)return;
     const direction=toTarget.multiplyScalar(1/distance);
     const reach=Math.min(distance,upperLength+foreLength-1e-4);
     const along=THREE.MathUtils.clamp((upperLength*upperLength+reach*reach-foreLength*foreLength)/(2*reach),0,upperLength);
     const height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
     // Pole vector: mantém o cotovelo no mesmo lado da dobra da animação-base,
     // evitando que o braço atravesse o corpo quando a mão alcança o guarda-mão.
     const pole=elbow.clone().sub(shoulder).addScaledVector(direction,-elbow.clone().sub(shoulder).dot(direction));
     if(pole.lengthSq()<1e-6){
      pole.set(1,0,0).applyQuaternion(holder.getWorldQuaternion(new THREE.Quaternion()));
      pole.addScaledVector(direction,-pole.dot(direction));
     }
     if(pole.lengthSq()<1e-6)return;
     pole.normalize();
     const desiredElbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(pole,height);
     const rotateJoint=(joint,child,desired)=>{
      model.updateMatrixWorld(true);
      const origin=joint.getWorldPosition(new THREE.Vector3()),current=child.getWorldPosition(new THREE.Vector3());
      const from=current.sub(origin),to=desired.clone().sub(origin);
      if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)return;
      const worldDelta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
      const parentWorld=joint.parent.getWorldQuaternion(new THREE.Quaternion());
      const localDelta=parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
      if(!this._ikRestore.some(item=>item.bone===joint))this._ikRestore.push({bone:joint,quaternion:joint.quaternion.clone()});
      joint.quaternion.premultiply(localDelta);
     };
     rotateJoint(upper,fore,desiredElbow);
     rotateJoint(fore,hand,target);
    };
    // A mão direita ancora a arma. Um segundo alvo IK no próprio punho
    // deformava o cotovelo; apenas a mão esquerda alcança o guarda-mão.
    const leftUpper=this.bones.get('mixamorigLeftArm'),leftFore=this.bones.get('mixamorigLeftForeArm'),leftHand=this.bones.get('mixamorigLeftHand');
    const reload=THREE.MathUtils.clamp(this.reloadBlend||0,0,1);
    if(leftUpper&&leftFore&&leftHand&&this.weaponLeftGrip&&(this.weaponSpec.kind!=='pistol'||reload>.02)){
     model.updateMatrixWorld(true);this.weaponPivot.updateMatrixWorld(true);
     const support=this.weaponLeftGrip.getWorldPosition(new THREE.Vector3());
     const reloadSocket=this.weaponLeftReloadGrip||this.weaponLeftGrip;
     const reloadTarget=reloadSocket.getWorldPosition(new THREE.Vector3());
     const handTarget=support.lerp(reloadTarget,reload);
     solveHand(leftUpper,leftFore,leftHand,handTarget);
     // Mantém a orientação do punho esquerdo relativa à arma, sem torcer a mão a cada quadro.
     model.updateMatrixWorld(true);this.weaponPivot.updateMatrixWorld(true);
     const weaponWorldQ=this.weaponPivot.getWorldQuaternion(new THREE.Quaternion());
     if(!this.leftGripOrientationOffset){
      const handWorldQ=leftHand.getWorldQuaternion(new THREE.Quaternion());
      this.leftGripOrientationOffset=weaponWorldQ.clone().invert().multiply(handWorldQ);
     }
     const desiredHandWorldQ=weaponWorldQ.clone().multiply(this.leftGripOrientationOffset);
     const handParentQ=leftHand.parent.getWorldQuaternion(new THREE.Quaternion());
     const desiredHandLocalQ=handParentQ.invert().multiply(desiredHandWorldQ);
     if(!this._ikRestore.some(item=>item.bone===leftHand))this._ikRestore.push({bone:leftHand,quaternion:leftHand.quaternion.clone()});
     leftHand.quaternion.slerp(desiredHandLocalQ,.72);
    }
   }
  },
  setHeight(h){const b=new THREE.Box3().setFromObject(model),v=b.max.y-b.min.y;if(v>0){holder.scale.setScalar(h/v);model.position.y=-b.min.y}}
 };
 const torso=bones.get('mixamorigSpine2')||bones.get('mixamorigSpine1')||bones.get('mixamorigSpine');
 if(torso){
  const outfit=new THREE.Group();
  const shirt=new THREE.MeshStandardMaterial({color:isEnemy?0x343d36:0x101114,roughness:.9});
  const pants=new THREE.MeshStandardMaterial({color:isEnemy?0x514637:0x17191d,roughness:.96});
  const gold=new THREE.MeshStandardMaterial({color:0xd6a52e,roughness:.48,metalness:.38});
  const dark=new THREE.MeshStandardMaterial({color:0x090a0c,roughness:.82});
  const make=(parent,w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o};
  if(isEnemy){
   make(outfit,.43,.48,.18,shirt,0,.02,.045);make(outfit,.34,.31,.035,gold,0,.025,.145);
   for(const x of [-.22,.22])make(outfit,.075,.39,.09,shirt,x,.02,.02);
   torso.add(outfit);
  }else{
   // Novo equipamento tático do operador: peças leves presas ao osso do tronco,
   // para acompanhar a corrida, a mira, o recuo e as mudanças de postura.
   const olive=new THREE.MeshStandardMaterial({color:0x354333,roughness:.9});
   const darkOlive=new THREE.MeshStandardMaterial({color:0x202a24,roughness:.88});
   const fabric=new THREE.MeshStandardMaterial({color:0x59604a,roughness:.98});
   const webbing=new THREE.MeshStandardMaterial({color:0x171e1a,roughness:.94});
   const armor=new THREE.MeshStandardMaterial({color:0x343d36,roughness:.76,metalness:.08});
   const pouchMat=new THREE.MeshStandardMaterial({color:0x414b38,roughness:.95});
   const detail=new THREE.MeshStandardMaterial({color:0x9b9b78,roughness:.75});
   const sphere=(parent,radius,material,x,y,z,sx=1,sy=1,sz=1)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(radius,12,10),material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;parent.add(o);return o};
   // Colete balístico, placas frontal/traseira, ombreiras e tiras.
   make(outfit,.49,.58,.27,olive,0,.015,.035);
   make(outfit,.38,.43,.035,armor,0,.025,.185);
   make(outfit,.36,.42,.035,darkOlive,0,.025,-.145);
   make(outfit,.51,.075,.29,webbing,0,-.235,.025);
   for(const x of [-.17,-.055,.055,.17]){
    make(outfit,.075,.15,.075,pouchMat,x,-.12,.215);
    make(outfit,.078,.035,.08,webbing,x,-.035,.22);
   }
   for(const x of [-.245,.245]){
    sphere(outfit,.13,armor,x,.205,.015,1.2,.68,1.05);
    make(outfit,.095,.22,.12,fabric,x,-.005,.025);
   }
   // Rádio, fivela e mochila compacta.
   make(outfit,.105,.18,.08,darkOlive,-.29,.12,.02);
   make(outfit,.075,.045,.025,detail,.0,-.235,.18);
   make(outfit,.31,.42,.17,darkOlive,0,.045,-.235);
   make(outfit,.25,.12,.19,olive,0,-.18,-.235);
   torso.add(outfit);
   // Joelheiras e botas acompanham os ossos das pernas, não ficam soltas no cenário.
   for(const [side,label] of [[-1,'Left'],[1,'Right']]){
    const thigh=bones.get('mixamorig'+label+'UpLeg');
    const shin=bones.get('mixamorig'+label+'Leg');
    if(thigh){
     const pad=new THREE.Group();
     sphere(pad,.105,armor,0,-.30,.075,1.05,.72,.55);
     make(pad,.13,.055,.025,webbing,0,-.30,.12);
     thigh.add(pad);
    }
    if(shin){
     const boot=new THREE.Group();
     make(boot,.15,.23,.22,darkOlive,0,-.34,.035);
     make(boot,.16,.045,.23,webbing,0,-.445,.045);
     shin.add(boot);
    }
   }
  }
 }
 const head=bones.get('mixamorigHead')||bones.get('Head');
 if(head&&isEnemy){
  const helmet=new THREE.Group(),shell=new THREE.Mesh(new THREE.SphereGeometry(.145,24,16),new THREE.MeshStandardMaterial({color:0x454d43,roughness:.72,metalness:.08}));
  shell.scale.set(1.12,.76,1.1);shell.position.y=.095;helmet.add(shell);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.145,.012,8,28),new THREE.MeshStandardMaterial({color:0x1b2422,roughness:.8}));
  rim.position.y=.04;rim.rotation.x=Math.PI/2;helmet.add(rim);head.add(helmet);
 }else if(head&&!isEnemy){
  // Capacete do operador, com aba frontal, proteção lateral e headset.
  const helmet=new THREE.Group();
  const shell=new THREE.Mesh(new THREE.SphereGeometry(.155,20,14),new THREE.MeshStandardMaterial({color:0x3c4939,roughness:.78}));
  shell.scale.set(1.12,.78,1.12);shell.position.y=.075;helmet.add(shell);
  const brim=new THREE.Mesh(new THREE.BoxGeometry(.23,.035,.19),new THREE.MeshStandardMaterial({color:0x202820,roughness:.85}));
  brim.position.set(0,.015,.105);helmet.add(brim);
  const band=new THREE.Mesh(new THREE.TorusGeometry(.145,.012,7,24),new THREE.MeshStandardMaterial({color:0x1c241e,roughness:.8}));
  band.position.y=.025;band.rotation.x=Math.PI/2;helmet.add(band);
  for(const x of [-.145,.145]){
   const ear=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.075,10),new THREE.MeshStandardMaterial({color:0x202820,roughness:.85}));
   ear.rotation.z=Math.PI/2;ear.position.set(x,-.005,0);helmet.add(ear);
  }
  head.add(helmet);
 }
 addRifle(rig);scene.add(holder);await rig.playRole('idle');return rig;
}
function resolvePlayerObstacles(){
 const p=playerRig.holder.position,radius=.58;
 for(const obstacle of worldObstacles){
  let dx=p.x-obstacle.x,dz=p.z-obstacle.z,distance=Math.hypot(dx,dz),minimum=obstacle.radius+radius;
  if(distance<minimum){if(distance<.001){dx=1;dz=0;distance=1}const nx=dx/distance,nz=dz/distance;p.x=obstacle.x+nx*minimum;p.z=obstacle.z+nz*minimum;const into=playerVelocity.x*nx+playerVelocity.z*nz;if(into<0){playerVelocity.x-=into*nx;playerVelocity.z-=into*nz}}
 }
}
function play(rig,role,speed=1){if(!rig)return;const clip=rig.lib.role(role)?.clip;if(clip)rig.playRole(role,{fade:.22,speed}).catch(()=>{})}
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
 const run=THREE.MathUtils.clamp(Math.hypot(forwardSpeed,lateralSpeed)/5.4,0,1);
 rig.lateralMotion=THREE.MathUtils.clamp(lateralSpeed/5.4,-1,1);
 rig.forwardMotion=THREE.MathUtils.clamp(forwardSpeed/5.4,-1,1);
 const stance=rig.stanceMode==='prone' ? -.10 : rig.stanceMode==='crouch' ? -.035 : 0;
 const firing=rig.isPlayer?THREE.MathUtils.clamp(rig.weaponFireBlend||0,0,1):0;
 const aiming=rig.isPlayer?THREE.MathUtils.clamp(rig.weaponAimBlend||0,0,1):0;
 const targetPitch=-run*(rig.runBlend ? .14 : .065)+stance+firing*.20+aiming*.075;
 const targetRoll=THREE.MathUtils.clamp(-lateralSpeed*.024,-.095,.095);
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
 // Three.js r160 precisa de WebGL 2; falhar com instrução clara em aparelhos incompatíveis.
 if(!('WebGL2RenderingContext' in window))throw new Error('Este aparelho/navegador não oferece WebGL 2. Atualize o iOS e abra o jogo no Safari mais recente (iOS 15 ou superior).');
 try{
  renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power',stencil:false,depth:true,preserveDrawingBuffer:false});
 }catch(err){throw new Error('Não foi possível ativar os gráficos WebGL 2. Feche outras abas, atualize o iOS e tente novamente. '+(err?.message||''))}
 // Perfil gráfico equilibrado: imagem mais nítida sem sobrecarregar o Safari no iPhone.
 const mobileQuality=innerWidth<700;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobileQuality?.92:1.25));
 renderer.setSize(innerWidth,innerHeight);
 renderer.shadowMap.enabled=!mobileQuality&&!!gameSettings.shadows&&gameSettings.quality!=='low';
 renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.setScissorTest(false);
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.02;
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
 setupControls();initSettings();addEventListener('resize',resize,{passive:true});addEventListener('orientationchange',()=>setTimeout(resize,180),{passive:true});window.visualViewport?.addEventListener('resize',resize,{passive:true});
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
function resize(){
 if(!renderer)return;
 const vv=window.visualViewport,w=Math.max(1,Math.round(vv?.width||window.innerWidth)),h=Math.max(1,Math.round(vv?.height||window.innerHeight));
 camera.aspect=w/h;camera.updateProjectionMatrix();
 const mobile=Math.min(w,h)<700;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?(gameSettings.quality==='low'?.68:.82):1.25));
 renderer.setSize(w,h,false);
}
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
 if(sprintButton){
  sprintButton.setAttribute('aria-pressed','false');
  const toggleSprint=e=>{
   e.preventDefault();
   e.stopPropagation();
   if(!sprintHeld&&movementMode!=='stand')setMovementMode('stand');
   sprintHeld=!sprintHeld;
   sprintButton.classList.toggle('active',sprintHeld);
   sprintButton.setAttribute('aria-pressed',String(sprintHeld));
   statusEl.textContent=sprintHeld?'CORRIDA ATIVADA — USE O JOYSTICK':'EM COMBATE';
  };
  sprintButton.addEventListener('pointerdown',toggleSprint,{passive:false});
 }
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
 firePoseTimer=.42;playerRig.weaponKick=Math.min(.28,(playerRig.weaponKick||0)+(weaponIndex===2?.17:weaponIndex===3?.14:weaponIndex===4?.045:.095));
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
 const canSprint=sprintHeld&&keys.forward>.12&&!aiming&&!fireHeld&&movementMode==='stand';
  const moveSpeed=movementMode==='prone'?.95:movementMode==='crouch'?1.85:aiming?2.65:canSprint?7.1:5.35;
  const targetVelocity=move.clone().multiplyScalar(moveSpeed);
  const hasInput=move.lengthSq()>.0025;
  const acceleration=hasInput?(movementMode==='prone'?5.5:movementMode==='crouch'?7:canSprint?10:8):22;
  playerVelocity.lerp(targetVelocity,1-Math.exp(-acceleration*dt));
  // Freio mais firme ao soltar o joystick: evita o efeito de patinação ao parar.
  if(!hasInput&&playerVelocity.lengthSq()<.0064)playerVelocity.set(0,0,0);
  p.position.addScaledVector(playerVelocity,dt);resolvePlayerObstacles();p.position.x=THREE.MathUtils.clamp(p.position.x,-124,124);p.position.z=THREE.MathUtils.clamp(p.position.z,-124,124);
 const grounded=p.position.y<=.001;
  const moving=playerVelocity.length()>.16;
  if(moving){dustClock-=dt;if(dustClock<=0){dustClock=movementMode==='prone'?.34:playerVelocity.length()>4.2?.12:.24;const foot=p.position.clone().add(new THREE.Vector3((Math.random()-.5)*.55,.12,(Math.random()-.5)*.55));for(let n=0;n<(movementMode==='prone'?1:3);n++)addParticle(foot,0xc6b58a,1.1,.055,.3)}
   const desiredYaw=aiming?worldYaw+Math.PI:Math.atan2(playerVelocity.x,playerVelocity.z);
   const turn=THREE.MathUtils.euclideanModulo(desiredYaw-p.rotation.y+Math.PI,Math.PI*2)-Math.PI;
   p.rotation.y+=turn*Math.min(1,(aiming?14:11)*dt);
   const airborne=p.position.y>.04,role=airborne?'jump':canSprint?'run':'walk';const gaitSpeed=airborne?1:canSprint?1.38:movementMode==='prone'?.48:movementMode==='crouch'?.62:aiming?.76:THREE.MathUtils.clamp(playerVelocity.length()/3.9,.78,1.28);play(playerRig,role,gaitSpeed);
  }else{
   const faceYaw=worldYaw+Math.PI,turn=THREE.MathUtils.euclideanModulo(faceYaw-p.rotation.y+Math.PI,Math.PI*2)-Math.PI;
   p.rotation.y+=turn*Math.min(1,(aiming||fireHeld||firePoseTimer>0?12:5)*dt);play(playerRig,p.position.y>.04?'jump':'idle');
  }
  playerRig.firePosePhase=clock.elapsedTime;
  playerRig.weaponAimBlend=THREE.MathUtils.damp(playerRig.weaponAimBlend||0,Math.max(aimBlend,firePoseTimer>0?.82:0),14,dt);
    playerRig.aimPitch=pitch*playerRig.weaponAimBlend;
    playerRig.reloadBlend=reloadTimer>0?THREE.MathUtils.clamp(reloadTimer/currentWeapon().reload,0,1):0;
   playerRig.weaponFireBlend=THREE.MathUtils.damp(playerRig.weaponFireBlend||0,Math.max(fireHeld?1:0,firePoseTimer>0?.92:0,THREE.MathUtils.clamp(recoil*3.2,0,.48)),14,dt);
   playerRig.runBlend=THREE.MathUtils.damp(playerRig.runBlend||0,canSprint?1:0,10,dt);
   playerRig.sprintBlend=playerRig.runBlend;
   playerRig.locomotionBlend=THREE.MathUtils.damp(playerRig.locomotionBlend||0,THREE.MathUtils.clamp(playerVelocity.length()/5.35,0,1),12,dt);
   playerRig.weaponRunBlend=THREE.MathUtils.damp(playerRig.weaponRunBlend||0,canSprint?1:0,9,dt);
   if(playerRig.weaponPivot&&playerRig.weaponBasePosition&&playerRig.weaponBaseRotation){
    const moveAmount=THREE.MathUtils.clamp(playerVelocity.length()/5.35,0,1);
    const strafe=playerVelocity.dot(right);
    const gait=clock.elapsedTime*(canSprint?13:aiming?7:9);
    const aim=playerRig.weaponAimBlend,run=playerRig.weaponRunBlend;
    // Transições de empunhadura: arma sobe ao mirar, baixa ao correr e acompanha o movimento.
    playerRig.weaponPivot.position.copy(playerRig.weaponBasePosition);
    const reloadBlend=reloadTimer>0?THREE.MathUtils.clamp(reloadTimer/currentWeapon().reload,0,1):0;
    playerRig.weaponPivot.position.y+=.085*aim-.16*run-.055*reloadBlend+Math.sin(gait)*(.012*moveAmount)*(1-aim);
    playerRig.weaponPivot.position.x-=.018*aim+THREE.MathUtils.clamp(strafe/5.35,-1,1)*.012*moveAmount;
    playerRig.weaponPivot.rotation.copy(playerRig.weaponBaseRotation);
    playerRig.weaponPivot.rotation.x-=.19*aim+.42*run+.22*reloadBlend+(playerRig.weaponKick||0);
     // A arma acompanha a elevação vertical da mira, em vez de permanecer fixa no peito.
     playerRig.weaponPivot.rotation.x+=THREE.MathUtils.clamp(pitch,-.78,.78)*aim*.82;
    playerRig.weaponPivot.rotation.z-=THREE.MathUtils.clamp(strafe/5.35,-1,1)*.075*moveAmount;
     playerRig.weaponPivot.rotation.z-=THREE.MathUtils.clamp(strafe/5.35,-1,1)*.035*aim;
    playerRig.weaponPivot.rotation.y+=.08*reloadBlend;
    playerRig.weaponPivot.rotation.y+=Math.sin(gait*.5)*.012*moveAmount*(1-aim);
   }
  playerRig.jumpV=(playerRig.jumpV||0)-15*dt;p.position.y=Math.max(0,p.position.y+(playerRig.jumpV||0)*dt);if(p.position.y===0&&playerRig.jumpV<0)playerRig.jumpV=0;
   playerRig.jumpBlend=THREE.MathUtils.clamp(p.position.y/.82,0,1);
  applyBodyMotion(playerRig,playerVelocity.dot(forward),playerVelocity.dot(right),dt);playerRig.update(dt);if(playerRig.weaponPivot)playerRig.weaponKick=Math.max(0,(playerRig.weaponKick||0)-dt*1.35);
 for(const e of enemies){if(!e.alive)continue;const ep=e.rig.holder,delta=p.position.clone().sub(ep.position);const dist=delta.length();if(dist>2.3){delta.normalize();ep.position.addScaledVector(delta,1.35*dt);ep.rotation.y=Math.atan2(delta.x,delta.z);if(e.anim!=='run'){e.anim='run';play(e.rig,'run')}}else{if(e.anim!=='idle'){e.anim='idle';play(e.rig,'idle')}e.attack+=dt;if(e.attack>1.5){e.attack=0;const raw=4,blocked=Math.min(armor,raw*.5);armor-=blocked;health=Math.max(0,health-(raw-blocked));refreshVitals();statusEl.textContent='SOB ATAQUE';setTimeout(()=>{if(health>0)statusEl.textContent='PRONTO'},450)}}applyBodyMotion(e.rig,dist>2.3?1.35:0,0,dt);e.rig.update(dt);if(e.rig.weaponPivot){e.rig.weaponKick=Math.max(0,(e.rig.weaponKick||0)-dt*.9);e.rig.weaponPivot.rotation.x=-.08-(e.rig.weaponKick||0)}}
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.mesh.position.addScaledVector(b.dir,72*dt);b.life-=dt;let hit=false;for(const e of enemies){if(e.alive){const base=e.rig.holder.position,head=base.clone().add(new THREE.Vector3(0,1.72,0)),torso=base.clone().add(new THREE.Vector3(0,.96,0));const headHit=b.mesh.position.distanceTo(head)<.42,bodyHit=b.mesh.position.distanceTo(torso)<.72;if(headHit||bodyHit){const falloff=Math.max(.52,1-(b.travelled/Math.max(1,b.range))*.42),dealt=b.damage*falloff*(headHit?2.15:1);e.hp-=dealt;hitMarkerTimer=.18;document.querySelector('#crosshair')?.classList.add('hit');burst(b.mesh.position,headHit?16:10,headHit?0xffe16b:0xffa34d,4.8);statusEl.textContent=headHit?'TIRO NA CABEÇA!':'ACERTO';hit=true;if(e.hp<=0){e.alive=false;burst(e.rig.holder.position.clone().add(new THREE.Vector3(0,1,0)),22,0xffd06b,5);scene.remove(e.rig.holder);e.rig.dispose();kills++;scoreEl.textContent=String(kills);document.querySelector('#remainingEnemies').textContent=String(enemies.filter(x=>x.alive).length)}break}}}b.travelled+=72*dt;if(hit||b.life<=0||b.travelled>=b.range){scene.remove(b.mesh);bullets.splice(i,1)}}
 fireCooldown=Math.max(0,fireCooldown-dt);firePoseTimer=Math.max(0,firePoseTimer-dt);
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
  const desiredCamera=lookTarget.clone().add(forwardView.clone().multiplyScalar(-cameraDistance)).add(rightView.multiplyScalar(shoulder));
  const smooth=1-Math.exp(-15*dt);camera.position.lerp(desiredCamera,smooth);cameraLook.lerp(lookTarget,smooth);camera.lookAt(cameraLook);
  const wantedFov=THREE.MathUtils.lerp(sprintHeld&&!aiming?70:66,Math.max(36,48-scopeLevel*3.5),aimBlend);if(Math.abs(camera.fov-wantedFov)>.08){camera.fov=THREE.MathUtils.lerp(camera.fov,wantedFov,smooth);camera.updateProjectionMatrix();}
  const crosshair=document.querySelector('#crosshair');if(crosshair){const movementBloom=THREE.MathUtils.clamp(playerVelocity.length()/7.1,0,1)*(aiming?.18:.34);const bloomScale=THREE.MathUtils.clamp((aiming?.72:1)+movementBloom+recoil*.7,.68,1.55);crosshair.style.scale=String(bloomScale);}
 updateSafeZone(dt);
 if(hitMarkerTimer>0){hitMarkerTimer-=dt;if(hitMarkerTimer<=0)document.querySelector('#crosshair')?.classList.remove('hit')}updateEffects(dt);radarClock-=dt;if(radarClock<=0){radarClock=.35;updateRadar()}renderer.render(scene,camera);
}
init().catch(err=>{console.error(err);loading.style.display='none';errorPanel.style.display='grid';document.querySelector('#errorMessage').textContent=err?.message||'Não foi possível iniciar. Atualize o navegador e confira a conexão.'});

// syntax validation
