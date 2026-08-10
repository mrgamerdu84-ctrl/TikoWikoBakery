/* TikoWikoBakery 2.5.1 — le personnel ne peut plus être bloqué par le mobilier.
   Les clients gardent le pathfinding/collisions et doivent contourner les objets. */
(() => {
  const SERVICE_SPOTS = [
    { x: -1.65, z: 2.72 },
    { x: -0.55, z: 2.72 },
    { x: 0.55, z: 2.72 },
    { x: 1.65, z: 2.72 }
  ];

  function shopOpen() {
    return state.twShopOpen !== false;
  }

  function directStaffMove(obj, tx, tz, speed, dt) {
    if (!obj) return false;
    const dx = tx - obj.position.x;
    const dz = tz - obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.07) {
      obj.position.x = tx;
      obj.position.z = tz;
      obj.userData.twV23Nav = {};
      return true;
    }
    const step = Math.min(dist, Math.max(0.012, (speed || 1.5) * dt));
    obj.position.x += (dx / dist) * step;
    obj.position.z += (dz / dist) * step;
    obj.rotation.y = Math.atan2(dx, dz);
    obj.userData.twV23Nav = {};
    if (obj.userData?.fullBody) obj.userData.lastMoveAt = performance.now();
    return Math.hypot(tx - obj.position.x, tz - obj.position.z) < 0.085;
  }

  function clearHeld(entity) {
    if (!entity?.heldVisual) return;
    entity.heldVisual.parent?.remove(entity.heldVisual);
    entity.heldVisual = null;
  }

  function makeProduct(recipe) {
    const g = new THREE.Group();
    const breadMat = new THREE.MeshStandardMaterial({ color: 0xd99443, roughness: 0.55 });
    let p;
    if (recipe === 'baguette') {
      p = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.48, 5, 10), breadMat);
      p.rotation.z = Math.PI / 2;
    } else if (recipe === 'croissant') {
      p = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.055, 8, 18, Math.PI * 1.45), breadMat);
      p.rotation.x = Math.PI / 2;
    } else {
      p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), breadMat);
      p.scale.set(1.15, 0.72, 1);
    }
    p.castShadow = true;
    g.add(p);
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.025, 18),
      new THREE.MeshStandardMaterial({ color: 0xe0bc82, roughness: 0.5 })
    );
    plate.position.y = -0.12;
    g.add(plate);
    g.scale.setScalar(1.18);
    return g;
  }

  function attachHeld(entity, recipe) {
    clearHeld(entity);
    const hand = entity?.visual?.userData?.rig?.rightArm?.hand;
    if (!hand) return;
    const item = makeProduct(recipe);
    item.position.set(0, -0.05, 0.16);
    hand.add(item);
    entity.heldVisual = item;
  }

  function attachDough(emp) {
    clearHeld(emp);
    const hand = emp?.visual?.userData?.rig?.rightArm?.hand;
    if (!hand) return;
    const d = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0xe8d2a1, roughness: 0.8 })
    );
    d.scale.set(1.25, 0.62, 1);
    d.position.set(0, -0.04, 0.13);
    hand.add(d);
    emp.heldVisual = d;
  }

  function pickupPose() {
    let root = null;
    scene.traverse(o => {
      if (!root && o?.userData?.twMovableId === 'pickup') root = o;
    });
    if (root) return { x: root.position.x, z: root.position.z + 0.72 };
    return { x: 2.55, z: 1.64 };
  }

  function serviceSpot(c) {
    if (!Number.isInteger(c.serviceSpotIndex)) {
      const used = new Set(
        state.customers
          .filter(o => o !== c && Number.isInteger(o.serviceSpotIndex) && !['leaving', 'fleeing'].includes(o.state))
          .map(o => o.serviceSpotIndex)
      );
      const free = SERVICE_SPOTS.findIndex((_, i) => !used.has(i));
      c.serviceSpotIndex = free >= 0 ? free : (c.id % SERVICE_SPOTS.length);
    }
    return SERVICE_SPOTS[Math.max(0, Math.min(SERVICE_SPOTS.length - 1, c.serviceSpotIndex))];
  }

  function releaseOrder(c, emp = null) {
    const order = c?.order || emp?.serviceOrder;
    if (!order) return;
    if (order.server && order.server.serviceOrder === order) order.server.serviceOrder = null;
    order.server = null;
    if (order.customer?.order === order) order.customer.order = null;
    if (emp?.serviceOrder === order) emp.serviceOrder = null;
  }

  // -----------------------------------------------------------------------
  // Boulanger : déplacement direct. Les meubles déplacés ne peuvent plus
  // emprisonner le boulanger entre le pétrin et les fours.
  // -----------------------------------------------------------------------
  updateBaker = function(emp, dt) {
    if (!shopOpen()) return;
    if (!emp.tw251BakerState) emp.tw251BakerState = 'idle';
    const unlocked = RECIPE_KEYS.filter(k => RECIPES[k].unlocked);

    if (emp.tw251BakerState === 'idle') {
      const oven = state.ovens.find(o => o.state === 'idle' && !o.reserved);
      if (!oven || !unlocked.length) {
        emp.visual.userData.action = 'idle';
        return;
      }
      const recipe = unlocked.slice().sort((a, b) => (state.stock[a] || 0) - (state.stock[b] || 0))[0];
      oven.reserved = true;
      emp.tw251Oven = oven;
      emp.tw251Recipe = recipe;
      emp.tw251BakerState = 'toMixer';
    }

    if (emp.tw251BakerState === 'toMixer') {
      emp.visual.userData.action = 'walk';
      if (directStaffMove(emp.visual, MIXER_POS.x, MIXER_POS.z + 0.72, emp.speed, dt)) {
        emp.tw251Timer = RECIPES[emp.tw251Recipe].prepTime / Math.max(0.7, emp.efficiency);
        emp.tw251BakerState = 'knead';
      }
      return;
    }

    if (emp.tw251BakerState === 'knead') {
      emp.visual.userData.action = 'knead';
      emp.tw251Timer -= dt;
      if (emp.tw251Timer <= 0) {
        attachDough(emp);
        emp.tw251BakerState = 'toOven';
      }
      return;
    }

    if (emp.tw251BakerState === 'toOven') {
      const oven = emp.tw251Oven;
      if (!oven) {
        emp.tw251BakerState = 'idle';
        return;
      }
      emp.visual.userData.action = 'carry';
      if (directStaffMove(emp.visual, oven.x, oven.z + 1.02, emp.speed, dt)) {
        clearHeld(emp);
        oven.state = 'baking';
        oven.progress = 0;
        oven.recipe = emp.tw251Recipe;
        oven.reserved = false;
        emp.tw251Oven = null;
        emp.tw251Recipe = null;
        emp.tw251BakerState = 'idle';
        emp.state = 'idle';
      }
    }
  };

  // -----------------------------------------------------------------------
  // Serveur : même logique de service, mais il traverse le mobilier si
  // nécessaire. Ainsi un nouvel agencement ne peut jamais casser le service.
  // -----------------------------------------------------------------------
  function startRestock(emp) {
    if (emp.tw251RestockOven) return true;
    const oven = state.ovens.find(o => o.state === 'ready' && o.claimedBy == null);
    if (!oven) return false;
    oven.claimedBy = emp.id;
    emp.tw251RestockOven = oven;
    emp.tw251SellerState = 'restockOven';
    return true;
  }

  updateSeller = function(emp, dt) {
    if (!shopOpen()) return;

    if (emp.tw251RestockOven) {
      const oven = emp.tw251RestockOven;
      if (emp.tw251SellerState === 'restockOven') {
        emp.visual.userData.action = 'walk';
        if (directStaffMove(emp.visual, oven.x, oven.z + 1.02, emp.speed, dt)) {
          const recipe = oven.recipe;
          emp.tw251RestockBatch = { recipe, qty: 3 + Math.floor(emp.efficiency || 1) };
          oven.state = 'idle';
          oven.progress = 0;
          oven.recipe = null;
          oven.claimedBy = null;
          attachHeld(emp, recipe);
          setBubble(emp.visual, RECIPES[recipe]?.icon || '🥖');
          emp.tw251SellerState = 'restockPickup';
        }
        return;
      }
      if (emp.tw251SellerState === 'restockPickup') {
        const p = pickupPose();
        emp.visual.userData.action = 'carry';
        if (directStaffMove(emp.visual, p.x, p.z, emp.speed, dt)) {
          const b = emp.tw251RestockBatch;
          if (b?.recipe) state.stock[b.recipe] = (state.stock[b.recipe] || 0) + (b.qty || 0);
          clearHeld(emp);
          setBubble(emp.visual, null);
          emp.tw251RestockBatch = null;
          emp.tw251RestockOven = null;
          emp.tw251SellerState = 'idle';
          emp.state = 'idle';
        }
        return;
      }
    }

    let order = emp.serviceOrder;
    if (!order || !order.customer || !state.customers.includes(order.customer)) {
      if (order?.customer) releaseOrder(order.customer, emp);
      clearHeld(emp);
      emp.serviceOrder = null;
      order = null;
    }

    if (!order) {
      const waiting = state.customers.find(c =>
        c.state === 'waitingService' && c.order && !c.order.server && (state.stock[c.desired] || 0) > 0
      );
      if (waiting) {
        order = waiting.order;
        order.server = emp;
        emp.serviceOrder = order;
        emp.tw251SellerState = 'pickup';
      } else {
        const needsStock = state.customers.some(c => c.state === 'waitingService' && (state.stock[c.desired] || 0) <= 0);
        if (needsStock && startRestock(emp)) return;
        directStaffMove(emp.visual, REST_SPOT.x, REST_SPOT.z, (emp.speed || 1.7) * 0.72, dt);
        emp.visual.userData.action = 'idle';
        emp.tw251SellerState = 'idle';
        return;
      }
    }

    const c = order.customer;
    if (!c || !state.customers.includes(c)) {
      clearHeld(emp);
      releaseOrder(c, emp);
      emp.tw251SellerState = 'idle';
      return;
    }

    if (!emp.tw251SellerState || emp.tw251SellerState === 'idle') emp.tw251SellerState = 'pickup';

    if (emp.tw251SellerState === 'pickup') {
      const p = pickupPose();
      emp.visual.userData.action = 'walk';
      if (directStaffMove(emp.visual, p.x, p.z, emp.speed, dt)) {
        if ((state.stock[order.recipe] || 0) <= 0) {
          order.server = null;
          emp.serviceOrder = null;
          emp.tw251SellerState = 'idle';
          return;
        }
        state.stock[order.recipe]--;
        attachHeld(emp, order.recipe);
        setBubble(emp.visual, RECIPES[order.recipe]?.icon || '🥖');
        emp.tw251SellerState = 'deliver';
      }
      return;
    }

    if (emp.tw251SellerState === 'deliver') {
      const s = serviceSpot(c);
      emp.visual.userData.action = 'carry';
      if (directStaffMove(emp.visual, s.x + 0.48, s.z - 0.18, emp.speed, dt)) {
        emp.tw251SellerState = 'handoff';
        order.wait = 0.38;
      }
      return;
    }

    if (emp.tw251SellerState === 'handoff') {
      emp.visual.userData.action = 'serve';
      order.wait = (order.wait ?? 0.38) - dt;
      if (order.wait <= 0) {
        clearHeld(emp);
        attachHeld(c, order.recipe);
        setBubble(emp.visual, null);
        setBubble(c.visual, '✅');
        c.price = RECIPES[order.recipe]?.price || 3;
        c.state = 'receivedProduct';
        c.waitT = 0.40;
        releaseOrder(c, emp);
        emp.tw251SellerState = 'idle';
        emp.state = 'idle';
      }
    }
  };

  // -----------------------------------------------------------------------
  // Caissier et vigile : libres eux aussi. Les clients, eux, continuent
  // d'utiliser la navigation avec collisions de la v2.3.
  // -----------------------------------------------------------------------
  updateCashier = function(emp, dt) {
    if (!shopOpen()) return;
    if (!emp.targetCheckout) {
      assignCheckout(emp);
      if (!emp.targetCheckout) {
        directStaffMove(emp.visual, REST_SPOT.x, REST_SPOT.z, emp.speed, dt);
        return;
      }
    }
    const co = emp.targetCheckout;
    const staffPose = { x: co.x + 0.80, z: co.z };
    if (emp.state !== 'atCheckout') {
      emp.visual.userData.action = 'walk';
      if (directStaffMove(emp.visual, staffPose.x, staffPose.z, emp.speed, dt)) emp.state = 'atCheckout';
      return;
    }
    emp.visual.position.x = staffPose.x;
    emp.visual.position.z = staffPose.z;
    emp.visual.rotation.y = -Math.PI / 2;
    if (!co.queue.length) {
      co.busy = false;
      emp.visual.userData.action = 'idle';
      return;
    }
    emp.visual.userData.action = 'scan';
    if (!co.busy) {
      co.busy = true;
      co.progress = 0;
    } else {
      co.progress += dt * (emp.efficiency || 1) * 0.95;
      if (co.visual?.screenGlow) co.visual.screenGlow.emissiveIntensity = 0.7 + Math.sin(performance.now() / 90) * 0.22;
      if (co.progress >= 1) {
        co.progress = 0;
        co.busy = false;
        const client = co.queue.shift();
        if (client) {
          completeSale(client);
          client.state = 'afterPayment';
          client.waitT = 0.32;
        }
      }
    }
  };

  updateGuard = function(emp, dt) {
    if (!shopOpen()) return;
    const thief = state.customers.find(c => c.isThief && c.state === 'fleeing' && c.spotted);
    if (thief) {
      if (directStaffMove(emp.visual, thief.visual.position.x, thief.visual.position.z, (emp.speed || 1.4) * 1.55, dt) || Math.hypot(emp.visual.position.x - thief.visual.position.x, emp.visual.position.z - thief.visual.position.z) < 0.5) {
        catchThief(thief);
      }
      return;
    }
    directStaffMove(emp.visual, ENTRANCE.x - 0.65, ENTRANCE.z - 0.65, (emp.speed || 1.4) * 0.55, dt);
  };

  // Sécurité : si une ancienne IA a laissé un employé dans un état bloqué,
  // on réinitialise sa navigation une fois au chargement de ce correctif.
  for (const emp of state.staff) {
    if (emp?.visual?.userData) emp.visual.userData.twV23Nav = {};
    if (emp.role === 'seller') {
      emp.serviceOrder = null;
      emp.tw251SellerState = 'idle';
      clearHeld(emp);
      setBubble(emp.visual, null);
    }
    if (emp.role === 'baker') {
      if (emp.tw251Oven?.reserved) emp.tw251Oven.reserved = false;
      emp.tw251BakerState = 'idle';
    }
  }

  toast('✅ Personnel libre : seuls les clients contournent maintenant le mobilier');
})();
