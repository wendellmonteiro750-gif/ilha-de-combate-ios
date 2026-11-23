import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id);
const root=$('game');
let scene,camera,renderer,clock,hero,rig={},weapon,muzzleFlash,muzzleLight,weaponKick=0,reloadBlend=0,muzzleTime=0,targets=[],realHero=null,realMixer=null,realActions={},activeRealAction='',realBones={},realPoseOffsets=[],realCrouchBlend=0,realProneBlend=0,realAimBlend=0,yaw=0,pitch=-.12,moveX=0,moveY=0,velocityX=0,velocityZ=0,locomotionSpeed=0,run=false,aim=false,shoot=false,pose='stand',proneBlend=0,velocityY=0,grounded=true,walkT=0,runBlend=0,landingBlend=0,breathPhase=0,ammo=30,reloading=false,lastShot=0,started=false,cameraRecoil=0,cameraShake=0,stamina=100,worldBlockers=[],cameraRay=new THREE.Raycaster(),cameraDesired=new THREE.Vector3(),cameraCurrentDistance=5.6;
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
 buildIsland();buildHero();loadRealHero();bind();addEventListener('resize',resize);clock=new THREE.Clock();animate();
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
function buildHero(){
 // Novo operador tático: corpo segmentado por articulações, com volumes
 // anatômicos sobrepostos para reduzir o aspecto de boneco feito de blocos.
 hero=new THREE.Group();scene.add(hero);
 const skin=mat(0xb98262),shirt=mat(0x344b42),pants=mat(0x303d3a),boots=mat(0x171e1d),hair=mat(0x211d19),vest=mat(0x4a5548),gun=mat(0x202725),glove=mat(0x252d2a),joint=mat(0x59634f),fabric=mat(0x3b4940);
 const oval=(parent,rx,ry,rz,m,x,y,z)=>{const o=mesh(parent,new THREE.SphereGeometry(1,20,16),m,[x,y,z]);o.scale.set(rx,ry,rz);return o};
 rig.body=new THREE.Group();rig.body.position.y=1.03;hero.add(rig.body);
 rig.pelvis=new THREE.Group();rig.body.add(rig.pelvis);
 oval(rig.pelvis,.285,.19,.205,pants,0,-.01,0);
 // Camadas do tronco: abdômen, caixa torácica, peitoral e colete ajustado.
 oval(rig.body,.255,.30,.19,shirt,0,.29,0);
 oval(rig.body,.355,.34,.205,shirt,0,.59,-.005);
 oval(rig.body,.37,.29,.215,vest,0,.57,-.025);
 oval(rig.body,.29,.20,.19,fabric,0,.27,-.005);
 cube(rig.body,.66,.10,.34,mat(0x303a34),0,.13,-.015);
 for(const side of [-1,1]){
  // Alças, placas laterais, bolsos e proteção de ombro.
  const strap=mesh(rig.body,new THREE.BoxGeometry(.105,.54,.07),mat(0x303b34),[side*.235,.58,-.205]);strap.rotation.z=-side*.12;
  oval(rig.body,.17,.15,.17,vest,side*.405,.77,-.005);
  oval(rig.body,.12,.13,.12,joint,side*.46,.75,-.015);
  cube(rig.body,.17,.18,.10,fabric,side*.25,.42,-.225);
  cube(rig.body,.15,.13,.09,joint,side*.25,.22,-.215);
  cube(rig.body,.09,.13,.10,mat(0x202a25),side*.32,.59,-.225);
 }
 // Pescoço, crânio, mandíbula e detalhes faciais.
 const neck=capsule(rig.body,.105,.16,skin,0,.91,0);
 rig.head=new THREE.Group();rig.head.position.set(0,1.06,0);rig.body.add(rig.head);
 oval(rig.head,.205,.275,.19,skin,0,.19,-.005);
 oval(rig.head,.165,.125,.16,skin,0,.075,-.015);
 oval(rig.head,.215,.105,.20,hair,0,.39,.005);
 // Capacete tático baixo, correia e proteção auricular.
 const helmet=mesh(rig.head,new THREE.SphereGeometry(.225,20,14,0,Math.PI*2,0,Math.PI*.58),mat(0x35443a),[0,.405,.005]);helmet.scale.set(1.12,.86,1.05);
 cube(rig.head,.39,.045,.30,mat(0x28342e),0,.34,-.015);
 for(const side of [-1,1]){
  oval(rig.head,.045,.07,.045,skin,side*.205,.16,0);
  oval(rig.head,.052,.065,.045,joint,side*.207,.17,.005);
  oval(rig.head,.043,.024,.025,mat(0xd8c9b5),side*.078,.22,-.174);
  oval(rig.head,.018,.018,.012,mat(0x241d18),side*.078,.22,-.194);
  oval(rig.head,.055,.018,.022,hair,side*.08,.255,-.175);
 }
 oval(rig.head,.035,.055,.045,skin,0,.16,-.185);
 oval(rig.head,.038,.012,.018,mat(0x684538),0,.075,-.17);
 // Colete com placas, fivelas e bolsos utilitários.
 for(let i=0;i<3;i++){
  cube(rig.body,.13,.14,.055,vest,-.22+i*.22,.48,-.247);
  cube(rig.body,.105,.025,.06,mat(0x252f2a),-.22+i*.22,.55,-.278);
 }
 cube(rig.body,.58,.075,.09,mat(0x252d28),0,.06,-.16);
 for(const side of [-1,1])cube(rig.body,.18,.17,.11,vest,side*.23,.015,-.19);
 // Pernas com coxa, joelho, canela, proteção e tornozelo independentes.
 rig.legs=[];
 for(const side of [-1,1]){
  const upper=new THREE.Group();upper.position.set(side*.205,-.13,0);rig.body.add(upper);
  const thigh=capsule(upper,.145,.39,pants,0,-.255,0);thigh.scale.set(1.08,1.12,1);
  oval(upper,.15,.15,.15,pants,0,-.48,-.005);
  oval(upper,.145,.105,.13,joint,0,-.51,-.095);
  const knee=new THREE.Group();knee.position.set(0,-.51,0);upper.add(knee);
  capsule(knee,.105,.34,pants,0,-.20,.015);
  oval(knee,.125,.12,.075,vest,0,-.075,-.105);
  oval(knee,.115,.12,.085,joint,0,-.075,-.16);
  const ankle=new THREE.Group();ankle.position.set(0,-.43,-.035);knee.add(ankle);
  capsule(ankle,.095,.14,pants,0,-.04,0);
  cube(ankle,.235,.15,.34,boots,0,-.105,-.105);
  cube(ankle,.24,.045,.31,mat(0x0c1110),0,-.185,-.105);
  cube(ankle,.12,.045,.10,mat(0x3b4540),0,-.025,-.265);
  rig.legs.push({upper,knee,ankle,side});
 }
 // Braços independentes: bíceps, cotovelo, antebraço, luva e dedos.
 rig.arms=[];
 for(const side of [-1,1]){
  const upper=new THREE.Group();rig.body.add(upper);
  capsule(upper,.115,.29,shirt,0,-.235,0);
  oval(upper,.12,.17,.12,shirt,0,-.23,-.005);
  oval(upper,.115,.105,.12,vest,0,-.43,-.015);
  const fore=new THREE.Group();rig.body.add(fore);
  capsule(fore,.095,.27,shirt,0,-.22,0);
  oval(fore,.105,.12,.105,fabric,0,-.39,-.01);
  oval(fore,.095,.075,.09,joint,0,-.43,-.02);
  const hand=new THREE.Group();fore.add(hand);
  oval(hand,.085,.105,.075,glove,0,-.045,-.035);
  for(let finger=0;finger<4;finger++){
   const f=capsule(hand,.018,.055,glove,-.052+finger*.034,-.115,-.075);
   f.rotation.z=(finger-1.5)*-.08;
  }
  oval(hand,.026,.065,.025,glove,.09,-.07,-.04);
  rig.arms.push({upper,fore,hand,side});
 }
 // Rifle com coronha, guarda-mão, carregador, mira e cano orientado para -Z.
 weapon=new THREE.Group();weapon.position.set(.28,.50,-.28);rig.body.add(weapon);
 cube(weapon,.15,.16,.78,gun,0,0,-.20);
 cube(weapon,.075,.075,.68,gun,0,.015,-.88);
 cube(weapon,.13,.13,.34,vest,0,0,.36);
 cube(weapon,.105,.28,.16,gun,0,-.19,-.22);
 cube(weapon,.055,.065,.15,mat(0x111715),0,.11,-.55);
 cube(weapon,.12,.23,.13,gun,0,-.20,-.43);
 cube(weapon,.22,.11,.28,gun,0,.015,.39);
 cube(weapon,.09,.075,.39,mat(0x414b45),0,.105,-.08);
 for(let i=0;i<5;i++)cube(weapon,.18,.022,.032,mat(0x111715),0,.10,-.20-i*.10);
 cube(weapon,.065,.04,.12,mat(0x111715),0,.17,-.49);
 const barrel=mesh(weapon,new THREE.CylinderGeometry(.032,.042,.42,12),gun,[0,.012,-1.04]);barrel.rotation.x=Math.PI/2;
 const muzzle=mesh(weapon,new THREE.CylinderGeometry(.05,.04,.10,12),mat(0x111715),[0,.012,-1.27]);muzzle.rotation.x=Math.PI/2;
 cube(weapon,.05,.18,.09,mat(0x171d1a),0,-.17,.07);
 muzzleFlash=new THREE.Group();muzzleFlash.position.set(0,.012,-1.35);weapon.add(muzzleFlash);
 const flashMat=new THREE.MeshBasicMaterial({color:0xffd36a,transparent:true,opacity:.95});
 const flash=mesh(muzzleFlash,new THREE.ConeGeometry(.12,.42,8),flashMat,[0,0,-.20]);flash.rotation.x=-Math.PI/2;
 mesh(muzzleFlash,new THREE.SphereGeometry(.075,8,8),new THREE.MeshBasicMaterial({color:0xffffff}),[0,0,-.035]);
 muzzleLight=new THREE.PointLight(0xffb347,0,3);muzzleLight.position.set(0,.02,-.2);muzzleFlash.add(muzzleLight);muzzleFlash.visible=false;
}
function loadRealHero(){
 const loader=new GLTFLoader();
 const url='https://grab3d.com/dl/man-base-character-rigged/man-base-character-rigged.glb';
 loader.load(url,gltf=>{
  const model=gltf.scene;
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  const height=bounds.max.y-bounds.min.y;
  if(height>0)model.scale.setScalar(1.78/height);
  model.position.set(0,-bounds.min.y*model.scale.y,0);
  model.rotation.y=Math.PI;
  model.traverse(o=>{if(o.isMesh&&o.material){o.material.roughness=Math.min(o.material.roughness??.8,.92);o.material.metalness=Math.min(o.material.metalness??0,.15)}});
  realBones={};
  model.traverse(o=>{
   if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.side=THREE.FrontSide}
   if(o.isBone){
    // Normalize Mixamo, Blender and common humanoid naming conventions.
    // The previous character class accidentally removed the letter "s"
    // instead of whitespace, preventing several real bones from matching.
    const n=o.name.toLowerCase().replace(/[\s_.-]/g,'');
    if(/(?:hips|pelvis)$/.test(n))realBones.hips=o;
    if(/spine(?:1|2)?$/.test(n)&&(!realBones.spine||/spine2$/.test(n)))realBones.spine=o;
    if(/(?:neck|head)$/.test(n))realBones.head=o;
    if(/leftshoulder$/.test(n))realBones.leftShoulder=o;
    if(/rightshoulder$/.test(n))realBones.rightShoulder=o;
    if(/(?:leftarm|leftupperarm|upperarml)$/.test(n))realBones.leftArm=o;
    if(/(?:rightarm|rightupperarm|upperarmr)$/.test(n))realBones.rightArm=o;
    if(/(?:leftforearm|forearml)$/.test(n))realBones.leftForearm=o;
    if(/(?:rightforearm|forearmr)$/.test(n))realBones.rightForearm=o;
    if(/lefthand$/.test(n))realBones.leftHand=o;
    if(/righthand$/.test(n))realBones.rightHand=o;
    if(/(?:leftupleg|leftthigh|thighl)$/.test(n))realBones.leftThigh=o;
    if(/(?:rightupleg|rightthigh|thighr)$/.test(n))realBones.rightThigh=o;
    if(/(?:leftleg|leftcalf|calfl)$/.test(n))realBones.leftCalf=o;
    if(/(?:rightleg|rightcalf|calfr)$/.test(n))realBones.rightCalf=o;
   }
  });
  hero.add(model);
  realHero=model;
  // Transfere o rifle para o personagem real antes de esconder o rig procedural.
  // Mantém a posição que ele tinha no tronco e deixa a arma visível no modelo GLB.
  weapon.position.y += rig.body.position.y;
  hero.add(weapon);
  weapon.rotation.y = Math.PI;
  rig.body.visible=false;
  // Só escondemos o rig procedural quando o GLB realmente oferece
  // animações de locomoção reconhecíveis. Muitos GLBs carregam sem clips
  // (ou apenas clips de pose), o que deixava o personagem completamente parado.
  if(gltf.animations&&gltf.animations.length){
   realMixer=new THREE.AnimationMixer(model);
   for(const clip of gltf.animations){
    const key=clip.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    realActions[key]=realMixer.clipAction(clip);
   }
  }
  const clipNames=Object.keys(realActions);
  // Um nome de animação não basta: verificamos se os clips realmente
  // animam o tronco/quadril e membros, e se o rig tem ossos essenciais.
  let skinnedMeshes=0,usableSkeletonBones=0;
  model.traverse(o=>{
   if(o.isSkinnedMesh&&o.skeleton){
    skinnedMeshes++;
    usableSkeletonBones=Math.max(usableSkeletonBones,o.skeleton.bones.length);
   }
  });
  const requiredBones=['hips','spine','head','leftArm','rightArm','leftForearm','rightForearm','leftThigh','rightThigh','leftCalf','rightCalf'];
  const completeHumanoid=requiredBones.every(k=>!!realBones[k]);
  const clipHasBodyTracks=clip=>clip.tracks.some(t=>/hips|pelvis|spine|upleg|thigh|leg|calf/i.test(t.name));
  const hasWalk=clipNames.some(k=>/walk|walking|locomotion|run|running|sprint/.test(k)&&clipHasBodyTracks(gltf.animations.find(c=>c.name.toLowerCase().replace(/[^a-z0-9]/g,'')===k)));
  const hasIdle=clipNames.some(k=>/idle|stand|breath/.test(k)&&clipHasBodyTracks(gltf.animations.find(c=>c.name.toLowerCase().replace(/[^a-z0-9]/g,'')===k)));
  const hasDeformableBody=skinnedMeshes>0&&usableSkeletonBones>=18&&completeHumanoid;
  if(hasWalk&&hasIdle&&hasDeformableBody){
   rig.body.visible=false;
   playRealAnimation('idle');
   $('message').textContent='PERSONAGEM 3D ESQUELÉTICO ANIMADO';
  }else{
   // O GLB só é usado se trouxer ao menos repouso e locomoção. Caso contrário,
   // o rig procedural assume para que o personagem nunca fique congelado.
   model.visible=false;
   if(weapon.parent!==rig.body){
    weapon.parent?.remove(weapon);
    rig.body.add(weapon);
   }
   weapon.position.set(.28,.50,-.28);
   weapon.rotation.set(0,0,0);
   rig.body.visible=true;
   realHero=null;
   realMixer=null;
   realActions={};
   activeRealAction='';
   $('message').textContent='PERSONAGEM ANIMADO — RIG PROCEDURAL';
  }
 },undefined,error=>{
  console.error('Falha ao carregar personagem GLB:',error);
  $('message').textContent='Falha ao carregar o modelo humano 3D';
 });
}
function playRealAnimation(name){
 if(!realMixer)return;
 const keys=Object.keys(realActions);
 const patterns=name==='run'?['run','running','sprint']:name==='walk'?['walk','walking','locomotion']:name==='idle'?['idle','stand','breath','mixamo.com']:['idle'];
 let key=keys.find(k=>patterns.some(p=>k.includes(p)));
 if(!key&&name==='walk')key=keys.find(k=>k.includes('run')||k.includes('running'));
 if(!key&&name==='run')key=keys.find(k=>k.includes('walk')||k.includes('walking'));
 if(key===activeRealAction)return;
 if(!key){
  if(realActions[activeRealAction])realActions[activeRealAction].fadeOut(.18);
  activeRealAction='';
  return;
 }
 const next=realActions[key];if(!next)return;
 next.enabled=true;next.setEffectiveTimeScale(name==='run'?1.12:1);
 next.reset().fadeIn(.22).play();
 if(realActions[activeRealAction])realActions[activeRealAction].fadeOut(.22);
 activeRealAction=key;
}
function clearRealPoseOffsets(){
 for(const entry of realPoseOffsets)entry.bone.quaternion.multiply(entry.offset.clone().invert());
 realPoseOffsets.length=0;
}
function offsetRealBone(bone,x=0,y=0,z=0){
 if(!bone)return;
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ'));
 bone.quaternion.multiply(q);
 realPoseOffsets.push({bone,offset:q});
}
function applyRealCharacterPose(dt,crouch,prone,aim,moveAmount,runAmount){
 if(!realHero)return;
 realCrouchBlend=THREE.MathUtils.damp(realCrouchBlend,crouch?1:0,9,dt);
 realProneBlend=THREE.MathUtils.damp(realProneBlend,prone?1:0,8,dt);
 realAimBlend=THREE.MathUtils.damp(realAimBlend,aim?1:0,10,dt);
 const c=realCrouchBlend,p=realProneBlend,a=realAimBlend;
 // Additive pose layer is applied after the GLTF locomotion mixer, so
 // crouch/prone/aim affect the visible humanoid instead of the hidden proxy.
 offsetRealBone(realBones.hips,-.08*c-1.02*p,0,0);
 offsetRealBone(realBones.spine,.13*c+.18*p-.12*a,0,0);
 offsetRealBone(realBones.head,.04*c+.10*p+.08*a,0,0);
 for(const side of ['left','right']){
  const phase=walkT+(side==='left'?0:Math.PI);
  const swing=Math.sin(phase)*moveAmount*(runAmount?.16:.09);
  const thigh=realBones[side+'Thigh'];
  const calf=realBones[side+'Calf'];
  offsetRealBone(thigh,.24*c-.08*p+swing,0,side==='left'?.015:-.015);
  offsetRealBone(calf,-.48*c+.10*p+Math.max(0,-Math.sin(phase))*moveAmount*.18,0,0);
 }
 // Subtle shoulder/forearm adjustments bring the rifle closer to a ready-to-fire stance.
 offsetRealBone(realBones.rightArm,-.18*a-.10*c-.08*p,0,-.10*a);
 offsetRealBone(realBones.leftArm,-.24*a-.08*c-.08*p,0,.08*a);
 offsetRealBone(realBones.rightForearm,-.16*a+.10*c,0,0);
 offsetRealBone(realBones.leftForearm,-.12*a+.10*c,0,0);
 offsetRealBone(realBones.rightShoulder,0,0,-.035*a);
 offsetRealBone(realBones.leftShoulder,0,0,.035*a);
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
 $('reload').addEventListener('pointerdown',e=>{e.preventDefault();if(!reloading&&ammo<30){reloading=true;$('message').textContent='RECARREGANDO';setTimeout(()=>{ammo=30;reloading=false;stats();$('message').textContent='ÁREA DE TREINO'},1450)}});
 let drag=null;renderer.domElement.addEventListener('pointerdown',e=>{if(e.clientX>innerWidth*.38){drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId)}});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;const sensitivity=aim?.0042:.0062;yaw-=dx*sensitivity;pitch=THREE.MathUtils.clamp(pitch+dy*(aim?.0028:.0035),-.72,.42)});
 ['pointerup','pointercancel'].forEach(ev=>renderer.domElement.addEventListener(ev,e=>{if(drag&&e.pointerId===drag.id)drag=null}));
 $('play').addEventListener('click',()=>{$('lobby').style.display='none';started=true});
}
function setPose(p){pose=p;$('poseLabel').textContent='POSTURA: '+(p==='stand'?'EM PÉ':p==='crouch'?'AGACHADO':'DEITADO');$('crouch').classList.toggle('active',p==='crouch');$('prone').classList.toggle('active',p==='prone')}
function stats(){$('ammo').textContent=ammo+' / 90'}
function fireShot(){
 if(reloading||ammo<=0||performance.now()-lastShot<155)return;
 lastShot=performance.now();ammo--;stats();weaponKick=Math.min(1,weaponKick+.72);cameraRecoil=Math.min(.12,cameraRecoil+.035);cameraShake=Math.min(.08,cameraShake+.018);
 muzzleTime=.075;if(muzzleFlash){muzzleFlash.visible=true;muzzleLight.intensity=2.8}
 const origin=camera.position.clone(),direction=new THREE.Vector3();camera.getWorldDirection(direction);
 const ray=new THREE.Raycaster(origin,direction,0,85);const hits=ray.intersectObjects(targets,true);
 if(hits.length){const target=hits[0].object;target.material=mat(0xe5a43a);$('message').textContent='ALVO ATINGIDO!';$('message').classList.add('hit');setTimeout(()=>{$('message').textContent='ÁREA DE TREINO';$('message').classList.remove('hit');target.material=mat(0xd6d1bd)},500)}
}
function update(dt){
 const inputMagnitude=Math.min(1,Math.hypot(moveX,moveY));
 const moving=inputMagnitude>.08;
 const crouch=pose==='crouch',prone=pose==='prone';
 proneBlend=THREE.MathUtils.damp(proneBlend,prone?1:0,7.5,dt);
 const sprinting=run&&!crouch&&!prone&&moving&&stamina>1;
 if(sprinting)stamina=Math.max(0,stamina-22*dt);else stamina=Math.min(100,stamina+14*dt);
 $('stamina').textContent='FÔLEGO '+Math.round(stamina);
 const speed=prone?.62:crouch?1.75:sprinting?6.1:3.15;
 // Aceleração e desaceleração progressivas: evita arrancadas e paradas instantâneas.
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
 const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const inputDir=forward.clone().multiplyScalar(-moveY).add(right.multiplyScalar(moveX));
 if(inputDir.length()>1)inputDir.normalize();
 const targetVX=inputDir.x*speed*inputMagnitude;
 const targetVZ=inputDir.z*speed*inputMagnitude;
 const accel=moving?(sprinting?10:13):18;
 velocityX=THREE.MathUtils.damp(velocityX,targetVX,accel,dt);
 velocityZ=THREE.MathUtils.damp(velocityZ,targetVZ,accel,dt);
 const horizontalSpeed=Math.hypot(velocityX,velocityZ);
 locomotionSpeed=THREE.MathUtils.damp(locomotionSpeed,horizontalSpeed,10,dt);
 const nextX=hero.position.x+velocityX*dt,nextZ=hero.position.z+velocityZ*dt;
 let blocked=false;
 for(const b of worldBlockers){const dx=nextX-b.x,dz=nextZ-b.z,min=b.r+.42;if(dx*dx+dz*dz<min*min){blocked=true;break}}
 if(!blocked){hero.position.x=nextX;hero.position.z=nextZ}else{velocityX*=.18;velocityZ*=.18}
 if(realHero)clearRealPoseOffsets();
 if(realMixer){
  realMixer.update(dt);
  playRealAnimation(horizontalSpeed>.12?(run?'run':'walk'):'idle');
 }
 if(realHero){
  applyRealCharacterPose(dt,crouch,prone,aim,inputMagnitude,sprinting?1:0);
  const bob=horizontalSpeed>.12?Math.abs(Math.sin(walkT*1.7))*.018:Math.sin(walkT*1.2)*.006;
  realHero.position.y=bob;
  realHero.rotation.z=THREE.MathUtils.damp(realHero.rotation.z,THREE.MathUtils.clamp(-velocityX*.018,-.09,.09),8,dt);
 }
 hero.position.x=THREE.MathUtils.clamp(hero.position.x,-34,34);
 hero.position.z=THREE.MathUtils.clamp(hero.position.z,-34,34);
 const actualDir=new THREE.Vector3(velocityX,0,velocityZ);
 const facingYaw=(aim||horizontalSpeed<.12)?yaw:Math.atan2(-actualDir.x,-actualDir.z);
 const yawDelta=Math.atan2(Math.sin(facingYaw-hero.rotation.y),Math.cos(facingYaw-hero.rotation.y));
 hero.rotation.y+=yawDelta*Math.min(1,dt*(aim?12:7.5));
 // Jump arc and grounded recovery.
 if(!grounded){
  velocityY-=17*dt;
  hero.position.y+=velocityY*dt;
  if(hero.position.y<=0){
   hero.position.y=0;velocityY=0;grounded=true;landingBlend=1;
  }
 }
 // A cadência acompanha a velocidade real: menos passos ao andar devagar,
 // mais rápidos na corrida, com ciclo contínuo sem saltos de fase.
 walkT+=dt*(horizontalSpeed>.12?(sprinting?10.5:5.8):1.05);
 const gait=Math.sin(walkT),opposite=Math.sin(walkT+Math.PI);
 const strafe=THREE.MathUtils.clamp(moveX,-1,1);
 const movingBlend=THREE.MathUtils.smoothstep(horizontalSpeed,.04,.8);
 runBlend=THREE.MathUtils.damp(runBlend,sprinting&&horizontalSpeed>.12?1:0,7,dt);
 const jumpBlend=grounded?0:1;
 landingBlend=THREE.MathUtils.damp(landingBlend,0,5.5,dt);
 breathPhase+=dt*(moving?1.2:1.0);
 // Smooth transitions between standing, crouched and prone silhouettes.
 // Deitar em sequência: abaixa o centro de gravidade, leva o peito ao chão
 // e estende o corpo gradualmente, em vez de apenas girar a câmera.
 const proneHeight=THREE.MathUtils.lerp(1.03,.34,proneBlend);
 const lowHeight=THREE.MathUtils.lerp(crouch?.72:1.03,proneHeight,proneBlend);
 rig.body.position.y=THREE.MathUtils.lerp(rig.body.position.y,lowHeight,1-Math.exp(-dt*11));
 const pronePitch=-1.12*proneBlend;
 const forwardLean=THREE.MathUtils.clamp(horizontalSpeed*.018,0,.105);
 const landingCushion=landingBlend*.10;
 rig.body.rotation.x=THREE.MathUtils.lerp(rig.body.rotation.x,pronePitch+(1-proneBlend)*(aim?-.09:0)-forwardLean+landingCushion,1-Math.exp(-dt*9));
 const turnLean=THREE.MathUtils.clamp(-velocityX*.025,-.12,.12);
 rig.body.rotation.z=THREE.MathUtils.lerp(rig.body.rotation.z,aim?-.035*strafe:turnLean-.10*strafe,1-Math.exp(-dt*8));
 rig.head.rotation.x=THREE.MathUtils.lerp(rig.head.rotation.x,prone?.08:aim?-.10: moving?-.025:Math.sin(walkT*1.7)*.012,1-Math.exp(-dt*8));
 rig.head.rotation.y=THREE.MathUtils.lerp(rig.head.rotation.y,aim?0:strafe*.035,1-Math.exp(-dt*7));
 // Alternating stride, knee bend and planted-foot motion.
 rig.legs.forEach(({upper,knee,ankle,side})=>{
  const phase=side===1?gait:opposite;
  const cycle=((walkT/(Math.PI*2)+(side===1?0:.5))%1+1)%1;
  const stance=cycle<.62;
  const stepT=stance?cycle/.62:(cycle-.62)/.38;
  const stride=(sprinting?.48:.34)*inputMagnitude;
  const footTravel=stance?THREE.MathUtils.lerp(-stride*.52,stride*.52,stepT):THREE.MathUtils.lerp(stride*.52,-stride*.52,stepT);
  const footLift=stance?0:Math.sin(stepT*Math.PI)*(sprinting?.17:.115);
  const crawl=moving?Math.sin(walkT*1.35+(side===1?0:Math.PI)):Math.sin(walkT*.65+(side===1?0:Math.PI))*.08;
  const swing=moving?phase*(.48+runBlend*.32):Math.sin(walkT*.5)*.018;
  const proneLeg=side===1?-.12+crawl*.30:-.12-crawl*.30;
  const proneKnee=.42+Math.max(0,crawl)*.22;
  const baseKnee=crouch?.45+Math.max(0,-phase)*.18:moving?Math.max(0,-phase)*(.55+runBlend*.55):.025;
  upper.rotation.x=THREE.MathUtils.lerp(upper.rotation.x,THREE.MathUtils.lerp(THREE.MathUtils.lerp(crouch?swing*.28:swing,-.10-jumpBlend*.42,jumpBlend),proneLeg,proneBlend),1-Math.exp(-dt*12));
  knee.rotation.x=THREE.MathUtils.lerp(knee.rotation.x,THREE.MathUtils.lerp(THREE.MathUtils.lerp(baseKnee, .82*jumpBlend, jumpBlend),proneKnee,proneBlend),1-Math.exp(-dt*12));
  if(ankle){
   ankle.position.z=THREE.MathUtils.damp(ankle.position.z,-.055+footTravel,18,dt);
   ankle.position.y=THREE.MathUtils.damp(ankle.position.y,-.45+footLift*(1-proneBlend),18,dt);
   const toeRoll=stance?(cycle>.48?-.18*((cycle-.48)/.14):0):-.10;
   ankle.rotation.x=THREE.MathUtils.damp(ankle.rotation.x,toeRoll+footLift*-.35,14,dt);
  }
 });
 // Atualiza a posição do rifle antes de resolver o IK, para que as mãos
 // persigam o punho e o guarda-mão na mesma pose deste frame.
 const idleSwayPre=Math.sin(walkT*.72)*.012;
 const aimSwayPre=aim?Math.sin(walkT*1.15)*.008:0;
 weapon.position.y=(aim?1.58:horizontalSpeed>.12?1.54:1.53)+idleSwayPre+aimSwayPre-reloadBlend*.12;
 weapon.position.x=.28+(aim?-.035:0)+Math.sin(walkT*.9)*.006;
  // A pose da arma é resolvida antes dos braços para que o IK siga
 // posição e rotação reais do rifle no mesmo frame.
 weaponKick=THREE.MathUtils.damp(weaponKick,0,aim?13:8,dt);
 reloadBlend=THREE.MathUtils.damp(reloadBlend,reloading?1:0,7,dt);
 weapon.rotation.z=THREE.MathUtils.damp(weapon.rotation.z,aim?-.025*strafe:Math.sin(walkT*.8)*.008,9,dt);
 weapon.rotation.x=THREE.MathUtils.damp(weapon.rotation.x,aim?-.035:proneBlend*.08,10,dt)-weaponKick*.19+reloadBlend*.28;
 weapon.rotation.y=THREE.MathUtils.damp(weapon.rotation.y,Math.sin(walkT*.7)*.012+reloadBlend*.16,8,dt);
// Two-bone procedural IK: each palm is placed at a real grip point on the rifle.
 const downAxis=new THREE.Vector3(0,-1,0);
 rig.arms.forEach(({upper,fore,hand,side})=>{
  const shoulder=new THREE.Vector3(side*THREE.MathUtils.lerp(.46,.42,proneBlend),THREE.MathUtils.lerp(.82,.69,proneBlend),THREE.MathUtils.lerp(0,.02,proneBlend));
  // Pontos de empunhadura são transformados pelo espaço local da arma,
  // respeitando também a rotação aplicada para mirar, recuar e recarregar.
  const grip=weapon.localToWorld(new THREE.Vector3(0,side===1?-.20:-.02,side===1?-.18:-.40));
  rig.body.worldToLocal(grip);
  grip.y+=crouch?-.035:0;
  // Cotovelos mais baixos e abertos no apoio deitado, mantendo as mãos nos punhos.
  grip.y+=proneBlend*.035;
  if(horizontalSpeed>.12){grip.y+=Math.sin(walkT+(side===1?0:Math.PI))*.018}
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
  const counterSwing=aim?0:Math.sin(walkT+(side===1?Math.PI:0))*(.045+runBlend*.035);
  hand.rotation.set((aim?-.13:counterSwing)-jumpBlend*.08,side===1?-.025:.10,side===1?-.10:.06);
 });
 // Respiração, sway de mira, recuo e manipulação durante a recarga.
 const gaitBounce=horizontalSpeed>.12?Math.abs(gait)*(.012+runBlend*.026):0;
 const breathing=Math.sin(breathPhase*1.8)*.009;
 rig.body.position.y+=gaitBounce+breathing-landingBlend*.075;
 rig.head.rotation.z=THREE.MathUtils.damp(rig.head.rotation.z,turnLean*.22,7,dt);
 rig.head.rotation.x=THREE.MathUtils.damp(rig.head.rotation.x,(aim?-.10:0)+breathing*.55,7,dt);
 const idleSway=Math.sin(walkT*.72)*.012;
 const aimSway=aim?Math.sin(walkT*1.15)*.008:0;
 muzzleTime=Math.max(0,muzzleTime-dt);
 if(muzzleFlash&&muzzleTime===0){muzzleFlash.visible=false;muzzleLight.intensity=0}
 // Inclinação do tronco acompanha a direção lateral sem quebrar a mira.
 rig.pelvis.rotation.y=THREE.MathUtils.damp(rig.pelvis.rotation.y,aim?-.025*strafe:0,7,dt);
 if(shoot)fireShot();
 // Câmera de ombro com FOV dinâmico, recuo, colisão e amortecimento.
 cameraRecoil=THREE.MathUtils.damp(cameraRecoil,0,9,dt);
 cameraShake=THREE.MathUtils.damp(cameraShake,0,12,dt);
 const target=hero.position.clone().add(new THREE.Vector3(0,THREE.MathUtils.lerp(crouch?1.48:1.92,.58,proneBlend),0));
 const baseDist=aim?3.15:sprinting?5.15:5.6;
 const dist=THREE.MathUtils.lerp(baseDist,3.85,proneBlend);
 const shoulder=aim?.72:1.18;
 const offset=new THREE.Vector3(Math.sin(yaw)*dist*Math.cos(pitch)+Math.cos(yaw)*shoulder,dist*(.30+Math.sin(-pitch)),Math.cos(yaw)*dist*Math.cos(pitch)-Math.sin(yaw)*shoulder);
 cameraDesired.copy(target).add(offset);
 cameraRay.set(target,offset.clone().normalize());cameraRay.far=dist;
 const cameraHits=cameraRay.intersectObjects(scene.children,true).filter(hit=>{let o=hit.object;while(o){if(o===hero)return false;o=o.parent}return true});
 cameraCurrentDistance=THREE.MathUtils.damp(cameraCurrentDistance,cameraHits.length?Math.max(.9,cameraHits[0].distance-.22):dist,18,dt);
 cameraDesired.copy(target).addScaledVector(offset.normalize(),cameraCurrentDistance);
 camera.position.lerp(cameraDesired,1-Math.exp(-dt*(aim?13:8)));
 camera.position.y+=cameraShake*.22;
 camera.fov=THREE.MathUtils.damp(camera.fov,aim?53:sprinting?68:65,8,dt);camera.updateProjectionMatrix();
 camera.lookAt(target.clone().add(new THREE.Vector3(0,cameraRecoil+cameraShake*.12,0)));
 const cross=$('hud').querySelector('.crosshair');if(cross){const spread=1+Math.min(1,horizontalSpeed/6)+(shoot?.55:0)+(aim?-.45:0);cross.style.transform='translate(-50%,-50%) scale('+Math.max(.65,spread)+')';}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(started)update(dt);renderer.render(scene,camera)}
function resize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))}
window.addEventListener('error',e=>{const box=$('error');box.hidden=false;box.textContent='Erro ao iniciar: '+e.message});
init();