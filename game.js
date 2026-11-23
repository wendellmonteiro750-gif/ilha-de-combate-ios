import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Character, Library, catalogFromFiles } from './character.js';

const root=document.querySelector('#game'),loading=document.querySelector('#loading'),statusEl=document.querySelector('#status');
const scoreEl=document.querySelector('#score'),ammoEl=document.querySelector('#ammo'),healthEl=document.querySelector('#health');
const errorPanel=document.querySelector('#errorPanel');
let renderer,scene,camera,clock,playerRig,worldYaw=0,pitch=-.12,ammo=30,kills=0,health=100,armor=0,medkits=1,library;
const weapons=[{name:'FUZIL',mag:30,damage:35,rate:.13,spread:.014,reload:1.35},{name:'SMG',mag:40,damage:19,rate:.075,spread:.022,reload:1.5},{name:'PRECISÃO',mag:8,damage:90,rate:.72,spread:.002,reload:1.8}];
let weaponIndex=0,weaponAmmo=[30,40,8],scopeLevel=0;
function currentWeapon(){return weapons[weaponIndex]}
function refreshAmmo(){ammo=weaponAmmo[weaponIndex];ammoEl.textContent='MUNIÇÃO '+ammo;document.querySelector('#ammoLarge').textContent=ammo;document.querySelector('#weaponSwitch').textContent='ARMA: '+currentWeapon().name;refreshInventory()}
function refreshInventory(){
 const panel=document.querySelector('#inventoryPanel');if(!panel)return;
 document.querySelector('#inventoryWeapons').innerHTML=weapons.map((w,i)=>'<div class="inventory-slot '+(i===weaponIndex?'equipped':'')+'"><b>'+(i+1)+'. '+w.name+'</b><span>'+weaponAmmo[i]+' / '+w.mag+'</span><small>DANO '+w.damage+'</small></div>').join('');
 document.querySelector('#inventorySupplies').textContent='Kits: '+medkits+'  •  Colete: '+Math.round(armor)+'%  •  Miras: '+scopeLevel+'x  •  Munição atual: '+ammo;
}
function toggleInventory(){
 const panel=document.querySelector('#inventoryPanel');const open=panel.classList.toggle('visible');
 document.querySelector('#inventoryToggle').textContent=open?'FECHAR MOCHILA':'MOCHILA';
 refreshInventory();
}
function switchWeapon(){if(reloadTimer>0)return;weaponIndex=(weaponIndex+1)%weapons.length;refreshAmmo();statusEl.textContent='EQUIPADO: '+currentWeapon().name}

const playerVelocity=new THREE.Vector3(),cameraLook=new THREE.Vector3();
let safeRing=null,zoneElapsed=0,zoneDamageClock=0,lootItems=[];
const keys={forward:0,side:0},bullets=[],enemies=[],effects=[];let dustClock=0,recoil=0,aiming=false,hitMarkerTimer=0,fireHeld=false,fireCooldown=0,reloadTimer=0;
const BASE='https://raw.githubusercontent.com/NoLimitNexus/game-models/main/';

function mat(color,roughness=.86,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function box(parent,w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function addTextureGround(){
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
 ctx.fillStyle='#667d43';ctx.fillRect(0,0,512,512);
 for(let i=0;i<52000;i++){const x=Math.random()*512,y=Math.random()*512,v=65+Math.random()*80;ctx.fillStyle='rgba('+Math.floor(v*.72)+','+Math.floor(v)+','+Math.floor(v*.48)+','+(Math.random()*.22)+')';ctx.fillRect(x,y,1+Math.random()*3,1+Math.random()*3)}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(28,28);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
}
function addPalm(x,z,s=1){
 const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12*s,.24*s,4.2*s,12),mat(0x79543a));trunk.position.y=2.1*s;trunk.rotation.z=-.08;trunk.castShadow=true;g.add(trunk);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,leaf=new THREE.Mesh(new THREE.ConeGeometry(.3*s,3.1*s,7),mat(i%2?0x28643c:0x397c46));leaf.position.set(Math.sin(a)*.95*s,4.05*s,Math.cos(a)*.95*s);leaf.rotation.z=Math.cos(a)*.95;leaf.rotation.x=-Math.sin(a)*.95;leaf.castShadow=true;g.add(leaf)}
 g.position.set(x,0,z);scene.add(g);
}
function addHouse(x,z,rotation=0){
 const g=new THREE.Group(),wall=mat(0xc8b28d),wood=mat(0x694b35),roof=mat(0x813d2d),glass= new THREE.MeshStandardMaterial({color:0x83b8bd,roughness:.25,metalness:.1});
 box(g,5.2,2.8,4.4,wall,0,1.4,0);box(g,1,.1,4.5,wood,0,2.78,0);
 const roofMesh=new THREE.Mesh(new THREE.ConeGeometry(4,1.65,4),roof);roofMesh.position.y=3.5;roofMesh.rotation.y=Math.PI/4;roofMesh.castShadow=true;g.add(roofMesh);
 box(g,.9,1.8,.16,wood,0,.9,2.24);
 for(const sx of [-1,1]){box(g,.86,.7,.12,wood,sx*1.55,1.8,2.25);box(g,.7,.55,.035,glass,sx*1.55,1.8,2.31)}
 g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);
}
function addWorldDetail(){
 // Vegetação em instâncias: mais densidade visual com poucas chamadas de desenho.
 const dummy=new THREE.Object3D();
 const grassGeo=new THREE.ConeGeometry(.075,.62,4);
 const grassMat=new THREE.MeshStandardMaterial({color:0x6d9146,roughness:1});
 const grass=new THREE.InstancedMesh(grassGeo,grassMat,950);
 let n=0;for(let i=0;i<950;i++){const a=Math.random()*Math.PI*2,r=8+Math.random()*111,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x,z)>120)continue;dummy.position.set(x,.25,z);dummy.rotation.set((Math.random()-.5)*.18,Math.random()*Math.PI,0);const h=.55+Math.random()*.9;dummy.scale.set(.7,h,.7);dummy.updateMatrix();grass.setMatrixAt(n++,dummy.matrix)}grass.count=n;grass.instanceMatrix.needsUpdate=true;scene.add(grass);
 const bushGeo=new THREE.IcosahedronGeometry(1,1),bushMat=new THREE.MeshStandardMaterial({color:0x315c36,roughness:1});
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
 scene.background=new THREE.Color(0x9bcbe4);scene.fog=new THREE.Fog(0xa9cbd0,245,650);
 scene.add(new THREE.HemisphereLight(0xe8f5ff,0x46583a,2.15));
 const sun=new THREE.DirectionalLight(0xffedcf,3.5);sun.position.set(-42,78,34);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-165;sun.shadow.camera.right=165;sun.shadow.camera.top=165;sun.shadow.camera.bottom=-165;sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun);
 const fill=new THREE.DirectionalLight(0x9bc8e8,.72);fill.position.set(55,28,-48);scene.add(fill);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.MeshStandardMaterial({map:addTextureGround(),roughness:.96}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const beach=new THREE.Mesh(new THREE.RingGeometry(119,141,192),new THREE.MeshStandardMaterial({color:0xd9c18c,roughness:.95}));beach.rotation.x=-Math.PI/2;beach.position.y=.035;scene.add(beach);
 const waterMat=new THREE.MeshStandardMaterial({color:0x168aa6,roughness:.16,metalness:.16});
 const water=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100,1,1),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-.28;scene.add(water);
 for(let i=0;i<46;i++){const a=i*2.399,r=22+(i%8)*3.3;addPalm(Math.cos(a)*r,Math.sin(a)*r,.75+(i%4)*.1)}
 for(let i=0;i<95;i++){const a=i*2.399,r=52+(i%13)*5.1;addPalm(Math.cos(a)*r,Math.sin(a)*r,.85+(i%5)*.12)}
 addHouse(-12,-12,.2);addHouse(14,-18,-.3);addHouse(22,9,.8);addHouse(-25,15,-.5);
 addHouse(68,35,.4);addHouse(-76,-42,-.7);addHouse(38,-88,.2);addHouse(-92,72,1.1);addHouse(102,5,-.4);
 // Novas casas distribuídas pela ilha para criar mais áreas de exploração.
 addHouse(42,54,.65);addHouse(-48,68,-.25);addHouse(84,-58,1.35);addHouse(-58,-76,.45);
 addHouse(6,82,-.8);addHouse(-104,18,.3);addHouse(108,78,-.55);addHouse(-8,-96,1.05);
 for(let i=0;i<34;i++){const a=i*2.4,r=9+(i%6)*4;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.55+(i%4)*.22,1),mat(i%2?0x58644d:0x7b8069));rock.position.set(Math.cos(a)*r,.3,Math.sin(a)*r);rock.scale.y=.65;rock.castShadow=true;rock.receiveShadow=true;scene.add(rock)}
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
  [-56,-79,'weapon',0],[8,85,'medkit'],[-101,21,'ammo'],[106,80,'weapon',2],[-6,-99,'scope']
 ];
 drops.forEach(([x,z,type,weaponSlot],i)=>{
  const group=new THREE.Group();
  const colors={medkit:0x42d879,armor:0x4ca8ff,ammo:0xf3c64e,weapon:0xd9823b,scope:0xb78cff};
  const color=colors[type]||0xf3c64e,base=mat(type==='medkit'?0x315c42:0x514b3f,.72),trim=mat(color,.42,.22);
  box(group,.72,.48,.62,base,0,.26,0);
  box(group,.76,.09,.66,trim,0,.5,0);
  if(type==='weapon'){
   box(group,.82,.09,.12,trim,0,.68,0);box(group,.16,.25,.14,base,.23,.56,0);
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
 else if(nearest.type==='ammo')weaponAmmo[weaponIndex]=Math.min(currentWeapon().mag,weaponAmmo[weaponIndex]+20);
 else if(nearest.type==='scope'){scopeLevel=Math.min(3,scopeLevel+1);statusEl.textContent='MIRA '+scopeLevel+'X COLETADA';}
 else if(nearest.type==='weapon'){weaponIndex=nearest.weaponSlot??((weaponIndex+1)%weapons.length);weaponAmmo[weaponIndex]=Math.min(currentWeapon().mag,weaponAmmo[weaponIndex]+currentWeapon().mag);statusEl.textContent=currentWeapon().name+' ENCONTRADO';}
 refreshAmmo();refreshVitals();
 if(nearest.type==='medkit')statusEl.textContent='KIT ENCONTRADO';
 else if(nearest.type==='armor')statusEl.textContent='COLETE REFORÇADO';
 else if(nearest.type==='ammo')statusEl.textContent='MUNIÇÃO COLETADA';
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
function addRifle(rig){
 const hand=rig.bones.get('handslotr')||rig.bones.get('handslot.r');if(!hand)return;
 const gun=new THREE.Group();
 const steel=new THREE.MeshStandardMaterial({color:0x303941,roughness:.34,metalness:.82});
 const dark=new THREE.MeshStandardMaterial({color:0x11171b,roughness:.62,metalness:.28});
 const polymer=new THREE.MeshStandardMaterial({color:0x343b35,roughness:.78});
 const tan=new THREE.MeshStandardMaterial({color:0x594632,roughness:.82});
 // Corpo, coronha, guarda-mão e cano
 box(gun,.13,.15,.52,steel,0,0,-.12);
 box(gun,.115,.13,.34,polymer,0,-.015,.31);
 box(gun,.105,.13,.38,dark,0,.005,-.53);
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.58,12),steel);
 barrel.rotation.x=Math.PI/2;barrel.position.set(0,.015,-.96);gun.add(barrel);
 const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.045,.035,.11,12),dark);
 muzzle.rotation.x=Math.PI/2;muzzle.position.set(0,.015,-1.27);gun.add(muzzle);
 // Trilho superior, mira, luneta e alça
 box(gun,.055,.035,.76,dark,0,.105,-.43);
 box(gun,.045,.09,.13,steel,0,.17,-.42);
 const scope=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,.23,12),dark);
 scope.rotation.x=Math.PI/2;scope.position.set(0,.19,-.39);gun.add(scope);
 box(gun,.08,.07,.19,polymer,0,-.13,-.18);
 // Carregador curvo e empunhadura
 const mag=box(gun,.09,.28,.16,dark,0,-.22,-.13);mag.rotation.x=-.12;
 const grip=box(gun,.09,.22,.12,tan,0,-.19,.12);grip.rotation.x=-.2;
 box(gun,.13,.11,.16,tan,0,-.015,.49);
 // Detalhes laterais e trilhos
 for(const side of [-1,1]){box(gun,.018,.045,.29,steel,side*.067,.005,-.5);box(gun,.018,.07,.13,dark,side*.067,-.06,-.13)}
 gun.scale.setScalar(.92);gun.position.set(.02,-.02,.12);gun.rotation.x=-.06;hand.add(gun);
}
async function createFighter(isEnemy=false,index=0){
 const shirt=['#344b42','#6b4934','#394d66','#6a3831','#4a5140','#5a4939'][index%6];
 const rig=await Character.create(library,{parts:{hair:'hair_short',top:'top_long',bottom:'bottom_trousers',boots:'boots_tall',hat:'hat_cap',back:'back_pack'},colors:{skin:isEnemy?'#c28b68':'#d5a078',hair:'#292321',shirt:isEnemy?shirt:'#263e4a',trousers:'#343b43',boots:'#292725',hat:isEnemy?'#46564b':'#344c60',pack:'#554733',linen:'#b5a27f'}});
 rig.setHeight(1.82);
 // Capacete e viseira presos ao osso da cabeça, sem alterar o esqueleto das animações.
 const head=rig.bones.get('head')||rig.bones.get('Head');
 if(head){
  const helmet=new THREE.Group(),shell=new THREE.Mesh(new THREE.SphereGeometry(.235,18,14),new THREE.MeshStandardMaterial({color:isEnemy?0x4b554b:0x344b52,roughness:.58,metalness:.12}));
  shell.scale.set(1.08,.78,1.08);shell.position.y=.055;helmet.add(shell);
  const brim=new THREE.Mesh(new THREE.BoxGeometry(.34,.045,.29),new THREE.MeshStandardMaterial({color:0x1c292d,roughness:.5}));brim.position.set(0,-.025,-.16);helmet.add(brim);
  const strap=new THREE.Mesh(new THREE.TorusGeometry(.205,.018,6,20,Math.PI),new THREE.MeshStandardMaterial({color:0x242a29,roughness:.9}));strap.rotation.z=Math.PI;strap.position.y=-.06;helmet.add(strap);
  head.add(helmet);
 }
 addRifle(rig);scene.add(rig.holder);await rig.playRole('idle');return rig;
}
function play(rig,role,speed=1){if(!rig)return;const clip=rig.lib.role(role)?.clip;if(clip&&rig.playing!==clip)rig.playRole(role,{fade:.22,speed}).catch(()=>{})}
function applyBodyMotion(rig,forwardSpeed,lateralSpeed,dt){
 if(!rig)return;
 const holder=rig.holder;
 const run=THREE.MathUtils.clamp(Math.abs(forwardSpeed)/5.4,0,1);
 const targetPitch=-run*.055;
 const targetRoll=THREE.MathUtils.clamp(-lateralSpeed*.018,-.07,.07);
 const blend=1-Math.exp(-8*dt);
 holder.rotation.x=THREE.MathUtils.lerp(holder.rotation.x,targetPitch,blend);
 holder.rotation.z=THREE.MathUtils.lerp(holder.rotation.z,targetRoll,blend);
}
function addParticle(position,color=0xffb34d,speed=3,size=.09,life=.35){
 if(effects.length>110)return;
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,6,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));
 mesh.position.copy(position);scene.add(mesh);
 const velocity=new THREE.Vector3((Math.random()-.5)*speed,(Math.random()*.85)*speed,(Math.random()-.5)*speed);
 effects.push({mesh,velocity,life,maxLife:life,gravity:5,kind:'particle'});
}
function burst(position,count=9,color=0xffa33d,speed=4){
 for(let i=0;i<count;i++)addParticle(position,color,speed,.045+Math.random()*.045,.22+Math.random()*.24);
}
function muzzleFlash(position,direction){
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
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 // Perfil gráfico equilibrado: imagem mais nítida sem sobrecarregar o Safari no iPhone.
 const mobileQuality=innerWidth<700;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobileQuality?1.5:1.85));
 renderer.setSize(innerWidth,innerHeight);
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.12;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor(0x9bcbe4,1);
 root.appendChild(renderer.domElement);
 scene=new THREE.Scene();clock=new THREE.Clock();buildWorld();camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,900);camera.position.set(.7,2.35,4.8);cameraLook.set(0,1.45,-1.2);camera.lookAt(cameraLook);
 loading.textContent='CARREGANDO PERSONAGEM 3D…';
 const catalog=await catalogFromFiles(BASE);catalog.animations=catalog.animations.filter(a=>['General','Movement Basic','Movement Advanced','Combat Ranged'].includes(a.group));library=new Library(catalog);
 playerRig=await createFighter(false,0);playerRig.holder.position.set(0,0,0);playerRig.holder.rotation.y=Math.PI;
 // Mantém a cabeça visível: a câmera agora acompanha o personagem em terceira pessoa.
 const spots=[[62,18],[-70,36],[18,78],[-42,-88],[98,-52]];
 await Promise.all(spots.map((p,i)=>spawnEnemy(p[0],p[1],i)));
 setupControls();addEventListener('resize',resize);
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
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.5:1.85))}
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
  if(e.target.closest('#joystick,.actions')||e.clientX<innerWidth*.40)return;
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
 document.querySelector('#jump').onclick=()=>{playerRig.jumpV=5.8};
 document.querySelector('#aim').onclick=()=>{aiming=!aiming;document.querySelector('#aim').classList.toggle('active',aiming);document.querySelector('#crosshair')?.classList.toggle('aiming',aiming);statusEl.textContent=aiming?'MIRA PRECISA':'EM COMBATE'};
 const fireButton=document.querySelector('#fire');
 fireButton.addEventListener('pointerdown',e=>{e.preventDefault();fireHeld=true;fireButton.setPointerCapture(e.pointerId);shoot()});
 const stopFire=()=>{fireHeld=false};fireButton.addEventListener('pointerup',stopFire);fireButton.addEventListener('pointercancel',stopFire);fireButton.addEventListener('lostpointercapture',stopFire);
 document.querySelector('#reload').onclick=reloadWeapon;
 document.querySelector('#medkit').onclick=useMedkit;
 document.querySelector('#weaponSwitch').onclick=switchWeapon;
 document.querySelector('#inventoryToggle').onclick=toggleInventory;
 document.querySelector('#loot').onclick=takeLoot;
}
function reloadWeapon(){
 if(reloadTimer>0||ammo>=currentWeapon().mag)return;
 fireHeld=false;reloadTimer=currentWeapon().reload;statusEl.textContent='RECARREGANDO';
 document.querySelector('#reload').classList.add('active');
}
function shoot(){
 if(reloadTimer>0||fireCooldown>0)return;
 if(ammo<=0){statusEl.textContent='RECARREGUE';fireHeld=false;return}
 ammo--;weaponAmmo[weaponIndex]=ammo;ammoEl.textContent='MUNIÇÃO '+ammo;document.querySelector('#ammoLarge').textContent=ammo;refreshInventory();
 fireCooldown=currentWeapon().rate*(aiming?.82:1);
 const dir=new THREE.Vector3();camera.getWorldDirection(dir);
 const spread=(aiming?currentWeapon().spread*Math.max(.08,.25-scopeLevel*.055):currentWeapon().spread)+(playerVelocity.length()>.5?currentWeapon().spread*.8:0);
 dir.x+=(Math.random()-.5)*spread;dir.y+=(Math.random()-.5)*spread;dir.z+=(Math.random()-.5)*spread;dir.normalize();
 const origin=playerRig.holder.position.clone().add(new THREE.Vector3(0,1.42,0)).add(dir.clone().multiplyScalar(.8));
 muzzleFlash(origin,dir);document.querySelector('#crosshair')?.classList.add('firing');setTimeout(()=>document.querySelector('#crosshair')?.classList.remove('firing'),85);recoil=Math.min(.24,recoil+(aiming?.035:.065));
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.72,6),new THREE.MeshBasicMaterial({color:0xffdf91,transparent:true,opacity:.95}));
 mesh.position.copy(origin).add(dir.clone().multiplyScalar(.48));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);scene.add(mesh);bullets.push({mesh,dir,life:.22,damage:currentWeapon().damage});
 statusEl.textContent=ammo===0?'RECARREGUE':(aiming?'MIRA PRECISA':'DISPARANDO');
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
 worldYaw-=lookDeltaX*.0052;\n // Ajuste vertical mais controlado: evita inclinação excessiva e mantém o horizonte estável no toque.\n pitch=THREE.MathUtils.clamp(pitch-lookDeltaY*.0041,-.62,.62);\n lookDeltaX=lookDeltaY=0;
 const forward=new THREE.Vector3(Math.sin(worldYaw),0,-Math.cos(worldYaw)),right=new THREE.Vector3(Math.cos(worldYaw),0,Math.sin(worldYaw));
 const move=forward.multiplyScalar(keys.forward).add(right.multiplyScalar(keys.side));if(move.lengthSq()>1)move.normalize();
 const targetVelocity=move.clone().multiplyScalar(aiming?2.85:5.4);playerVelocity.lerp(targetVelocity,1-Math.exp(-9*dt));p.position.addScaledVector(playerVelocity,dt);p.position.x=THREE.MathUtils.clamp(p.position.x,-124,124);p.position.z=THREE.MathUtils.clamp(p.position.z,-124,124);
 if(playerVelocity.length()>.22){dustClock-=dt;if(dustClock<=0){dustClock=playerVelocity.length()>4.2?.12:.24;const foot=p.position.clone().add(new THREE.Vector3((Math.random()-.5)*.55,.12,(Math.random()-.5)*.55));for(let n=0;n<3;n++)addParticle(foot,0xc6b58a,1.1,.055,.3)}const desiredYaw=Math.atan2(playerVelocity.x,playerVelocity.z);const turn=THREE.MathUtils.euclideanModulo(desiredYaw-p.rotation.y+Math.PI,Math.PI*2)-Math.PI;p.rotation.y+=turn*Math.min(1,10*dt);play(playerRig,playerVelocity.length()>4.2?'run':'walk',playerVelocity.length()>4.2?1.08:1.02)}else{const faceYaw=worldYaw+Math.PI;const turn=THREE.MathUtils.euclideanModulo(faceYaw-p.rotation.y+Math.PI,Math.PI*2)-Math.PI;p.rotation.y+=turn*Math.min(1,(aiming||fireHeld?12:5)*dt);play(playerRig,fireHeld?'cast':'idle');}
 playerRig.jumpV=(playerRig.jumpV||0)-15*dt;p.position.y=Math.max(0,p.position.y+(playerRig.jumpV||0)*dt);if(p.position.y===0&&playerRig.jumpV<0)playerRig.jumpV=0;
 applyBodyMotion(playerRig,playerVelocity.dot(forward),playerVelocity.dot(right),dt);playerRig.update(dt);
 for(const e of enemies){if(!e.alive)continue;const ep=e.rig.holder,delta=p.position.clone().sub(ep.position);const dist=delta.length();if(dist>2.3){delta.normalize();ep.position.addScaledVector(delta,1.35*dt);ep.rotation.y=Math.atan2(delta.x,delta.z);if(e.anim!=='run'){e.anim='run';play(e.rig,'run')}}else{if(e.anim!=='idle'){e.anim='idle';play(e.rig,'idle')}e.attack+=dt;if(e.attack>1.5){e.attack=0;const raw=4,blocked=Math.min(armor,raw*.5);armor-=blocked;health=Math.max(0,health-(raw-blocked));refreshVitals();statusEl.textContent='SOB ATAQUE';setTimeout(()=>{if(health>0)statusEl.textContent='PRONTO'},450)}}applyBodyMotion(e.rig,dist>2.3?1.35:0,0,dt);e.rig.update(dt)}
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.mesh.position.addScaledVector(b.dir,72*dt);b.life-=dt;let hit=false;for(const e of enemies){if(e.alive&&b.mesh.position.distanceTo(e.rig.holder.position.clone().add(new THREE.Vector3(0,.9,0)))<1.05){e.hp-=b.damage;hitMarkerTimer=.18;document.querySelector('#crosshair')?.classList.add('hit');burst(b.mesh.position,12,0xffa34d,4.8);hit=true;if(e.hp<=0){e.alive=false;burst(e.rig.holder.position.clone().add(new THREE.Vector3(0,1,0)),22,0xffd06b,5);scene.remove(e.rig.holder);e.rig.dispose();kills++;scoreEl.textContent=String(kills);document.querySelector('#remainingEnemies').textContent=String(enemies.filter(x=>x.alive).length)}break}}if(hit||b.life<=0){scene.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();bullets.splice(i,1)}}
 fireCooldown=Math.max(0,fireCooldown-dt);
 if(fireHeld&&fireCooldown<=0&&reloadTimer<=0)shoot();
 if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){reloadTimer=0;weaponAmmo[weaponIndex]=currentWeapon().mag;refreshAmmo();document.querySelector('#reload').classList.remove('active');statusEl.textContent='PRONTO'}}
 recoil=Math.max(0,recoil-dt*.55);const forwardView=new THREE.Vector3(Math.sin(worldYaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(worldYaw)*Math.cos(pitch));const rightView=new THREE.Vector3(Math.cos(worldYaw),0,Math.sin(worldYaw));const movingBob=playerVelocity.length()>.25?Math.sin(clock.elapsedTime*(aiming?7.5:10.5))*.025*(aiming?.35:1):0;const lookTarget=p.position.clone().add(new THREE.Vector3(0,1.42+movingBob,0)).add(forwardView.clone().multiplyScalar(aiming?2.05:1.25)).add(new THREE.Vector3(0,recoil*.13,0));const cameraDistance=aiming?3.65:4.85;const shoulder=aiming?.48:.72;const desiredCamera=lookTarget.clone().add(forwardView.clone().multiplyScalar(-cameraDistance)).add(rightView.multiplyScalar(shoulder));const smooth=1-Math.exp(-(aiming?16:12)*dt);camera.position.lerp(desiredCamera,smooth);cameraLook.lerp(lookTarget,smooth);camera.lookAt(cameraLook);const wantedFov=aiming?52:68;if(Math.abs(camera.fov-wantedFov)>.1){camera.fov=THREE.MathUtils.lerp(camera.fov,wantedFov,smooth);camera.updateProjectionMatrix();}
 updateSafeZone(dt);
 if(hitMarkerTimer>0){hitMarkerTimer-=dt;if(hitMarkerTimer<=0)document.querySelector('#crosshair')?.classList.remove('hit')}updateEffects(dt);radarClock-=dt;if(radarClock<=0){radarClock=.18;updateRadar()}renderer.render(scene,camera);
}
init().catch(err=>{console.error(err);loading.style.display='none';errorPanel.style.display='grid';document.querySelector('#errorMessage').textContent='Não foi possível carregar os modelos 3D. Confira a internet e tente novamente.'});
