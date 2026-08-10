/* TikoWikoBakery 2.4 — boutique ouverte/fermée, personnalisation libre et accès aux tables fiabilisé. */
(() => {
  const ROOM = { minX: -6.35, maxX: 6.35, minZ: -3.85, maxZ: 6.15 };
  state.twShopOpen = true;
  let editKind = null; // staff | decor | null
  let selectedRoot = null;
  let dragging = false;
  let dragPointer = null;
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  const decorRoots = [];
  const fanBlades = [];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snap = v => Math.round(v / 0.25) * 0.25;
  const isPortraitMobile = () => innerHeight > innerWidth && Math.min(innerWidth, innerHeight) <= 900;

  // -------------------------------------------------------------------------
  // 1) Corriger la géométrie du coin repas : les tables de la v2.3 étaient
  //    trop proches entre elles et les chaises trop collées au plateau.
  // -------------------------------------------------------------------------
  function rootById(id) {
    let found = null;
    scene.traverse(o => { if (!found && o?.userData?.twMovableId === id) found = o; });
    return found;
  }

  function nearestTableForChair(chair) {
    let best = null, bestD = Infinity;
    scene.traverse(o => {
      if (!o?.userData?.twMovableId?.startsWith('table-')) return;
      const d = Math.hypot(o.position.x - chair.position.x, o.position.z - chair.position.z);
      if (d < bestD) { best = o; bestD = d; }
    });
    return best;
  }

  function spreadDiningRoom(force = false) {
    const marker = localStorage.getItem('tikowiko-v24-dining-fixed');
    if (marker && !force) return;
    const tablePos = [
      [-4.85, 4.35], [-2.30, 4.35],
      [-4.85, 1.25], [-2.30, 1.25]
    ];
    tablePos.forEach(([x, z], i) => {
      const table = rootById(`table-${i}`);
      const a = rootById(`chair-${i}-a`);
      const b = rootById(`chair-${i}-b`);
      if (table) table.position.set(x, 0, z);
      if (a) { a.position.set(x, 0, z + 1.20); a.rotation.y = Math.PI; }
      if (b) { b.position.set(x, 0, z - 1.20); b.rotation.y = 0; }
    });
    try { localStorage.setItem('tikowiko-v24-dining-fixed', '1'); } catch (_) {}
  }
  spreadDiningRoom(false);

  function keepChairAccessible(chair) {
    const table = nearestTableForChair(chair);
    if (!table) return;
    let dx = chair.position.x - table.position.x;
    let dz = chair.position.z - table.position.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.001) { dx = 0; dz = 1; d = 1; }
    if (d < 1.16) {
      chair.position.x = table.position.x + (dx / d) * 1.16;
      chair.position.z = table.position.z + (dz / d) * 1.16;
    }
  }

  // -------------------------------------------------------------------------
  // 2) Vrai panneau OUVERT / FERMÉ dans la boutique + commande mobile.
  // -------------------------------------------------------------------------
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512; signCanvas.height = 256;
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 0.88),
    new THREE.MeshStandardMaterial({ map: signTex, transparent: true, roughness: 0.55, side: THREE.DoubleSide })
  );
  sign.position.set(4.95, 2.25, 4.86);
  sign.rotation.y = -Math.PI * 0.52;
  scene.add(sign);

  function drawSign() {
    const ctx = signCanvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = '#4b2a17'; ctx.roundRect(10, 10, 492, 236, 30); ctx.fill();
    ctx.fillStyle = state.twShopOpen ? '#e9ffe7' : '#ffe7df'; ctx.roundRect(28, 28, 456, 200, 24); ctx.fill();
    ctx.strokeStyle = state.twShopOpen ? '#49a85c' : '#c54b3d'; ctx.lineWidth = 13; ctx.stroke();
    ctx.fillStyle = state.twShopOpen ? '#287b3a' : '#9b2d23';
    ctx.font = '900 70px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(state.twShopOpen ? 'OUVERT' : 'FERMÉ', 256, 118);
    ctx.fillStyle = '#6b4328'; ctx.font = '700 27px sans-serif';
    ctx.fillText('TikoWikoBakery', 256, 184);
    signTex.needsUpdate = true;
  }

  const style = document.createElement('style');
  style.textContent = `
    #twOpenClose{position:fixed;left:10px;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 105px);z-index:98;border:2px solid #f0b04f;border-radius:18px;padding:10px 13px;font:900 13px 'Baloo 2',sans-serif;box-shadow:0 6px 20px #0008}
    #twOpenClose.open{background:#dff7dd;color:#235f2c} #twOpenClose.closed{background:#ffdcd4;color:#842d22}
    #twCustomBtn{position:fixed;left:10px;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 156px);z-index:98;border:2px solid #d99b43;border-radius:18px;padding:9px 12px;background:#fff0c9;color:#5b3219;font:900 12px 'Baloo 2',sans-serif;display:none;box-shadow:0 6px 20px #0008}
    #twCustomPanel{position:fixed;left:8px;right:8px;top:calc(max(8px,env(safe-area-inset-top)) + 92px);z-index:99;display:none;max-height:54vh;overflow:auto;background:#2b160bf2;border:2px solid #e5a94f;border-radius:18px;padding:9px;box-shadow:0 8px 28px #0009;color:#fff3d4;font:800 12px 'Baloo 2',sans-serif}
    #twCustomPanel.show{display:block}.twRow{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.twRow button{border:0;border-radius:11px;padding:8px 9px;background:#fff2d3;color:#5a321d;font:800 11px 'Baloo 2',sans-serif}.twRow button.on{outline:3px solid #72e184}.twMini{opacity:.85;font-size:10px;line-height:1.25}
    #twEditHint{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(10px,env(safe-area-inset-bottom)) + 215px);z-index:100;display:none;padding:7px 10px;border-radius:12px;background:#25140de8;color:#fff3d4;font:800 11px 'Baloo 2',sans-serif;pointer-events:none}
  `;
  document.head.appendChild(style);

  const openBtn = document.createElement('button');
  openBtn.id = 'twOpenClose';
  document.body.appendChild(openBtn);
  const customBtn = document.createElement('button');
  customBtn.id = 'twCustomBtn'; customBtn.textContent = '🎨 Personnaliser';
  document.body.appendChild(customBtn);
  const customPanel = document.createElement('div');
  customPanel.id = 'twCustomPanel';
  customPanel.innerHTML = `
    <b>🎨 Boutique fermée — personnalisation libre</b>
    <div class="twMini">Aucun client n'entre. Les employés restent immobiles et peuvent être déplacés.</div>
    <div class="twRow"><button data-mode="staff">👥 Personnel</button><button data-mode="decor">💡 Décor</button><button data-do="furniture">🛠️ Meubles</button><button data-do="closePanel">✓ Terminer</button></div>
    <div>🧱 Murs</div><div class="twRow"><button data-wall="#f0e6d2">Crème</button><button data-wall="#fff7ea">Blanc chaud</button><button data-wall="#d8e6df">Sauge</button><button data-wall="#d9e3f0">Bleu clair</button><button data-wall="#e7d4c6">Rose biscuit</button></div>
    <div>🟫 Sol</div><div class="twRow"><button data-floor="#ffffff">Terre cuite</button><button data-floor="#c7a77a">Sable</button><button data-floor="#9a795e">Bois foncé</button><button data-floor="#c6c3bd">Pierre claire</button></div>
    <div>✨ Plafond / ambiance</div><div class="twRow"><button data-do="addLight">➕ Lumière</button><button data-do="addFan">➕ Ventilo</button><button data-do="rotate">↻ Tourner</button><button data-do="delete">🗑️ Retirer</button></div>
    <div class="twRow"><button data-do="safeDining">🍽️ Dégager les tables</button><button data-do="save">💾 Sauver la déco</button></div>`;
  document.body.appendChild(customPanel);
  const hint = document.createElement('div'); hint.id = 'twEditHint'; document.body.appendChild(hint);

  function updateOpenUI() {
    openBtn.className = state.twShopOpen ? 'open' : 'closed';
    openBtn.textContent = state.twShopOpen ? '🟢 OUVERT' : '🔴 FERMÉ';
    customBtn.style.display = state.twShopOpen ? 'none' : 'block';
    const oldLayout = document.getElementById('twLayoutBtn');
    if (oldLayout) {
      oldLayout.textContent = '🛠️ Meubles';
      oldLayout.style.display = state.twShopOpen ? 'none' : 'block';
    }
    drawSign();
  }

  function clearHeldVisual(emp) {
    if (emp?.heldVisual) { emp.heldVisual.parent?.remove(emp.heldVisual); emp.heldVisual = null; }
    setBubble(emp.visual, null);
  }

  function closeShop() {
    state.twShopOpen = false;
    // Tous les clients quittent immédiatement : boutique réellement libre pour aménager.
    for (const c of state.customers.slice()) removeCustomer(c);
    state.checkouts.forEach(co => { co.queue.length = 0; co.busy = false; co.progress = 0; });
    state.ovens.forEach(o => { if (o.claimedBy != null) o.claimedBy = null; });
    state.staff.forEach(emp => {
      emp.serviceOrder = null; emp.v23RestockOven = null; emp.v23RestockBatch = null;
      clearHeldVisual(emp); emp.state = 'closedIdle'; emp.visual.userData.action = 'idle';
    });
    updateOpenUI();
    toast('🔴 Boutique fermée : clients stoppés, vous pouvez tout réorganiser');
  }

  function openShop() {
    const oldPanel = document.getElementById('twLayoutPanel');
    if (oldPanel?.classList.contains('show')) oldPanel.querySelector('[data-a="save"]')?.click();
    editKind = null; selectedRoot = null; dragging = false; customPanel.classList.remove('show'); hint.style.display = 'none';
    state.twShopOpen = true;
    state.staff.forEach(emp => { emp.state = 'idle'; emp.visual.userData.action = 'idle'; emp.visual.userData.twV23Nav = {}; });
    updateOpenUI();
    toast('🟢 Boutique ouverte : production et service relancés');
  }

  openBtn.addEventListener('click', () => state.twShopOpen ? closeShop() : openShop());
  customBtn.addEventListener('click', () => customPanel.classList.toggle('show'));

  // -------------------------------------------------------------------------
  // 3) Production du boulanger fiabilisée : il travaille depuis un point libre
  //    devant le pétrin, puis va au four sans se coincer dans sa collision.
  // -------------------------------------------------------------------------
  function attachDough(emp) {
    clearHeldVisual(emp);
    const hand = emp?.visual?.userData?.rig?.rightArm?.hand;
    if (!hand) return;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 9), new THREE.MeshStandardMaterial({ color: 0xe8d2a1, roughness: 0.8 }));
    d.scale.set(1.25, 0.62, 1); d.position.set(0, -0.04, 0.13); hand.add(d); emp.heldVisual = d;
  }

  updateBaker = function(emp, dt) {
    if (!state.twShopOpen) return;
    if (!emp.v24State) emp.v24State = 'idle';
    const unlocked = RECIPE_KEYS.filter(k => RECIPES[k].unlocked);
    if (emp.v24State === 'idle') {
      const oven = state.ovens.find(o => o.state === 'idle' && !o.reserved);
      if (!oven || !unlocked.length) { emp.visual.userData.action = 'idle'; return; }
      const recipe = unlocked.slice().sort((a,b)=>(state.stock[a]||0)-(state.stock[b]||0))[0];
      oven.reserved = true; emp.v24Oven = oven; emp.v24Recipe = recipe; emp.v24State = 'toMixer';
    }
    if (emp.v24State === 'toMixer') {
      emp.visual.userData.action = 'walk';
      if (moveTowards(emp.visual, MIXER_POS.x, MIXER_POS.z + 0.78, emp.speed, dt, 'mixer')) {
        emp.v24Timer = RECIPES[emp.v24Recipe].prepTime / Math.max(0.7, emp.efficiency); emp.v24State = 'knead';
      }
      return;
    }
    if (emp.v24State === 'knead') {
      emp.visual.userData.action = 'knead'; emp.v24Timer -= dt;
      if (emp.v24Timer <= 0) { attachDough(emp); emp.v24State = 'toOven'; }
      return;
    }
    if (emp.v24State === 'toOven') {
      const oven = emp.v24Oven;
      if (!oven) { emp.v24State = 'idle'; return; }
      emp.visual.userData.action = 'carry';
      const oi = state.ovens.indexOf(oven);
      if (moveTowards(emp.visual, oven.x, oven.z + 1.08, emp.speed, dt, `oven-${oi}`)) {
        clearHeldVisual(emp);
        oven.state = 'baking'; oven.progress = 0; oven.recipe = emp.v24Recipe; oven.reserved = false;
        emp.v24Oven = null; emp.v24Recipe = null; emp.v24State = 'idle'; emp.state = 'idle';
      }
    }
  };

  // Boutique fermée : aucune IA, aucun spawn. On garde les employés visibles pour les déplacer.
  const sellerV23 = updateSeller, cashierV23 = updateCashier, guardV23 = updateGuard, customerV23 = updateCustomer, spawnV23 = spawnCustomer;
  updateSeller = (emp, dt) => { if (state.twShopOpen) sellerV23(emp, dt); };
  updateCashier = (emp, dt) => { if (state.twShopOpen) cashierV23(emp, dt); };
  updateGuard = (emp, dt) => { if (state.twShopOpen) guardV23(emp, dt); };
  spawnCustomer = () => { if (state.twShopOpen) return spawnV23(); };

  // -------------------------------------------------------------------------
  // 4) Accès aux chaises : approche par l'extérieur de la table, puis dernier
  //    petit pas droit vers la chaise. Le client ne cherche plus à traverser la table.
  // -------------------------------------------------------------------------
  function directSeatStep(obj, target, speed, dt) {
    const dx = target.x - obj.position.x, dz = target.z - obj.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.055) { obj.position.x = target.x; obj.position.z = target.z; return true; }
    const s = Math.min(d, speed * dt);
    obj.position.x += dx / d * s; obj.position.z += dz / d * s;
    obj.rotation.y = Math.atan2(dx, dz); obj.userData.lastMoveAt = performance.now();
    return false;
  }

  updateCustomer = function(c, dt) {
    if (!state.twShopOpen) return;
    if (c.state === 'v23Dining') {
      const chair = c.v23Chair;
      if (!chair?.root) { c.state = 'leaving'; return; }
      keepChairAccessible(chair.root);
      const table = nearestTableForChair(chair.root);
      if (!table) return customerV23(c, dt);
      let dx = chair.root.position.x - table.position.x;
      let dz = chair.root.position.z - table.position.z;
      const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      const approach = { x: chair.root.position.x + dx * 0.62, z: chair.root.position.z + dz * 0.62 };
      c.twV24SeatStage ||= 'approach';
      if (c.twV24SeatStage === 'approach') {
        if (moveTowards(c.visual, approach.x, approach.z, 1.32, dt)) c.twV24SeatStage = 'final';
        return;
      }
      if (directSeatStep(c.visual, chair.root.position, 0.95, dt)) {
        c.state = 'v23Eating'; c.visual.userData.action = 'eat'; c.twV24SeatStage = null;
      }
      return;
    }
    return customerV23(c, dt);
  };

  // -------------------------------------------------------------------------
  // 5) Déplacement du personnel et du décor quand la boutique est fermée.
  // -------------------------------------------------------------------------
  function pointerNdc(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(pointer, camera);
  }
  function rootFromHit(obj, kind) {
    let o = obj;
    while (o && o !== scene) {
      if (kind === 'staff' && state.staff.some(s => s.visual === o)) return o;
      if (kind === 'decor' && o.userData?.twV24Decor) return o;
      o = o.parent;
    }
    return null;
  }
  function selectableRoots() {
    return editKind === 'staff' ? state.staff.map(s => s.visual) : decorRoots;
  }
  function selectAt(e) {
    pointerNdc(e);
    const hits = ray.intersectObjects(selectableRoots(), true);
    selectedRoot = hits.length ? rootFromHit(hits[0].object, editKind) : null;
    hint.textContent = selectedRoot ? (editKind === 'staff' ? '👥 Employé sélectionné — glissez pour le déplacer' : `✨ ${selectedRoot.userData.twV24Decor} sélectionné`) : 'Touchez un élément à déplacer';
  }
  function moveSelectedToPointer(e) {
    if (!selectedRoot) return;
    pointerNdc(e);
    if (!ray.ray.intersectPlane(ground, hitPoint)) return;
    selectedRoot.position.x = snap(clamp(hitPoint.x, ROOM.minX + 0.35, ROOM.maxX - 0.35));
    selectedRoot.position.z = snap(clamp(hitPoint.z, ROOM.minZ + 0.35, ROOM.maxZ - 0.35));
    if (editKind === 'staff') selectedRoot.position.y = 0;
  }

  renderer.domElement.addEventListener('pointerdown', e => {
    if (state.twShopOpen || !editKind) return;
    e.preventDefault(); e.stopImmediatePropagation();
    selectAt(e); dragging = !!selectedRoot; dragPointer = e.pointerId;
    if (dragging) renderer.domElement.setPointerCapture?.(e.pointerId);
  }, true);
  renderer.domElement.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragPointer || state.twShopOpen || !editKind) return;
    e.preventDefault(); e.stopImmediatePropagation(); moveSelectedToPointer(e);
  }, true);
  renderer.domElement.addEventListener('pointerup', e => {
    if (!dragging || e.pointerId !== dragPointer) return;
    e.preventDefault(); e.stopImmediatePropagation(); dragging = false; dragPointer = null; saveV24();
  }, true);

  function makeLight(x = 0, z = 0) {
    const g = new THREE.Group(); g.userData.twV24Decor = 'Lumière';
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.55,8), new THREE.MeshStandardMaterial({color:0x3b2a20,roughness:0.7})); cord.position.y=-0.28; g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.23,0.18,16,1,true), new THREE.MeshStandardMaterial({color:0xd98a3d,roughness:0.48,side:THREE.DoubleSide})); shade.position.y=-0.62; g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075,12,9), new THREE.MeshStandardMaterial({color:0xfff2c4,emissive:0xffc768,emissiveIntensity:1.5})); bulb.position.y=-0.72; g.add(bulb);
    const light = new THREE.PointLight(0xffc77a, 0.55, 5.2, 2); light.position.y=-0.75; g.add(light);
    g.position.set(x,4.15,z); scene.add(g); decorRoots.push(g); return g;
  }
  function makeFan(x = 0, z = 0) {
    const g = new THREE.Group(); g.userData.twV24Decor = 'Ventilo';
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.05,0.36,10), new THREE.MeshStandardMaterial({color:0x4d3729,roughness:0.6})); stem.position.y=-0.18; g.add(stem);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.10,14), new THREE.MeshStandardMaterial({color:0x6d4b32,roughness:0.55})); hub.rotation.x=Math.PI/2; hub.position.y=-0.40; g.add(hub);
    const rotor = new THREE.Group(); rotor.position.y=-0.40; g.add(rotor);
    const bladeMat = new THREE.MeshStandardMaterial({color:0x8b5a35,roughness:0.68});
    for(let i=0;i<4;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.035,0.16),bladeMat); b.position.x=0.36; b.rotation.y=i*Math.PI/2; const pivot=new THREE.Group(); pivot.rotation.y=i*Math.PI/2; pivot.add(b); rotor.add(pivot); }
    g.position.set(x,4.18,z); scene.add(g); decorRoots.push(g); fanBlades.push(rotor); return g;
  }

  function saveV24() {
    try {
      const surfaces = { wall: `#${wallMat.color.getHexString()}`, floor: `#${floorMat.color.getHexString()}` };
      const decor = decorRoots.map(o => ({ type:o.userData.twV24Decor, x:o.position.x, z:o.position.z, r:o.rotation.y }));
      const staff = state.staff.map(s => ({ id:s.id, x:s.visual.position.x, z:s.visual.position.z, r:s.visual.rotation.y }));
      localStorage.setItem('tikowiko-v24-custom', JSON.stringify({ surfaces, decor, staff }));
    } catch (_) {}
  }
  function loadV24() {
    try {
      const raw = localStorage.getItem('tikowiko-v24-custom'); if (!raw) return;
      const d = JSON.parse(raw);
      if (d.surfaces?.wall) wallMat.color.set(d.surfaces.wall);
      if (d.surfaces?.floor) floorMat.color.set(d.surfaces.floor);
      (d.decor || []).forEach(x => { const o = x.type === 'Ventilo' ? makeFan(x.x,x.z) : makeLight(x.x,x.z); o.rotation.y = x.r || 0; });
      (d.staff || []).forEach(x => { const s=state.staff.find(e=>e.id===x.id); if(s){s.visual.position.x=x.x;s.visual.position.z=x.z;s.visual.rotation.y=x.r||0;} });
    } catch (_) {}
  }
  loadV24();

  customPanel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) {
      editKind = editKind === b.dataset.mode ? null : b.dataset.mode;
      customPanel.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode === editKind));
      selectedRoot = null; hint.style.display = editKind ? 'block' : 'none'; hint.textContent = editKind === 'staff' ? '👥 Touchez un employé puis glissez-le' : '✨ Touchez une lumière ou un ventilo puis glissez-le';
      controls.enabled = !editKind;
      return;
    }
    if (b.dataset.wall) { wallMat.color.set(b.dataset.wall); saveV24(); return; }
    if (b.dataset.floor) { floorMat.color.set(b.dataset.floor); woodFloor.material.color?.set?.(b.dataset.floor); saveV24(); return; }
    const a = b.dataset.do;
    if (a === 'furniture') { editKind=null; hint.style.display='none'; controls.enabled=true; document.getElementById('twLayoutBtn')?.click(); customPanel.classList.remove('show'); }
    if (a === 'closePanel') { editKind=null; selectedRoot=null; hint.style.display='none'; controls.enabled=true; customPanel.classList.remove('show'); saveV24(); }
    if (a === 'addLight') { if (decorRoots.filter(o=>o.userData.twV24Decor==='Lumière').length<6){ selectedRoot=makeLight(0,0); editKind='decor'; hint.style.display='block'; hint.textContent='💡 Lumière ajoutée — glissez-la'; saveV24(); } }
    if (a === 'addFan') { if (decorRoots.filter(o=>o.userData.twV24Decor==='Ventilo').length<4){ selectedRoot=makeFan(0,0); editKind='decor'; hint.style.display='block'; hint.textContent='🌀 Ventilo ajouté — glissez-le'; saveV24(); } }
    if (a === 'rotate' && selectedRoot) { selectedRoot.rotation.y += Math.PI/2; saveV24(); }
    if (a === 'delete' && selectedRoot?.userData?.twV24Decor) { const i=decorRoots.indexOf(selectedRoot); if(i>=0)decorRoots.splice(i,1); scene.remove(selectedRoot); selectedRoot=null; saveV24(); }
    if (a === 'safeDining') { spreadDiningRoom(true); saveV24(); toast('🍽️ Tables espacées : passages et accès aux chaises dégagés'); }
    if (a === 'save') { saveV24(); toast('💾 Personnalisation sauvegardée'); }
  });

  // Ventilateurs animés, sans surcharge GPU.
  gameLoopHooks.push((t) => { fanBlades.forEach(r => { r.rotation.y = t * 1.7; }); });

  // Si la boutique a été fermée dans la session précédente, on respecte le choix.
  try {
    const last = localStorage.getItem('tikowiko-v24-open');
    if (last === '0') closeShop();
  } catch (_) {}
  openBtn.addEventListener('click', () => { try { localStorage.setItem('tikowiko-v24-open', state.twShopOpen ? '1' : '0'); } catch (_) {} }, { capture:false });

  // Corrige le cadrage lorsqu'on personnalise : toute la salle reste visible.
  function v24Camera() {
    if (!isPortraitMobile()) return;
    camera.position.set(8.9, 10.4, 12.2); controls.target.set(0, 0.72, 1.15); camera.fov = 42; camera.updateProjectionMatrix(); controls.update();
  }
  v24Camera();
  updateOpenUI();
  toast('🏪 v2.4 : panneau ouvert/fermé, tables accessibles et personnalisation complète');
})();
