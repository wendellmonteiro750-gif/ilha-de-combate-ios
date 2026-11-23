import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const $=id=>document.getElementById(id);
const root=$('game');
let scene,camera,renderer,clock,hero,rig={},weapon,targets=[],yaw=0,pitch=-.12,moveX=0,moveY=0,run=false,aim=false,shoot=false,pose='stand',velocityY=0,grounded=true,walkT=0,ammo=30,reloading=false,lastShot=0,started=false;
const mat=(color,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness});
function mesh(parent,geo,material,pos){const o=new THREE.Mesh(geo,material);o.position.set(...pos);parent.add(o);o.castShadow=true;o.receiveShadow=true;return o}
function cube(parent,w,h,d,m,x,y,z){return mesh(parent,new THREE.BoxGeometry(w,h,d),m,[x,y,z])}
function capsule(parent,r,len,m,x,y,z){return mesh(parent,new THREE.CapsuleGeometry(r,len,4,8),m,[x,y,z])}
function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x91cbd5);scene.fog=new THREE.Fog(0x91cbd5,48,115);
 camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,180);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;root.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xe8f6ff,0x526b3e,2));
 const sun=new THREE.DirectionalLight(0xffe8bc,2.1);sun.position.set(-20,32,16);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
 buildIsland();buildHero();bind();addEventListener('resize',resize);clock=new THREE.Clock();animate();
}
function buildIsland(){
 const water=mesh(scene,new THREE.CircleGeometry(100,64),mat(0x268ca5,.45),[0,-.5,0]);water.rotation.x=-Math.PI/2;
 const land=mesh(scene,new THREE.CircleGeometry(43,64),mat(0x56a85c),[0,-.13,0]);land.rotation.x=-Math.PI/2;
 const beach=mesh(scene,new THREE.RingGeometry(40,43,64),mat(0xd8c58d),[0,-.1,0]);beach.rotation.x=-Math.PI/2;
 const road=cube(scene,7,.05,48,mat(0x898775),0,.005,-1);
 house(-10,-8,0xd4a65f);house(12,-13,0xc5d0bf);house(-13,15,0xd58b62);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=15+Math.random()*18;tree(Math.cos(a)*r,Math.sin(a)*r,.75+Math.random()*.6)}
 for(let i=0;i<5;i++){const g=new THREE.Group();g.position.set(-4+i*2,-.02,-25);scene.add(g);cube(g,.85,1.65,.16,mat(0xd6d1bd),0,.85,0);cube(g,.35,.35,.2,mat(0xc84735),0,1.05,.12);targets.push(g)}
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,x=Math.cos(a)*38,z=Math.sin(a)*38;const rock=mesh(scene,new THREE.DodecahedronGeometry(1.5,0),mat(0x788078),[x,.45,z]);rock.scale.y=.7}
}
function tree(x,z,s){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);mesh(g,new THREE.CylinderGeometry(.18*s,.27*s,2*s,7),mat(0x79502f),[0,s,0]);mesh(g,new THREE.SphereGeometry(1.25*s,9,8),mat(0x287b43),[0,2.45*s,0]);mesh(g,new THREE.SphereGeometry(.78*s,9,8),mat(0x3d914b),[.55*s,2.85*s,.12])}
function house(x,z,color){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);cube(g,6,3.1,5,mat(color),0,1.55,0);const roof=mesh(g,new THREE.ConeGeometry(4.5,2,4),mat(0x984d37),[0,4,0]);roof.rotation.y=Math.PI/4;cube(g,1,2,.12,mat(0x59402e),0,1,2.56);for(const sx of [-1.7,1.7])cube(g,.9,.8,.1,mat(0x77b9c7),sx,1.9,2.57)}
function buildHero(){
 hero=new THREE.Group();scene.add(hero);
 const skin=mat(0xd99b70),shirt=mat(0x27795e),pants=mat(0x263d55),boots=mat(0x242b2e),hair=mat(0x30251f),vest=mat(0x475247),gun=mat(0x252b2e),glove=mat(0x343b38);
 // Procedural articulated rig: pelvis, torso, head, upper/lower arms and legs.
 rig.body=new THREE.Group();rig.body.position.y=1.03;hero.add(rig.body);
 rig.pelvis=new THREE.Group();rig.pelvis.position.set(0,0,0);rig.body.add(rig.pelvis);
 cube(rig.pelvis,.48,.3,.34,pants,0,-.08,0);
 cube(rig.body,.76,.88,.42,shirt,0,.48,0);cube(rig.body,.79,.56,.45,vest,0,.5,-.015);
 rig.head=new THREE.Group();rig.head.position.set(0,1.08,0);rig.body.add(rig.head);
 capsule(rig.head,.13,.17,skin,0,-.02,0);
 const face=mesh(rig.head,new THREE.SphereGeometry(.27,14,12),skin,[0,.28,0]);face.scale.set(.86,1.14,.92);
 mesh(rig.head,new THREE.SphereGeometry(.278,14,9,0,Math.PI*2,0,Math.PI*.54),hair,[0,.35,0]);
 // Two-segment legs with knee pivots and feet.
 rig.legs=[];
 for(const side of [-1,1]){
  const upper=new THREE.Group();upper.position.set(side*.22,-.18,0);rig.body.add(upper);
  capsule(upper,.15,.42,pants,0,-.27,0);
  const knee=new THREE.Group();knee.position.set(0,-.52,0);upper.add(knee);capsule(knee,.115,.39,pants,0,-.23,.015);
  cube(knee,.25,.15,.38,boots,0,-.48,-.08);
  rig.legs.push({upper,knee,side});
 }
 // Arms have shoulder, elbow and wrist pivots so weapon stance can be posed.
 rig.arms=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.46,.82,0);rig.body.add(arm);
  capsule(arm,.12,.36,shirt,0,-.22,0);
  const fore=new THREE.Group();fore.position.set(0,-.45,-.015);arm.add(fore);
  capsule(fore,.105,.34,shirt,0,-.2,-.015);
  const hand=new THREE.Group();hand.position.set(0,-.4,-.04);fore.add(hand);mesh(hand,new THREE.SphereGeometry(.105,9,8),glove,[0,-.04,-.035]);
  rig.arms.push({arm,fore,hand,side});
 }
 // Rifle points along the character's forward axis (-Z).
 weapon=new THREE.Group();weapon.position.set(.2,.48,-.42);rig.body.add(weapon);
 cube(weapon,.16,.17,.85,gun,0,0,-.22);cube(weapon,.075,.075,.7,gun,0,.02,-.92);
 cube(weapon,.13,.13,.35,vest,0,0,.38);cube(weapon,.11,.3,.18,gun,0,-.2,-.24);
 cube(weapon,.08,.07,.16,gun,0,.12,-.25);
}
function bind(){
 const stick=$('stick'),knob=$('knob');let sid=null,rect=null;
 stick.addEventListener('pointerdown',e=>{e.preventDefault();sid=e.pointerId;stick.setPointerCapture(sid);rect=stick.getBoundingClientRect();stickMove(e)});
 function stickMove(e){if(sid!==e.pointerId)return;let dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),len=Math.hypot(dx,dy),max=43;if(len>max){dx*=max/len;dy*=max/len}moveX=dx/max;moveY=dy/max;knob.style.transform='translate('+dx+'px,'+dy+'px)'}
 function stickEnd(e){if(sid!==e.pointerId)return;sid=null;moveX=moveY=0;knob.style.transform='translate(0,0)'}
 stick.addEventListener('pointermove',stickMove);stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);
 const hold=(id,down,up=()=>{})=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('active');down()});['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>{b.classList.remove('active');up()}))};
 hold('run',()=>run=true,()=>run=false);hold('aim',()=>aim=true,()=>aim=false);hold('fire',()=>shoot=true,()=>shoot=false);
 $('jump').addEventListener('pointerdown',e=>{e.preventDefault();if(grounded&&pose!=='prone'){velocityY=6.2;grounded=false}});
 $('crouch').addEventListener('pointerdown',e=>{e.preventDefault();setPose(pose==='crouch'?'stand':'crouch')});
 $('prone').addEventListener('pointerdown',e=>{e.preventDefault();setPose(pose==='prone'?'stand':'prone')});
 $('reload').addEventListener('pointerdown',e=>{e.preventDefault();if(!reloading&&ammo<30){reloading=true;$('message').textContent='RECARREGANDO';setTimeout(()=>{ammo=30;reloading=false;stats()},1150)}});
 let drag=null;renderer.domElement.addEventListener('pointerdown',e=>{if(e.clientX>innerWidth*.38){drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId)}});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;yaw-=dx*.006;pitch=THREE.MathUtils.clamp(pitch+dy*.0035,-.65,.35)});
 ['pointerup','pointercancel'].forEach(ev=>renderer.domElement.addEventListener(ev,e=>{if(drag&&e.pointerId===drag.id)drag=null}));
 $('play').addEventListener('click',()=>{$('lobby').style.display='none';started=true});
}
function setPose(p){pose=p;$('poseLabel').textContent='POSTURA: '+(p==='stand'?'EM PÉ':p==='crouch'?'AGACHADO':'DEITADO');$('crouch').classList.toggle('active',p==='crouch');$('prone').classList.toggle('active',p==='prone')}
function stats(){$('ammo').textContent=ammo+' / 90'}
function fireShot(){if(reloading||ammo<=0||performance.now()-lastShot<160)return;lastShot=performance.now();ammo--;stats();weapon.rotation.x=.16;setTimeout(()=>{if(weapon)weapon.rotation.x=aim?-.04:0},65);const origin=camera.position.clone(),direction=new THREE.Vector3();camera.getWorldDirection(direction);const ray=new THREE.Raycaster(origin,direction,0,85);const hits=ray.intersectObjects(targets,true);if(hits.length){const target=hits[0].object;target.material=mat(0xe5a43a);$('message').textContent='ALVO ATINGIDO!';setTimeout(()=>{$('message').textContent='ÁREA DE TREINO';target.material=mat(0xd6d1bd)},500)}}
function update(dt){
 const moving=Math.abs(moveX)+Math.abs(moveY)>.08;
 const crouch=pose==='crouch',prone=pose==='prone';
 const speed=prone?.52:crouch?1.55:run?6.8:3.35;
 // Movement is camera-relative, while the upper body can remain oriented toward aim.
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
 const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const dir=forward.clone().multiplyScalar(-moveY).add(right.multiplyScalar(moveX));
 if(dir.length()>1)dir.normalize();
 hero.position.addScaledVector(dir,speed*dt);
 hero.position.x=THREE.MathUtils.clamp(hero.position.x,-34,34);
 hero.position.z=THREE.MathUtils.clamp(hero.position.z,-34,34);
 const facingYaw=(aim||!moving)?yaw:Math.atan2(-dir.x,-dir.z);
 const yawDelta=Math.atan2(Math.sin(facingYaw-hero.rotation.y),Math.cos(facingYaw-hero.rotation.y));
 hero.rotation.y+=yawDelta*Math.min(1,dt*(aim?14:9));
 // Jump arc and grounded recovery.
 if(!grounded){velocityY-=17*dt;hero.position.y+=velocityY*dt;if(hero.position.y<=0){hero.position.y=0;velocityY=0;grounded=true}}
 walkT+=dt*(moving?(run&&!crouch&&!prone?11:6):2);
 const gait=Math.sin(walkT),opposite=Math.sin(walkT+Math.PI);
 const strafe=THREE.MathUtils.clamp(moveX,-1,1);
 const movingBlend=moving?1:0,runBlend=run&&!crouch&&!prone&&moving?1:0;
 // Smooth transitions between standing, crouched and prone silhouettes.
 rig.body.position.y=THREE.MathUtils.lerp(rig.body.position.y,prone?.28:crouch?.72:1.03,1-Math.exp(-dt*9));
 rig.body.rotation.x=THREE.MathUtils.lerp(rig.body.rotation.x,prone?-Math.PI/2:aim?-.09:0,1-Math.exp(-dt*10));
 rig.body.rotation.z=THREE.MathUtils.lerp(rig.body.rotation.z,aim?-.035*strafe:-.10*strafe,1-Math.exp(-dt*8));
 rig.head.rotation.x=THREE.MathUtils.lerp(rig.head.rotation.x,prone?.08:aim?-.06:0,1-Math.exp(-dt*8));
 // Alternating stride, knee bend and planted-foot motion.
 rig.legs.forEach(({upper,knee,side})=>{
  const phase=side===1?gait:opposite;
  const swing=moving?phase*(.48+runBlend*.32):Math.sin(walkT*.5)*.018;
  upper.rotation.x=THREE.MathUtils.lerp(upper.rotation.x,prone?0:crouch?swing*.28:swing,1-Math.exp(-dt*12));
  knee.rotation.x=THREE.MathUtils.lerp(knee.rotation.x,prone?0:crouch?.45+Math.max(0,-phase)*.18:moving?Math.max(0,-phase)*(.55+runBlend*.55):.025,1-Math.exp(-dt*12));
 });
 // Weapon-ready arms: both hands stay close to the rifle; elbows react to aim and movement.
 rig.arms.forEach(({arm,fore,side})=>{
  const targetArmX=prone?-.18:aim?-.96:crouch?-.63:-.48;
  const targetArmZ=side===1?-.08:.12;
  arm.rotation.x=THREE.MathUtils.lerp(arm.rotation.x,targetArmX+(moving?Math.sin(walkT)*.035:0),1-Math.exp(-dt*11));
  arm.rotation.z=THREE.MathUtils.lerp(arm.rotation.z,targetArmZ+(aim?strafe*.045:0),1-Math.exp(-dt*11));
  fore.rotation.x=THREE.MathUtils.lerp(fore.rotation.x,prone?-.12:aim?-.58:-.78,1-Math.exp(-dt*11));
 });
 // Small breathing/idle motion and recoil.
 rig.body.position.y+=moving?Math.abs(gait)*.018:Math.sin(walkT*1.7)*.012;
 weapon.position.y=aim?.51:.48;
 weapon.rotation.x=THREE.MathUtils.lerp(weapon.rotation.x,aim?-.035:0,1-Math.exp(-dt*12));
 if(shoot)fireShot();
 // Shoulder camera follows the player and tightens when aiming.
 const target=hero.position.clone().add(new THREE.Vector3(0,prone?1.0:crouch?1.55:2.02,0));
 const dist=aim?3.45:5.65;
 const offset=new THREE.Vector3(Math.sin(yaw)*dist*Math.cos(pitch),dist*(.32+Math.sin(-pitch)),Math.cos(yaw)*dist*Math.cos(pitch));
 camera.position.lerp(target.clone().add(offset),1-Math.exp(-dt*8));
 camera.lookAt(target);
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(started)update(dt);renderer.render(scene,camera)}
function resize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))}
window.addEventListener('error',e=>{const box=$('error');box.hidden=false;box.textContent='Erro ao iniciar: '+e.message});
init();