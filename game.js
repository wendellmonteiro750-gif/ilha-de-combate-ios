import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { BattleSystems } from './battle-systems.js';
const $=id=>document.getElementById(id);
const root=$('game');
let battleSystems=null;
let scene,camera,renderer,clock,hero,targets=[],yaw=0,pitch=-.12,moveYaw=0,stickActive=false,moveX=0,moveY=0,velocityX=0,velocityZ=0,run=false,aim=false,shoot=false,pose='stand',velocityY=0,grounded=true,ammo=30,ammoReserve=90,eliminations=0,playerHealth=100,bots=[],playerDownUntil=0,reloading=false,lastShot=0,started=false,cameraRecoil=0,cameraShake=0,stamina=100,worldBlockers=[],cameraBlockerMeshes=[],cameraRay=new THREE.Raycaster(),cameraDesired=new THREE.Vector3(),cameraCurrentDistance=5.6;
const mat=(color,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness});
function mesh(parent,geo,material,pos){const o=new THREE.Mesh(geo,material);o.position.set(...pos);parent.add(o);o.castShadow=true;o.receiveShadow=true;return o}
function cube(parent,w,h,d,m,x,y,z){return mesh(parent,new THREE.BoxGeometry(w,h,d),m,[x,y,z])}
function capsule(parent,r,len,m,x,y,z){return mesh(parent,new THREE.CapsuleGeometry(r,len,4,8),m,[x,y,z])}
function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x8fc8e2);scene.fog=new THREE.Fog(0x8fc8e2,105,245);
 camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,320);
 const mobileProfile=matchMedia('(max-width: 800px)').matches||navigator.maxTouchPoints>0;renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,mobileProfile?1.6:2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.physicallyCorrectLights=true;root.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xeaf5ff,0x46513a,1.85));
 const fill=new THREE.DirectionalLight(0xb9d9ff,.72);fill.position.set(18,14,-24);scene.add(fill);
 const sun=new THREE.DirectionalLight(0xffe5c2,3.0);sun.position.set(-20,32,16);sun.castShadow=true;sun.shadow.mapSize.set(mobileProfile?1536:3072,mobileProfile?1024:3072);sun.shadow.camera.near=1;sun.shadow.camera.far=180;sun.shadow.radius=mobileProfile?2:3;sun.shadow.camera.left=-105;sun.shadow.camera.right=105;sun.shadow.camera.top=105;sun.shadow.camera.bottom=-105;sun.shadow.bias=-0.00018;scene.add(sun);
 buildIsland();createPlayerAnchor();battleSystems=new BattleSystems(THREE,scene,hero,(message)=>{$('message').textContent=message},worldBlockers);battleSystems.onHeal=amount=>{playerHealth=Math.min(100,playerHealth+amount);$('health').textContent='VIDA '+playerHealth;$('playerCounter').textContent=playerHealth};battleSystems.onZoneDamage=amount=>{playerHealth=Math.max(0,playerHealth-amount);$('health').textContent='VIDA '+Math.round(playerHealth);$('playerCounter').textContent=Math.round(playerHealth);if(playerHealth<=0)battleSystems.end(false)};battleSystems.getKills=()=>eliminations;battleSystems.onAmmo=amount=>{ammoReserve+=amount;stats()};battleSystems.onWeaponChange=w=>{ammo=w.mag;ammoReserve=Math.max(ammoReserve,w.reserve);stats()};bind();addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,180));if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);clock=new THREE.Clock();animate();
}
function buildIsland(){
 const waterMat=new THREE.MeshStandardMaterial({color:0x176d88,roughness:.2,metalness:.18});
 const water=mesh(scene,new THREE.CircleGeometry(285,144),waterMat,[0,-.68,0]);water.rotation.x=-Math.PI/2;
 const landGeo=new THREE.CircleGeometry(152,192),pos=landGeo.attributes.position,colors=[];
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getY(i),r=Math.hypot(x,z);
  const wave=(Math.sin(x*.19)*Math.cos(z*.17)+Math.sin((x+z)*.11))*.13;
  pos.setZ(i,wave+Math.max(0,1-r/60)*.12);
  const patch=(Math.sin(x*.72+z*.46)*Math.cos(z*.63-x*.38)+1)*.5;
  const edge=THREE.MathUtils.smoothstep(r,139,151.8);
  const color=new THREE.Color().setRGB(.12+.075*patch,.27+.14*patch,.095+.045*patch).lerp(new THREE.Color(0xb5a071),edge*.48);
  colors.push(color.r,color.g,color.b);
 }
 landGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));landGeo.computeVertexNormals();
 const land=new THREE.Mesh(landGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));land.rotation.x=-Math.PI/2;land.position.y=-.15;land.receiveShadow=true;scene.add(land);
 const beach=mesh(scene,new THREE.RingGeometry(146,152,192),mat(0xd4bd83,1),[0,-.09,0]);beach.rotation.x=-Math.PI/2;
 const roadMat=mat(0x555d59,1),lineMat=mat(0xd9c99c,1),sidewalk=mat(0x8d8d7a,1);
 const roads=[[0,0,9,270],[0,0,270,9],[0,-65,9,130],[0,65,9,130],[-65,0,130,9],[65,0,130,9]];
 for(const [x,z,w,d] of roads){cube(scene,w,.075,d,roadMat,x,.012,z);if(w<d){cube(scene,.12,.025,d,lineMat,x-w/2+.3,.065,z);cube(scene,.12,.025,d,lineMat,x+w/2-.3,.065,z)}else{cube(scene,w,.025,.12,lineMat,x,.065,z-d/2+.3);cube(scene,w,.025,.12,lineMat,x,.065,z+d/2-.3)}}
 for(const [x,z,w,d] of [[-13,0,5,260],[13,0,5,260],[0,-13,260,5],[0,13,260,5]])cube(scene,w,.08,d,sidewalk,x,.02,z);
 // Three older starter houses remain around the spawn area; the expanded districts
 // add larger interiors, cover, roads and recognizable combat landmarks.
 house(-10,-8,0xc99b63);house(12,-13,0xb7c2b0);house(-13,15,0xc9825d);
 addGrass();buildForest();buildExpandedDistricts();
 const patrols=[[-43,-43],[-23,-47],[43,-39],[-48,40],[-24,57],[51,42],[-72,-1],[72,8],[3,76],[0,-82],[-84,72],[93,22],[-108,-18],[110,-24],[96,91],[-101,-101]];
 for(let i=0;i<5;i++)createCombatBot(-8+i*4,-24-(i%2)*3,i);
 patrols.forEach(([x,z],i)=>createCombatBot(x,z,i+5));
 for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=Math.cos(a)*(58+(i%3)*5),z=Math.sin(a)*(58+(i%3)*5);const rock=mesh(scene,new THREE.DodecahedronGeometry(1.4+(i%3)*.35,0),mat(0x788078),[x,.48,z]);rock.scale.y=.7}
}
function makeNoiseTexture(base,grain){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
 ctx.fillStyle=base;ctx.fillRect(0,0,128,128);const img=ctx.getImageData(0,0,128,128);
 for(let i=0;i<img.data.length;i+=4){const n=(Math.random()-.5)*grain;img.data[i]=THREE.MathUtils.clamp(img.data[i]+n,0,255);img.data[i+1]=THREE.MathUtils.clamp(img.data[i+1]+n,0,255);img.data[i+2]=THREE.MathUtils.clamp(img.data[i+2]+n,0,255)}
 ctx.putImageData(img,0,0);
 for(let i=0;i<90;i++){ctx.fillStyle='rgba(30,25,18,'+(Math.random()*.12)+')';ctx.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*3,1+Math.random()*3)}
 const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2,2);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function addExpandedBuilding(x,z,w,d,color,kind='house'){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 const h=kind==='warehouse'?6:4.1,t=.28,door=kind==='warehouse'?4.2:2.3;
 const wallTex=makeNoiseTexture('#'+new THREE.Color(color).getHexString(),26);
 const wallMat=new THREE.MeshStandardMaterial({map:wallTex,color:0xffffff,roughness:.94});
 const trim=mat(kind==='warehouse'?0x777e7b:0xd4c5a7,.8),dark=mat(0x292e2c,.82);
 const glass=new THREE.MeshPhysicalMaterial({color:0x82b6c0,roughness:.16,metalness:.18,transparent:true,opacity:.82,clearcoat:1});
 const floorMat=new THREE.MeshStandardMaterial({map:makeNoiseTexture('#756b57',32),roughness:1});
 cube(g,w-.3,.18,d-.3,floorMat,0,.08,0);
 const blockWall=(length,px,pz,axis,openCenter=false)=>{
  const segments=openCenter?[[(length-door)/2, -length/2+(length-door)/4],[(length-door)/2,length/2-(length-door)/4]]:[[length,0]];
  for(const [len,offset] of segments){
   const part=axis==='x'?cube(g,len,h,t,wallMat,px+offset,h/2,pz):cube(g,t,h,len,wallMat,px,h/2,pz+offset);
   part.castShadow=true;
   const steps=Math.ceil(len/.72);
   for(let n=0;n<=steps;n++){const along=-len/2+len*n/steps;worldBlockers.push(axis==='x'?{x:x+px+offset+along,z:z+pz,r:.39}:{x:x+px,z:z+pz+offset+along,r:.39})}
  }
 };
 blockWall(w,0,-d/2,'x');blockWall(w,0,d/2,'x',true);blockWall(d,-w/2,0,'z');blockWall(d,w/2,0,'z');
 // Door frame, windows and a low roof perimeter leave the interior visible and navigable.
 cube(g,door+.35,.2,.42,trim,0,.12,d/2+.08);
 for(const side of [-1,1]){
  cube(g,.16,2.3,.22,trim,side*(door/2+.08),1.2,d/2+.08);
  const wx=side*(w*.31);
  cube(g,1.65,1.05,.12,trim,wx,2.35,d/2+.035);
  cube(g,1.38,.78,.06,glass,wx,2.35,d/2+.11);
  cube(g,.06,.82,.07,dark,wx,2.35,d/2+.15);
  cube(g,1.4,.06,.07,dark,wx,2.35,d/2+.15);
 }
 // Roof is built as four raised perimeter panels, leaving a central opening
 // so a third-person camera can still show the player inside the building.
 const roofMat=mat(kind==='warehouse'?0x39454a:0x51453a,.8),roofY=h+.12,band=.85;
 cube(g,w, .32,band,roofMat,0,roofY,-d/2+band/2);
 cube(g,w, .32,band,roofMat,0,roofY,d/2-band/2);
 cube(g,band,.32,d-2*band,roofMat,-w/2+band/2,roofY,0);
 cube(g,band,.32,d-2*band,roofMat,w/2-band/2,roofY,0);
 // Interior partitions and usable cover props.
 if(kind==='house'){
  cube(g,.18,2.7,d*.42,wallMat,-w*.12,1.42,-d*.22);
  cube(g,w*.3,2.7,.18,wallMat,w*.28,1.42,-d*.18);
  cube(g,2.4,.8,1.15,mat(0x72543b,.9),-w*.28,.62,-d*.2);
  cube(g,1.9,.75,.8,mat(0x4b5149,.85),w*.28,.58,-d*.27);
  cube(g,2.1,.16,1.1,trim,w*.22,1.18,d*.12);
  for(const sx of [-1,1]){cube(g,.18,1.1,.18,dark,sx*(w*.22),.55,-d*.25);cube(g,.18,1.1,.18,dark,sx*(w*.22)+1.7,.55,-d*.25)}
 }else{
  for(let n=-1;n<=1;n++)cube(g,2.6,1.1,1.3,mat(0x6c706a,.85),n*5,.65,-1.5);
  cube(g,w*.55,.16,.5,trim,0,1.45,-d*.25);
 }
 // Exterior steps, lamps and signs.
 cube(g,door+.6,.18,.95,mat(0x8b8776,1),0,.09,d/2+.58);
 const lamp=new THREE.PointLight(0xffd69a,.55,10);lamp.position.set(0,h-.5,d/2+.4);g.add(lamp);
 if(kind==='warehouse'){const sign=cube(g,5,.8,.18,mat(0x263d43,.8),0,h-.9,d/2+.22);sign.castShadow=true}
 return g;
}
function buildExpandedDistricts(){
 // Residential blocks, a large warehouse, a service station and a coastal compound.
 const lots=[
  [-47,-52,16,13,0xb58c68,'house'],[-24,-55,17,14,0x9da99a,'house'],[45,-48,18,14,0xb18a65,'house'],
  [-52,47,18,15,0x9eaa9e,'house'],[-25,62,16,13,0xb98b6c,'house'],[48,48,18,15,0x9c9b7d,'house'],
  [-80,-24,22,17,0x68767a,'warehouse'],[80,25,23,18,0x727d76,'warehouse'],[25,92,24,18,0x727c78,'warehouse'],
  [0,-88,18,15,0xb1a17a,'house'],[-88,76,18,15,0x9d876d,'house']
 ];
 for(const lot of lots)addExpandedBuilding(...lot);
 // Fuel station canopy and pump islands as a landmark and hard cover.
 const station=new THREE.Group();station.position.set(78,-73,0);scene.add(station);
 cube(station,20,.55,13,mat(0xd5d1bd,.55),0,4,0);
 for(const [x,z] of [[-8,-5],[8,-5],[-8,5],[8,5]])cube(station,.5,4,.5,mat(0x59605b,.55),x,2,z);
 for(const x of [-5,0,5]){cube(station,1.15,2.2,1.2,mat(0xc4c9c3,.5),x,1.1,0);cube(station,.72,.12,.08,mat(0x9d3430,.4),x,1.7,.62)}
 // Watch tower with ladder-like rungs and a lookout platform.
 const tower=new THREE.Group();tower.position.set(-102,0,-82);scene.add(tower);
 for(const x of [-2.2,2.2])for(const z of [-2.2,2.2])cube(tower,.22,12,.22,mat(0x5b5143,.8),x,6,z);
 cube(tower,6,.35,6,mat(0x786b55,.8),0,8,0);cube(tower,6,.3,6,mat(0x786b55,.8),0,12,0);
 for(let y=1;y<8;y++)cube(tower,4.4,.12,.12,mat(0x8b7a61,.8),0,y,2.1);
}
function tree(x,z,s){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);mesh(g,new THREE.CylinderGeometry(.18*s,.27*s,2*s,9),mat(0x65452d,1),[0,s,0]);const green=mat(0x245b35,1),light=mat(0x367b43,1);mesh(g,new THREE.SphereGeometry(1.18*s,12,10),green,[0,2.35*s,0]);mesh(g,new THREE.SphereGeometry(.86*s,12,10),light,[.48*s,2.72*s,.08]);mesh(g,new THREE.SphereGeometry(.72*s,12,10),green,[-.48*s,2.68*s,-.08]);}
function buildForest(){
 const count=118,dummy=new THREE.Object3D();
 const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.27,2,9),mat(0x65452d,1),count);
 const crown=new THREE.InstancedMesh(new THREE.SphereGeometry(1.18,12,10),mat(0x245b35,1),count);
 const crownA=new THREE.InstancedMesh(new THREE.SphereGeometry(.86,12,10),mat(0x367b43,1),count);
 const crownB=new THREE.InstancedMesh(new THREE.SphereGeometry(.72,12,10),mat(0x2c693b,1),count);
 const clearings=[[-47,-52,13],[-24,-55,13],[45,-48,14],[-52,47,14],[-25,62,13],[48,48,14],[-80,-24,17],[80,25,17],[25,92,18],[0,-88,14],[-88,76,14]];
 for(let i=0;i<count;i++){
  const a=i/count*Math.PI*2,r=55+Math.random()*67,scale=.72+Math.random()*.72,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(clearings.some(([cx,cz,cr])=>Math.hypot(x-cx,z-cz)<cr)){
   dummy.position.set(0,-100,0);dummy.scale.setScalar(0);dummy.updateMatrix();
   for(const batch of [trunk,crown,crownA,crownB])batch.setMatrixAt(i,dummy.matrix);
   continue;
  }
  worldBlockers.push({x,z,r:.55*scale});
  dummy.position.set(x,scale,z);dummy.scale.setScalar(scale);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x,2.35*scale,z);dummy.scale.setScalar(scale);dummy.updateMatrix();crown.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x+.48*scale,2.72*scale,z+.08*scale);dummy.scale.setScalar(scale);dummy.updateMatrix();crownA.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x-.48*scale,2.68*scale,z-.08*scale);dummy.scale.setScalar(scale);dummy.updateMatrix();crownB.setMatrixAt(i,dummy.matrix);
 }
 for(const batch of [trunk,crown,crownA,crownB]){batch.castShadow=true;batch.receiveShadow=true;batch.instanceMatrix.needsUpdate=true;scene.add(batch)}
}
function addGrass(){
 const count=780,dummy=new THREE.Object3D();
 const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.075,.42,4),mat(0x6f8e42,1),count);
 for(let i=0;i<count;i++){
  const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*126,x=Math.cos(a)*r,z=Math.sin(a)*r;
  dummy.position.set(x,.08,z);dummy.rotation.set((Math.random()-.5)*.18,Math.random()*Math.PI,(Math.random()-.5)*.18);
  const scale=.55+Math.random()*.8;dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
 }
 grass.instanceMatrix.needsUpdate=true;grass.castShadow=false;grass.receiveShadow=true;scene.add(grass);
}
function house(x,z,color){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 const wall=mat(color,1),trim=mat(0xe0d2b1,1),roofMat=mat(0x67463a,1),dark=mat(0x3c332b,1),glass=new THREE.MeshStandardMaterial({color:0x83b9c2,roughness:.22,metalness:.08});
 // A real open-front interior replaces the old solid box house.
 const w=9,d=8,h=3.6,t=.25;
 cube(g,w,.16,d,mat(0x756b57,1),0,.08,0);
 const wallPart=(len,px,pz,axis)=>{const part=axis==='x'?cube(g,len,h,t,wall,px,h/2,pz):cube(g,t,h,len,wall,px,h/2,pz);part.castShadow=true;part.userData.cameraObstacle=true;cameraBlockerMeshes.push(part);const n=Math.ceil(len/.8);for(let i=0;i<=n;i++){const p=-len/2+len*i/n;worldBlockers.push(axis==='x'?{x:x+px+p,z:z+pz,r:.36}:{x:x+px,z:z+pz+p,r:.36})}};
 wallPart(w,0,-d/2,'x');wallPart((w-2.2)/2,-(w+2.2)/4,d/2,'x');wallPart((w-2.2)/2,(w+2.2)/4,d/2,'x');wallPart(d,-w/2,0,'z');wallPart(d,w/2,0,'z');
 // Split front facade to leave a proper entrance.
 cube(g,2.2,2.2,.22,wall,-3.4,1.1,d/2);
 cube(g,2.2,2.2,.22,wall,3.4,1.1,d/2);
 cube(g,.15,2.25,.2,trim,-2.25,1.12,d/2);
 cube(g,.15,2.25,.2,trim,2.25,1.12,d/2);
 for(const sx of [-1,1]){cube(g,1.15,.9,.12,trim,sx*2.25,2.25,d/2+.02);cube(g,.92,.68,.06,glass,sx*2.25,2.25,d/2+.1)}
 // Roof strips around an open central skylight keep the inside readable.
 cube(g,w,.25,1.1,roofMat,0,h,-d/2+.55);cube(g,w,.25,1.1,roofMat,0,h,d/2-.55);
 cube(g,1.1,.25,d-2.2,roofMat,-w/2+.55,h,0);cube(g,1.1,.25,d-2.2,roofMat,w/2-.55,h,0);
 cube(g,2.4,.72,1.2,mat(0x71563e,1),-2,.36,-1);
 cube(g,1.8,.7,1.1,mat(0x4d5550,1),2,.35,-1.4);
 cube(g,2.5,.15,1.2,trim,1.8,1.1,1.2);
}
function createCombatBot(x,z,index){
 const bot=new THREE.Group();
 bot.name='Bot_Combate_'+(index+1);
 bot.position.set(x,0,z);
 bot.userData={health:100,maxHealth:100,alive:true,nextShot:performance.now()+1800+index*450,respawnAt:0,phase:index*.9,flashUntil:0};
 const uniform=[0x657b55,0x8a6b4c,0x536b78,0x76615c,0x596c65][index%5];
 const cloth=mat(uniform,.86),armor=mat(0x303b3a,.72),skin=mat(0xb88c6a,.88),helmet=mat(0x39483b,.72),dark=mat(0x151b1b,.68);
 capsule(bot,.25,.66,cloth,0,1.18,0);
 mesh(bot,new THREE.SphereGeometry(.19,12,10),skin,[0,1.83,0]);
 mesh(bot,new THREE.SphereGeometry(.215,12,8),helmet,[0,1.96,0]);
 cube(bot,.48,.34,.28,armor,0,1.34,.015);
 const armL=capsule(bot,.085,.52,cloth,-.34,1.28,-.015);armL.rotation.z=-.48;
 const armR=capsule(bot,.085,.52,cloth,.34,1.28,-.015);armR.rotation.z=.48;
 const legL=capsule(bot,.105,.62,dark,-.14,.48,0);legL.rotation.z=-.04;
 const legR=capsule(bot,.105,.62,dark,.14,.48,0);legR.rotation.z=.04;
 cube(bot,.11,.10,.48,armor,.02,1.20,-.32);
 cube(bot,.10,.09,.28,dark,.02,1.20,-.61);
 cube(bot,.08,.14,.13,armor,.02,1.08,-.22);
 bot.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.userData.bot=bot}});
 scene.add(bot);bots.push(bot);targets.push(bot);
}
function updateCombatBots(dt){
 const now=performance.now();
 for(const bot of bots){
  const data=bot.userData;
  if(!data.alive)continue;
  const dx=hero.position.x-bot.position.x,dz=hero.position.z-bot.position.z;
  const distance=Math.hypot(dx,dz);
  if(distance>5.8&&distance<23){
   const pace=distance>10?1.05:.55,step=pace*dt;
   const nx=bot.position.x+dx/distance*step,nz=bot.position.z+dz/distance*step;
   const blocked=worldBlockers.some(b=>{const bx=nx-b.x,bz=nz-b.z,limit=b.r+.48;return bx*bx+bz*bz<limit*limit});
   if(!blocked){bot.position.x=nx;bot.position.z=nz}
   else{
    const sideX=-dz/distance,sideZ=dx/distance;
    for(const sign of [1,-1]){
     const sx=bot.position.x+sideX*step*sign,sz=bot.position.z+sideZ*step*sign;
     const sideBlocked=worldBlockers.some(b=>{const bx=sx-b.x,bz=sz-b.z,limit=b.r+.48;return bx*bx+bz*bz<limit*limit});
     if(!sideBlocked){bot.position.x=sx;bot.position.z=sz;break}
    }
   }
  }else if(distance<=5.8){
   const sideX=-dz/Math.max(distance,.01),sideZ=dx/Math.max(distance,.01);
   bot.position.x+=sideX*Math.sin(now*.001+data.phase)*.38*dt;
   bot.position.z+=sideZ*Math.sin(now*.001+data.phase)*.38*dt;
  }
  bot.rotation.y=Math.atan2(-dx,-dz);
  const sway=Math.sin(now*.004+data.phase)*.025;
  bot.children[0].position.y=1.18+Math.abs(sway);
  if(now<data.flashUntil){
   bot.traverse(node=>{if(node.isMesh&&node.material&&node.material.emissive)node.material.emissive.setHex(0x552211)});
  }else{
   bot.traverse(node=>{if(node.isMesh&&node.material&&node.material.emissive)node.material.emissive.setHex(0x000000)});
  }
  if(distance<16&&distance>3&&now>=data.nextShot&&playerHealth>0){
   const sightOrigin=new THREE.Vector3(bot.position.x,1.55,bot.position.z);
   const sightTarget=new THREE.Vector3(hero.position.x,1.25,hero.position.z);
   const sightDirection=sightTarget.clone().sub(sightOrigin).normalize();
   cameraRay.set(sightOrigin,sightDirection);cameraRay.far=distance;
   const blockedSight=cameraRay.intersectObjects(cameraBlockerMeshes,true).length>0;
   if(blockedSight){data.nextShot=now+350;continue}
   const armorReduction=Math.min(.48,(battleSystems?.inventory.vest||0)*.12+(battleSystems?.inventory.helmet||0)*.08);
   const incomingDamage=4*(1-armorReduction);
   playerHealth=Math.max(0,playerHealth-incomingDamage);
   data.nextShot=now+2100+Math.random()*650;
   $('health').textContent='VIDA '+playerHealth;
   $('playerCounter').textContent=playerHealth;
   if(playerHealth===0){
    playerDownUntil=now+2600;
    $('message').textContent='VOCÊ FOI ELIMINADO';
   }
  }
 }
 if(playerHealth===0&&playerDownUntil&&now>=playerDownUntil){playerDownUntil=0;battleSystems?.end(false);}
 const alive=bots.filter(b=>b.userData.alive).length;
 $('aliveCount').textContent=alive;
 $('killCount').textContent=eliminations;
}
 // Personagem humano real Quaternius: malha skinned, esqueleto completo e clips humanoides.
const CHARACTER_URL='https://cdn.jsdelivr.net/gh/Seyamalam/blood-league-kickoff@main/public/assets/vendor/quaternius/night-striker.glb';
const CUSTOM_CHARACTER_URL=new URL('./assets/military-male-03.glb',import.meta.url).href;
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
function getCombatBone(name){
 const customAliases={
  upperarm_l:['Bip01 L UpperArm'],lowerarm_l:['Bip01 L Forearm'],hand_l:['Bip01 L Hand'],
  upperarm_r:['Bip01 R UpperArm'],lowerarm_r:['Bip01 R Forearm'],hand_r:['Bip01 R Hand']
 };
 const names=[name,...(customAliases[name]||[])];
 let found=null;characterVisual?.traverse(o=>{if(!found&&o.isBone&&names.includes(o.name))found=o});return found
}
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
  loader.loadAsync(CUSTOM_CHARACTER_URL).then(gltf=>({...gltf,userData:{...(gltf.userData||{}),battleIslandCustom:true}})).catch(()=>loader.loadAsync(CHARACTER_URL)),
  loader.loadAsync(ANIMATION_URL),
  loader.loadAsync(ANIMATION2_URL).catch(error=>{
   console.warn('UAL2 ainda não disponível; transição de deitar será desativada:',error);
   return {animations:[],scene:new THREE.Group()};
  })
 ]).then(([character,library,library2])=>{
  characterVisual=character.scene;
  characterVisual.name=character.userData?.battleIslandCustom?'BattleIsland_MilitaryMale03':'BattleIsland_Quaternius_Human';
  characterVisual.rotation.y=Math.PI;
  characterVisual.scale.setScalar(1);
  if(character.userData?.battleIslandCustom){
   characterVisual.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(characterVisual);
   const size=bounds.getSize(new THREE.Vector3());
   const center=bounds.getCenter(new THREE.Vector3());
   const fit=1.78/Math.max(size.y,.001);
   characterVisual.scale.setScalar(fit);
   characterVisual.position.set(-center.x*fit,-bounds.min.y*fit,-center.z*fit);
   characterVisual.updateMatrixWorld(true);
   console.info('Modelo militar-male-03 aplicado:',{height:size.y,scale:fit});
  }
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
function animateRig(dt,speed,sprinting,crouch,prone,inputDir=new THREE.Vector3()){
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
 if(['freefall','parachute'].includes(battleSystems?.phase)){
  const falling=exactClip('Fall_Loop','FreeFall_Loop','Jump_Loop','Jump_Start')||idle;
  if(falling!==activeCharacterClip)playCharacterClip(falling);
  characterMixer.update(dt);
  return;
 }
 let clip=idle;
 if(crouch){
  if(!moving)clip=crouchIdle;
  else{
   const local=inputDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-hero.rotation.y);
   const forward=-local.z,side=local.x;
   if(forward<-.45)clip=exactClip('Crouch_Bwd_Loop','Crouch_Bwd_R_Loop','Crouch_Bwd_L_Loop')||crouchMove;
   else if(Math.abs(side)>.65)clip=side<0?(exactClip('Crouch_Left_Loop')||crouchMove):(exactClip('Crouch_Right_Loop')||crouchMove);
   else if(Math.abs(side)>.25)clip=side<0?(exactClip('Crouch_Fwd_L_Loop')||crouchMove):(exactClip('Crouch_Fwd_R_Loop')||crouchMove);
   else clip=exactClip('Crouch_Fwd_Loop')||crouchMove;
  }
 }else if(!grounded)clip=exactClip('Jump_Loop','Jump_Start')||idle;
 else if(moving){
  if(sprinting)clip=sprint;
  else{
   const local=inputDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-hero.rotation.y);
   const forward=-local.z,side=local.x;
   if(forward<-.45)clip=exactClip('Jog_Bwd_Loop','Walk_Bwd_Loop')||walk;
   else if(Math.abs(side)>.65)clip=side<0?(exactClip('Jog_Left_Loop','Walk_Left_Loop')||walk):(exactClip('Jog_Right_Loop','Walk_Right_Loop')||walk);
   else if(Math.abs(side)>.25)clip=side<0?(exactClip('Jog_Fwd_L_Loop','Walk_Fwd_L_Loop')||walk):(exactClip('Jog_Fwd_R_Loop','Walk_Fwd_R_Loop')||walk);
   else clip=walk;
  }
 }
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
 $('reload').addEventListener('pointerdown',e=>{e.preventDefault();if(!reloading&&ammo<(battleSystems?.weapons[battleSystems.weaponIndex].mag||30)&&ammoReserve>0){reloading=true;reloadPoseUntil=performance.now()+1450;$('message').textContent='RECARREGANDO';setTimeout(()=>{const needed=(battleSystems?.weapons[battleSystems.weaponIndex].mag||30)-ammo,loaded=Math.min(needed,ammoReserve);ammo+=loaded;ammoReserve-=loaded;reloading=false;stats();$('message').textContent='COMBATE EM ANDAMENTO'},1450)}});
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
 $('play').addEventListener('click',()=>{$('lobby').style.display='none';started=true;battleSystems?.start()});
 $('weapon').addEventListener('pointerdown',e=>{e.preventDefault();setWeaponMode(!weaponEquipped)});
}
function setPose(p){pose=p;$('poseLabel').textContent='POSTURA: '+(p==='stand'?'EM PÉ':p==='crouch'?'AGACHADO':'DEITADO');$('crouch').classList.toggle('active',p==='crouch');$('prone').classList.toggle('active',p==='prone')}
function stats(){$('ammo').textContent=ammo+' / '+ammoReserve}
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
 const weaponSpec=battleSystems?.weapons[battleSystems.weaponIndex];
 if(reloading||ammo<=0||performance.now()-lastShot<(weaponSpec?.rate||155)){if(ammo<=0&&!reloading)$('message').textContent='SEM MUNIÇÃO — RECARREGUE';return;}
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
  const bot=hitRoot.userData.bot;
  if(bot&&bot.userData.alive){
   const data=bot.userData;data.health=Math.max(0,data.health-(battleSystems?.weapons[battleSystems.weaponIndex].damage||34));data.flashUntil=performance.now()+120;
   if(data.health<=0){data.alive=false;data.respawnAt=performance.now()+6500;bot.visible=false;eliminations++;$('killCount').textContent=eliminations;$('message').textContent='INIMIGO ELIMINADO!';$('message').classList.add('hit');setTimeout(()=>{$('message').classList.remove('hit');if(playerHealth>0)$('message').textContent='COMBATE EM ANDAMENTO'},650)}
   else{$('message').textContent='ACERTO! '+data.health+' HP';}
  }
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
 updateCombatBots(dt);
 battleSystems?.update(dt,moveX,moveY,bots.filter(b=>b.userData.alive).length);
 const dropPhase=['plane','freefall','parachute'].includes(battleSystems?.phase);
 // O sistema de voo já controla o personagem durante a entrada na partida.
 // Evita que o controlador terrestre aplique uma segunda velocidade no mesmo frame.
 if(dropPhase){moveX=0;moveY=0;velocityX=0;velocityZ=0;}
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
 for(const b of worldBlockers){const dx=nextX-b.x,dz=nextZ-b.z;if(b.w!==undefined&&b.d!==undefined){if(Math.abs(dx)<b.w/2+.42&&Math.abs(dz)<b.d/2+.42){blocked=true;break}}else{const min=b.r+.42;if(dx*dx+dz*dz<min*min){blocked=true;break}}}
 if(!blocked){hero.position.x=nextX;hero.position.z=nextZ}else{velocityX*=.18;velocityZ*=.18}
 hero.position.x=THREE.MathUtils.clamp(hero.position.x,-142,142);
 hero.position.z=THREE.MathUtils.clamp(hero.position.z,-142,142);
 if(!grounded){
  velocityY-=17*dt;
  hero.position.y+=velocityY*dt;
  if(hero.position.y<=0){hero.position.y=0;velocityY=0;grounded=true}
 }
 const horizontalSpeed=Math.hypot(velocityX,velocityZ);
 animateRig(dt,horizontalSpeed,sprinting,crouch,prone,inputDir);
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
function resize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6))}
window.addEventListener('error',e=>{const box=$('error');box.hidden=false;box.textContent='Erro ao iniciar: '+e.message});
init();