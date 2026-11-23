import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id);
const root=$('game');
let scene,camera,renderer,clock,hero,targets=[],yaw=0,pitch=-.12,moveX=0,moveY=0,velocityX=0,velocityZ=0,run=false,aim=false,shoot=false,pose='stand',velocityY=0,grounded=true,ammo=30,reloading=false,lastShot=0,started=false,cameraRecoil=0,cameraShake=0,stamina=100,worldBlockers=[],cameraRay=new THREE.Raycaster(),cameraDesired=new THREE.Vector3(),cameraCurrentDistance=5.6;
const mat=(color,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness});
function mesh(parent,geo,material,pos){const o=new THREE.Mesh(geo,material);o.position.set(...pos);parent.add(o);o.castShadow=true;o.receiveShadow=true;return o}
function cube(parent,w,h,d,m,x,y,z){return mesh(parent,new THREE.BoxGeometry(w,h,d),m,[x,y,z])}
function capsule(parent,r,len,m,x,y,z){return mesh(parent,new THREE.CapsuleGeometry(r,len,4,8),m,[x,y,z])}
function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x8fc8e2);scene.fog=new THREE.Fog(0x8fc8e2,58,145);
 camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,180);
 const mobileProfile=matchMedia('(max-width: 800px)').matches||navigator.maxTouchPoints>0;renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,mobileProfile?1.5:2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.physicallyCorrectLights=true;root.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xeaf5ff,0x46513a,1.85));
 const fill=new THREE.DirectionalLight(0xb9d9ff,.72);fill.position.set(18,14,-24);scene.add(fill);
 const sun=new THREE.DirectionalLight(0xffe5c2,3.0);sun.position.set(-20,32,16);sun.castShadow=true;sun.shadow.mapSize.set(mobileProfile?1536:3072,mobileProfile?1536:3072);sun.shadow.camera.near=1;sun.shadow.camera.far=90;sun.shadow.radius=mobileProfile?2:3;sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.bias=-0.00018;scene.add(sun);
 buildIsland();createPlayerAnchor();bind();addEventListener('resize',resize);clock=new THREE.Clock();animate();
}
function buildIsland(){
 const waterMat=new THREE.MeshStandardMaterial({color:0x237e9a,roughness:.24,metalness:.12});
 const water=mesh(scene,new THREE.CircleGeometry(100,96),waterMat,[0,-.62,0]);water.rotation.x=-Math.PI/2;
 const landGeo=new THREE.CircleGeometry(43,112);
 const pos=landGeo.attributes.position,colors=[];
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getY(i),r=Math.hypot(x,z);
  const wave=(Math.sin(x*.34)*Math.cos(z*.29)+Math.sin((x+z)*.19))*.11;
  pos.setZ(i,wave+Math.max(0,1-r/43)*.08);
  const patch=(Math.sin(x*1.7+z*.8)*Math.cos(z*1.35-x*.55)+1)*.5;
  const edge=THREE.MathUtils.smoothstep(r,37.5,42.8);
  const color=new THREE.Color().setRGB(.16+.07*patch,.34+.13*patch,.12+.045*patch).lerp(new THREE.Color(0x9a9560),edge*.32);
  colors.push(color.r,color.g,color.b);
 }
 landGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));landGeo.computeVertexNormals();
 const landMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
 const land=new THREE.Mesh(landGeo,landMat);land.rotation.x=-Math.PI/2;land.position.y=-.13;land.receiveShadow=true;scene.add(land);
 const beach=mesh(scene,new THREE.RingGeometry(40,43,112),mat(0xd4bd83,1),[0,-.085,0]);beach.rotation.x=-Math.PI/2;
 const roadMat=new THREE.MeshStandardMaterial({color:0x666b62,roughness:1});
 const road=cube(scene,7,.07,48,roadMat,0,.015,-1);
 const roadEdge=mat(0xb5a77f,1);
 for(const side of [-1,1])cube(scene,.13,.035,48,roadEdge,side*3.62,.06,-1);
 house(-10,-8,0xc99b63);house(12,-13,0xb7c2b0);house(-13,15,0xc9825d);
 addGrass();
 buildForest();
 for(let i=0;i<5;i++){const g=new THREE.Group();g.position.set(-4+i*2,-.02,-25);scene.add(g);cube(g,.85,1.65,.16,mat(0xd6d1bd),0,.85,0);cube(g,.35,.35,.2,mat(0xc84735),0,1.05,.12);targets.push(g)}
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,x=Math.cos(a)*38,z=Math.sin(a)*38;const rock=mesh(scene,new THREE.DodecahedronGeometry(1.5,0),mat(0x788078),[x,.45,z]);rock.scale.y=.7}
}
function tree(x,z,s){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);mesh(g,new THREE.CylinderGeometry(.18*s,.27*s,2*s,9),mat(0x65452d,1),[0,s,0]);const green=mat(0x245b35,1),light=mat(0x367b43,1);mesh(g,new THREE.SphereGeometry(1.18*s,12,10),green,[0,2.35*s,0]);mesh(g,new THREE.SphereGeometry(.86*s,12,10),light,[.48*s,2.72*s,.08]);mesh(g,new THREE.SphereGeometry(.72*s,12,10),green,[-.48*s,2.68*s,-.08]);}
function buildForest(){
 const count=30,dummy=new THREE.Object3D();
 const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.27,2,9),mat(0x65452d,1),count);
 const crown=new THREE.InstancedMesh(new THREE.SphereGeometry(1.18,12,10),mat(0x245b35,1),count);
 const crownA=new THREE.InstancedMesh(new THREE.SphereGeometry(.86,12,10),mat(0x367b43,1),count);
 const crownB=new THREE.InstancedMesh(new THREE.SphereGeometry(.72,12,10),mat(0x2c693b,1),count);
 for(let i=0;i<count;i++){
  const a=i/count*Math.PI*2,r=14+Math.random()*21,scale=.72+Math.random()*.72,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(r>17)worldBlockers.push({x,z,r:.55*scale});
  dummy.position.set(x,scale,z);dummy.scale.setScalar(scale);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x,2.35*scale,z);dummy.scale.setScalar(scale);dummy.updateMatrix();crown.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x+.48*scale,2.72*scale,z+.08*scale);dummy.scale.setScalar(scale);dummy.updateMatrix();crownA.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x-.48*scale,2.68*scale,z-.08*scale);dummy.scale.setScalar(scale);dummy.updateMatrix();crownB.setMatrixAt(i,dummy.matrix);
 }
 for(const batch of [trunk,crown,crownA,crownB]){batch.castShadow=true;batch.receiveShadow=true;batch.instanceMatrix.needsUpdate=true;scene.add(batch)}
}
function addGrass(){
 const count=260,dummy=new THREE.Object3D();
 const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.075,.42,4),mat(0x6f8e42,1),count);
 for(let i=0;i<count;i++){
  const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*37,x=Math.cos(a)*r,z=Math.sin(a)*r;
  dummy.position.set(x,.08,z);dummy.rotation.set((Math.random()-.5)*.18,Math.random()*Math.PI,(Math.random()-.5)*.18);
  const scale=.55+Math.random()*.8;dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
 }
 grass.instanceMatrix.needsUpdate=true;grass.castShadow=false;grass.receiveShadow=true;scene.add(grass);
}
function house(x,z,color){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 const wall=mat(color,1),trim=mat(0xe0d2b1,1),roofMat=mat(0x67463a,1),dark=mat(0x3c332b,1),glass=new THREE.MeshStandardMaterial({color:0x83b9c2,roughness:.22,metalness:.08});
 cube(g,6,3.1,5,wall,0,1.55,0);
 const roof=mesh(g,new THREE.ConeGeometry(4.5,2,4),roofMat,[0,4,0]);roof.rotation.y=Math.PI/4;
 cube(g,1.12,2.08,.16,dark,0,1,2.56);
 cube(g,1.25,.13,.2,trim,0,2.12,2.67);
 for(const sx of [-1.7,1.7]){
  cube(g,1.02,.92,.13,trim,sx,1.92,2.57);cube(g,.82,.72,.05,glass,sx,1.92,2.64);
  cube(g,.06,.82,.06,dark,sx,1.92,2.69);cube(g,.82,.06,.06,dark,sx,1.92,2.69);
 }
 for(const side of [-1,1])cube(g,.12,3.05,.12,trim,side*2.92,1.55,2.52);
 worldBlockers.push({x,z,r:3.8});
}
// Personagem humano real Quaternius: malha skinned, esqueleto completo e clips humanoides.
const CHARACTER_URL='https://cdn.jsdelivr.net/gh/Seyamalam/blood-league-kickoff@main/public/assets/vendor/quaternius/night-striker.glb';
const ANIMATION_URL='https://cdn.jsdelivr.net/gh/Seyamalam/blood-league-kickoff@main/public/assets/vendor/quaternius/universal-animation-library.glb';
let characterVisual=null,characterMixer=null,characterActions=new Map(),activeCharacterClip='',characterReady=false;
let weaponEquipped=true,weaponModel=null,reloadPoseUntil=0,firePoseUntil=0;
let combatBones={upperarm_l:null,lowerarm_l:null,hand_l:null,upperarm_r:null,lowerarm_r:null,hand_r:null};
const combatV1=new THREE.Vector3(),combatV2=new THREE.Vector3(),combatQ1=new THREE.Quaternion(),combatQ2=new THREE.Quaternion();
function getCombatBone(name){let found=null;characterVisual?.traverse(o=>{if(!found&&o.isBone&&o.name===name)found=o});return found}
function chooseClip(groups,fallback){
 const names=[...characterActions.keys()];
 for(const group of groups){const found=names.find(n=>group.every(token=>n.toLowerCase().includes(token)));if(found)return found}
 return fallback;
}
function solveArmIK(upper,lower,hand,targetWorld){
 if(!upper||!lower||!hand)return;
 for(let iteration=0;iteration<9;iteration++){
  for(const joint of [lower,upper]){
   characterVisual.updateMatrixWorld(true);
   const jointPos=joint.getWorldPosition(new THREE.Vector3());
   const handPos=hand.getWorldPosition(new THREE.Vector3());
   combatV1.copy(handPos).sub(jointPos);
   combatV2.copy(targetWorld).sub(jointPos);
   if(combatV1.lengthSq()<1e-8||combatV2.lengthSq()<1e-8)continue;
   combatV1.normalize();combatV2.normalize();
   const delta=combatQ1.setFromUnitVectors(combatV1,combatV2);
   const worldQ=joint.getWorldQuaternion(combatQ2);
   const desiredWorld=delta.clone().multiply(worldQ);
   const parentQ=joint.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
   joint.quaternion.copy(parentQ.multiply(desiredWorld));
  }
 }
 characterVisual.updateMatrixWorld(true);
}
function setBoneWorldRotation(bone,worldRotation){
 if(!bone||!bone.parent)return;
 const parentRotation=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 bone.quaternion.copy(parentRotation.multiply(worldRotation));
}
function applyCombatWeaponPose(crouch,prone,dt){
 if(!weaponEquipped||!weaponModel||!characterVisual)return;
 // Military ready stance: stock tucked toward the right shoulder, firing hand
 // on the pistol grip and support hand extended beneath the handguard.
 const height=prone?.52:crouch?.99:1.22;
 const forward=prone?.70:aim?.56:.43;
 weaponModel.position.set(.13,height,forward);
 weaponModel.rotation.set(prone?-.10:-.035,Math.PI-.62,0);
 if(performance.now()<firePoseUntil)weaponModel.rotation.x=THREE.MathUtils.damp(weaponModel.rotation.x,.015,22,dt);
 characterVisual.updateMatrixWorld(true);
 weaponModel.updateMatrixWorld(true);
 // Wrist targets sit inside the grip volumes, not at the center of the rifle.
 const rightGrip=weaponModel.localToWorld(new THREE.Vector3(0,-.145,.075));
 solveArmIK(combatBones.upperarm_r,combatBones.lowerarm_r,combatBones.hand_r,rightGrip);
 characterVisual.updateMatrixWorld(true);
 weaponModel.updateMatrixWorld(true);
 const leftGrip=weaponModel.localToWorld(new THREE.Vector3(0,-.005,-.53));
 solveArmIK(combatBones.upperarm_l,combatBones.lowerarm_l,combatBones.hand_l,leftGrip);
 characterVisual.updateMatrixWorld(true);
 const rifleRotation=weaponModel.getWorldQuaternion(new THREE.Quaternion());
 // Slight wrist cant differentiates the firing hand from the support hand.
 const rightRotation=rifleRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-.12)));
 const leftRotation=rifleRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,.08)));
 setBoneWorldRotation(combatBones.hand_r,rightRotation);
 setBoneWorldRotation(combatBones.hand_l,leftRotation);
}
function createPlayerAnchor(){
 hero=new THREE.Group();hero.position.set(0,0,0);scene.add(hero);
 const loader=new GLTFLoader();
 $('message').textContent='CARREGANDO SOLDADO 3D';
 Promise.all([loader.loadAsync(CHARACTER_URL),loader.loadAsync(ANIMATION_URL)]).then(([character,library])=>{
  characterVisual=character.scene;
  characterVisual.name='BattleIsland_Quaternius_Human';
  characterVisual.rotation.y=Math.PI;
  characterVisual.scale.setScalar(1);
  characterVisual.traverse(node=>{
   if(node.isMesh){node.castShadow=true;node.receiveShadow=true;
    if(node.material){const materials=Array.isArray(node.material)?node.material:[node.material];for(const material of materials){material.roughness=Math.max(.48,material.roughness??.7);material.needsUpdate=true}}
   }
  });
  hero.add(characterVisual);
  characterMixer=new THREE.AnimationMixer(characterVisual);
  for(const clip of library.animations)characterActions.set(clip.name,characterMixer.clipAction(clip));
  for(const name of Object.keys(combatBones))combatBones[name]=getCombatBone(name);
  const hand=combatBones.hand_r||characterVisual.getObjectByName('hand_r');
  if(hand)createCombatWeapon();
  characterReady=true;
  playCharacterClip('Idle_Loop',false);
  $('message').textContent='SOLDADO 3D PRONTO';
  // A biblioteca contém apenas os clips; descarta-se a cena auxiliar para poupar GPU.
  library.scene.traverse(node=>{if(node.isMesh){node.geometry.dispose();const ms=Array.isArray(node.material)?node.material:[node.material];ms.forEach(m=>m.dispose())}});
 }).catch(error=>{
  console.error('Falha ao carregar personagem humano 3D:',error);
  $('message').textContent='ERRO AO CARREGAR SOLDADO 3D';
  const box=$('error');box.hidden=false;box.textContent='Não foi possível carregar o modelo 3D. Verifique a conexão e recarregue a página.';
 });
}
function createCombatWeapon(){
 // Low-poly but proportionate carbine: stock, receiver, handguard, barrel,
 // muzzle, magazine, pistol grip, top rail, sights and optic.
 weaponModel=new THREE.Group();weaponModel.name='Rifle_3D_Attachment';characterVisual.add(weaponModel);
 weaponModel.position.set(.12,1.24,.42);weaponModel.rotation.set(0,Math.PI-.62,0);
 weaponModel.scale.setScalar(.86);weaponModel.visible=weaponEquipped;
 const receiver=mat(0x202722,.42),steel=mat(0x68716b,.3),polymer=mat(0x303832,.68);
 const dark=mat(0x111713,.52),glass=new THREE.MeshStandardMaterial({color:0x263b3b,metalness:.65,roughness:.18});
 // Main receiver and upper/lower receiver
 cube(weaponModel,.115,.125,.48,receiver,0,0,-.18);
 cube(weaponModel,.12,.045,.34,steel,0,.078,-.28);
 // Handguard with heat slots
 cube(weaponModel,.105,.105,.34,polymer,0,.005,-.53);
 for(let i=0;i<6;i++)cube(weaponModel,.108,.012,.018,dark,0,.061,-.405-i*.043);
 // Barrel and muzzle brake
 const barrel=mesh(weaponModel,new THREE.CylinderGeometry(.018,.018,.43,12),steel,[0,.012,-.88]);
 barrel.rotation.x=Math.PI/2;
 const muzzle=mesh(weaponModel,new THREE.CylinderGeometry(.027,.022,.075,12),dark,[0,.012,-1.105]);
 muzzle.rotation.x=Math.PI/2;
 // Buttstock, buffer tube and cheek rest
 cube(weaponModel,.095,.115,.23,polymer,0,-.005,.19);
 cube(weaponModel,.07,.07,.16,steel,0,.005,.105);
 cube(weaponModel,.105,.025,.16,dark,0,.063,.205);
 // Pistol grip and magazine
 cube(weaponModel,.072,.19,.09,polymer,0,-.145,.075);
 cube(weaponModel,.078,.205,.12,dark,0,-.18,-.16);
 cube(weaponModel,.082,.025,.125,steel,0,-.29,-.16);
 // Top Picatinny rail, rear/front sights and compact optic
 cube(weaponModel,.055,.025,.40,dark,0,.105,-.25);
 cube(weaponModel,.025,.075,.035,steel,0,.155,-.07);
 cube(weaponModel,.025,.06,.035,steel,0,.145,-.72);
 cube(weaponModel,.075,.07,.13,dark,0,.17,-.28);
 const optic=mesh(weaponModel,new THREE.CylinderGeometry(.032,.032,.075,16),glass,[0,.195,-.28]);
 optic.rotation.x=Math.PI/2;
 cube(weaponModel,.085,.018,.12,polymer,0,.235,-.28);
 // Sling points and trigger guard
 cube(weaponModel,.018,.025,.035,steel,.061,-.045,.12);
 cube(weaponModel,.018,.025,.035,steel,-.061,-.045,-.62);
 cube(weaponModel,.075,.012,.09,steel,0,-.105,-.015);
}
function setWeaponMode(equipped){
 weaponEquipped=equipped;
 if(weaponModel)weaponModel.visible=equipped;
 const b=$('weapon');if(b){b.textContent=equipped?'⚔':'✋';b.classList.toggle('active',equipped);b.setAttribute('aria-label',equipped?'Guardar arma':'Equipar arma')}
 $('message').textContent=equipped?'ARMA EQUIPADA':'SEM ARMA';
}
function playCharacterClip(name,restart=false){
 if(!characterMixer)return;
 const next=characterActions.get(name)||characterActions.get('Idle_Loop');
 if(!next)return;
 const previous=characterActions.get(activeCharacterClip);
 if(previous!==next){if(previous)previous.fadeOut(.16);next.reset().fadeIn(.16).play()}
 else if(restart)next.reset().play();
 activeCharacterClip=name;
}
function animateRig(dt,speed,sprinting,crouch,prone){
 if(!characterReady||!characterMixer)return;
 const now=performance.now(),moving=speed>.22;
 const idle=chooseClip([['rifle','idle'],['weapon','idle'],['idle','loop']], 'Idle_Loop');
 const walk=chooseClip([['rifle','walk'],['weapon','walk'],['walk','loop'],['jog','fwd']], 'Jog_Fwd_Loop');
 const sprint=chooseClip([['rifle','sprint'],['weapon','sprint'],['sprint','loop']], 'Sprint_Loop');
 const crouchIdle=chooseClip([['rifle','crouch','idle'],['crouch','idle']],idle);
 const crouchMove=chooseClip([['rifle','crouch','walk'],['crouch','fwd'],['crouch','walk']],walk);
 const proneIdle=chooseClip([['prone','idle'],['lying','idle'],['lie','idle']],crouchIdle);
 const proneMove=chooseClip([['prone','crawl'],['prone','move'],['crawl','loop']],crouchMove);
 const aimClip=chooseClip([['rifle','aim'],['weapon','aim'],['pistol','aim']],idle);
 const shootClip=chooseClip([['rifle','shoot'],['weapon','shoot'],['pistol','shoot']],aimClip);
 const reloadClip=chooseClip([['rifle','reload'],['weapon','reload'],['pistol','reload']],aimClip);
 let clip=idle;
 if(prone)clip=moving?proneMove:proneIdle;
 else if(crouch)clip=moving?crouchMove:crouchIdle;
 else if(!grounded)clip=chooseClip([['rifle','jump'],['jump','loop']],idle);
 else if(now<reloadPoseUntil&&weaponEquipped)clip=reloadClip;
 else if(now<firePoseUntil&&weaponEquipped)clip=shootClip;
 else if(aim&&weaponEquipped)clip=aimClip;
 else if(moving)clip=sprinting?sprint:walk;
 if(clip!==activeCharacterClip)playCharacterClip(clip);
 characterMixer.update(dt);
 applyCombatWeaponPose(crouch,prone,dt);
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
 $('reload').addEventListener('pointerdown',e=>{e.preventDefault();if(!reloading&&ammo<30){reloading=true;reloadPoseUntil=performance.now()+1450;$('message').textContent='RECARREGANDO';setTimeout(()=>{ammo=30;reloading=false;stats();$('message').textContent='ÁREA DE TREINO'},1450)}});
 let drag=null;renderer.domElement.addEventListener('pointerdown',e=>{if(e.clientX>innerWidth*.38){drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId)}});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;const sensitivity=aim?.0042:.0062;yaw-=dx*sensitivity;pitch=THREE.MathUtils.clamp(pitch+dy*(aim?.0028:.0035),-.72,.42)});
 ['pointerup','pointercancel'].forEach(ev=>renderer.domElement.addEventListener(ev,e=>{if(drag&&e.pointerId===drag.id)drag=null}));
 $('play').addEventListener('click',()=>{$('lobby').style.display='none';started=true});
 $('weapon').addEventListener('pointerdown',e=>{e.preventDefault();setWeaponMode(!weaponEquipped)});
}
function setPose(p){pose=p;$('poseLabel').textContent='POSTURA: '+(p==='stand'?'EM PÉ':p==='crouch'?'AGACHADO':'DEITADO');$('crouch').classList.toggle('active',p==='crouch');$('prone').classList.toggle('active',p==='prone')}
function stats(){$('ammo').textContent=ammo+' / 90'}
function fireShot(){
 if(reloading||ammo<=0||performance.now()-lastShot<155)return;
 lastShot=performance.now();ammo--;stats();cameraRecoil=Math.min(.12,cameraRecoil+.035);cameraShake=Math.min(.08,cameraShake+.018);
 const origin=camera.position.clone(),direction=new THREE.Vector3();camera.getWorldDirection(direction);
 const ray=new THREE.Raycaster(origin,direction,0,85);const hits=ray.intersectObjects(targets,true);
 if(hits.length){const target=hits[0].object;target.material=mat(0xe5a43a);$('message').textContent='ALVO ATINGIDO!';$('message').classList.add('hit');setTimeout(()=>{$('message').textContent='ÁREA DE TREINO';$('message').classList.remove('hit');target.material=mat(0xd6d1bd)},500)}
}
function update(dt){
 const inputMagnitude=Math.min(1,Math.hypot(moveX,moveY));
 const moving=inputMagnitude>.08;
 const crouch=pose==='crouch',prone=pose==='prone';
 const sprinting=run&&!crouch&&!prone&&moving&&stamina>1;
 if(sprinting)stamina=Math.max(0,stamina-22*dt);else stamina=Math.min(100,stamina+14*dt);
 $('stamina').textContent='FÔLEGO '+Math.round(stamina);
 const speed=prone?.62:crouch?1.75:sprinting?6.1:3.15;
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
 const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const inputDir=forward.clone().multiplyScalar(-moveY).add(right.multiplyScalar(moveX));
 if(inputDir.length()>1)inputDir.normalize();
 const targetVX=inputDir.x*speed*inputMagnitude;
 const targetVZ=inputDir.z*speed*inputMagnitude;
 const accel=moving?(sprinting?10:13):18;
 velocityX=THREE.MathUtils.damp(velocityX,targetVX,accel,dt);
 velocityZ=THREE.MathUtils.damp(velocityZ,targetVZ,accel,dt);
 const nextX=hero.position.x+velocityX*dt,nextZ=hero.position.z+velocityZ*dt;
 let blocked=false;
 for(const b of worldBlockers){const dx=nextX-b.x,dz=nextZ-b.z,min=b.r+.42;if(dx*dx+dz*dz<min*min){blocked=true;break}}
 if(!blocked){hero.position.x=nextX;hero.position.z=nextZ}else{velocityX*=.18;velocityZ*=.18}
 hero.position.x=THREE.MathUtils.clamp(hero.position.x,-34,34);
 hero.position.z=THREE.MathUtils.clamp(hero.position.z,-34,34);
 if(!grounded){
  velocityY-=17*dt;
  hero.position.y+=velocityY*dt;
  if(hero.position.y<=0){hero.position.y=0;velocityY=0;grounded=true}
 }
 const horizontalSpeed=Math.hypot(velocityX,velocityZ);
 animateRig(dt,horizontalSpeed,sprinting,crouch,prone);
 const target=new THREE.Vector3(hero.position.x,hero.position.y+(prone?.48:crouch?1.20:1.58),hero.position.z);
 const baseDist=aim?3.15:sprinting?5.15:5.6;
 const shoulder=aim?.72:1.18;
 const offset=new THREE.Vector3(Math.sin(yaw)*baseDist*Math.cos(pitch)+Math.cos(yaw)*shoulder,baseDist*(.30+Math.sin(-pitch)),Math.cos(yaw)*baseDist*Math.cos(pitch)-Math.sin(yaw)*shoulder);
 cameraDesired.copy(target).add(offset);
 cameraRay.set(target,offset.clone().normalize());cameraRay.far=baseDist;
 // Não colidir com o próprio personagem: isso colocava a câmera dentro do corpo.
 const cameraObstacles=scene.children.filter(object=>object!==hero);
 const cameraHits=cameraRay.intersectObjects(cameraObstacles,true);
 cameraCurrentDistance=THREE.MathUtils.damp(cameraCurrentDistance,cameraHits.length?Math.max(2.8,cameraHits[0].distance-.22):baseDist,18,dt);
 cameraDesired.copy(target).addScaledVector(offset.normalize(),cameraCurrentDistance);
 camera.position.lerp(cameraDesired,1-Math.exp(-dt*(aim?13:8)));
 camera.position.y+=cameraShake*.22;
 cameraRecoil=THREE.MathUtils.damp(cameraRecoil,0,9,dt);
 cameraShake=THREE.MathUtils.damp(cameraShake,0,12,dt);
 camera.fov=THREE.MathUtils.damp(camera.fov,aim?53:sprinting?68:65,8,dt);camera.updateProjectionMatrix();
 camera.lookAt(target.clone().add(new THREE.Vector3(0,cameraRecoil+cameraShake*.12,0)));
 if(shoot&&weaponEquipped){firePoseUntil=performance.now()+180;fireShot()}
 const cross=$('hud').querySelector('.crosshair');
 if(cross){const spread=1+Math.min(1,horizontalSpeed/6)+(shoot?.55:0)+(aim?-.45:0);cross.style.transform='translate(-50%,-50%) scale('+Math.max(.65,spread)+')'}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(started)update(dt);renderer.render(scene,camera)}
function resize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))}
window.addEventListener('error',e=>{const box=$('error');box.hidden=false;box.textContent='Erro ao iniciar: '+e.message});
init();