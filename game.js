import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id);
const root=$('game');
let scene,camera,renderer,clock,hero,targets=[],yaw=0,pitch=-.12,moveYaw=0,stickActive=false,moveX=0,moveY=0,velocityX=0,velocityZ=0,run=false,aim=false,shoot=false,pose='stand',velocityY=0,grounded=true,ammo=30,reloading=false,lastShot=0,started=false,cameraRecoil=0,cameraShake=0,stamina=100,worldBlockers=[],cameraRay=new THREE.Raycaster(),cameraDesired=new THREE.Vector3(),cameraCurrentDistance=5.6;
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
const ANIMATION2_URL=new URL('./assets/UAL2_Standard.glb',import.meta.url).href;
// UAL2 Standard adicionada ao projeto para as transições IdleToLay/LayToIdle.
// As duas animações são conferidas no pacote antes da publicação.
// A entrada no chão usa LayToIdle em reprodução reversa.
let characterVisual=null,characterMixer=null,characterActions=new Map(),activeCharacterClip='',characterReady=false;
let proneState=false,proneTransition=null,proneTransitionUntil=0,proneActionMissing=false;
let weaponEquipped=true,weaponModel=null,weaponMagazine=null,reloadPoseUntil=0,firePoseUntil=0,weaponBasePosition=new THREE.Vector3(),weaponBaseRotation=new THREE.Euler(),weaponRecoil=0;
let combatBones={upperarm_l:null,lowerarm_l:null,hand_l:null,upperarm_r:null,lowerarm_r:null,hand_r:null};
const combatV1=new THREE.Vector3(),combatV2=new THREE.Vector3(),combatQ1=new THREE.Quaternion(),combatQ2=new THREE.Quaternion();
function getCombatBone(name){let found=null;characterVisual?.traverse(o=>{if(!found&&o.isBone&&o.name===name)found=o});return found}
function chooseClip(groups,fallback){
 const names=[...characterActions.keys()];
 // Correspondência exata primeiro: "Crouch_Idle_Loop" nunca pode
 // ser confundida com "Idle_Loop" por busca parcial.
 for(const group of groups){
  const exact=group.length===1?names.find(n=>n.toLowerCase()===group[0].toLowerCase()):null;
  if(exact)return exact;
 }
 for(const group of groups){
  const found=names.find(n=>{
   const lower=n.toLowerCase();
   return group.every(token=>lower.includes(token)) &&
    !/(crouch|crawl|prone|lie|lying|kneel|sit|death)/.test(lower);
  });
  if(found)return found;
 }
 return fallback;
}
function exactClip(...candidates){
 const names=[...characterActions.keys()];
 for(const candidate of candidates){
  const found=names.find(n=>n.toLowerCase()===candidate.toLowerCase());
  if(found)return found;
 }
 return null;
}
function solveArmIK(upper,lower,hand,targetWorld){
 if(!upper||!lower||!hand)return;
 // CCD IK aproxima a mão ao apoio sem esticar os ossos e preserva
 // a direção natural do cotovelo da animação-base.
 for(let iteration=0;iteration<16;iteration++){
  for(const joint of [lower,upper]){
   characterVisual.updateMatrixWorld(true);
   const jointPos=joint.getWorldPosition(new THREE.Vector3());
   const handPos=hand.getWorldPosition(new THREE.Vector3());
   combatV1.copy(handPos).sub(jointPos);
   combatV2.copy(targetWorld).sub(jointPos);
   if(combatV1.lengthSq()<1e-8||combatV2.lengthSq()<1e-8)continue;
   combatV1.normalize();combatV2.normalize();
   const delta=combatQ1.setFromUnitVectors(combatV1,combatV2);
   const desiredWorld=delta.multiply(joint.getWorldQuaternion(combatQ2));
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
function applyCombatWeaponPose(crouch=false,prone=false,dt=0){
 if(!weaponEquipped||!weaponModel||!characterVisual)return;
 const rightUpper=combatBones.upperarm_r,rightLower=combatBones.lowerarm_r,rightHand=combatBones.hand_r;
 const leftUpper=combatBones.upperarm_l,leftLower=combatBones.lowerarm_l,leftHand=combatBones.hand_l;
 if(!rightUpper||!rightLower||!rightHand||!leftUpper||!leftLower||!leftHand)return;
 const now=performance.now();
 if(prone){
  // Na postura de peito no chão, a coronha acompanha a mão direita e a
  // mão esquerda apoia o guarda-mão. O cano continua seguindo a mira.
  characterVisual.updateMatrixWorld(true);
  const aimWorldDirection=camera.getWorldDirection(new THREE.Vector3()).normalize();
  const characterWorldRotation=characterVisual.getWorldQuaternion(new THREE.Quaternion());
  const aimLocalDirection=aimWorldDirection.applyQuaternion(characterWorldRotation.invert()).normalize();
  const desiredWeaponRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),aimLocalDirection);
  weaponModel.quaternion.slerp(desiredWeaponRotation,1-Math.exp(-dt*20));
  const gripPoint=new THREE.Vector3(0,-.105,.075);
  const supportPoint=new THREE.Vector3(0,.005,-.53);
  const rightHandLocal=characterVisual.worldToLocal(rightHand.getWorldPosition(new THREE.Vector3()));
  weaponModel.position.copy(rightHandLocal).sub(gripPoint.clone().applyQuaternion(weaponModel.quaternion));
  weaponModel.updateMatrixWorld(true);
  solveArmIK(rightUpper,rightLower,rightHand,weaponModel.localToWorld(gripPoint));
  solveArmIK(leftUpper,leftLower,leftHand,weaponModel.localToWorld(supportPoint));
  return;
 }
 // A arma fica referenciada ao ombro, não pendurada na mão. A coronha
 // encosta no pivô do ombro direito; as duas mãos são então resolvidas por IK.
 characterVisual.updateMatrixWorld(true);
 const shoulderLocal=characterVisual.worldToLocal(rightUpper.getWorldPosition(new THREE.Vector3()));
 // O eixo do cano acompanha a direção real do centro da câmera/mira.
 // Converte a direção mundial da câmera para o espaço local do personagem.
 const aimWorldDirection=camera.getWorldDirection(new THREE.Vector3()).normalize();
 const characterWorldRotation=characterVisual.getWorldQuaternion(new THREE.Quaternion());
 const aimLocalDirection=aimWorldDirection.applyQuaternion(characterWorldRotation.invert()).normalize();
 const desiredWeaponRotation=new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0,0,-1),aimLocalDirection
 );
 // Suaviza o acompanhamento sem deixar o cano atrasar visivelmente a mira.
 weaponModel.quaternion.slerp(desiredWeaponRotation,1-Math.exp(-dt*24));
 const stockEnd=new THREE.Vector3(0,0,.305*weaponModel.scale.x).applyQuaternion(weaponModel.quaternion);
 weaponModel.position.copy(shoulderLocal).sub(stockEnd);
 weaponModel.position.y-=weaponRecoil;
 weaponModel.updateMatrixWorld(true);
 const gripPoint=new THREE.Vector3(0,-.105,.075);
 const supportRest=new THREE.Vector3(0,.005,-.53);
 let supportPoint=supportRest.clone();
 if(reloading&&reloadPoseUntil>0){
  const progress=THREE.MathUtils.clamp(1-(reloadPoseUntil-now)/1450,0,1);
  const magPoint=new THREE.Vector3(0,-.18,-.16);
  if(progress<.34)supportPoint.lerpVectors(supportRest,magPoint,progress/.34);
  else if(progress<.68)supportPoint.copy(magPoint);
  else supportPoint.lerpVectors(magPoint,supportRest,(progress-.68)/.32);
 }
 solveArmIK(rightUpper,rightLower,rightHand,weaponModel.localToWorld(gripPoint));
 solveArmIK(leftUpper,leftLower,leftHand,weaponModel.localToWorld(supportPoint));
 const recoilTarget=now<firePoseUntil?.025:0;
 weaponRecoil=THREE.MathUtils.damp(weaponRecoil,recoilTarget,now<firePoseUntil?28:12,dt);
 if(weaponMagazine){
  const p=reloading?THREE.MathUtils.clamp(1-Math.abs((now-(reloadPoseUntil-950))/380),0,1):0;
  weaponMagazine.position.y=-.18-.13*p;
  weaponMagazine.rotation.x=.12*p;
 }
}
function createPlayerAnchor(){
 hero=new THREE.Group();hero.position.set(0,0,0);scene.add(hero);
 const loader=new GLTFLoader();
 $('message').textContent='CARREGANDO SOLDADO 3D';
 Promise.all([
  loader.loadAsync(CHARACTER_URL),
  loader.loadAsync(ANIMATION_URL),
  loader.loadAsync(ANIMATION2_URL).catch(error=>{
   console.warn('UAL2 ainda não disponível; transição de deitar será desativada:',error);
   return {animations:[],scene:new THREE.Group()};
  })
 ]).then(([character,library,library2])=>{
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
  // UAL2 Standard é o pacote oficial complementar da Quaternius. Ele traz
  // LayToIdle; usamos o mesmo clipe ao contrário para a entrada no chão.
  for(const clip of library2.animations)characterActions.set(clip.name,characterMixer.clipAction(clip));
  if(!characterActions.has('IdleToLay')||!characterActions.has('LayToIdle')){
   console.error('UAL2 carregada sem os clips IdleToLay/LayToIdle',library2.animations.map(c=>c.name));
  }
  for(const name of Object.keys(combatBones))combatBones[name]=getCombatBone(name);
  const hand=combatBones.hand_r||characterVisual.getObjectByName('hand_r');
  if(hand)createCombatWeapon();
  characterReady=true;
  playCharacterClip('Idle_Loop',false);
  $('message').textContent='SOLDADO 3D PRONTO';
  // A biblioteca contém apenas os clips; descarta-se a cena auxiliar para poupar GPU.
  for(const sourceScene of [library.scene,library2.scene]){
   sourceScene.traverse(node=>{if(node.isMesh){node.geometry.dispose();const ms=Array.isArray(node.material)?node.material:[node.material];ms.forEach(m=>m.dispose())}});
  }
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
 weaponModel.position.set(.10,1.22,.43);weaponModel.rotation.set(0,Math.PI,0);
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
 weaponMagazine=cube(weaponModel,.078,.205,.12,dark,0,-.18,-.16);
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
 // Escala proporcional ao corpo: carabina real costuma medir cerca de metade
 // da altura do combatente. Mede a malha humana e a extensão real do rifle.
 weaponModel.scale.setScalar(1);
 characterVisual.updateMatrixWorld(true);
 weaponModel.updateMatrixWorld(true);
 const bodyBounds=new THREE.Box3().setFromObject(characterVisual);
 const bodyHeight=bodyBounds.getSize(new THREE.Vector3()).y;
 const rifleBounds=new THREE.Box3().setFromObject(weaponModel);
 const rifleLength=rifleBounds.getSize(new THREE.Vector3()).z;
 // Calibra o comprimento pela altura real do soldado, sem deixar a arma
 // exagerada em relação às mãos e aos braços do personagem.
 const targetLength=bodyHeight*.44;
 const proportionalScale=(bodyHeight>0&&rifleLength>0)?targetLength/rifleLength:.56;
 const finalScale=THREE.MathUtils.clamp(proportionalScale,.42,.62);
 weaponModel.scale.setScalar(finalScale);
 // Rifle orientado para a frente e apoiado no ombro direito.
 // O ponto de apoio e recalculado por frame em applyCombatWeaponPose().
 weaponModel.rotation.set(0,Math.PI,0);
 weaponBaseRotation.copy(weaponModel.rotation);
 characterVisual.updateMatrixWorld(true);
 weaponModel.userData.bodyHeight=bodyHeight;
 weaponModel.userData.targetLength=targetLength;
 weaponModel.userData.proportionalScale=finalScale;
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
 if(previous!==next){
  if(previous)previous.fadeOut(.14);
  next.timeScale=1;
  next.setLoop(THREE.LoopRepeat,Infinity);
  next.clampWhenFinished=false;
  next.reset().fadeIn(.14).play();
 }else if(restart)next.reset().play();
 activeCharacterClip=name;
}
function playProneTransition(name,now){
 // UAL1 tem clips próprios de rastejo em posição ventral.
 // Não usar LayToIdle da UAL2: esse movimento termina de costas.
 const entering=name==='Crawl_Enter';
 const clipName=exactClip(entering?'Crawl_Enter':'Crawl_Exit');
 if(!clipName){
  proneActionMissing=true;
  console.error('Clip de transição ventral ausente:',name,'Clips de rastejo:',[...characterActions.keys()].filter(n=>/crawl/i.test(n)));
  $('message').textContent='ANIMAÇÃO VENTRAL NÃO CARREGADA';
  return false;
 }
 proneActionMissing=false;
 const next=characterActions.get(clipName);
 const previous=characterActions.get(activeCharacterClip);
 if(previous&&previous!==next)previous.fadeOut(.08);
 next.stop();
 next.reset();
 next.timeScale=1;
 next.enabled=true;
 next.paused=false;
 next.setEffectiveWeight(1);
 next.setLoop(THREE.LoopOnce,1);
 next.clampWhenFinished=true;
 next.fadeIn(.08).play();
 activeCharacterClip=clipName;
 proneTransition=name;
 proneTransitionUntil=now+Math.max(.2,next.getClip().duration)*1000+120;
 return true;
}
function animateRig(dt,speed,sprinting,crouch,prone){
 if(!characterReady||!characterMixer)return;
 const now=performance.now(),moving=speed>.22;
 const idle=exactClip('Idle_Loop','Idle_Standing_Loop')||'Idle_Loop';
 const walk=exactClip('Jog_Fwd_Loop','Walk_Fwd_Loop','Walk_Loop')||idle;
 const sprint=exactClip('Sprint_Loop','Run_Fwd_Loop')||walk;
 const crouchIdle=exactClip('Crouch_Idle_Loop')||idle;
 const crouchMove=exactClip('Crouch_Fwd_Loop','Crouch_Fwd_L_Loop')||walk;
 // A pose de barriga para baixo é aplicada proceduralmente no corpo inteiro
 // no update principal. Não depende de Crawl_Enter/LayToIdle, que não são
 // compatíveis/garantidos para este rig e causavam o personagem de costas.
 if(prone){
  if(activeCharacterClip!==idle)playCharacterClip(idle,true);
  characterMixer.update(dt);
  return;
 }
 let clip=idle;
 if(crouch)clip=moving?crouchMove:crouchIdle;
 else if(!grounded)clip=exactClip('Jump_Loop','Jump_Start')||idle;
 else if(moving)clip=sprinting?sprint:walk;
 if(!crouch&&!moving){
  if(reloading)clip=exactClip('Rifle_Reload_Loop','Rifle_Reload','Reload_Rifle')||clip;
  else if(now<firePoseUntil)clip=exactClip('Rifle_Fire_Loop','Rifle_Fire','Fire_Rifle')||clip;
  else if(aim)clip=exactClip('Rifle_Aim_Loop','Rifle_Aiming_Loop','Aim_Rifle_Loop')||clip;
 }
 if(clip!==activeCharacterClip)playCharacterClip(clip);
 characterMixer.update(dt);
}
function bind(){
 const stick=$('stick'),knob=$('knob');let sid=null,rect=null;
 stick.addEventListener('pointerdown',e=>{e.preventDefault();sid=e.pointerId;stickActive=true;moveYaw=yaw;stick.setPointerCapture(sid);rect=stick.getBoundingClientRect();stickMove(e)});
 function stickMove(e){if(sid!==e.pointerId)return;let dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),len=Math.hypot(dx,dy),max=43;if(len>max){dx*=max/len;dy*=max/len}moveX=dx/max;moveY=dy/max;knob.style.transform='translate('+dx+'px,'+dy+'px)'}
 function stickEnd(e){if(sid!==e.pointerId)return;sid=null;stickActive=false;moveYaw=yaw;moveX=moveY=0;knob.style.transform='translate(0,0)'}
 stick.addEventListener('pointermove',stickMove);stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);
 const hold=(id,down,up=()=>{})=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('active');down()});['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>{b.classList.remove('active');up()}))};
 hold('run',()=>run=true,()=>run=false);hold('aim',()=>aim=true,()=>aim=false);hold('fire',()=>shoot=true,()=>shoot=false);
 $('jump').addEventListener('pointerdown',e=>{e.preventDefault();if(grounded&&pose!=='prone'){velocityY=6.2;grounded=false}});
 $('crouch').addEventListener('pointerdown',e=>{e.preventDefault();setPose(pose==='crouch'?'stand':'crouch')});
 $('prone').addEventListener('pointerdown',e=>{e.preventDefault();setPose(pose==='prone'?'stand':'prone')});
 $('reload').addEventListener('pointerdown',e=>{e.preventDefault();if(!reloading&&ammo<30){reloading=true;reloadPoseUntil=performance.now()+1450;$('message').textContent='RECARREGANDO';setTimeout(()=>{ammo=30;reloading=false;stats();$('message').textContent='ÁREA DE TREINO'},1450)}});
 // Controle de câmera por arrasto: inicia na área livre do canvas e
 // acompanha o mesmo dedo pela janela inteira, mesmo se sair do canvas.
 let drag=null;
 renderer.domElement.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(e.clientX>innerWidth*.30){
   e.preventDefault();
   drag={id:e.pointerId,x:e.clientX,y:e.clientY};
   try{renderer.domElement.setPointerCapture(e.pointerId)}catch(_){}
  }
 },{passive:false});
 window.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  e.preventDefault();
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  drag.x=e.clientX;drag.y=e.clientY;
  const sensitivity=aim?.0052:.0075;
  yaw-=dx*sensitivity;
  pitch=THREE.MathUtils.clamp(pitch-dy*(aim?.0038:.0046),-.78,.48);
 },{passive:false});
 const endCameraDrag=e=>{if(drag&&e.pointerId===drag.id)drag=null};
 window.addEventListener('pointerup',endCameraDrag);
 window.addEventListener('pointercancel',endCameraDrag);
 renderer.domElement.addEventListener('lostpointercapture',endCameraDrag);
 $('play').addEventListener('click',()=>{$('lobby').style.display='none';started=true});
 $('weapon').addEventListener('pointerdown',e=>{e.preventDefault();setWeaponMode(!weaponEquipped)});
}
function setPose(p){pose=p;$('poseLabel').textContent='POSTURA: '+(p==='stand'?'EM PÉ':p==='crouch'?'AGACHADO':'DEITADO');$('crouch').classList.toggle('active',p==='crouch');$('prone').classList.toggle('active',p==='prone')}
function stats(){$('ammo').textContent=ammo+' / 90'}
function showBulletTrail(start,end){
 // Projétil luminoso animado: sai do cano e percorre o mesmo ponto
 // encontrado pelo raio central da mira. A cauda acompanha a ponta do tiro.
 const delta=end.clone().sub(start);
 const distance=delta.length();
 if(distance<.02)return;
 const direction=delta.normalize();
 const streakLength=Math.min(1.35,Math.max(.48,distance*.035));
 const streakGeo=new THREE.CylinderGeometry(.012,.012,streakLength,8,1,false);
 const streakMat=new THREE.MeshBasicMaterial({color:0xffb347,transparent:true,opacity:.96,depthWrite:false});
 const streak=new THREE.Mesh(streakGeo,streakMat);
 streak.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
 streak.renderOrder=31;
 scene.add(streak);
 const headGeo=new THREE.SphereGeometry(.034,8,8);
 const headMat=new THREE.MeshBasicMaterial({color:0xfff4c2,depthWrite:false});
 const head=new THREE.Mesh(headGeo,headMat);
 head.renderOrder=32;
 scene.add(head);
 const glowGeo=new THREE.SphereGeometry(.075,8,8);
 const glowMat=new THREE.MeshBasicMaterial({color:0xff8a24,transparent:true,opacity:.42,depthWrite:false});
 const glow=new THREE.Mesh(glowGeo,glowMat);
 glow.renderOrder=30;
 scene.add(glow);
 const startedAt=performance.now();
 const travelMs=THREE.MathUtils.clamp(distance/190*1000,65,340);
 const animateTracer=now=>{
  const progress=THREE.MathUtils.clamp((now-startedAt)/travelMs,0,1);
  const tip=start.clone().addScaledVector(direction,distance*progress);
  head.position.copy(tip);
  glow.position.copy(tip);
  streak.position.copy(tip).addScaledVector(direction,-streakLength*.5);
  if(progress<1){
   requestAnimationFrame(animateTracer);
  }else{
   for(const item of [streak,head,glow])scene.remove(item);
   streakGeo.dispose();streakMat.dispose();
   headGeo.dispose();headMat.dispose();
   glowGeo.dispose();glowMat.dispose();
  }
 };
 requestAnimationFrame(animateTracer);
}
function fireShot(){
 if(reloading||ammo<=0||performance.now()-lastShot<155)return;
 lastShot=performance.now();ammo--;stats();cameraRecoil=Math.min(.12,cameraRecoil+.035);cameraShake=Math.min(.08,cameraShake+.018);
 // 1) A câmera escolhe o ponto do mundo que está exatamente no centro da mira.
 // Atualiza a matriz antes do raycast para usar a posição/rotação deste frame.
 camera.updateWorldMatrix(true,false);
 const aimRay=new THREE.Raycaster();
 aimRay.setFromCamera(new THREE.Vector2(0,0),camera);
 aimRay.near=0;
 aimRay.far=85;
 const aimHits=aimRay.intersectObjects(targets,true);
 const aimPoint=aimHits.length
  ?aimHits[0].point.clone()
  :aimRay.ray.at(85,new THREE.Vector3());
 // 2) O projétil nasce na boca real do cano. Atualiza também todos os pais
 // do rifle: o personagem e os ossos podem ter mudado com a animação neste frame.
 let muzzlePoint=camera.position.clone();
 if(weaponModel&&weaponModel.visible){
  weaponModel.updateWorldMatrix(true,false);
  muzzlePoint=weaponModel.localToWorld(new THREE.Vector3(0,.012,-1.145));
 }
 // 3) A direção visual é calculada do cano até o ponto escolhido pela mira.
 // A colisão continua sendo decidida pelo raio da câmera, evitando parallax.
 const shotDirection=aimPoint.clone().sub(muzzlePoint).normalize();
 const shotEnd=muzzlePoint.clone().addScaledVector(shotDirection,muzzlePoint.distanceTo(aimPoint));
 showBulletTrail(muzzlePoint,shotEnd);
 showMuzzleFlash(muzzlePoint,shotDirection);
 if(aimHits.length){
  const hitRoot=aimHits[0].object;
  const originalMaterials=[];
  hitRoot.traverse(node=>{
   if(node.isMesh){
    originalMaterials.push([node,node.material]);
    node.material=mat(0xe5a43a);
   }
  });
  $('message').textContent='ALVO ATINGIDO!';
  $('message').classList.add('hit');
  setTimeout(()=>{
   $('message').textContent='ÁREA DE TREINO';$('message').classList.remove('hit');
   for(const [node,material] of originalMaterials)node.material=material;
  },180);
 }
}
function showMuzzleFlash(position,direction){
 const flash=new THREE.Mesh(
  new THREE.SphereGeometry(.055,8,8),
  new THREE.MeshBasicMaterial({color:0xffc45c,transparent:true,opacity:.9,depthWrite:false})
 );
 flash.position.copy(position).addScaledVector(direction,.045);
 flash.scale.set(.8,.8,1.8);
 flash.renderOrder=33;
 scene.add(flash);
 const born=performance.now();
 const animateFlash=now=>{
  const t=THREE.MathUtils.clamp((now-born)/55,0,1);
  flash.material.opacity=.9*(1-t);
  flash.scale.multiplyScalar(1+.025);
  if(t<1)requestAnimationFrame(animateFlash);
  else{scene.remove(flash);flash.geometry.dispose();flash.material.dispose()}
 };
 requestAnimationFrame(animateFlash);
}
function update(dt){
 const inputMagnitude=Math.min(1,Math.hypot(moveX,moveY));
 const moving=inputMagnitude>.08;
 const crouch=pose==='crouch',prone=pose==='prone';
 // Corrida automática ao empurrar o joystick totalmente para frente,
 // com botão de corrida como alternativa. Mirando, o sprint é bloqueado.
 const fullForward=moveY<-.88&&Math.abs(moveX)<.48&&inputMagnitude>.9;
 const sprinting=(run||fullForward)&&!aim&&!crouch&&!prone&&moving&&stamina>1;
 if(sprinting)stamina=Math.max(0,stamina-22*dt);else stamina=Math.min(100,stamina+14*dt);
 $('stamina').textContent='FÔLEGO '+Math.round(stamina);
 const speed=prone?0:crouch?1.55:aim?2.35:sprinting?6.25:3.25;
 // Direção do joystick fica independente do giro livre da câmera enquanto
 // o jogador mantém o analógico pressionado. Assim é possível orbitar 360°
 // e enxergar a frente do soldado sem mudar a trajetória da corrida.
 const controlYaw=stickActive?moveYaw:yaw;
 const forward=new THREE.Vector3(-Math.sin(controlYaw),0,-Math.cos(controlYaw));
 const right=new THREE.Vector3(Math.cos(controlYaw),0,-Math.sin(controlYaw));
 const inputDir=forward.clone().multiplyScalar(-moveY).add(right.multiplyScalar(moveX));
 if(inputDir.length()>1)inputDir.normalize();
 // Controle 360° relativo à câmera. O modelo Quaternius tem uma
 // correção local de 180°; compensamos isso ao orientar o grupo do herói.
 // Em mira, o tronco fica voltado para a câmera e pode deslocar-se de lado
 // ou para trás sem perder a direção da mira.
 // Ao mirar, o corpo inteiro acompanha a direção horizontal da câmera,
 // mesmo parado. Sem mirar, mantém a rotação de movimento 360° já aprovada.
 // Sem arma/mira, a orientação continua seguindo o movimento 360°.
 // Quando há arma equipada, a rotação do corpo é aplicada depois que a câmera
 // atualiza seu lookAt, usando a direção mundial real da mira.
 if(!aim&&inputMagnitude>.08){
  const facing=Math.atan2(inputDir.x,inputDir.z)-Math.PI;
  const turn=THREE.MathUtils.euclideanModulo(facing-hero.rotation.y+Math.PI,Math.PI*2)-Math.PI;
  hero.rotation.y+=turn*(1-Math.exp(-dt*12));
 }
 if(prone){velocityX=0;velocityZ=0;}
 const targetVX=inputDir.x*speed*inputMagnitude;
 const targetVZ=inputDir.z*speed*inputMagnitude;
 const accel=moving?(sprinting?12:aim?16:14):20;
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
 // Rotação corporal procedural em torno da base dos pés: -90° coloca
 // frente/peito voltados ao chão. Suavização evita teleporte da malha.
 if(characterVisual){
  const targetProneTilt=prone?-Math.PI/2:0;
  characterVisual.rotation.x=THREE.MathUtils.damp(characterVisual.rotation.x,targetProneTilt,prone?10:12,dt);
 }
 const target=new THREE.Vector3(hero.position.x,hero.position.y+(prone?.48:crouch?1.20:1.58),hero.position.z);
 const baseDist=(aim?3.15:sprinting?5.15:5.6)*.55; // câmera 45% mais próxima do personagem
 const shoulder=(aim?1.45:1.80)*.55; // aumenta o espaço lateral entre o soldado e a mira branca
 const offset=new THREE.Vector3(Math.sin(yaw)*baseDist*Math.cos(pitch)+Math.cos(yaw)*shoulder,baseDist*(.30+Math.sin(-pitch)),Math.cos(yaw)*baseDist*Math.cos(pitch)-Math.sin(yaw)*shoulder);
 cameraDesired.copy(target).add(offset);
 cameraRay.set(target,offset.clone().normalize());cameraRay.far=baseDist;
 // Não colidir com o próprio personagem: isso colocava a câmera dentro do corpo.
 const cameraObstacles=scene.children.filter(object=>object!==hero);
 const cameraHits=cameraRay.intersectObjects(cameraObstacles,true);
 cameraCurrentDistance=THREE.MathUtils.damp(cameraCurrentDistance,cameraHits.length?Math.max(1.45,cameraHits[0].distance-.22):baseDist,18,dt);
 cameraDesired.copy(target).addScaledVector(offset.normalize(),cameraCurrentDistance);
 camera.position.lerp(cameraDesired,1-Math.exp(-dt*(aim?13:8)));
 camera.position.y+=cameraShake*.22;
 cameraRecoil=THREE.MathUtils.damp(cameraRecoil,0,9,dt);
 cameraShake=THREE.MathUtils.damp(cameraShake,0,12,dt);
 camera.fov=THREE.MathUtils.damp(camera.fov,aim?53:sprinting?68:65,8,dt);camera.updateProjectionMatrix();
 camera.lookAt(target.clone().add(new THREE.Vector3(0,cameraRecoil+cameraShake*.12,0)));
 camera.updateMatrixWorld(true);
 // Rotação corporal de terceira pessoa: primeiro lê a direção horizontal
 // REAL para onde a câmera olha; depois gira o root do personagem inteiro.
 // Assim tronco, quadril e pernas acompanham a mira, não apenas os braços.
 if(aim||(weaponEquipped&&!moving)){
  // yaw é o ângulo de controle horizontal da câmera, mantido contínuo
  // durante voltas completas. Não derivar do lookAt da câmera: o offset
  // lateral da câmera distorce esse vetor e causa erro na orientação.
  const bodyTurn=THREE.MathUtils.euclideanModulo(yaw-hero.rotation.y+Math.PI,Math.PI*2)-Math.PI;
  hero.rotation.y+=bodyTurn*(1-Math.exp(-dt*16));
 }
 // Recalcula a arma e os IK das mãos após a rotação do corpo neste frame.
 applyCombatWeaponPose(crouch,prone,dt);
 if(shoot&&weaponEquipped){firePoseUntil=performance.now()+180;fireShot()}
 const cross=$('hud').querySelector('.crosshair');
 if(cross){const spread=1+Math.min(1,horizontalSpeed/6)+(shoot?.55:0)+(aim?-.45:0);cross.style.transform='translate(-50%,-50%) scale('+Math.max(.65,spread)+')'}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(started)update(dt);renderer.render(scene,camera)}
function resize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))}
window.addEventListener('error',e=>{const box=$('error');box.hidden=false;box.textContent='Erro ao iniciar: '+e.message});
init();