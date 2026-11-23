import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id);
const root=$('game');
let scene,camera,renderer,clock,hero,rig={},weapon,targets=[],realHero=null,realMixer=null,realActions={},activeRealAction='',yaw=0,pitch=-.12,moveX=0,moveY=0,run=false,aim=false,shoot=false,pose='stand',proneBlend=0,velocityY=0,grounded=true,walkT=0,ammo=30,reloading=false,lastShot=0,started=false;
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
 buildIsland();buildHero();loadRealHero();bind();addEventListener('resize',resize);clock=new THREE.Clock();animate();
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
 // Tórax com volume anatômico, ombros e equipamento tático.
 capsule(rig.body,.265,.49,shirt,0,.49,0).scale.set(1.42,1.18,.82);
 cube(rig.body,.79,.48,.43,vest,0,.50,-.025);
 for(const side of [-1,1]){
  const shoulder=mesh(rig.body,new THREE.SphereGeometry(.17,12,10),vest,[side*.43,.77,0]);
  shoulder.scale.set(1,.88,.95);
  cube(rig.body,.16,.25,.12,mat(0x34443d),side*.22,.48,-.245);
  cube(rig.body,.19,.14,.12,mat(0x59634e),side*.30,.26,-.255);
 }
 cube(rig.body,.69,.09,.44,mat(0x343b35),0,.13,-.015);
 for(const side of [-1,1])cube(rig.body,.19,.18,.12,mat(0x59634e),side*.24,.20,-.255);
 rig.head=new THREE.Group();rig.head.position.set(0,1.08,0);rig.body.add(rig.head);
 capsule(rig.head,.13,.17,skin,0,-.02,0);
 // Pescoço, orelhas e traços faciais voltados para a direção do cano (-Z).
 capsule(rig.body,.105,.16,skin,0,.94,0);
 // Cabeça com formato oval e maxilar mais definido.
 const face=mesh(rig.head,new THREE.SphereGeometry(.27,24,20),skin,[0,.28,0]);
 face.scale.set(.86,1.14,.92);
 const jaw=mesh(rig.head,new THREE.SphereGeometry(.205,18,14),skin,[0,.105,-.018]);
 jaw.scale.set(1,.67,.91);
 // Orelhas e detalhes do rosto posicionados à frente da superfície facial.
 for(const side of [-1,1]){
  const ear=mesh(rig.head,new THREE.SphereGeometry(.058,12,10),skin,[side*.238,.015,-.005]);
  ear.scale.set(.68,1,.62);
  mesh(rig.head,new THREE.SphereGeometry(.027,10,8),mat(0x9d6654),[side*.248,.015,-.035]);
  const eyeWhite=mesh(rig.head,new THREE.SphereGeometry(.034,12,10),mat(0xf0e5d7),[side*.092,.292,-.239]);
  eyeWhite.scale.set(1,.68,.42);
  mesh(rig.head,new THREE.SphereGeometry(.018,10,8),mat(0x49352b),[side*.092,.292,-.255]);
  mesh(rig.head,new THREE.SphereGeometry(.009,8,6),mat(0x171717),[side*.092,.292,-.263]);
  const brow=mesh(rig.head,new THREE.SphereGeometry(.052,12,8),hair,[side*.095,.345,-.231]);
  brow.scale.set(1,.22,.35);
 }
 // Nariz, narinas, boca e queixo dão leitura de rosto humano de frente.
 const nose=mesh(rig.head,new THREE.SphereGeometry(.045,14,12),skin,[0,.222,-.267]);
 nose.scale.set(.72,.88,1.0);
 for(const side of [-1,1]){
  mesh(rig.head,new THREE.SphereGeometry(.009,8,6),mat(0x70483c),[side*.018,.198,-.282]);
 }
 const mouth=mesh(rig.head,new THREE.SphereGeometry(.031,12,8),mat(0x754638),[0,.135,-.245]);
 mouth.scale.set(1,.28,.38);
 const lowerLip=mesh(rig.head,new THREE.SphereGeometry(.025,10,8),mat(0x986052),[0,.124,-.244]);
 lowerLip.scale.set(1,.22,.3);
 const hairCap=mesh(rig.head,new THREE.SphereGeometry(.278,20,14,0,Math.PI*2,0,Math.PI*.54),hair,[0,.35,0]);
 hairCap.scale.set(1.02,1,.99);
 // Camiseta com peito, abdômen e cintura menos blocados sob o colete.
 const chest=mesh(rig.body,new THREE.SphereGeometry(1,18,14),shirt,[0,.61,-.005]);
 chest.scale.set(.37,.30,.205);
 const abdomen=mesh(rig.body,new THREE.SphereGeometry(1,16,12),shirt,[0,.29,.005]);
 abdomen.scale.set(.265,.245,.19);
 const waist=mesh(rig.body,new THREE.SphereGeometry(1,16,12),pants,[0,.02,.005]);
 waist.scale.set(.285,.19,.205);
 // Alças acolchoadas e bolsos com volume no colete.
 for(const side of [-1,1]){
  const strap=mesh(rig.body,new THREE.BoxGeometry(.105,.52,.075),mat(0x343e36),[side*.245,.56,-.245]);
  strap.rotation.z=side*-.16;
  cube(rig.body,.19,.16,.075,vest,side*.25,.43,-.275);
 }
 // Two-segment legs with knee pivots and feet.
 rig.legs=[];
 for(const side of [-1,1]){
  const upper=new THREE.Group();upper.position.set(side*.22,-.18,0);rig.body.add(upper);
  capsule(upper,.155,.43,pants,0,-.27,0);
  mesh(upper,new THREE.SphereGeometry(.125,10,8),mat(0x394b5a),[0,-.49,-.005]);
  const knee=new THREE.Group();knee.position.set(0,-.52,0);upper.add(knee);capsule(knee,.115,.39,pants,0,-.23,.015);
  mesh(knee,new THREE.SphereGeometry(.125,10,8),mat(0x59634e),[0,-.34,-.105]);
  cube(knee,.27,.16,.39,boots,0,-.48,-.08);
  cube(knee,.25,.10,.18,mat(0x343a38),0,-.49,-.245);
  rig.legs.push({upper,knee,side});
 }
 // Articulated upper arms and forearms are separate joints; hands are posed onto the rifle grips.
 rig.arms=[];
 for(const side of [-1,1]){
  const upper=new THREE.Group();rig.body.add(upper);
  capsule(upper,.12,.29,shirt,0,-.265,0);
  const fore=new THREE.Group();rig.body.add(fore);
  capsule(fore,.105,.27,shirt,0,-.24,0);
  mesh(fore,new THREE.SphereGeometry(.112,10,8),vest,[0,-.43,-.005]);
  const hand=new THREE.Group();fore.add(hand);
  mesh(hand,new THREE.SphereGeometry(.105,10,9),glove,[0,-.045,-.035]);
  for(let finger=0;finger<3;finger++){
   capsule(hand,.022,.055,glove,-.045+finger*.045,-.105,-.075);
  }
  rig.arms.push({upper,fore,hand,side});
 }
 // Rifle points along the character's forward axis (-Z).
 weapon=new THREE.Group();weapon.position.set(.28,.50,-.28);rig.body.add(weapon);
 cube(weapon,.16,.17,.85,gun,0,0,-.22);cube(weapon,.075,.075,.7,gun,0,.02,-.92);
 cube(weapon,.13,.13,.35,vest,0,0,.38);cube(weapon,.11,.3,.18,gun,0,-.2,-.24);
 cube(weapon,.08,.07,.16,gun,0,.12,-.25);
 // Mira superior e carregador mais legíveis na silhueta.
 cube(weapon,.055,.07,.12,mat(0x111719),0,.12,-.60);
 cube(weapon,.12,.25,.13,gun,0,-.22,-.48);
}
function loadRealHero(){
 const loader=new GLTFLoader();
 const url='https://threejs.org/examples/models/gltf/Soldier.glb';
 loader.load(url,gltf=>{
  const model=gltf.scene;
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  const height=bounds.max.y-bounds.min.y;
  if(height>0)model.scale.setScalar(1.78/height);
  model.position.set(0,-bounds.min.y*model.scale.y,0);
  model.rotation.y=Math.PI;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.side=THREE.FrontSide}}});
  hero.add(model);
  realHero=model;
  // Transfere o rifle para o personagem real antes de esconder o rig procedural.
  // Mantém a posição que ele tinha no tronco e deixa a arma visível no modelo GLB.
  weapon.position.y += rig.body.position.y;
  hero.add(weapon);
  weapon.rotation.y = Math.PI;
  rig.body.visible=false;
  if(gltf.animations&&gltf.animations.length){
   realMixer=new THREE.AnimationMixer(model);
   for(const clip of gltf.animations){realActions[clip.name.toLowerCase()]=realMixer.clipAction(clip)}
   const first=Object.keys(realActions)[0];
   if(first){realActions[first].play();activeRealAction=first}
  }
  $('message').textContent='PERSONAGEM HUMANOIDE 3D CARREGADO';
 },undefined,error=>{
  console.error('Falha ao carregar personagem GLB:',error);
  $('message').textContent='Falha ao carregar o modelo humanoide 3D';
 });
}
function playRealAnimation(name){
 if(!realMixer)return;
 const key=Object.keys(realActions).find(k=>k.includes(name));
 if(!key||key===activeRealAction)return;
 const next=realActions[key];if(!next)return;
 next.reset().fadeIn(.2).play();
 if(realActions[activeRealAction])realActions[activeRealAction].fadeOut(.2);
 activeRealAction=key;
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
 if(realMixer){realMixer.update(dt);playRealAnimation(moving?(run?'run':'walk'):'idle')}
 const crouch=pose==='crouch',prone=pose==='prone';
 proneBlend=THREE.MathUtils.damp(proneBlend,prone?1:0,7.5,dt);
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
 // Deitar em sequência: abaixa o centro de gravidade, leva o peito ao chão
 // e estende o corpo gradualmente, em vez de apenas girar a câmera.
 const proneHeight=THREE.MathUtils.lerp(1.03,.34,proneBlend);
 const lowHeight=THREE.MathUtils.lerp(crouch?.72:1.03,proneHeight,proneBlend);
 rig.body.position.y=THREE.MathUtils.lerp(rig.body.position.y,lowHeight,1-Math.exp(-dt*11));
 const pronePitch=-1.12*proneBlend;
 rig.body.rotation.x=THREE.MathUtils.lerp(rig.body.rotation.x,pronePitch+(1-proneBlend)*(aim?-.09:0),1-Math.exp(-dt*9));
 rig.body.rotation.z=THREE.MathUtils.lerp(rig.body.rotation.z,aim?-.035*strafe:-.10*strafe,1-Math.exp(-dt*8));
 rig.head.rotation.x=THREE.MathUtils.lerp(rig.head.rotation.x,prone?.08:aim?-.10: moving?-.025:Math.sin(walkT*1.7)*.012,1-Math.exp(-dt*8));
 rig.head.rotation.y=THREE.MathUtils.lerp(rig.head.rotation.y,aim?0:strafe*.035,1-Math.exp(-dt*7));
 // Alternating stride, knee bend and planted-foot motion.
 rig.legs.forEach(({upper,knee,side})=>{
  const phase=side===1?gait:opposite;
  const crawl= moving ? Math.sin(walkT*1.35+(side===1?0:Math.PI)) : Math.sin(walkT*.65+(side===1?0:Math.PI))*.08;
  const swing=moving?phase*(.48+runBlend*.32):Math.sin(walkT*.5)*.018;
  const proneLeg=side===1?-.12+crawl*.30:-.12-crawl*.30;
  const proneKnee=.42+Math.max(0,crawl)*.22;
  upper.rotation.x=THREE.MathUtils.lerp(upper.rotation.x,THREE.MathUtils.lerp(crouch?swing*.28:swing,proneLeg,proneBlend),1-Math.exp(-dt*12));
  knee.rotation.x=THREE.MathUtils.lerp(knee.rotation.x,THREE.MathUtils.lerp(crouch?.45+Math.max(0,-phase)*.18:moving?Math.max(0,-phase)*(.55+runBlend*.55):.025,proneKnee,proneBlend),1-Math.exp(-dt*12));
 });
 // Two-bone procedural IK: each palm is placed at a real grip point on the rifle.
 const downAxis=new THREE.Vector3(0,-1,0);
 rig.arms.forEach(({upper,fore,hand,side})=>{
  const shoulder=new THREE.Vector3(side*THREE.MathUtils.lerp(.46,.42,proneBlend),THREE.MathUtils.lerp(.82,.69,proneBlend),THREE.MathUtils.lerp(0,.02,proneBlend));
  const grip=weapon.position.clone().add(side===1
   ? new THREE.Vector3(0,-.20,-.18)       // right hand on the trigger grip
   : new THREE.Vector3(0,-.02,-.40));     // left hand supporting the fore-end
  grip.y+=crouch?-.035:0;
  // Cotovelos mais baixos e abertos no apoio deitado, mantendo as mãos nos punhos.
  grip.y+=proneBlend*.035;
  if(moving){grip.y+=Math.sin(walkT+(side===1?0:Math.PI))*.018}
  const reach=grip.clone().sub(shoulder);
  const distance=THREE.MathUtils.clamp(reach.length(),.08,.995);
  const direction=reach.normalize();
  const upperLength=.53,foreLength=.48;
  const along=(upperLength*upperLength-foreLength*foreLength+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(.001,upperLength*upperLength-along*along));
  let bend=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,0,1));
  if(bend.lengthSq()<.001)bend.set(1,0,0);
  bend.normalize().multiplyScalar(side===1?1:-1);
  bend.lerp(new THREE.Vector3(side*.85,-.10,.48),proneBlend).normalize();
  const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,height);
  const upperDir=elbow.clone().sub(shoulder).normalize();
  const foreDir=grip.clone().sub(elbow).normalize();
  upper.position.copy(shoulder);
  upper.quaternion.setFromUnitVectors(downAxis,upperDir);
  fore.position.copy(elbow);
  fore.quaternion.setFromUnitVectors(downAxis,foreDir);
  hand.position.set(0,-foreLength,0);
  hand.rotation.set(aim?-.13:moving?Math.sin(walkT+(side===1?0:Math.PI))*.025:0,side===1?-.025:.10,side===1?-.10:.06);
 });
 // Small breathing/idle motion and recoil.
 rig.body.position.y+=moving?Math.abs(gait)*.018:Math.sin(walkT*1.7)*.012;
 weapon.position.y=aim?1.58:moving?1.54:1.53;
 // Compensa a inclinação do tronco para o cano continuar apontado à frente,
 // paralelo ao chão durante a posição deitada.
 weapon.rotation.x=THREE.MathUtils.lerp(weapon.rotation.x,proneBlend*1.12+(1-proneBlend)*(aim?-.035:0),1-Math.exp(-dt*10));
 // Inclina le spalle e accompagna il fucile durante la mira e il movimento.
 rig.pelvis.rotation.y=THREE.MathUtils.lerp(rig.pelvis.rotation.y,aim?-.025*strafe:0,1-Math.exp(-dt*7));
 weapon.rotation.x=THREE.MathUtils.lerp(weapon.rotation.x,aim?-.035:proneBlend*.08,1-Math.exp(-dt*12));
 if(shoot)fireShot();
 // Shoulder camera follows the player and tightens when aiming.
 const target=hero.position.clone().add(new THREE.Vector3(0,THREE.MathUtils.lerp(crouch?1.55:2.02,.62,proneBlend),0));
 const dist=THREE.MathUtils.lerp(aim?3.45:5.65,4.15,proneBlend);
 const offset=new THREE.Vector3(Math.sin(yaw)*dist*Math.cos(pitch),dist*(.32+Math.sin(-pitch)),Math.cos(yaw)*dist*Math.cos(pitch));
 camera.position.lerp(target.clone().add(offset),1-Math.exp(-dt*8));
 camera.lookAt(target);
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(started)update(dt);renderer.render(scene,camera)}
function resize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))}
window.addEventListener('error',e=>{const box=$('error');box.hidden=false;box.textContent='Erro ao iniciar: '+e.message});
init();