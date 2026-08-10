/* TikoWikoBakery 2.2.1 — anti-blocage PNJ sans réautoriser la traversée du mobilier. */
(() => {
  const SERVICE_SPOTS = [
    { x: -1.75, z: 2.75 },
    { x: -0.65, z: 2.75 },
    { x: 0.45, z: 2.75 },
    { x: 1.45, z: 2.75 }
  ];
  const SERVER_PICKUP = { x: 2.28, z: 0.92 };
  const SERVER_EXIT = { x: 2.42, z: 2.82 };

  const movingCustomerStates = new Set([
    'toCounter', 'toCheckout', 'leaving', 'fleeing',
    'toDiningApproach', 'toDining', 'twCafeApproach', 'twCafeSeat'
  ]);
  const movingStaffStates = new Set([
    'toMixer', 'toOven', 'restockToOven', 'restockCounter',
    'servicePickup', 'serviceExit', 'serviceDeliver'
  ]);

  function directStep(obj, target, speed, dt) {
    if (!obj || !target) return false;
    const dx = target.x - obj.position.x;
    const dz = target.z - obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.065) {
      obj.position.x = target.x;
      obj.position.z = target.z;
      return true;
    }
    const step = Math.min(dist, Math.max(0.015, speed * dt));
    obj.position.x += (dx / dist) * step;
    obj.position.z += (dz / dist) * step;
    obj.rotation.y = Math.atan2(dx, dz);
    if (obj.userData?.fullBody) obj.userData.lastMoveAt = performance.now();
    return false;
  }

  function checkoutTarget(c) {
    const co = c?.checkout;
    if (!co) return null;
    const index = Math.max(0, co.queue?.indexOf(c) ?? 0);
    return { x: co.x - 0.82 - index * 0.50, z: co.z };
  }

  function customerTarget(c) {
    if (!c?.visual) return null;
    if (c.state === 'toCounter') {
      const idx = Number.isInteger(c.serviceSpotIndex) ? c.serviceSpotIndex : (c.id % SERVICE_SPOTS.length);
      return SERVICE_SPOTS[Math.max(0, Math.min(SERVICE_SPOTS.length - 1, idx))];
    }
    if (c.state === 'toCheckout') return checkoutTarget(c);
    if (c.state === 'leaving' || c.state === 'fleeing') return ENTRANCE;
    if (c.state === 'toDiningApproach' && c.diningApproach) return c.diningApproach;
    if (c.state === 'toDining' && c.diningSeat) return c.diningSeat;
    if (c.state === 'twCafeApproach' && c.twCafeApproach) return c.twCafeApproach;
    if (c.state === 'twCafeSeat' && c.twCafeSeat) return c.twCafeSeat;
    return null;
  }

  function staffTarget(emp) {
    if (!emp?.visual) return null;
    if (emp.state === 'toMixer') return { x: MIXER_POS.x, z: MIXER_POS.z + 0.5 };
    if ((emp.state === 'toOven' || emp.state === 'restockToOven') && (emp.targetOven || emp.restockOven)) {
      const oven = emp.targetOven || emp.restockOven;
      return { x: oven.x, z: oven.z + 1.10 };
    }
    if (emp.state === 'restockCounter' || emp.state === 'servicePickup') return SERVER_PICKUP;
    if (emp.state === 'serviceExit') return SERVER_EXIT;
    if (emp.state === 'serviceDeliver' && emp.serviceOrder?.customer) {
      const c = emp.serviceOrder.customer;
      const idx = Number.isInteger(c.serviceSpotIndex) ? c.serviceSpotIndex : (c.id % SERVICE_SPOTS.length);
      const spot = SERVICE_SPOTS[Math.max(0, Math.min(SERVICE_SPOTS.length - 1, idx))];
      return { x: spot.x + 0.52, z: spot.z - 0.02 };
    }
    return null;
  }

  function updateStuck(entity, isMoving, target, dt, speed) {
    const obj = entity?.visual;
    if (!obj) return;
    const nav = entity.twV221Nav || (entity.twV221Nav = {
      x: obj.position.x,
      z: obj.position.z,
      still: 0,
      rescue: 0
    });

    const moved = Math.hypot(obj.position.x - nav.x, obj.position.z - nav.z);
    nav.x = obj.position.x;
    nav.z = obj.position.z;

    if (!isMoving || !target) {
      nav.still = 0;
      nav.rescue = Math.max(0, nav.rescue - dt * 2);
      return;
    }

    if (moved < 0.006) nav.still += dt;
    else nav.still = Math.max(0, nav.still - dt * 2.5);

    // Une barrière invisible de l'ancienne disposition peut encore retenir un PNJ.
    // Après 0,65 s sans mouvement, on le fait marcher vers son point logique en
    // ignorant uniquement cette ancienne barrière. Le déplacement reste progressif.
    if (nav.still > 0.65) nav.rescue = 1.15;

    if (nav.rescue > 0) {
      const reached = directStep(obj, target, Math.max(speed || 1.4, 1.75), dt);
      nav.rescue -= dt;
      if (reached) {
        nav.still = 0;
        nav.rescue = 0;
      }
    }
  }

  // Les quatre places de commande sont réellement séparées. Les clients en attente
  // ne doivent plus s'empiler exactement au même endroit si la boulangerie est pleine.
  function separateWaitingCustomers(dt) {
    const groups = new Map();
    for (const c of state.customers) {
      if (c.state !== 'waitingService' || !c.visual) continue;
      const idx = Number.isInteger(c.serviceSpotIndex) ? c.serviceSpotIndex : (c.id % SERVICE_SPOTS.length);
      if (!groups.has(idx)) groups.set(idx, []);
      groups.get(idx).push(c);
    }

    for (const [idx, customers] of groups) {
      const base = SERVICE_SPOTS[Math.max(0, Math.min(SERVICE_SPOTS.length - 1, idx))];
      customers.sort((a, b) => a.id - b.id);
      customers.forEach((c, rank) => {
        // Le premier reste au point de remise. Les suivants attendent derrière lui.
        const target = { x: base.x, z: base.z + rank * 0.48 };
        if (rank > 0 && Math.hypot(c.visual.position.x - target.x, c.visual.position.z - target.z) > 0.12) {
          directStep(c.visual, target, 1.25, dt);
        }
      });
    }
  }

  // Limite douce : inutile d'inonder la salle tant qu'un bouchon est en train de se résorber.
  const previousSpawnCustomerV221 = spawnCustomer;
  spawnCustomer = function() {
    if (state.customers.length >= 8) return;
    return previousSpawnCustomerV221();
  };

  gameLoopHooks.push((time, dtRaw) => {
    const dt = Math.min(0.06, dtRaw || 0.016);

    for (const c of state.customers) {
      const target = customerTarget(c);
      updateStuck(c, movingCustomerStates.has(c.state), target, dt, c.state === 'fleeing' ? 2.15 : 1.55);
    }

    for (const emp of state.staff) {
      const target = staffTarget(emp);
      updateStuck(emp, movingStaffStates.has(emp.state), target, dt, emp.speed || 1.6);
    }

    separateWaitingCustomers(dt);
  });

  // La v2.2 était trop éloignée : elle donnait l'impression que toute la boulangerie
  // était coincée dans le coin supérieur droit de l'écran.
  function applyV221Camera() {
    if (!(innerHeight > innerWidth && Math.min(innerWidth, innerHeight) <= 900)) return;
    camera.position.set(8.7, 10.1, 11.7);
    controls.target.set(0.05, 0.72, 1.05);
    camera.fov = 41.5;
    controls.minDistance = 7.2;
    controls.maxDistance = 18;
    controls.enablePan = false;
    camera.updateProjectionMatrix();
    controls.update();
  }
  applyV221Camera();
  addEventListener('orientationchange', () => setTimeout(applyV221Camera, 220), { passive: true });

  toast('✅ PNJ débloqués : circulation fluide restaurée');
})();
