import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Character, Library, catalogFromFiles } from './character.js';

const root=document.querySelector('#game'),loading=document.querySelector('#loading'),statusEl=document.querySelector('#status');
const scoreEl=document.querySelector('#score'),ammoEl=document.querySelector('#ammo'),healthEl=document.querySelector('#health');
const errorPanel=document.querySelector('#errorPanel');
let renderer,scene,camera,clock,playerRig,worldYaw=0,pitch=-.12,ammo=30,kills=0,health=100,library;
const playerVelocity=new THREE.Vector3(),cameraLook=new THREE.Vector3();
const keys={forward:0,side:0},bullets=[],enemies=[],effects=[];let dustClock=0,recoil=0;
const BASE='https://raw.githubusercontent.com/NoLimitNexus/game-models/main/';

function mat(color,roughness=.86,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function box(parent,w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function addTextureGround(){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle='#667d43';ctx.fillRect(0,0,512,512);
 for(let i=0;i<18000;i++){const x=Math.random()*512,y=Math.random()*512,v=65+Math.random()*80;ctx.fillStyle='rgba('+Math.floor(v*.72)+','+Math.floor(v)+','+Math.floor(v*.48)+','+(Math.random()*.22)+')';ctx.fillRect(x,y,1+Math.random()*3,1+Math.random()*3)}
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
function buildWorld(){
 scene.background=new THREE.Color(0x9ac9e2);scene.fog=new THREE.Fog(0xa4cbd0,260,620);
 scene.add(new THREE.HemisphereLight(0xe4f4ff,0x526044,1.9));
 const sun=new THREE.DirectionalLight(0xffe6c0,3.2);sun.position.set(-35,65,28);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-150;sun.shadow.camera.right=150;sun.shadow.camera.top=150;sun.shadow.camera.bottom=-150;sun.shadow.bias=-.0002;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.MeshStandardMaterial({map:addTextureGround(),roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const beach=new THREE.Mesh(new THREE.RingGeometry(122,140,160),mat(0xd9c18c));beach.rotation.x=-Math.PI/2;beach.position.y=.03;scene.add(beach);
 const waterMat=new THREE.MeshStandardMaterial({color:0x168aa6,roughness:.2,metalness:.12});
 const water=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-.25;scene.add(water);
 for(let i=0;i<46;i++){const a=i*2.399,r=22+(i%8)*3.3;addPalm(Math.cos(a)*r,Math.sin(a)*r,.75+(i%4)*.1)}
 for(let i=0;i<95;i++){const a=i*2.399,r=52+(i%13)*5.1;addPalm(Math.cos(a)*r,Math.sin(a)*r,.85+(i%5)*.12)}
 addHouse(-12,-12,.2);addHouse(14,-18,-.3);addHouse(22,9,.8);addHouse(-25,15,-.5);
 addHouse(68,35,.4);addHouse(-76,-42,-.7);addHouse(38,-88,.2);addHouse(-92,72,1.1);addHouse(102,5,-.4);
 for(let i=0;i<34;i++){const a=i*2.4,r=9+(i%6)*4;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.55+(i%4)*.22,1),mat(i%2?0x58644d:0x7b8069));rock.position.set(Math.cos(a)*r,.3,Math.sin(a)*r);rock.scale.y=.65;rock.castShadow=true;rock.receiveShadow=true;scene.add(rock)}
}
function addRifle(rig){
 const hand=rig.bones.get('handslotr')||rig.bones.get('handslot.r');if(!hand)return;
 const gun=new THREE.Group(),metal=mat(0x20272c,.42,.72),dark=mat(0x101519,.58),stock=mat(0x51402e);
 box(gun,.09,.11,.72,metal,0,0,-.18);box(gun,.07,.09,.36,dark,0,.015,-.66);box(gun,.1,.13,.22,stock,0,-.11,.23);
 box(gun,.045,.045,.48,metal,0,.08,-.32);box(gun,.065,.2,.1,stock,0,-.12,-.05);
 gun.position.set(.02,-.02,.12);gun.rotation.x=-.06;hand.add(gun);
}
async function createFighter(isEnemy=false,index=0){
 const shirt=['#344b42','#6b4934','#394d66','#6a3831','#4a5140','#5a4939'][index%6];
 const rig=await Character.create(library,{parts:{hair:'hair_short',top:'top_long',bottom:'bottom_trousers',boots:'boots_tall',hat:'hat_cap',back:'back_pack'},colors:{skin:isEnemy?'#c28b68':'#d5a078',hair:'#292321',shirt:isEnemy?shirt:'#263e4a',trousers:'#343b43',boots:'#292725',hat:isEnemy?'#46564b':'#344c60',pack:'#554733',linen:'#b5a27f'}});
 rig.setHeight(1.82);addRifle(rig);scene.add(rig.holder);await rig.playRole('idle');return rig;
}
function play(rig,role){if(rig&&rig.playing!==role)rig.playRole(role).catch(()=>{})}
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
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;root.appendChild(renderer.domElement);
 scene=new THREE.Scene();clock=new THREE.Clock();buildWorld();camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,900);
 loading.textContent='CARREGANDO PERSONAGEM 3D…';
 const catalog=await catalogFromFiles(BASE);catalog.animations=catalog.animations.filter(a=>a.group==='General'||a.group==='Movement Basic');library=new Library(catalog);
 playerRig=await createFighter(false,0);playerRig.holder.position.set(0,0,0);playerRig.holder.rotation.y=Math.PI;
 const spots=[[62,18],[-70,36],[18,78],[-42,-88],[98,-52]];
 await Promise.all(spots.map((p,i)=>spawnEnemy(p[0],p[1],i)));
 setupControls();addEventListener('resize',resize);loading.style.display='none';
 document.querySelector('#hint').textContent='Joystick: andar • Deslize a tela: olhar ao redor • Botões: pular e atirar';
 renderer.setAnimationLoop(animate);
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6))}
const joy=document.querySelector('#joystick'),stick=document.querySelector('#stick');let joyId=null,cameraPointerId=null,lastPointerX=0,lastPointerY=0,lookDeltaX=0,lookDeltaY=0;
function setJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),k=Math.min(1,48/(l||1));keys.side=dx*k/48;keys.forward=-dy*k/48;stick.style.transform=`translate(${keys.side*48}px,${-keys.forward*48}px)`}
function setupControls(){
 joy.addEventListener('pointerdown',e=>{e.preventDefault();joyId=e.pointerId;joy.setPointerCapture(joyId);setJoy(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)setJoy(e)});
 const endJoy=()=>{joyId=null;keys.side=keys.forward=0;stick.style.transform='translate(0,0)'};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
 renderer.domElement.addEventListener('pointerdown',e=>{if(e.target.closest('#joystick,.actions'))return;cameraPointerId=e.pointerId;lastPointerX=e.clientX;lastPointerY=e.clientY;lookDeltaX=lookDeltaY=0;renderer.domElement.setPointerCapture(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerId!==cameraPointerId)return;e.preventDefault();lookDeltaX+=e.clientX-lastPointerX;lookDeltaY+=e.clientY-lastPointerY;lastPointerX=e.clientX;lastPointerY=e.clientY});
 const endCameraDrag=e=>{if(e.pointerId===cameraPointerId)cameraPointerId=null};renderer.domElement.addEventListener('pointerup',endCameraDrag);renderer.domElement.addEventListener('pointercancel',endCameraDrag);
 document.querySelector('#jump').onclick=()=>{playerRig.jumpV=5.8};
 document.querySelector('#fire').onclick=shoot;
 document.querySelector('#reload').onclick=()=>{statusEl.textContent='RECARREGANDO';setTimeout(()=>{ammo=30;ammoEl.textContent='MUNIÇÃO 30';statusEl.textContent='PRONTO'},900)};
}
function shoot(){if(ammo<=0){statusEl.textContent='RECARREGUE';return}ammo--;ammoEl.textContent='MUNIÇÃO '+ammo;const dir=new THREE.Vector3(Math.sin(worldYaw),0,-Math.cos(worldYaw));const origin=playerRig.holder.position.clone().add(new THREE.Vector3(0,1.3,0)).add(dir.clone().multiplyScalar(.85));muzzleFlash(origin,dir);recoil=Math.min(.16,recoil+.075);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.85,6),new THREE.MeshBasicMaterial({color:0xffdf91,transparent:true,opacity:.95}));mesh.position.copy(origin).add(dir.clone().multiplyScalar(.55));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);scene.add(mesh);bullets.push({mesh,dir,life:.22})}
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
 worldYaw-=lookDeltaX*.006;pitch=THREE.MathUtils.clamp(pitch+lookDeltaY*.004,-.9,.72);lookDeltaX=lookDeltaY=0;
 const forward=new THREE.Vector3(Math.sin(worldYaw),0,-Math.cos(worldYaw)),right=new THREE.Vector3(Math.cos(worldYaw),0,Math.sin(worldYaw));
 const move=forward.multiplyScalar(keys.forward).add(right.multiplyScalar(keys.side));if(move.lengthSq()>1)move.normalize();
 const targetVelocity=move.clone().multiplyScalar(5.8);playerVelocity.lerp(targetVelocity,1-Math.exp(-9*dt));p.position.addScaledVector(playerVelocity,dt);p.position.x=THREE.MathUtils.clamp(p.position.x,-124,124);p.position.z=THREE.MathUtils.clamp(p.position.z,-124,124);
 if(playerVelocity.length()>.22){dustClock-=dt;if(dustClock<=0){dustClock=playerVelocity.length()>4.2?.12:.24;const foot=p.position.clone().add(new THREE.Vector3((Math.random()-.5)*.55,.12,(Math.random()-.5)*.55));for(let n=0;n<3;n++)addParticle(foot,0xc6b58a,1.1,.055,.3)}const desiredYaw=Math.atan2(playerVelocity.x,playerVelocity.z);const turn=THREE.MathUtils.euclideanModulo(desiredYaw-p.rotation.y+Math.PI,Math.PI*2)-Math.PI;p.rotation.y+=turn*Math.min(1,10*dt);play(playerRig,playerVelocity.length()>4.2?'run':'walk')}else play(playerRig,'idle');
 playerRig.jumpV=(playerRig.jumpV||0)-15*dt;p.position.y=Math.max(0,p.position.y+(playerRig.jumpV||0)*dt);if(p.position.y===0&&playerRig.jumpV<0)playerRig.jumpV=0;
 playerRig.update(dt);
 for(const e of enemies){if(!e.alive)continue;const ep=e.rig.holder,delta=p.position.clone().sub(ep.position);const dist=delta.length();if(dist>2.3){delta.normalize();ep.position.addScaledVector(delta,1.35*dt);ep.rotation.y=Math.atan2(delta.x,delta.z);if(e.anim!=='run'){e.anim='run';play(e.rig,'run')}}else{if(e.anim!=='idle'){e.anim='idle';play(e.rig,'idle')}e.attack+=dt;if(e.attack>1.5){e.attack=0;health=Math.max(0,health-4);healthEl.textContent='VIDA '+health;statusEl.textContent='SOB ATAQUE';setTimeout(()=>{if(health>0)statusEl.textContent='PRONTO'},450)}}e.rig.update(dt)}
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.mesh.position.addScaledVector(b.dir,72*dt);b.life-=dt;let hit=false;for(const e of enemies){if(e.alive&&b.mesh.position.distanceTo(e.rig.holder.position.clone().add(new THREE.Vector3(0,.9,0)))<1.05){e.hp-=35;burst(b.mesh.position,12,0xffa34d,4.8);hit=true;if(e.hp<=0){e.alive=false;burst(e.rig.holder.position.clone().add(new THREE.Vector3(0,1,0)),22,0xffd06b,5);scene.remove(e.rig.holder);e.rig.dispose();kills++;scoreEl.textContent='ELIMINAÇÕES '+kills}break}}if(hit||b.life<=0){scene.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();bullets.splice(i,1)}}
 const target=p.position.clone().add(new THREE.Vector3(0,1.35,0));const back=new THREE.Vector3(-Math.sin(worldYaw),0,Math.cos(worldYaw));const desired=target.clone().add(back.multiplyScalar(5.4)).add(new THREE.Vector3(0,2.15+pitch*3,0));const smooth=1-Math.exp(-7.5*dt);camera.position.lerp(desired,smooth);cameraLook.lerp(target.clone().add(new THREE.Vector3(0,pitch*2,0)),smooth);camera.lookAt(cameraLook);const wantedFov=playerVelocity.length()>4.2?71:68;if(Math.abs(camera.fov-wantedFov)>.1){camera.fov=THREE.MathUtils.lerp(camera.fov,wantedFov,smooth);camera.updateProjectionMatrix();}
 updateEffects(dt);radarClock-=dt;if(radarClock<=0){radarClock=.18;updateRadar()}renderer.render(scene,camera);
}
init().catch(err=>{console.error(err);loading.style.display='none';errorPanel.style.display='grid';document.querySelector('#errorMessage').textContent='Não foi possível carregar os modelos 3D. Confira a internet e tente novamente.'});
