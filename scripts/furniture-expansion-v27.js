/* TikoWikoBakery 2.7 — personnalisation de tout le mobilier + stations d'agrandissement. */
(() => {
  const SAVE_LAYOUT = 'tikowiko-v27-furniture-layout';
  const SAVE_STATIONS = 'tikowiko-v27-bakery-stations';
  const items = new Map();
  const itemByRoot = new Map();
  let autoId = 1;
  let panelOpen = false;
  let selected = null;
  let dragging = false;
  let helper = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  state.twBakeryStations = state.twBakeryStations || [];
  state.twFurnitureV27 = { items, selected: null };

  const snap = v => Math.round(v / 0.25) * 0.25;
  const shopOpen = () => state.twShopOpen !== false;
  const currentMaxX = () => 6.15 + state.twBakeryStations.length * 2.35;

  function rootOf(obj) {
    let r = obj;
    while (r?.parent && r.parent !== scene) r = r.parent;
    return r?.parent === scene ? r : null;
  }

  function isCharacterRoot(root) {
    if (!root) return false;
    if (state.staff.some(s => s.visual === root)) return true;
    if (state.customers.some(c => c.visual === root)) return true;
    return !!root.userData?.fullBody;
  }

  function isStaticWorld(root) {
    return !root || root === floor || root === woodFloor || root === backWall || root === sideWall ||
      root.userData?.twV25Facade || root.userData?.twV25Exterior || root.userData?.twV27Annex;
  }

  function labelFor(root, fallback = 'Meuble') {
    const mid = root?.userData?.twMovableId || '';
    if (root === mixer) return 'Pétrin';
    if (root === displayCounter) return 'Comptoir principal';
    if (mid === 'pickup') return 'Point de retrait';
    if (mid.startsWith('table-')) return 'Table client';
    if (mid.startsWith('chair-')) return 'Chaise';
    if (mid.startsWith('checkout-')) return 'Caisse';
    if (mid.startsWith('case-')) return 'Vitrine';
    if (mid === 'bread-island') return 'Présentoir pains';
    if (root?.userData?.twV27Station) return 'Station boulangerie';
    const ovenIndex = state.ovens.findIndex(o => (o.visual?.group || o.visual) === root);
    if (ovenIndex >= 0) return `Four ${ovenIndex + 1}`;
    const checkoutIndex = state.checkouts.findIndex(c => (c.visual?.group || c.visual) === root);
    if (checkoutIndex >= 0) return `Caisse ${checkoutIndex + 1}`;
    return fallback;
  }

  function cloneMaterialsFor(root) {
    root.traverse(o => {
      if (!o?.isMesh || !o.material || o.userData.twV27MaterialReady) return;
      if (Array.isArray(o.material)) o.material = o.material.map(m => m?.clone ? m.clone() : m);
      else if (o.material?.clone) o.material = o.material.clone();
      o.userData.twV27MaterialReady = true;
    });
  }

  function tintRoot(root, color) {
    if (!root) return;
    cloneMaterialsFor(root);
    const c = new THREE.Color(color);
    root.traverse(o => {
      if (!o?.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(mat => {
        if (!mat?.color || mat.transparent && mat.opacity < 0.45) return;
        if (mat.emissive && mat.emissiveIntensity > 0.55) return;
        mat.color.copy(c);
        mat.needsUpdate = true;
      });
    });
    const item = itemByRoot.get(root);
    if (item) item.color = color;
  }

  function register(root, id = null, label = null, type = 'furniture') {
    if (!root || root.parent !== scene || isCharacterRoot(root) || isStaticWorld(root)) return null;
    if (itemByRoot.has(root)) return itemByRoot.get(root);
    let key = id || root.userData?.twMovableId || `auto-${autoId++}`;
    while (items.has(key) && items.get(key).root !== root) key = `${key}-${autoId++}`;
    root.userData.twFurnitureV27 = key;
    const item = {
      id: key,
      root,
      label: label || labelFor(root),
      type,
      start: { x: root.position.x, y: root.position.y, z: root.position.z, r: root.rotation.y || 0 },
      color: null
    };
    items.set(key, item);
    itemByRoot.set(root, item);
    return item;
  }

  function findTopGroupNear(x, z, eps = 0.32) {
    let best = null, bestD = Infinity;
    for (const o of scene.children) {
      if (!o?.isGroup || isCharacterRoot(o) || isStaticWorld(o)) continue;
      const d = Math.hypot(o.position.x - x, o.position.z - z);
      if (d < eps && d < bestD) { best = o; bestD = d; }
    }
    return best;
  }

  function registerExisting() {
    register(mixer, 'mixer-v27', 'Pétrin', 'production');
    register(displayCounter, 'counter-main-v27', 'Comptoir principal', 'counter');
    register(findTopGroupNear(3.2, -1.2, 0.42), 'pastry-case-v27', 'Vitrine pâtisseries', 'display');

    state.ovens.forEach((o, i) => register(o.visual?.group || o.visual, `oven-v27-${i}`, `Four ${i + 1}`, 'production'));
    state.checkouts.forEach((c, i) => register(c.visual?.group || c.visual, `checkout-v27-${i}`, `Caisse ${i + 1}`, 'checkout'));

    scene.traverse(o => {
      if (o?.parent !== scene || !o.isGroup || isCharacterRoot(o) || isStaticWorld(o) || o.visible === false) return;
      if (o.userData?.twMovableId) register(o, `mov-${o.userData.twMovableId}`, labelFor(o), 'movable');
    });

    // Tout autre groupe de décor/meuble déjà présent est aussi personnalisable.
    for (const o of scene.children) {
      if (!o?.isGroup || isCharacterRoot(o) || isStaticWorld(o) || o.visible === false || itemByRoot.has(o)) continue;
      register(o, null, labelFor(o, 'Décoration / meuble'), 'decor');
    }
  }

  function syncGameplay(item) {
    if (!item?.root) return;
    const root = item.root;
    if (root === mixer) {
      MIXER_POS.x = root.position.x;
      MIXER_POS.z = root.position.z;
    }
    state.ovens.forEach(o => {
      const r = o.visual?.group || o.visual;
      if (r === root) { o.x = root.position.x; o.z = root.position.z; }
    });
    state.checkouts.forEach(c => {
      const r = c.visual?.group || c.visual;
      if (r === root) { c.x = root.position.x; c.z = root.position.z; }
    });
    state.customers.forEach(c => { if (c.visual?.userData) c.visual.userData.twV23Nav = {}; });
  }

  function saveLayout() {
    const data = {};
    for (const [id, item] of items) {
      const r = item.root;
      data[id] = { x: r.position.x, y: r.position.y, z: r.position.z, r: r.rotation.y || 0, color: item.color || null };
    }
    try { localStorage.setItem(SAVE_LAYOUT, JSON.stringify(data)); } catch (_) {}
  }

  function loadLayout() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_LAYOUT) || '{}');
      for (const [id, d] of Object.entries(data)) {
        const item = items.get(id);
        if (!item || !d) continue;
        item.root.position.set(Number(d.x) || 0, Number.isFinite(d.y) ? d.y : item.start.y, Number(d.z) || 0);
        item.root.rotation.y = Number(d.r) || 0;
        if (d.color) tintRoot(item.root, d.color);
        syncGameplay(item);
      }
    } catch (_) {}
  }

  // ---------------------------------------------------------------------
  // Stations boulangerie : modules achetables pour agrandir l'atelier.
  // Chaque station ajoute une annexe visuelle et accélère la préparation.
  // ---------------------------------------------------------------------
  function stationCost() { return 420 + state.twBakeryStations.length * 320; }

  function makeStation(index) {
    const centerX = 6.75 + index * 2.35;
    const annex = new THREE.Group();
    annex.userData.twV27Annex = true;

    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.25, 7.9),
      new THREE.MeshStandardMaterial({ color: 0xc89f72, roughness: 0.86 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(centerX, -0.012, 0.05);
    floorMesh.receiveShadow = true;
    annex.add(floorMesh);

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(2.25, 4.2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.92 })
    );
    wall.position.set(centerX, 2.1, -3.92);
    wall.receiveShadow = true;
    annex.add(wall);

    const frontFrameMat = new THREE.MeshStandardMaterial({ color: 0x5a3821, roughness: 0.6 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xaee0f2, roughness: 0.12, transparent: true, opacity: 0.28 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.75, 0.04), glassMat);
    glass.position.set(centerX, 1.45, 5.98);
    annex.add(glass);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.10, 0.12), frontFrameMat);
    top.position.set(centerX, 2.35, 5.98); annex.add(top);
    const bottom = top.clone(); bottom.position.y = 0.52; annex.add(bottom);
    [-1, 1].forEach(side => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.92, 0.12), frontFrameMat);
      p.position.set(centerX + side * 0.98, 1.44, 5.98); annex.add(p);
    });
    scene.add(annex);

    const station = new THREE.Group();
    station.userData.twV27Station = true;
    station.position.set(centerX, 0, -2.25);

    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6338, roughness: 0.65 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xb9c1c7, roughness: 0.35, metalness: 0.65 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf3dfb5, roughness: 0.82 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.78, 0.72), wood);
    body.position.y = 0.39; body.castShadow = true; station.add(body);
    const topBoard = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.10, 0.84), cream);
    topBoard.position.y = 0.84; topBoard.castShadow = true; station.add(topBoard);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.20, 0.22, 20, 1, true), metal);
    bowl.position.set(-0.42, 1.03, 0); station.add(bowl);
    const dough = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe6cf9e, roughness: 0.9 }));
    dough.scale.set(1.3, 0.5, 1); dough.position.set(0.38, 0.96, 0); station.add(dough);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.28), wood);
    shelf.position.set(0, 1.55, -0.22); station.add(shelf);
    const posts = [-0.65, 0.65].map(x => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), metal);
      p.position.set(x, 1.22, -0.22); station.add(p); return p;
    });
    scene.add(station);

    const item = register(station, `station-v27-${index}`, `Station boulangerie ${index + 1}`, 'station');
    state.twBakeryStations.push({ index, station, annex, item });
    controls.maxDistance = Math.max(controls.maxDistance, 22 + state.twBakeryStations.length * 2.5);
    return station;
  }

  function saveStations() {
    try { localStorage.setItem(SAVE_STATIONS, String(state.twBakeryStations.length)); } catch (_) {}
  }

  function loadStations() {
    let count = 0;
    try { count = Math.min(2, Math.max(0, parseInt(localStorage.getItem(SAVE_STATIONS) || '0', 10) || 0)); } catch (_) {}
    for (let i = 0; i < count; i++) makeStation(i);
  }

  function buyStation() {
    if (state.twBakeryStations.length >= 2) return;
    const cost = stationCost();
    if (state.money < cost) { toast('💰 Pas assez d’argent'); return; }
    state.money -= cost;
    makeStation(state.twBakeryStations.length);
    saveStations();
    saveLayout();
    refreshTop();
    toast('🏗️ Nouvelle station : atelier agrandi et préparation accélérée');
    playTone(620, 0.12, 'triangle');
  }

  // La station est réellement utile : +18% de vitesse de préparation par module.
  const updateBakerV26 = updateBaker;
  updateBaker = function(emp, dt) {
    const bonus = 1 + state.twBakeryStations.length * 0.18;
    return updateBakerV26(emp, dt * bonus);
  };

  // ---------------------------------------------------------------------
  // Les achats futurs sont automatiquement enregistrés comme mobilier.
  // ---------------------------------------------------------------------
  const makePlantBase = makePlant;
  makePlant = function(x, z) {
    const root = makePlantBase(x, z);
    register(root, `plant-v27-${autoId++}`, 'Plante', 'decor');
    return root;
  };

  const makeCafeTableBase = makeCafeTable;
  makeCafeTable = function(x, z) {
    const root = makeCafeTableBase(x, z);
    register(root, `cafe-table-v27-${autoId++}`, 'Table achetée', 'table');
    return root;
  };

  const addOvenBase = addOven;
  addOven = function() {
    const oven = addOvenBase();
    if (oven) register(oven.visual?.group || oven.visual, `oven-v27-${state.ovens.length - 1}`, `Four ${state.ovens.length}`, 'production');
    return oven;
  };

  const addCheckoutBase = addCheckout;
  addCheckout = function() {
    const co = addCheckoutBase();
    if (co) register(co.visual?.group || co.visual, `checkout-v27-${state.checkouts.length - 1}`, `Caisse ${state.checkouts.length}`, 'checkout');
    return co;
  };

  // Ajout de la station dans la Boutique > Équipement sans réécrire le magasin existant.
  const renderShopPanelBase = renderShopPanel;
  renderShopPanel = function(body, tab) {
    renderShopPanelBase(body, tab);
    if (tab !== 'equipements') return;
    const count = state.twBakeryStations.length;
    const maxed = count >= 2;
    const cost = stationCost();
    const card = document.createElement('div');
    card.className = 'shop-item';
    card.innerHTML = `<div class="icon-box">🏗️</div>
      <div class="info"><div class="name">Station boulangerie</div>
      <div class="desc">Agrandit l’atelier et accélère la préparation de 18% (${count}/2)</div></div>
      <button class="buybtn ${maxed ? 'maxed' : ''}" ${(maxed || state.money < cost) ? 'disabled' : ''}>${maxed ? 'MAX' : cost + '€'}</button>`;
    if (!maxed) card.querySelector('button').onclick = () => {
      buyStation();
      renderShopPanel(body, tab);
    };
    body.appendChild(card);
  };

  // ---------------------------------------------------------------------
  // Interface mobile : sélectionner, déplacer, tourner et recolorer.
  // ---------------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    #twAllFurnitureBtn{display:none;position:fixed;right:10px;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 208px);z-index:108;border:2px solid #e0a14a;border-radius:18px;padding:9px 12px;background:#fff1c9;color:#57331e;font:900 12px 'Baloo 2',sans-serif;box-shadow:0 6px 20px #0008}
    #twFurniturePanel{display:none;position:fixed;left:8px;right:8px;top:calc(max(8px,env(safe-area-inset-top)) + 86px);z-index:109;max-height:58vh;overflow:auto;background:#25140df5;border:2px solid #dfa34d;border-radius:18px;padding:10px;color:#fff2d4;font:800 12px 'Baloo 2',sans-serif;box-shadow:0 10px 30px #000a}
    #twFurniturePanel.show{display:block}.twFurnRow{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0}.twFurnRow button{border:0;border-radius:10px;padding:8px 9px;background:#fff0cf;color:#58331d;font:800 11px 'Baloo 2',sans-serif}.twFurnRow button.on{outline:3px solid #73e18d}.twFurnName{background:#ffffff18;border-radius:10px;padding:7px 9px;margin:7px 0}.twPalette{width:33px;height:33px;padding:0!important;border:2px solid #fff8!important}.twFurnHint{font-size:10px;opacity:.78;line-height:1.3}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'twAllFurnitureBtn'; btn.textContent = '🪑 Tous les meubles'; document.body.appendChild(btn);
  const panel = document.createElement('div');
  panel.id = 'twFurniturePanel';
  panel.innerHTML = `
    <b>🪑 Mobilier complet</b>
    <div class="twFurnHint">Boutique fermée : touche puis fais glisser n’importe quel meuble, y compris les fours, caisses, vitrines, tables, chaises, décorations et meubles achetés.</div>
    <div class="twFurnName" data-furn-name>Aucun meuble sélectionné</div>
    <div class="twFurnRow"><button data-furn="rotate">↻ Tourner 90°</button><button data-furn="reset">🎯 Replacer</button><button data-furn="save">💾 Sauver</button><button data-furn="close">✓ Fermer</button></div>
    <div>🎨 Couleur du meuble</div>
    <div class="twFurnRow">
      <button class="twPalette" data-color="#8a5a34" style="background:#8a5a34"></button>
      <button class="twPalette" data-color="#f0e6d2" style="background:#f0e6d2"></button>
      <button class="twPalette" data-color="#7da77b" style="background:#7da77b"></button>
      <button class="twPalette" data-color="#7f9fbd" style="background:#7f9fbd"></button>
      <button class="twPalette" data-color="#d6a2ad" style="background:#d6a2ad"></button>
      <button class="twPalette" data-color="#454545" style="background:#454545"></button>
    </div>`;
  document.body.appendChild(panel);
  const nameBox = panel.querySelector('[data-furn-name]');

  function updateName() {
    nameBox.textContent = selected ? `Sélection : ${selected.label}` : 'Aucun meuble sélectionné';
    state.twFurnitureV27.selected = selected?.id || null;
  }

  function clearHelper() {
    if (helper) { scene.remove(helper); helper.geometry?.dispose?.(); helper.material?.dispose?.(); helper = null; }
  }

  function selectItem(item) {
    selected = item || null;
    clearHelper();
    if (selected?.root) {
      helper = new THREE.BoxHelper(selected.root, 0xffd65c);
      helper.raycast = () => {};
      scene.add(helper);
    }
    updateName();
  }

  function resetSelected() {
    if (!selected) return;
    const s = selected.start;
    selected.root.position.set(s.x, s.y, s.z);
    selected.root.rotation.y = s.r;
    syncGameplay(selected);
    saveLayout();
    if (helper) helper.update();
  }

  btn.onclick = () => {
    if (shopOpen()) { toast('🔴 Fermez d’abord la boulangerie'); return; }
    panelOpen = !panelOpen;
    panel.classList.toggle('show', panelOpen);
    if (!panelOpen) { dragging = false; selectItem(null); controls.enabled = true; }
  };

  panel.addEventListener('click', e => {
    const action = e.target?.dataset?.furn;
    const color = e.target?.dataset?.color;
    if (color && selected) { tintRoot(selected.root, color); saveLayout(); if (helper) helper.update(); }
    if (action === 'rotate' && selected) {
      selected.root.rotation.y += Math.PI / 2;
      syncGameplay(selected); saveLayout(); if (helper) helper.update();
    }
    if (action === 'reset') resetSelected();
    if (action === 'save') { saveLayout(); toast('💾 Mobilier sauvegardé'); }
    if (action === 'close') { panelOpen = false; panel.classList.remove('show'); dragging = false; selectItem(null); controls.enabled = true; }
  });

  function pointerFromEvent(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  renderer.domElement.addEventListener('pointerdown', ev => {
    if (!panelOpen || shopOpen()) return;
    pointerFromEvent(ev);
    const candidates = [...items.values()].map(i => i.root).filter(r => r?.visible !== false);
    const hits = raycaster.intersectObjects(candidates, true);
    if (!hits.length) { selectItem(null); return; }
    const root = rootOf(hits[0].object);
    const item = itemByRoot.get(root);
    if (!item) return;
    selectItem(item);
    dragging = true;
    controls.enabled = false;
    renderer.domElement.setPointerCapture?.(ev.pointerId);
  }, { capture: true });

  renderer.domElement.addEventListener('pointermove', ev => {
    if (!dragging || !selected || !panelOpen || shopOpen()) return;
    pointerFromEvent(ev);
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const maxX = currentMaxX();
    selected.root.position.x = snap(Math.max(-6.15, Math.min(maxX, hit.x)));
    selected.root.position.z = snap(Math.max(-3.75, Math.min(5.75, hit.z)));
    syncGameplay(selected);
    if (helper) helper.update();
  }, { capture: true });

  const stopDrag = ev => {
    if (!dragging) return;
    dragging = false;
    controls.enabled = true;
    if (selected) { syncGameplay(selected); saveLayout(); }
    try { renderer.domElement.releasePointerCapture?.(ev.pointerId); } catch (_) {}
  };
  renderer.domElement.addEventListener('pointerup', stopDrag, { capture: true });
  renderer.domElement.addEventListener('pointercancel', stopDrag, { capture: true });

  // Ajoute un raccourci dans le panneau de personnalisation existant.
  const customPanel = document.getElementById('twCustomPanel');
  if (customPanel && !customPanel.querySelector('[data-v27-furniture]')) {
    const row = document.createElement('div');
    row.className = 'twRow';
    const b = document.createElement('button');
    b.dataset.v27Furniture = '1'; b.textContent = '🪑 Tous les meubles';
    b.onclick = () => btn.click();
    row.appendChild(b); customPanel.appendChild(row);
  }

  // Les stations doivent être créées avant de charger les positions sauvegardées.
  loadStations();
  registerExisting();
  loadLayout();

  let lastRefresh = 0;
  gameLoopHooks.push(() => {
    btn.style.display = shopOpen() ? 'none' : 'block';
    if (shopOpen() && panelOpen) {
      panelOpen = false; panel.classList.remove('show'); dragging = false; selectItem(null); controls.enabled = true;
    }
    if (helper && selected) helper.update();

    // Découvre aussi les meubles créés par d'autres systèmes après l'initialisation.
    const t = performance.now();
    if (t - lastRefresh > 1600) {
      lastRefresh = t;
      for (const o of scene.children) {
        if (!o?.isGroup || itemByRoot.has(o) || isCharacterRoot(o) || isStaticWorld(o) || o.visible === false) continue;
        if (o.userData?.twMovableId || o.userData?.twV27Station) register(o, null, labelFor(o), 'dynamic');
      }
    }
  });

  toast('🪑 Mobilier complet + stations boulangerie activés');
})();
