import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js';

const root=document.querySelector('#game');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x91c5d5);
scene.fog=new THREE.Fog(0x91c5d5,35,115);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,250);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;root.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdff5ff,0x64734a,2));
const sun=new THREE.DirectionalLight(0xffedc4,2.2);sun.position.set(-25,40,20);scene.add(sun);
const mat=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness});
const sand=mat(0xd8c18c),grass=mat(0x477d45),wood=mat(0x765038),roof=mat(0x9c4933),leaf=mat(0x24613a),skin=mat(0xd69a70),shirt=mat(0x235b72),pants=mat(0x273342),dark=mat(0x20252b),enemyMat=mat(0x9b392c);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.12;scene.add(ground);
const beach=new THREE.Mesh(new THREE.RingGeometry(48,85,64),sand);beach.rotation.x=-Math.PI/2;beach.position.y=-.08;scene.add(beach);
const water=new THREE.Mesh(new THREE.PlaneGeometry(500,500),new THREE.MeshStandardMaterial({color:0x267f9c,roughness:.35}));water.rotation.x=-Math.PI/2;water.position.y=-.3;scene.add(water);
function box(x,y,z,sx,sy,sz,material){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);m.position.set(x,y,z);scene.add(m);return m}
function tree(x,z){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,2,7),wood);trunk.position.set(x,1,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.SphereGeometry(1.45,7,6),leaf);crown.scale.set(1,1.1,1);crown.position.set(x,2.65,z);scene.add(crown)}
for(let i=0;i<46;i++){const a=i*2.399,r=13+(i%8)*7;tree(Math.cos(a)*r,Math.sin(a)*r)}
function house(x,z,w=6,d=5){box(x,1,z,w,2,d,mat(0xd7c7a4));const r=box(x,2.35,z,w+1,.35,d+1,roof);r.rotation.z=.08;box(x,0.65,z-d/2-.02,1.1,1.3,.1,wood)}
house(-10,-12);house(10,-20,7,6);house(20,5,6,5);house(-22,12,7,6);
const player=new THREE.Group();scene.add(player);
const torso=new THREE.Mesh(new THREE.BoxGeometry(.72,1,.4),shirt);torso.position.y=1.45;player.add(torso);
const head=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),skin);head.position.y=2.12;player.add(head);
const legL=new THREE.Mesh(new THREE.BoxGeometry(.25,.7,.3),pants);legL.position.set(-.2,.65,0);player.add(legL);
const legR=legL.clone();legR.position.x=.2;player.add(legR);
const gun=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.85),dark);gun.position.set(.48,1.5,.35);player.add(gun);
player.position.set(0,0,8);
const enemies=[];
for(let i=0;i<5;i++){const e=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.45),enemyMat);body.position.y=1; e.add(body);const h=new THREE.Mesh(new THREE.SphereGeometry(.23,8,7),skin);h.position.y=1.75;e.add(h);e.position.set((i-2)*7,0,-12-(i%2)*8);scene.add(e);enemies.push({mesh:e,hp:60,alive:true})}
let yaw=0,pitch=-.12,health=100,ammo=30,score=0,vy=0,onGround=true;
const joystick=document.querySelector('#joystick'),stick=document.querySelector('#stick');let joy={x:0,y:0},joyId=null;
function setJoy(ev){const r=joystick.getBoundingClientRect(),dx=ev.clientX-(r.left+r.width/2),dy=ev.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy),max=42,k=Math.min(1,max/(len||1));joy.x=dx*k/max;joy.y=-dy*k/max;stick.style.transform=`translate(${joy.x*42}px,${-joy.y*42}px)`}
joystick.addEventListener('pointerdown',e=>{joyId=e.pointerId;joystick.setPointerCapture(joyId);setJoy(e)});joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)setJoy(e)});function endJoy(){joy={x:0,y:0};joyId=null;stick.style.transform='translate(0,0)'}joystick.addEventListener('pointerup',endJoy);joystick.addEventListener('pointercancel',endJoy);
const look=document.querySelector('#lookArea');let lookId=null,lastX=0,lastY=0;look.addEventListener('pointerdown',e=>{lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;look.setPointerCapture(lookId)});look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.006;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-.65,.35)});function endLook(){lookId=null}look.addEventListener('pointerup',endLook);look.addEventListener('pointercancel',endLook);
document.querySelector('#jump').addEventListener('click',()=>{if(onGround){vy=6;onGround=false}});
document.querySelector('#reload').addEventListener('click',()=>{document.querySelector('#status').textContent='RECARREGANDO';setTimeout(()=>{ammo=30;document.querySelector('#ammo').textContent='MUNIÇÃO '+ammo;document.querySelector('#status').textContent='PRONTO'},1100)});
document.querySelector('#fire').addEventListener('click',()=>{if(ammo<=0){document.querySelector('#status').textContent='RECARREGUE';return}ammo--;document.querySelector('#ammo').textContent='MUNIÇÃO '+ammo;let best=null,bd=1e9;for(const e of enemies){if(!e.alive)continue;const p=e.mesh.position.clone().add(new THREE.Vector3(0,1,0)),dir=p.clone().sub(camera.position).normalize(),dot=dir.dot(camera.getWorldDirection(new THREE.Vector3()));const d=p.distanceTo(camera.position);if(dot>.985&&d<bd){best=e;bd=d}}if(best){best.hp-=30;if(best.hp<=0){best.alive=false;scene.remove(best.mesh);score++;document.querySelector('#score').textContent='ELIMINAÇÕES '+score}}});
const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));const move=forward.multiplyScalar(joy.y).add(right.multiplyScalar(joy.x));if(move.lengthSq()>.01){move.normalize();player.position.addScaledVector(move,5*dt);player.rotation.y=Math.atan2(move.x,move.z)}vy-=16*dt;player.position.y+=vy*dt;if(player.position.y<=0){player.position.y=0;vy=0;onGround=true}player.position.x=THREE.MathUtils.clamp(player.position.x,-42,42);player.position.z=THREE.MathUtils.clamp(player.position.z,-42,42);const target=new THREE.Vector3(player.position.x+Math.sin(yaw)*5,player.position.y+2.9+pitch*2,player.position.z+Math.cos(yaw)*5);camera.position.lerp(target,1-Math.exp(-8*dt));camera.lookAt(player.position.x,player.position.y+1.4,player.position.z);renderer.render(scene,camera)}
animate();document.querySelector('#loading').style.display='none';
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
