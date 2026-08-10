/* TikoWikoBakery 2.5 — entrepôt mobilier + vraie façade + rue animée. */
(() => {
  const V25 = 'tikowiko-v25';
  const ROOM = { minX:-6.2, maxX:6.2, minZ:-3.7, maxZ:6.0 };
  const FURN_RE = /^(table-|chair-)/;
  const stored = new Map();
  let warehouseOpen = false;

  // Porte clairement identifiée : les clients apparaissent désormais juste derrière le seuil.
  ENTRANCE.x = 4.62;
  ENTRANCE.z = 5.72;

  const m = (color, roughness=.65, opts={}) => new THREE.MeshStandardMaterial({color, roughness, ...opts});
  const box = (w,h,d,mat) => { const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); o.castShadow=true; o.receiveShadow=true; return o; };

  // -----------------------------------------------------------------------
  // 1) ENTREPÔT : tables/chaises réellement retirées de la salle.
  // -----------------------------------------------------------------------
  function furnitureRoots(){
    const out=[];
    scene.traverse(o=>{ if(o?.userData?.twMovableId && FURN_RE.test(o.userData.twMovableId)) out.push(o); });
    return out;
  }
  function idOf(root){ return root?.userData?.twMovableId || ''; }
  function labelOf(root){ return idOf(root).startsWith('chair-') ? 'Chaise' : 'Table'; }
  function saveWarehouse(){
    const data={};
    for(const [id,v] of stored) data[id]=v;
    try{ localStorage.setItem(`${V25}-warehouse`, JSON.stringify(data)); }catch(_){}
  }
  function loadWarehouse(){
    try{
      const raw=localStorage.getItem(`${V25}-warehouse`); if(!raw) return;
      const data=JSON.parse(raw);
      for(const root of furnitureRoots()){
        const id=idOf(root), d=data[id]; if(!d) continue;
        stored.set(id,d); root.userData.twStored=true; root.visible=false;
        // Très loin de la grille : la navigation v2.3 ne les considère plus comme obstacles.
        root.position.set(50 + Object.keys(data).indexOf(id)*1.5, 0, 50);
      }
    }catch(_){}
  }
  function storeRoot(root){
    if(!root || !FURN_RE.test(idOf(root)) || root.userData.twStored) return;
    const id=idOf(root);
    stored.set(id,{x:root.position.x,z:root.position.z,r:root.rotation.y||0});
    root.userData.twStored=true; root.visible=false;
    root.position.set(50 + stored.size*1.5, 0, 50);
    saveWarehouse(); renderWarehouse();
    toast(`📦 ${labelOf(root)} rangée dans l’entrepôt`);
  }
  function activeFurniture(){ return furnitureRoots().filter(r=>!r.userData.twStored && r.visible); }
  function freeRestorePose(root, preferred){
    const candidates=[preferred,
      {x:-5.15,z:4.6,r:0},{x:-5.15,z:2.0,r:0},{x:-5.15,z:-0.7,r:0},
      {x:-3.35,z:4.6,r:0},{x:-3.35,z:2.0,r:0},{x:-3.35,z:-0.7,r:0}
    ].filter(Boolean);
    const rad=idOf(root).startsWith('table-')?.78:.42;
    for(const p of candidates){
      if(p.x<ROOM.minX+rad||p.x>ROOM.maxX-rad||p.z<ROOM.minZ+rad||p.z>ROOM.maxZ-rad) continue;
      let ok=true;
      for(const other of activeFurniture()){
        if(other===root) continue;
        const rr=idOf(other).startsWith('table-')?.78:.42;
        if(Math.hypot(other.position.x-p.x,other.position.z-p.z)<rad+rr+.25){ ok=false; break; }
      }
      if(ok) return p;
    }
    return preferred || {x:-5,z:0,r:0};
  }
  function restoreRoot(root){
    const id=idOf(root), d=stored.get(id); if(!d) return;
    const p=freeRestorePose(root,d);
    root.position.set(p.x,0,p.z); root.rotation.y=p.r||0; root.visible=true; root.userData.twStored=false;
    stored.delete(id); saveWarehouse(); renderWarehouse();
    toast(`↩️ ${labelOf(root)} remise dans la boulangerie`);
  }
  function storeAllFurniture(){
    if(state.twShopOpen){ toast('🔴 Fermez d’abord la boutique'); return; }
    for(const root of furnitureRoots()) if(!root.userData.twStored) storeRoot(root);
    toast('📦 Tables et chaises rangées : salle complètement libérée');
  }

  const style=document.createElement('style');
  style.textContent=`
    #twWarehouseBtn{display:none;position:fixed;right:10px;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 156px);z-index:104;border:2px solid #d99b43;border-radius:18px;padding:9px 12px;background:#fff0c9;color:#5b3219;font:900 12px 'Baloo 2',sans-serif;box-shadow:0 6px 20px #0008}
    #twWarehouse{display:none;position:fixed;left:8px;right:8px;top:calc(max(8px,env(safe-area-inset-top)) + 86px);z-index:105;max-height:58vh;overflow:auto;background:#2a170df5;border:2px solid #e3a348;border-radius:18px;padding:10px;color:#fff3d4;font:800 12px 'Baloo 2',sans-serif;box-shadow:0 10px 30px #000a}
    #twWarehouse.show{display:block}.twWhGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.twWhCard{background:#fff2d3;color:#5a321d;border-radius:12px;padding:8px}.twWhCard button,.twWhTop button{border:0;border-radius:10px;padding:7px 8px;background:#7b4c28;color:white;font:800 11px 'Baloo 2',sans-serif}.twWhTop{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.twWhMuted{opacity:.75;font-size:10px}
  `;
  document.head.appendChild(style);
  const whBtn=document.createElement('button'); whBtn.id='twWarehouseBtn'; whBtn.textContent='📦 Entrepôt'; document.body.appendChild(whBtn);
  const wh=document.createElement('div'); wh.id='twWarehouse'; wh.innerHTML='<div class="twWhTop"><b>📦 Entrepôt mobilier</b><button data-wh="all">Tout ranger</button><button data-wh="close">✓ Fermer</button></div><div class="twWhMuted">Boutique fermée uniquement. Les objets rangés ne bloquent plus les PNJ.</div><div class="twWhGrid"></div>'; document.body.appendChild(wh);
  const whGrid=wh.querySelector('.twWhGrid');
  function renderWarehouse(){
    whGrid.innerHTML='';
    const roots=furnitureRoots().sort((a,b)=>idOf(a).localeCompare(idOf(b)));
    for(const root of roots){
      const card=document.createElement('div'); card.className='twWhCard';
      const isStored=root.userData.twStored;
      card.innerHTML=`<b>${labelOf(root)} ${idOf(root).replace(/[^0-9]/g,'')}</b><br><span>${isStored?'Dans l’entrepôt':'Dans la salle'}</span><br>`;
      const btn=document.createElement('button'); btn.textContent=isStored?'↩️ Remettre':'📥 Ranger';
      btn.onclick=()=>{ if(state.twShopOpen){toast('🔴 Fermez la boutique avant de ranger');return;} isStored?restoreRoot(root):storeRoot(root); };
      card.appendChild(btn); whGrid.appendChild(card);
    }
  }
  whBtn.onclick=()=>{ warehouseOpen=!warehouseOpen; wh.classList.toggle('show',warehouseOpen); renderWarehouse(); };
  wh.addEventListener('click',e=>{ const a=e.target?.dataset?.wh; if(a==='all') storeAllFurniture(); if(a==='close'){warehouseOpen=false;wh.classList.remove('show');} });
  loadWarehouse();

  // Synchronise le bouton avec le panneau OUVERT/FERMÉ de la v2.4.
  gameLoopHooks.push(()=>{
    whBtn.style.display = state.twShopOpen ? 'none' : 'block';
    if(state.twShopOpen && warehouseOpen){ warehouseOpen=false; wh.classList.remove('show'); }
  });

  // -----------------------------------------------------------------------
  // 2) VRAIE FAÇADE : fenêtres, porte vitrée et entrée compréhensible.
  // -----------------------------------------------------------------------
  const facade=new THREE.Group(); facade.userData.twV25Facade=true; scene.add(facade);
  const wall=m(0xe6d5bd,.86); const frame=m(0x593720,.62); const glass=m(0x9dd9ef,.18,{transparent:true,opacity:.28,metalness:.05});
  // soubassement bas : la caméra voit toujours très bien l’intérieur.
  const sill=box(12.5,.55,.18,wall); sill.position.set(0,.28,6.08); facade.add(sill);
  function windowAt(x,w){
    const g=new THREE.Group();
    const gl=box(w,1.65,.045,glass); gl.position.set(0,1.48,0); g.add(gl);
    const top=box(w+.12,.09,.10,frame); top.position.set(0,2.34,0); g.add(top);
    const bottom=box(w+.12,.09,.10,frame); bottom.position.set(0,.62,0); g.add(bottom);
    const l=box(.09,1.80,.10,frame); l.position.set(-w/2-.04,1.48,0); g.add(l);
    const r=l.clone(); r.position.x=w/2+.04; g.add(r);
    g.position.set(x,0,6.0); facade.add(g);
  }
  windowAt(-3.95,3.15); windowAt(-.35,2.65); windowAt(2.20,1.55);

  const door=new THREE.Group(); door.userData.twV25Door=true; door.position.set(4.62,0,6.0); facade.add(door);
  const doorFrameTop=box(1.65,.10,.13,frame); doorFrameTop.position.set(0,2.65,0); door.add(doorFrameTop);
  const doorL=box(.10,2.65,.13,frame); doorL.position.set(-.82,1.32,0); door.add(doorL);
  const doorR=doorL.clone(); doorR.position.x=.82; door.add(doorR);
  const doorGlassL=box(.69,2.38,.045,glass); doorGlassL.position.set(-.37,1.23,.01); door.add(doorGlassL);
  const doorGlassR=doorGlassL.clone(); doorGlassR.position.x=.37; door.add(doorGlassR);
  const handleMat=m(0xd8c1a0,.25,{metalness:.65});
  const h1=box(.035,.42,.08,handleMat); h1.position.set(-.10,1.27,.10); door.add(h1);
  const h2=h1.clone(); h2.position.x=.10; door.add(h2);

  const shopNameCanvas=document.createElement('canvas'); shopNameCanvas.width=640; shopNameCanvas.height=180;
  const snc=shopNameCanvas.getContext('2d'); snc.fillStyle='#4b2a17'; snc.roundRect(6,6,628,168,30); snc.fill(); snc.fillStyle='#fff1c7'; snc.font='900 72px sans-serif'; snc.textAlign='center'; snc.textBaseline='middle'; snc.fillText('TikoWiko Boulangerie',320,90);
  const shopNameTex=new THREE.CanvasTexture(shopNameCanvas); shopNameTex.colorSpace=THREE.SRGBColorSpace;
  const shopName=new THREE.Mesh(new THREE.PlaneGeometry(3.75,1.05),new THREE.MeshBasicMaterial({map:shopNameTex,transparent:true,side:THREE.DoubleSide})); shopName.position.set(1.15,3.05,5.95); facade.add(shopName);

  // Porte automatique visuelle, sans jamais devenir un obstacle de navigation.
  gameLoopHooks.push(()=>{
    let nearDoor=false;
    for(const c of state.customers){ if(Math.hypot(c.visual.position.x-ENTRANCE.x,c.visual.position.z-ENTRANCE.z)<1.55){nearDoor=true;break;} }
    const target=(state.twShopOpen && nearDoor)?.43:0;
    doorGlassL.position.x += ((-.37-target)-doorGlassL.position.x)*.13;
    doorGlassR.position.x += ((.37+target)-doorGlassR.position.x)*.13;
  });

  // -----------------------------------------------------------------------
  // 3) EXTÉRIEUR VISIBLE : trottoir, route, passage piéton, voitures animées.
  // -----------------------------------------------------------------------
  const exterior=new THREE.Group(); exterior.userData.twV25Exterior=true; scene.add(exterior);
  const sidewalk=new THREE.Mesh(new THREE.PlaneGeometry(13.8,1.35),m(0xb9b4aa,.92)); sidewalk.rotation.x=-Math.PI/2; sidewalk.position.set(0,-.015,6.82); sidewalk.receiveShadow=true; exterior.add(sidewalk);
  const curb=box(13.8,.18,.16,m(0x8f8a82,.85)); curb.position.set(0,.06,7.48); exterior.add(curb);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(15.5,3.25),m(0x383b3f,.94)); road.rotation.x=-Math.PI/2; road.position.set(0,-.035,9.18); road.receiveShadow=true; exterior.add(road);
  // lignes centrales
  for(let x=-6.5;x<=6.5;x+=1.45){ const stripe=box(.75,.025,.08,m(0xf1dc80,.6)); stripe.position.set(x,.01,9.18); exterior.add(stripe); }
  // passage piéton aligné avec la porte
  for(let z=7.88;z<=10.42;z+=.40){ const zebra=box(1.35,.024,.21,m(0xf2f0e8,.7)); zebra.position.set(4.62,.012,z); exterior.add(zebra); }
  // lampadaires et petits arbres de rue
  function streetLamp(x,z){ const g=new THREE.Group(); const pole=box(.07,1.65,.07,m(0x343434,.42,{metalness:.55})); pole.position.y=.82;g.add(pole); const light=new THREE.PointLight(0xffd7a3,.55,5);light.position.set(0,1.65,0);g.add(light); const cap=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),m(0xffe2b2,.22,{emissive:0x7a4b22,emissiveIntensity:.8}));cap.position.y=1.65;g.add(cap);g.position.set(x,0,z);exterior.add(g); }
  streetLamp(-4.9,7.15); streetLamp(.4,7.15);
  function tree(x,z){ const g=new THREE.Group(); const trunk=box(.18,.85,.18,m(0x795034,.8));trunk.position.y=.42;g.add(trunk); const crown=new THREE.Mesh(new THREE.SphereGeometry(.55,12,10),m(0x65a65a,.88));crown.position.y=1.18;crown.scale.set(1,.9,1);g.add(crown);g.position.set(x,0,z);exterior.add(g); }
  tree(-6.0,7.05); tree(2.55,7.05);

  // Immeubles de l’autre côté de la rue pour qu’on voie vraiment une ville dehors.
  function cityBlock(x,w,h,color){ const b=box(w,h,1.5,m(color,.88)); b.position.set(x,h/2,11.35); exterior.add(b); for(let ix=-w/2+.45;ix<w/2-.1;ix+=.75){ for(let y=.65;y<h-.2;y+=.75){ const win=box(.34,.34,.04,m(0x9dccdf,.18,{emissive:0x23414d,emissiveIntensity:.28}));win.position.set(x+ix,y,10.58);exterior.add(win); } } }
  cityBlock(-4.7,2.5,3.2,0xb96f58); cityBlock(-1.55,3.1,2.6,0xd2b483); cityBlock(2.25,3.0,3.5,0x91a7b8); cityBlock(5.25,2.1,2.8,0xb08b6a);

  // Sprites issus du pack fourni Kenney Isometric Vehicles (CC0).
  const carData=[
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAWCAYAAAChWZ5EAAAEpklEQVR42r2WWVBbZRiG0VYd7eiFHWXGvQ7DKouEbETWSEO2GkJONnYChC3otNgpYJbahjUJI0tlqyPKNsBQSsHSkKWIxbEuY3tTx+mFBbxyRq90UMHP7xxITAYolGk9M+/8Jzlvvuf9v//POScgYH/HQ6z8hleYBQ0nmAWN5zfVxdI02mTGfpt+7EZtvePW4YAHcHjANazCxluodbamCdhFzSCs7gZdlxPM0z+C1bn0t9W5bLWNLj/+v4CrelwU2Ob+2SurY+UPi3Op2mh0H3zwYNeKH9wbYm75V+vckoKsc//BMyTYB+g5J8NsyuJYgrrR7+4IT/blMXLr974nTp1feLWq2/5Vefv0elnbNKTpWoGRewYSS5qhZuhrf7DbH2ylwHfAMH4DCiwXgVvVAfHFlj/jSyyLrCJL6euFTc/tHuCTRaJ24Npa3eCXUDu4CHL9RxCXbaQkN3wMDZdvb4FbN2fsBy6xAscjrY0c11hFzd8z8htKAwjiwI4BagaudZJwj7Stk0DPNlEB6DkmyG8ah2b7T174BvjmzmDtxjm5hIy8s0DLNv7wmrLuxW3hFR2OwzUDX3zjG+B4rxOSShq9XWDmvQ8V565QIe4OtvmB4zYnQcsyrMYq30v3AwfxdY/R1PoUnq51rMR2YbW87RJ4VPbBFKRV2rwBSHEKzUAY+oGra/sPrL072CN2Vh28qXzH5N3xNJXxjdgswzAm+83XuBfRc04Ds6AeN1rLllZvBz6qqoIMRR7ICOKqSCR6YmPmWQbXvYK3BjEBM//sLuBcIAg5ZGRkQHp6+gKHw3mS7MDD2HonVSTLAEmqakhVvg0c9SmIw887AvFagvok5WchYDuP74x9wJCcnAwIb/GuP01tmCJ/wEWw+JiEMvHFUuAqKhGk37Y4V1kF4rekIBAKgS9RYZATewLHx8dDbGwsREVFmb0BhHJN5zGFBqEZIBaLQa3OosxH0wUgJApApCgGoVKLKt2UlgrI46WDSCSGpKQk4AkxuFwLAmXZTjMGJpNJwSMiIlZDQ0NV3gAymUxJEMS6QCCAwaERcM8vQFt7J6SlpQH5HV7HggTI5XJqJEWCSe/sFQeYTp+BlJQUKjx5jQTzeDwSvJyQkHCOxWJdp9Pp6wwGYy06OvomwisDAwMPeQNkZmaGImRZpVaD3eGGsfGL1Fhbp6fSS6VSL5gUGahQowGX+3OYnPoM7HMuqKjUAZfLBYlEAqmpqSsIbkpMTIzE8gdoNNpLKE1cXFwutv6FLTef8PDwR7FoMp/PH56YnIKevn7o/3QEhkdGqdZhIbIbExg0D1WK3nK5QjE/PTML7Z29MDo+Cd09fV4vzvRdEnzPz14swDKbzb84XPPgdC/AxIUpat1wzf4JCwsr8/Wy2WxJR+eHv8/aXditqzCEYREMkZGRpDdnv8//g9gFfYvFtnpp5jLoDXjbpNH+woJzISEhR3yN2MpDUqmst6und93ucIHBaCK9a9jNefS/vO83ELIw/lV02MrrOM7HxMQUBwUFPbOdF68/i5vPine02+j/FjfY8eDg4OfvyysYtvhpbP9Tuxlx1o9g64+gN3A/oH8B7h79iWMfJKYAAAAtdEVYdFNvZnR3YXJlAGJ5LmJsb29kZHkuY3J5cHRvLmltYWdlLlBORzI0RW5jb2RlcqgGf+4AAAAASUVORK5CYII=',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAZCAYAAAC/zUevAAAFAklEQVR42r2Wa0wbBRzAUTPdxA+6xBCnMXwYJJDIEHQ8S3n1cW299tqeLbRQCrRzm9tgsg3kNZCnMDoKbAx5lBXQVedgPDYHgtg5giHGD84BJn4yJtuXGbOZqMDf/x0UrhQwCHjJP3fpNff7/V/Xenlt8SCOEc8knyPjkmrlLck15LvKctFLXjt5CGuE3gyUC0+ulX+cfE7+UFenADzPYXy3IzJ0sWhvUjVpSPpQPpJUQ36JWVsR5nDBV8e2yqzASSfC/8QHI8ATul4Y6k1zJzu7J0t7p17bIlyBcAp0m4CnWc2QZWuD4s8noGJwBioGpi20w/HUpuAahGuZzGtpONp8EU602iG9IQf0dapNwKehcmiWjYr+6V9L++6+viFcVhz67NtVUr3GVfZaLHutGo40N0FelxPyuycg1z4Gx1svQ0pd2obwSszcBV+Owdl/r4aiWCCkzooeqz8ggK6QgqZKBqaGKhT4mhVwRa59HPTV2ex3UNYTPji7TjAtmfmltPfe+rOhKBLUUsUi4Ia23ATvNFyA07ZheL/7zrKEriqbva8sEUN2R/dK5muAWTgrcA+Krt6Gw63VNrpOtNdz91OE3lSOxEkVIZyJfPHimZURo8yhRZnOYTcJJox1xVB2/QeOxIwrazbK+39EuBOOdTSAsTETUqzKvzE6aSvxopuEVCp9Qa1RTqlNFCgz5aDQYaS9BdR7Eg8ZU/15PJuXJVQlcjjdNcjpO7sJUM5mjvB2hDdlQqpVCakNKjZQYi61XunQNpD73CXU6ikMEIlEEBsbC3FxcUCQYlBkSTkia0e6pQQzvrskwYE3usOZMCwFXs/jvV6tReHLSiB0t0qlKpPJZA+M6RnQ1m6D/IJCiI+PB0KBrTlDbCihKqGwGgNsz493cDLnCBhWR6MK9BbFAnVWbA81h+5iRUJDQ3fx+fwSRmBicgrGvnJCSWkZ4GcgT5GB8hRTEfG6IkmVGWCwZrhlnboK6rrWn6dAVUqA8AQPeOlvOiPoV/YstyUyMlLb2m6b//RqH1xqsUFf/yBIpTIQi8Wg1qiBnZkNZJj11lsoT3DjUuYceEzGQUYAoo1vuEtERETszy8o+vnmrVFow9UbGR0Hk8nMzgczLzRNA62lV2QKEV6AQnnE4jVXpHFjOM94EGJ04cAjo53I3cNdlCdxSPMvNrf8dWfiW7g1MgoajRZCQkLmCYL4HkXusyIumQyUSVWAnCZBYcBtOiVZnBEE6iyKDeF8kgf8eP4CtruHGQW3dQ0ODn5eIpE0ZWWf/MNkPrQQFhb2U0BAQOGBAwdexuENw7jgkqEoChITEyEmJoatlkSJFcmRLLdHlBWzJjw2IRZ4PB5gBfpR4NU1355BQUHe+AUxzogeq7AfP3rCdY+xdskIBIKHzPBecXwGZ3LzWBGplmBfdvICAcSawz3gjDAm9giTuubn5xewpf8ZjAxWoXdw6AsYG78NwyNjgNVj15oyYnuyCYgzRHHh96OiogbCw8O7UUDm4+PjvS3/tvD9UtXbNwAf4S/r5a4r0POJA6Kjo3GjcGjVFCQIE1g4VvQSwsM8er8dBz48vs5S//vQjWFsyTW4cXOYrYRQKASSJB/g0O0c3HX4+vruVirVzbZO+/w3E5Ng7+oBFAOE/oaDp99ROPfAPu/D8ncdPnL0MW7LIxzk6/7+/gTeetrr/zwCAwOfw23iM8Fs1n95xj/NCXXEP0EuEAAAAC10RVh0U29mdHdhcmUAYnkuYmxvb2RkeS5jcnlwdG8uaW1hZ2UuUE5HMjRFbmNvZGVyqAZ/7gAAAABJRU5ErkJggg==',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAZCAYAAAC/zUevAAAFFklEQVR42r2Wa0xTZxzG2ZZtbuzDtmQhc8nCByXBZOjgA6Ji5U5pg9AL0J7SFvGKF2TRMQOIIji8sksmULkUuQhFR8ulqKBAW6hoJfswo7Jkn5Yl+sVl0SVuwH/Pe9JTDjedF/YmT87JOSfv8/vf3hw/v5dcdqn0bZdWGzXMcSaXTrfLodN97LeY63J8vD8znWV+HuYPRzIzCdcJJ8eNLQrMJbX6wyGOMzg4rn9Iq72K63cujrMI5rP1SmF4c43GAADnIMc9waY0DM1nPJ8Gt++ZsFScHz1t8Xz2wpEz8wFO98SJDYf/ozGTY3suWY+bqbL1Oh3rvkdHu+9WqC2WN57PXKt1Dmq1T4b0RmopM1H9qWa6sreAhvWG5zL/2j7O62jX3d9LbLc/f6p5p1z+7oBGo+PNkXbUk3iAI1VU3OikgmY3lZoHyXyyiQY273i6ec+0uU8948/ORkdKSny3Uvm4Ny2N+tLT6apGQ+0Fp+jQOQcPIKi4wUHtO/P5bxwM1GteJUTeM76AWEnu/VZivbNwb9gUipOdSiWJdSF7F5mOVFNpbT8ARnwQbTn5/PtulYoaK1qnI5/HmDeHjnXdIVPzMF0urjCPoORzAPZh9usVCmcHNrZC7RC7t/EwKmrfvNsHc6hhyAfB1LavlE7YfhZB3BOi5lXOm7uot6yK3Dv20E2D4Z8bWVkNDrX6oxkQMpnsA71K5SlCZEXYOCc1lb6EahQKskKdPpg9VFv8PQ8lQNjSNVRtsovqzk/CtHlpJcxz6abRSB7oFgSQCdxbXBkZS2dAqAABUUJCAm3YsIGioqIoTSqlM14Q26xSidW2vwzZuM1DTJt7IxeZ38rKmpbROOkxGKxuozGQh4DpEqVSWSqXyx9kbcqm2jozFRQWUXR0NOkA0vgMCFsGRyZkg9Wcpf06ImfGPgCxuVdj0HW9fgp91bg1LOxNHiQMNxKJ5DADcI96aGDQSYdLSgnPKG/jRqrz9smCINk7ybVtN2/qmSf6MRHAqF5PdrWaahIT6bhE4syLiHjHV5Y1a9Zk1NSZJ9sv2lBnM9m6ekgmk1MiPtaxfoHqoYVg2HgjujnGY14J5mex3wkEBwAqj4ycCREREbGsoPDgr5euXKPa+mbqvzZEW7Zs5fuD9YsaG2RCB6F6b2baUarzuP7onaZevGMgY2Jzg8EXuc8cKoSykQm1GALrdTRpQWWV6e8R9w260n+N0tMzKDQ0dFIqlf4EkPsMRIA5ALBcQBhRrv0pKVTv7R1m6MYp+jRzI5o/QSKZQrlbwoSeENaqVaveT0pK+mFv3hd/bdm6bSo8PPyX4ODgopUrV36C5g2HzggwqRjj2NhYWr9+PZ+tTJmM6nwjraQ6NPVs800wT4QiIyMJme8CwKfznp4hISH++CARPaJDFpbh0WvCO0YtwMTFxT1kzdtmuUD5Xx3gQXLkcrIA5CIy8w2mSxw5M2fACOwRgupYvnx58Ev9ZzAYZMHaY79MA0Mu6usfIGSPYmCcjwxVQyW4F5nfX7t2bffq1aubASAPCAjwfyV/Wzhfyq22bjpbc47ONbVRS6uF1q1bh4mSUQYgZDExvDkyWg3z8Dm1fxULm0efrvj2T3tvH0rSQb2X+vgDLj4+npKTkx+g6RbPXFiBgYFLFApVlbmhcXLYPUqNTS0EMILpH2g83aKaixfqvBTpb9qRs/MxpuURGrkzKChIildv+f2fa8WKFe9hmiRMbLJeZI9/AXbYw4fbmIwYAAAALXRFWHRTb2Z0d2FyZQBieS5ibG9vZGR5LmNyeXB0by5pbWFnZS5QTkcyNEVuY29kZXKoBn/uAAAAAElFTkSuQmCC'
  ];
  const carTextures=carData.map(src=>{const t=new THREE.TextureLoader().load(src);t.colorSpace=THREE.SRGBColorSpace;return t;});
  const cars=[];
  function addCar(texIndex,x,z,speed,dir){
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:carTextures[texIndex%carTextures.length],transparent:true,depthWrite:false}));
    spr.scale.set(1.35*dir,.92,1); spr.position.set(x,.58,z); exterior.add(spr); cars.push({spr,speed,dir});
  }
  addCar(0,-5.5,8.42,1.15,1); addCar(1,1.0,8.42,.92,1); addCar(2,5.2,9.86,1.05,-1); addCar(0,-.5,9.86,.82,-1);
  gameLoopHooks.push((t,dtRaw)=>{
    const dt=Math.min(.06,dtRaw||.016);
    for(const c of cars){ c.spr.position.x += c.speed*c.dir*dt; if(c.dir>0&&c.spr.position.x>7.8)c.spr.position.x=-7.8; if(c.dir<0&&c.spr.position.x<-7.8)c.spr.position.x=7.8; }
  });

  // Caméra légèrement reculée pour laisser apparaître la façade et la rue sans perdre le gameplay.
  function frameExterior(){
    if(!(innerHeight>innerWidth && Math.min(innerWidth,innerHeight)<=900)) return;
    camera.position.set(9.8,11.1,15.0); controls.target.set(.15,.65,2.15); camera.fov=43; camera.updateProjectionMatrix(); controls.update();
  }
  frameExterior(); addEventListener('orientationchange',()=>setTimeout(frameExterior,220),{passive:true});

  toast('🏪 Façade + porte + entrepôt + rue animée ajoutés');
})();
