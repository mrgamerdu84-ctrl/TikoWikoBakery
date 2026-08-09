/* TikoWikoBakery 2.1.1 — correctif visuel mobile : retire les poutres qui traversent l'écran. */
(() => {
  // Les trois longues poutres de l'ancien décor premium sont placées au-dessus
  // de la pièce mais, avec la caméra portrait, elles passent au premier plan.
  // On ne retire QUE ces meshes précis pour ne pas toucher au reste du décor.
  const toRemove = [];
  scene.traverse(obj => {
    if (!obj?.isMesh || !obj.geometry) return;
    const p = obj.geometry.parameters;
    if (!p) return;
    const isOldRafter =
      Math.abs((p.width ?? 0) - 0.18) < 0.01 &&
      Math.abs((p.height ?? 0) - 0.22) < 0.01 &&
      Math.abs((p.depth ?? 0) - 8.2) < 0.05 &&
      obj.position.y > 4.0;
    if (isOldRafter) toRemove.push(obj);
  });
  toRemove.forEach(obj => obj.parent?.remove(obj));

  // Cadre plus propre sur téléphone portrait : la salle reste bien visible
  // sans gros vide en haut et sans mobilier coupé en bas.
  const applyPortraitFraming = () => {
    if (innerHeight <= innerWidth || Math.min(innerWidth, innerHeight) > 900) return;
    camera.position.set(10.4, 9.25, 14.6);
    controls.target.set(0.15, 1.15, 0.65);
    camera.fov = 43;
    camera.updateProjectionMatrix();
    controls.update();
  };
  applyPortraitFraming();
  addEventListener('orientationchange', () => setTimeout(applyPortraitFraming, 220), { passive: true });

  // Sécurité supplémentaire : aucun personnage ne doit se retrouver à une
  // hauteur anormale à cause d'une ancienne animation de "bob".
  gameLoopHooks.push(() => {
    for (const entity of [...state.staff, ...state.customers]) {
      if (!entity?.visual) continue;
      if (Math.abs(entity.visual.position.y) > 0.02) entity.visual.position.y = 0;
    }
  });

  toast('✅ Vue mobile corrigée');
})();
