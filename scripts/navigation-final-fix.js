/* TikoWikoBakery — finition navigation caisse : personne ne traverse le meuble de caisse. */
(() => {
  const serviceUpdateCustomer = updateCustomer;
  const checkoutPose = (co, index) => ({ x: co.x - 1.05 - Math.max(0, index) * 0.52, z: co.z });

  updateCustomer = function(c, dt) {
    if (c.state === 'toCheckout' || c.state === 'waitingPayment') {
      if (!c.checkout) {
        c.state = 'leaving';
        return;
      }
      const qi = c.checkout.queue.indexOf(c);
      if (qi < 0) {
        if (c.state === 'waitingPayment') {
          c.state = 'afterPayment';
          c.waitT = 0.55;
        } else {
          c.state = 'leaving';
        }
        return;
      }
      const target = checkoutPose(c.checkout, qi);
      const reached = moveTowards(c.visual, target.x, target.z, c.state === 'toCheckout' ? 1.45 : 1.35, dt);
      if (reached) {
        c.visual.rotation.y = Math.PI / 2;
        c.state = 'waitingPayment';
      }
      return;
    }
    serviceUpdateCustomer(c, dt);
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
    const checkoutIndex = Math.max(0, state.checkouts.indexOf(co));
    const ignoreName = `caisse-${checkoutIndex}`;
    const staffX = co.x + 0.68;
    const staffZ = co.z;

    if (emp.state !== 'atCheckout') {
      if (moveTowards(emp.visual, staffX, staffZ, emp.speed, dt, ignoreName)) {
        emp.state = 'atCheckout';
        emp.visual.rotation.y = -Math.PI / 2;
      }
      emp.visual.userData.action = 'walk';
      return;
    }

    emp.visual.position.x = staffX;
    emp.visual.position.z = staffZ;
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
      if (co.visual?.screenGlow) co.visual.screenGlow.emissiveIntensity = 0.7 + Math.sin(performance.now() / 90) * 0.25;
      if (co.progress >= 1) {
        co.progress = 0;
        co.busy = false;
        const client = co.queue.shift();
        if (client) completeSale(client);
      }
    }
  };
})();
