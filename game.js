// Inicialização resiliente: tenta dois CDNs e exibe erros de boot na própria tela.
async function startGame(){
 let THREE;
 try{
  THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
 }catch(primaryError){
  try{
   THREE=await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  }catch(backupError){
   throw new Error('Não foi possível carregar o motor 3D. Verifique a conexão e tente novamente. ('+(backupError?.message||primaryError?.message||'falha de rede')+')');
  }
 }
 try{

// ILHA DE COMBATE — mapa tropical original inspirado na variedade de Bermuda.
// Escala e densidade controladas para manter o protótipo utilizável em celulares.
const canvas=document.querySelector('#world');
const isMobile=matchMedia('(max-width: 700px), (pointer: coarse)').matches;
// Perfil conservador para iPhone XR e outros celulares: menos geometria e 30 FPS estáveis.
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9fc7ca);
scene.fog=new THREE.Fog(0x9fc7ca,145,430);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,650);
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isMobile,powerPreference:'low-power',failIfMajorPerformanceCaveat:false});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,isMobile?1:1.35));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=isMobile?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=innerWidth>700;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xdff4ff,0x53634a,2.0));
const sun=new THREE.DirectionalLight(0xffe6bd,2.35);
sun.position.set(-105,155,75);sun.castShadow=innerWidth>700;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-190;sun.shadow.camera.right=190;sun.shadow.camera.top=190;sun.shadow.camera.bottom=-190;
scene.add(sun);

const mat=(color,roughness=.86,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const M={
 grass:mat(0x657d50),sand:mat(0xd0bd91),road:mat(0x555b58),roadEdge:mat(0x8c8b7a),
 concrete:mat(0x9b9a8c),white:mat(0xd4cbb4),yellow:mat(0xb89b63),red:mat(0x8b5142),
 roof:mat(0x514b43),blue:mat(0x567c83),glass:mat(0x294951,.28,.18),wood:mat(0x76543b),
 metal:mat(0x566268,.58,.35),dark:mat(0x252d2c),leaf1:mat(0x315b3b),leaf2:mat(0x47764a),
 trunk:mat(0x62452f),rock:mat(0x77796d),water:new THREE.MeshStandardMaterial({color:0x28788a,roughness:.23,metalness:.16})
};
const world=new THREE.Group();scene.add(world);
const terrainSize=350,segments=isMobile?64:120;
function heightAt(x,z){
 const r=Math.hypot(x,z);
 if(r>151)return -5.8;
 const hills=
  13*Math.exp(-((x+63)**2+(z-47)**2)/1750)+
  9*Math.exp(-((x-55)**2+(z+62)**2)/2100)+
  5*Math.exp(-((x+12)**2+(z+5)**2)/3600)+
  3*Math.sin(x*.035)*Math.cos(z*.031);
 return Math.max(.1,1.15+hills*(1-r/190));
}
const geo=new THREE.PlaneGeometry(terrainSize,terrainSize,segments,segments);
geo.rotateX(-Math.PI/2);
const pos=geo.attributes.position;
const colors=[];
for(let i=0;i<pos.count;i++){
 const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z),h=heightAt(x,z);
 pos.setY(i,h);
 const c=new THREE.Color(r>143?0x9a946f:(h>10?0x526d49:0x718553));
 const variation=.94+((Math.sin(x*1.7+z*.8)*Math.cos(z*1.3))*.045);
 c.multiplyScalar(variation);colors.push(c.r,c.g,c.b);
}
geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
ground.receiveShadow=true;world.add(ground);
const beach=new THREE.Mesh(new THREE.RingGeometry(143,164,128),M.sand);
beach.rotation.x=-Math.PI/2;beach.position.y=-.15;beach.receiveShadow=true;world.add(beach);
const ocean=new THREE.Mesh(new THREE.CircleGeometry(560,128),M.water);
ocean.rotation.x=-Math.PI/2;ocean.position.y=-5.8;scene.add(ocean);
const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(8,16,12),new THREE.MeshBasicMaterial({color:0xffe2a3}));
sunDisc.position.set(-230,190,-260);scene.add(sunDisc);

function addBox(parent,x,y,z,sx,sy,sz,material,cast=true){
 const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);
 m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function groupAt(x,z){const g=new THREE.Group();g.position.set(x,heightAt(x,z),z);world.add(g);return g;}
function makeHouse(x,z,style=0,rot=0,scale=1){
 const g=groupAt(x,z);g.rotation.y=rot;g.scale.setScalar(scale);
 const walls=[M.white,M.yellow,M.blue,M.concrete][style%4];
 addBox(g,0,1.55,0,8,3.1,7,walls);
 // telhado de duas águas estilizado
 const roof=new THREE.Mesh(new THREE.ConeGeometry(6.5,2.7,4),[M.red,M.roof,M.wood][style%3]);
 roof.rotation.y=Math.PI/4;roof.position.y=4.35;roof.scale.z=.78;roof.castShadow=true;g.add(roof);
 for(const side of [-1,1]){
  addBox(g,side*2.25,2.05,-3.54,1.25,1.05,.08,M.glass,false);
  addBox(g,side*2.25,2.05,3.54,1.25,1.05,.08,M.glass,false);
 }
 addBox(g,0,1,-3.57,1.35,2,.1,M.wood,false);
 addBox(g,0,.12,4.2,3,.22,1.3,M.concrete,false);
 return g;
}
function makeBuilding(x,z,w,d,h,color=0,rot=0){
 const g=groupAt(x,z);g.rotation.y=rot;
 const wall=[M.concrete,M.white,M.yellow,M.blue,M.wood][color%5];
 addBox(g,0,h/2,0,w,h,d,wall);
 // faixas de janelas em fachadas
 const floors=Math.max(1,Math.floor(h/3));
 for(let f=0;f<floors;f++)for(let side of [-1,1]){
  const count=Math.max(2,Math.floor(w/3.4));
  for(let i=0;i<count;i++)addBox(g,(i-(count-1)/2)*3.1,1.35+f*3,side*(d/2+.035),1.25,1.15,.07,M.glass,false);
 }
 addBox(g,0,h+.18,0,w+.5,.35,d+.5,M.roof,false);
 return g;
}
function makeTree(x,z,s=1,palm=false){
 const g=groupAt(x,z);g.scale.setScalar(s);
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.34,palm?5.8:3.7,7),M.trunk);
 trunk.position.y=palm?2.9:1.85;trunk.castShadow=true;g.add(trunk);
 if(palm){
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;
   const leaf=new THREE.Mesh(new THREE.ConeGeometry(.42,4.2,5),M.leaf1);
   leaf.position.set(Math.cos(a)*1.55,5.2,Math.sin(a)*1.55);leaf.rotation.z=-Math.cos(a)*.9;leaf.rotation.x=Math.sin(a)*.9;leaf.castShadow=true;g.add(leaf);
  }
 }else{
  for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.ConeGeometry(1.65-i*.18,2.8,7),i%2?M.leaf1:M.leaf2);crown.position.y=3.1+i*.9;crown.castShadow=true;g.add(crown)}
 }
}
function makeRock(x,z,s=1){const g=groupAt(x,z);const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),M.rock);m.position.y=s*.55;m.scale.set(1,.7,1.25);m.castShadow=true;g.add(m)}
function road(points,width=7){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],heightAt(p[0],p[1])+.12,p[1])));
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(40,points.length*18),width/2,7,false),M.road);
 mesh.receiveShadow=true;world.add(mesh);
 // bordas claras finas dão leitura de estrada sem sobrecarregar
}
function districtSign(x,z,label){
 const g=groupAt(x,z);addBox(g,0,2.3,0,7,.25,.25,M.metal,false);
 const post=addBox(g,0,1.15,0,.22,2.3,.22,M.wood,false);
 const board=addBox(g,0,2.9,0,5.8,1.05,.22,M.dark,false);
 const cv=document.createElement('canvas');cv.width=512;cv.height=128;const cx=cv.getContext('2d');
 cx.fillStyle='#24352f';cx.fillRect(0,0,512,128);cx.fillStyle='#e8dfc6';cx.font='bold 48px system-ui';cx.textAlign='center';cx.fillText(label.toUpperCase(),256,82);
 const tex=new THREE.CanvasTexture(cv);const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.5,.9),new THREE.MeshBasicMaterial({map:tex,transparent:false}));
 sign.position.set(0,2.9,.13);g.add(sign);
}

// Rede viária: conecta os bairros, o centro e a costa.
road([[-118,-70],[-82,-42],[-42,-24],[0,-4],[44,20],[90,48],[125,78]],8);
road([[-120,55],[-83,35],[-45,12],[0,-4],[35,-48],[68,-92],[104,-116]],7);
road([[-80,-112],[-48,-80],[-12,-54],[25,-30],[58,-5],[93,20]],6);
road([[-30,120],[-22,75],[-12,34],[0,-4],[8,-48],[15,-95]],6);
road([[0,-4],[42,-4],[83,-8],[120,-16]],5);

// BAIRRO CENTRAL — cidade principal e praça.
makeBuilding(-13,-12,15,12,10,0,.12);makeBuilding(9,-15,12,11,7,1,-.2);
makeBuilding(-17,10,10,13,6,2,.1);makeBuilding(8,12,14,10,9,3,.18);
makeBuilding(29,4,9,12,5,4,-.3);
const plaza=groupAt(0,0);const plazaRing=new THREE.Mesh(new THREE.CylinderGeometry(9,9,.22,32),M.concrete);plazaRing.position.y=.2;plaza.add(plazaRing);
const monument=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.8,5,8),M.yellow);monument.position.set(0,2.8,0);plaza.add(monument);
districtSign(0,-23,'Centro');

// CLOCK TOWER — torre de referência no alto.
const tower=groupAt(-64,47);addBox(tower,0,11,0,9,22,9,M.concrete);
for(let y=5;y<21;y+=5){addBox(tower,0,y,4.58,4,2,.12,M.glass,false);addBox(tower,0,y,-4.58,4,2,.12,M.glass,false)}
const clockFace=new THREE.Mesh(new THREE.CircleGeometry(2.2,24),M.white);clockFace.position.set(0,17,4.66);tower.add(clockFace);
addBox(tower,0,23,0,11,2,11,M.roof);
districtSign(-64,34,'Torre do Relógio');

// PEAK — conjunto residencial em terreno elevado.
for(const [x,z,s] of [[-100,-30,1],[-83,-15,.9],[-105,0,1],[-78,9,.85],[-93,25,.9]])makeHouse(x,z,Math.round((x+z+400)%4),.3,s);
districtSign(-95,-42,'Peak');

// PORTO / SHIPYARD — contêineres, guindaste e cais.
const port=groupAt(104,-78);
for(let i=0;i<9;i++){const x=(i%3)*8-8,z=Math.floor(i/3)*7-7;addBox(port,x,1.5,z,7,3,5,[M.red,M.blue,M.yellow][i%3]);}
addBox(port,18,9,-8,1,18,1,M.metal);addBox(port,11,17,-8,15,.8,1,M.metal);addBox(port,17,12,-8,.8,10,.8,M.metal);
addBox(port,0,.35,15,42,.7,13,M.wood);districtSign(105,-100,'Porto');

// FACTORY / MILL — galpões e chaminé.
const factory=groupAt(92,76);
addBox(factory,0,5,0,30,10,22,M.concrete);addBox(factory,0,10,0,31,1,23,M.roof);
for(let i=-1;i<=1;i++)addBox(factory,i*9,4,11.2,5,5,.18,M.glass,false);
const chimney=new THREE.Mesh(new THREE.CylinderGeometry(2,2.8,20,10),M.red);chimney.position.set(20,10,-7);factory.add(chimney);
addBox(factory,-27,3,-5,18,6,17,M.metal);districtSign(92,58,'Fábrica');

// HANGAR / AERÓDROMO — pista e hangares.
const runway=addBox(world,-105,heightAt(-105,-90)+.18,-90,18,.25,78,M.road,false);
for(let i=0;i<8;i++)addBox(world,-105,heightAt(-105,-90)+.33,-122+i*9,.5,.05,4,M.white,false);
makeBuilding(-130,-83,22,20,9,0,0);makeBuilding(-77,-82,18,17,7,1,.1);districtSign(-105,-53,'Aeródromo');

// VILA COSTEIRA — casas baixas e cais de pesca.
for(const [x,z,rot] of [[-120,94,.2],[-101,111,-.4],[-77,102,.8],[-57,119,-.2],[-35,105,.5]])makeHouse(x,z,Math.floor((x+300)%4),rot,.85);
const dock=groupAt(-92,137);addBox(dock,0,.25,0,32,.5,7,M.wood);for(let i=-2;i<=2;i++)addBox(dock,i*7,-.7,0,.5,2,.5,M.wood);
districtSign(-105,82,'Vila da Praia');

// ILHA SECUNDÁRIA + ponte de ligação.
const islet=new THREE.Mesh(new THREE.CylinderGeometry(25,28,3,48),M.grass);islet.position.set(0,-1.1,187);world.add(islet);
const isletSand=new THREE.Mesh(new THREE.CylinderGeometry(29,31,1.2,48),M.sand);isletSand.position.set(0,-2.4,187);world.add(isletSand);
for(let i=0;i<6;i++)makeTree(-16+i*6,184+(i%2)*7,.8,i%2===0);
makeHouse(0,190,1,.2,.8);
const bridge=addBox(world,0,-.15,161,8,.8,42,M.wood);for(let i=0;i<12;i++){addBox(world,-4.5,-1,144+i*3.2,.5,2,.5,M.wood);addBox(world,4.5,-1,144+i*3.2,.5,2,.5,M.wood)}

// Floresta tropical em manchas, preservando corredores de passagem e visibilidade.
let seed=90210;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
for(let i=0;i<(isMobile?65:185);i++){
 const a=rand()*Math.PI*2,r=38+rand()*96,x=Math.cos(a)*r,z=Math.sin(a)*r;
 // deixa os centros dos bairros e estradas mais livres
 const near=(cx,cz,rad)=>Math.hypot(x-cx,z-cz)<rad;
 if(near(0,0,34)||near(-64,47,18)||near(104,-78,26)||near(92,76,30)||near(-105,-90,26)||near(-92,110,30))continue;
 makeTree(x,z,.68+rand()*.62,rand()>.72);
}
for(let i=0;i<(isMobile?12:34);i++){const a=rand()*Math.PI*2,r=75+rand()*65;makeRock(Math.cos(a)*r,Math.sin(a)*r,.7+rand()*1.2)}
// Palmeiras nas praias.
for(let i=0;i<(isMobile?16:38);i++){const a=rand()*Math.PI*2,r=133+rand()*9;makeTree(Math.cos(a)*r,Math.sin(a)*r,.7+rand()*.35,true)}

// Operador de teste.
const player=new THREE.Group();scene.add(player);const body=new THREE.Group();player.add(body);
const skin=mat(0xb88768),uniform=mat(0x354b43),pants=mat(0x293a34),gear=mat(0x59665a),boots=mat(0x171d1d),detail=mat(0x202a27);
function limb(parent,material,r,len,x,y,z){const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,4,8),material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.72,5,10),uniform);torso.position.y=1.65;torso.castShadow=true;body.add(torso);
const neck=new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.22,10),skin);neck.position.y=2.16;body.add(neck);
// Colete tático, bolsos, cinto e mochila dão volume humano ao operador.
for(let side of [-1,1]){addBox(body,side*.25,1.55,.36,.22,.27,.13,gear);addBox(body,side*.23,1.25,.02,.2,.13,.12,detail)}
addBox(body,0,1.63,-.34,.62,.72,.25,gear);addBox(body,0,1.27,0,.78,.13,.5,detail);
const vest=new THREE.Mesh(new THREE.BoxGeometry(.83,.7,.42),gear);vest.position.set(0,1.67,.12);body.add(vest);
const head=new THREE.Mesh(new THREE.SphereGeometry(.28,16,12),skin);head.position.y=2.48;body.add(head);
const helmet=new THREE.Mesh(new THREE.SphereGeometry(.31,16,10,0,Math.PI*2,0,Math.PI*.56),M.dark);helmet.position.y=2.58;body.add(helmet);
// Rosto legível em terceira pessoa: orelhas, nariz e olhos.
for(const side of [-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.065,8,8),skin);ear.position.set(side*.275,2.46,0);body.add(ear);const eye=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),detail);eye.position.set(side*.105,2.49,.255);body.add(eye)}
const nose=new THREE.Mesh(new THREE.ConeGeometry(.055,.13,6),skin);nose.rotation.x=Math.PI/2;nose.position.set(0,2.43,.29);body.add(nose);
const arms=[],legs=[];
for(const side of [-1,1]){
 const arm=new THREE.Group();arm.position.set(side*.58,2.05,0);body.add(arm);limb(arm,uniform,.17,.62,0,-.38,0);
 const hand=new THREE.Mesh(new THREE.SphereGeometry(.14,10,8),skin);hand.position.set(0,-.79,.04);arm.add(hand);arms.push(arm);
 const leg=new THREE.Group();leg.position.set(side*.25,1.08,0);body.add(leg);limb(leg,pants,.21,.68,0,-.38,0);
 addBox(leg,0,-.83,.12,.38,.22,.62,boots);legs.push(leg);
}
const gun=new THREE.Group();gun.position.set(.32,1.82,.55);body.add(gun);addBox(gun,0,0,0,.18,.18,1.05,M.dark);addBox(gun,0,-.13,-.12,.14,.23,.3,gear);
player.position.set(0,heightAt(0,35),35);

// Alvos de treinamento distribuídos perto do centro.
const targets=[];
for(const [x,z] of [[-35,-36],[37,-43],[47,38],[-43,70],[20,75]]){
 const t=groupAt(x,z);const tm=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,1.35,8),M.red);tm.position.y=1.05;t.add(tm);
 const th=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),skin);th.position.y=1.95;t.add(th);t.userData.hp=100;targets.push(t);
}

const keys={};addEventListener('keydown',e=>keys[e.code]=true);addEventListener('keyup',e=>keys[e.code]=false);
let joyX=0,joyY=0,yaw=0,pitch=.12,vertical=0,grounded=true,ammo=30,reserveAmmo=120,fireCooldown=0,walkClock=0;
let sprinting=false,crouching=false,aiming=false,isFiring=false,reloading=false;
const joy=document.querySelector('#joystick'),stick=document.querySelector('#stick');let joyPointer=null;
function setJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.max(1,Math.hypot(dx,dy)),k=Math.min(1,46/len);joyX=dx/46*k;joyY=dy/46*k;stick.style.transform=`translate(${joyX*36}px,${joyY*36}px)`}
joy.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joy.setPointerCapture(joyPointer);setJoy(e)});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)setJoy(e)});
function endJoy(e){if(e.pointerId===joyPointer){joyPointer=null;joyX=joyY=0;stick.style.transform='translate(0,0)'}}
joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
let lookPointer=null,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{if(e.clientX>innerWidth*.35){lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)}});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===lookPointer){yaw-=(e.clientX-lastX)*.004;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.003,-.18,.65);lastX=e.clientX;lastY=e.clientY}});
function endLook(e){if(e.pointerId===lookPointer)lookPointer=null}
canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
document.querySelector('#jump').addEventListener('pointerdown',()=>{if(grounded&&!crouching){vertical=6.5;grounded=false}});
const sprintBtn=document.querySelector('#sprint'),crouchBtn=document.querySelector('#crouch'),aimBtn=document.querySelector('#aimBtn'),reloadBtn=document.querySelector('#reload');
sprintBtn.addEventListener('pointerdown',()=>{sprinting=!sprinting;sprintBtn.classList.toggle('active',sprinting)});
crouchBtn.addEventListener('pointerdown',()=>{crouching=!crouching;crouchBtn.classList.toggle('active',crouching);if(crouching){sprinting=false;sprintBtn.classList.remove('active')}});
aimBtn.addEventListener('pointerdown',()=>{aiming=!aiming;aimBtn.classList.toggle('active',aiming)});
reloadBtn.addEventListener('pointerdown',()=>{if(!reloading&&ammo<30&&reserveAmmo>0){reloading=true;reloadBtn.classList.add('active');toast('RECARREGANDO');setTimeout(()=>{const amount=Math.min(30-ammo,reserveAmmo);ammo+=amount;reserveAmmo-=amount;reloading=false;reloadBtn.classList.remove('active');document.querySelector('#ammo').innerHTML=ammo+' <small>/ '+reserveAmmo+'</small>';},1100)}});
const raycaster=new THREE.Raycaster();
function toast(s){const el=document.querySelector('#toast');el.textContent=s;el.style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.opacity=0,1400)}
function shoot(){
 if(fireCooldown>0||reloading)return;if(ammo<=0){toast('SEM MUNIÇÃO');return}
 ammo--;document.querySelector('#ammo').innerHTML=ammo+' <small>/ '+reserveAmmo+'</small>';fireCooldown=.16;
 const origin=new THREE.Vector3();camera.getWorldPosition(origin);const dir=new THREE.Vector3();camera.getWorldDirection(dir);
 raycaster.set(origin,dir);const hits=raycaster.intersectObjects(targets,true);
 if(hits.length){let obj=hits[0].object;while(obj.parent&&!targets.includes(obj))obj=obj.parent;if(targets.includes(obj)){obj.userData.hp-=34;if(obj.userData.hp<=0){world.remove(obj);targets.splice(targets.indexOf(obj),1);toast('ALVO ELIMINADO')}}}
}
const fireBtn=document.querySelector('#fire');fireBtn.addEventListener('pointerdown',e=>{e.preventDefault();isFiring=true;shoot()});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])fireBtn.addEventListener(ev,()=>isFiring=false);

// Minimapa estilizado: costa, estradas e posição do operador.
const mapCanvas=document.createElement('canvas');mapCanvas.width=180;mapCanvas.height=180;
mapCanvas.style.cssText='position:absolute;right:14px;top:calc(env(safe-area-inset-top) + 112px);width:112px;height:112px;border:2px solid #d8e7d8;border-radius:50%;background:#152b2b;opacity:.88;pointer-events:none;z-index:2';
document.querySelector('#game').appendChild(mapCanvas);
const mx=mapCanvas.getContext('2d');
function drawMap(){
 mx.clearRect(0,0,180,180);mx.fillStyle='#28788a';mx.fillRect(0,0,180,180);
 mx.beginPath();mx.arc(90,90,77,0,Math.PI*2);mx.fillStyle='#718553';mx.fill();
 mx.beginPath();mx.arc(90,90,70,0,Math.PI*2);mx.strokeStyle='#d0bd91';mx.lineWidth=5;mx.stroke();
 mx.strokeStyle='#555b58';mx.lineWidth=4;mx.beginPath();mx.moveTo(18,126);mx.lineTo(55,103);mx.lineTo(90,90);mx.lineTo(135,66);mx.lineTo(160,45);mx.stroke();
 mx.fillStyle='#d7c8a2';for(const [x,z] of [[0,0],[-64,47],[104,-78],[92,76],[-105,-90],[-92,110]]){mx.beginPath();mx.arc(90+x*.43,90+z*.43,3,0,Math.PI*2);mx.fill()}
 const px=90+player.position.x*.43,pz=90+player.position.z*.43;mx.fillStyle='#ffdf62';mx.beginPath();mx.arc(px,pz,5,0,Math.PI*2);mx.fill();mx.strokeStyle='#18231e';mx.lineWidth=2;mx.stroke();
}
const clock=new THREE.Clock(),camTarget=new THREE.Vector3(),camPos=new THREE.Vector3();
let mapTick=0,lastMobileFrame=0;
let firstFrameDone=false;
function frame(){
 try{
 requestAnimationFrame(frame);
 const now=performance.now();
 if(isMobile&&now-lastMobileFrame<33)return;
 lastMobileFrame=now;
 const dt=Math.min(clock.getDelta(),.04);fireCooldown=Math.max(0,fireCooldown-dt);
 const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joyY;
 const s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joyX;
 const mag=Math.hypot(f,s);let ff=f,ss=s;if(mag>1){ff/=mag;ss/=mag}
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const move=forward.multiplyScalar(ff).add(right.multiplyScalar(ss));
 const moveSpeed=crouching?2.6:(sprinting?10.2:7.1);
 if(move.lengthSq()>.001){player.position.addScaledVector(move,moveSpeed*dt);player.rotation.y=Math.atan2(move.x,move.z);walkClock+=dt*(sprinting?14:10)}else walkClock+=dt*2;
 if(isFiring)shoot();
 body.position.y+=(crouching?-.38:0-body.position.y)*Math.min(1,dt*10);
 const r=Math.hypot(player.position.x,player.position.z);if(r>148){player.position.x*=148/r;player.position.z*=148/r}
 const floor=heightAt(player.position.x,player.position.z);
 vertical-=18*dt;player.position.y+=vertical*dt;
 if(player.position.y<=floor){player.position.y=floor;vertical=0;grounded=true}
 legs[0].rotation.x=Math.sin(walkClock)*Math.min(1,mag)*.65;legs[1].rotation.x=-legs[0].rotation.x;
 arms[0].rotation.x=-legs[0].rotation.x*.65;arms[1].rotation.x=-legs[1].rotation.x*.65;
 const target=player.position.clone().add(new THREE.Vector3(0,2,0));
 const cameraDistance=aiming?4.8:8;
 const offset=new THREE.Vector3(Math.sin(yaw)*cameraDistance, (crouching?2.65:3.3)+pitch*3,Math.cos(yaw)*cameraDistance);
 camPos.copy(target).add(offset);camera.position.lerp(camPos,1-Math.exp(-8*dt));camera.fov+=((aiming?48:62)-camera.fov)*Math.min(1,dt*8);camera.updateProjectionMatrix();camera.lookAt(target);
 // água com pequena variação de cor, sem shader pesado.
 ocean.material.color.setHSL(.53,.48,.31+Math.sin(clock.elapsedTime*.35)*.012);
 if((mapTick+=dt)>.15){drawMap();mapTick=0}
 renderer.render(scene,camera);
 if(!firstFrameDone){firstFrameDone=true;const loading=document.querySelector('#loading');if(loading)loading.style.display='none';toast('MAPA TROPICAL · PRIMEIRA VERSÃO');}
 }catch(error){
  const loading=document.querySelector('#loading'),panel=document.querySelector('#error');
  if(loading)loading.style.display='none';
  if(panel){panel.hidden=false;panel.textContent='ERRO NA RENDERIZAÇÃO 3D: '+(error?.message||String(error));}
  console.error('Erro no frame 3D:',error);
 }
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,isMobile?1:1.35));renderer.setSize(innerWidth,innerHeight)});
frame();

 }catch(error){
  const loading=document.querySelector('#loading');
  const panel=document.querySelector('#error');
  if(loading)loading.style.display='none';
  if(panel){
   panel.hidden=false;
   panel.textContent='NÃO FOI POSSÍVEL INICIAR O JOGO. '+(error&&error.message?error.message:'Erro inesperado')+' Atualize a página e tente novamente.';
  }
  console.error('Falha ao iniciar Ilha de Combate:',error);
 }
}
startGame().catch(error=>{
 const loading=document.querySelector('#loading');
 const panel=document.querySelector('#error');
 if(loading)loading.style.display='none';
 if(panel){panel.hidden=false;panel.textContent='FALHA AO CARREGAR O JOGO. '+(error?.message||'Verifique a conexão e tente novamente.');}
 console.error(error);
});
