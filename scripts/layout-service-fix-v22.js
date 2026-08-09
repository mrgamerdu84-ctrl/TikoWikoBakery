/* TikoWikoBakery 2.2 — salle lisible, circulation fiable et service prioritaire au toucher. */
(() => {
  const isMobilePortrait = () => innerHeight > innerWidth && Math.min(innerWidth, innerHeight) <= 900;

  // ---------------------------------------------------------------------------
  // 1) Nettoyage des éléments qui encombrent la vue mobile.
  // ---------------------------------------------------------------------------
  const near = (a, b, eps = 0.08) => Math.abs(a - b) <= eps;
  const removeList = [];

  // Anciennes tables/chaises du coin repas 2.1 : on les remplace par un coin café
  // aligné contre le mur gauche afin de libérer l'allée centrale.
  const oldTables = [
    [-4.85, 3.05], [-2.75, 3.30], [-4.95, 0.45], [-2.75, 0.55]
  ];
  const oldChairs = oldTables.flatMap(([x, z]) => [[x, z + 1.05], [x, z - 1.05]]);

  for (const obj of scene.children) {
    if (!obj) continue;
    const p = obj.position;

    // Retire les groupes des anciennes tables rondes et leurs chaises.
    if (obj.isGroup) {
      const oldTable = oldTables.some(([x, z]) => near(p.x, x, 0.12) && near(p.z, z, 0.12));
      const oldChair = oldChairs.some(([x, z]) => near(p.x, x, 0.12) && near(p.z, z, 0.12));
      if (oldTable || oldChair) removeList.push(obj);

      // Ventilateur du décor premium : ses grandes pales coupaient l'écran en portrait.
      if (near(p.x, 0, 0.15) && near(p.y, 3.97, 0.18) && near(p.z, -0.7, 0.18)) {
        removeList.push(obj);
      }
    }

    // Ancienne table décorative premium à droite, qui empiète sur la caisse.
    if (obj.isMesh && near(p.x, 3.2, 0.12) && near(p.z, 2.75, 0.12)) {
      const gp = obj.geometry?.parameters || {};
      if ((gp.radiusTop && near(gp.radiusTop, 0.72, 0.08)) || (gp.radiusBottom && near(gp.radiusBottom, 0.18, 0.08))) {
        removeList.push(obj);
      }
    }
  }
  [...new Set(removeList)].forEach(obj => obj.parent?.remove(obj));

  // ---------------------------------------------------------------------------
  // 2) Repositionnement des vitrines : produits au fond, grande allée au centre.
  // ---------------------------------------------------------------------------
  const findGroupAt = (x, z, eps = 0.12) => scene.children.find(o => o?.isGroup && near(o.position.x, x, eps) && near(o.position.z, z, eps));
  const casePizza = findGroupAt(-2.25, 1.55);
  const casePastry = findGroupAt(1.45, 1.55);
  const breadIsland = findGroupAt(3.4, -0.15);

  if (casePizza) casePizza.position.set(-1.85, 0, -0.25);
  if (casePastry) casePastry.position.set(1.55, 0, -0.25);
  if (breadIsland) breadIsland.position.set(4.65, 0, -0.35);

  // Petit point de retrait : le serveur vient vraiment chercher le produit ici.
  const pickup = new THREE.Group();
  pickup.userData.twV22Pickup = true;
  const pickupWood = new THREE.MeshStandardMaterial({ color: 0x8a542c, roughness: 0.6 });
  const pickupTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.52), pickupWood);
  pickupTop.position.y = 0.88;
  pickupTop.castShadow = true;
  pickup.add(pickupTop);
  const pickupLeg = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.8, 0.38), new THREE.MeshStandardMaterial({ color: 0x5d351f, roughness: 0.72 }));
  pickupLeg.position.y = 0.42;
  pickup.add(pickupLeg);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.035, 0.34), new THREE.MeshStandardMaterial({ color: 0xb88a58, roughness: 0.55 }));
  tray.position.y = 0.95;
  pickup.add(tray);
  pickup.position.set(2.35, 0, 0.88);
  scene.add(pickup);

  // ---------------------------------------------------------------------------
  // 3) Nouveau coin repas : trois tables sur le côté gauche, allée centrale libre.
  // ---------------------------------------------------------------------------
  const cafeTables = [];
  const tableWood = new THREE.MeshStandardMaterial({ color: 0x9a6035, roughness: 0.62 });
  const chairWood = new THREE.MeshStandardMaterial({ color: 0x714226, roughness: 0.72 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3f281b, roughness: 0.75 });

  function makeChair(x, z, rot) {
    const g = new THREE.Group();
    g.userData.twV22Chair = true;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.46), chairWood);
    seat.position.y = 0.46;
    seat.castShadow = true;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.07), chairWood);
    back.position.set(0, 0.74, -0.19);
    back.castShadow = true;
    g.add(back);
    for (const [lx, lz] of [[-0.17,-0.17],[0.17,-0.17],[-0.17,0.17],[0.17,0.17]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.45, 0.055), darkWood);
      leg.position.set(lx, 0.22, lz);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    scene.add(g);
    return g;
  }

  function makeCafeTable(x, z, id) {
    const g = new THREE.Group();
    g.userData.twV22Table = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.09, 24), tableWood);
    top.position.y = 0.76;
    top.castShadow = true;
    g.add(top);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.10, 0.68, 14), darkWood);
    stem.position.y = 0.38;
    g.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.05, 18), darkWood);
    base.position.y = 0.03;
    g.add(base);
    const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.28), new THREE.MeshStandardMaterial({ color: 0xf3e4cc, roughness: 0.84 }));
    napkin.position.set(0.10, 0.815, 0.02);
    napkin.rotation.y = 0.28;
    g.add(napkin);
    g.position.set(x, 0, z);
    scene.add(g);

    // Chaises à gauche/droite de la table : elles ne mordent plus sur l'allée longitudinale.
    makeChair(x - 0.88, z, Math.PI / 2);
    makeChair(x + 0.88, z, -Math.PI / 2);

    const table = {
      id,
      x, z,
      group: g,
      seats: [
        { x: x - 0.76, z, rot: Math.PI / 2, occupiedBy: null },
        { x: x + 0.76, z, rot: -Math.PI / 2, occupiedBy: null }
      ]
    };
    cafeTables.push(table);
    return table;
  }

  makeCafeTable(-5.05, 4.35, 0);
  makeCafeTable(-5.05, 2.00, 1);
  makeCafeTable(-5.05, -0.55, 2);

  // ---------------------------------------------------------------------------
  // 4) Navigation neuve : pas d'obstacles invisibles des anciennes tables.
  // ---------------------------------------------------------------------------
  const staticObstacles = [
    { name: 'case-pizza', x: -1.85, z: -0.25, hx: 1.38, hz: 0.62 },
    { name: 'case-pastry', x: 1.55, z: -0.25, hx: 1.68, hz: 0.62 },
    { name: 'bread-island', x: 4.65, z: -0.35, hx: 1.00, hz: 0.48 },
    ...cafeTables.map(t => ({ name: `cafe-${t.id}`, x: t.x, z: t.z, hx: 0.66, hz: 0.66 }))
  ];

  const dynamicObstacles = () => [
    ...state.ovens.map((o, i) => ({ name: `four-${i}`, x: o.x, z: o.z, hx: 1.02, hz: 0.86 })),
    ...state.checkouts.map((co, i) => ({ name: `caisse-${i}`, x: co.x, z: co.z, hx: 0.56, hz: 0.70 }))
  ];

  function blocked(x, z, radius = 0.22, ignoreName = null) {
    if (x < -6.52 + radius || x > 6.52 - radius || z < -4.00 + radius || z > 6.35 - radius) return true;
    const all = staticObstacles.concat(dynamicObstacles());
    for (const o of all) {
      if (ignoreName && o.name === ignoreName) continue;
      if (Math.abs(x - o.x) < o.hx + radius && Math.abs(z - o.z) < o.hz + radius) return true;
    }
    return false;
  }

  function v22Move(obj, tx, tz, speed, dt, ignoreName = null) {
    const dx = tx - obj.position.x;
    const dz = tz - obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.075) return true;

    const radius = obj.userData?.fullBody ? 0.22 : 0.17;
    const step = Math.min(dist, Math.max(0.001, speed * dt));
    const ux = dx / dist;
    const uz = dz / dist;
    const candidates = [
      [obj.position.x + ux * step, obj.position.z + uz * step],
      [obj.position.x + ux * step, obj.position.z],
      [obj.position.x, obj.position.z + uz * step]
    ];

    const side = obj.userData.twNavSide ?? (obj.userData.twNavSide = Math.random() < 0.5 ? -1 : 1);
    candidates.push(
      [obj.position.x + (-uz * side) * step * 1.35, obj.position.z + (ux * side) * step * 1.35],
      [obj.position.x + (uz * side) * step * 1.35, obj.position.z + (-ux * side) * step * 1.35]
    );

    let moved = false;
    for (const [nx, nz] of candidates) {
      if (!blocked(nx, nz, radius, ignoreName)) {
        obj.position.x = nx;
        obj.position.z = nz;
        moved = true;
        break;
      }
    }
    if (!moved) obj.userData.twNavSide = -side;

    obj.rotation.y = Math.atan2(dx, dz);
    if (obj.userData?.fullBody && moved) obj.userData.lastMoveAt = performance.now();
    return Math.hypot(tx - obj.position.x, tz - obj.position.z) < 0.09;
  }
  moveTowards = v22Move;

  // ---------------------------------------------------------------------------
  // 5) Coin repas logique correspondant exactement aux nouvelles tables.
  // ---------------------------------------------------------------------------
  function clearHeldPublic(entity) {
    if (!entity?.heldVisual) return;
    entity.heldVisual.parent?.remove(entity.heldVisual);
    entity.heldVisual = null;
  }

  function reserveCafeSeat(c) {
    for (const table of cafeTables) {
      const seat = table.seats.find(s => s.occupiedBy == null);
      if (!seat) continue;
      seat.occupiedBy = c.id;
      c.twCafeTable = table;
      c.twCafeSeat = seat;
      // Point d'approche depuis l'allée centrale, juste à droite de la table.
      c.twCafeApproach = { x: -3.72, z: table.z };
      return true;
    }
    return false;
  }

  function releaseCafeSeat(c) {
    if (c?.twCafeSeat) c.twCafeSeat.occupiedBy = null;
    c.twCafeSeat = null;
    c.twCafeTable = null;
    c.twCafeApproach = null;
  }

  const previousUpdateCustomer = updateCustomer;
  updateCustomer = function(c, dt) {
    // On remplace l'ancien choix de table par le nouveau coin café dégagé.
    if (c.state === 'afterPayment') {
      c.waitT = (c.waitT ?? 0) - dt;
      if (c.waitT <= 0) {
        clearHeldPublic(c);
        if (!c.isThief && Math.random() < 0.68 && reserveCafeSeat(c)) {
          c.state = 'twCafeApproach';
          c.eatT = 5.0 + Math.random() * 3.5;
          setBubble(c.visual, '🍽️');
        } else {
          setBubble(c.visual, null);
          c.state = 'leaving';
        }
      }
      return;
    }

    if (c.state === 'twCafeApproach') {
      if (!c.twCafeApproach || !c.twCafeSeat) { c.state = 'leaving'; return; }
      if (v22Move(c.visual, c.twCafeApproach.x, c.twCafeApproach.z, 1.35, dt)) c.state = 'twCafeSeat';
      return;
    }

    if (c.state === 'twCafeSeat') {
      const seat = c.twCafeSeat;
      const table = c.twCafeTable;
      if (!seat || !table) { c.state = 'leaving'; return; }
      if (v22Move(c.visual, seat.x, seat.z, 1.05, dt, `cafe-${table.id}`)) {
        c.visual.rotation.y = seat.rot;
        c.visual.userData.action = 'eat';
        c.state = 'twCafeEating';
      }
      return;
    }

    if (c.state === 'twCafeEating') {
      c.eatT -= dt;
      c.visual.userData.action = 'eat';
      if (c.eatT <= 0) {
        releaseCafeSeat(c);
        setBubble(c.visual, '😊');
        c.state = 'leaving';
      }
      return;
    }

    previousUpdateCustomer(c, dt);
  };

  // ---------------------------------------------------------------------------
  // 6) Service : toucher un client/bulle donne la priorité à sa commande.
  //    En automatique, une commande trop longtemps en attente est aussi relancée.
  // ---------------------------------------------------------------------------
  function prioritiseCustomer(c, showToast = true) {
    if (!c || c.state !== 'waitingService' || !c.order) return false;
    const seller = state.staff.find(e => e.role === 'seller' && (!e.serviceOrder || e.serviceOrder === c.order));
    if (!seller) {
      if (showToast) toast('🧺 Aucun serveur disponible');
      return false;
    }
    if ((state.stock[c.desired] || 0) <= 0) {
      if (showToast) toast(`⏳ ${RECIPES[c.desired]?.name || 'Produit'} en préparation`);
      return false;
    }
    c.order.server = seller;
    seller.serviceOrder = c.order;
    seller.state = 'servicePickup';
    seller.speed = Math.max(seller.speed || 1.7, 1.95);
    c.twWaitService = 0;
    setBubble(c.visual, `${RECIPES[c.desired].icon} ✓`);
    if (showToast) toast(`🧺 Commande prioritaire : ${RECIPES[c.desired].name}`);
    return true;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = null;
  renderer.domElement.addEventListener('pointerdown', e => {
    pointerDown = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pointerDown || Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 16) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    let best = null;
    let bestDistance = Infinity;
    for (const c of state.customers) {
      if (c.state !== 'waitingService') continue;
      const hits = raycaster.intersectObject(c.visual, true);
      if (hits.length && hits[0].distance < bestDistance) {
        best = c;
        bestDistance = hits[0].distance;
      }
    }
    if (best) prioritiseCustomer(best, true);
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // 7) Finition visuelle du service et watchdog anti-blocage.
  // ---------------------------------------------------------------------------
  gameLoopHooks.push((time, dtRaw) => {
    const dt = Math.min(0.08, dtRaw || 0.016);

    for (const c of state.customers) {
      if (c.state === 'waitingService') {
        c.twWaitService = (c.twWaitService || 0) + dt;
        if (c.twWaitService > 2.8 && !c.order?.server) prioritiseCustomer(c, false);
      } else {
        c.twWaitService = 0;
      }
    }

    for (const emp of state.staff) {
      if (emp.role !== 'seller' || !emp.heldVisual) continue;
      // Produit bien visible à l'écran : légèrement agrandi + petit plateau sous la commande.
      if (!emp.heldVisual.userData.twV22Enhanced) {
        emp.heldVisual.userData.twV22Enhanced = true;
        emp.heldVisual.scale.multiplyScalar(1.22);
        const plate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 0.025, 18),
          new THREE.MeshStandardMaterial({ color: 0xd8b176, roughness: 0.5 })
        );
        plate.position.y = -0.11;
        plate.rotation.x = Math.PI / 2;
        emp.heldVisual.add(plate);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 8) Caméra mobile : plus de sol, moins de mur vide, caisse et tables visibles.
  // ---------------------------------------------------------------------------
  function applyV22Camera() {
    if (!isMobilePortrait()) return;
    camera.position.set(10.8, 12.6, 13.2);
    controls.target.set(0.1, 0.55, 1.15);
    camera.fov = 44;
    camera.updateProjectionMatrix();
    controls.minDistance = 8.5;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.update();
  }
  applyV22Camera();
  addEventListener('orientationchange', () => setTimeout(applyV22Camera, 220), { passive: true });

  toast('✅ Salle réorganisée : allées libres et service client relancé');
})();
