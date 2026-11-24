import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { stepDampedVelocity, solveTwoBoneIK } from './player-rig-math.mjs?v=rig-math-1';

const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9bb9c3);scene.fog=new THREE.Fog(0x9bb9c3,100,310);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,500);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
const mobile=matchMedia('(max-width:800px)').matches||navigator.maxTouchPoints>0;
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.35:2));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
$('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe8f5ff,0x42523c,1.7));
const sun=new THREE.DirectionalLight(0xffe6c2,2.5);sun.position.set(-80,120,60);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1536:3072,mobile?1536:3072);sun.shadow.camera.left=-170;sun.shadow.camera.right=170;sun.shadow.camera.top=170;sun.shadow.camera.bottom=-170;sun.shadow.camera.far=350;scene.add(sun);
const mat=(c,r=.85,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const mats={grass:mat(0x496e3d),road:mat(0x454b4c),line:mat(0xd5c99b),concrete:mat(0x85867c),glass:mat(0x6b9ca5,.22,.2),roof:mat(0x51453d),wood:mat(0x98724e),metal:mat(0x4b5558,.38,.55),leaf:mat(0x285536),leaf2:mat(0x3d7041),sand:mat(0xc4b17d)};
const ground=new THREE.Mesh(new THREE.CircleGeometry(145,128),mats.grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.25;ground.receiveShadow=true;scene.add(ground);
const water=new THREE.Mesh(new THREE.CircleGeometry(210,128),mat(0x2e7184,.28,.12));water.rotation.x=-Math.PI/2;water.position.y=-1.1;scene.add(water);
const world=new THREE.Group();scene.add(world);
const blockers=[],loot=[],bots=[],effects=[],buildings=[],cameraOccluders=[];
function box(parent,w,h,d,material,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function building(x,z,w,d,h,color,type='house'){
 const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
 const wall=mat(color),trim=mat(0xd0c4a5),roof=type==='warehouse'?mat(0x3c4848,.7,.25):mats.roof;
 // Camera collision must detect wall faces from inside buildings too.
 wall.side=THREE.DoubleSide;
 // Walkable shell: floor, four wall runs and a real doorway (front is +Z).
 box(g,w,.16,d,mat(0x8f826b),0,.08,0);
 const t=.34,doorW=Math.min(2.1,w*.24),sideW=(w-doorW)/2;
 const cameraWalls=[];
 cameraWalls.push(box(g,sideW,h,d,wall,-(doorW+sideW)/2,h/2,d/2-t/2));
 cameraWalls.push(box(g,sideW,h,d,wall,(doorW+sideW)/2,h/2,d/2-t/2));
 cameraWalls.push(box(g,doorW,h*.22,t,wall,0,h*.89,d/2));
 cameraWalls.push(box(g,w,h,d*.08,wall,0,h/2,-d/2+d*.04));
 cameraWalls.push(box(g,t,h,d*.9,wall,-w/2+t/2,h/2,0));
 cameraWalls.push(box(g,t,h,d*.9,wall,w/2-t/2,h/2,0));
 // Só paredes entram na colisão da câmera; piso, telhado, janelas e móveis não provocam zoom.
 cameraOccluders.push(...cameraWalls);
 // Roof is raised slightly, leaving a covered, navigable interior.
 const roofMesh=box(g,w+.5,.3,d+.5,roof,0,h+.16,0);
buildings.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,roof:roofMesh});
 // Window frames and glass panels on both side walls.
 for(const side of [-1,1]){
  box(g,.08,h*.25,d*.25,mats.glass,side*(w/2+.045),h*.64,-d*.08);
  box(g,.12,h*.29,d*.28,trim,side*(w/2+.09),h*.64,-d*.08);
 }
 // Interior partition and cover furniture, not blocking the entrance.
 if(w>9){
  box(g,.2,h*.68,d*.32,wall,-w*.22,h*.34,-d*.13);
  box(g,w*.27,1.05,.75,mats.wood,w*.2,.58,-d*.2);
  box(g,1.2,.75,.8,mats.wood,-w*.2,.42,-d*.25);
 }else{
  box(g,1.15,.65,.7,mats.wood,w*.2,.4,-d*.2);
 }
 // Door frame, visible from outside.
 box(g,.16,h*.75,.18,trim,-doorW/2,h*.38,d/2+.08);
 box(g,.16,h*.75,.18,trim,doorW/2,h*.38,d/2+.08);
 // Collision rectangles follow actual walls; the doorway remains passable.
 blockers.push(
  {x:x-w/2,z,zlen:d,axis:'x',minX:x-w/2-t,maxX:x-w/2+t,minZ:z-d/2,maxZ:z+d/2},
  {x:x+w/2,z,zlen:d,axis:'x',minX:x+w/2-t,maxX:x+w/2+t,minZ:z-d/2,maxZ:z+d/2},
  {x,z:z-d/2,axis:'z',minX:x-w/2,maxX:x+w/2,minZ:z-d/2-t,maxZ:z-d/2+t},
  {x:x-doorW/2-sideW/2,z:z+d/2,axis:'z',minX:x-w/2,maxX:x-doorW/2,minZ:z+d/2-t,maxZ:z+d/2+t},
  {x:x+doorW/2+sideW/2,z:z+d/2,axis:'z',minX:x+doorW/2,maxX:x+w/2,minZ:z+d/2-t,maxZ:z+d/2+t}
 );
 return g;
}
const cities=[
 ['PORTO AZUL',-82,-82,0xc5ad83,'coast'],['VALE VERDE',0,-86,0x9baf8c,'village'],['NOVA ESPERANÇA',82,-82,0xb9a18b,'urban'],
 ['PEDRA ALTA',-86,0,0x9e9b91,'industrial'],['CENTRO REAL',0,0,0xc2b49a,'urban'],['JARDIM SOL',84,0,0xb4a07e,'village'],
 ['SERRA NORTE',-82,82,0xb6a78e,'village'],['LAGO CRISTAL',0,84,0xa5b9a5,'coast'],['AEROPORTO SUL',82,82,0xaaa99c,'industrial']
];
function road(x,z,w,d){box(world,w,.07,d,mats.road,x,.015,z);if(w>d){for(let a=-w/2+3;a<w/2;a+=8)box(world,2,.025,.13,mats.line,x+a,.06,z)}else{for(let a=-d/2+3;a<d/2;a+=8)box(world,.13,.025,2,mats.line,x,.06,z+a)}}
road(0,0,13,260);road(0,0,260,13);road(-42,0,8,245);road(42,0,8,245);road(0,-42,245,8);road(0,42,245,8);
function tree(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);world.add(g);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.32*s,2*s,8),mat(0x60452d));trunk.position.y=s;g.add(trunk);for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.SphereGeometry((1.25-i*.14)*s,10,9),i%2?mats.leaf2:mats.leaf);c.position.set((i-1)*.34*s,2.25*s+i*.18*s,0);c.castShadow=true;g.add(c)}}
function makeCities(){
 cities.forEach(([name,cx,cz,color,type],idx)=>{
  const sign=box(world,8,.7,.25,mat(0x243b36),cx,3.7,cz-22);sign.userData.city=name;
  const label=document.createElement('div');label.className='city-label';label.textContent=name;label.style.left='50%';label.style.top='50%';label.dataset.city=name;$('labels').appendChild(label);
  const count=type==='urban'?9:type==='industrial'?7:6;
  for(let i=0;i<count;i++){const a=i*2.399,rad=9+(i%3)*5;const x=cx+Math.cos(a)*rad,z=cz+Math.sin(a)*rad;const isWarehouse=type==='industrial'&&i%3===0;building(x,z,isWarehouse?15:8,isWarehouse?12:7,isWarehouse?6:4.5,color,isWarehouse?'warehouse':'house')}
  if(type==='industrial'){for(let i=0;i<3;i++){const tank=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.3,5,16),mats.metal);tank.position.set(cx-18+i*5,2.5,cz+17);tank.castShadow=true;world.add(tank)}}
  if(type==='coast'){const dock=box(world,5,.5,22,mat(0x806447),cx+23,.2,cz+24);for(let i=0;i<4;i++)box(world,.5,1,.5,mats.wood,cx+21+i*1.3,.5,cz+17)}
  // loot spawn points around buildings
  for(let j=0;j<4;j++)spawnLoot(cx+(Math.random()-.5)*28,cz+(Math.random()-.5)*28);
 });
}
function spawnLoot(x,z){const kind=['RIFLE','MUNIÇÃO','KIT MÉDICO','COLETE','ESCOPETA'][Math.floor(Math.random()*5)];const color=kind==='KIT MÉDICO'?0x55d78a:kind==='COLETE'?0x67b5dc:0xe7bd63;const g=new THREE.Group();g.position.set(x,.45,z);world.add(g);const o=new THREE.Mesh(new THREE.BoxGeometry(.65,.25,.42),mat(color,.42,.25));o.castShadow=true;g.add(o);const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.035,6,20),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75}));ring.rotation.x=Math.PI/2;ring.position.y=-.24;g.add(ring);loot.push({g,kind,active:true})}
function makeWorld(){makeCities();for(let i=0;i<280;i++){const a=Math.random()*Math.PI*2,r=65+Math.random()*77;tree(Math.cos(a)*r,Math.sin(a)*r,.7+Math.random()*.9)}for(let i=0;i<55;i++){const x=(Math.random()-.5)*260,z=(Math.random()-.5)*260;if(Math.abs(x)<58&&Math.abs(z)<58)continue;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.7+Math.random()*1.2,0),mat(0x777d72));rock.position.set(x,.4,z);rock.scale.y=.65;world.add(rock)}}
makeWorld();
// Articulated tactical operator: layered anatomy, separate joints and a two-hand weapon rig.
const hero=new THREE.Group();scene.add(hero);hero.position.set(0,0,10);
const rig={};
const skin=mat(0x98694f),uniform=mat(0x35483b),pants=mat(0x303b35),armor=mat(0x4b5948),black=mat(0x1c2424,.42,.25),cloth=mat(0x66704d),pouch=mat(0x29372d),bootMat=mat(0x202724),helmetMat=mat(0x344437),metalDetail=mat(0x8b927e,.45,.45),glove=mat(0x202724);
function ell(parent,x,y,z,sx,sy,sz,material){const o=new THREE.Mesh(new THREE.SphereGeometry(1,18,14),material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function capsule(parent,r,length,material,x,y,z){const o=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.01,length),5,9),material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
rig.body=new THREE.Group();rig.body.position.y=.96;hero.add(rig.body);
rig.pelvis=new THREE.Group();rig.pelvis.position.y=-.08;rig.body.add(rig.pelvis);
ell(rig.pelvis,0,0,0,.285,.18,.205,pants);
ell(rig.body,0,.27,0,.255,.30,.19,uniform);
ell(rig.body,0,.54,-.005,.355,.31,.205,uniform);
ell(rig.body,0,.55,-.025,.37,.27,.22,armor);
ell(rig.body,0,.28,-.005,.29,.18,.19,cloth);
box(rig.body,.66,.09,.34,black,0,.08,-.015);
for(const side of [-1,1]){
 const strap=box(rig.body,.095,.48,.07,black,side*.23,.55,-.205);strap.rotation.z=-side*.12;
 ell(rig.body,side*.405,.69,-.005,.15,.14,.15,armor);
 ell(rig.body,side*.45,.68,-.015,.12,.12,.12,cloth);
 box(rig.body,.16,.18,.10,cloth,side*.25,.38,-.22);
 box(rig.body,.14,.13,.09,pouch,side*.25,.18,-.22);
 box(rig.body,.12,.12,.10,black,side*.32,.56,-.20);
}
// Neck, face, helmet, eye line and ear protection.
capsule(rig.body,.095,.16,skin,0,.79,0);
rig.head=new THREE.Group();rig.head.position.set(0,.84,0);rig.body.add(rig.head);
ell(rig.head,0,.14,-.005,.18,.22,.17,skin);
ell(rig.head,0,.045,-.025,.145,.10,.15,skin);
ell(rig.head,0,.32,.005,.205,.145,.20,helmetMat);
ell(rig.head,0,.39,-.005,.19,.09,.19,helmetMat);
box(rig.head,.38,.045,.27,black,0,.28,-.015);
box(rig.head,.31,.045,.06,helmetMat,0,.20,-.16);
for(const side of [-1,1]){
 ell(rig.head,side*.18,.12,0,.045,.065,.05,skin);
 ell(rig.head,side*.18,.13,-.005,.05,.07,.045,armor);
 ell(rig.head,side*.068,.16,-.157,.028,.014,.012,black);
 ell(rig.head,side*.068,.19,-.16,.045,.012,.012,skin);
}
// Modular plate carrier, radio, straps, pouches, backpack and belt.
box(rig.body,.42,.40,.095,armor,0,.48,-.205);
box(rig.body,.28,.22,.035,cloth,0,.51,-.262);
box(rig.body,.075,.34,.025,black,0,.48,-.29);
for(let i=0;i<3;i++){
 box(rig.body,.115,.13,.045,pouch,-.21+i*.21,.48,-.278);
 box(rig.body,.10,.018,.05,metalDetail,-.21+i*.21,.55,-.305);
}
box(rig.body,.30,.42,.18,pouch,0,.48,.22);
box(rig.body,.27,.10,.19,cloth,0,.72,.22);
for(const side of [-1,1])box(rig.body,.05,.43,.04,cloth,side*.15,.49,.12);
box(rig.body,.48,.085,.28,black,0,.055,0);
box(rig.body,.11,.08,.035,metalDetail,0,.055,-.15);
box(rig.body,.13,.25,.13,pouch,.34,.015,.08);
box(rig.body,.12,.22,.12,pouch,-.34,.015,.08);
// Articulated legs: hip, thigh, knee, shin and ankle/boot pivots.
rig.legs=[];
for(const side of [-1,1]){
 const upper=new THREE.Group();upper.position.set(side*.205,-.13,0);rig.body.add(upper);
 capsule(upper,.135,.32,pants,0,-.22,0);
 ell(upper,0,-.42,-.005,.145,.13,.14,pants);
 ell(upper,0,-.47,-.09,.13,.11,.055,armor);
 const knee=new THREE.Group();knee.position.set(0,-.47,0);upper.add(knee);
 capsule(knee,.105,.29,pants,0,-.17,.015);
 ell(knee,0,-.08,-.12,.115,.11,.06,armor);
 box(knee,.20,.13,.06,cloth,0,-.11,-.15);
 const ankle=new THREE.Group();ankle.position.set(0,-.39,-.025);knee.add(ankle);
 capsule(ankle,.09,.12,pants,0,-.035,0);
 box(ankle,.23,.14,.34,bootMat,0,-.105,-.10);
 box(ankle,.235,.04,.32,black,0,-.18,-.10);
 box(ankle,.11,.045,.10,cloth,0,-.025,-.25);
 rig.legs.push({upper,knee,ankle,side});
}
// Two independently articulated arm chains. IK drives the palms to the rifle grips.
rig.arms=[];
for(const side of [-1,1]){
 ell(rig.body,side*.43,.70,0,.15,.15,.15,armor);
 const upper=new THREE.Group();rig.body.add(upper);
 capsule(upper,.112,.29,uniform,0,-.22,0);
 ell(upper,0,-.39,-.015,.115,.13,.11,armor);
 const fore=new THREE.Group();rig.body.add(fore);
 capsule(fore,.092,.27,uniform,0,-.21,0);
 ell(fore,0,-.39,-.01,.095,.10,.09,cloth);
 const hand=new THREE.Group();fore.add(hand);
 ell(hand,0,-.045,-.025,.075,.09,.07,glove);
 for(let finger=0;finger<4;finger++)capsule(hand,.016,.05,glove,-.045+finger*.03,-.11,-.07);
 ell(hand,side*.07,-.07,-.035,.025,.055,.025,glove);
 rig.arms.push({upper,fore,hand,side});
}
// Rifle receiver, optic, handguard, barrel, magazine and muzzle device.
const rifle=new THREE.Group();rifle.position.set(.28,.50,-.28);rig.body.add(rifle);
box(rifle,.145,.14,.82,black,0,0,-.20);
box(rifle,.09,.075,.58,mats.metal,0,.015,-.88);
box(rifle,.12,.12,.30,armor,0,0,.36);
box(rifle,.105,.26,.15,black,0,-.18,-.22);
box(rifle,.055,.065,.14,metalDetail,0,.11,-.55);
box(rifle,.10,.09,.16,black,0,.14,-.18);
box(rifle,.045,.16,.07,black,0,.20,-.50);
const magazine=new THREE.Group();magazine.position.set(0,-.18,-.20);rifle.add(magazine);
box(magazine,.105,.27,.13,black,0,-.02,0);
for(let i=0;i<4;i++)box(magazine,.108,.012,.135,metalDetail,0,-.11+i*.06,0);
const spareMagazine=new THREE.Group();spareMagazine.position.set(0,-.43,.10);spareMagazine.visible=false;rifle.add(spareMagazine);
box(spareMagazine,.105,.27,.13,black,0,-.02,0);
const muzzle=new THREE.PointLight(0xffb34f,0,7);muzzle.position.set(0,0,-1.18);rifle.add(muzzle);
const flash=new THREE.Mesh(new THREE.ConeGeometry(.12,.38,8),new THREE.MeshBasicMaterial({color:0xffc45d}));flash.rotation.x=-Math.PI/2;flash.position.set(0,0,-1.40);flash.visible=false;rifle.add(flash);
// Sidearm with a distinct slide, barrel and grip.
const pistol=new THREE.Group();pistol.position.set(.27,.47,-.23);pistol.visible=false;rig.body.add(pistol);
box(pistol,.15,.15,.40,black,0,0,-.12);
box(pistol,.095,.07,.22,mats.metal,0,.015,-.42);
box(pistol,.12,.25,.14,black,0,-.16,.025);
box(pistol,.10,.035,.16,metalDetail,0,.095,-.18);
const pistolMagazine=new THREE.Group();pistolMagazine.position.set(0,-.16,.03);pistol.add(pistolMagazine);
box(pistolMagazine,.09,.22,.12,black,0,-.02,0);
const pistolSpareMagazine=new THREE.Group();pistolSpareMagazine.position.set(0,-.34,.10);pistolSpareMagazine.visible=false;pistol.add(pistolSpareMagazine);
box(pistolSpareMagazine,.09,.22,.12,black,0,-.02,0);
const pistolMuzzle=new THREE.PointLight(0xffb34f,0,4);pistolMuzzle.position.set(0,0,-.54);pistol.add(pistolMuzzle);
const pistolFlash=new THREE.Mesh(new THREE.ConeGeometry(.085,.24,8),new THREE.MeshBasicMaterial({color:0xffc45d}));pistolFlash.rotation.x=-Math.PI/2;pistolFlash.position.set(0,0,-.62);pistolFlash.visible=false;pistol.add(pistolFlash);
let activeWeapon='RIFLE',weaponKick=0,reloadBlend=0,muzzleTime=0,reloadElapsed=0,reloadProgress=0,reloadCommitted=false;
const downAxis=new THREE.Vector3(0,-1,0);
function switchWeapon(){
 if(reloading)return;
 ammoByWeapon[activeWeapon]=ammo;reserveByWeapon[activeWeapon]=reserve;
 activeWeapon=activeWeapon==='RIFLE'?'PISTOLA':'RIFLE';
 ammo=ammoByWeapon[activeWeapon];reserve=reserveByWeapon[activeWeapon];
 rifle.visible=activeWeapon==='RIFLE';pistol.visible=activeWeapon==='PISTOLA';
 updateHud();setMsg('ARMA: '+activeWeapon);sound(340,.06,'triangle',.02);
}
// Optional original GLB slot. The repository currently keeps the detailed local rig as fallback.
let soldierModel=null,soldierBones={},soldierRest={},soldierLoadState='fallback';
async function loadSoldierModel(){
 try{
  const {GLTFLoader}=await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
  const gltfLoader=new GLTFLoader();
  gltfLoader.load('./assets/military-male-03.glb',gltf=>{
  const model=gltf.scene;model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  if(size.y<.01){soldierLoadState='fallback';return;}
  const scale=1.82/size.y;model.scale.setScalar(scale);
  model.position.set(-bounds.getCenter(new THREE.Vector3()).x*scale,-bounds.min.y*scale,-bounds.getCenter(new THREE.Vector3()).z*scale);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.side=THREE.FrontSide;o.material.roughness=Math.max(.5,o.material.roughness??.8)}}if(o.isBone)soldierRest[o.name]=o.rotation.clone()});
  const bone=(name)=>model.getObjectByName('Bip01 '+name);
  soldierBones={pelvis:bone('Pelvis'),spine:bone('Spine'),spine1:bone('Spine1'),spine2:bone('Spine2'),head:bone('Head'),rightUpperArm:bone('R UpperArm'),leftUpperArm:bone('L UpperArm'),rightForearm:bone('R Forearm'),leftForearm:bone('L Forearm'),rightHand:bone('R Hand'),leftHand:bone('L Hand'),rightThigh:bone('R Thigh'),leftThigh:bone('L Thigh'),rightCalf:bone('R Calf'),leftCalf:bone('L Calf')};
  const required=['pelvis','spine','head','rightUpperArm','leftUpperArm','rightForearm','leftForearm','rightHand','leftHand','rightThigh','leftThigh','rightCalf','leftCalf'];
  if(!required.every(k=>soldierBones[k])){soldierLoadState='fallback';soldierBones={};soldierRest={};return;}
  hero.add(model);soldierModel=model;
  rig.body.visible=false;
  rifle.removeFromParent();pistol.removeFromParent();
  soldierBones.rightHand.add(rifle,pistol);
  rifle.position.set(.015,-.035,.045);rifle.rotation.set(0,Math.PI,0);rifle.scale.setScalar(.72);
  pistol.position.set(.015,-.025,.045);pistol.rotation.set(0,Math.PI,0);pistol.scale.setScalar(.8);
  soldierLoadState='loaded';setMsg('SOLDADO 3D ORIGINAL CARREGADO');
  },undefined,error=>{soldierLoadState='fallback';console.info('GLB militar opcional ausente; rig tático local ativo.',error)});
 }catch(error){soldierLoadState='fallback';console.info('GLTFLoader opcional não carregado.',error)}
}
const ENABLE_EXTERNAL_MILITARY_GLB=false; // Ativar após incluir assets/military-male-03.glb no repositório.
if(ENABLE_EXTERNAL_MILITARY_GLB)loadSoldierModel();
let yaw=0,pitch=-.16,mx=0,my=0,run=false,aim=false,pose='stand',health=100,ammo=30,reserve=120,shooting=false,lastShot=0,reloading=false,gameStarted=false,score=0;
const weaponConfigs={RIFLE:{capacity:30,rate:115,damage:34},PISTOLA:{capacity:15,rate:220,damage:22}};
const ammoByWeapon={RIFLE:30,PISTOLA:15},reserveByWeapon={RIFLE:120,PISTOLA:60};
const ray=new THREE.Raycaster(),tmp=new THREE.Vector3(),clock=new THREE.Clock();
function spawnBots(){
 for(let i=0;i<18;i++){
  const g=new THREE.Group(),a=Math.random()*Math.PI*2,r=35+Math.random()*90;
  g.position.set(Math.cos(a)*r,0,Math.sin(a)*r);
  const uniformBot=mat(0x59624a),pantsBot=mat(0x303a35),skinBot=mat(0x986d55),gearBot=mat(0x303b35),metalBot=mat(0x30383a,.5,.35);
  const torsoBot=new THREE.Group();torsoBot.position.y=1.05;g.add(torsoBot);
  const chest=new THREE.Mesh(new THREE.CapsuleGeometry(.29,.52,5,9),uniformBot);chest.position.y=.05;chest.castShadow=true;torsoBot.add(chest);
  const vest=new THREE.Mesh(new THREE.BoxGeometry(.48,.48,.27),gearBot);vest.position.set(0,.04,.17);torsoBot.add(vest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.205,14,12),skinBot);head.position.set(0,.57,0);head.castShadow=true;torsoBot.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.225,14,8,0,Math.PI*2,0,Math.PI*.58),gearBot);helmet.position.set(0,.64,0);torsoBot.add(helmet);
  const arms=[],legs=[];
  for(const side of [-1,1]){
   const arm=new THREE.Group();arm.position.set(side*.34,.28,-.01);torsoBot.add(arm);
   const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.27,4,7),uniformBot);upper.position.y=-.17;arm.add(upper);
   const fore=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.25,4,7),skinBot);fore.position.set(0,-.42,-.035);arm.add(fore);
   arms.push({pivot:arm,side});
   const leg=new THREE.Group();leg.position.set(side*.16,-.28,0);g.add(leg);
   const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.34,4,7),pantsBot);thigh.position.y=-.2;leg.add(thigh);
   const boot=new THREE.Mesh(new THREE.BoxGeometry(.2,.13,.34),metalBot);boot.position.set(0,-.43,-.07);leg.add(boot);
   legs.push({pivot:leg,side});
  }
  const weapon=new THREE.Group();weapon.position.set(.22,.13,-.16);torsoBot.add(weapon);
  const barrel=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.72),metalBot);barrel.position.z=-.34;weapon.add(barrel);
  const stock=new THREE.Mesh(new THREE.BoxGeometry(.13,.16,.24),gearBot);stock.position.z=.12;weapon.add(stock);
  world.add(g);bots.push({g,hp:100,alive:true,shot:0,torsoBot,arms,legs,weapon,phase:Math.random()*6.28,hit:0});
 }
}
spawnBots();
function setMsg(s){$('message').textContent=s}
function updateHud(){$('health').textContent='VIDA '+Math.max(0,Math.round(health));$('ammo').textContent=ammo+' / '+reserve;$('kills').textContent='ELIMINAÇÕES '+score;$('poseLabel').textContent='POSTURA: '+(pose==='prone'?'DEITADO':pose==='crouch'?'AGACHADO':'EM PÉ')}
function collidesAt(x,z){return blockers.some(b=>x>b.minX-.32&&x<b.maxX+.32&&z>b.minZ-.32&&z<b.maxZ+.32)}
let jumpVelocity=0,walkPhase=0,crouchBlend=0,proneBlend=0,aimBlend=0;
const playerVelocity=new THREE.Vector3(),moveTarget=new THREE.Vector3();
let airborne=false,landSquash=0,lastMoveDirection=new THREE.Vector3();
function move(dt){
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const input=forward.clone().multiplyScalar(-my).addScaledVector(right,mx);
 if(input.lengthSq()>1)input.normalize();
 const grounded=hero.position.y<=.001&&jumpVelocity<=0;
 const postureFactor=pose==='crouch'?.52:pose==='prone'?.2:1;
 const sprintFactor=run&&pose==='stand'&&!aim?1.72:1;
 const maxSpeed=4.15*postureFactor*sprintFactor;
 moveTarget.copy(input).multiplyScalar(maxSpeed);
 const velocity=stepDampedVelocity(playerVelocity.x,playerVelocity.z,moveTarget.x,moveTarget.z,grounded?(input.lengthSq()>.001?19:23):7.5,dt);
 playerVelocity.set(velocity.x,0,velocity.z);
 const speed=Math.hypot(playerVelocity.x,playerVelocity.z);
 if(speed>.08){
  const nx=THREE.MathUtils.clamp(hero.position.x+playerVelocity.x*dt,-137,137);
  const nz=THREE.MathUtils.clamp(hero.position.z+playerVelocity.z*dt,-137,137);
  if(!collidesAt(nx,hero.position.z))hero.position.x=nx;else playerVelocity.x=0;
  if(!collidesAt(hero.position.x,nz))hero.position.z=nz;else playerVelocity.z=0;
  lastMoveDirection.set(playerVelocity.x,0,playerVelocity.z).normalize();
 }
 const moving=speed>.12;
 const facingYaw=aim?yaw:moving?Math.atan2(-lastMoveDirection.x,-lastMoveDirection.z):yaw;
 const angleDelta=Math.atan2(Math.sin(facingYaw-hero.rotation.y),Math.cos(facingYaw-hero.rotation.y));
 hero.rotation.y+=angleDelta*(1-Math.exp(-dt*(aim?12:8)));
 walkPhase+=dt*(moving?(run&&pose==='stand'&&!aim?10.5:5.8):1.05);
 if(hero.position.y>0||jumpVelocity>0){
  airborne=true;jumpVelocity-=19.5*dt;
  hero.position.y=Math.max(0,hero.position.y+jumpVelocity*dt);
  if(hero.position.y===0){jumpVelocity=0;airborne=false;landSquash=-.055}
 }else airborne=false;
 landSquash=THREE.MathUtils.damp(landSquash,0,18,dt);
}
function smooth01(v){const t=THREE.MathUtils.clamp(v,0,1);return t*t*(3-2*t)}
function solveProceduralArm(arm,targetLocal,proneAmount,aimAmount){
 const shoulder=new THREE.Vector3(arm.side*.43,.70,0);
 const pole=new THREE.Vector3(arm.side*.88,-.12,.48).lerp(new THREE.Vector3(arm.side*1.05,-.28,.18),proneAmount);
 const result=solveTwoBoneIK(shoulder.toArray(),targetLocal.toArray(),pole.toArray(),.52,.46);
 const elbow=new THREE.Vector3(...result.elbow);
 const upperDir=elbow.clone().sub(shoulder).normalize();
 const foreDir=targetLocal.clone().sub(elbow).normalize();
 arm.upper.position.copy(shoulder);
 arm.upper.quaternion.setFromUnitVectors(downAxis,upperDir);
 arm.fore.position.copy(elbow);
 arm.fore.quaternion.setFromUnitVectors(downAxis,foreDir);
 arm.hand.position.set(0,-.46,0);
 arm.hand.rotation.set(-.10*aimAmount,arm.side*.025,arm.side*-.04);
}
function relaxProceduralArm(arm,phase){
 const shoulder=new THREE.Vector3(arm.side*.43,.70,0);
 arm.upper.position.copy(shoulder);
 arm.upper.quaternion.setFromEuler(new THREE.Euler(.12+Math.sin(phase)*.025,0,arm.side*.16));
 const elbow=shoulder.clone().add(new THREE.Vector3(arm.side*.05,-.31,.04));
 arm.fore.position.copy(elbow);
 arm.fore.quaternion.setFromEuler(new THREE.Euler(-.48,0,arm.side*.05));
 arm.hand.position.set(0,-.46,0);
}
function solveBoneArmIK(upper,lower,hand,targetWorld){
 if(!upper||!lower||!hand)return;
 const rotateToward=(joint,end)=>{
  soldierModel.updateMatrixWorld(true);
  const jointPos=joint.getWorldPosition(new THREE.Vector3());
  const endPos=end.getWorldPosition(new THREE.Vector3());
  const from=endPos.sub(jointPos),to=targetWorld.clone().sub(jointPos);
  if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)return;
  const delta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
  const desiredWorld=delta.multiply(joint.getWorldQuaternion(new THREE.Quaternion()));
  const parentWorld=joint.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  joint.quaternion.copy(parentWorld.multiply(desiredWorld));
 };
 for(let i=0;i<7;i++){rotateToward(lower,hand);rotateToward(upper,hand)}
 soldierModel.updateMatrixWorld(true);
}
function animateRealSoldierRig(dt,speed,sprinting){
 const phase=walkPhase,stride=speed>.12?Math.sin(phase)*(sprinting?.34:.20):0;
 const idle=Math.sin(performance.now()*.002)*.012;
 const apply=(name,x=0,y=0,z=0)=>{const key='Bip01 '+name,b=soldierModel.getObjectByName(key),r=soldierRest[key];if(b&&r)b.rotation.set(r.x+x,r.y+y,r.z+z)};
 apply('Pelvis',-1.08*proneBlend+idle*.25);
 apply('Spine',-.10*crouchBlend-.18*proneBlend-.10*aimBlend);
 apply('Spine1',-.08*crouchBlend-.12*proneBlend-.08*aimBlend);
 apply('Spine2',-.04*proneBlend-.06*aimBlend-weaponKick*.10);
 apply('Head',-.05*aimBlend-idle);
 apply('R UpperArm',-.48-.16*aimBlend+stride*.15);
 apply('R Forearm',-.34-.10*aimBlend-weaponKick*.08);
 apply('L UpperArm',-.50-.18*aimBlend-stride*.15);
 apply('L Forearm',-.38-.10*aimBlend);
 apply('L Thigh',stride*(1-proneBlend));
 apply('R Thigh',-stride*(1-proneBlend));
 apply('L Calf',Math.max(0,-stride)*.55);
 apply('R Calf',Math.max(0,stride)*.55);
 soldierModel.updateMatrixWorld(true);
 if(activeWeapon==='RIFLE'&&rifle.visible){
  let target=rifle.localToWorld(new THREE.Vector3(0,-.105,-.43));
  if(reloading){
   const mag=rifle.localToWorld(new THREE.Vector3(-.06,-.32,-.20));
   const pouchPoint=soldierModel.localToWorld(new THREE.Vector3(-.28,.10,.08));
   if(reloadProgress<.24)target.lerp(mag,smooth01(reloadProgress/.24));
   else if(reloadProgress<.55)target.lerpVectors(mag,pouchPoint,smooth01((reloadProgress-.24)/.31));
   else if(reloadProgress<.82)target.lerpVectors(pouchPoint,mag,smooth01((reloadProgress-.55)/.27));
   else target.lerpVectors(mag,rifle.localToWorld(new THREE.Vector3(0,-.105,-.43)),smooth01((reloadProgress-.82)/.18));
  }
  solveBoneArmIK(soldierBones.leftUpperArm,soldierBones.leftForearm,soldierBones.leftHand,target);
 }else if(reloading&&activeWeapon==='PISTOLA'&&pistol.visible){
  const target=pistol.localToWorld(new THREE.Vector3(0,-.25,.03));
  solveBoneArmIK(soldierBones.leftUpperArm,soldierBones.leftForearm,soldierBones.leftHand,target);
 }
 rifle.rotation.x=pitch*.62-weaponKick*.16+reloadBlend*.08;
 pistol.rotation.x=pitch*.62-weaponKick*.20;
}
function animateProceduralRig(dt,speed,sprinting){
 const moving=speed>.12,phase=walkPhase,strafe=THREE.MathUtils.clamp(mx,-1,1);
 const breathing=Math.sin(performance.now()*.0018)*.009;
 const landing=landSquash;
 rig.body.position.y=THREE.MathUtils.lerp(1.03,.72,crouchBlend);
 rig.body.position.y=THREE.MathUtils.lerp(rig.body.position.y,.36,proneBlend)+breathing+landing;
 const forwardLean=THREE.MathUtils.clamp(speed*.018,0,.10);
 rig.body.rotation.x=THREE.MathUtils.lerp(rig.body.rotation.x,-.12*crouchBlend-1.10*proneBlend-forwardLean+landing*.7,1-Math.exp(-dt*9));
 rig.body.rotation.z=THREE.MathUtils.lerp(rig.body.rotation.z,aim?-.035*strafe:THREE.MathUtils.clamp(-playerVelocity.x*.025,-.12,.12)-.08*strafe,1-Math.exp(-dt*8));
 rig.pelvis.rotation.y=THREE.MathUtils.damp(rig.pelvis.rotation.y,aim?-.025*strafe:0,7,dt);
 rig.head.rotation.x=THREE.MathUtils.damp(rig.head.rotation.x,(aim?-.10:0)+breathing*.55,7,dt);
 rig.head.rotation.y=THREE.MathUtils.damp(rig.head.rotation.y,aim?0:strafe*.035,7,dt);
 rig.head.rotation.z=THREE.MathUtils.damp(rig.head.rotation.z,THREE.MathUtils.clamp(-playerVelocity.x*.012,-.07,.07),7,dt);
 rig.legs.forEach(({upper,knee,ankle,side})=>{
  const phaseSide=phase+(side===1?0:Math.PI),cycle=((phaseSide/(Math.PI*2))%1+1)%1;
  const stance=cycle<.62,stepT=stance?cycle/.62:(cycle-.62)/.38;
  const strideLength=(sprinting?.42:.29)*Math.min(1.2,speed/3.2);
  const footTravel=stance?THREE.MathUtils.lerp(-strideLength*.5,strideLength*.5,stepT):THREE.MathUtils.lerp(strideLength*.5,-strideLength*.5,stepT);
  const footLift=stance?0:Math.sin(stepT*Math.PI)*(sprinting?.15:.10);
  const swing=moving?Math.sin(phaseSide)*(.34+(sprinting?.18:0)):Math.sin(phaseSide*.5)*.015;
  const crawl=Math.sin(phase*1.25+(side===1?0:Math.PI));
  const upperTarget=THREE.MathUtils.lerp(swing*(1-proneBlend),-.10+crawl*.28,proneBlend)-crouchBlend*.08;
  const kneeTarget=THREE.MathUtils.lerp(moving?Math.max(0,-Math.sin(phaseSide))*(sprinting?.85:.58):.025,.40+Math.max(0,crawl)*.18,proneBlend)+crouchBlend*.22;
  upper.rotation.x=THREE.MathUtils.damp(upper.rotation.x,upperTarget,12,dt);
  knee.rotation.x=THREE.MathUtils.damp(knee.rotation.x,kneeTarget,12,dt);
  ankle.position.z=THREE.MathUtils.damp(ankle.position.z,-.025+footTravel,18,dt);
  ankle.position.y=THREE.MathUtils.damp(ankle.position.y,-.39+footLift*(1-proneBlend),18,dt);
  ankle.rotation.x=THREE.MathUtils.damp(ankle.rotation.x,(stance&&cycle>.48?-.12:0)-footLift*.25,14,dt);
 });
 const idleSway=Math.sin(phase*.72)*.012,aimSway=aim?Math.sin(phase*1.15)*.008:0;
 rifle.position.x=.28+(aim?-.035:0)+Math.sin(phase*.9)*.006;
 rifle.position.y=.50+(aim?.055:0)+idleSway+aimSway-reloadBlend*.07;
 rifle.position.z=-.28+weaponKick*.045;
 rifle.rotation.z=THREE.MathUtils.damp(rifle.rotation.z,aim?-.025*strafe:idleSway*.65,9,dt);
 rifle.rotation.x=THREE.MathUtils.damp(rifle.rotation.x,(aim?-.035:proneBlend*.08)+pitch*.62,10,dt)-weaponKick*.19+reloadBlend*.22;
 rifle.rotation.y=THREE.MathUtils.damp(rifle.rotation.y,Math.sin(phase*.7)*.012+reloadBlend*.12,8,dt);
 pistol.position.set(.28,.47+(aim?.035:0)+idleSway,-.23+weaponKick*.035);
 pistol.rotation.x=THREE.MathUtils.damp(pistol.rotation.x,(aim?-.05:0)+pitch*.62,10,dt)-weaponKick*.2;
 rifle.visible=activeWeapon==='RIFLE';pistol.visible=activeWeapon==='PISTOLA';
 magazine.position.y=-.18-(reloadProgress<.45?smooth01(reloadProgress/.45)*.20:0);
 magazine.visible=reloadProgress<.45||reloadProgress>.82;
 spareMagazine.visible=reloadProgress>=.40&&reloadProgress<=.82;
 spareMagazine.position.set(0,THREE.MathUtils.lerp(-.43,-.18,smooth01((reloadProgress-.40)/.46)),.10);
 pistolMagazine.position.y=-.16-(activeWeapon==='PISTOLA'&&reloading&&reloadProgress<.45?smooth01(reloadProgress/.45)*.15:0);
 pistolMagazine.visible=reloadProgress<.45||reloadProgress>.82;
 pistolSpareMagazine.visible=activeWeapon==='PISTOLA'&&reloadProgress>=.40&&reloadProgress<=.82;
 pistolSpareMagazine.position.set(0,THREE.MathUtils.lerp(-.34,-.16,smooth01((reloadProgress-.40)/.42)),.10);
 rig.body.updateMatrixWorld(true);
 const rightArm=rig.arms.find(a=>a.side===1),leftArm=rig.arms.find(a=>a.side===-1);
 if(activeWeapon==='RIFLE'){
  const rightWorld=rifle.localToWorld(new THREE.Vector3(0,-.20,-.18));
  const leftWorld=rifle.localToWorld(new THREE.Vector3(0,-.02,-.40));
  const rightLocal=rig.body.worldToLocal(rightWorld.clone());
  let leftLocal=rig.body.worldToLocal(leftWorld.clone());
  if(reloading){
   const magWorld=rifle.localToWorld(new THREE.Vector3(-.06,-.32,-.20));
   const pouchWorld=rig.body.localToWorld(new THREE.Vector3(-.28,.10,.10));
   const magLocal=rig.body.worldToLocal(magWorld.clone()),pouchLocal=rig.body.worldToLocal(pouchWorld.clone());
   if(reloadProgress<.24)leftLocal.lerpVectors(leftLocal,magLocal,smooth01(reloadProgress/.24));
   else if(reloadProgress<.55)leftLocal.lerpVectors(magLocal,pouchLocal,smooth01((reloadProgress-.24)/.31));
   else if(reloadProgress<.82)leftLocal.lerpVectors(pouchLocal,magLocal,smooth01((reloadProgress-.55)/.27));
   else leftLocal.lerpVectors(magLocal,rig.body.worldToLocal(leftWorld.clone()),smooth01((reloadProgress-.82)/.18));
  }
  solveProceduralArm(rightArm,rightLocal,proneBlend,aimBlend);
  solveProceduralArm(leftArm,leftLocal,proneBlend,aimBlend);
 }else{
  const rightWorld=pistol.localToWorld(new THREE.Vector3(0,-.16,.02));
  solveProceduralArm(rightArm,rig.body.worldToLocal(rightWorld.clone()),proneBlend,aimBlend);
  if(reloading){
   const leftWorld=pistol.localToWorld(new THREE.Vector3(0,-.25,.03));
   solveProceduralArm(leftArm,rig.body.worldToLocal(leftWorld.clone()),proneBlend,aimBlend);
  }else relaxProceduralArm(leftArm,phase);
 }
}
function animatePlayerRig(dt){
 const speed=Math.hypot(playerVelocity.x,playerVelocity.z),moving=speed>.12;
 const sprinting=run&&pose==='stand'&&moving&&!aim;
 crouchBlend=THREE.MathUtils.damp(crouchBlend,pose==='crouch'?1:0,8,dt);
 proneBlend=THREE.MathUtils.damp(proneBlend,pose==='prone'?1:0,7.5,dt);
 aimBlend=THREE.MathUtils.damp(aimBlend,aim?1:0,10,dt);
 if(gameStarted&&reloading){
  reloadElapsed+=dt;reloadProgress=THREE.MathUtils.clamp(reloadElapsed/1.55,0,1);
  if(reloadProgress>=.78&&!reloadCommitted){
   const count=Math.min(weaponConfigs[activeWeapon].capacity-ammo,reserve);
   ammo+=count;reserve-=count;ammoByWeapon[activeWeapon]=ammo;reserveByWeapon[activeWeapon]=reserve;
   reloadCommitted=true;updateHud();
  }
  if(reloadProgress>=1){reloading=false;reloadElapsed=0;reloadProgress=0;reloadBlend=0;setMsg('PRONTO PARA COMBATE')}
 }
 weaponKick=THREE.MathUtils.damp(weaponKick,0,aim?13:8,dt);
 reloadBlend=THREE.MathUtils.damp(reloadBlend,reloading?1:0,7,dt);
 muzzleTime=Math.max(0,muzzleTime-dt);
 if(muzzleTime===0){flash.visible=false;pistolFlash.visible=false;muzzle.intensity=0;pistolMuzzle.intensity=0}
 rifle.visible=activeWeapon==='RIFLE';pistol.visible=activeWeapon==='PISTOLA';
 if(soldierModel)animateRealSoldierRig(dt,speed,sprinting);
 else animateProceduralRig(dt,speed,sprinting);
}
const cameraRay=new THREE.Raycaster();
const cameraLookTarget=new THREE.Vector3(),cameraDesired=new THREE.Vector3(),cameraForward=new THREE.Vector3(),cameraSide=new THREE.Vector3(),cameraOffset=new THREE.Vector3();
let activeIndoorBuilding=null,cameraInitialized=false;
function cameraUpdate(dt){
 cameraForward.set(-Math.sin(yaw),0,-Math.cos(yaw));
 cameraSide.set(Math.cos(yaw),0,-Math.sin(yaw));
 const indoor=buildings.find(b=>hero.position.x>b.minX+.45&&hero.position.x<b.maxX-.45&&hero.position.z>b.minZ+.45&&hero.position.z<b.maxZ-.45)||null;
 if(indoor!==activeIndoorBuilding){
  if(activeIndoorBuilding)activeIndoorBuilding.roof.visible=true;
  if(indoor)indoor.roof.visible=false;
  activeIndoorBuilding=indoor;
 }
 const inside=!!indoor;
 // Câmera de perseguição em terceira pessoa, inspirada no padrão de battle royale mobile:
 // distância constante, ombro direito, foco no tronco e rotação controlada pelo arrasto.
 const distance=aim?3.25:5.35;
 const shoulder=aim?.58:.78;
 const targetHeight=pose==='prone'?.62:pose==='crouch'?1.02:1.48;
 cameraLookTarget.set(hero.position.x,hero.position.y+targetHeight,hero.position.z);
 cameraDesired.copy(hero.position).addScaledVector(cameraForward,-distance).addScaledVector(cameraSide,shoulder);
 cameraDesired.y=hero.position.y+(aim?2.02:2.28)+Math.sin(-pitch)*distance*.30;
 // Colisão apenas com paredes/edificações; nunca com vegetação ou objetos pequenos.
 const offset=cameraDesired.clone().sub(cameraLookTarget),length=offset.length(),direction=offset.normalize();
 cameraRay.set(cameraLookTarget,direction);cameraRay.near=.10;cameraRay.far=length;
 const obstacle=cameraRay.intersectObjects(cameraOccluders,false).find(hit=>hit.distance>.18);
 if(obstacle){
  const safeDistance=Math.max(2.15,obstacle.distance-.32);
  cameraDesired.copy(cameraLookTarget).addScaledVector(direction,Math.min(length,safeDistance));
 }
 if(!cameraInitialized){camera.position.copy(cameraDesired);cameraInitialized=true}
 else camera.position.lerp(cameraDesired,1-Math.exp(-12*Math.min(dt,.05)));
 // Impede que o amortecimento deixe a câmera ultrapassar o limite de distância desejado.
 cameraOffset.copy(camera.position).sub(cameraLookTarget);
 const maxDistance=cameraDesired.distanceTo(cameraLookTarget);
 if(cameraOffset.length()>maxDistance)camera.position.copy(cameraLookTarget).addScaledVector(cameraOffset.normalize(),maxDistance);
 const lookAt=cameraLookTarget.clone().addScaledVector(cameraForward,aim?1.25:.45);
 camera.lookAt(lookAt);
 camera.fov=THREE.MathUtils.damp(camera.fov,aim?48:62,10,dt);
 camera.updateProjectionMatrix();
}
let audioCtx=null;
function sound(freq=140,duration=.07,kind='sawtooth',volume=.035){try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=kind;osc.frequency.setValueAtTime(freq,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.38),audioCtx.currentTime+duration);gain.gain.setValueAtTime(volume,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration)}catch(e){}}
function hitEffect(point,color=0xffd27a){const p=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),new THREE.MeshBasicMaterial({color}));p.position.copy(point);scene.add(p);effects.push({o:p,t:.22})}
function shoot(){
 if(!gameStarted||reloading||ammo<=0)return;
 const config=weaponConfigs[activeWeapon],now=performance.now();
 if(now-lastShot<config.rate)return;
 lastShot=now;ammo=Math.max(0,ammo-1);ammoByWeapon[activeWeapon]=ammo;reserveByWeapon[activeWeapon]=reserve;
 weaponKick=activeWeapon==='RIFLE'?1:.72;muzzleTime=activeWeapon==='RIFLE'?.075:.055;
 if(activeWeapon==='RIFLE'){flash.visible=true;muzzle.intensity=4}
 else{pistolFlash.visible=true;pistolMuzzle.intensity=2.8}
 sound(activeWeapon==='RIFLE'?115:175,.095,'sawtooth',.055);
 const origin=camera.position.clone(),direction=new THREE.Vector3();camera.getWorldDirection(direction);ray.set(origin,direction);
 const live=bots.filter(b=>b.alive),hits=ray.intersectObjects(live.map(b=>b.g),true);
 let distance=80;
 if(hits.length&&hits[0].distance<115){
  distance=hits[0].distance;const hit=hits[0],bot=live.find(b=>{let node=hit.object;while(node&&node!==b.g)node=node.parent;return node===b.g});
  if(bot){bot.hp-=config.damage;bot.hit=.22;bot.torsoBot.rotation.x=-.24;hitEffect(hit.point,0xffb85c);setMsg('ACERTO CONFIRMADO');$('message').classList.add('hit');setTimeout(()=>$('message').classList.remove('hit'),180);if(bot.hp<=0){bot.alive=false;bot.g.visible=false;score++;setMsg('INIMIGO ELIMINADO')}}
 }
 const end=origin.clone().addScaledVector(direction,Math.min(distance,80));
 const geo=new THREE.BufferGeometry().setFromPoints([origin,end]);
 const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffd98a,transparent:true,opacity:.9}));
 scene.add(line);effects.push({o:line,t:.11});updateHud();
}
function reload(){
 const capacity=weaponConfigs[activeWeapon].capacity;
 if(reloading||ammo>=capacity||reserve<=0)return;
 reloading=true;reloadElapsed=0;reloadProgress=0;reloadCommitted=false;reloadBlend=0;
 setMsg('RECARREGANDO');sound(260,.16,'triangle',.025);
}
function updateLoot(){for(const l of loot){if(!l.active)continue;l.g.rotation.y+=.012;if(l.g.position.distanceTo(hero.position)<2.4){l.active=false;l.g.visible=false;sound(620,.07,'sine',.025);if(l.kind==='MUNIÇÃO')reserve+=45;else if(l.kind==='KIT MÉDICO')health=Math.min(100,health+35);else if(l.kind==='COLETE')health=Math.min(150,health+15);else{ammo=Math.min(weaponConfigs[activeWeapon].capacity,ammo+10);reserve+=20}ammoByWeapon[activeWeapon]=ammo;reserveByWeapon[activeWeapon]=reserve;setMsg('COLETADO: '+l.kind);updateHud()}}}
function updateBots(dt){
 for(const b of bots){
  if(!b.alive)continue;
  const d=b.g.position.distanceTo(hero.position),moving=d<46&&d>12;
  if(d<46){
   const dir=hero.position.clone().sub(b.g.position).setY(0).normalize();
   if(moving)b.g.position.addScaledVector(dir,dt*2.1);
   b.g.lookAt(hero.position.x,0,hero.position.z);
   b.phase+=dt*(moving?9:2.2);
   const stride=moving?Math.sin(b.phase)*.58:0;
   b.legs.forEach((l,i)=>{l.pivot.rotation.x=(i===0?stride:-stride);});
   b.arms.forEach((a,i)=>{a.pivot.rotation.x=THREE.MathUtils.damp(a.pivot.rotation.x,moving?-.22:-.58,8,dt);a.pivot.rotation.z=THREE.MathUtils.damp(a.pivot.rotation.z,a.side*(moving?.08:.02),7,dt)});
   b.torsoBot.position.y=1.05+Math.sin(b.phase*2)*.018;
   b.torsoBot.rotation.x=THREE.MathUtils.damp(b.torsoBot.rotation.x,b.hit>0?-.24:0,12,dt);
   b.hit=Math.max(0,b.hit-dt);
   b.weapon.rotation.x=THREE.MathUtils.damp(b.weapon.rotation.x,moving?-.06:0,9,dt);
   if(d<32&&performance.now()-b.shot>1500){
    b.shot=performance.now();b.weapon.rotation.x=-.12;
    health=Math.max(0,health-(2+Math.random()*4));updateHud();
    if(health<=0){setMsg('VOCÊ FOI ELIMINADO');$('lobby').classList.remove('hidden');$('play').textContent='TENTAR NOVAMENTE';gameStarted=false}
   }
  }else{
   b.phase+=dt*1.5;b.torsoBot.position.y=1.05+Math.sin(b.phase)*.025;
   b.legs.forEach(l=>l.pivot.rotation.x=THREE.MathUtils.damp(l.pivot.rotation.x,0,5,dt));
   b.arms.forEach(a=>a.pivot.rotation.x=THREE.MathUtils.damp(a.pivot.rotation.x,-.12,5,dt));
  }
 }
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(gameStarted){updateKeyboardMove();move(dt);animatePlayerRig(dt);if(shooting)shoot();updateLoot();updateBots(dt)}else animatePlayerRig(dt);cameraUpdate(dt);for(let i=effects.length-1;i>=0;i--){effects[i].t-=dt;if(effects[i].t<=0){scene.remove(effects[i].o);effects[i].o.geometry.dispose();effects[i].o.material.dispose();effects.splice(i,1)}}renderer.render(scene,camera)}
function start(){gameStarted=true;health=100;ammo=30;reserve=120;ammoByWeapon.RIFLE=30;reserveByWeapon.RIFLE=120;ammoByWeapon.PISTOLA=15;reserveByWeapon.PISTOLA=60;activeWeapon='RIFLE';rifle.visible=true;pistol.visible=false;score=0;pose='stand';run=false;aim=false;shooting=false;hero.position.set(0,0,10);playerVelocity.set(0,0,0);jumpVelocity=0;airborne=false;reloading=false;reloadElapsed=0;reloadProgress=0;reloadCommitted=false;weaponKick=0;crouchBlend=0;proneBlend=0;aimBlend=0;$('lobby').classList.add('hidden');setMsg('POUSO CONCLUÍDO · EXPLORE AS NOVE CIDADES');updateHud()}
$('play').addEventListener('click',start);
$('fire').addEventListener('pointerdown',e=>{e.preventDefault();shooting=true;shoot()});['pointerup','pointercancel','pointerleave'].forEach(t=>$('fire').addEventListener(t,()=>shooting=false));
$('reload').addEventListener('pointerdown',e=>{e.preventDefault();reload()});
$('swap').addEventListener('pointerdown',e=>{e.preventDefault();switchWeapon()});
$('run').addEventListener('pointerdown',()=>run=true);['pointerup','pointercancel','pointerleave'].forEach(t=>$('run').addEventListener(t,()=>run=false));
$('jump').addEventListener('pointerdown',()=>{if(gameStarted&&pose!=='prone'&&hero.position.y===0)jumpVelocity=7.2});
$('crouch').addEventListener('pointerdown',()=>{pose=pose==='crouch'?'stand':'crouch';updateHud()});
$('prone').addEventListener('pointerdown',()=>{pose=pose==='prone'?'stand':'prone';updateHud()});
function setAim(on){aim=on;$('aim').classList.toggle('active',aim)}$('aim').addEventListener('pointerdown',e=>{e.preventDefault();setAim(true)});['pointerup','pointercancel','pointerleave'].forEach(t=>$('aim').addEventListener(t,()=>setAim(false)));
// Controles equivalentes ao projeto anterior: teclado, corrida, posturas e ações.
const keys=new Set();
addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();
 if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(k))e.preventDefault();
 if(keys.has(k))return;keys.add(k);
 if(k==='r')reload();
 if(k==='q')switchWeapon();
 if(k===' ') {if(gameStarted&&pose!=='prone'&&hero.position.y===0)jumpVelocity=7.2}
 if(k==='c'){pose=pose==='crouch'?'stand':'crouch';updateHud()}
 if(k==='z'){pose=pose==='prone'?'stand':'prone';updateHud()}
 if(k==='shift')run=true;
 if(k==='control')setAim(true);
 if(k==='enter'&&!gameStarted)start();
});
addEventListener('keyup',e=>{
 const k=e.key.toLowerCase();keys.delete(k);
 if(k==='shift')run=false;
 if(k==='control')setAim(false);
});
function updateKeyboardMove(){
 if(keys.has('a')||keys.has('arrowleft'))mx=-1;
 else if(keys.has('d')||keys.has('arrowright'))mx=1;
 else if(!stickId)mx=0;
 if(keys.has('w')||keys.has('arrowup'))my=-1;
 else if(keys.has('s')||keys.has('arrowdown'))my=1;
 else if(!stickId)my=0;
}
const stick=$('stick'),knob=$('knob');let stickId=null;stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;stick.setPointerCapture(stickId);joy(e)});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)joy(e)});function joy(e){const r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.min(46,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);knob.style.transform='translate('+Math.cos(a)*len+'px,'+Math.sin(a)*len+'px)';mx=Math.cos(a)*len/46;my=Math.sin(a)*len/46}function endStick(){stickId=null;mx=my=0;knob.style.transform=''}['pointerup','pointercancel'].forEach(t=>stick.addEventListener(t,endStick));
let lookId=null,lastX=0,lastY=0;renderer.domElement.addEventListener('pointerdown',e=>{if(e.clientX<innerWidth*.35&&e.clientY>innerHeight*.5)return;lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(lookId)});renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;yaw-=(e.clientX-lastX)*.006;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.004,-.65,.45);lastX=e.clientX;lastY=e.clientY});['pointerup','pointercancel'].forEach(t=>renderer.domElement.addEventListener(t,()=>lookId=null));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.35:2))});
updateHud();camera.position.set(0,6,18);camera.lookAt(0,1,0);animate();

// Operation Nine prototype build: initial branch validation.

// Weapon iteration: rifle/pistol swap, distinct fire cadence and damage.

// Player rig iteration: smooth pose blend, prone body orientation, procedural gait and ballistic jump.
