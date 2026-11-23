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
// Rig humanoide procedural com hierarquia de ossos e membros articulados.
let rig=null,weaponEquipped=true,weaponModel=null;
const skinMat=mat(0xb98262,.82),uniformMat=mat(0x35483d,.92),pantsMat=mat(0x303a34,.95),bootMat=mat(0x202722,.9),gearMat=mat(0x596451,.95);
function bone(parent,name,x,y,z){const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);return b}
function boneCapsule(parent,r,length,material,y=-length/2){const m=mesh(parent,new THREE.CapsuleGeometry(r,length,5,9),material,[0,y,0]);return m}
function joint(parent,r,material){return mesh(parent,new THREE.SphereGeometry(r,10,8),material,[0,0,0])}
function createHumanoidRig(){
 hero=new THREE.Group();hero.position.set(0,0,0);scene.add(hero);
 const pelvis=bone(hero,'Hips',0,1.20,0);joint(pelvis,.19,uniformMat);
 const spine=bone(pelvis,'Spine',0,.08,0);boneCapsule(pelvis,.19,.30,uniformMat,.20);
 const chest=bone(spine,'Chest',0,.31,0);boneCapsule(spine,.235,.40,uniformMat,.18);
 const neck=bone(chest,'Neck',0,.34,0);boneCapsule(chest,.075,.16,skinMat,.09);
 const head=bone(neck,'Head',0,.17,0);joint(head,.145,skinMat);
 const helmet=mesh(head,new THREE.SphereGeometry(.151,12,9,0,Math.PI*2,0,Math.PI*.58),gearMat,[0,.035,0]);helmet.scale.set(1.03,.82,1.04);
 const arms={},legs={};
 for(const side of [-1,1]){
  const key=side<0?'L':'R';
  const shoulder=bone(chest,key+'_Shoulder',side*.27,.23,0);joint(shoulder,.105,uniformMat);
  const upper=bone(shoulder,key+'_UpperArm',0,-.08,0);boneCapsule(shoulder,.09,.32,uniformMat,-.23);
  const elbow=bone(upper,key+'_Elbow',0,-.39,0);joint(elbow,.075,uniformMat);
  const fore=bone(elbow,key+'_Forearm',0,-.04,0);boneCapsule(elbow,.073,.31,uniformMat,-.20);
  const hand=bone(fore,key+'_Hand',0,-.37,0);joint(hand,.065,skinMat);
  const palm=mesh(hand,new THREE.BoxGeometry(.105,.13,.065),skinMat,[0,-.045,-.015]);
  arms[key]={shoulder,upper,elbow,fore,hand};
  const thigh=bone(pelvis,key+'_Thigh',side*.13,-.08,0);joint(thigh,.105,pantsMat);boneCapsule(thigh,.115,.43,pantsMat,-.22);
  const knee=bone(thigh,key+'_Knee',0,-.51,0);joint(knee,.085,pantsMat);
  const calf=bone(knee,key+'_Calf',0,-.04,0);boneCapsule(knee,.085,.39,pantsMat,-.27);
  const ankle=bone(calf,key+'_Ankle',0,-.46,0);joint(ankle,.065,bootMat);
  const foot=bone(ankle,key+'_Foot',0,-.04,-.07);mesh(foot,new THREE.BoxGeometry(.14,.10,.27),bootMat,[0,-.025,-.10]);
  legs[key]={thigh,knee,calf,ankle,foot};
 }
 // Colete, cinto e bolsos presos ao tronco.
 cube(chest,.43,.30,.20,gearMat,0,.04,.105);
 cube(pelvis,.43,.09,.25,bootMat,0,.01,0);
 for(const side of [-1,1])cube(pelvis,.12,.18,.12,gearMat,side*.20,-.10,.02);
 // Rifle simples, preso à mão direita; pode ser ocultado sem perder o rig.
 weaponModel=new THREE.Group();arms.R.hand.add(weaponModel);weaponModel.position.set(0,-.07,-.20);weaponModel.rotation.set(-.12,0,0);
 const gun=mat(0x202722,.55),metal=mat(0x59615b,.42);
 cube(weaponModel,.095,.10,.62,gun,0,0,-.20);
 cube(weaponModel,.075,.16,.20,gun,0,-.12,-.02);
 cube(weaponModel,.055,.055,.40,metal,0,.045,-.47);
 cube(weaponModel,.12,.09,.18,gun,0,-.015,.18);
 cube(weaponModel,.065,.22,.07,gun,0,-.14,-.18);
 rig={pelvis,spine,chest,neck,head,arms,legs};
 setWeaponMode(true);
}
function createPlayerAnchor(){createHumanoidRig()}
function setWeaponMode(equipped){
 weaponEquipped=equipped;
 if(weaponModel)weaponModel.visible=equipped;
 const b=$('weapon');if(b){b.textContent=equipped?'⚔':'✋';b.classList.toggle('active',equipped);b.setAttribute('aria-label',equipped?'Guardar arma':'Equipar arma')}
 $('message').textContent=equipped?'ARMA EQUIPADA':'SEM ARMA';
}
function animateRig(dt,speed,sprinting,crouch,prone){
 if(!rig)return;
 const moving=speed>.18,phase=performance.now()*.009*(sprinting?1.55:1);
 const stride=moving?Math.sin(phase)*Math.min(1,speed/3.2):0;
 const bob=moving?Math.abs(Math.cos(phase))*.025:0;
 const low=prone?-.55:crouch?-.16:0;
 rig.pelvis.position.y=1.20+low+bob+(grounded?0:hero.position.y*.12);
 rig.spine.rotation.x=prone?-.95:crouch?.24:sprinting?.10:0;
 rig.chest.rotation.x=aim&&weaponEquipped?-.08:0;
 rig.head.rotation.x=aim?-.04:0;
 for(const side of [-1,1]){
  const k=side<0?'L':'R',arm=rig.arms[k],leg=rig.legs[k];
  leg.thigh.rotation.x=prone?-.10:stride*side;
  leg.knee.rotation.x=prone?-.15:Math.max(0,-stride*side)*.9+(crouch?.45:0);
  leg.calf.rotation.x=prone?-.12:Math.max(0,stride*side)*.25;
  if(weaponEquipped){
   arm.shoulder.rotation.x=-.82+(aim?-.12:0);arm.shoulder.rotation.z=side*(side<0?-.20:.28);
   arm.upper.rotation.x=-.42;arm.fore.rotation.x=-.48;arm.hand.rotation.x=.05;
  }else{
   arm.shoulder.rotation.x=prone?-.25:stride*side*.8;
   arm.shoulder.rotation.z=side*.08;
   arm.upper.rotation.x=prone?-.25:0;arm.fore.rotation.x=prone?-.2:0;arm.hand.rotation.x=0;
  }
 }
 if(prone){rig.pelvis.rotation.x=-.12;rig.chest.rotation.x=-.28}
 else rig.pelvis.rotation.x=0;
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
 const target=new THREE.Vector3(hero.position.x,hero.position.y+(prone?.55:crouch?1.35:1.82),hero.position.z);
 const baseDist=aim?3.15:sprinting?5.15:5.6;
 const shoulder=aim?.72:1.18;
 const offset=new THREE.Vector3(Math.sin(yaw)*baseDist*Math.cos(pitch)+Math.cos(yaw)*shoulder,baseDist*(.30+Math.sin(-pitch)),Math.cos(yaw)*baseDist*Math.cos(pitch)-Math.sin(yaw)*shoulder);
 cameraDesired.copy(target).add(offset);
 cameraRay.set(target,offset.clone().normalize());cameraRay.far=baseDist;
 const cameraHits=cameraRay.intersectObjects(scene.children,true);
 cameraCurrentDistance=THREE.MathUtils.damp(cameraCurrentDistance,cameraHits.length?Math.max(.9,cameraHits[0].distance-.22):baseDist,18,dt);
 cameraDesired.copy(target).addScaledVector(offset.normalize(),cameraCurrentDistance);
 camera.position.lerp(cameraDesired,1-Math.exp(-dt*(aim?13:8)));
 camera.position.y+=cameraShake*.22;
 cameraRecoil=THREE.MathUtils.damp(cameraRecoil,0,9,dt);
 cameraShake=THREE.MathUtils.damp(cameraShake,0,12,dt);
 camera.fov=THREE.MathUtils.damp(camera.fov,aim?53:sprinting?68:65,8,dt);camera.updateProjectionMatrix();
 camera.lookAt(target.clone().add(new THREE.Vector3(0,cameraRecoil+cameraShake*.12,0)));
 if(shoot&&weaponEquipped)fireShot();
 const cross=$('hud').querySelector('.crosshair');
 if(cross){const spread=1+Math.min(1,horizontalSpeed/6)+(shoot?.55:0)+(aim?-.45:0);cross.style.transform='translate(-50%,-50%) scale('+Math.max(.65,spread)+')'}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(started)update(dt);renderer.render(scene,camera)}
function resize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))}
window.addEventListener('error',e=>{const box=$('error');box.hidden=false;box.textContent='Erro ao iniciar: '+e.message});
init();