/* TikoWikoBakery 2.3 — aménagement libre + navigation dynamique + service client fiabilisé. */
(() => {
  const ROOM = { minX: -6.45, maxX: 6.45, minZ: -3.95, maxZ: 6.25 };
  const GRID = 0.45;
  const SERVICE_SPOTS = [
    { x: -1.65, z: 2.72 },
    { x: -0.55, z: 2.72 },
    { x: 0.55, z: 2.72 },
    { x: 1.65, z: 2.72 }
  ];

  let layoutMode = false;
  let selected = null;
  let dragStart = null;
  let dragOffset = new THREE.Vector3();
  let trafficVisible = false;
  let selectorHelper = null;
  let lastPointerDown = null;
  const movables = [];
  const movableByRoot = new Map();
  const trafficGroup = new THREE.Group();
  trafficGroup.visible = false;
  scene.add(trafficGroup);

  const mat = (color, roughness = 0.62) => new THREE.MeshStandardMaterial({ color, roughness });
  const mesh = (geo, material) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  function near(a, b, eps = 0.18) { return Math.abs(a - b) <= eps; }
  function nearestGroup(x, z, eps = 0.28) {
    let best = null;
    let bestD = Infinity;
    for (const o of scene.children) {
      if (!o?.isGroup || o.userData?.fullBody) continue;
      const d = Math.hypot(o.position.x - x, o.position.z - z);
      if (d < eps && d < bestD) { best = o; bestD = d; }
    }
    return best;
  }

  function registerMovable(id, label, root, halfX, halfZ, type, ref = null) {
    if (!root || movableByRoot.has(root)) return null;
    root.userData.twMovableId = id;
    const item = { id, label, root, halfX, halfZ, type, ref };
    movables.push(item);
    movableByRoot.set(root, item);
    return item;
  }

  // Vitrines créées par self-service-display.js.
  registerMovable('case-pizza', 'Vitrine pizzas', nearestGroup(-2.25, 1.55, 0.38), 1.30, 0.58, 'display');
  registerMovable('case-pastry', 'Vitrine viennoiseries', nearestGroup(1.45, 1.55, 0.38), 1.60, 0.58, 'display');
  registerMovable('bread-island', 'Présentoir pains', nearestGroup(3.40, -0.15, 0.38), 0.98, 0.48, 'display');

  // Tables et chaises créées par service-dining-overhaul.js.
  const diningStarts = [
    [-4.85, 3.05], [-2.75, 3.30], [-4.95, 0.45], [-2.75, 0.55]
  ];
  diningStarts.forEach(([x, z], i) => {
    registerMovable(`table-${i}`, `Table ${i + 1}`, nearestGroup(x, z, 0.24), 0.68, 0.68, 'table');
    registerMovable(`chair-${i}-a`, `Chaise ${i + 1}A`, nearestGroup(x, z + 1.05, 0.22), 0.30, 0.30, 'chair');
    registerMovable(`chair-${i}-b`, `Chaise ${i + 1}B`, nearestGroup(x, z - 1.05, 0.22), 0.30, 0.30, 'chair');
  });

  // Caisses : la référence de gameplay doit suivre le meuble déplacé.
  state.checkouts.forEach((co, i) => {
    const root = co.visual?.group || co.visual;
    registerMovable(`checkout-${i}`, `Caisse ${i + 1}`, root, 0.58, 0.72, 'checkout', co);
  });

  // Nouveau point de retrait mobile, visible et dédié au serveur.
  const pickupGroup = new THREE.Group();
  pickupGroup.userData.twV23Pickup = true;
  const pickupBody = mesh(new THREE.BoxGeometry(1.05, 0.72, 0.52), mat(0x70401f, 0.68));
  pickupBody.position.y = 0.36;
  pickupGroup.add(pickupBody);
  const pickupTop = mesh(new THREE.BoxGeometry(1.15, 0.09, 0.62), mat(0xb97a42, 0.52));
  pickupTop.position.y = 0.77;
  pickupGroup.add(pickupTop);
  const pickupTray = mesh(new THREE.BoxGeometry(0.72, 0.035, 0.38), mat(0xd1aa74, 0.50));
  pickupTray.position.set(0, 0.84, 0);
  pickupGroup.add(pickupTray);
  pickupGroup.position.set(2.35, 0, 0.85);
  scene.add(pickupGroup);
  registerMovable('pickup', 'Point de retrait', pickupGroup, 0.58, 0.34, 'service');

  function quarterTurn(item) {
    const q = Math.round(item.root.rotation.y / (Math.PI / 2));
    return ((q % 4) + 4) % 4;
  }
  function itemBounds(item) {
    const swap = quarterTurn(item) % 2 === 1;
    return {
      x: item.root.position.x,
      z: item.root.position.z,
      hx: swap ? item.halfZ : item.halfX,
      hz: swap ? item.halfX : item.halfZ
    };
  }

  function fixedObstacles() {
    const list = [
      { id: 'mixer', x: MIXER_POS.x, z: MIXER_POS.z, hx: 0.78, hz: 0.52 }
    ];
    state.ovens.forEach((o, i) => list.push({ id: `oven-${i}`, x: o.x, z: o.z, hx: 1.00, hz: 0.82 }));
    return list;
  }

  function overlaps(a, b, margin = 0.10) {
    return Math.abs(a.x - b.x) < a.hx + b.hx + margin && Math.abs(a.z - b.z) < a.hz + b.hz + margin;
  }

  function basicPlacementValid(item) {
    const b = itemBounds(item);
    if (b.x - b.hx < ROOM.minX || b.x + b.hx > ROOM.maxX || b.z - b.hz < ROOM.minZ || b.z + b.hz > ROOM.maxZ) return false;
    for (const f of fixedObstacles()) if (overlaps(b, f, 0.14)) return false;
    for (const other of movables) {
      if (other === item) continue;
      if (overlaps(b, itemBounds(other), 0.08)) return false;
    }
    // Entrée et cœur de l'allée centrale restent toujours dégagés.
    const protectedPoints = [ENTRANCE, ...SERVICE_SPOTS, { x: 2.4, z: 2.95 }];
    for (const p of protectedPoints) {
      if (Math.abs(p.x - b.x) < b.hx + 0.42 && Math.abs(p.z - b.z) < b.hz + 0.42) return false;
    }
    return true;
  }

  function blockedAt(x, z, radius = 0.22, ignoreId = null) {
    if (x < ROOM.minX + radius || x > ROOM.maxX - radius || z < ROOM.minZ + radius || z > ROOM.maxZ - radius) return true;
    for (const f of fixedObstacles()) {
      if (ignoreId === f.id) continue;
      if (Math.abs(x - f.x) < f.hx + radius && Math.abs(z - f.z) < f.hz + radius) return true;
    }
    for (const item of movables) {
      if (ignoreId === item.id) continue;
      const b = itemBounds(item);
      if (Math.abs(x - b.x) < b.hx + radius && Math.abs(z - b.z) < b.hz + radius) return true;
    }
    return false;
  }

  function cellKey(ix, iz) { return `${ix},${iz}`; }
  function worldToCell(x, z) {
    return {
      ix: Math.round((x - ROOM.minX) / GRID),
      iz: Math.round((z - ROOM.minZ) / GRID)
    };
  }
  function cellToWorld(ix, iz) {
    return { x: ROOM.minX + ix * GRID, z: ROOM.minZ + iz * GRID };
  }

  function pathfind(start, goal, radius = 0.22, ignoreId = null) {
    const s = worldToCell(start.x, start.z);
    const g = worldToCell(goal.x, goal.z);
    const open = [{ ...s, f: 0 }];
    const came = new Map();
    const gScore = new Map([[cellKey(s.ix, s.iz), 0]]);
    const closed = new Set();
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let iterations = 0;

    while (open.length && iterations++ < 1600) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      const ck = cellKey(cur.ix, cur.iz);
      if (closed.has(ck)) continue;
      closed.add(ck);
      if (cur.ix === g.ix && cur.iz === g.iz) {
        const path = [];
        let k = ck;
        while (k !== cellKey(s.ix, s.iz)) {
          const [ix, iz] = k.split(',').map(Number);
          path.push(cellToWorld(ix, iz));
          k = came.get(k);
          if (!k) break;
        }
        path.reverse();
        path.push({ x: goal.x, z: goal.z });
        return path;
      }
      for (const [dx, dz] of dirs) {
        const ni = cur.ix + dx, nz = cur.iz + dz;
        const w = cellToWorld(ni, nz);
        if (!(ni === g.ix && nz === g.iz) && blockedAt(w.x, w.z, radius, ignoreId)) continue;
        const nk = cellKey(ni, nz);
        if (closed.has(nk)) continue;
        const cost = gScore.get(ck) + (dx && dz ? 1.414 : 1);
        if (cost >= (gScore.get(nk) ?? Infinity)) continue;
        came.set(nk, ck);
        gScore.set(nk, cost);
        const h = Math.hypot(g.ix - ni, g.iz - nz);
        open.push({ ix: ni, iz: nz, f: cost + h });
      }
    }
    return null;
  }

  function pathExists(start, goal, ignoreId = null) {
    return !!pathfind(start, goal, 0.24, ignoreId);
  }

  function checkoutFront(co) { return { x: co.x - 1.02, z: co.z }; }
  function serviceRouteValid() {
    const openCheckout = state.checkouts[0];
    if (!openCheckout) return false;
    const reachableSpot = SERVICE_SPOTS.find(p => pathExists(ENTRANCE, p));
    if (!reachableSpot) return false;
    if (!pathExists(reachableSpot, checkoutFront(openCheckout), `checkout-${state.checkouts.indexOf(openCheckout)}`)) return false;
    const pickupItem = movables.find(m => m.id === 'pickup');
    const pickupPose = pickupItem ? { x: pickupItem.root.position.x, z: pickupItem.root.position.z + 0.70 } : { x: 2.35, z: 1.55 };
    if (!pathExists(REST_SPOT, pickupPose, pickupItem?.id || null)) return false;
    return true;
  }

  function fullPlacementValid(item) {
    return basicPlacementValid(item) && serviceRouteValid();
  }

  function updateCheckoutRefs() {
    for (const item of movables) {
      if (item.type !== 'checkout' || !item.ref) continue;
      item.ref.x = item.root.position.x;
      item.ref.z = item.root.position.z;
    }
  }

  function saveLayout() {
    try {
      const data = {};
      for (const item of movables) data[item.id] = { x: item.root.position.x, z: item.root.position.z, r: item.root.rotation.y };
      localStorage.setItem('tikowiko-layout-v23', JSON.stringify(data));
    } catch (_) {}
    updateCheckoutRefs();
  }

  function loadLayout() {
    try {
      const raw = localStorage.getItem('tikowiko-layout-v23');
      if (!raw) return false;
      const data = JSON.parse(raw);
      for (const item of movables) {
        const d = data[item.id];
        if (!d) continue;
        item.root.position.set(d.x, 0, d.z);
        item.root.rotation.y = d.r || 0;
      }
      updateCheckoutRefs();
      return serviceRouteValid();
    } catch (_) { return false; }
  }

  function arrangeSafe() {
    const put = (id, x, z, r = 0) => {
      const item = movables.find(m => m.id === id);
      if (!item) return;
      item.root.position.set(x, 0, z);
      item.root.rotation.y = r;
    };
    put('case-pizza', -2.05, -0.78, 0);
    put('case-pastry', 1.25, -0.78, 0);
    put('bread-island', 4.65, -0.62, Math.PI / 2);
    put('pickup', 2.55, 0.92, 0);
    state.checkouts.forEach((_, i) => put(`checkout-${i}`, 4.72 - i * 0.95, 3.48, -Math.PI / 2));

    const tablePos = [[-5.05,4.25],[-5.05,1.85],[-3.35,4.25],[-3.35,1.85]];
    tablePos.forEach(([x,z], i) => {
      put(`table-${i}`, x, z, 0);
      put(`chair-${i}-a`, x, z + 0.96, Math.PI);
      put(`chair-${i}-b`, x, z - 0.96, 0);
    });
    updateCheckoutRefs();
    saveLayout();
    refreshTraffic();
    toast('✨ Agencement automatique : grande allée centrale créée');
  }

  if (!loadLayout() || !serviceRouteValid()) arrangeSafe();

  // ---------------------------------------------------------------------------
  // Navigation dynamique A* + évitement léger entre PNJ.
  // ---------------------------------------------------------------------------
  function crowdRepulsion(obj) {
    let rx = 0, rz = 0;
    const all = [...state.staff.map(s => s.visual), ...state.customers.map(c => c.visual)];
    for (const other of all) {
      if (!other || other === obj) continue;
      const dx = obj.position.x - other.position.x;
      const dz = obj.position.z - other.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 0.50) {
        const k = (0.50 - d) / 0.50;
        rx += (dx / d) * k;
        rz += (dz / d) * k;
      }
    }
    return { x: rx, z: rz };
  }

  function navMove(obj, tx, tz, speed, dt, ignoreId = null) {
    if (!obj) return false;
    const finalDist = Math.hypot(tx - obj.position.x, tz - obj.position.z);
    if (finalDist < 0.075) return true;
    const nav = obj.userData.twV23Nav || (obj.userData.twV23Nav = {});
    const targetChanged = !nav.target || Math.hypot(nav.target.x - tx, nav.target.z - tz) > 0.30 || nav.ignoreId !== ignoreId;
    const stale = performance.now() - (nav.plannedAt || 0) > 850;
    if (targetChanged || stale || !nav.path?.length) {
      nav.target = { x: tx, z: tz };
      nav.ignoreId = ignoreId;
      nav.path = pathfind(obj.position, nav.target, obj.userData?.fullBody ? 0.22 : 0.18, ignoreId) || [{ x: tx, z: tz }];
      nav.index = 0;
      nav.plannedAt = performance.now();
    }

    const point = nav.path[Math.min(nav.index || 0, nav.path.length - 1)] || { x: tx, z: tz };
    const dx = point.x - obj.position.x;
    const dz = point.z - obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.11 && nav.index < nav.path.length - 1) {
      nav.index++;
      return navMove(obj, tx, tz, speed, dt, ignoreId);
    }

    const step = Math.min(Math.max(0.01, speed * dt), Math.max(0.01, dist));
    const rep = crowdRepulsion(obj);
    let ux = dx / Math.max(0.001, dist) + rep.x * 0.32;
    let uz = dz / Math.max(0.001, dist) + rep.z * 0.32;
    const len = Math.hypot(ux, uz) || 1;
    ux /= len; uz /= len;
    const nx = obj.position.x + ux * step;
    const nz = obj.position.z + uz * step;
    const radius = obj.userData?.fullBody ? 0.20 : 0.16;
    if (!blockedAt(nx, nz, radius, ignoreId)) {
      obj.position.x = nx;
      obj.position.z = nz;
    } else {
      nav.plannedAt = 0;
    }
    obj.rotation.y = Math.atan2(tx - obj.position.x, tz - obj.position.z);
    if (obj.userData?.fullBody) obj.userData.lastMoveAt = performance.now();
    return Math.hypot(tx - obj.position.x, tz - obj.position.z) < 0.09;
  }
  moveTowards = navMove;

  // ---------------------------------------------------------------------------
  // Service client v2.3 : la logique self-service est remplacée par un vrai serveur.
  // ---------------------------------------------------------------------------
  function clearHeld(entity) {
    if (!entity?.heldVisual) return;
    entity.heldVisual.parent?.remove(entity.heldVisual);
    entity.heldVisual = null;
  }

  function makeHeldProduct(recipe) {
    const g = new THREE.Group();
    const breadMatV23 = new THREE.MeshStandardMaterial({ color: 0xd99443, roughness: 0.55 });
    let p;
    if (recipe === 'baguette') {
      p = mesh(new THREE.CapsuleGeometry(0.07, 0.48, 5, 10), breadMatV23);
      p.rotation.z = Math.PI / 2;
    } else if (recipe === 'croissant') {
      p = mesh(new THREE.TorusGeometry(0.16, 0.055, 8, 18, Math.PI * 1.45), breadMatV23);
      p.rotation.x = Math.PI / 2;
    } else {
      p = mesh(new THREE.SphereGeometry(0.15, 14, 10), breadMatV23);
      p.scale.set(1.15, 0.72, 1);
    }
    g.add(p);
    const plate = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 18), new THREE.MeshStandardMaterial({ color: 0xe0bc82, roughness: 0.5 }));
    plate.position.y = -0.12;
    g.add(plate);
    g.scale.setScalar(1.18);
    return g;
  }

  function attachHeld(entity, recipe) {
    clearHeld(entity);
    const hand = entity?.visual?.userData?.rig?.rightArm?.hand;
    if (!hand) return;
    const item = makeHeldProduct(recipe);
    item.position.set(0, -0.05, 0.16);
    hand.add(item);
    entity.heldVisual = item;
  }

  function reserveServiceSpot(c) {
    const occupied = new Set(state.customers.filter(o => o !== c && o.serviceSpotIndex != null && !['leaving','fleeing'].includes(o.state)).map(o => o.serviceSpotIndex));
    const free = SERVICE_SPOTS.findIndex((_, i) => !occupied.has(i));
    c.serviceSpotIndex = free >= 0 ? free : (c.id % SERVICE_SPOTS.length);
    return SERVICE_SPOTS[c.serviceSpotIndex];
  }

  function serviceSpot(c) {
    if (c.serviceSpotIndex == null) return reserveServiceSpot(c);
    return SERVICE_SPOTS[Math.max(0, Math.min(SERVICE_SPOTS.length - 1, c.serviceSpotIndex))];
  }

  function createOrder(c) {
    if (c.order && c.order.customer === c) return c.order;
    c.orderCreated = true;
    c.order = { customer: c, recipe: c.desired, server: null, state: 'waitingServer', wait: 0 };
    return c.order;
  }

  function releaseOrder(c) {
    if (!c?.order) return;
    const s = c.order.server;
    if (s && s.serviceOrder === c.order) s.serviceOrder = null;
    c.order = null;
  }

  function pickupPose() {
    const p = movables.find(m => m.id === 'pickup');
    return p ? { x: p.root.position.x, z: p.root.position.z + 0.72, ignoreId: p.id } : { x: 2.35, z: 1.55, ignoreId: null };
  }

  function startRestock(emp) {
    const oven = state.ovens.find(o => o.state === 'ready' && o.claimedBy == null);
    if (!oven) return false;
    oven.claimedBy = emp.id;
    emp.v23RestockOven = oven;
    emp.state = 'v23RestockOven';
    return true;
  }

  updateSeller = function(emp, dt) {
    if (layoutMode) return;
    if (emp.v23RestockOven) {
      const oven = emp.v23RestockOven;
      if (emp.state === 'v23RestockOven') {
        emp.visual.userData.action = 'walk';
        if (navMove(emp.visual, oven.x, oven.z + 1.08, emp.speed, dt, `oven-${state.ovens.indexOf(oven)}`)) {
          const recipe = oven.recipe;
          emp.v23RestockBatch = { recipe, qty: 3 + Math.floor(emp.efficiency) };
          oven.state = 'idle'; oven.progress = 0; oven.recipe = null; oven.claimedBy = null;
          attachHeld(emp, recipe);
          setBubble(emp.visual, RECIPES[recipe]?.icon || '🥖');
          emp.state = 'v23RestockCounter';
        }
        return;
      }
      if (emp.state === 'v23RestockCounter') {
        const p = pickupPose();
        emp.visual.userData.action = 'carry';
        if (navMove(emp.visual, p.x, p.z, emp.speed, dt, p.ignoreId)) {
          const b = emp.v23RestockBatch;
          state.stock[b.recipe] = (state.stock[b.recipe] || 0) + b.qty;
          clearHeld(emp); setBubble(emp.visual, null);
          emp.v23RestockBatch = null; emp.v23RestockOven = null; emp.state = 'idle';
        }
        return;
      }
    }

    let order = emp.serviceOrder;
    if (!order || !order.customer || !state.customers.includes(order.customer)) {
      emp.serviceOrder = null;
      order = null;
    }
    if (!order) {
      const waiting = state.customers.find(c => c.state === 'waitingService' && c.order && !c.order.server && (state.stock[c.desired] || 0) > 0);
      if (waiting) {
        order = waiting.order;
        order.server = emp;
        emp.serviceOrder = order;
        emp.state = 'v23Pickup';
      } else {
        const noStock = state.customers.some(c => c.state === 'waitingService' && (state.stock[c.desired] || 0) <= 0);
        if (noStock && startRestock(emp)) return;
        navMove(emp.visual, REST_SPOT.x, REST_SPOT.z, emp.speed * 0.72, dt);
        emp.visual.userData.action = 'idle';
        return;
      }
    }

    const c = order.customer;
    if (emp.state === 'v23Pickup') {
      const p = pickupPose();
      emp.visual.userData.action = 'walk';
      if (navMove(emp.visual, p.x, p.z, emp.speed, dt, p.ignoreId)) {
        if ((state.stock[order.recipe] || 0) <= 0) {
          order.server = null; emp.serviceOrder = null; emp.state = 'idle'; return;
        }
        state.stock[order.recipe]--;
        attachHeld(emp, order.recipe);
        setBubble(emp.visual, RECIPES[order.recipe]?.icon || '🥖');
        emp.state = 'v23Deliver';
      }
      return;
    }
    if (emp.state === 'v23Deliver') {
      const s = serviceSpot(c);
      const target = { x: s.x + 0.50, z: s.z - 0.18 };
      emp.visual.userData.action = 'carry';
      if (navMove(emp.visual, target.x, target.z, emp.speed, dt)) {
        emp.state = 'v23Handoff';
        order.wait = 0.42;
      }
      return;
    }
    if (emp.state === 'v23Handoff') {
      emp.visual.userData.action = 'serve';
      order.wait -= dt;
      if (order.wait <= 0) {
        clearHeld(emp);
        attachHeld(c, order.recipe);
        setBubble(emp.visual, null);
        setBubble(c.visual, '✅');
        c.price = RECIPES[order.recipe]?.price || 3;
        c.state = 'receivedProduct';
        c.waitT = 0.42;
        releaseOrder(c);
        emp.state = 'idle';
      }
    }
  };

  function chooseCheckout(c) {
    const open = state.checkouts.filter(co => co.staffId != null);
    if (!open.length) return null;
    return open.slice().sort((a, b) => a.queue.length - b.queue.length)[0];
  }

  function checkoutCustomerPose(co, index) {
    return { x: co.x - 1.04 - Math.max(0, index) * 0.52, z: co.z };
  }

  function availableDiningChair(c) {
    const tables = movables.filter(m => m.type === 'table');
    const chairs = movables.filter(m => m.type === 'chair');
    for (const chair of chairs) {
      if (chair.occupiedBy != null) continue;
      const closeTable = tables.some(t => Math.hypot(t.root.position.x - chair.root.position.x, t.root.position.z - chair.root.position.z) < 1.30);
      if (!closeTable) continue;
      chair.occupiedBy = c.id;
      c.v23Chair = chair;
      return chair;
    }
    return null;
  }

  function releaseChair(c) {
    if (c?.v23Chair) c.v23Chair.occupiedBy = null;
    c.v23Chair = null;
  }

  const oldRemoveCustomerV23 = removeCustomer;
  removeCustomer = function(c) {
    clearHeld(c);
    releaseOrder(c);
    releaseChair(c);
    oldRemoveCustomerV23(c);
  };

  const previousSpawnV23 = spawnCustomer;
  spawnCustomer = function() {
    if (layoutMode || state.customers.length >= 8) return;
    const before = state.customers.length;
    previousSpawnV23();
    if (state.customers.length <= before) return;
    const c = state.customers[state.customers.length - 1];
    c.state = 'toCounter';
    c.order = null;
    c.orderCreated = false;
    c.serviceSpotIndex = null;
    c.checkout = null;
    setBubble(c.visual, RECIPES[c.desired]?.icon || '🥖');
  };

  updateCustomer = function(c, dt) {
    if (layoutMode) return;
    // Les anciens états libre-service sont convertis vers le service humain.
    if (c.state === 'toDisplay' || c.state === 'selfServing' || c.state === 'taking' || c.state === 'waiting') {
      c.state = 'toCounter';
      c.serviceSpotIndex = null;
    }

    if (c.state === 'toCounter') {
      const s = serviceSpot(c);
      if (navMove(c.visual, s.x, s.z, 1.48, dt)) {
        c.state = 'ordering'; c.waitT = 0.28;
        setBubble(c.visual, RECIPES[c.desired]?.icon || '🥖');
      }
      return;
    }
    if (c.state === 'ordering') {
      c.waitT -= dt;
      if (c.waitT <= 0) { createOrder(c); c.state = 'waitingService'; }
      return;
    }
    if (c.state === 'waitingService') {
      createOrder(c);
      c.visual.userData.action = 'idle';
      return;
    }
    if (c.state === 'receivedProduct') {
      c.waitT -= dt;
      if (c.waitT > 0) return;
      if (c.isThief) { attemptDetection(c); c.state = 'fleeing'; return; }
      const co = chooseCheckout(c);
      if (!co) { c.state = 'leaving'; return; }
      if (!co.queue.includes(c)) co.queue.push(c);
      c.checkout = co;
      c.state = 'toCheckout';
      return;
    }
    if (c.state === 'toCheckout' || c.state === 'waitingPayment') {
      if (!c.checkout) { c.state = 'leaving'; return; }
      const qi = c.checkout.queue.indexOf(c);
      if (qi < 0) {
        c.state = 'afterPayment';
        c.waitT = 0.35;
        return;
      }
      const p = checkoutCustomerPose(c.checkout, qi);
      const id = `checkout-${state.checkouts.indexOf(c.checkout)}`;
      if (navMove(c.visual, p.x, p.z, c.state === 'toCheckout' ? 1.48 : 1.30, dt, id)) c.state = 'waitingPayment';
      return;
    }
    if (c.state === 'afterPayment') {
      c.waitT -= dt;
      if (c.waitT > 0) return;
      clearHeld(c);
      if (Math.random() < 0.62) {
        const chair = availableDiningChair(c);
        if (chair) { c.state = 'v23Dining'; c.eatT = 4.5 + Math.random() * 3.0; setBubble(c.visual, '🍽️'); return; }
      }
      setBubble(c.visual, null);
      c.state = 'leaving';
      return;
    }
    if (c.state === 'v23Dining') {
      const chair = c.v23Chair;
      if (!chair) { c.state = 'leaving'; return; }
      const target = { x: chair.root.position.x, z: chair.root.position.z };
      if (navMove(c.visual, target.x, target.z, 1.25, dt, chair.id)) {
        c.state = 'v23Eating';
        c.visual.userData.action = 'eat';
      }
      return;
    }
    if (c.state === 'v23Eating') {
      c.eatT -= dt;
      c.visual.userData.action = 'eat';
      if (c.eatT <= 0) { releaseChair(c); setBubble(c.visual, '😊'); c.state = 'leaving'; }
      return;
    }
    if (c.state === 'fleeing') {
      setBubble(c.visual, null);
      if (navMove(c.visual, ENTRANCE.x, ENTRANCE.z, 2.15, dt)) removeCustomer(c);
      return;
    }
    if (c.state === 'leaving') {
      if (navMove(c.visual, ENTRANCE.x, ENTRANCE.z, 1.50, dt)) removeCustomer(c);
      return;
    }
    c.state = 'toCounter';
  };

  updateCashier = function(emp, dt) {
    if (layoutMode) return;
    if (!emp.targetCheckout) {
      assignCheckout(emp);
      if (!emp.targetCheckout) { navMove(emp.visual, REST_SPOT.x, REST_SPOT.z, emp.speed, dt); return; }
    }
    const co = emp.targetCheckout;
    const ci = state.checkouts.indexOf(co);
    const staffPose = { x: co.x + 0.80, z: co.z };
    if (emp.state !== 'atCheckout') {
      emp.visual.userData.action = 'walk';
      if (navMove(emp.visual, staffPose.x, staffPose.z, emp.speed, dt, `checkout-${ci}`)) emp.state = 'atCheckout';
      return;
    }
    emp.visual.position.x = staffPose.x;
    emp.visual.position.z = staffPose.z;
    emp.visual.rotation.y = -Math.PI / 2;
    if (!co.queue.length) { co.busy = false; emp.visual.userData.action = 'idle'; return; }
    emp.visual.userData.action = 'scan';
    if (!co.busy) { co.busy = true; co.progress = 0; }
    else {
      co.progress += dt * emp.efficiency * 0.95;
      if (co.visual?.screenGlow) co.visual.screenGlow.emissiveIntensity = 0.7 + Math.sin(performance.now() / 90) * 0.22;
      if (co.progress >= 1) {
        co.progress = 0; co.busy = false;
        const client = co.queue.shift();
        if (client) {
          completeSale(client);
          client.state = 'afterPayment';
          client.waitT = 0.32;
        }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Mode Aménagement : toucher/glisser, tourner, validation rouge/verte, sauvegarde.
  // ---------------------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    #twLayoutBtn{position:fixed;right:12px;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 105px);z-index:90;border:0;border-radius:18px;padding:10px 13px;background:#fff0c9;color:#5b3219;font:800 13px 'Baloo 2',sans-serif;box-shadow:0 5px 18px #0008;border:2px solid #d99b43}
    #twLayoutPanel{position:fixed;left:10px;right:10px;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 100px);z-index:91;display:none;gap:6px;align-items:center;padding:8px;border-radius:18px;background:#2b160bea;border:2px solid #e5a94f;box-shadow:0 7px 25px #0009;overflow-x:auto}
    #twLayoutPanel.show{display:flex}
    #twLayoutPanel button{flex:0 0 auto;border:0;border-radius:12px;padding:8px 10px;background:#fff2d3;color:#5a321d;font:800 12px 'Baloo 2',sans-serif}
    #twLayoutPanel .danger{background:#ffd6cf}.twLayoutName{flex:1 0 118px;color:#fff3d4;font:800 12px 'Baloo 2',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  `;
  document.head.appendChild(style);

  const layoutBtn = document.createElement('button');
  layoutBtn.id = 'twLayoutBtn';
  layoutBtn.textContent = '🛠️ Aménager';
  document.body.appendChild(layoutBtn);

  const panel = document.createElement('div');
  panel.id = 'twLayoutPanel';
  panel.innerHTML = `<div class="twLayoutName">Aucun meuble</div><button data-a="rotate">↻ Tourner</button><button data-a="traffic">🚦 Allées</button><button data-a="auto">✨ Ranger</button><button data-a="save">✓ Valider</button><button class="danger" data-a="cancel">✕ Annuler</button>`;
  document.body.appendChild(panel);
  const nameEl = panel.querySelector('.twLayoutName');

  function setHelper(item, valid = true) {
    if (selectorHelper) { scene.remove(selectorHelper); selectorHelper.geometry?.dispose?.(); selectorHelper.material?.dispose?.(); selectorHelper = null; }
    if (!item) return;
    selectorHelper = new THREE.BoxHelper(item.root, valid ? 0x55ee73 : 0xff4545);
    selectorHelper.material.depthTest = false;
    selectorHelper.renderOrder = 999;
    scene.add(selectorHelper);
  }

  function refreshHelper() {
    if (!selected || !selectorHelper) return;
    selectorHelper.update();
    selectorHelper.material.color.set(basicPlacementValid(selected) ? 0x55ee73 : 0xff4545);
  }

  function enterLayout() {
    layoutMode = true;
    controls.enabled = false;
    layoutBtn.style.display = 'none';
    panel.classList.add('show');
    nameEl.textContent = 'Touchez un meuble puis glissez-le';
    toast('🛠️ Mode aménagement : déplacez et tournez vos meubles');
  }

  function exitLayout(save = true) {
    if (save) saveLayout();
    layoutMode = false;
    controls.enabled = true;
    selected = null;
    dragStart = null;
    setHelper(null);
    panel.classList.remove('show');
    layoutBtn.style.display = '';
    if (trafficVisible) toggleTraffic(false);
  }

  layoutBtn.addEventListener('click', enterLayout);

  function rootForObject(obj) {
    let cur = obj;
    while (cur && cur !== scene) {
      if (movableByRoot.has(cur)) return cur;
      cur = cur.parent;
    }
    return null;
  }

  const editRay = new THREE.Raycaster();
  const editPointer = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pointerRay(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    editPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    editPointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    editRay.setFromCamera(editPointer, camera);
  }

  renderer.domElement.addEventListener('pointerdown', e => {
    if (!layoutMode) return;
    e.preventDefault(); e.stopPropagation();
    lastPointerDown = e.pointerId;
    pointerRay(e);
    const roots = movables.map(m => m.root);
    const hits = editRay.intersectObjects(roots, true);
    if (!hits.length) { selected = null; setHelper(null); nameEl.textContent = 'Touchez un meuble'; return; }
    const root = rootForObject(hits[0].object);
    selected = movableByRoot.get(root) || null;
    if (!selected) return;
    dragStart = { x: selected.root.position.x, z: selected.root.position.z, r: selected.root.rotation.y };
    const point = new THREE.Vector3();
    if (editRay.ray.intersectPlane(floorPlane, point)) dragOffset.set(point.x - selected.root.position.x, 0, point.z - selected.root.position.z);
    setHelper(selected, true);
    nameEl.textContent = `📦 ${selected.label}`;
    renderer.domElement.setPointerCapture?.(e.pointerId);
  }, { capture: true });

  renderer.domElement.addEventListener('pointermove', e => {
    if (!layoutMode || !selected || lastPointerDown !== e.pointerId) return;
    e.preventDefault(); e.stopPropagation();
    pointerRay(e);
    const point = new THREE.Vector3();
    if (!editRay.ray.intersectPlane(floorPlane, point)) return;
    let x = Math.round((point.x - dragOffset.x) / 0.25) * 0.25;
    let z = Math.round((point.z - dragOffset.z) / 0.25) * 0.25;
    const b = itemBounds(selected);
    x = Math.max(ROOM.minX + b.hx, Math.min(ROOM.maxX - b.hx, x));
    z = Math.max(ROOM.minZ + b.hz, Math.min(ROOM.maxZ - b.hz, z));
    selected.root.position.set(x, 0, z);
    if (selected.type === 'checkout' && selected.ref) { selected.ref.x = x; selected.ref.z = z; }
    refreshHelper();
    if (trafficVisible) refreshTraffic();
  }, { capture: true });

  renderer.domElement.addEventListener('pointerup', e => {
    if (!layoutMode || lastPointerDown !== e.pointerId) return;
    e.preventDefault(); e.stopPropagation();
    lastPointerDown = null;
    if (selected && !fullPlacementValid(selected) && dragStart) {
      selected.root.position.set(dragStart.x, 0, dragStart.z);
      selected.root.rotation.y = dragStart.r;
      if (selected.type === 'checkout' && selected.ref) { selected.ref.x = dragStart.x; selected.ref.z = dragStart.z; }
      toast('🚫 Placement refusé : cela bloquerait la circulation');
    } else if (selected) {
      saveLayout();
    }
    refreshHelper();
    if (trafficVisible) refreshTraffic();
  }, { capture: true });

  panel.addEventListener('click', e => {
    const action = e.target?.dataset?.a;
    if (!action) return;
    if (action === 'rotate') {
      if (!selected) { toast('Touchez d’abord un meuble'); return; }
      const old = selected.root.rotation.y;
      selected.root.rotation.y = Math.round((old + Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2);
      if (!fullPlacementValid(selected)) {
        selected.root.rotation.y = old;
        toast('🚫 Rotation impossible ici');
      } else saveLayout();
      refreshHelper();
      if (trafficVisible) refreshTraffic();
    } else if (action === 'traffic') {
      toggleTraffic(!trafficVisible);
    } else if (action === 'auto') {
      arrangeSafe();
      selected = null; setHelper(null); nameEl.textContent = 'Agencement automatique appliqué';
    } else if (action === 'save') {
      if (!serviceRouteValid()) { toast('🚫 Il faut garder un passage entrée → service → caisse'); return; }
      exitLayout(true);
      toast('✅ Aménagement enregistré');
    } else if (action === 'cancel') {
      if (selected && dragStart) {
        selected.root.position.set(dragStart.x, 0, dragStart.z);
        selected.root.rotation.y = dragStart.r;
      }
      exitLayout(false);
    }
  });

  function refreshTraffic() {
    if (!trafficVisible) return;
    while (trafficGroup.children.length) {
      const c = trafficGroup.children.pop();
      c.geometry?.dispose?.(); c.material?.dispose?.();
    }
    const freeMat = new THREE.MeshBasicMaterial({ color: 0x3adb62, transparent: true, opacity: 0.18, depthWrite: false });
    const blockMat = new THREE.MeshBasicMaterial({ color: 0xff4f4f, transparent: true, opacity: 0.22, depthWrite: false });
    for (let x = ROOM.minX + GRID / 2; x < ROOM.maxX; x += GRID * 1.5) {
      for (let z = ROOM.minZ + GRID / 2; z < ROOM.maxZ; z += GRID * 1.5) {
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(GRID * 1.35, GRID * 1.35), blockedAt(x, z, 0.20) ? blockMat : freeMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(x, 0.018, z);
        trafficGroup.add(tile);
      }
    }
  }

  function toggleTraffic(on) {
    trafficVisible = on;
    trafficGroup.visible = on;
    if (on) refreshTraffic();
  }

  // Le jeu est mis en pause uniquement pendant l'aménagement.
  const previousGameTickV23 = gameTick;
  gameTick = function(dt) {
    if (layoutMode) { refreshTop(); return; }
    previousGameTickV23(dt);
  };

  // Sauvegarde de sécurité et cadrage mobile plus proche de la salle.
  setInterval(() => { if (!layoutMode) saveLayout(); }, 15000);
  function applyV23Camera() {
    if (!(innerHeight > innerWidth && Math.min(innerWidth, innerHeight) <= 900)) return;
    camera.position.set(8.5, 9.7, 11.6);
    controls.target.set(0.1, 0.58, 1.2);
    camera.fov = 40.5;
    camera.updateProjectionMatrix();
    controls.minDistance = 7.0;
    controls.maxDistance = 18;
    controls.enablePan = false;
    controls.update();
  }
  applyV23Camera();
  addEventListener('orientationchange', () => setTimeout(applyV23Camera, 220), { passive: true });

  toast('🛠️ v2.3 : meubles déplaçables + service client réparé');
})();
