const root=document.querySelector('#game');
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
root.appendChild(canvas);
let W=innerWidth,H=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
function resize(){W=innerWidth;H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();
const heroImg=new Image();heroImg.src='./character.svg';
const world={width:2600,height:900,ground:690};
const player={x:240,y:world.ground-290,vx:0,vy:0,face:1,hp:100,alive:true};
const enemies=Array.from({length:5},(_,i)=>({x:650+i*340,y:world.ground-210,vx:0,hp:90,alive:true,phase:i*1.3}));
const bullets=[];let ammo=30,kills=0,score=0,joy={x:0,y:0},jumping=false,last=0,cam=0;
const joystick=document.querySelector('#joystick'),stick=document.querySelector('#stick');let joyId=null;
function setJoy(e){const r=joystick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy),k=Math.min(1,42/(len||1));joy.x=dx*k/42;joy.y=dy*k/42;stick.style.transform=`translate(${joy.x*42}px,${joy.y*42}px)`}
joystick.addEventListener('pointerdown',e=>{joyId=e.pointerId;joystick.setPointerCapture(joyId);setJoy(e)});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)setJoy(e)});
function endJoy(){joy={x:0,y:0};joyId=null;stick.style.transform='translate(0,0)'}
joystick.addEventListener('pointerup',endJoy);joystick.addEventListener('pointercancel',endJoy);
document.querySelector('#lookArea').style.display='none';
document.querySelector('#jump').addEventListener('click',()=>{if(player.y>=world.ground-290){player.vy=-610;jumping=true}});
document.querySelector('#reload').addEventListener('click',()=>{document.querySelector('#status').textContent='RECARREGANDO';setTimeout(()=>{ammo=30;document.querySelector('#ammo').textContent='MUNIÇÃO '+ammo;document.querySelector('#status').textContent='PRONTO'},900)});
document.querySelector('#fire').addEventListener('click',fire);
function fire(){if(ammo<=0){document.querySelector('#status').textContent='RECARREGUE';return}ammo--;document.querySelector('#ammo').textContent='MUNIÇÃO '+ammo;bullets.push({x:player.x+player.face*48,y:player.y+86,vx:player.face*920,life:1.5});}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function drawBackground(){ctx.fillStyle='#7fc5d3';ctx.fillRect(0,0,W,H);const groundY=world.ground;
ctx.fillStyle='#d8c18d';ctx.fillRect(0,groundY-10,world.width,world.height-groundY+10);
ctx.fillStyle='#477b45';ctx.fillRect(0,groundY,world.width,world.height-groundY);
for(let i=0;i<world.width;i+=170){const x=i;ctx.fillStyle='#76513a';ctx.fillRect(x,groundY-150,13,150);ctx.fillStyle='#23613c';for(let a=0;a<6;a++){ctx.beginPath();ctx.ellipse(x+6+Math.cos(a)*43,groundY-158+Math.sin(a)*23,48,13,a*.8,0,Math.PI*2);ctx.fill()}}
for(let i=0;i<8;i++){const x=220+i*330;ctx.fillStyle='#e1d2b5';ctx.fillRect(x,groundY-170,120,160);ctx.fillStyle='#a64935';ctx.beginPath();ctx.moveTo(x-12,groundY-170);ctx.lineTo(x+60,groundY-225);ctx.lineTo(x+132,groundY-170);ctx.fill();ctx.fillStyle='#6b4931';ctx.fillRect(x+47,groundY-90,28,80);ctx.fillStyle='#7cb5bb';ctx.fillRect(x+12,groundY-140,27,30);ctx.fillRect(x+83,groundY-140,25,30)}
ctx.fillStyle='#356f37';ctx.fillRect(0,groundY-10,world.width,12);
}
function drawFighter(x,y,face,scale=0.58,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.scale(face*scale,scale);if(heroImg.complete)ctx.drawImage(heroImg,-110,-0,220,500);else{ctx.fillStyle='#111';ctx.fillRect(-30,0,60,160)}ctx.restore()}
function frame(ts){const dt=Math.min((ts-last)/1000||0,.035);last=ts;
player.vx=joy.x*300;if(Math.abs(joy.x)>.08)player.face=joy.x>0?1:-1;player.x=Math.max(30,Math.min(world.width-30,player.x+player.vx*dt));player.y+=player.vy*dt;player.vy+=1500*dt;if(player.y>world.ground-290){player.y=world.ground-290;player.vy=0;jumping=false}
for(const e of enemies){if(!e.alive)continue;e.phase+=dt;e.x+=Math.sin(e.phase)*24*dt;if(Math.abs(e.x-player.x)<500)e.x+=Math.sign(player.x-e.x)*28*dt}
for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.life-=dt;for(const e of enemies){if(e.alive&&Math.abs(b.x-e.x)<35&&Math.abs(b.y-(e.y+85))<90){e.hp-=30;b.life=0;if(e.hp<=0){e.alive=false;kills++;document.querySelector('#score').textContent='ELIMINAÇÕES '+kills}break}}if(b.life<=0)bullets.splice(i,1)}
cam=Math.max(0,Math.min(world.width-W,player.x-W*.38));ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(-cam,0);drawBackground();
for(const e of enemies)if(e.alive){drawFighter(e.x,e.y,e.x<player.x?1:-1,.42,.92);rounded(e.x-24,e.y-12,48,5,3,'#262626');rounded(e.x-24,e.y-12,48*Math.max(0,e.hp/90),5,3,'#d64232')}
for(const b of bullets){ctx.fillStyle='#ffe27a';ctx.shadowColor='#ffad35';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(b.x,b.y,6,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
drawFighter(player.x,player.y,player.face,.58,1);ctx.restore();
ctx.fillStyle='rgba(13,31,39,.7)';ctx.fillRect(0,H-42,W,42);ctx.fillStyle='#fff';ctx.font='bold 12px system-ui';ctx.fillText('MODO 2D  •  ILHA DE COMBATE',14,H-16);
requestAnimationFrame(frame)}
document.querySelector('#loading').style.display='none';
requestAnimationFrame(frame);
