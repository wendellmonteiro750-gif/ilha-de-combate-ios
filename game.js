import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const root=document.querySelector('#game');
const loading=document.querySelector('#loading');
const statusEl=document.querySelector('#status');
const scoreEl=document.querySelector('#score');
const ammoEl=document.querySelector('#ammo');
const errorPanel=document.querySelector('#errorPanel');
let renderer,scene,camera,clock,player,playerRig,worldYaw=0,pitch=-0.12,ammo=30,kills=0,health=100;
const keys={forward:0,side:0},bullets=[],enemies=[];
const mats={};
function material(color,roughness=.8,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function box(parent,w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function sphere(parent,r,mat,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(new THREE.SphereGeometry(r,20,16),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m}
function limb(parent,a,b,r1,r2,mat){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,dir.length(),12),mat);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());mesh.castShadow=true;parent.add(mesh);return mesh}
function makeFighter(isEnemy=false){
 const g=new THREE.Group();
 const skin=material(isEnemy?0x9b694e:0xc18b68),cloth=material(isEnemy?0x4b514c:0x26343a),dark=material(0x151c20),vest=material(isEnemy?0x786044:0x46545a),red=material(isEnemy?0x8f3227:0x9b3428),boot=material(0x17191a),eye=material(0xd8dedb,.35);
 // torso and tactical vest
 sphere(g,.29,cloth,0,1.28,0,.85,1.15,.52);
 box(g,.42,.52,.24,vest,0,1.3,.12);
 for(let i=0;i<3;i++)box(g,.1,.12,.035,dark,-.13+i*.13,1.36,.255);
 // neck/head/helmet
 limb(g,[0,1.48,0],[0,1.61,0],.09,.08,skin);
 sphere(g,.16,skin,0,1.76,0,.9,1.12,.88);
 sphere(g,.17,dark,0,1.87,-.015,1.02,.48,1);
 box(g,.23,.055,.025,eye,0,1.77,.143);
 box(g,.2,.09,.025,dark,0,1.68,.145);
 // shoulder pads
 sphere(g,.14,vest,-.29,1.48,0,1,.8,1);sphere(g,.14,vest,.29,1.48,0,1,.8,1);
 box(g,.12,.1,.12,red,-.31,1.48,.08);box(g,.12,.1,.12,red,.31,1.48,.08);
 // arms, forearms and gloves
 for(const s of [-1,1]){limb(g,[s*.29,1.45,0],[s*.39,1.12,.08],.105,.075,cloth);limb(g,[s*.39,1.12,.08],[s*.35,.88,.2],.075,.055,vest);sphere(g,.065,dark,s*.35,.84,.21); }
 // legs with separate segments
 const legs=[];
 for(const s of [-1,1]){const upper=limb(g,[s*.13,1.02,0],[s*.15,.58,.015],.13,.095,cloth);const lower=limb(g,[s*.15,.56,.015],[s*.16,.16,.04],.09,.065,vest);sphere(g,.1,dark,s*.15,.55,.015);box(g,.17,.13,.3,boot,s*.16,.1,.12);legs.push({upper,lower,side:s})}
 // rifle silhouette in hands
 const gun=new THREE.Group();box(gun,.07,.09,.66,dark,0,0,0);box(gun,.045,.16,.2,vest,0,-.09,.06);box(gun,.035,.04,.28,material(0x090d10),0,.04,-.42);gun.position.set(.31,1.08,.28);gun.rotation.x=-.12;g.add(gun);
 g.userData={legs,gun};return g;
}
function addTree(x,z,s=1){
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16*s,.25*s,3.7*s,10),material(0x79543a));trunk.position.set(x,1.85*s,z);trunk.castShadow=true;scene.add(trunk);
 for(let i=0;i<7;i++){const angle=i*Math.PI*2/7;const leaf=new THREE.Mesh(new THREE.ConeGeometry(.42*s,3.2*s,8),material(i%2?0x28633b:0x347c45));leaf.position.set(x+Math.cos(angle)*.85*s,3.55*s,z+Math.sin(angle)*.85*s);leaf.rotation.z=-Math.cos(angle)*.9;leaf.rotation.x=Math.sin(angle)*.9;leaf.castShadow=true;scene.add(leaf)}
}
function addHouse(x,z){
 const wall=material(0xd4c2a0),roof=material(0x873d2d),g=new THREE.Group();
 box(g,5,2.8,4,wall,0,1.4,0);const r=new THREE.Mesh(new THREE.ConeGeometry(3.7,1.7,4),roof);r.position.y=3.55;r.rotation.y=Math.PI/4;r.castShadow=true;g.add(r);
 box(g,.9,1.8,.12,material(0x604532),0,.9,2.06);
 for(const sx of [-1,1])box(g,.8,.7,.1,material(0x6e9ca1),sx*1.55,1.8,2.06);
 g.position.set(x,0,z);scene.add(g);
}
function buildWorld(){
 scene.background=new THREE.Color(0x8dc8dc);scene.fog=new THREE.Fog(0x9ccbd1,65,190);
 const hemi=new THREE.HemisphereLight(0xd9efff,0x536447,2.1);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffe4b5,3.1);sun.position.set(-35,55,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-75;sun.shadow.camera.right=75;sun.shadow.camera.top=75;sun.shadow.camera.bottom=-75;sun.shadow.bias=-.00025;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(260,260),material(0x66864b));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const beach=new THREE.Mesh(new THREE.RingGeometry(40,46,96),material(0xd9c18d));beach.rotation.x=-Math.PI/2;beach.position.y=.025;scene.add(beach);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshStandardMaterial({color:0x248da5,roughness:.24,metalness:.12}));water.rotation.x=-Math.PI/2;water.position.y=-.22;scene.add(water);
 // irregular tropical vegetation and buildings
 for(let i=0;i<38;i++){const a=i*2.399,r=19+(i%7)*5;addTree(Math.cos(a)*r,Math.sin(a)*r,.72+(i%4)*.12)}
 addHouse(-12,-12);addHouse(14,-18);addHouse(22,9);
 for(let i=0;i<22;i++){const a=i*2.4,r=10+(i%5)*3;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.7+(i%3)*.3,1),material(i%2?0x526348:0x71805a));rock.position.set(Math.cos(a)*r,.35,Math.sin(a)*r);rock.scale.y=.7;rock.castShadow=true;scene.add(rock)}
}
function spawnEnemy(x,z){const group=makeFighter(true);group.position.set(x,0,z);scene.add(group);enemies.push({group,hp:100,alive:true,phase:Math.random()*5})}
function init(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;root.appendChild(renderer.domElement);
 scene=new THREE.Scene();clock=new THREE.Clock();buildWorld();
 camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,500);
 player=makeFighter(false);scene.add(player);player.position.set(0,0,0);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,r=19+(i%3)*5;spawnEnemy(Math.cos(a)*r,Math.sin(a)*r)}
 setupControls();addEventListener('resize',resize);loading.style.display='none';document.querySelector('#hint').textContent='Arraste o joystick para andar. Arraste a tela para mirar. Use ATIRAR e PULAR.';renderer.setAnimationLoop(animate);
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7))}
const joy=document.querySelector('#joystick'),stick=document.querySelector('#stick');let joyId=null,lookId=null,lastX=0,lastY=0;
function setJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),k=Math.min(1,48/(l||1));keys.side=dx*k/48;keys.forward=-dy*k/48;stick.style.transform=`translate(${keys.side*48}px,${-keys.forward*48}px)`}
function setupControls(){
 joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(joyId);setJoy(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)setJoy(e)});
 const end=()=>{joyId=null;keys.side=keys.forward=0;stick.style.transform='translate(0,0)'};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end);
 const look=document.querySelector('#lookArea');look.style.display='block';
 look.addEventListener('pointerdown',e=>{lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;look.setPointerCapture(lookId)});
 look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;worldYaw-=(e.clientX-lastX)*.006;pitch=Math.max(-.55,Math.min(.25,pitch+(e.clientY-lastY)*.003));lastX=e.clientX;lastY=e.clientY});
 look.addEventListener('pointerup',()=>lookId=null);look.addEventListener('pointercancel',()=>lookId=null);
 document.querySelector('#jump').onclick=()=>{player.userData.jumpV=5.8};
 document.querySelector('#fire').onclick=shoot;
 document.querySelector('#reload').onclick=()=>{statusEl.textContent='RECARREGANDO';setTimeout(()=>{ammo=30;ammoEl.textContent='MUNIÇÃO 30';statusEl.textContent='PRONTO'},900)};
}
function shoot(){if(ammo<=0){statusEl.textContent='RECARREGUE';return}ammo--;ammoEl.textContent='MUNIÇÃO '+ammo;const dir=new THREE.Vector3(Math.sin(worldYaw),0,-Math.cos(worldYaw));const origin=player.position.clone().add(new THREE.Vector3(0,1.25,0)).add(dir.clone().multiplyScalar(.8));const mesh=new THREE.Mesh(new THREE.SphereGeometry(.075,8,8),new THREE.MeshBasicMaterial({color:0xffd47b}));mesh.position.copy(origin);scene.add(mesh);bullets.push({mesh,dir,life:1.4})}
function animate(){
 const dt=Math.min(clock.getDelta(),.04);const forward=new THREE.Vector3(Math.sin(worldYaw),0,-Math.cos(worldYaw)),right=new THREE.Vector3(Math.cos(worldYaw),0,Math.sin(worldYaw));
 const move=forward.multiplyScalar(keys.forward).add(right.multiplyScalar(keys.side));if(move.lengthSq()>1)move.normalize();player.position.addScaledVector(move,5.3*dt);player.position.x=THREE.MathUtils.clamp(player.position.x,-43,43);player.position.z=THREE.MathUtils.clamp(player.position.z,-43,43);
 player.rotation.y=worldYaw;player.userData.jumpV=(player.userData.jumpV||0)-15*dt;player.position.y=Math.max(0,player.position.y+(player.userData.jumpV||0)*dt);if(player.position.y===0&&player.userData.jumpV<0)player.userData.jumpV=0;
 const walking=move.length()>.1;player.userData.legs.forEach((l,i)=>{const swing=walking?Math.sin(clock.elapsedTime*9+i*Math.PI)*.42:0;l.upper.rotation.x=swing;l.lower.rotation.x=Math.max(0,-swing)*.8});
 for(const e of enemies){if(!e.alive)continue;e.phase+=dt;const delta=player.position.clone().sub(e.group.position);const dist=delta.length();if(dist>2.1){delta.normalize();e.group.position.addScaledVector(delta,1.05*dt);e.group.rotation.y=Math.atan2(delta.x,-delta.z)}}
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.mesh.position.addScaledVector(b.dir,32*dt);b.life-=dt;let hit=false;for(const e of enemies){if(e.alive&&b.mesh.position.distanceTo(e.group.position.clone().add(new THREE.Vector3(0,1,0)))<1.05){e.hp-=35;hit=true;if(e.hp<=0){e.alive=false;scene.remove(e.group);kills++;scoreEl.textContent='ELIMINAÇÕES '+kills}break}}if(hit||b.life<=0){scene.remove(b.mesh);bullets.splice(i,1)}}
 const target=player.position.clone().add(new THREE.Vector3(0,1.15,0));const camDir=new THREE.Vector3(Math.sin(worldYaw+Math.PI),0,Math.cos(worldYaw+Math.PI));const desired=target.clone().add(camDir.multiplyScalar(6.5)).add(new THREE.Vector3(0,2.5+pitch*3,0));camera.position.lerp(desired,.13);camera.lookAt(target.clone().add(new THREE.Vector3(0,pitch*2,0)));
 renderer.render(scene,camera);
}
init();
