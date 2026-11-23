import * as THREE from 'three';

const canvas=document.querySelector('#world');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9bc4c5);
scene.fog=new THREE.Fog(0x9bc4c5,85,260);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,500);
const renderer=new THREE.WebGLRenderer({canvas,antialias:innerWidth>700,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.7));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=innerWidth>700;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;

scene.add(new THREE.HemisphereLight(0xd8f1ff,0x56644b,2.0));
const sun=new THREE.DirectionalLight(0xffedcf,2.5);sun.position.set(-55,85,35);sun.castShadow=innerWidth>700;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-90;sun.shadow.camera.right=90;sun.shadow.camera.top=90;sun.shadow.camera.bottom=-90;scene.add(sun);

const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
const groundMat=mat(0x71845b),sandMat=mat(0xc6b78e),waterMat=new THREE.MeshStandardMaterial({color:0x367f91,roughness:.28,metalness:.12});
const ground=new THREE.Mesh(new THREE.CircleGeometry(112,96),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const beach=new THREE.Mesh(new THREE.RingGeometry(112,128,96),sandMat);beach.rotation.x=-Math.PI/2;beach.position.y=.03;scene.add(beach);
const ocean=new THREE.Mesh(new THREE.CircleGeometry(390,96),waterMat);ocean.rotation.x=-Math.PI/2;ocean.position.y=-.55;scene.add(ocean);

const world=new THREE.Group();scene.add(world);
function box(parent,x,y,z,sx,sy,sz,material){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function makeTree(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);world.add(g);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,3.4,7),mat(0x65472e));trunk.position.y=1.7;trunk.castShadow=true;g.add(trunk);for(let i=0;i<5;i++){const crown=new THREE.Mesh(new THREE.ConeGeometry(1.25-i*.12,2.2,7),mat(i%2?0x315d3d:0x3d7044));crown.position.set(0,3.1+i*.45,0);crown.castShadow=true;g.add(crown)}}
function makeHouse(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;world.add(g);box(g,0,1.4,0,8,2.8,7,mat(0xc6b99b));const roof=new THREE.Mesh(new THREE.ConeGeometry(6.2,2.7,4),mat(0x765044));roof.rotation.y=Math.PI/4;roof.position.y=4.05;roof.scale.z=.78;roof.castShadow=true;g.add(roof);box(g,0,1,-3.53,1.25,2,.08,mat(0x344b50));box(g,-2.2,1.8,-3.57,1.1,1,.1,mat(0x6d9a9b));box(g,2.2,1.8,-3.57,1.1,1,.1,mat(0x6d9a9b))}
for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=75+(i%4)*9;makeTree(Math.cos(a)*r,Math.sin(a)*r,.8+(i%3)*.15)}
makeHouse(-20,-18,.2);makeHouse(-5,-24,-.3);makeHouse(17,-17,.5);makeHouse(28,3,-.6);makeHouse(-28,17,.9);makeHouse(5,27,0);
for(let i=0;i<34;i++){const a=i*2.399,r=35+(i%7)*4;makeTree(Math.cos(a)*r,Math.sin(a)*r,.55+(i%4)*.13)}
// Caminho central e pequenos pontos de referência.
const road=new THREE.Mesh(new THREE.PlaneGeometry(12,110),mat(0x77786b));road.rotation.x=-Math.PI/2;road.position.set(0,.045,0);world.add(road);
for(let i=0;i<12;i++)box(world,-7,.08,-48+i*8,.18,.04,2.2,mat(0xe1d8b6));

// Operador procedural inicial: geometria local, sem baixar modelos externos.
const player=new THREE.Group();scene.add(player);
const body=new THREE.Group();player.add(body);
const skin=mat(0xb88768),uniform=mat(0x354b43),dark=mat(0x202b2b),boots=mat(0x171d1d),gear=mat(0x59665a);
function limb(parent,material,r1,r2,len,x,y,z){const m=new THREE.Mesh(new THREE.CapsuleGeometry(r1,len,4,8),material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.72,5,10),uniform);torso.position.y=1.65;torso.castShadow=true;body.add(torso);
const vest=new THREE.Mesh(new THREE.BoxGeometry(.83,.7,.42),gear);vest.position.set(0,1.67,.12);body.add(vest);
const head=new THREE.Mesh(new THREE.SphereGeometry(.28,16,12),skin);head.position.y=2.48;head.castShadow=true;body.add(head);
const helmet=new THREE.Mesh(new THREE.SphereGeometry(.31,16,10,0,Math.PI*2,0,Math.PI*.56),dark);helmet.position.y=2.58;body.add(helmet);
const arms=[],legs=[];
for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.58,2.05,0);body.add(arm);limb(arm,uniform,.17,.17,.62,0,-.38,0);const hand= new THREE.Mesh(new THREE.SphereGeometry(.14,10,8),skin);hand.position.set(0,-.79,.04);arm.add(hand);arms.push(arm);const leg=new THREE.Group();leg.position.set(side*.25,1.08,0);body.add(leg);limb(leg,uniform,.21,.2,.68,0,-.38,0);box(leg,0,-.83,.12,.38,.22,.62,boots);legs.push(leg)}
const gun=new THREE.Group();gun.position.set(.32,1.82,.55);body.add(gun);box(gun,0,0,0,.18,.18,1.05,dark);box(gun,0,-.13,-.12,.14,.23,.3,gear);
player.position.set(0,0,5);

const targets=[];
for(const [x,z] of [[-18,-32],[12,-42],[35,8],[-38,22],[5,45]]){const t=new THREE.Group();t.position.set(x,0,z);world.add(t);const torsoT=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,1.35,8),mat(0x9a4f3d));torsoT.position.y=1.05;t.add(torsoT);const headT=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),skin);headT.position.y=1.95;t.add(headT);t.userData.hp=100;targets.push(t)}
const keys={};addEventListener('keydown',e=>keys[e.code]=true);addEventListener('keyup',e=>keys[e.code]=false);
let joyX=0,joyY=0,yaw=0,pitch=.12,vertical=0,grounded=true,ammo=30,fireCooldown=0,walkClock=0;
const joy=document.querySelector('#joystick'),stick=document.querySelector('#stick');let joyPointer=null;
function setJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.max(1,Math.hypot(dx,dy)),k=Math.min(1,46/len);joyX=dx/46*k;joyY=dy/46*k;stick.style.transform=`translate(${joyX*36}px,${joyY*36}px)`}
joy.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joy.setPointerCapture(joyPointer);setJoy(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)setJoy(e)});function endJoy(e){if(e.pointerId===joyPointer){joyPointer=null;joyX=joyY=0;stick.style.transform='translate(0,0)'}}joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
let lookPointer=null,lastX=0,lastY=0;canvas.addEventListener('pointerdown',e=>{if(e.clientX>innerWidth*.35){lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)}});canvas.addEventListener('pointermove',e=>{if(e.pointerId===lookPointer){yaw-=(e.clientX-lastX)*.004;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.003,-.18,.65);lastX=e.clientX;lastY=e.clientY}});function endLook(e){if(e.pointerId===lookPointer)lookPointer=null}canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
document.querySelector('#jump').addEventListener('pointerdown',()=>{if(grounded){vertical=6.5;grounded=false}});
const raycaster=new THREE.Raycaster();
function shoot(){if(fireCooldown>0)return;if(ammo<=0){toast('SEM MUNIÇÃO');return}ammo--;document.querySelector('#ammo').innerHTML=ammo+' <small>/ 120</small>';fireCooldown=.16;const origin=new THREE.Vector3();camera.getWorldPosition(origin);const dir=new THREE.Vector3();camera.getWorldDirection(dir);raycaster.set(origin,dir);const hits=raycaster.intersectObjects(targets,true);if(hits.length){let obj=hits[0].object;while(obj.parent&&!targets.includes(obj))obj=obj.parent;if(targets.includes(obj)){obj.userData.hp-=34;if(obj.userData.hp<=0){world.remove(obj);targets.splice(targets.indexOf(obj),1);toast('ALVO ELIMINADO')}}}}
const fire=document.querySelector('#fire');fire.addEventListener('pointerdown',e=>{e.preventDefault();shoot()});
function toast(s){const el=document.querySelector('#toast');el.textContent=s;el.style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.opacity=0,1300)}
const clock=new THREE.Clock();const camTarget=new THREE.Vector3(),camPos=new THREE.Vector3();
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.04);fireCooldown=Math.max(0,fireCooldown-dt);
let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joyY;let s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joyX;const mag=Math.hypot(f,s);if(mag>1){f/=mag;s/=mag}
const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));const move=forward.multiplyScalar(f).add(right.multiplyScalar(s));if(move.lengthSq()>.001){player.position.addScaledVector(move,5.2*dt);player.rotation.y=Math.atan2(move.x,move.z);walkClock+=dt*10}else walkClock+=dt*2;
player.position.x=THREE.MathUtils.clamp(player.position.x,-100,100);player.position.z=THREE.MathUtils.clamp(player.position.z,-100,100);
vertical-=18*dt;player.position.y+=vertical*dt;if(player.position.y<=0){player.position.y=0;vertical=0;grounded=true}
legs[0].rotation.x=Math.sin(walkClock)*Math.min(1,mag)*.65;legs[1].rotation.x=-legs[0].rotation.x;arms[0].rotation.x=-legs[0].rotation.x*.65;arms[1].rotation.x=-legs[1].rotation.x*.65;
const target=player.position.clone().add(new THREE.Vector3(0,2.0,0));const offset=new THREE.Vector3(Math.sin(yaw)*7,3.1+pitch*3,Math.cos(yaw)*7);camPos.copy(target).add(offset);camera.position.lerp(camPos,1-Math.exp(-8*dt));camera.lookAt(target);
renderer.render(scene,camera)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.7));renderer.setSize(innerWidth,innerHeight)});
document.querySelector('#loading').style.display='none';toast('NOVO PROJETO 3D · PROTÓTIPO 01');frame();
