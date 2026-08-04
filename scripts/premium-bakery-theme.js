/* TikoWikoBakery — refonte visuelle premium. */
(() => {
  const asset = name => new URL(`./assets/${name}`, import.meta.url).href;
  const iconUrl = asset('icon-only.svg');
  const splashUrl = asset('splash.svg');

  const css = document.createElement('style');
  css.textContent = `
    :root{--tw-gold:#ffc857;--tw-cream:#fff5dc;--tw-wood:#4b2817;}
    html,body{background:#211006!important}canvas{filter:saturate(1.08) contrast(1.03)}
    #topbar{top:max(8px,env(safe-area-inset-top))!important;left:10px!important;right:10px!important;padding:8px 10px!important;border:1px solid #ffffff2e!important;border-bottom:3px solid #f5b83f!important;border-radius:20px!important;background:linear-gradient(135deg,#5a3018f2,#2d180df0)!important;box-shadow:0 10px 28px #190a027a!important;backdrop-filter:blur(12px)}
    .logo-badge{padding:4px 12px 4px 5px!important;border-radius:15px!important;background:linear-gradient(150deg,#fffaf0,#ffe0a0)!important;box-shadow:inset 0 0 0 2px #ffc64ae6,0 4px 12px #0004!important}.logo-badge .emoji{display:none!important}.tw-logo{width:35px;height:35px;border-radius:11px;object-fit:cover;box-shadow:0 3px 8px #50230847}
    .stat-pill,#xpwrap,#soundBtn{border:1px solid #fff9!important;background:linear-gradient(160deg,#fffaf0,#ffe4aa)!important;box-shadow:inset 0 -3px 0 #7d431f1f,0 4px 10px #0004!important}#clockpill{background:linear-gradient(160deg,#6e3d21,#3f2213)!important}
    #goalbar{top:78px!important;border:1px solid #ffd1716b!important;border-radius:16px!important;background:linear-gradient(145deg,#542c15f2,#2d180df2)!important;box-shadow:0 9px 22px #0006!important}
    #quickbar{left:10px!important;right:10px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;padding:8px!important;border:1px solid #ffffff26!important;border-top:3px solid #ffc857d6!important;border-radius:22px!important;background:linear-gradient(145deg,#4b2814f2,#28150bf2)!important;box-shadow:0 -8px 24px #14080261!important;backdrop-filter:blur(12px)}
    .qbtn{min-width:64px!important;padding:7px 12px!important;border:1px solid #fffb!important;border-radius:15px!important;background:linear-gradient(160deg,#fffaf0,#ffdd92)!important;box-shadow:0 4px 0 #bd7130,0 7px 12px #0004!important}.qbtn.active{background:linear-gradient(160deg,#ffe179,#ffb928)!important}.qbtn .qicon{font-size:24px!important}
    #sidepanel{border-left:2px solid #ffc4578c!important;background:linear-gradient(180deg,#5c3420,#2e190f)!important}.panel-header{background:linear-gradient(160deg,#7a4729,#4a2818)!important}.tabs,.panel-body{background:#321b11!important}.tab{background:#4a2a1a!important}.tab.active{background:#704128!important;color:#ffd36b!important}.shop-item{background:linear-gradient(155deg,#68402a,#422416)!important}
    #twSplash{position:fixed;inset:0;z-index:1000;background:#2b160b center/cover no-repeat;transition:opacity .55s,visibility .55s}#twSplash.hide{opacity:0;visibility:hidden;pointer-events:none}#twSplash:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 68%,#1d0b035e 100%);pointer-events:none}
    #twPlay{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);width:min(58vw,360px);height:min(17vw,110px);border:0;border-radius:999px;background:transparent;cursor:pointer;z-index:2;opacity:0;pointer-events:none}#twPlay.ready{opacity:1;pointer-events:auto;animation:pulse 1.3s infinite;box-shadow:0 0 32px #77ef5c99}@keyframes pulse{50%{transform:translateX(-50%) scale(1.035)}}
    #twLoad{position:absolute;left:50%;bottom:2.6%;transform:translateX(-50%);width:min(72vw,380px);z-index:3;color:#fff5d7;text-align:center;font:800 12px sans-serif;text-shadow:0 2px 5px #301508}#twBar{height:8px;margin-bottom:5px;border:1px solid #fff6;border-radius:99px;background:#36180780;overflow:hidden}#twBar i{display:block;width:8%;height:100%;border-radius:99px;background:linear-gradient(90deg,#ffe17b,#68d95f);transition:width .2s}
    @media(max-width:640px){#topbar{gap:6px!important;padding:6px!important}.tw-logo{width:31px;height:31px}.stat-pill{padding:5px 8px!important;font-size:11px!important}#goalbar{top:112px!important;font-size:10px!important}.qbtn{min-width:55px!important;padding:6px 8px!important;font-size:10px!important}#hint{display:none!important}}
  `;
  document.head.appendChild(css);

  const badge = document.querySelector('.logo-badge');
  if (badge) {
    const img = document.createElement('img');
    img.className = 'tw-logo'; img.src = iconUrl; img.alt = '';
    badge.prepend(img);
  }

  const splash = document.createElement('div');
  splash.id = 'twSplash'; splash.style.backgroundImage = `url("${splashUrl}")`;
  splash.innerHTML = '<button id="twPlay" aria-label="Jouer"></button><div id="twLoad"><div id="twBar"><i></i></div><span>Préparation de la boulangerie…</span></div>';
  document.body.appendChild(splash);
  const play = splash.querySelector('#twPlay');
  const fill = splash.querySelector('#twBar i');
  const label = splash.querySelector('#twLoad span');
  let pct = 8;
  const timer = setInterval(() => {
    const loading = document.getElementById('loading');
    const ready = !loading || Number(getComputedStyle(loading).opacity) < .2 || loading.style.display === 'none';
    pct = Math.min(ready ? 100 : 92, pct + 8 + Math.random() * 10);
    fill.style.width = `${pct}%`;
    if (pct > 45) label.textContent = 'Cuisson des viennoiseries…';
    if (pct > 75) label.textContent = 'Mise en place des vitrines…';
    if (pct >= 100) { clearInterval(timer); label.textContent = 'La boulangerie est ouverte !'; play.classList.add('ready'); }
  }, 170);
  const close = () => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 650); };
  play.addEventListener('click', close);
  splash.addEventListener('click', e => { if (pct >= 100 && e.target === splash) close(); });

  const mobile = matchMedia('(max-width:900px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.3 : 1.7));
  renderer.toneMappingExposure = 1.16;
  scene.background = new THREE.Color(0x2a170d);
  if (scene.fog) { scene.fog.color.set(0x2a170d); scene.fog.near = 17; scene.fog.far = 34; }
  hemi.color.set(0xfff3d6); hemi.groundColor.set(0x7e4625); hemi.intensity = .74;
  key.color.set(0xffe3b0); key.intensity = 1.7;
  if (mobile) key.shadow.mapSize.set(1024,1024);

  const decor = new THREE.Group(); scene.add(decor);
  const wood = new THREE.MeshStandardMaterial({color:0x6f3b1d,roughness:.58});
  const lightWood = new THREE.MeshStandardMaterial({color:0xa9662f,roughness:.52});
  const metal = new THREE.MeshStandardMaterial({color:0x33231b,roughness:.4,metalness:.6});
  [-3.6,0,3.6].forEach(x => { const b = new THREE.Mesh(new THREE.BoxGeometry(.18,.22,8.2),wood); b.position.set(x,4.18,-.1); b.castShadow=true; decor.add(b); });
  const warm = new THREE.PointLight(0xffb35d,1.3,10,2); warm.position.set(0,3.7,1.7); scene.add(warm);
  [-2.2,2.2].forEach(x => {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.26,.28,20,1,true),metal); shade.rotation.x=Math.PI; shade.position.set(x,3.35,.9); decor.add(shade);
    const bulb = new THREE.PointLight(0xffbd68,1.15,5,2); bulb.position.set(x,3.15,.9); decor.add(bulb);
  });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.9,.9,.72),wood); counter.position.set(-4.25,.45,-2.75); counter.castShadow=true; decor.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.05,.12,.86),lightWood); top.position.set(-4.25,.96,-2.75); top.castShadow=true; decor.add(top);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.12,24),lightWood); table.position.set(3.2,.86,2.75); table.castShadow=true; decor.add(table);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,.8,16),metal); leg.position.set(3.2,.42,2.75); decor.add(leg);
  const fan = new THREE.Group();
  fan.add(new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.2,16),metal));
  for(let i=0;i<4;i++){const arm=new THREE.Group();arm.rotation.y=i*Math.PI/2;const blade=new THREE.Mesh(new THREE.BoxGeometry(1.15,.035,.22),wood);blade.position.x=.62;arm.add(blade);fan.add(arm)}
  fan.position.set(0,3.97,-.7);decor.add(fan);
  const clock = new THREE.Clock();
  (function motion(){requestAnimationFrame(motion);const t=clock.getElapsedTime();fan.rotation.y=t*1.05;warm.intensity=1.25+Math.sin(t*.7)*.08})();

  if (!sessionStorage.getItem('twBakeryCameraSeen')) { camera.position.set(10.4,8.2,11.5); controls.target.set(0,1.35,-.15); controls.update(); sessionStorage.setItem('twBakeryCameraSeen','1'); }
})();
