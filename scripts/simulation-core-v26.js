/* TikoWikoBakery 2.6 — noyau de simulation refondu.
   - machines a etats courtes avec timeout pour chaque action
   - production, service, caisse et clients independants
   - commandes asynchrones : un client bloque ne bloque jamais les autres
   - bulles nettoyees et non cliquables
   - parcours table simplifie avec liberation garantie des places
*/
(() => {
  state.twSimulationV26 = true;

  const SERVICE_SPOTS = [
    { x: -1.70, z: 2.76 },
    { x: -0.58, z: 2.76 },
    { x:  0.58, z: 2.76 },
    { x:  1.70, z: 2.76 }
  ];
  const MAX_CUSTOMERS = 8;
  const ACTION_TIMEOUT = 9000;
  const MOVE_TIMEOUT = 10500;
  const ORDER_TIMEOUT = 16000;
  const sim = state.twV26 = {
    version: '2.6.0',
    orders: [],
    nextOrderId: 1,
    seats: new Map(),
    lastCleanup: 0
  };

  const now = () => performance.now();
  const shopOpen = () => state.twShopOpen !== false;
  const validRecipe = key => !!RECIPES[key];
  const recipeText = key => {
    const name = String(RECIPES[key]?.name || key || 'Commande').trim();
    return name.length > 9 ? name.slice(0, 9) : name;
  };

  function clearHeld(entity) {
    if (!entity?.heldVisual) return;
    entity.heldVisual.parent?.remove(entity.heldVisual);
    entity.heldVisual = null;
  }

  function makeHeld(recipe, dough = false) {
    const group = new THREE.Group();
    const breadMat = new THREE.MeshStandardMaterial({ color: dough ? 0xe8d2a1 : 0xd99443, roughness: 0.62 });
    let item;
    if (dough) {
      item = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 9), breadMat);
      item.scale.set(1.25, 0.62, 1);
    } else if (recipe === 'baguette') {
      item = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.48, 5, 10), breadMat);
      item.rotation.z = Math.PI / 2;
    } else if (recipe === 'croissant') {
      item = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.055, 8, 18, Math.PI * 1.45), breadMat);
      item.rotation.x = Math.PI / 2;
    } else {
      item = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), breadMat);
      item.scale.set(1.15, 0.72, 1);
    }
    item.castShadow = true;
    group.add(item);
    if (!dough) {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.025, 18),
        new THREE.MeshStandardMaterial({ color: 0xe0bc82, roughness: 0.5 })
      );
      plate.position.y = -0.12;
      group.add(plate);
    }
    return group;
  }

  function attachHeld(entity, recipe, dough = false) {
    clearHeld(entity);
    const hand = entity?.visual?.userData?.rig?.rightArm?.hand;
    if (!hand) return;
    const item = makeHeld(recipe, dough);
    item.position.set(0, -0.05, 0.16);
    hand.add(item);
    entity.heldVisual = item;
  }

  function staffMove(obj, tx, tz, speed, dt) {
    if (!obj) return false;
    const dx = tx - obj.position.x;
    const dz = tz - obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.075) {
      obj.position.x = tx;
      obj.position.z = tz;
      return true;
    }
    const step = Math.min(dist, Math.max(0.01, (speed || 1.5) * dt));
    obj.position.x += dx / dist * step;
    obj.position.z += dz / dist * step;
    obj.rotation.y = Math.atan2(dx, dz);
    obj.userData.twV23Nav = {};
    return Math.hypot(tx - obj.position.x, tz - obj.position.z) < 0.085;
  }

  function clientMove(c, tx, tz, speed, dt, ignoreId = null) {
    if (!c?.visual) return false;
    return moveTowards(c.visual, tx, tz, speed, dt, ignoreId);
  }

  function setStaffPhase(emp, phase, timeout = ACTION_TIMEOUT) {
    emp.tw26 = emp.tw26 || {};
    emp.tw26.phase = phase;
    emp.tw26.enteredAt = now();
    emp.tw26.deadline = now() + timeout;
  }

  function setClientPhase(c, phase, timeout = MOVE_TIMEOUT) {
    c.tw26 = c.tw26 || {};
    c.tw26.phase = phase;
    c.tw26.enteredAt = now();
    c.tw26.deadline = now() + timeout;
    c.tw26.retries = 0;
    c.state = phase;
  }

  function phaseExpired(obj) {
    return Number.isFinite(obj?.tw26?.deadline) && now() > obj.tw26.deadline;
  }

  function findMovableRoot(id) {
    let root = null;
    scene.traverse(o => { if (!root && o?.userData?.twMovableId === id) root = o; });
    return root;
  }

  function pickupPose() {
    const root = findMovableRoot('pickup');
    return root ? { x: root.position.x, z: root.position.z + 0.72 } : { x: 2.55, z: 1.64 };
  }

  function cleanupBubble(mesh) {
    if (!mesh?.userData?.bubbleSprite) return;
    mesh.userData.bubbleSprite.raycast = () => {};
  }

  function showCustomerBubble(c) {
    if (!c?.visual) return;
    cleanupBubble(c.visual);
    if (['ordering', 'waitingService'].includes(c.state)) setBubble(c.visual, recipeText(c.desired));
    else if (c.state === 'receivedProduct') setBubble(c.visual, 'OK');
    else if (c.state === 'eating') setBubble(c.visual, 'Miam');
    else setBubble(c.visual, null);
  }

  function clearOrder(order, returnStock = false) {
    if (!order) return;
    if (returnStock && order.status === 'picked' && validRecipe(order.recipe)) {
      state.stock[order.recipe] = (state.stock[order.recipe] || 0) + 1;
    }
    if (order.server?.tw26?.order === order) order.server.tw26.order = null;
    if (order.server?.serviceOrder === order) order.server.serviceOrder = null;
    if (order.customer?.tw26Order === order) order.customer.tw26Order = null;
    if (order.customer?.order === order) order.customer.order = null;
    order.server = null;
    order.status = 'done';
  }

  function ensureOrder(c) {
    if (!c || !state.customers.includes(c)) return null;
    if (!validRecipe(c.desired)) c.desired = RECIPE_KEYS.find(k => RECIPES[k]?.unlocked) || 'baguette';
    if (c.tw26Order && c.tw26Order.customer === c && !['done', 'cancelled'].includes(c.tw26Order.status)) return c.tw26Order;
    const order = {
      id: sim.nextOrderId++,
      customer: c,
      recipe: c.desired,
      server: null,
      status: 'queued',
      createdAt: now(),
      assignedAt: 0
    };
    sim.orders.push(order);
    c.tw26Order = order;
    c.order = order; // compatibilite avec les anciennes interfaces
    c.orderCreated = true;
    return order;
  }

  function pruneOrders() {
    sim.orders = sim.orders.filter(order => {
      if (!order || order.status === 'done' || order.status === 'cancelled') return false;
      if (!order.customer || !state.customers.includes(order.customer)) {
        clearOrder(order, order.status === 'picked');
        return false;
      }
      return true;
    });
  }

  function nextServiceOrder() {
    return sim.orders.find(o =>
      o.status === 'queued' &&
      o.customer?.state === 'waitingService' &&
      state.customers.includes(o.customer) &&
      (state.stock[o.recipe] || 0) > 0
    ) || null;
  }

  function demandRecipe() {
    const waiting = sim.orders.filter(o => o.status === 'queued' && o.customer?.state === 'waitingService');
    const hungry = waiting
      .map(o => o.recipe)
      .filter(validRecipe)
      .sort((a, b) => (state.stock[a] || 0) - (state.stock[b] || 0));
    if (hungry.length) return hungry[0];
    const unlocked = RECIPE_KEYS.filter(k => RECIPES[k]?.unlocked);
    return unlocked.sort((a, b) => (state.stock[a] || 0) - (state.stock[b] || 0))[0] || null;
  }

  // ---------------------------------------------------------------------
  // BOULANGER : chaque action a une sortie et un timeout.
  // ---------------------------------------------------------------------
  function resetBaker(emp) {
    const oven = emp.tw26?.oven;
    if (oven) {
      oven.reserved = false;
      if (oven.claimedBy === emp.id) oven.claimedBy = null;
    }
    clearHeld(emp);
    emp.tw26 = { phase: 'idle', enteredAt: now(), deadline: Infinity, oven: null, recipe: null, timer: 0 };
    emp.state = 'idle';
    if (emp.visual?.userData) emp.visual.userData.action = 'idle';
    setBubble(emp.visual, null);
  }

  updateBaker = function(emp, dt) {
    if (!shopOpen()) return;
    if (!emp.tw26 || !['idle','toMixer','knead','toOven'].includes(emp.tw26.phase)) resetBaker(emp);
    if (phaseExpired(emp)) { resetBaker(emp); return; }

    const f = emp.tw26;
    if (f.phase === 'idle') {
      const recipe = demandRecipe();
      const oven = state.ovens.find(o => o.state === 'idle' && !o.reserved && o.claimedBy == null);
      if (!recipe || !oven) { emp.visual.userData.action = 'idle'; return; }
      oven.reserved = true;
      f.oven = oven;
      f.recipe = recipe;
      setStaffPhase(emp, 'toMixer', MOVE_TIMEOUT);
      return;
    }

    if (f.phase === 'toMixer') {
      emp.visual.userData.action = 'walk';
      if (staffMove(emp.visual, MIXER_POS.x, MIXER_POS.z + 0.72, emp.speed, dt)) {
        f.timer = Math.max(0.8, RECIPES[f.recipe].prepTime / Math.max(0.7, emp.efficiency || 1));
        setStaffPhase(emp, 'knead', Math.max(5000, f.timer * 3000));
      }
      return;
    }

    if (f.phase === 'knead') {
      emp.visual.userData.action = 'knead';
      f.timer -= dt;
      if (f.timer <= 0) {
        attachHeld(emp, f.recipe, true);
        setStaffPhase(emp, 'toOven', MOVE_TIMEOUT);
      }
      return;
    }

    if (f.phase === 'toOven') {
      const oven = f.oven;
      if (!oven || oven.state !== 'idle') { resetBaker(emp); return; }
      emp.visual.userData.action = 'carry';
      if (staffMove(emp.visual, oven.x, oven.z + 1.02, emp.speed, dt)) {
        clearHeld(emp);
        oven.state = 'baking';
        oven.progress = 0;
        oven.recipe = f.recipe;
        oven.reserved = false;
        oven.claimedBy = null;
        resetBaker(emp);
      }
    }
  };

  // ---------------------------------------------------------------------
  // SERVEUR : la file de commandes est independante de chaque client.
  // Un client bloque n'empeche jamais le serveur de traiter le suivant.
  // ---------------------------------------------------------------------
  function resetSeller(emp, returnStock = false) {
    const order = emp.tw26?.order || emp.serviceOrder;
    if (order && !['done','cancelled','delivered'].includes(order.status)) {
      if (returnStock && order.status === 'picked') state.stock[order.recipe] = (state.stock[order.recipe] || 0) + 1;
      order.server = null;
      order.status = 'queued';
      order.assignedAt = 0;
    }
    clearHeld(emp);
    emp.serviceOrder = null;
    emp.tw26 = { phase: 'idle', enteredAt: now(), deadline: Infinity, order: null };
    emp.state = 'idle';
    setBubble(emp.visual, null);
    if (emp.visual?.userData) emp.visual.userData.action = 'idle';
  }

  updateSeller = function(emp, dt) {
    if (!shopOpen()) return;
    if (!emp.tw26 || !['idle','toPickup','toCustomer','handoff'].includes(emp.tw26.phase)) resetSeller(emp, false);
    if (phaseExpired(emp)) { resetSeller(emp, true); return; }
    const f = emp.tw26;

    if (f.phase === 'idle') {
      const order = nextServiceOrder();
      if (!order) {
        staffMove(emp.visual, REST_SPOT.x, REST_SPOT.z, (emp.speed || 1.7) * 0.70, dt);
        emp.visual.userData.action = 'idle';
        return;
      }
      order.server = emp;
      order.status = 'assigned';
      order.assignedAt = now();
      f.order = order;
      emp.serviceOrder = order;
      setStaffPhase(emp, 'toPickup', MOVE_TIMEOUT);
      return;
    }

    const order = f.order;
    if (!order || !order.customer || !state.customers.includes(order.customer)) { resetSeller(emp, false); return; }

    if (f.phase === 'toPickup') {
      const p = pickupPose();
      emp.visual.userData.action = 'walk';
      if (staffMove(emp.visual, p.x, p.z, emp.speed, dt)) {
        if ((state.stock[order.recipe] || 0) <= 0) {
          order.status = 'queued'; order.server = null; resetSeller(emp, false); return;
        }
        state.stock[order.recipe]--;
        order.status = 'picked';
        attachHeld(emp, order.recipe, false);
        setBubble(emp.visual, recipeText(order.recipe));
        setStaffPhase(emp, 'toCustomer', MOVE_TIMEOUT);
      }
      return;
    }

    if (f.phase === 'toCustomer') {
      const c = order.customer;
      const spot = SERVICE_SPOTS[Math.max(0, Math.min(SERVICE_SPOTS.length - 1, c.tw26?.serviceSpot ?? 0))];
      emp.visual.userData.action = 'carry';
      if (staffMove(emp.visual, spot.x + 0.48, spot.z - 0.18, emp.speed, dt)) {
        f.handoffTimer = 0.38;
        setStaffPhase(emp, 'handoff', 3500);
      }
      return;
    }

    if (f.phase === 'handoff') {
      emp.visual.userData.action = 'serve';
      f.handoffTimer -= dt;
      if (f.handoffTimer <= 0) {
        const c = order.customer;
        clearHeld(emp);
        attachHeld(c, order.recipe, false);
        c.price = RECIPES[order.recipe]?.price || 3;
        order.status = 'delivered';
        c.tw26Order = null;
        c.order = null;
        setClientPhase(c, 'receivedProduct', 2500);
        c.tw26.timer = 0.35;
        setBubble(c.visual, 'OK');
        order.server = null;
        emp.serviceOrder = null;
        f.order = null;
        setStaffPhase(emp, 'idle', Infinity);
        emp.state = 'idle';
        setBubble(emp.visual, null);
      }
    }
  };

  // ---------------------------------------------------------------------
  // CAISSE : file independante, jamais liee a l'etat d'une table.
  // ---------------------------------------------------------------------
  function checkoutFor(c) {
    const open = state.checkouts.filter(co => co.staffId != null);
    if (!open.length) return null;
    return open.slice().sort((a,b) => a.queue.length - b.queue.length)[0];
  }

  function checkoutClientPos(co, index) {
    return { x: co.x - 1.04 - Math.max(0, index) * 0.54, z: co.z };
  }

  updateCashier = function(emp, dt) {
    if (!shopOpen()) return;
    if (!emp.targetCheckout) assignCheckout(emp);
    const co = emp.targetCheckout;
    if (!co) { staffMove(emp.visual, REST_SPOT.x, REST_SPOT.z, emp.speed, dt); return; }
    const ci = state.checkouts.indexOf(co);
    const p = { x: co.x + 0.80, z: co.z };
    emp.tw26 = emp.tw26 || { phase: 'toRegister', enteredAt: now(), deadline: now() + MOVE_TIMEOUT };
    if (emp.tw26.phase !== 'atRegister') {
      if (staffMove(emp.visual, p.x, p.z, emp.speed, dt)) {
        emp.tw26.phase = 'atRegister'; emp.tw26.deadline = Infinity; emp.state = 'atCheckout';
      } else if (phaseExpired(emp)) {
        emp.visual.position.set(p.x, 0, p.z); emp.tw26.phase = 'atRegister'; emp.tw26.deadline = Infinity;
      }
      return;
    }
    emp.visual.position.x = p.x; emp.visual.position.z = p.z; emp.visual.rotation.y = -Math.PI / 2;
    if (!co.queue.length) { co.busy = false; co.progress = 0; emp.visual.userData.action = 'idle'; return; }
    emp.visual.userData.action = 'scan';
    co.busy = true;
    co.progress = (co.progress || 0) + dt * Math.max(0.6, emp.efficiency || 1) * 0.95;
    if (co.progress >= 1) {
      co.progress = 0; co.busy = false;
      const client = co.queue.shift();
      if (client && state.customers.includes(client)) {
        completeSale(client);
        setClientPhase(client, 'afterPayment', 2500);
        client.tw26.timer = 0.25;
      }
    }
    if (co.visual?.screenGlow) co.visual.screenGlow.emissiveIntensity = 0.7 + Math.sin(performance.now()/100)*0.18;
  };

  // Le vigile reste libre de traverser le mobilier, comme les autres employes.
  updateGuard = function(emp, dt) {
    if (!shopOpen()) return;
    const thief = state.customers.find(c => c.isThief && c.state === 'fleeing' && c.spotted);
    if (thief) {
      emp.visual.userData.action = 'walk';
      if (staffMove(emp.visual, thief.visual.position.x, thief.visual.position.z, (emp.speed || 1.4) * 1.15, dt)) {
        thief.state = 'leaving';
      }
    } else {
      staffMove(emp.visual, REST_SPOT.x - 0.8, REST_SPOT.z, (emp.speed || 1.4) * 0.65, dt);
      emp.visual.userData.action = 'idle';
    }
  };

  // ---------------------------------------------------------------------
  // CLIENTS : parcours court et recuperable.
  // ---------------------------------------------------------------------
  function reserveServiceSpot(c) {
    const used = new Set(state.customers.filter(o => o !== c && Number.isInteger(o.tw26?.serviceSpot) && !['leaving','fleeing'].includes(o.state)).map(o => o.tw26.serviceSpot));
    const free = SERVICE_SPOTS.findIndex((_, i) => !used.has(i));
    c.tw26.serviceSpot = free >= 0 ? free : (c.id % SERVICE_SPOTS.length);
    return SERVICE_SPOTS[c.tw26.serviceSpot];
  }

  function visibleChairs() {
    const out = [];
    scene.traverse(o => {
      const id = o?.userData?.twMovableId;
      if (id?.startsWith('chair-') && o.visible !== false && !o.userData.twStored) out.push(o);
    });
    return out;
  }

  function visibleTables() {
    const out = [];
    scene.traverse(o => {
      const id = o?.userData?.twMovableId;
      if (id?.startsWith('table-') && o.visible !== false && !o.userData.twStored) out.push(o);
    });
    return out;
  }

  function nearestTable(chair) {
    let best = null, dist = Infinity;
    for (const t of visibleTables()) {
      const d = Math.hypot(t.position.x - chair.position.x, t.position.z - chair.position.z);
      if (d < 1.65 && d < dist) { best = t; dist = d; }
    }
    return best;
  }

  function reserveSeat(c) {
    for (const chair of visibleChairs()) {
      const id = chair.userData.twMovableId;
      if (sim.seats.has(id)) continue;
      const table = nearestTable(chair);
      if (!table) continue;
      sim.seats.set(id, c.id);
      c.tw26.seat = { id, chair, table };
      return c.tw26.seat;
    }
    return null;
  }

  function releaseSeat(c) {
    const seat = c?.tw26?.seat;
    if (seat?.id && sim.seats.get(seat.id) === c.id) sim.seats.delete(seat.id);
    if (c?.tw26) c.tw26.seat = null;
  }

  function seatApproach(seat) {
    const chair = seat.chair, table = seat.table;
    let dx = chair.position.x - table.position.x;
    let dz = chair.position.z - table.position.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.01) { dx = 0; dz = 1; d = 1; }
    return { x: chair.position.x + dx / d * 0.46, z: chair.position.z + dz / d * 0.46 };
  }

  function detachCustomerFromCheckout(c) {
    for (const co of state.checkouts) {
      const i = co.queue.indexOf(c);
      if (i >= 0) co.queue.splice(i, 1);
    }
    c.checkout = null;
  }

  function removeCustomerSafe(c) {
    const order = c.tw26Order || c.order;
    if (order) clearOrder(order, order.status === 'picked');
    releaseSeat(c);
    detachCustomerFromCheckout(c);
    clearHeld(c);
    removeCustomer(c);
  }

  function initCustomer(c) {
    if (!validRecipe(c.desired)) c.desired = RECIPE_KEYS.find(k => RECIPES[k]?.unlocked) || 'baguette';
    c.tw26 = { phase: 'toCounter', enteredAt: now(), deadline: now() + MOVE_TIMEOUT, retries: 0, serviceSpot: null, seat: null, timer: 0 };
    c.tw26Order = null;
    c.order = null;
    c.checkout = null;
    c.state = 'toCounter';
    cleanupBubble(c.visual);
    showCustomerBubble(c);
  }

  const spawnBefore26 = spawnCustomer;
  spawnCustomer = function() {
    if (!shopOpen() || state.customers.length >= MAX_CUSTOMERS) return;
    const before = state.customers.length;
    spawnBefore26();
    if (state.customers.length > before) initCustomer(state.customers[state.customers.length - 1]);
  };

  const removeBefore26 = removeCustomer;
  removeCustomer = function(c) {
    if (c?.tw26) releaseSeat(c);
    const order = c?.tw26Order || c?.order;
    if (order && order.status !== 'done') clearOrder(order, order.status === 'picked');
    detachCustomerFromCheckout(c);
    clearHeld(c);
    removeBefore26(c);
  };

  updateCustomer = function(c, dt) {
    if (!shopOpen() || !c?.visual) return;
    if (!c.tw26) initCustomer(c);
    cleanupBubble(c.visual);
    const f = c.tw26;

    if (c.state === 'toCounter') {
      const spot = Number.isInteger(f.serviceSpot) ? SERVICE_SPOTS[f.serviceSpot] : reserveServiceSpot(c);
      if (clientMove(c, spot.x, spot.z, 1.46, dt)) {
        setClientPhase(c, 'ordering', 2500); c.tw26.timer = 0.30; showCustomerBubble(c);
      } else if (phaseExpired(c)) {
        c.visual.userData.twV23Nav = {};
        f.serviceSpot = (f.serviceSpot + 1) % SERVICE_SPOTS.length;
        f.deadline = now() + MOVE_TIMEOUT;
        f.retries = (f.retries || 0) + 1;
        if (f.retries >= 3) { c.state = 'leaving'; f.deadline = now() + MOVE_TIMEOUT; }
      }
      return;
    }

    if (c.state === 'ordering') {
      f.timer -= dt;
      if (f.timer <= 0) {
        ensureOrder(c);
        setClientPhase(c, 'waitingService', ORDER_TIMEOUT);
        showCustomerBubble(c);
      }
      return;
    }

    if (c.state === 'waitingService') {
      ensureOrder(c);
      showCustomerBubble(c);
      // Le client attend, mais cet etat ne bloque aucune autre file.
      if (phaseExpired(c)) {
        const order = c.tw26Order;
        if (order && order.status === 'assigned' && now() - order.assignedAt > ORDER_TIMEOUT) {
          if (order.server) resetSeller(order.server, order.status === 'picked');
          order.server = null; order.status = 'queued';
        }
        f.deadline = now() + ORDER_TIMEOUT;
      }
      return;
    }

    if (c.state === 'receivedProduct') {
      f.timer = (f.timer || 0) - dt;
      if (f.timer > 0) return;
      if (c.isThief) { attemptDetection(c); setClientPhase(c, 'fleeing', MOVE_TIMEOUT); return; }
      const co = checkoutFor(c);
      if (!co) { setClientPhase(c, 'leaving', MOVE_TIMEOUT); return; }
      if (!co.queue.includes(c)) co.queue.push(c);
      c.checkout = co;
      setClientPhase(c, 'toCheckout', MOVE_TIMEOUT);
      return;
    }

    if (c.state === 'toCheckout' || c.state === 'waitingPayment') {
      const co = c.checkout;
      if (!co) { setClientPhase(c, 'leaving', MOVE_TIMEOUT); return; }
      const qi = co.queue.indexOf(c);
      if (qi < 0) { setClientPhase(c, 'afterPayment', 2500); f.timer = 0.2; return; }
      const p = checkoutClientPos(co, qi);
      const id = `checkout-${state.checkouts.indexOf(co)}`;
      if (clientMove(c, p.x, p.z, c.state === 'toCheckout' ? 1.44 : 1.20, dt, id)) {
        c.state = 'waitingPayment'; f.deadline = now() + 15000;
      } else if (phaseExpired(c)) {
        c.visual.userData.twV23Nav = {};
        f.deadline = now() + MOVE_TIMEOUT;
      }
      return;
    }

    if (c.state === 'afterPayment') {
      f.timer = (f.timer || 0) - dt;
      if (f.timer > 0) return;
      clearHeld(c);
      if (Math.random() < 0.55) {
        const seat = reserveSeat(c);
        if (seat) { setClientPhase(c, 'toSeat', MOVE_TIMEOUT); return; }
      }
      setClientPhase(c, 'leaving', MOVE_TIMEOUT);
      return;
    }

    if (c.state === 'toSeat') {
      const seat = f.seat;
      if (!seat || seat.chair.visible === false || seat.chair.userData.twStored) {
        releaseSeat(c); setClientPhase(c, 'leaving', MOVE_TIMEOUT); return;
      }
      const p = seatApproach(seat);
      if (clientMove(c, p.x, p.z, 1.20, dt, seat.id)) {
        c.visual.position.x = seat.chair.position.x;
        c.visual.position.z = seat.chair.position.z;
        c.visual.rotation.y = Math.atan2(seat.table.position.x - seat.chair.position.x, seat.table.position.z - seat.chair.position.z);
        setClientPhase(c, 'eating', 11000);
        c.tw26.timer = 4.0 + Math.random() * 2.5;
        c.visual.userData.action = 'eat';
        showCustomerBubble(c);
      } else if (phaseExpired(c)) {
        releaseSeat(c); c.visual.userData.twV23Nav = {}; setClientPhase(c, 'leaving', MOVE_TIMEOUT);
      }
      return;
    }

    if (c.state === 'eating') {
      c.visual.userData.action = 'eat';
      f.timer -= dt;
      if (f.timer <= 0 || phaseExpired(c)) {
        releaseSeat(c); setClientPhase(c, 'leaving', MOVE_TIMEOUT); showCustomerBubble(c);
      }
      return;
    }

    if (c.state === 'fleeing' || c.state === 'leaving') {
      showCustomerBubble(c);
      const speed = c.state === 'fleeing' ? 2.05 : 1.48;
      if (clientMove(c, ENTRANCE.x, ENTRANCE.z, speed, dt)) {
        removeCustomerSafe(c);
      } else if (phaseExpired(c)) {
        c.visual.userData.twV23Nav = {};
        f.retries = (f.retries || 0) + 1;
        f.deadline = now() + MOVE_TIMEOUT;
        // Apres plusieurs echecs, on retire proprement le client de la simulation
        // plutot que de figer la boutique entiere. Il ne traverse jamais le mobilier.
        if (f.retries >= 3) removeCustomerSafe(c);
      }
      return;
    }

    setClientPhase(c, 'toCounter', MOVE_TIMEOUT);
  };

  // Clients deja presents lors du chargement de la couche v2.6.
  for (const c of state.customers) initCustomer(c);

  // ---------------------------------------------------------------------
  // TOUCH / UI : les bulles 3D ne participent plus aux raycasts et les
  // panneaux caches ne capturent plus les gestes.
  // ---------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', ev => {
    if (!shopOpen()) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    let picked = null, best = Infinity;
    for (const c of state.customers) {
      if (!c.visual) continue;
      const hits = ray.intersectObject(c.visual, true);
      if (hits.length && hits[0].distance < best) { best = hits[0].distance; picked = c; }
    }
    if (picked && picked.state === 'waitingService') {
      const order = ensureOrder(picked);
      const seller = state.staff.find(s => s.role === 'seller' && (!s.tw26 || s.tw26.phase === 'idle'));
      if (seller && order.status === 'queued' && (state.stock[order.recipe] || 0) > 0) {
        order.server = seller; order.status = 'assigned'; order.assignedAt = now();
        seller.tw26 = seller.tw26 || {};
        seller.tw26.order = order; seller.serviceOrder = order;
        setStaffPhase(seller, 'toPickup', MOVE_TIMEOUT);
        setBubble(picked.visual, 'OK');
      }
    }
  }, { capture: true, passive: true });

  function cleanUiLayers() {
    for (const id of ['twLayoutPanel','twCustomPanel','twWarehouse']) {
      const el = document.getElementById(id);
      if (!el) continue;
      const visible = el.classList.contains('show') || getComputedStyle(el).display !== 'none';
      el.style.pointerEvents = visible ? 'auto' : 'none';
    }
    const hint = document.getElementById('twEditHint');
    if (hint) hint.style.pointerEvents = 'none';
    for (const c of state.customers) cleanupBubble(c.visual);
    for (const s of state.staff) cleanupBubble(s.visual);
  }

  // Nettoyage periodique totalement independant des machines a etats.
  gameLoopHooks.push(() => {
    const t = now();
    if (t - sim.lastCleanup < 500) return;
    sim.lastCleanup = t;
    pruneOrders();
    cleanUiLayers();
    for (const [id, customerId] of [...sim.seats.entries()]) {
      if (!state.customers.some(c => c.id === customerId)) sim.seats.delete(id);
    }
    // Reservations de fours orphelines : elles ne peuvent plus bloquer la production.
    const live = new Set(state.staff.filter(s => s.role === 'baker').map(s => s.tw26?.oven).filter(Boolean));
    for (const oven of state.ovens) {
      if (oven.state === 'idle' && oven.reserved && !live.has(oven)) oven.reserved = false;
      if (oven.claimedBy != null && !state.staff.some(s => s.id === oven.claimedBy)) oven.claimedBy = null;
    }
  });

  toast('⚙️ Simulation v2.6 active : files et IA séparées');
})();
