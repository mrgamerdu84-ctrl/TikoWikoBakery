/* TikoWikoBakery 2.5.2 — watchdog anti-freeze des états IA et des commandes.
   Objectif : le temps peut continuer, mais aucune IA ne doit rester figée indéfiniment. */
(() => {
  const STATE_TIMEOUT_MS = 8000;
  const CLIENT_WAIT_TIMEOUT_MS = 5000;
  const trackers = new WeakMap();
  const clientTrackers = new WeakMap();

  function nowMs() { return performance.now(); }
  function shopOpen() { return state.twShopOpen !== false; }

  function recipeLabel(key) {
    const r = RECIPES[key];
    if (!r) return 'CMD';
    const name = String(r.name || key || 'CMD').trim();
    return name.length > 7 ? name.slice(0, 7) : name;
  }

  function clearHeld(entity) {
    if (!entity?.heldVisual) return;
    entity.heldVisual.parent?.remove(entity.heldVisual);
    entity.heldVisual = null;
  }

  function releaseBakerReservation(emp) {
    const oven = emp?.tw251Oven || emp?.v24Oven || emp?.targetOven;
    if (oven) {
      oven.reserved = false;
      if (oven.claimedBy === emp.id) oven.claimedBy = null;
    }
    emp.tw251Oven = null;
    emp.tw251Recipe = null;
    emp.tw251Timer = 0;
    emp.tw251BakerState = 'idle';
    emp.v24Oven = null;
    emp.v24Recipe = null;
    emp.v24Timer = 0;
    emp.v24State = 'idle';
    emp.state = 'idle';
    clearHeld(emp);
    setBubble(emp.visual, null);
    if (emp.visual?.userData) emp.visual.userData.action = 'idle';
  }

  function resetSeller(emp) {
    const order = emp?.serviceOrder;
    if (order) {
      if (order.server === emp) order.server = null;
      if (order.customer?.order !== order) order.customer = null;
    }
    const restock = emp?.tw251RestockOven || emp?.v23RestockOven || emp?.restockOven;
    if (restock && restock.claimedBy === emp.id) restock.claimedBy = null;
    emp.serviceOrder = null;
    emp.tw251SellerState = 'idle';
    emp.tw251RestockOven = null;
    emp.tw251RestockBatch = null;
    emp.v23RestockOven = null;
    emp.v23RestockBatch = null;
    emp.restockOven = null;
    emp.restockBatch = null;
    emp.state = 'idle';
    clearHeld(emp);
    setBubble(emp.visual, null);
    if (emp.visual?.userData) emp.visual.userData.action = 'idle';
  }

  function resetCashier(emp) {
    const co = emp?.targetCheckout;
    if (co) {
      co.busy = false;
      co.progress = 0;
    }
    emp.state = 'idle';
    if (emp.visual?.userData) emp.visual.userData.action = 'idle';
  }

  function staffStateKey(emp) {
    if (emp.role === 'baker') return `b:${emp.tw251BakerState || emp.v24State || emp.state || 'idle'}`;
    if (emp.role === 'seller') return `s:${emp.tw251SellerState || emp.state || 'idle'}:${emp.serviceOrder?.customer?.id || 0}`;
    if (emp.role === 'cashier') return `c:${emp.state || 'idle'}:${emp.targetCheckout?.queue?.length || 0}`;
    return `${emp.role}:${emp.state || 'idle'}`;
  }

  function staffProgressValue(emp) {
    if (emp.role === 'baker') {
      if (Number.isFinite(emp.tw251Timer)) return emp.tw251Timer;
      if (Number.isFinite(emp.v24Timer)) return emp.v24Timer;
    }
    if (emp.role === 'seller') {
      const o = emp.serviceOrder;
      if (Number.isFinite(o?.wait)) return o.wait;
    }
    if (emp.role === 'cashier' && Number.isFinite(emp.targetCheckout?.progress)) return emp.targetCheckout.progress;
    return null;
  }

  function observeStaff(emp) {
    if (!emp?.visual || !shopOpen()) return;
    const t = nowMs();
    const key = staffStateKey(emp);
    const pos = emp.visual.position;
    const progress = staffProgressValue(emp);
    let tr = trackers.get(emp);
    if (!tr) {
      tr = { key, at: t, x: pos.x, z: pos.z, progress, lastMeaningful: t };
      trackers.set(emp, tr);
      return;
    }

    const moved = Math.hypot(pos.x - tr.x, pos.z - tr.z);
    const progressChanged = progress != null && tr.progress != null && Math.abs(progress - tr.progress) > 0.015;
    if (key !== tr.key || moved > 0.025 || progressChanged) {
      tr.key = key;
      tr.at = t;
      tr.lastMeaningful = t;
    }
    tr.x = pos.x;
    tr.z = pos.z;
    tr.progress = progress;

    // Timers invalides = état qui ne peut jamais se terminer.
    if (emp.role === 'baker') {
      const bs = emp.tw251BakerState || emp.v24State;
      if (bs === 'knead' && !Number.isFinite(emp.tw251Timer) && !Number.isFinite(emp.v24Timer)) {
        releaseBakerReservation(emp);
        tr.at = t;
        return;
      }
    }

    if (t - tr.lastMeaningful < STATE_TIMEOUT_MS) return;

    if (emp.role === 'baker') {
      releaseBakerReservation(emp);
      toast('👨‍🍳 Boulanger relancé automatiquement');
    } else if (emp.role === 'seller') {
      resetSeller(emp);
      toast('🧺 Serveur relancé automatiquement');
    } else if (emp.role === 'cashier') {
      resetCashier(emp);
    } else {
      emp.state = 'idle';
      if (emp.visual?.userData) emp.visual.userData.action = 'idle';
    }
    tr.at = t;
    tr.lastMeaningful = t;
    tr.key = staffStateKey(emp);
  }

  function ensureCustomerOrder(c) {
    if (!c || c.state !== 'waitingService') return null;
    if (!RECIPES[c.desired]) c.desired = RECIPE_KEYS.find(k => RECIPES[k]?.unlocked) || 'baguette';
    if (!c.order || c.order.customer !== c) {
      c.order = { customer: c, recipe: c.desired, server: null, state: 'waitingServer', wait: 0 };
      c.orderCreated = true;
    }
    c.order.recipe = c.desired;
    return c.order;
  }

  function availableSellerFor(order) {
    return state.staff.find(s => s.role === 'seller' && (!s.serviceOrder || s.serviceOrder === order)) || null;
  }

  function assignSeller(c) {
    const order = ensureCustomerOrder(c);
    if (!order || (state.stock[order.recipe] || 0) <= 0) return false;
    const seller = availableSellerFor(order);
    if (!seller) return false;
    if (order.server && order.server !== seller && order.server.serviceOrder === order) order.server.serviceOrder = null;
    order.server = seller;
    seller.serviceOrder = order;
    seller.tw251SellerState = 'pickup';
    seller.state = 'idle';
    return true;
  }

  function repairProductionIfStarved(c) {
    if ((state.stock[c.desired] || 0) > 0) return;
    const hasSupply = state.ovens.some(o => o.recipe === c.desired && ['baking', 'ready'].includes(o.state));
    if (hasSupply) return;

    // Une réservation orpheline peut bloquer toute la production.
    const bakers = state.staff.filter(s => s.role === 'baker');
    const liveOvens = new Set(bakers.map(b => b.tw251Oven || b.v24Oven).filter(Boolean));
    state.ovens.forEach(o => {
      if (o.reserved && !liveOvens.has(o) && o.state === 'idle') o.reserved = false;
      if (o.claimedBy != null && !state.staff.some(s => s.id === o.claimedBy)) o.claimedBy = null;
    });

    const baker = bakers[0];
    if (baker && !['idle', undefined, null].includes(baker.tw251BakerState) && !baker.tw251Oven) {
      releaseBakerReservation(baker);
    }
  }

  function observeCustomer(c) {
    if (!c?.visual || !shopOpen()) return;
    const t = nowMs();
    let tr = clientTrackers.get(c);
    if (!tr) {
      tr = { state: c.state, at: t, x: c.visual.position.x, z: c.visual.position.z, lastBubble: 0 };
      clientTrackers.set(c, tr);
    }

    const moved = Math.hypot(c.visual.position.x - tr.x, c.visual.position.z - tr.z);
    if (c.state !== tr.state || moved > 0.03) {
      tr.state = c.state;
      tr.at = t;
    }
    tr.x = c.visual.position.x;
    tr.z = c.visual.position.z;

    if (c.state === 'waitingService') {
      const order = ensureCustomerOrder(c);

      // Les bulles vides sont remplacées régulièrement par un libellé texte court,
      // lisible même si la police emoji Android ne rend pas certains pictogrammes.
      if (t - tr.lastBubble > 1200) {
        setBubble(c.visual, recipeLabel(c.desired));
        tr.lastBubble = t;
      }

      if (order?.server && (!state.staff.includes(order.server) || order.server.role !== 'seller' || order.server.serviceOrder !== order)) {
        order.server = null;
      }

      if (t - tr.at > CLIENT_WAIT_TIMEOUT_MS) {
        if (!assignSeller(c)) repairProductionIfStarved(c);
        tr.at = t - 2500; // retente rapidement sans spammer à chaque frame
      }
      return;
    }

    // Un client qui marche mais n'avance plus : on force uniquement un recalcul
    // du chemin. Il ne traverse jamais le mobilier.
    if (['toCounter', 'toCheckout', 'v23Dining', 'leaving', 'fleeing'].includes(c.state) && t - tr.at > 6500) {
      c.visual.userData.twV23Nav = {};
      tr.at = t;
    }
  }

  // Toucher un client en attente donne immédiatement sa commande à un serveur disponible.
  // Le listener est sur le canvas 3D uniquement : aucun panneau UI invisible ne peut l'intercepter.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (ev) => {
    if (!shopOpen()) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    let picked = null;
    let best = Infinity;
    for (const c of state.customers) {
      if (c.state !== 'waitingService' || !c.visual) continue;
      const hits = raycaster.intersectObject(c.visual, true);
      if (hits.length && hits[0].distance < best) { picked = c; best = hits[0].distance; }
    }
    if (picked) {
      ensureCustomerOrder(picked);
      if (assignSeller(picked)) {
        setBubble(picked.visual, 'OK');
        toast('✅ Commande donnée au serveur');
      }
    }
  }, { capture: true, passive: true });

  // Exécuté dans la boucle principale sans dépendre du second argument des hooks.
  // La version d'origine appelle gameLoopHooks(fn) avec seulement le temps absolu.
  let lastSweep = 0;
  gameLoopHooks.push(() => {
    const t = nowMs();
    if (t - lastSweep < 180) return;
    lastSweep = t;
    for (const emp of state.staff) observeStaff(emp);
    for (const c of state.customers) observeCustomer(c);
  });

  toast('🛠️ Anti-freeze IA activé');
})();
