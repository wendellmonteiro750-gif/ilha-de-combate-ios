// Battle royale systems for Battle Island (offline prototype).
export class BattleSystems {
  constructor(THREE, scene, hero, onStatus=()=>{}) {
    this.T=THREE; this.scene=scene; this.hero=hero; this.onStatus=onStatus;
    this.phase='lobby'; this.items=[]; this.inventory={medkit:1, ammo:90, vest:0, helmet:0, backpack:0};
    this.weapons=[
      {name:'RIFLE AR',damage:34,rate:155,mag:30,reserve:90},
      {name:'ESCOPETA',damage:18,rate:650,mag:6,reserve:30},
      {name:'SNIPER',damage:85,rate:950,mag:5,reserve:20},
      {name:'PISTOLA',damage:24,rate:280,mag:15,reserve:60}
    ]; this.weaponIndex=0; this.zoneRadius=108; this.zoneCenter=new THREE.Vector3(0,0,0);
    this.elapsed=0; this.dropTarget=new THREE.Vector3(0,0,0); this.parachute=null; this.plane=null;
    this.makeUI(); this.makeZone(); this.spawnLoot(); this.makeMap();
  }
  makeUI(){
    const style=document.createElement('style'); style.textContent=`
    #br-panel{position:fixed;z-index:8;left:50%;top:15%;transform:translateX(-50%);width:min(92vw,360px);padding:12px;background:#101e25ed;border:1px solid #a9c4c8;color:#fff;font:700 12px Arial;display:none;text-align:center;box-shadow:0 8px 28px #0009}
    #br-panel button,#br-inventory button,#br-end button{background:#d8b34c;color:#152027;border:1px solid #fff2;padding:9px 12px;font-weight:900;margin:4px;border-radius:4px}
    #br-inventory{position:fixed;z-index:9;right:8px;top:34%;width:190px;padding:10px;background:#101e25ed;border:1px solid #a9c4c8;color:white;font:11px Arial;display:none}
    #br-end{position:fixed;z-index:30;inset:0;background:#061017eF;color:white;display:none;place-content:center;text-align:center;font:800 22px Arial}
    #br-end button{font-size:14px}
    #br-pickup{position:fixed;z-index:7;left:50%;bottom:27%;transform:translateX(-50%);display:none;background:#e2bc50;color:#17232a;border:2px solid white;border-radius:6px;padding:12px 18px;font-weight:900}
    #br-hint{position:fixed;z-index:7;left:50%;top:18%;transform:translateX(-50%);color:white;background:#14242bd9;padding:7px 10px;font:800 10px Arial;display:none;white-space:nowrap}
    `; document.head.appendChild(style);
    const panel=document.createElement('div');panel.id='br-panel';panel.innerHTML='<b>AVIÃO DE TRANSPORTE</b><p>Escolha quando saltar. Use o joystick para direcionar a queda.</p><button id="br-jump">SALTAR AGORA</button>';document.body.appendChild(panel);
    const inv=document.createElement('div');inv.id='br-inventory';inv.innerHTML='<b>MOCHILA</b><div id="br-items"></div><button id="br-heal">USAR KIT MÉDICO</button><button id="br-next">TROCAR ARMA</button><button id="br-close">FECHAR</button>';document.body.appendChild(inv);
    const pickup=document.createElement('button');pickup.id='br-pickup';pickup.textContent='COLETAR ITEM';document.body.appendChild(pickup);
    const hint=document.createElement('div');hint.id='br-hint';document.body.appendChild(hint);
    const end=document.createElement('div');end.id='br-end';end.innerHTML='<div id="br-result">VITÓRIA!</div><p id="br-score"></p><button id="br-again">VOLTAR AO LOBBY</button>';document.body.appendChild(end);
    const toggle=document.createElement('button');toggle.id='br-bag';toggle.textContent='MOCHILA';toggle.style.cssText='position:fixed;z-index:7;right:8px;top:27%;padding:8px;background:#172a35dd;color:white;border:1px solid #d6e3e3;font-weight:900';document.body.appendChild(toggle);
    toggle.onclick=()=>this.toggleInventory();document.getElementById('br-jump').onclick=()=>this.jump();
    pickup.onclick=()=>this.collectNearest();
    document.getElementById('br-heal').onclick=()=>this.heal();
    document.getElementById('br-next').onclick=()=>this.nextWeapon();
    document.getElementById('br-close').onclick=()=>inv.style.display='none';
    document.getElementById('br-again').onclick=()=>location.reload();
  }
  makeZone(){
    const T=this.T; this.zoneGroup=new T.Group(); this.scene.add(this.zoneGroup);
    const ring=new T.Mesh(new T.RingGeometry(.985,1,96),new T.MeshBasicMaterial({color:0x55d9ff,side:T.DoubleSide,transparent:true,opacity:.8}));
    ring.rotation.x=-Math.PI/2; ring.position.y=.035; this.zoneGroup.add(ring);
    const disc=new T.Mesh(new T.CircleGeometry(1,96),new T.MeshBasicMaterial({color:0x43bce8,transparent:true,opacity:.045,side:T.DoubleSide}));
    disc.rotation.x=-Math.PI/2;disc.position.y=.02;this.zoneGroup.add(disc);this.zoneRing=ring;this.zoneDisc=disc;this.syncZone();
  }
  syncZone(){this.zoneGroup.position.set(this.zoneCenter.x,0,this.zoneCenter.z);this.zoneGroup.scale.setScalar(this.zoneRadius);}
  makeMap(){
    const T=this.T, mat=(c)=>new T.MeshStandardMaterial({color:c,roughness:.9});
    // Three compact settlements with accessible-looking low buildings and perimeter roads.
    const sites=[[-58,-48],[58,-48],[-58,48],[58,48],[0,-82],[0,82],[-84,0],[84,0]];
    sites.forEach(([x,z],i)=>{
      const group=new T.Group();group.position.set(x,0,z);this.scene.add(group);
      for(let j=0;j<6;j++){
        const ox=(j%3)*10-10,oz=Math.floor(j/3)*10-5;
        const w=8.2,h=3.5,d=7.6;
        const wallMat=mat([0xb7a17d,0x9eaa9d,0xb78b69][(i+j)%3]);
        const door=1.45;
        const walls=[
          [w,h,.22,ox,h/2,oz-d/2],[.22,h,d,ox-w/2,h/2,oz],[.22,h,d,ox+w/2,h/2,oz],
          [(w-door)/2,h,.22,ox-(w+door)/4,h/2,oz+d/2],
          [(w-door)/2,h,.22,ox+(w+door)/4,h/2,oz+d/2]
        ];
        walls.forEach(([ww,hh,dd,px,py,pz])=>{const part=new T.Mesh(new T.BoxGeometry(ww,hh,dd),wallMat);part.position.set(px,py,pz);part.castShadow=true;group.add(part)});
        const floor=new T.Mesh(new T.BoxGeometry(w,.16,d),mat(0x796b55));floor.position.set(ox,.02,oz);group.add(floor);
        const roof=new T.Mesh(new T.BoxGeometry(w+.5,.28,d+.5),mat([0x58483d,0x3f4b4d,0x6a5140][(i+j)%3]));roof.position.set(ox,h+.15,oz);group.add(roof);
        const lintel=new T.Mesh(new T.BoxGeometry(door,.22,.28),mat(0x594536));lintel.position.set(ox,h-.11,oz+d/2);group.add(lintel);
        const window=new T.Mesh(new T.BoxGeometry(1.25,1.05,.08),new T.MeshStandardMaterial({color:0x668d91,roughness:.22,metalness:.12}));window.position.set(ox-2.25,2.15,oz+d/2+.05);group.add(window);
        const table=new T.Mesh(new T.BoxGeometry(1.6,.16,.9),mat(0x65452e));table.position.set(ox+1.3,.95,oz-.8);group.add(table);
        for(const legX of [-.65,.65])for(const legZ of [-.32,.32]){const leg=new T.Mesh(new T.BoxGeometry(.12,.9,.12),mat(0x4b3528));leg.position.set(ox+1.3+legX,.48,oz-.8+legZ);group.add(leg)}
        const cabinet=new T.Mesh(new T.BoxGeometry(.85,1.6,.55),mat(0x8c765a));cabinet.position.set(ox-2.8,.9,oz-2.5);group.add(cabinet);
      }
    });
    const roadMat=mat(0x696c60);
    for(const [x,z,w,d] of [[0,-31,5,38],[0,31,5,38],[-29,0,38,5],[29,0,38,5],[0,0,5,48]]){
      const road=new T.Mesh(new T.BoxGeometry(w,.05,d),roadMat);road.position.set(x,.015,z);this.scene.add(road);
    }
  }
  spawnLoot(){
    const T=this.T; const defs=[['RIFLE AR','weapon',0x9a9f91],['ESCOPETA','weapon',0x9b7650],['SNIPER','weapon',0x667b8d],['PISTOLA','weapon',0x7c8a7c],['MUNIÇÃO','ammo',0xd6bd55],['KIT MÉDICO','medkit',0xd64d4d],['COLETE','vest',0x4b7883],['CAPACETE','helmet',0x9caa74],['MOCHILA','backpack',0x856a4b]];
    for(let i=0;i<108;i++){
      const [name,type,color]=defs[i%defs.length],a=Math.random()*Math.PI*2,r=10+Math.random()*88,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const g=new T.Group();g.position.set(x,.45,z);
      const box=new T.Mesh(new T.BoxGeometry(.48,.38,.38),new T.MeshStandardMaterial({color,roughness:.5,metalness:.1}));box.castShadow=true;g.add(box);
      const glow=new T.Mesh(new T.TorusGeometry(.38,.035,6,16),new T.MeshBasicMaterial({color:0xffdf73}));glow.rotation.x=Math.PI/2;glow.position.y=-.2;g.add(glow);
      this.scene.add(g);this.items.push({name,type,color,group:g,weapon:i%4});
    }
  }
  createPlane(){
    const T=this.T,plane=new T.Group();
    const metal=new T.MeshStandardMaterial({color:0x53636a,metalness:.62,roughness:.34});
    const edge=new T.MeshStandardMaterial({color:0x9ba9aa,metalness:.7,roughness:.28});
    const dark=new T.MeshStandardMaterial({color:0x17262d,metalness:.35,roughness:.25});
    const glass=new T.MeshPhysicalMaterial({color:0x173746,metalness:.35,roughness:.12,transparent:true,opacity:.88,clearcoat:1});
    const body=new T.Mesh(new T.CylinderGeometry(.72,.95,12,16,1),metal);body.rotation.z=Math.PI/2;plane.add(body);
    const nose=new T.Mesh(new T.ConeGeometry(.72,3.1,16),edge);nose.rotation.z=-Math.PI/2;nose.position.x=7.45;plane.add(nose);
    const tailCone=new T.Mesh(new T.ConeGeometry(.88,2.4,14),metal);tailCone.rotation.z=Math.PI/2;tailCone.position.x=-7.1;plane.add(tailCone);
    const cockpit=new T.Mesh(new T.SphereGeometry(.82,16,10),glass);cockpit.scale.set(1.7,.62,1.15);cockpit.position.set(5.25,.58,0);plane.add(cockpit);
    const wing=new T.Mesh(new T.BoxGeometry(2.2,.18,19),edge);wing.position.set(.15,-.05,0);plane.add(wing);
    const rearWing=new T.Mesh(new T.BoxGeometry(1.15,.13,8),metal);rearWing.position.set(-7,.5,0);plane.add(rearWing);
    const fin=new T.Mesh(new T.BoxGeometry(2.1,2.7,.18),metal);fin.position.set(-7,1.55,0);plane.add(fin);
    this.propellers=[];
    for(const side of [-1,1]){
      const z=side*4.0;
      const engine=new T.Mesh(new T.CylinderGeometry(.48,.58,2.7,16),dark);engine.rotation.x=Math.PI/2;engine.position.set(.3,-.52,z);plane.add(engine);
      const hub=new T.Mesh(new T.SphereGeometry(.24,12,8),edge);hub.position.set(1.75,-.52,z);plane.add(hub);
      const prop=new T.Group();prop.position.set(1.85,-.52,z);plane.add(prop);
      for(let k=0;k<4;k++){const blade=new T.Mesh(new T.BoxGeometry(.16,2.25,.34),dark);blade.position.y=1.12;blade.rotation.z=k*Math.PI/2+.22;prop.add(blade)}
      this.propellers.push(prop);
      const gear=new T.Mesh(new T.CylinderGeometry(.09,.09,.9,8),dark);gear.position.set(-.2,-1.05,z*.72);plane.add(gear);
      const wheel=new T.Mesh(new T.CylinderGeometry(.34,.34,.18,12),dark);wheel.rotation.x=Math.PI/2;wheel.position.set(-.2,-1.48,z*.72);plane.add(wheel);
    }
    const stripe=new T.Mesh(new T.BoxGeometry(7,.035,2.23),new T.MeshStandardMaterial({color:0x9d9d83,metalness:.2,roughness:.7}));stripe.position.y=.49;plane.add(stripe);
    const beacon=new T.PointLight(0xff3930,1.2,8);beacon.position.set(0,1.2,0);plane.add(beacon);
    const navL=new T.Mesh(new T.SphereGeometry(.16,8,6),new T.MeshBasicMaterial({color:0x22ff77}));navL.position.set(0,.1,9.5);plane.add(navL);
    const navR=new T.Mesh(new T.SphereGeometry(.16,8,6),new T.MeshBasicMaterial({color:0xff3333}));navR.position.set(0,.1,-9.5);plane.add(navR);
    plane.scale.setScalar(.78);return plane;
  }
  start(){
    if(this.phase!=='lobby')return;this.phase='plane';this.elapsed=0;
    this.hero.position.set(-88,31,-8);
    this.plane=this.createPlane();this.scene.add(this.plane);
    this.plane.position.copy(this.hero.position);this.plane.rotation.y=Math.PI/2;
    document.getElementById('br-panel').style.display='block';document.getElementById('br-hint').style.display='block';
    document.getElementById('br-hint').textContent='AVIÃO EM ROTA — ESCOLHA O MOMENTO DO SALTO';
    this.onStatus('AVIÃO DE TRANSPORTE EM ROTA — PREPARE-SE PARA SALTAR');
  }
  openParachute(){
    if(this.phase!=='freefall')return;this.phase='parachute';
    const T=this.T;this.parachute=new T.Group();this.scene.add(this.parachute);
    const canopy=new T.Mesh(new T.SphereGeometry(3.5,24,12,0,Math.PI*2,0,Math.PI/2),new T.MeshStandardMaterial({color:0xd9a83c,side:T.DoubleSide,roughness:.66,metalness:.08}));canopy.position.y=4;canopy.scale.y=.62;this.parachute.add(canopy);
    const seams=new T.Mesh(new T.SphereGeometry(3.53,12,8,0,Math.PI*2,0,Math.PI/2),new T.MeshBasicMaterial({color:0x6c5121,wireframe:true,transparent:true,opacity:.28}));seams.position.y=4;seams.scale.y=.62;this.parachute.add(seams);
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const line=new T.Mesh(new T.CylinderGeometry(.014,.014,4.1,5),new T.MeshBasicMaterial({color:0xf1ead4}));line.position.set(Math.cos(a)*1.55,2.05,Math.sin(a)*1.55);line.rotation.z=-Math.cos(a)*.35;line.rotation.x=Math.sin(a)*.35;this.parachute.add(line)}
    this.onStatus('PARAQUEDAS ABERTO — CONTROLE A DIREÇÃO DA QUEDA');
    document.getElementById('br-hint').textContent='PARAQUEDAS ABERTO · USE O JOYSTICK PARA GUIAR';
  }
  jump(){
    if(this.phase!=='plane')return;this.phase='freefall';this.freefallTime=0;document.getElementById('br-panel').style.display='none';
    this.hero.position.y=29;this.dropTarget.set(this.hero.position.x+16,0,this.hero.position.z);
    this.onStatus('SALTO! QUEDA LIVRE — PARAQUEDAS ABRIRÁ AUTOMATICAMENTE');
    document.getElementById('br-hint').textContent='QUEDA LIVRE · PREPARE-SE PARA ABRIR O PARAQUEDAS';
  }
  toggleInventory(){
    const el=document.getElementById('br-inventory');el.style.display=el.style.display==='block'?'none':'block';this.renderInventory();
  }
  renderInventory(){
    const w=this.weapons[this.weaponIndex],el=document.getElementById('br-items');
    el.innerHTML='<p>Arma: '+w.name+'</p><p>Kit médico: '+this.inventory.medkit+'</p><p>Munição reserva: '+this.inventory.ammo+'</p><p>Colete: nível '+this.inventory.vest+'</p><p>Capacete: nível '+this.inventory.helmet+'</p><p>Mochila: nível '+this.inventory.backpack+'</p>';
  }
  collectNearest(){
    let best=null,dist=3.4;for(const item of this.items){if(!item.group.visible)continue;const d=item.group.position.distanceTo(this.hero.position);if(d<dist){best=item;dist=d}}
    if(!best){this.onStatus('NENHUM ITEM PRÓXIMO');return}
    best.group.visible=false;
    if(best.type==='weapon'){this.weaponIndex=best.weapon;this.onWeaponChange?.(this.weapons[this.weaponIndex]);this.onStatus('EQUIPADO: '+best.name)}
    else if(best.type==='ammo'){this.inventory.ammo+=30;this.onAmmo?.(30);this.onStatus('+30 MUNIÇÕES')}
    else if(best.type==='medkit'){this.inventory.medkit++;this.onStatus('KIT MÉDICO COLETADO')}
    else {this.inventory[best.type]=Math.min(3,this.inventory[best.type]+1);this.onStatus(best.name+' EQUIPADO')}
    this.renderInventory();
  }
  heal(){if(this.inventory.medkit<1){this.onStatus('SEM KIT MÉDICO');return}this.inventory.medkit--;this.onStatus('KIT MÉDICO USADO — +45 VIDA');this.onHeal?.(45);this.renderInventory()}
  nextWeapon(){this.weaponIndex=(this.weaponIndex+1)%this.weapons.length;this.onWeaponChange?.(this.weapons[this.weaponIndex]);this.onStatus('ARMA: '+this.weapons[this.weaponIndex].name);this.renderInventory()}
  update(dt,moveX=0,moveY=0,aliveBots=0){
    if(this.phase==='lobby'||this.phase==='ended')return;
    this.elapsed+=dt;
    if(this.phase==='plane'){
      this.hero.position.x=Math.min(88,this.hero.position.x+dt*8);this.hero.position.y=31;this.plane.position.copy(this.hero.position);
      this.plane.rotation.z=Math.sin(this.elapsed*1.1)*.018;
      for(const prop of this.propellers||[])prop.rotation.x+=dt*34;
      if(this.hero.position.x>=88)this.jump();
    }else if(this.phase==='freefall'){
      this.freefallTime+=dt;this.hero.position.y=Math.max(0,this.hero.position.y-dt*9.2);
      this.hero.position.x+=moveX*dt*5.5;this.hero.position.z+=(-moveY)*dt*5.5;
      if(this.freefallTime>1.25)this.openParachute();
    }else if(this.phase==='parachute'){
      this.hero.position.y=Math.max(0,this.hero.position.y-dt*3.1);
      this.hero.position.x+=moveX*dt*4.6;this.hero.position.z+=(-moveY)*dt*4.6;
      if(this.parachute){this.parachute.position.set(this.hero.position.x,this.hero.position.y,this.hero.position.z)}
      if(this.hero.position.y<=0){this.phase='match';this.hero.position.y=0;this.onStatus('POUSOU — ENCONTRE ARMAS E EQUIPAMENTOS');document.getElementById('br-hint').style.display='none';if(this.parachute){this.scene.remove(this.parachute);this.parachute=null}if(this.plane){this.scene.remove(this.plane);this.plane=null}}
    }else if(this.phase==='match'){
      const radius=Math.max(18,108-this.elapsed*.28);if(radius!==this.zoneRadius){this.zoneRadius=radius;this.syncZone()}
      const outside=this.hero.position.distanceTo(new this.T.Vector3(this.zoneCenter.x,0,this.zoneCenter.z))>this.zoneRadius;
      if(outside){this.onZoneDamage?.(dt*(this.zoneRadius<25?9:4));if(Math.floor(this.elapsed)%5===0)this.onStatus('FORA DA ZONA SEGURA — VOLTE!')}
      const nearest=this.items.some(it=>it.group.visible&&it.group.position.distanceTo(this.hero.position)<3.4);
      document.getElementById('br-pickup').style.display=nearest?'block':'none';
      if(aliveBots===0)this.end(true);
      if(this.elapsed>360)this.end(false);
    }
  }
  end(win){
    if(this.phase==='ended')return;this.phase='ended';document.getElementById('br-pickup').style.display='none';
    document.getElementById('br-end').style.display='grid';document.getElementById('br-result').textContent=win?'VITÓRIA ROYALE':'FIM DE PARTIDA';
    document.getElementById('br-score').textContent='Eliminações: '+(this.getKills?.()??0)+' · Tempo: '+Math.floor(this.elapsed)+'s';
  }
}
