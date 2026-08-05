/* TikoWikoBakery — refonte totale des personnages 3D, caisse latérale et boulanger animé. */
(() => {
  const asset = name => new URL(`./assets/${name}`, import.meta.url).href;
  const iconUrl = asset('icon-only.jpg');
  const splashUrl = asset('splash-web.jpg');

  const logo = document.querySelector('.tw-logo');
  if (logo) logo.src = iconUrl;
  const splash = document.getElementById('twSplash');
  if (splash) splash.style.backgroundImage = `url("${splashUrl}")`;

  const materialCache = new Map();
  const stdMat = (color, roughness = 0.62, metalness = 0) => {
    const key = `${color}|${roughness}|${metalness}`;
    if (!materialCache.has(key)) {
      materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }
    return materialCache.get(key);
  };
  const physicalMat = (color, roughness = 0.45, clearcoat = 0.25) =>
    new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness: 0.35 });

  const toColor = (value, fallback) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value.replace('#', ''), 16);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  };

  const makeMesh = (geometry, material, cast = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = false;
    return mesh;
  };

  function makeBubble(group) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(0.9, 0.45, 1);
    sprite.position.set(0, 2.35, 0);
    sprite.visible = false;
    group.add(sprite);
    group.userData.bubbleCanvas = canvas;
    group.userData.bubbleTex = texture;
    group.userData.bubbleSprite = sprite;
  }

  function makeEye(parent, x, y = 1.71) {
    const white = makeMesh(new THREE.SphereGeometry(0.038, 10, 8), stdMat(0xffffff, 0.35), false);
    white.position.set(x, y, 0.205);
    white.scale.set(0.82, 1.08, 0.58);
    parent.add(white);
    const pupil = makeMesh(new THREE.SphereGeometry(0.019, 8, 6), stdMat(0x2a160c, 0.25), false);
    pupil.position.set(x, y, 0.231);
    parent.add(pupil);
    const shine = makeMesh(new THREE.SphereGeometry(0.006, 6, 5), stdMat(0xffffff, 0.2), false);
    shine.position.set(x - 0.006, y + 0.008, 0.248);
    parent.add(shine);
  }

  function makeHair(parent, style, color) {
    const hairMat = stdMat(color, 0.72);
    const cap = makeMesh(new THREE.SphereGeometry(0.232, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
    cap.position.set(0, 1.79, -0.01);
    parent.add(cap);
    if (style === 'bun') {
      const bun = makeMesh(new THREE.SphereGeometry(0.105, 12, 10), hairMat);
      bun.position.set(0.16, 1.86, -0.15);
      parent.add(bun);
    } else if (style === 'ponytail') {
      const pony = makeMesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), hairMat);
      pony.position.set(0.14, 1.61, -0.17);
      pony.rotation.z = -0.35;
      parent.add(pony);
    } else if (style === 'curly') {
      for (let i = 0; i < 7; i++) {
        const curl = makeMesh(new THREE.SphereGeometry(0.07, 9, 7), hairMat);
        const a = (i / 7) * Math.PI * 2;
        curl.position.set(Math.sin(a) * 0.19, 1.81 + Math.cos(a) * 0.07, -0.05 + Math.cos(a) * 0.08);
        parent.add(curl);
      }
    }
  }

  function makeChefHat(parent) {
    const white = physicalMat(0xfffdf7, 0.38, 0.2);
    const band = makeMesh(new THREE.CylinderGeometry(0.18, 0.19, 0.12, 16), white);
    band.position.y = 1.94;
    parent.add(band);
    for (const [x, z, s] of [[0, 0, 1], [-0.1, 0.01, 0.86], [0.1, 0.01, 0.86], [0, -0.07, 0.85]]) {
      const puff = makeMesh(new THREE.SphereGeometry(0.14 * s, 12, 10), white);
      puff.position.set(x, 2.08, z);
      parent.add(puff);
    }
  }

  function makeCap(parent, color = 0x26374a) {
    const capMat = physicalMat(color, 0.5, 0.18);
    const dome = makeMesh(new THREE.SphereGeometry(0.235, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat);
    dome.position.y = 1.8;
    parent.add(dome);
    const brim = makeMesh(new THREE.BoxGeometry(0.23, 0.025, 0.16), capMat);
    brim.position.set(0, 1.76, 0.17);
    brim.rotation.x = -0.12;
    parent.add(brim);
  }

  function makeFullBodyCharacter(options = {}) {
    const skin = toColor(options.skin, 0xf1b58d);
    const shirt = toColor(options.bodyColor, 0x4f9ed8);
    const accent = options.accent == null ? null : toColor(options.accent, 0xd59a32);
    const pants = toColor(options.pantsColor, 0x30435d);
    const shoes = toColor(options.shoeColor, 0x29231f);
    const hair = toColor(options.hairColor ?? options.hair, 0x4a2b1a);
    const style = options.hairStyle || ['short', 'bun', 'ponytail', 'curly'][Math.floor(Math.random() * 4)];
    const group = new THREE.Group();
    group.userData.fullBody = true;
    group.userData.characterRole = options.role || 'customer';
    group.userData.lastMoveAt = 0;
    group.userData.action = 'idle';
    group.userData.bob = 0;

    const bodyRoot = new THREE.Group();
    group.add(bodyRoot);
    const hips = new THREE.Group();
    hips.position.y = 0.83;
    bodyRoot.add(hips);
    const pelvis = makeMesh(new THREE.BoxGeometry(0.34, 0.18, 0.24), stdMat(pants, 0.68));
    pelvis.position.y = 0.03;
    hips.add(pelvis);

    const buildLeg = side => {
      const hipPivot = new THREE.Group();
      hipPivot.position.set(side * 0.135, -0.03, 0);
      hips.add(hipPivot);
      const thigh = makeMesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), stdMat(pants, 0.68));
      thigh.position.y = -0.19;
      hipPivot.add(thigh);
      const kneePivot = new THREE.Group();
      kneePivot.position.y = -0.38;
      hipPivot.add(kneePivot);
      const calf = makeMesh(new THREE.CapsuleGeometry(0.065, 0.23, 4, 8), stdMat(pants, 0.68));
      calf.position.y = -0.18;
      kneePivot.add(calf);
      const foot = makeMesh(new THREE.BoxGeometry(0.15, 0.10, 0.27), stdMat(shoes, 0.52));
      foot.position.set(0, -0.37, 0.07);
      kneePivot.add(foot);
      return { hipPivot, kneePivot, foot };
    };
    const leftLeg = buildLeg(-1);
    const rightLeg = buildLeg(1);

    const torsoPivot = new THREE.Group();
    torsoPivot.position.y = 0.92;
    bodyRoot.add(torsoPivot);
    const torso = makeMesh(new THREE.CapsuleGeometry(0.205, 0.32, 5, 12), stdMat(shirt, 0.6));
    torso.position.y = 0.31;
    torso.scale.set(1, 1, 0.82);
    torsoPivot.add(torso);

    if (options.skirt) {
      const skirt = makeMesh(new THREE.ConeGeometry(0.28, 0.38, 14, 1, true), stdMat(shirt, 0.62));
      skirt.position.y = -0.03;
      torsoPivot.add(skirt);
    }

    if (accent !== null || options.role === 'baker') {
      const apronColor = accent ?? 0xd2a160;
      const apron = makeMesh(new THREE.BoxGeometry(0.33, 0.47, 0.035), stdMat(apronColor, 0.62));
      apron.position.set(0, 0.24, 0.205);
      torsoPivot.add(apron);
      for (const x of [-0.11, 0.11]) {
        const strap = makeMesh(new THREE.BoxGeometry(0.035, 0.32, 0.025), stdMat(apronColor, 0.65), false);
        strap.position.set(x, 0.52, 0.18);
        strap.rotation.z = x * 0.8;
        torsoPivot.add(strap);
      }
    }

    const buildArm = side => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.31, 0.47, 0);
      torsoPivot.add(shoulder);
      const sleeve = makeMesh(new THREE.CapsuleGeometry(0.065, 0.19, 4, 8), stdMat(shirt, 0.6));
      sleeve.position.y = -0.14;
      shoulder.add(sleeve);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const forearm = makeMesh(new THREE.CapsuleGeometry(0.055, 0.18, 4, 8), stdMat(skin, 0.56));
      forearm.position.y = -0.13;
      elbow.add(forearm);
      const hand = makeMesh(new THREE.SphereGeometry(0.072, 10, 8), stdMat(skin, 0.52));
      hand.position.y = -0.29;
      hand.scale.set(0.9, 1.1, 0.85);
      elbow.add(hand);
      return { shoulder, elbow, hand };
    };
    const leftArm = buildArm(-1);
    const rightArm = buildArm(1);

    const neck = makeMesh(new THREE.CylinderGeometry(0.07, 0.08, 0.11, 10), stdMat(skin, 0.56));
    neck.position.set(0, 1.52, 0);
    bodyRoot.add(neck);
    const head = makeMesh(new THREE.SphereGeometry(0.225, 18, 14), physicalMat(skin, 0.48, 0.12));
    head.position.set(0, 1.70, 0);
    head.scale.set(0.95, 1.07, 0.92);
    bodyRoot.add(head);
    makeEye(bodyRoot, -0.08);
    makeEye(bodyRoot, 0.08);
    const nose = makeMesh(new THREE.SphereGeometry(0.027, 8, 6), stdMat(skin, 0.48), false);
    nose.position.set(0, 1.655, 0.225);
    bodyRoot.add(nose);
    const mouth = makeMesh(new THREE.TorusGeometry(0.052, 0.009, 6, 12, Math.PI), stdMat(0x7a3026, 0.5), false);
    mouth.position.set(0, 1.59, 0.215);
    mouth.rotation.z = Math.PI;
    bodyRoot.add(mouth);
    for (const x of [-0.135, 0.135]) {
      const cheek = makeMesh(new THREE.SphereGeometry(0.032, 8, 6), stdMat(0xef8d87, 0.7), false);
      cheek.position.set(x, 1.62, 0.196);
      cheek.scale.set(1.2, 0.65, 0.45);
      bodyRoot.add(cheek);
    }

    if (options.hood) {
      const hood = makeMesh(new THREE.SphereGeometry(0.25, 14, 10), stdMat(0x2c2d34, 0.7));
      hood.position.set(0, 1.72, -0.04);
      bodyRoot.add(hood);
      head.position.z = 0.03;
    } else if (options.hat || options.role === 'baker') {
      makeHair(bodyRoot, 'short', hair);
      makeChefHat(bodyRoot);
    } else if (options.cap || options.role === 'guard') {
      makeHair(bodyRoot, 'short', hair);
      makeCap(bodyRoot);
    } else {
      makeHair(bodyRoot, style, hair);
    }

    if (options.role === 'baker') {
      const badge = makeMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.014, 14), stdMat(0x7a3e19, 0.5));
      badge.position.set(0, 1.12, 0.235);
      badge.rotation.x = Math.PI / 2;
      bodyRoot.add(badge);
    }

    makeBubble(group);
    group.userData.rig = { bodyRoot, hips, torsoPivot, head, leftLeg, rightLeg, leftArm, rightArm, baseHipY: hips.position.y, baseTorsoY: torsoPivot.position.y };
    return group;
  }

  function resolveRole(options) {
    if (options.hat) return 'baker';
    if (options.cap) return 'guard';
    if (options.hood) return 'thief';
    if (options.accent != null && toColor(options.bodyColor, 0) === 0x4caf6e) return 'seller';
    if (options.accent != null && toColor(options.bodyColor, 0) === 0x5fb3d9) return 'cashier';
    return 'customer';
  }

  function lookForRole(role, original = {}) {
    if (role === 'baker') return { role, bodyColor: 0xfffcf5, accent: 0xc98b45, pantsColor: 0x5b3924, shoeColor: 0x2d211b, hairColor: 0x4a2a18, hat: true };
    if (role === 'seller') return { role, bodyColor: 0x70b883, accent: 0xe6c27a, pantsColor: 0x304c38, shoeColor: 0x2a251f, hairColor: 0x4b2e1f, hairStyle: 'bun' };
    if (role === 'cashier') return { role, bodyColor: 0x5ba7d2, accent: 0xe7c279, pantsColor: 0x263d57, shoeColor: 0x20252c, hairColor: 0x382217, hairStyle: 'short' };
    if (role === 'guard') return { role, bodyColor: 0x33465c, accent: null, pantsColor: 0x202c3a, shoeColor: 0x15191e, hairColor: 0x24170f, cap: true };
    if (role === 'thief') return { role, bodyColor: 0x33343b, accent: null, pantsColor: 0x24252b, shoeColor: 0x16171a, hairColor: 0x1b1512, hood: true };
    const skins = [0xf4c29b, 0xd99b74, 0xb97752, 0x8b5b43, 0xf0b38a];
    const hairs = [0x3a2417, 0x6b3e24, 0x1f1713, 0x9b6a3c, 0x4b2b1b];
    const pants = [0x30435d, 0x273249, 0x4b3b52, 0x2d4b46, 0x5a4034];
    const shirts = [toColor(original.bodyColor, 0xe86f9c), 0x8fd1e0, 0xffc85b, 0xb784d4, 0x79bd8f, 0xe98268];
    return {
      role: 'customer',
      skin: skins[Math.floor(Math.random() * skins.length)],
      bodyColor: shirts[Math.floor(Math.random() * shirts.length)],
      pantsColor: pants[Math.floor(Math.random() * pants.length)],
      shoeColor: [0x27231f, 0xf1eee8, 0x2b3140][Math.floor(Math.random() * 3)],
      hairColor: hairs[Math.floor(Math.random() * hairs.length)],
      hairStyle: ['short', 'bun', 'ponytail', 'curly'][Math.floor(Math.random() * 4)],
      skirt: Math.random() < 0.28
    };
  }

  makeMeeple = function(options = {}) {
    const role = resolveRole(options);
    return makeFullBodyCharacter(lookForRole(role, options));
  };

  function replaceEntityVisual(entity, look) {
    if (!entity || !entity.visual) return;
    const old = entity.visual;
    const pos = old.position.clone();
    const rot = old.rotation.y;
    scene.remove(old);
    const fresh = makeFullBodyCharacter(look);
    fresh.position.copy(pos);
    fresh.rotation.y = rot;
    scene.add(fresh);
    entity.visual = fresh;
  }

  state.staff.forEach(emp => replaceEntityVisual(emp, lookForRole(emp.role)));
  state.customers.forEach(c => replaceEntityVisual(c, lookForRole(c.isThief ? 'thief' : 'customer')));

  MIXER_POS.x = 0.15;
  MIXER_POS.z = -2.35;
  mixer.position.set(MIXER_POS.x + 0.58, 0, MIXER_POS.z - 0.18);

  const workStation = new THREE.Group();
  const tableTop = makeMesh(new THREE.BoxGeometry(1.45, 0.12, 0.72), stdMat(0xb9783e, 0.55));
  tableTop.position.y = 0.88;
  workStation.add(tableTop);
  const tableBody = makeMesh(new THREE.BoxGeometry(1.28, 0.78, 0.58), stdMat(0x75401f, 0.7));
  tableBody.position.y = 0.43;
  workStation.add(tableBody);
  const board = makeMesh(new THREE.BoxGeometry(0.62, 0.035, 0.42), stdMat(0xe6c58e, 0.72));
  board.position.set(-0.22, 0.965, 0.08);
  workStation.add(board);
  const dough = makeMesh(new THREE.SphereGeometry(0.17, 14, 10), stdMat(0xead8aa, 0.82));
  dough.scale.set(1.25, 0.42, 0.95);
  dough.position.set(-0.22, 1.02, 0.08);
  workStation.add(dough);
  const rollingPin = makeMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.58, 12), stdMat(0xc58b50, 0.58));
  rollingPin.rotation.z = Math.PI / 2;
  rollingPin.position.set(-0.12, 1.06, 0.07);
  workStation.add(rollingPin);
  workStation.position.set(MIXER_POS.x, 0, MIXER_POS.z);
  scene.add(workStation);

  function makeRegisterLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff4d7';
    ctx.strokeStyle = '#7b421e';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 80, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a3017';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CAISSE', 128, 49);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.scale.set(0.72, 0.27, 1);
    return sprite;
  }

  function buildPremiumCheckout(x, z) {
    const group = new THREE.Group();
    const body = makeMesh(new THREE.BoxGeometry(0.78, 0.92, 1.22), stdMat(0x73401f, 0.66));
    body.position.y = 0.46;
    group.add(body);
    const top = makeMesh(new THREE.BoxGeometry(0.9, 0.12, 1.32), stdMat(0xc48648, 0.48));
    top.position.y = 0.98;
    group.add(top);
    const screenGlow = new THREE.MeshStandardMaterial({ color: 0x1d2731, emissive: 0x3f86b5, emissiveIntensity: 0.55, roughness: 0.35 });
    const screen = makeMesh(new THREE.BoxGeometry(0.08, 0.42, 0.55), stdMat(0x202a34, 0.42, 0.15));
    screen.position.set(-0.18, 1.28, 0);
    screen.rotation.z = -0.16;
    group.add(screen);
    const face = makeMesh(new THREE.PlaneGeometry(0.46, 0.32), screenGlow, false);
    face.position.set(-0.225, 1.3, 0);
    face.rotation.y = -Math.PI / 2;
    face.rotation.z = -0.16;
    group.add(face);
    const terminal = makeMesh(new THREE.BoxGeometry(0.27, 0.09, 0.38), stdMat(0x303b46, 0.42, 0.1));
    terminal.position.set(-0.18, 1.08, 0.38);
    terminal.rotation.z = -0.08;
    group.add(terminal);
    const drawer = makeMesh(new THREE.BoxGeometry(0.08, 0.25, 0.7), stdMat(0x2f2420, 0.5, 0.18));
    drawer.position.set(-0.41, 0.75, 0);
    group.add(drawer);
    const sign = makeRegisterLabel();
    sign.position.set(0, 1.72, 0);
    group.add(sign);
    group.position.set(x, 0, z);
    group.rotation.y = -Math.PI / 2;
    scene.add(group);
    return { group, screenGlow };
  }

  buildCheckout = buildPremiumCheckout;
  const sidePositions = [{ x: 3.95, z: 1.55 }, { x: 3.95, z: 2.85 }, { x: 2.85, z: 3.72 }];
  sidePositions.forEach((pos, i) => Object.assign(CHECKOUT_SLOT_POS[i], pos));
  state.checkouts.forEach((co, i) => {
    if (co.visual?.group) scene.remove(co.visual.group);
    const pos = sidePositions[i] || sidePositions[0];
    co.x = pos.x;
    co.z = pos.z;
    co.visual = buildPremiumCheckout(co.x, co.z);
  });

  const checkoutClientPose = (co, index) => ({ x: co.x - 0.78 - Math.max(0, index) * 0.48, z: co.z });
  const checkoutStaffPose = co => ({ x: co.x + 0.60, z: co.z });

  const baseMoveTowards = moveTowards;
  moveTowards = function(obj, tx, tz, speed, dt) {
    const ox = obj.position.x;
    const oz = obj.position.z;
    const done = baseMoveTowards(obj, tx, tz, speed, dt);
    if (obj.userData?.fullBody && Math.hypot(obj.position.x - ox, obj.position.z - oz) > 0.0005) obj.userData.lastMoveAt = performance.now();
    return done;
  };

  const baseUpdateBaker = updateBaker;
  updateBaker = function(emp, dt) {
    baseUpdateBaker(emp, dt);
    if (!emp.visual?.userData?.fullBody) return;
    emp.visual.userData.action = emp.state === 'kneading' ? 'knead' : emp.state === 'toOven' ? 'carry' : 'idle';
    if (emp.state === 'kneading') emp.visual.rotation.y = Math.PI;
  };

  updateCashier = function(emp, dt) {
    if (!emp.targetCheckout) {
      assignCheckout(emp);
      if (!emp.targetCheckout) {
        moveTowards(emp.visual, REST_SPOT.x, REST_SPOT.z, emp.speed, dt);
        return;
      }
    }
    const co = emp.targetCheckout;
    const pose = checkoutStaffPose(co);
    if (emp.state !== 'atCheckout') {
      if (moveTowards(emp.visual, pose.x, pose.z, emp.speed, dt)) {
        emp.state = 'atCheckout';
        emp.visual.rotation.y = -Math.PI / 2;
      }
      emp.visual.userData.action = 'walk';
      return;
    }
    emp.visual.position.set(pose.x, 0, pose.z);
    emp.visual.rotation.y = -Math.PI / 2;
    if (co.queue.length === 0) {
      co.busy = false;
      emp.visual.userData.action = 'idle';
      return;
    }
    emp.visual.userData.action = 'scan';
    if (!co.busy) {
      co.busy = true;
      co.progress = 0;
    } else {
      co.progress += dt * emp.efficiency * 0.8;
      co.visual.screenGlow.emissiveIntensity = 0.7 + Math.sin(performance.now() / 90) * 0.25;
      if (co.progress >= 1) {
        co.progress = 0;
        co.busy = false;
        const client = co.queue.shift();
        if (client) completeSale(client);
      }
    }
  };

  const baseUpdateCustomer = updateCustomer;
  updateCustomer = function(c, dt) {
    if (c.state === 'toCheckout' || c.state === 'waiting') {
      const qi = c.checkout ? c.checkout.queue.indexOf(c) : -1;
      if (!c.checkout || qi < 0) {
        c.state = 'leaving';
        return;
      }
      const target = checkoutClientPose(c.checkout, qi);
      const reached = moveTowards(c.visual, target.x, target.z, 1.5, dt);
      if (reached) {
        c.state = 'waiting';
        c.visual.rotation.y = Math.PI / 2;
      }
      return;
    }
    baseUpdateCustomer(c, dt);
  };

  function animateCharacter(character, time) {
    const rig = character.userData.rig;
    if (!rig) return;
    const moving = performance.now() - character.userData.lastMoveAt < 130;
    const action = character.userData.action || 'idle';
    character.userData.animSeed ??= Math.random() * Math.PI * 2;
    const phase = time * 7 + character.userData.animSeed;
    rig.hips.position.y = rig.baseHipY;
    rig.torsoPivot.position.y = rig.baseTorsoY;
    rig.torsoPivot.rotation.set(0, 0, 0);
    rig.leftLeg.hipPivot.rotation.set(0, 0, 0);
    rig.rightLeg.hipPivot.rotation.set(0, 0, 0);
    rig.leftLeg.kneePivot.rotation.set(0, 0, 0);
    rig.rightLeg.kneePivot.rotation.set(0, 0, 0);
    rig.leftArm.shoulder.rotation.set(0, 0, -0.08);
    rig.rightArm.shoulder.rotation.set(0, 0, 0.08);
    rig.leftArm.elbow.rotation.set(0, 0, 0);
    rig.rightArm.elbow.rotation.set(0, 0, 0);
    rig.head.rotation.set(0, 0, 0);

    if (action === 'knead') {
      const press = Math.sin(time * 8);
      rig.torsoPivot.rotation.x = 0.16;
      rig.leftArm.shoulder.rotation.x = -1.05 + press * 0.18;
      rig.rightArm.shoulder.rotation.x = -1.05 - press * 0.18;
      rig.leftArm.elbow.rotation.x = -0.55 - press * 0.15;
      rig.rightArm.elbow.rotation.x = -0.55 + press * 0.15;
      rig.hips.position.y += Math.abs(press) * 0.018;
    } else if (action === 'scan') {
      const scan = Math.sin(time * 9);
      rig.rightArm.shoulder.rotation.x = -0.75 + scan * 0.2;
      rig.rightArm.elbow.rotation.x = -0.55;
      rig.leftArm.shoulder.rotation.x = -0.28;
      rig.head.rotation.y = 0.12 * Math.sin(time * 2);
    } else if (action === 'carry') {
      rig.leftArm.shoulder.rotation.x = -0.85;
      rig.rightArm.shoulder.rotation.x = -0.85;
      rig.leftArm.elbow.rotation.x = -0.65;
      rig.rightArm.elbow.rotation.x = -0.65;
    } else if (moving) {
      const swing = Math.sin(phase) * 0.58;
      rig.leftLeg.hipPivot.rotation.x = swing;
      rig.rightLeg.hipPivot.rotation.x = -swing;
      rig.leftLeg.kneePivot.rotation.x = Math.max(0, -swing) * 0.42;
      rig.rightLeg.kneePivot.rotation.x = Math.max(0, swing) * 0.42;
      rig.leftArm.shoulder.rotation.x = -swing * 0.72;
      rig.rightArm.shoulder.rotation.x = swing * 0.72;
      rig.hips.position.y += Math.abs(Math.sin(phase)) * 0.035;
    } else {
      rig.hips.position.y += Math.sin(time * 2.2 + character.userData.animSeed) * 0.008;
      rig.head.rotation.y = Math.sin(time * 0.9 + character.userData.animSeed) * 0.08;
    }
  }

  const baseGameTick = gameTick;
  gameTick = function(dt) {
    baseGameTick(dt);
    for (const entity of [...state.staff, ...state.customers]) {
      if (entity.visual?.userData?.fullBody) entity.visual.position.y = 0;
    }
  };

  gameLoopHooks.push(time => {
    for (const emp of state.staff) {
      if (emp.visual?.userData?.fullBody) {
        if (emp.role !== 'baker' && emp.role !== 'cashier') emp.visual.userData.action = performance.now() - emp.visual.userData.lastMoveAt < 130 ? 'walk' : 'idle';
        animateCharacter(emp.visual, time);
      }
    }
    for (const customer of state.customers) {
      if (customer.visual?.userData?.fullBody) {
        customer.visual.userData.action = performance.now() - customer.visual.userData.lastMoveAt < 130 ? 'walk' : 'idle';
        animateCharacter(customer.visual, time);
      }
    }
    const working = state.staff.some(emp => emp.role === 'baker' && emp.state === 'kneading');
    if (working) {
      const p = Math.sin(time * 8);
      dough.scale.set(1.25 + p * 0.08, 0.42 - p * 0.025, 0.95);
      rollingPin.position.x = -0.12 + p * 0.17;
      rollingPin.rotation.y = p * 0.16;
    }
  });

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.1));
  toast('👨‍🍳 Personnages 3D complets et caisse latérale installés');
})();
