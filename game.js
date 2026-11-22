const root=document.querySelector('#game');
const canvas=document.createElement('canvas');
const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
root.appendChild(canvas);
let W=innerWidth,H=innerHeight,dpr=Math.min(window.devicePixelRatio||1,3),ground=0,last=0,cam=0;
const world={width:3200};
function resize(){
 W=innerWidth;H=innerHeight;dpr=Math.min(window.devicePixelRatio||1,3);
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
 canvas.style.width=W+'px';canvas.style.height=H+'px';
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ground=Math.max(420,Math.min(H*.82,690));
}
addEventListener('resize',resize,{passive:true});resize();
const heroImg=new Image();heroImg.decoding='async';heroImg.src='./character.svg';
const player={x:240,y:0,vx:0,vy:0,face:1,hp:100,alive:true,walk:0};
const enemies=Array.from({length:7},(_,i)=>({x:690+i*360,y:0,hp:90,alive:true,phase:i*1.3,walk:0}));
const bullets=[];let ammo=30,kills=0,joy={x:0,y:0},joyId=null;
function playerHeight(){return Math.min(360,Math.max(255,H*.43))}
function setGround(){player.y=ground-playerHeight();for(const e of enemies)e.y=ground-playerHeight()*.86}
setGround();addEventListener('resize',setGround);
const joystick=document.querySelector('#joystick'),stick=document.querySelector('#stick');
function setJoy(e){const r=joystick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy),k=Math.min(1,48/(len||1));joy.x=dx*k/48;joy.y=dy*k/48;stick.style.transform=`translate(${joy.x*48}px,${joy.y*48}px)`}
joystick.addEventListener('pointerdown',e=>{joyId=e.pointerId;joystick.setPointerCapture(joyId);setJoy(e)});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)setJoy(e)});
function endJoy(){joy={x:0,y:0};joyId=null;stick.style.transform='translate(0,0)'}
joystick.addEventListener('pointerup',endJoy);joystick.addEventListener('pointercancel',endJoy);
document.querySelector('#lookArea').style.display='none';
document.querySelector('#jump').addEventListener('click',()=>{if(player.y>=ground-playerHeight()-1)player.vy=-650});
document.querySelector('#reload').addEventListener('click',()=>{document.querySelector('#status').textContent='RECARREGANDO';setTimeout(()=>{ammo=30;document.querySelector('#ammo').textContent='MUNIÇÃO '+ammo;document.querySelector('#status').textContent='PRONTO'},850)});
document.querySelector('#fire').addEventListener('click',fire);
function fire(){if(ammo<=0){document.querySelector('#status').textContent='RECARREGUE';return}ammo--;document.querySelector('#ammo').textContent='MUNIÇÃO '+ammo;bullets.push({x:player.x+player.face*65,y:player.y+playerHeight()*.43,vx:player.face*1050,life:1.4})}
function rr(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function palm(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#765039';ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-2,-125);ctx.lineTo(7,-125);ctx.lineTo(10,0);ctx.fill();ctx.strokeStyle='#9c714d';ctx.lineWidth=3;for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(2,-122);ctx.quadraticCurveTo(Math.cos(i)*55,-185,Math.cos(i)*105,-145+Math.sin(i)*28);ctx.lineWidth=10;ctx.strokeStyle=['#24613d','#2e7544','#3c884c'][i%3];ctx.stroke()}ctx.restore()}
function house(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#e6d5b8';ctx.fillRect(0,-150,150,150);ctx.fillStyle='#b24d37';ctx.beginPath();ctx.moveTo(-16,-150);ctx.lineTo(75,-218);ctx.lineTo(166,-150);ctx.fill();ctx.fillStyle='#6c4935';ctx.fillRect(58,-85,35,85);ctx.fillStyle='#8bc6cc';ctx.fillRect(16,-125,30,35);ctx.fillRect(106,-125,28,35);ctx.strokeStyle='#fff1d7';ctx.lineWidth=4;ctx.strokeRect(16,-125,30,35);ctx.strokeRect(106,-125,28,35);ctx.fillStyle='#ad9270';ctx.fillRect(0,-12,150,12);ctx.restore()}
function background(){
 const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#63b6d2');sky.addColorStop(.65,'#c5e2d9');sky.addColorStop(1,'#f2d9a8');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 // clouds
 for(let i=0;i<7;i++){let x=((i*390-cam*.18)%(world.width+300)+world.width+300)%(world.width+300)-100;let y=65+(i%3)*47;ctx.fillStyle='rgba(255,255,255,.48)';for(let k=0;k<4;k++){ctx.beginPath();ctx.ellipse(x+k*27,y+Math.sin(k)*6,32,13,0,0,Math.PI*2);ctx.fill()}}
 // far island ridge
 ctx.fillStyle='#4e927a';ctx.beginPath();ctx.moveTo(0,ground-150);for(let x=0;x<=world.width;x+=80)ctx.lineTo(x,ground-160-Math.sin(x*.004)*38-Math.sin(x*.011)*18);ctx.lineTo(world.width,ground);ctx.lineTo(0,ground);ctx.fill();
 ctx.fillStyle='#d7bd87';ctx.fillRect(0,ground-8,world.width,H-ground+8);
 ctx.fillStyle='#347447';ctx.fillRect(0,ground+18,world.width,H-ground);
 // sandy edge and grass details
 ctx.fillStyle='#f1d69d';ctx.fillRect(0,ground-12,world.width,25);
 for(let i=0;i<world.width;i+=34){ctx.strokeStyle=i%2?'#6a9b4b':'#85ad58';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(i,ground+34);ctx.lineTo(i-5,ground+22);ctx.moveTo(i,ground+34);ctx.lineTo(i+6,ground+20);ctx.stroke()}
 for(let i=0;i<world.width;i+=470){palm(i+90,ground-8,.8+(i%3)*.07);house(i+215,ground-8,.78)}
 // near bushes
 for(let i=0;i<world.width;i+=260){ctx.fillStyle='#1e603b';for(let j=0;j<4;j++){ctx.beginPath();ctx.arc(i+j*20,ground-16,20,Math.PI,Math.PI*2);ctx.fill()}}
}
function drawFighter(x,y,face,scale=1,alpha=1,walking=0){
 const h=playerHeight()*scale;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y+Math.sin(walking*11)*2);ctx.scale(face*scale,scale);
 if(heroImg.complete&&heroImg.naturalWidth){ctx.shadowColor='rgba(0,0,0,.38)';ctx.shadowBlur=12;ctx.shadowOffsetY=7;ctx.drawImage(heroImg,-h*.22,0,h*.44,h);ctx.shadowColor='transparent';}
 ctx.restore();
}
function frame(ts){const dt=Math.min((ts-last)/1000||0,.032);last=ts;
 player.vx=joy.x*340;if(Math.abs(joy.x)>.08){player.face=joy.x>0?1:-1;player.walk+=dt}
 player.x=Math.max(35,Math.min(world.width-35,player.x+player.vx*dt));player.y+=player.vy*dt;player.vy+=1650*dt;
 if(player.y>ground-playerHeight()){player.y=ground-playerHeight();player.vy=0}
 for(const e of enemies){if(!e.alive)continue;e.phase+=dt;e.walk+=dt;e.x+=Math.sin(e.phase)*22*dt;if(Math.abs(e.x-player.x)<550)e.x+=Math.sign(player.x-e.x)*34*dt}
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.life-=dt;for(const e of enemies){if(e.alive&&Math.abs(b.x-e.x)<42&&Math.abs(b.y-(e.y+playerHeight()*.4))<95){e.hp-=30;b.life=0;if(e.hp<=0){e.alive=false;kills++;document.querySelector('#score').textContent='ELIMINAÇÕES '+kills}break}}if(b.life<=0)bullets.splice(i,1)}
 cam=Math.max(0,Math.min(world.width-W,player.x-W*.38));ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(-cam,0);background();
 for(const e of enemies)if(e.alive){drawFighter(e.x,e.y,e.x<player.x?1:-1,.68,.95,e.walk);rr(e.x-27,e.y-12,54,6,3,'#292929');rr(e.x-27,e.y-12,54*Math.max(0,e.hp/90),6,3,'#df4638')}
 for(const b of bullets){ctx.fillStyle='#fff2a3';ctx.shadowColor='#ffb32e';ctx.shadowBlur=16;ctx.beginPath();ctx.ellipse(b.x,b.y,10,4,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
 drawFighter(player.x,player.y,player.face,.86,1,player.walk);ctx.restore();
 requestAnimationFrame(frame)}
document.querySelector('#loading').style.display='none';requestAnimationFrame(frame);
