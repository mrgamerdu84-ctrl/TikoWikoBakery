/* TikoWiko Bakery — vitrines libre-service injectées dans le module principal. */
(() => {
  const extraRecipes = {
    pizza: {
      name: "Pizza artisanale",
      icon: "🍕",
      price: 7,
      prepTime: 3.2,
      bakeTime: 5.8,
      unlocked: true,
      unlockCost: 0
    },
    painChocolat: {
      name: "Pain au chocolat",
      icon: "🍫",
      price: 4,
      prepTime: 2.7,
      bakeTime: 5.0,
      unlocked: true,
      unlockCost: 0
    },
    cookie: {
      name: "Cookie",
      icon: "🍪",
      price: 3,
      prepTime: 2.0,
      bakeTime: 3.8,
      unlocked: true,
      unlockCost: 0
    },
    brioche: {
      name: "Brioche",
      icon: "🧁",
      price: 5,
      prepTime: 3.0,
      bakeTime: 5.5,
      unlocked: true,
      unlockCost: 0
    }
  };

  Object.assign(RECIPES, extraRecipes);
  Object.keys(extraRecipes).forEach(key => {
    if (!RECIPE_KEYS.includes(key)) RECIPE_KEYS.push(key);
    if (typeof state.stock[key] !== "number") state.stock[key] = 0;
  });

  const starterStock = {
    baguette: 8,
    croissant: 8,
    boule: 6,
    pizza: 7,
    painChocolat: 8,
    cookie: 10,
    brioche: 7
  };
  Object.entries(starterStock).forEach(([key, amount]) => {
    state.stock[key] = Math.max(state.stock[key] || 0, amount);
  });

  // L'ancien meuble ouvert est remplacé par deux vitrines plus lisibles et mieux remplies.
  displayCounter.visible = false;

  const displaySlots = {};
  const displaySpots = {
    pizza: { x: -2.25, z: 2.35 },
    baguette: { x: 0.35, z: 2.45 },
    boule: { x: 0.65, z: 2.45 },
    croissant: { x: 1.75, z: 2.40 },
    painChocolat: { x: 1.95, z: 2.40 },
    cookie: { x: 2.15, z: 2.40 },
    brioche: { x: 1.55, z: 2.40 }
  };

  const woodDarkMat = new THREE.MeshStandardMaterial({
    map: makeWoodTexture("#6f431f"),
    roughness: 0.58
  });
  const woodTrimMat = new THREE.MeshStandardMaterial({
    map: makeWoodTexture("#a9703f"),
    roughness: 0.48
  });
  const trayMat = new THREE.MeshStandardMaterial({
    color: 0xb58a5a,
    roughness: 0.65
  });
  const glassDisplayMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf7ff,
    roughness: 0.04,
    transmission: 0.9,
    thickness: 0.12,
    ior: 1.42,
    transparent: true,
    opacity: 0.36,
    clearcoat: 0.75,
    metalness: 0
  });

  function registerSlot(recipe, mesh) {
    if (!displaySlots[recipe]) displaySlots[recipe] = [];
    displaySlots[recipe].push(mesh);
    return mesh;
  }

  function makePizza(seed = 1) {
    const g = new THREE.Group();
    const crust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.045, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xd28b3d, roughness: 0.55, clearcoat: 0.18 })
    );
    crust.castShadow = true;
    g.add(crust);

    const sauce = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.012, 24),
      new THREE.MeshStandardMaterial({ color: 0xd94932, roughness: 0.7 })
    );
    sauce.position.y = 0.029;
    g.add(sauce);

    const cheese = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.175, 0.008, 24),
      new THREE.MeshStandardMaterial({ color: 0xffd779, roughness: 0.72 })
    );
    cheese.position.y = 0.04;
    g.add(cheese);

    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + seed * 0.17;
      const topping = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.009, 10),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x7f3525 : 0xb7332c, roughness: 0.65 })
      );
      topping.position.set(Math.cos(angle) * 0.105, 0.049, Math.sin(angle) * 0.105);
      g.add(topping);
    }
    return g;
  }

  function makeCroissantProduct(seed = 1) {
    const g = new THREE.Group();
    const mat = breadMat();
    for (let i = -2; i <= 2; i++) {
      const part = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat);
      part.scale.set(1.05, 0.72, 0.82);
      part.position.set(i * 0.055, Math.abs(i) * -0.006, Math.abs(i) * 0.018);
      part.castShadow = true;
      g.add(part);
    }
    g.rotation.y = seed * 0.13;
    return g;
  }

  function makePainChocolat(seed = 1) {
    const g = new THREE.Group();
    const pastry = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.09, 0.17, 3, 2, 2),
      breadMat()
    );
    perturbGeometry(pastry.geometry, 0.012, seed + 20);
    pastry.castShadow = true;
    g.add(pastry);
    [-0.07, 0.07].forEach(x => {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.012, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x5b2d1e, roughness: 0.58 })
      );
      stripe.position.set(x, 0.052, 0);
      g.add(stripe);
    });
    return g;
  }

  function makeCookie(seed = 1) {
    const g = new THREE.Group();
    const cookie = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.035, 18),
      new THREE.MeshPhysicalMaterial({ color: 0xc98945, roughness: 0.6, clearcoat: 0.12 })
    );
    cookie.castShadow = true;
    g.add(cookie);
    for (let i = 0; i < 5; i++) {
      const chip = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x4c2619, roughness: 0.55 })
      );
      const a = i * 2.399 + seed;
      chip.position.set(Math.cos(a) * 0.062, 0.026, Math.sin(a) * 0.062);
      g.add(chip);
    }
    return g;
  }

  function makeBrioche(seed = 1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xe4a44f,
      roughness: 0.52,
      clearcoat: 0.24,
      clearcoatRoughness: 0.36
    });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + seed * 0.1;
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat);
      lobe.scale.set(1, 0.75, 1);
      lobe.position.set(Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055);
      lobe.castShadow = true;
      g.add(lobe);
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), mat);
    top.position.y = 0.055;
    top.castShadow = true;
    g.add(top);
    return g;
  }

  function makeBaguetteProduct(seed = 1) {
    const geo = new THREE.CapsuleGeometry(0.055, 0.34, 4, 10);
    perturbGeometry(geo, 0.009, seed + 40);
    const mesh = new THREE.Mesh(geo, breadMat());
    mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    return mesh;
  }

  function makeBouleProduct(seed = 1) {
    const geo = new THREE.SphereGeometry(0.12, 14, 10);
    perturbGeometry(geo, 0.015, seed + 60);
    const mesh = new THREE.Mesh(geo, crustDark());
    mesh.scale.set(1, 0.75, 1);
    mesh.castShadow = true;
    return mesh;
  }

  function makeProduct(recipe, seed) {
    if (recipe === "pizza") return makePizza(seed);
    if (recipe === "croissant") return makeCroissantProduct(seed);
    if (recipe === "painChocolat") return makePainChocolat(seed);
    if (recipe === "cookie") return makeCookie(seed);
    if (recipe === "brioche") return makeBrioche(seed);
    if (recipe === "baguette") return makeBaguetteProduct(seed);
    return makeBouleProduct(seed);
  }

  function addLabel(parent, text, x, y, z, width = 0.72) {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#332116";
    roundedRect(ctx, 4, 4, 312, 88, 16);
    ctx.fill();
    ctx.fillStyle = "#fff4dc";
    ctx.font = "700 32px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 160, 49);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.position.set(x, y, z);
    sprite.scale.set(width, width * 0.3, 1);
    parent.add(sprite);
  }

  function makeSelfServiceCase({ x, z, width, depth, rows }) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.62, depth), woodDarkMat);
    base.position.y = 0.31;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.08, depth + 0.08), woodTrimMat);
    plinth.position.y = 0.64;
    plinth.castShadow = true;
    g.add(plinth);

    const shelfYs = rows.length === 3 ? [0.76, 1.0, 1.24] : [0.82, 1.12];
    rows.forEach((row, rowIndex) => {
      const y = shelfYs[rowIndex];
      const tray = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.035, depth * 0.72), trayMat);
      tray.position.set(0, y, 0);
      tray.receiveShadow = true;
      g.add(tray);

      const columns = row.slots;
      for (let i = 0; i < columns; i++) {
        const product = registerSlot(row.recipe, makeProduct(row.recipe, i + rowIndex * 10));
        const span = width * 0.72;
        const px = columns === 1 ? 0 : -span / 2 + (span * i) / (columns - 1);
        product.position.set(px, y + 0.075, 0);
        product.rotation.y += (i % 2 ? 0.12 : -0.08);
        g.add(product);
      }
      addLabel(g, RECIPES[row.recipe].name, 0, y - 0.08, depth * 0.51, Math.min(0.9, width * 0.34));
    });

    const glassBack = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.78, 0.035), glassDisplayMat);
    glassBack.position.set(0, 1.0, -depth * 0.46);
    g.add(glassBack);

    const glassTop = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, 0.035, depth * 0.94), glassDisplayMat);
    glassTop.position.set(0, 1.42, 0);
    glassTop.rotation.x = -0.05;
    g.add(glassTop);

    [-1, 1].forEach(side => {
      const glassSide = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.78, depth * 0.9), glassDisplayMat);
      glassSide.position.set(side * width * 0.48, 1.0, 0);
      g.add(glassSide);
    });

    // Face avant ouverte : les clients peuvent se servir directement sur les plateaux.
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }

  makeSelfServiceCase({
    x: -2.25,
    z: 1.55,
    width: 2.55,
    depth: 1.05,
    rows: [
      { recipe: "pizza", slots: 4 },
      { recipe: "pizza", slots: 4 },
      { recipe: "baguette", slots: 5 }
    ]
  });

  makeSelfServiceCase({
    x: 1.45,
    z: 1.55,
    width: 3.15,
    depth: 1.05,
    rows: [
      { recipe: "croissant", slots: 6 },
      { recipe: "painChocolat", slots: 6 },
      { recipe: "cookie", slots: 7 }
    ]
  });

  const breadIsland = new THREE.Group();
  const islandTop = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 0.72), woodTrimMat);
  islandTop.position.y = 0.82;
  islandTop.castShadow = true;
  breadIsland.add(islandTop);
  const islandBody = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.76, 0.62), woodDarkMat);
  islandBody.position.y = 0.4;
  islandBody.castShadow = true;
  breadIsland.add(islandBody);
  ["brioche", "boule", "baguette"].forEach((recipe, row) => {
    for (let i = 0; i < 4; i++) {
      const product = registerSlot(recipe, makeProduct(recipe, 100 + row * 10 + i));
      product.position.set(-0.58 + i * 0.38, 0.93 + row * 0.02, -0.18 + row * 0.18);
      breadIsland.add(product);
    }
  });
  addLabel(breadIsland, "Pains & brioches", 0, 0.69, 0.38, 1.0);
  breadIsland.position.set(3.4, 0, -0.15);
  scene.add(breadIsland);

  function refreshDisplayStock() {
    Object.entries(displaySlots).forEach(([recipe, meshes]) => {
      const quantity = Math.max(0, state.stock[recipe] || 0);
      meshes.forEach((mesh, index) => {
        mesh.visible = index < quantity;
      });
    });
  }
  refreshDisplayStock();
  gameLoopHooks.push(refreshDisplayStock);

  const originalSpawnCustomer = spawnCustomer;
  spawnCustomer = function spawnSelfServiceCustomer() {
    const before = state.customers.length;
    originalSpawnCustomer();
    const customer = state.customers[state.customers.length - 1];
    if (!customer || state.customers.length === before) return;
    const spot = displaySpots[customer.desired] || displaySpots.baguette;
    customer.displaySpot = {
      x: spot.x + (Math.random() - 0.5) * 0.35,
      z: spot.z + (Math.random() - 0.5) * 0.22
    };
    customer.state = "toDisplay";
  };

  const originalUpdateCustomer = updateCustomer;
  updateCustomer = function updateSelfServiceCustomer(customer, dt) {
    if (customer.state === "toDisplay") {
      const spot = customer.displaySpot || displaySpots.baguette;
      if (moveTowards(customer.visual, spot.x, spot.z, 1.5, dt)) {
        customer.state = "selfServing";
        customer.waitT = 0.75;
        setBubble(customer.visual, customer.isThief ? "🗝️" : RECIPES[customer.desired].icon);
      }
      return;
    }

    if (customer.state === "selfServing") {
      customer.waitT -= dt;
      if (customer.waitT <= 0) {
        if ((state.stock[customer.desired] || 0) > 0) {
          state.stock[customer.desired]--;
          refreshDisplayStock();
          if (customer.isThief) {
            attemptDetection(customer);
            customer.state = "fleeing";
          } else {
            customer.price = RECIPES[customer.desired].price;
            goToCheckout(customer);
          }
        } else {
          state.missedSales++;
          setBubble(customer.visual, "😞");
          customer.state = "leaving";
        }
      }
      return;
    }

    originalUpdateCustomer(customer, dt);
  };

  toast("🛒 Vitrines libre-service approvisionnées");
  refreshTop();
})();
