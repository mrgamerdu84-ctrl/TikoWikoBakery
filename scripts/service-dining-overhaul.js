/* TikoWikoBakery — service visible, collisions mobilier, salle agrandie et coin repas. */
(() => {
  const mat = (color, roughness = 0.62, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mesh = (geometry, material, cast = true) => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };

  // ---------------------------------------------------------------------------
  // 1) Salle plus grande pour créer une vraie zone repas.
  // ---------------------------------------------------------------------------
  floor.geometry.dispose();
  floor.geometry = new THREE.PlaneGeometry(14, 11);
  woodFloor.geometry.dispose();
  woodFloor.geometry = new THREE.PlaneGeometry(14, 2.3);
  woodFloor.position.z = -4.35;

  backWall.geometry.dispose();
  backWall.geometry = new THREE.BoxGeometry(14, 4.4, 0.25);
  backWall.position.z = -5.5;
  sideWall.geometry.dispose();
  sideWall.geometry = new THREE.BoxGeometry(0.25, 4.4, 11);
  sideWall.position.x = -7;

  sign.position.z = -5.37;
  camera.position.set(11.1, 10.2, 13.2);
  controls.target.set(0.2, 1.25, 0.15);
  controls.minDistance = 8.2;
  controls.maxDistance = 23;
  controls.update();

  // Recule légèrement les éléments du fournil pour laisser un couloir de service.
  state.ovens.forEach(o => {
    o.z -= 0.8;
    if (o.visual?.group) o.visual.group.position.z = o.z;
  });
  mixer.position.z -= 0.9;

  // ---------------------------------------------------------------------------
  // 2) Tables/chaises + décor du coin repas.
  // ---------------------------------------------------------------------------
  const diningTables = [];

  function makeChair(x, z, rotation = 0) {
    const g = new THREE.Group();
    const wood = mat(0x7b4928, 0.72);
    const seat = mesh(new THREE.BoxGeometry(0.48, 0.08, 0.48), wood);
    seat.position.y = 0.48;
    g.add(seat);
    const back = mesh(new THREE.BoxGeometry(0.48, 0.55, 0.08), wood);
    back.position.set(0, 0.76, -0.2);
    g.add(back);
    for (const [lx, lz] of [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]]) {
      const leg = mesh(new THREE.BoxGeometry(0.06, 0.48, 0.06), wood);
      leg.position.set(lx, 0.24, lz);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotation;
    scene.add(g);
    return g;
  }

  function makeDiningTable(x, z, index) {
    const g = new THREE.Group();
    const top = mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.09, 24), mat(0xa86d3d, 0.58));
    top.position.y = 0.78;
    g.add(top);
    const leg = mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.72, 12), mat(0x4a2c1a, 0.7));
    leg.position.y = 0.38;
    g.add(leg);
    const base = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 16), mat(0x3f291b, 0.7));
    base.position.y = 0.03;
    g.add(base);

    const napkin = mesh(new THREE.BoxGeometry(0.34, 0.015, 0.34), mat(0xf7e8cf, 0.82), false);
    napkin.position.set(0.12, 0.835, 0.05);
    napkin.rotation.y = 0.35;
    g.add(napkin);

    g.position.set(x, 0, z);
    scene.add(g);

    const chairA = makeChair(x, z + 1.02, Math.PI);
    const chairB = makeChair(x, z - 1.02, 0);
    const table = {
      id: index,
      group: g,
      x, z,
      chairs: [chairA, chairB],
      seats: [
        { x, z: z + 0.88, rot: Math.PI, occupiedBy: null },
        { x, z: z - 0.88, rot: 0, occupiedBy: null }
      ]
    };
    diningTables.push(table);
    return table;
  }

  makeDiningTable(-4.9, 2.8, 0);
  makeDiningTable(-2.9, 3.15, 1);
  makeDiningTable(-5.0, 0.35, 2);
  makeDiningTable(-2.75, 0.45, 3);

  function makeWallPicture(x, y, title, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f6ead4';
    ctx.fillRect(0, 0, 384, 256);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(192, 95, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👨‍🍳', 192, 115);
    ctx.fillStyle = '#5a351f';
    ctx.font = 'bold 29px sans-serif';
    ctx.fillText(title, 192, 205);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const frame = mesh(new THREE.BoxGeometry(1.45, 1.02, 0.08), mat(0x6f431f, 0.62));
    frame.position.set(x, y, -5.34);
    scene.add(frame);
    const picture = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.86), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78 }));
    picture.position.set(x, y, -5.295);
    scene.add(picture);
  }

  makeWallPicture(-4.8, 2.75, 'Chef du jour', '#d68a43');
  makeWallPicture(-2.9, 2.75, 'Pain maison', '#c46c43');

  // ---------------------------------------------------------------------------
  // 3) Collisions / navigation : aucun PNJ ne doit traverser le mobilier.
  // ---------------------------------------------------------------------------
  const obstacleRects = [];
  const addObstacle = (name, x, z, halfX, halfZ, margin = 0.30) => obstacleRects.push({ name, x, z, halfX, halfZ, margin });

  addObstacle('comptoir', -0.6, 1.6, 2.2, 0.475, 0.34);
  addObstacle('vitrine', 3.2, -1.2, 0.75, 0.38, 0.30);
  addObstacle('atelier', MIXER_POS.x, MIXER_POS.z, 0.85, 0.55, 0.34);
  state.ovens.forEach((o, i) => addObstacle(`four-${i}`, o.x, o.z, 1.02, 0.92, 0.38));
  state.checkouts.forEach((co, i) => addObstacle(`caisse-${i}`, co.x, co.z, 0.58, 0.76, 0.30));
  diningTables.forEach((t, i) => addObstacle(`table-${i}`, t.x, t.z, 0.76, 0.76, 0.36));

  function isBlocked(x, z, radius = 0.22, ignoreName = null) {
    if (x < -6.55 + radius || x > 6.55 - radius || z < -5.15 + radius || z > 5.15 - radius) return true;
    for (const o of obstacleRects) {
      if (ignoreName && o.name === ignoreName) continue;
      const hx = o.halfX + o.margin + radius;
      const hz = o.halfZ + o.margin + radius;
      if (Math.abs(x - o.x) < hx && Math.abs(z - o.z) < hz) return true;
    }
    return false;
  }

  function safeMove(obj, tx, tz, speed, dt, ignoreName = null) {
    const dx = tx - obj.position.x;
    const dz = tz - obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.07) return true;

    const step = Math.min(dist, speed * dt);
    const nx = obj.position.x + (dx / dist) * step;
    const nz = obj.position.z + (dz / dist) * step;
    const radius = obj.userData?.fullBody ? 0.23 : 0.18;

    if (!isBlocked(nx, nz, radius, ignoreName)) {
      obj.position.x = nx;
      obj.position.z = nz;
    } else {
      // Deux essais de glissement le long des obstacles, puis un petit détour latéral.
      const tryX = obj.position.x + (dx / dist) * step;
      const tryZ = obj.position.z + (dz / dist) * step;
      if (!isBlocked(tryX, obj.position.z, radius, ignoreName)) {
        obj.position.x = tryX;
      } else if (!isBlocked(obj.position.x, tryZ, radius, ignoreName)) {
        obj.position.z = tryZ;
      } else {
        const side = obj.userData.navSide ?? (obj.userData.navSide = Math.random() < 0.5 ? -1 : 1);
        const sx = obj.position.x + side * (-dz / dist) * step * 1.25;
        const sz = obj.position.z + side * (dx / dist) * step * 1.25;
        if (!isBlocked(sx, sz, radius, ignoreName)) {
          obj.position.x = sx;
          obj.position.z = sz;
        } else {
          obj.userData.navSide *= -1;
        }
      }
    }
    obj.rotation.y = Math.atan2(dx, dz);
    if (obj.userData?.fullBody) obj.userData.lastMoveAt = performance.now();
    return Math.hypot(tx - obj.position.x, tz - obj.position.z) < 0.09;
  }

  moveTowards = safeMove;

  // ---------------------------------------------------------------------------
  // 4) Produits 3D visibles dans la main du serveur puis du client.
  // ---------------------------------------------------------------------------
  function makeProduct3D(recipe) {
    const g = new THREE.Group();
    const bread = mat(0xd99543, 0.54);
    if (recipe === 'baguette') {
      const p = mesh(new THREE.CapsuleGeometry(0.07, 0.48, 5, 10), bread);
      p.rotation.z = Math.PI / 2;
      g.add(p);
    } else if (recipe === 'croissant') {
      const p = mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 18, Math.PI * 1.45), bread);
      p.rotation.x = Math.PI / 2;
      g.add(p);
    } else {
      const p = mesh(new THREE.SphereGeometry(0.16, 14, 10), mat(0xb97836, 0.6));
      p.scale.set(1, 0.76, 1);
      g.add(p);
    }
    g.scale.setScalar(1.18);
    return g;
  }

  function clearHeld(entity) {
    if (!entity?.heldVisual) return;
    entity.heldVisual.parent?.remove(entity.heldVisual);
    entity.heldVisual = null;
  }

  function attachHeld(entity, recipe, kind = 'product') {
    clearHeld(entity);
    const hand = entity?.visual?.userData?.rig?.rightArm?.hand;
    if (!hand) return;
    let item;
    if (kind === 'card') {
      item = mesh(new THREE.BoxGeometry(0.18, 0.015, 0.11), mat(0x3f75c8, 0.38), false);
    } else {
      item = makeProduct3D(recipe);
    }
    item.position.set(0, -0.06, 0.15);
    item.rotation.set(-0.2, 0, 0.1);
    hand.add(item);
    entity.heldVisual = item;
  }

  // ---------------------------------------------------------------------------
  // 5) Service complet : commande -> serveur -> produit en main -> client -> paiement.
  // ---------------------------------------------------------------------------
  const pendingOrders = [];
  const serviceSpots = [
    { x: -1.75, z: 2.62 },
    { x: -0.65, z: 2.62 },
    { x: 0.45, z: 2.62 },
    { x: 1.45, z: 2.62 }
  ];
  const serverPickup = { x: 1.95, z: 0.80 };
  const serverExit = { x: 2.35, z: 2.75 };

  function reserveServiceSpot(customer) {
    const used = new Set(state.customers.filter(c => c !== customer && c.serviceSpotIndex != null && c.state !== 'leaving').map(c => c.serviceSpotIndex));
    const idx = serviceSpots.findIndex((_, i) => !used.has(i));
    customer.serviceSpotIndex = idx >= 0 ? idx : customer.id % serviceSpots.length;
    return serviceSpots[customer.serviceSpotIndex];
  }

  function getFreeServer() {
    return state.staff.find(e => e.role === 'seller' && !e.serviceOrder);
  }

  function createOrder(customer) {
    if (customer.orderCreated) return;
    customer.orderCreated = true;
    const order = { customer, recipe: customer.desired, server: null, state: 'waitingServer', wait: 0 };
    customer.order = order;
    pendingOrders.push(order);
    setBubble(customer.visual, RECIPES[customer.desired].icon);
  }

  function finishOrder(order) {
    const idx = pendingOrders.indexOf(order);
    if (idx >= 0) pendingOrders.splice(idx, 1);
    if (order.server) order.server.serviceOrder = null;
    order.customer.order = null;
  }

  updateSeller = function(emp, dt) {
    let order = emp.serviceOrder;
    if (!order) {
      order = pendingOrders.find(o => !o.server && o.state === 'waitingServer');
      if (order) {
        order.server = emp;
        emp.serviceOrder = order;
        emp.state = 'servicePickup';
      } else {
        safeMove(emp.visual, REST_SPOT.x, REST_SPOT.z, emp.speed * 0.72, dt);
        emp.visual.userData.action = 'idle';
        return;
      }
    }

    if (!order.customer || !state.customers.includes(order.customer)) {
      clearHeld(emp);
      finishOrder(order);
      emp.state = 'idle';
      return;
    }

    if (emp.state === 'servicePickup') {
      emp.visual.userData.action = 'walk';
      if (safeMove(emp.visual, serverPickup.x, serverPickup.z, emp.speed, dt)) {
        if (state.stock[order.recipe] <= 0) {
          setBubble(order.customer.visual, '😞');
          order.customer.state = 'leaving';
          state.missedSales++;
          finishOrder(order);
          emp.state = 'idle';
          return;
        }
        state.stock[order.recipe]--;
        attachHeld(emp, order.recipe);
        setBubble(emp.visual, RECIPES[order.recipe].icon);
        emp.state = 'serviceExit';
      }
      return;
    }

    if (emp.state === 'serviceExit') {
      emp.visual.userData.action = 'carry';
      if (safeMove(emp.visual, serverExit.x, serverExit.z, emp.speed, dt)) emp.state = 'serviceDeliver';
      return;
    }

    if (emp.state === 'serviceDeliver') {
      const c = order.customer;
      const spot = c.serviceSpotIndex != null ? serviceSpots[c.serviceSpotIndex] : reserveServiceSpot(c);
      const tx = spot.x + 0.55;
      const tz = spot.z - 0.10;
      emp.visual.userData.action = 'carry';
      if (safeMove(emp.visual, tx, tz, emp.speed, dt)) {
        emp.visual.rotation.y = Math.atan2(c.visual.position.x - emp.visual.position.x, c.visual.position.z - emp.visual.position.z);
        emp.state = 'serviceHandoff';
        order.wait = 0.48;
      }
      return;
    }

    if (emp.state === 'serviceHandoff') {
      emp.visual.userData.action = 'serve';
      order.wait -= dt;
      if (order.wait <= 0) {
        const c = order.customer;
        clearHeld(emp);
        attachHeld(c, order.recipe);
        setBubble(emp.visual, null);
        setBubble(c.visual, '✅');
        c.price = RECIPES[order.recipe].price;
        c.state = 'receivedProduct';
        c.waitT = 0.45;
        finishOrder(order);
        emp.state = 'idle';
      }
    }
  };

  function chooseCheckout(c) {
    const open = state.checkouts.filter(co => co.staffId != null);
    if (!open.length) return null;
    return open.slice().sort((a, b) => a.queue.length - b.queue.length)[0];
  }

  function findDiningSeat(customer) {
    for (const table of diningTables) {
      const seat = table.seats.find(s => s.occupiedBy == null);
      if (seat) {
        seat.occupiedBy = customer.id;
        customer.diningSeat = seat;
        customer.diningTable = table;
        return seat;
      }
    }
    return null;
  }

  function releaseDiningSeat(customer) {
    if (customer?.diningSeat) customer.diningSeat.occupiedBy = null;
    customer.diningSeat = null;
    customer.diningTable = null;
  }

  const originalRemoveCustomer = removeCustomer;
  removeCustomer = function(c) {
    clearHeld(c);
    releaseDiningSeat(c);
    if (c.order) finishOrder(c.order);
    originalRemoveCustomer(c);
  };

  updateCustomer = function(c, dt) {
    switch (c.state) {
      case 'toCounter': {
        const spot = c.serviceSpotIndex != null ? serviceSpots[c.serviceSpotIndex] : reserveServiceSpot(c);
        if (safeMove(c.visual, spot.x, spot.z, 1.45, dt)) {
          c.visual.rotation.y = Math.PI;
          c.state = 'ordering';
          c.waitT = 0.35;
          setBubble(c.visual, RECIPES[c.desired].icon);
        }
        break;
      }
      case 'ordering':
        c.waitT -= dt;
        if (c.waitT <= 0) {
          createOrder(c);
          c.state = 'waitingService';
        }
        break;
      case 'waitingService':
        c.visual.userData.action = 'idle';
        break;
      case 'receivedProduct':
        c.waitT -= dt;
        if (c.waitT <= 0) {
          const co = chooseCheckout(c);
          if (!co) {
            clearHeld(c);
            c.state = 'leaving';
            break;
          }
          co.queue.push(c);
          c.checkout = co;
          c.state = 'toCheckout';
        }
        break;
      case 'toCheckout': {
        const qi = c.checkout.queue.indexOf(c);
        if (qi < 0) { c.state = 'leaving'; break; }
        const target = checkoutClientPose(c.checkout, qi);
        if (safeMove(c.visual, target.x, target.z, 1.45, dt)) {
          c.visual.rotation.y = Math.PI / 2;
          c.state = 'waitingPayment';
        }
        break;
      }
      case 'waitingPayment': {
        const qi = c.checkout.queue.indexOf(c);
        if (qi < 0) {
          c.state = 'afterPayment';
          c.waitT = 0.45;
          attachHeld(c, null, 'card');
          break;
        }
        const target = checkoutClientPose(c.checkout, qi);
        safeMove(c.visual, target.x, target.z, 1.35, dt);
        break;
      }
      case 'afterPayment':
        c.waitT -= dt;
        if (c.waitT <= 0) {
          clearHeld(c);
          if (!c.isThief && Math.random() < 0.62) {
            const seat = findDiningSeat(c);
            if (seat) {
              c.state = 'toDining';
              c.eatT = 5.5 + Math.random() * 4;
              setBubble(c.visual, '🍽️');
              break;
            }
          }
          setBubble(c.visual, null);
          c.state = 'leaving';
        }
        break;
      case 'toDining': {
        const seat = c.diningSeat;
        if (!seat) { c.state = 'leaving'; break; }
        if (safeMove(c.visual, seat.x, seat.z, 1.3, dt, `table-${c.diningTable.id}`)) {
          c.visual.rotation.y = seat.rot;
          c.state = 'eating';
          c.visual.userData.action = 'eat';
        }
        break;
      }
      case 'eating':
        c.eatT -= dt;
        c.visual.userData.action = 'eat';
        if (c.eatT <= 0) {
          releaseDiningSeat(c);
          setBubble(c.visual, '😊');
          c.state = 'leaving';
        }
        break;
      case 'fleeing':
        setBubble(c.visual, null);
        if (safeMove(c.visual, ENTRANCE.x, ENTRANCE.z, 2.2, dt)) removeCustomer(c);
        break;
      case 'leaving':
        if (safeMove(c.visual, ENTRANCE.x, ENTRANCE.z, 1.45, dt)) removeCustomer(c);
        break;
      default:
        c.state = 'toCounter';
    }
  };

  // Paiement : le client n'est retiré de la file qu'après encaissement visible.
  const baseCompleteSale = completeSale;
  completeSale = function(c) {
    baseCompleteSale(c);
    // baseCompleteSale passe en leaving ; on intercale le paiement visuel puis le repas.
    c.state = 'afterPayment';
    c.waitT = 0.55;
    attachHeld(c, null, 'card');
    setBubble(c.visual, '💳');
  };

  // ---------------------------------------------------------------------------
  // 6) Animations supplémentaires : serveur donne, client mange et paie.
  // ---------------------------------------------------------------------------
  gameLoopHooks.push(time => {
    for (const emp of state.staff) {
      const rig = emp.visual?.userData?.rig;
      if (!rig) continue;
      if (emp.visual.userData.action === 'serve') {
        const p = 0.5 + 0.5 * Math.sin(time * 5.5);
        rig.rightArm.shoulder.rotation.x = -0.85 - p * 0.5;
        rig.rightArm.elbow.rotation.x = -0.55;
        rig.leftArm.shoulder.rotation.x = -0.35;
      }
    }
    for (const c of state.customers) {
      const rig = c.visual?.userData?.rig;
      if (!rig) continue;
      if (c.visual.userData.action === 'eat') {
        const p = 0.5 + 0.5 * Math.sin(time * 4.5 + c.id);
        rig.hips.position.y = rig.baseHipY - 0.28;
        rig.torsoPivot.position.y = rig.baseTorsoY - 0.24;
        rig.rightArm.shoulder.rotation.x = -0.5 - p * 0.35;
        rig.rightArm.elbow.rotation.x = -0.7;
      }
    }
  });

  toast('🍞 Service à table, collisions et coin repas activés');
})();
