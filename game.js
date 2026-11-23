import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

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
 const g=new THREE.Group();g.position.set(x,0,z);world.add(g);cameraOccluders.push(g);
 const wall=mat(color),trim=mat(0xd0c4a5),roof=type==='warehouse'?mat(0x3c4848,.7,.25):mats.roof;
 // Camera collision must detect wall faces from inside buildings too.
 wall.side=THREE.DoubleSide;
 // Walkable shell: floor, four wall runs and a real doorway (front is +Z).
 box(g,w,.16,d,mat(0x8f826b),0,.08,0);
 const t=.34,doorW=Math.min(2.1,w*.24),sideW=(w-doorW)/2;
 box(g,sideW,h,d,wall,-(doorW+sideW)/2,h/2,d/2-t/2);
 box(g,sideW,h,d,wall,(doorW+sideW)/2,h/2,d/2-t/2);
 box(g,doorW,h*.22,t,wall,0,h*.89,d/2);
 box(g,w,h,d*.08,wall,0,h/2,-d/2+d*.04);
 box(g,t,h,d*.9,wall,-w/2+t/2,h/2,0);
 box(g,t,h,d*.9,wall,w/2-t/2,h/2,0);
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
// Player rig with articulated limbs and detailed rifle
const hero=new THREE.Group();scene.add(hero);hero.position.set(0,0,10);
const torso=new THREE.Group();torso.position.y=1.05;hero.add(torso);
// Importação do personagem GLB original. O rig procedural permanece como fallback até o GLB carregar.
let soldierModel=null,soldierMixer=null,soldierBones={},soldierRest={},soldierLoadState='loading';
const gltfLoader=new GLTFLoader();
function findBone(root,part){let found=null;root.traverse(o=>{if(!found&&o.isBone&&o.name.toLowerCase().includes(part.toLowerCase()))found=o});return found}
function loadSoldierModel(){
 gltfLoader.load('./assets/military-male-03.glb',gltf=>{
  soldierModel=gltf.scene;
  soldierModel.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.side=THREE.FrontSide}}});
  const bounds=new THREE.Box3().setFromObject(soldierModel),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const scale=1.82/Math.max(size.y,.001);soldierModel.scale.setScalar(scale);
  soldierModel.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  hero.add(soldierModel);soldierModel.updateMatrixWorld(true);
  ['Bip01 Pelvis','Bip01 Spine','Bip01 Spine1','Bip01 Spine2','Bip01 L UpperArm','Bip01 R UpperArm','Bip01 L Forearm','Bip01 R Forearm','Bip01 L Thigh','Bip01 R Thigh','Bip01 L Calf','Bip01 R Calf','Bip01 Head'].forEach(n=>{
   const b=findBone(soldierModel,n.replace('Bip01 ',''));
   if(b){soldierBones[n]=b;soldierRest[n]=b.rotation.clone()}
  });
  // Evita tocar todos os clips importados simultaneamente: root motion/escala pode causar zoom aparente. O rig usa animação procedural.
  torso.visible=false;soldierLoadState='loaded';setMsg('PERSONAGEM 3D ORIGINAL CARREGADO');
 },undefined,error=>{soldierLoadState='fallback';console.warn('GLB não encontrado; mantendo personagem provisório.',error)});
}
function animateSoldierRig(dt){
 if(!soldierModel)return;
 if(soldierMixer)soldierMixer.update(dt);
 const moving=Math.abs(mx)+Math.abs(my)>.08,phase=performance.now()*.008*(run?1.5:1),stride=moving?Math.sin(phase)*(run?.62:.34):0;
 const blend=poseBlend||0,idle=Math.sin(performance.now()*.0022),aimBlend=aim?1:0;
 reloadAnim=Math.max(0,reloadAnim-.72*dt);recoilAnim=Math.max(0,recoilAnim-5.5*dt);
 const reloadPose=Math.sin((1-reloadAnim)*Math.PI)*.8;
 const apply=(name,x=0,y=0,z=0)=>{const b=soldierBones[name],r=soldierRest[name];if(b&&r){b.rotation.set(r.x+x,r.y+y,r.z+z)}};
 apply('Bip01 Pelvis',pose==='prone'?-1.25*blend:idle*.012);
 apply('Bip01 Spine',-.12*blend+idle*.018-aimBlend*.035);
 apply('Bip01 Spine1',-.08*blend+idle*.012-aimBlend*.05);
 apply('Bip01 Spine2',-.06*blend-aimBlend*.06-recoilAnim*.12);
 apply('Bip01 Head',-idle*.012);
 apply('Bip01 L UpperArm',pose==='prone'?1.05*blend:aimBlend*.28+stride*.35+reloadPose*.32);
 apply('Bip01 R UpperArm',pose==='prone'?1.05*blend:aimBlend*.22-stride*.35+reloadPose*.72-recoilAnim*.18);
 apply('Bip01 L Forearm',pose==='prone'?-.65*blend:-aimBlend*.16-reloadPose*.35);
 apply('Bip01 R Forearm',pose==='prone'?-.65*blend:-aimBlend*.12-reloadPose*.55);
 apply('Bip01 L Thigh',stride*(1-blend));
 apply('Bip01 R Thigh',-stride*(1-blend));
 apply('Bip01 L Calf',Math.max(0,-stride)*.72);
 apply('Bip01 R Calf',Math.max(0,stride)*.72);
}
loadSoldierModel();
const skin=mat(0x9a6c50),uniform=mat(0x34483c),pants=mat(0x303b36),armor=mat(0x4b5a4c),black=mat(0x1c2524,.42,.25);
function ell(p,x,y,z,sx,sy,sz,m){const o=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;p.add(o);return o}
// Corpo articulado procedural, com peças separadas para transições de animação.
ell(torso,0,.42,0,.36,.42,.23,uniform);ell(torso,0,.42,-.05,.38,.32,.24,armor);
ell(torso,0,.88,0,.2,.25,.19,skin);ell(torso,0,1.15,0,.22,.27,.2,skin);
ell(torso,0,1.34,0,.25,.17,.23,mat(0x26372f));box(torso,.34,.055,.12,black,0,1.31,-.19);
box(torso,.43,.55,.22,mat(0x293c32),0,.47,.27);
for(const side of [-1,1]){box(torso,.13,.22,.12,mat(0x6e7950),side*.31,.37,-.02);box(torso,.12,.16,.1,black,side*.2,.05,-.19)}
const limbs=[];
for(const side of [-1,1]){
 const leg=new THREE.Group();leg.position.set(side*.19,-.12,0);torso.add(leg);
 ell(leg,0,-.28,0,.14,.32,.15,pants);ell(leg,0,-.61,-.04,.11,.28,.12,pants);
 ell(leg,0,-.42,-.11,.125,.13,.06,armor);box(leg,.23,.14,.36,black,0,-.84,-.1);
 const arm=new THREE.Group();arm.position.set(side*.39,.72,0);torso.add(arm);
 ell(arm,0,-.2,0,.12,.26,.12,uniform);ell(arm,0,-.48,-.05,.09,.23,.1,uniform);ell(arm,0,-.55,-.07,.095,.09,.09,black);
 limbs.push({g:leg,side,leg:true},{g:arm,side,leg:false});
}
const rifle=new THREE.Group();rifle.position.set(.27,.48,-.27);torso.add(rifle);
box(rifle,.15,.14,.9,black,0,0,-.18);box(rifle,.09,.08,.55,mats.metal,0,.02,-.84);box(rifle,.12,.28,.17,black,0,-.19,-.2);box(rifle,.23,.1,.28,black,0,0,.39);box(rifle,.08,.18,.1,mats.metal,0,.13,-.32);
const muzzle=new THREE.PointLight(0xffb34f,0,7);muzzle.position.set(0,0,-1.18);rifle.add(muzzle);
const pistol=new THREE.Group();pistol.position.set(.27,.46,-.23);pistol.visible=false;torso.add(pistol);
box(pistol,.16,.17,.42,black,0,0,-.12);box(pistol,.1,.07,.22,mats.metal,0,.02,-.43);box(pistol,.12,.27,.15,black,0,-.16,.02);
let activeWeapon='RIFLE';
function switchWeapon(){activeWeapon=activeWeapon==='RIFLE'?'PISTOLA':'RIFLE';rifle.visible=activeWeapon==='RIFLE';pistol.visible=activeWeapon==='PISTOLA';setMsg('ARMA: '+activeWeapon);sound(340,.06,'triangle',.02)}

const flash=new THREE.Mesh(new THREE.ConeGeometry(.15,.55,8),new THREE.MeshBasicMaterial({color:0xffc45d}));flash.rotation.x=-Math.PI/2;flash.position.set(0,0,-1.4);flash.visible=false;rifle.add(flash);
let yaw=0,pitch=-.16,mx=0,my=0,run=false,aim=false,pose='stand',health=100,ammo=30,reserve=120,shooting=false,lastShot=0,reloading=false,gameStarted=false,score=0;
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
let poseBlend=0,jumpVelocity=0,walkPhase=0,reloadAnim=0,recoilAnim=0;
function move(dt){
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const dir=forward.multiplyScalar(-my).add(right.multiplyScalar(mx));if(dir.lengthSq()>1)dir.normalize();
 const speed=(run?8:4.3)*(pose==='crouch'?.48:pose==='prone'?.18:1),dx=dir.x*speed*dt,dz=dir.z*speed*dt;
 const nx=THREE.MathUtils.clamp(hero.position.x+dx,-137,137),nz=THREE.MathUtils.clamp(hero.position.z+dz,-137,137);
 if(!collidesAt(nx,hero.position.z))hero.position.x=nx;if(!collidesAt(hero.position.x,nz))hero.position.z=nz;
 if(dir.lengthSq()>.001)hero.rotation.y=THREE.MathUtils.damp(hero.rotation.y,Math.atan2(-dir.x,-dir.z),12,dt);
 const targetPose=pose==='prone'?1:pose==='crouch'?.48:0;poseBlend=THREE.MathUtils.damp(poseBlend,targetPose,8,dt);
 torso.position.y=THREE.MathUtils.lerp(1.05,.72,poseBlend);torso.rotation.x=-1.48*poseBlend;rifle.rotation.x=1.48*poseBlend;
 walkPhase+=dt*(run?13:7.5)*(dir.lengthSq()>.001?1:0);
 const idleBreath=Math.sin(performance.now()*.0022)*.018,aimPose=aim?1:0;
 torso.position.y=THREE.MathUtils.lerp(1.05,.72,poseBlend)+idleBreath;
 torso.rotation.x=-1.48*poseBlend-aimPose*.035-recoilAnim*.08;
 rifle.rotation.x=1.48*poseBlend-aimPose*.06-recoilAnim*.16+reloadAnim*.12;
 limbs.forEach(l=>{const swing=dir.lengthSq()>.001?Math.sin(walkPhase)*(run?.82:.46):0;
  if(l.leg)l.g.rotation.x=swing*(1-poseBlend*.72);
  else l.g.rotation.x=THREE.MathUtils.lerp(aimPose?-.42:idleBreath,Math.PI*poseBlend,poseBlend)+swing*(1-poseBlend)+reloadAnim*(l.side<0?.38:.7);
 });
 if(hero.position.y>0||jumpVelocity>0){jumpVelocity-=19*dt;hero.position.y=Math.max(0,hero.position.y+jumpVelocity*dt);if(hero.position.y===0)jumpVelocity=0}
}
const cameraRay=new THREE.Raycaster();
const cameraLookTarget=new THREE.Vector3(),cameraDesired=new THREE.Vector3(),cameraForward=new THREE.Vector3(),cameraSide=new THREE.Vector3();
let activeIndoorBuilding=null;
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
 const distance=inside?(aim?0.285:0.435):(aim?3.8:7.0);
 const shoulder=inside?(aim?.12:.22):(aim?.82:1.18);
 const targetHeight=inside?THREE.MathUtils.lerp(1.48,.86,poseBlend):THREE.MathUtils.lerp(2.05,.88,poseBlend);
 cameraLookTarget.copy(hero.position).add(new THREE.Vector3(0,targetHeight,0));
 const height=inside?(aim?1.52:1.72):(aim?2.35:THREE.MathUtils.lerp(4.0,2.25,poseBlend));
 cameraDesired.copy(hero.position).addScaledVector(cameraForward,-distance).addScaledVector(cameraSide,shoulder);
 cameraDesired.y=hero.position.y+height+Math.sin(-pitch)*distance*(inside?.30:.52);
 // Em áreas abertas, manter o afastamento exato: sem suavização ou zoom por colisões falsas.
 if(inside){
  const offset=cameraDesired.clone().sub(cameraLookTarget),length=offset.length(),direction=offset.normalize();
  cameraRay.set(cameraLookTarget,direction);cameraRay.near=.08;cameraRay.far=length;
  const obstacle=cameraRay.intersectObjects(cameraOccluders,true).find(hit=>hit.distance>.12);
  if(obstacle){
   const safeDistance=Math.max(.30,obstacle.distance-.30);
   cameraDesired.copy(cameraLookTarget).addScaledVector(direction,Math.min(length,safeDistance));
  }
 }
 camera.position.copy(cameraDesired);
 const lookAhead=inside?(aim?.85:.48):(aim?3.0:1.0);
 const lookAt=cameraLookTarget.clone().addScaledVector(cameraForward,lookAhead);
 camera.lookAt(lookAt);
 const targetFov=inside?(aim?49:66):(aim?39:65);
 camera.fov=targetFov;camera.updateProjectionMatrix();
}
let audioCtx=null;
function sound(freq=140,duration=.07,kind='sawtooth',volume=.035){try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=kind;osc.frequency.setValueAtTime(freq,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.38),audioCtx.currentTime+duration);gain.gain.setValueAtTime(volume,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration)}catch(e){}}
function hitEffect(point,color=0xffd27a){const p=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),new THREE.MeshBasicMaterial({color}));p.position.copy(point);scene.add(p);effects.push({o:p,t:.22})}
function shoot(){
 if(!gameStarted||reloading||ammo<=0)return;
 const now=performance.now();if(now-lastShot<(activeWeapon==='RIFLE'?115:220))return;lastShot=now;ammo--;recoilAnim=1;
 flash.visible=true;muzzle.intensity=4;sound(115,.095,'sawtooth',.055);
 setTimeout(()=>{flash.visible=false;muzzle.intensity=0},65);
 rifle.position.z=-.215;setTimeout(()=>rifle.position.z=-.27,75);
 const origin=camera.position.clone(),direction=new THREE.Vector3();camera.getWorldDirection(direction);ray.set(origin,direction);
 const live=bots.filter(b=>b.alive),hits=ray.intersectObjects(live.map(b=>b.g),true);
 let distance=80;
 if(hits.length&&hits[0].distance<115){
  distance=hits[0].distance;const hit=hits[0],bot=live.find(b=>{let node=hit.object;while(node&&node!==b.g)node=node.parent;return node===b.g});
  if(bot){bot.hp-=activeWeapon==='RIFLE'?34:22;bot.hit=.22;bot.torsoBot.rotation.x=-.24;hitEffect(hit.point,0xffb85c);setMsg('ACERTO CONFIRMADO');$('message').classList.add('hit');setTimeout(()=>$('message').classList.remove('hit'),180);if(bot.hp<=0){bot.alive=false;bot.g.visible=false;score++;setMsg('INIMIGO ELIMINADO')}}
 }
 const end=origin.clone().addScaledVector(direction,Math.min(distance,80));
 const geo=new THREE.BufferGeometry().setFromPoints([origin,end]);
 const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffd98a,transparent:true,opacity:.9}));
 scene.add(line);effects.push({o:line,t:.11});updateHud();
}
function reload(){if(reloading||ammo===30||reserve<=0)return;reloading=true;reloadAnim=1;setMsg('RECARREGANDO');sound(260,.16,'triangle',.025);setTimeout(()=>sound(190,.13,'triangle',.025),520);setTimeout(()=>{const n=Math.min(30-ammo,reserve);ammo+=n;reserve-=n;reloading=false;updateHud();setMsg('PRONTO PARA COMBATE')},1450)}
function updateLoot(){for(const l of loot){if(!l.active)continue;l.g.rotation.y+=.012;if(l.g.position.distanceTo(hero.position)<2.4){l.active=false;l.g.visible=false;sound(620,.07,'sine',.025);if(l.kind==='MUNIÇÃO')reserve+=45;else if(l.kind==='KIT MÉDICO')health=Math.min(100,health+35);else if(l.kind==='COLETE')health=Math.min(150,health+15);else{ammo=Math.min(30,ammo+10);reserve+=20}setMsg('COLETADO: '+l.kind);updateHud()}}}
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
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(gameStarted){updateKeyboardMove();move(dt);if(shooting)shoot();updateLoot();updateBots(dt)}animateSoldierRig(dt);cameraUpdate(dt);for(let i=effects.length-1;i>=0;i--){effects[i].t-=dt;if(effects[i].t<=0){scene.remove(effects[i].o);effects[i].o.geometry.dispose();effects[i].o.material.dispose();effects.splice(i,1)}}renderer.render(scene,camera)}
function start(){gameStarted=true;health=100;ammo=30;reserve=120;score=0;hero.position.set(0,0,10);$('lobby').classList.add('hidden');setMsg('POUSO CONCLUÍDO · EXPLORE AS NOVE CIDADES');updateHud()}
$('play').addEventListener('click',start);
$('fire').addEventListener('pointerdown',e=>{e.preventDefault();shooting=true;shoot()});['pointerup','pointercancel','pointerleave'].forEach(t=>$('fire').addEventListener(t,()=>shooting=false));
$('reload').addEventListener('pointerdown',e=>{e.preventDefault();reload()});
$('swap').addEventListener('pointerdown',e=>{e.preventDefault();switchWeapon()});
$('run').addEventListener('pointerdown',()=>run=true);['pointerup','pointercancel','pointerleave'].forEach(t=>$('run').addEventListener(t,()=>run=false));
$('jump').addEventListener('pointerdown',()=>{if(gameStarted&&pose==='stand'&&hero.position.y===0)jumpVelocity=7.2});
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
 if(k===' ') {if(gameStarted&&pose==='stand'&&hero.position.y===0)jumpVelocity=7.2}
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
